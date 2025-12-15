/**
 * Main commit plan generator
 */

import type { CommitPlan, GitStatus, FileSummary, CommitGroup } from '@kb-labs/commit-contracts';
import type { GenerateOptions } from '../types';
import { useLogger } from '@kb-labs/sdk';
import { getGitStatus, getAllChangedFiles } from '../analyzer/git-status';
import { getFileSummaries, getFileDiffs } from '../analyzer/file-summary';
import { getRecentCommits } from '../analyzer/recent-commits';
import { resolveScope, matchesScope, type ResolvedScope } from '../analyzer/scope-resolver';
import {
  buildPrompt,
  buildPromptWithDiff,
  parseResponse,
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_WITH_DIFF,
  type ParsedLLMResponse,
} from './llm-prompt';
import { generateHeuristicPlan } from './heuristics';
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
  const { cwd, scope, llmComplete, onProgress } = options;
  const logger = useLogger();

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

  // 5. Get recent commits for style reference
  const recentCommits = options.recentCommits ?? await getRecentCommits(cwd, 10);

  // 6. Generate plan using LLM (two-phase) or heuristics
  let commits: CommitGroup[];
  let llmUsed = false;
  let tokensUsed: number | undefined;
  let escalated = false;

  if (llmComplete) {
    try {
      // Phase 1: Generate with file summaries only (with retry)
      const prompt = buildPrompt(summaries, recentCommits);
      const result = await retryLLMCall(
        () => llmComplete(prompt, {
          systemPrompt: SYSTEM_PROMPT,
          temperature: 0.3,
          maxTokens: 2000,
        }),
        'Phase 1',
        logger,
        onProgress
      );

      let parsed = parseResponse(result.content);
      llmUsed = true;
      tokensUsed = result.tokensUsed;

      // Phase 2: Escalate if LLM requests more context or confidence is low
      if (parsed.needsMoreContext || parsed.averageConfidence < CONFIDENCE_THRESHOLD) {
        const confidencePercent = (parsed.averageConfidence * 100).toFixed(0);
        await logger.debug(`LLM confidence ${confidencePercent}%, escalating to Phase 2`, {
          confidence: parsed.averageConfidence,
          needsMoreContext: parsed.needsMoreContext,
          requestedFiles: parsed.requestedFiles,
        });
        onProgress?.(`LLM confidence ${confidencePercent}% - fetching diff...`);

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
          await logger.debug('Re-analyzing with diff context (Phase 2)', {
            filesWithDiff: filesToDiff.length,
          });
          onProgress?.('Re-analyzing with diff context (Phase 2)...');

          // Phase 2: Re-generate with diff context (with retry)
          // Scale maxTokens with file count: more files = more commits = more tokens needed
          const maxTokensPhase2 = Math.min(6000, 3000 + Math.floor(summaries.length / 20) * 500);
          const promptWithDiff = buildPromptWithDiff(summaries, diffs, recentCommits);
          const resultWithDiff = await retryLLMCall(
            () => llmComplete(promptWithDiff, {
              systemPrompt: SYSTEM_PROMPT_WITH_DIFF,
              temperature: 0.3,
              maxTokens: maxTokensPhase2,
            }),
            'Phase 2',
            logger,
            onProgress
          );

          parsed = parseResponse(resultWithDiff.content);
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

  // 6. Build final plan
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
 * 2. Add missing files that LLM forgot
 * 3. Track warnings for debugging
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
  const nonEmptyCommits = commits.filter((c) => c.files.length > 0);

  // Step 3: Find missing files and add them
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

      if (attempt < MAX_LLM_RETRIES) {
        await logger.warn(`${phase} failed (attempt ${attempt}/${MAX_LLM_RETRIES}), retrying...`, {
          error: lastError.message,
          attempt,
        });
        onProgress?.(`${phase} error, retrying (${attempt}/${MAX_LLM_RETRIES})...`);

        // Short delay before retry (exponential backoff: 1s, 2s, 4s...)
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      } else {
        await logger.error(`${phase} failed after ${MAX_LLM_RETRIES} attempts: ${lastError.message}`);
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error(`${phase} failed after ${MAX_LLM_RETRIES} attempts`);
}
