/**
 * Main commit plan generator
 */

import type { CommitPlan, GitStatus, FileSummary, CommitGroup } from '@kb-labs/commit-contracts';
import type { GenerateOptions } from '../types';
import { useLogger, useAnalytics, useLLM } from '@kb-labs/sdk';
import { getGitStatus, getAllChangedFiles } from '../analyzer/git-status';
import { getFileSummaries, getFileDiffs } from '../analyzer/file-summary';
import { getRecentCommits } from '../analyzer/recent-commits';
import { resolveScope, matchesScope, type ResolvedScope } from '../analyzer/scope-resolver';
import {
  buildPrompt,
  buildPromptWithDiff,
  buildEnhancedPrompt,
  parseResponse,
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_WITH_DIFF,
  type ParsedLLMResponse,
} from './llm-prompt';
import { generateHeuristicPlan } from './heuristics';
import { analyzePatterns, type PatternAnalysis } from './pattern-detector';
import { minimatch } from 'minimatch';
import {
  detectSecretFiles,
  detectSecretsInDiffs,
  formatSecretsWarning,
} from '../analyzer/secrets-detector';

/** Confidence threshold - below this we escalate to Phase 2 with diff */
const CONFIDENCE_THRESHOLD = 0.7;

/** Maximum retry attempts for LLM generation (both phases) */
const MAX_LLM_RETRIES = 2;

/**
 * Generate a commit plan from current git changes
 */
export async function generateCommitPlan(options: GenerateOptions): Promise<CommitPlan> {
  const { cwd, scope, onProgress } = options;

  const logger = useLogger();
  const analytics = useAnalytics();
  const llm = useLLM();
  const startTime = Date.now();

  // 1. Resolve scope first if provided
  // Supports: package names (@kb-labs/core), wildcards (@kb-labs/*), and path patterns (packages/**)
  let resolvedScope: ResolvedScope | undefined;
  let scopePathForGit: string | undefined;
  if (scope) {
    resolvedScope = await resolveScope(cwd, scope);

    // If scope resolved to a single package path, use it for nested repo detection
    if (resolvedScope.packagePaths.length === 1) {
      scopePathForGit = resolvedScope.packagePaths[0];
    } else {
      // For wildcards or path patterns, use original scope
      scopePathForGit = scope;
    }
  }

  // 2. Get git status (with scope support for nested repos)
  const gitStatus = await getGitStatus(cwd, { scope: scopePathForGit });
  let allFiles = getAllChangedFiles(gitStatus);

  // 3. Apply scope filter if provided
  if (resolvedScope) {
    allFiles = filterFilesByScope(allFiles, resolvedScope);
  }

  if (allFiles.length === 0) {
    return createEmptyPlan(cwd, gitStatus);
  }

  // 3. 🔒 Security: Check for secret files early - ABORT if found!
  const secretFiles = detectSecretFiles(allFiles);

  if (secretFiles.length > 0) {
    const warning = formatSecretsWarning(secretFiles);
    await logger.error('🚨 SECRETS DETECTED - ABORTING COMMIT GENERATION', new Error('Secrets detected'), {
      secretFiles,
    });
    console.error('\n' + warning + '\n');

    // ABORT - do not create any commits with secrets
    throw new Error(`Secrets detected in ${secretFiles.length} file(s). Cannot proceed with commit generation. Add these files to .gitignore or remove secrets before committing.`);
  }

  // 4. Get file summaries (diff stats)
  const summaries = await getFileSummaries(cwd, allFiles);

  // 5. Analyze patterns BEFORE LLM (pre-processing)
  const patternAnalysis = analyzePatterns(summaries);

  // Track pattern detection
  if (patternAnalysis.confidence > 0.7) {
    await analytics?.track('commit.pattern-detected', {
      patternType: patternAnalysis.patternType,
      confidence: patternAnalysis.confidence,
      suggestedType: patternAnalysis.suggestedType,
      fileCount: summaries.length,
      hints: patternAnalysis.hints,
    });

    // Log pattern detection for debugging
    await logger.debug(`Pattern detected: ${patternAnalysis.patternType} (confidence: ${patternAnalysis.confidence.toFixed(2)})`, {
      suggestedType: patternAnalysis.suggestedType,
      hints: patternAnalysis.hints,
    });
  }

  // 6. Get recent commits for style reference
  const recentCommits = options.recentCommits ?? await getRecentCommits(cwd, 10);

  // 7. Generate plan using LLM (two-phase) or heuristics
  let commits: CommitGroup[];
  let llmUsed = false;
  let tokensUsed: number | undefined;
  let escalated = false;

  if (llm) {
    try {
      // Phase 1: Generate with file summaries and pattern hints (with retry)
      const prompt = buildEnhancedPrompt(summaries, patternAnalysis, recentCommits);

      const result = await retryLLMCall(
        () => llm.complete(prompt, {
          systemPrompt: SYSTEM_PROMPT,
          temperature: 0.3,
          maxTokens: 2000,
        }),
        'Phase 1',
        logger,
        onProgress
      );

      let parsed = parseResponse(result.content, summaries, patternAnalysis);
      llmUsed = true;
      tokensUsed = result.tokensUsed;

      // Phase 2: Escalate if LLM requests more context, confidence is low, or 10+ files
      const shouldEscalate = parsed.needsMoreContext
        || parsed.averageConfidence < CONFIDENCE_THRESHOLD
        || summaries.length >= 10;

      if (shouldEscalate) {
        const reason = summaries.length >= 10
          ? `${summaries.length} files (≥10)`
          : `confidence ${(parsed.averageConfidence * 100).toFixed(0)}%`;
        await logger.debug(`Escalating to Phase 2: ${reason}`, {
          fileCount: summaries.length,
          confidence: parsed.averageConfidence,
          needsMoreContext: parsed.needsMoreContext,
          requestedFiles: parsed.requestedFiles,
        });
        onProgress?.(`${reason} - fetching diff...`);

        // Get diff for requested files (or all files if none specified)
        const filesToDiff = parsed.requestedFiles.length > 0
          ? parsed.requestedFiles.filter((f) => summaries.some((s) => s.path === f))
          : summaries.map((s) => s.path);

        const diffs = await getFileDiffs(cwd, filesToDiff);

        // 🔒 Security: Check for secrets in diffs before sending to LLM
        const secretDiffs = detectSecretsInDiffs(diffs);
        const secretFilesInDiff = Array.from(secretDiffs.keys());

        if (secretFilesInDiff.length > 0) {
          // Found secrets in diff content - ABORT COMPLETELY
          const warning = formatSecretsWarning(secretFilesInDiff);
          await logger.error('🚨 SECRETS DETECTED IN DIFF CONTENT - ABORTING', new Error('Secrets in diff'), {
            secretFiles: secretFilesInDiff,
          });
          onProgress?.('🚨 Secrets detected - ABORTING');

          // Show error to user
          console.error('\n' + warning + '\n');

          // ABORT - do not proceed
          throw new Error(`Secrets detected in ${secretFilesInDiff.length} file(s) diff content. Cannot proceed with commit generation. Remove secrets before committing.`);
        }

        if (diffs.size > 0) {
          // Phase 2: Re-generate with diff context (with retry)
          // Scale maxTokens with file count: more files = more commits = more tokens needed
          const maxTokensPhase2 = Math.min(6000, 3000 + Math.floor(summaries.length / 20) * 500);
          const promptWithDiff = buildPromptWithDiff(summaries, diffs, recentCommits);

          await logger.debug('Re-analyzing with diff context (Phase 2)', {
            filesWithDiff: filesToDiff.length,
            promptPreview: promptWithDiff.substring(0, 500),
          });
          onProgress?.('Re-analyzing with diff context (Phase 2)...');
          const resultWithDiff = await retryLLMCall(
            () => llm.complete(promptWithDiff, {
              systemPrompt: SYSTEM_PROMPT_WITH_DIFF,
              temperature: 0.3,
              maxTokens: maxTokensPhase2,
            }),
            'Phase 2',
            logger,
            onProgress
          );

          parsed = parseResponse(resultWithDiff.content, summaries, patternAnalysis);
          tokensUsed = (tokensUsed ?? 0) + (resultWithDiff.tokensUsed ?? 0);
          escalated = true;
        }
      }

      commits = parsed.commits;

      // Validate that all files from summaries are included
      commits = validateAndFixCommits(commits, summaries);
    } catch (error) {
      // Fallback to heuristics on LLM error after all retries failed
      await logger.warn('LLM generation failed after retries, falling back to heuristics', {
        error: error instanceof Error ? error.message : String(error),
      });
      onProgress?.('LLM failed, using heuristics...');
      commits = generateHeuristicPlan(summaries);
    }
  } else {
    commits = generateHeuristicPlan(summaries);
  }

  // 6. Track analytics
  const typeDistribution = commits.reduce((acc, commit) => {
    acc[commit.type] = (acc[commit.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  await analytics?.track('commit.generation-complete', {
    totalFiles: summaries.length,
    totalCommits: commits.length,
    llmUsed,
    escalated,
    tokensUsed,
    durationMs: Date.now() - startTime,
    typeDistribution,
    scope: scope || 'all',
  });

  // 7. Build final plan
  return {
    schemaVersion: '1.0',
    createdAt: new Date().toISOString(),
    repoRoot: cwd,
    gitStatus: filterGitStatusByScope(gitStatus, resolvedScope),
    commits,
    metadata: {
      totalFiles: summaries.length,
      totalCommits: commits.length,
      llmUsed,
      tokensUsed,
      escalated,
    },
  };
}

/**
 * Create empty plan when no changes
 */
function createEmptyPlan(cwd: string, gitStatus: GitStatus): CommitPlan {
  return {
    schemaVersion: '1.0',
    createdAt: new Date().toISOString(),
    repoRoot: cwd,
    gitStatus,
    commits: [],
    metadata: {
      totalFiles: 0,
      totalCommits: 0,
      llmUsed: false,
    },
  };
}

/**
 * Filter files by resolved scope
 * Supports package names, wildcards, and path patterns
 */
function filterFilesByScope(files: string[], resolvedScope: ResolvedScope): string[] {
  if (resolvedScope.type === 'path-pattern') {
    // Use minimatch for path patterns
    return files.filter((file) => minimatch(file, resolvedScope.original));
  }

  // For package names and wildcards, use matchesScope
  return files.filter((file) => matchesScope(file, resolvedScope));
}

/**
 * Filter git status by resolved scope
 */
function filterGitStatusByScope(status: GitStatus, resolvedScope?: ResolvedScope): GitStatus {
  if (!resolvedScope) return status;

  const filterFn = (files: string[]) => filterFilesByScope(files, resolvedScope);

  return {
    staged: filterFn(status.staged),
    unstaged: filterFn(status.unstaged),
    untracked: filterFn(status.untracked),
  };
}

export interface ValidationResult {
  commits: CommitGroup[];
  warnings: string[];
  hallucinations: string[];
}

/**
 * Anti-hallucination validation: ensure LLM output matches reality
 * 1. Remove hallucinated files (files that don't exist in git status)
 * 2. Remove duplicate files (file appears in multiple commits)
 * 3. Add missing files that LLM forgot
 * 4. Track warnings for debugging
 */
function validateAndFixCommits(
  commits: CommitGroup[],
  summaries: FileSummary[]
): CommitGroup[] {
  const realFiles = new Set(summaries.map((s) => s.path));
  const hallucinations: string[] = [];

  // Step 1: Remove hallucinated files from each commit
  for (const commit of commits) {
    const validFiles: string[] = [];
    for (const file of commit.files) {
      if (realFiles.has(file)) {
        validFiles.push(file);
      } else {
        hallucinations.push(file);
      }
    }
    commit.files = validFiles;
  }

  // Step 2: Remove empty commits (all files were hallucinated)
  let nonEmptyCommits = commits.filter((c) => c.files.length > 0);

  // Step 3: Remove duplicate files - keep only first occurrence
  const logger = useLogger();
  const seenFiles = new Set<string>();
  const duplicates: Array<{ file: string; commit: string }> = [];

  for (const commit of nonEmptyCommits) {
    const uniqueFiles: string[] = [];
    for (const file of commit.files) {
      if (!seenFiles.has(file)) {
        uniqueFiles.push(file);
        seenFiles.add(file);
      } else {
        duplicates.push({ file, commit: commit.id });
      }
    }
    commit.files = uniqueFiles;
  }

  // Log duplicates for debugging LLM behavior
  if (duplicates.length > 0) {
    logger.warn(`LLM returned ${duplicates.length} duplicate file(s) across commits - removed duplicates`, {
      duplicateCount: duplicates.length,
      samples: duplicates.slice(0, 5).map(d => `${d.file} in ${d.commit}`),
    });
  }

  // Step 4: Remove commits that became empty after deduplication
  nonEmptyCommits = nonEmptyCommits.filter((c) => c.files.length > 0);

  // Step 5: Find missing files and add them
  const allFilesInCommits = new Set(nonEmptyCommits.flatMap((c) => c.files));
  const missingFiles = summaries
    .map((s) => s.path)
    .filter((f) => !allFilesInCommits.has(f));

  if (missingFiles.length > 0) {
    nonEmptyCommits.push({
      id: `c${nonEmptyCommits.length + 1}`,
      type: 'chore',
      message: 'update additional files',
      files: missingFiles,
      releaseHint: 'none',
      breaking: false,
    });
  }

  return nonEmptyCommits;
}

/**
 * Retry LLM call with automatic fallback on parse errors
 * Tries up to MAX_LLM_RETRIES times before throwing
 */
async function retryLLMCall(
  llmFn: () => Promise<{ content: string; tokensUsed?: number }>,
  phase: string,
  logger: ReturnType<typeof useLogger>,
  onProgress?: (message: string) => void
): Promise<{ content: string; tokensUsed?: number }> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_LLM_RETRIES; attempt++) {
    try {
      const result = await llmFn();

      // Try to parse response to validate JSON
      parseResponse(result.content);

      // Success - return result
      if (attempt > 1) {
        await logger.debug(`${phase} succeeded on attempt ${attempt}/${MAX_LLM_RETRIES}`);
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // DEBUG: Log full error details
      await logger.error(`🔍 LLM call failed (attempt ${attempt})`, lastError, {
        errorName: lastError.name,
        errorMessage: lastError.message,
        errorStack: lastError.stack,
      });

      // Extract error type for better user feedback
      const errorType = getErrorType(lastError);

      if (attempt < MAX_LLM_RETRIES) {
        // Log to file with full details
        await logger.warn(`${phase} failed (attempt ${attempt}/${MAX_LLM_RETRIES}): ${errorType}`, {
          errorMessage: lastError.message,
          errorType,
          attempt,
          stack: lastError.stack?.split('\n').slice(0, 3).join('\n'), // First 3 lines only
        });

        // Show concise user message
        onProgress?.(`${phase} ${errorType}, retrying (${attempt}/${MAX_LLM_RETRIES})...`);

        // Short delay before retry (exponential backoff: 1s, 2s, 4s...)
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      } else {
        await logger.error(`${phase} failed after ${MAX_LLM_RETRIES} attempts: ${errorType}`, lastError, {
          errorType,
        });
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error(`${phase} failed after ${MAX_LLM_RETRIES} attempts`);
}

/**
 * Extract user-friendly error type from error message
 */
function getErrorType(error: Error): string {
  const message = error.message.toLowerCase();

  // Rate limiting
  if (message.includes('429') || message.includes('rate limit') || message.includes('too many requests')) {
    return 'rate limited (429)';
  }

  // Server errors
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return 'server error (5xx)';
  }

  // Timeout
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }

  // Network errors
  if (message.includes('network') || message.includes('econnrefused') || message.includes('enotfound')) {
    return 'network error';
  }

  // Parse errors (invalid JSON from LLM)
  if (message.includes('json') || message.includes('parse') || message.includes('unexpected token')) {
    return 'invalid JSON';
  }

  // LLM response validation errors
  if (message.includes('missing') || message.includes('missing required field')) {
    return 'invalid structure';
  }

  // Generic - include first 50 chars of error for debugging
  const preview = error.message.substring(0, 50).replace(/\n/g, ' ');
  return `error: ${preview}${error.message.length > 50 ? '...' : ''}`;
}
