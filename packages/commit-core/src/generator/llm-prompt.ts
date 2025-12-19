/**
 * LLM prompt building and response parsing
 */

import type { FileSummary, CommitGroup, ConventionalType } from '@kb-labs/commit-contracts';
import type { PatternAnalysis } from './pattern-detector';

/**
 * System prompt for LLM - Phase 1 (file summaries only)
 */
export const SYSTEM_PROMPT = `You are a git commit message generator. Analyze the changed files and generate a commit plan.

CRITICAL OUTPUT FORMAT:
- Return ONLY a valid JSON object
- Do NOT wrap in markdown code blocks (no \`\`\`json, no \`\`\`)
- Do NOT add any text before or after the JSON
- Ensure all strings are properly escaped (use double quotes, escape backslashes and quotes)

IMPORTANT: You must assess your confidence level. If file paths and stats alone are not enough to determine the correct commit type and message, set needsMoreContext to true and list the files you need to see the diff for.

CRITICAL GROUPING RULES:
- Group files by LOGICAL CHANGE, not by file type or directory
- If multiple files implement the same feature/fix/refactor, they belong in ONE commit
- For initial project setup (many new files): group by package or functional area (contracts, core, cli, docs, tests)
- Target: 3-8 commits for <50 files, 5-12 commits for 50-150 files, 10-20 commits for 150+ files
- Ask yourself: "Would a developer make these changes in separate commits?" If no, group them!
- CRITICAL: Each file must appear in EXACTLY ONE commit - no duplicates across commits!

Rules:
1. Use conventional commits: feat, fix, refactor, chore, docs, test, build, ci, perf
2. Group related files - number of commits should scale with file count (see grouping rules above)
3. Each commit must include releaseHint: none, patch, minor, or major
4. Message should be lowercase, imperative mood, no period at end
5. breaking: true only for breaking API changes
6. For commits with 2+ files, add "body" with bullet points listing affected files/changes
7. Set confidence 0.0-1.0 for each commit (how sure you are about type/message)
8. If ANY commit has confidence < 0.7, set needsMoreContext: true
9. Scope should reflect the affected area (e.g., "cli", "api"), not individual files
10. CRITICAL: If ALL files in a commit have status "deleted", use type "chore" or "refactor", NOT "feat"
11. CRITICAL: If a commit is mostly deletions (>80% deletions), use "refactor" or "chore", NOT "feat"

EXACT JSON SCHEMA (copy this structure):
{
  "needsMoreContext": false,
  "requestedFiles": ["file1.ts"],
  "commits": [
    {
      "id": "c1",
      "type": "feat",
      "scope": "area-scope",
      "message": "short description of the logical change",
      "body": "- affected file 1\\n- affected file 2",
      "files": ["file1.ts", "file2.ts", "file3.ts"],
      "releaseHint": "minor",
      "breaking": false,
      "confidence": 0.8
    }
  ]
}

VALID TYPE VALUES: feat, fix, refactor, chore, docs, test, build, ci, perf
VALID RELEASEHINT VALUES: none, patch, minor, major

EXAMPLE OUTPUT (use this as template):
{
  "needsMoreContext": false,
  "requestedFiles": [],
  "commits": [
    {
      "id": "c1",
      "type": "feat",
      "scope": "cli",
      "message": "add commit generation command",
      "body": "- implement generate command\\n- add LLM integration",
      "files": ["src/commands/generate.ts", "src/llm.ts"],
      "releaseHint": "minor",
      "breaking": false,
      "confidence": 0.9
    },
    {
      "id": "c2",
      "type": "test",
      "message": "add tests for commit generator",
      "files": ["tests/generate.test.ts"],
      "releaseHint": "none",
      "breaking": false,
      "confidence": 0.85
    }
  ]
}

REAL-WORLD EXAMPLES (learn from these patterns):

Example 1: Modified files with low addition ratio → refactor, NOT feat
Files:
  - commit-plan.ts (modified, +150/-120)
  - llm-prompt.ts (modified, +80/-60)
Addition ratio: 230/350 = 65% (low, mostly structural changes)
❌ WRONG: feat(core): add commit plan and llm prompt generators
✅ CORRECT: refactor(core): update commit plan and llm prompt logic
Reason: Modified files + low addition ratio = refactoring existing code

Example 2: New package with many files → feat, NOT chore
Files: 21 new files in packages/core-resource-broker/
  - package.json (new)
  - src/broker/resource-broker.ts (new)
  - src/queue/priority-queue.ts (new)
  - ... (18 more new files)
❌ WRONG: chore(core-resource-broker): initialize core resource broker package
✅ CORRECT: feat(core-resource-broker): add resource broker for rate limiting and queueing
Reason: New package = new functionality = feat (even if many files)

Example 3: Bulk move (many added files but not new) → refactor, NOT feat
Files: 100 files with status "added" but isNewFile: false
  - packages/analytics/core/file1.ts (added, isNewFile: false)
  - packages/analytics/core/file2.ts (added, isNewFile: false)
  - ... (98 more files, all moved from elsewhere)
❌ WRONG: feat(analytics): add analytics packages
✅ CORRECT: refactor(analytics): reorganize analytics package structure
Reason: isNewFile: false means files existed before, just moved/reorganized

Example 4: All deleted files → chore, NOT feat
Files: 22 files, all with status "deleted"
  - packages/analytics/test1.spec.ts (deleted, +0/-1579)
  - packages/analytics/test2.spec.ts (deleted, +0/-856)
  - ... (20 more deleted files)
❌ WRONG: feat(analytics): add analytics functionality
✅ CORRECT: chore(analytics): remove unused test files
Reason: Deleting files is cleanup (chore), not new feature

Example 5: True new feature (genuinely new files) → feat
Files: 5 new files with isNewFile: true
  - src/auth/jwt-strategy.ts (added, +200/-0, isNewFile: true)
  - src/auth/auth-middleware.ts (added, +150/-0, isNewFile: true)
  - ... (3 more new files)
✅ CORRECT: feat(auth): add JWT authentication
Reason: New functionality, truly new files, implements new capability
`;

/**
 * System prompt for LLM - Phase 2 (with diff context)
 */
export const SYSTEM_PROMPT_WITH_DIFF = `You are a git commit message generator. You now have the actual diff content for better context.

CRITICAL OUTPUT FORMAT:
- Return ONLY a valid JSON object
- Do NOT wrap in markdown code blocks (no \`\`\`json, no \`\`\`)
- Do NOT add any text before or after the JSON
- Ensure all strings are properly escaped (use double quotes, escape backslashes and quotes)

CRITICAL: USE IsNewFile METADATA TO DISTINGUISH NEW vs MODIFIED FILES:
- Each file includes "IsNewFile: true" or "IsNewFile: false"
- IsNewFile: false → File EXISTED BEFORE in git history → Use "refactor", "fix", or "chore"
- IsNewFile: true → File is TRULY NEW (never existed) → Use "feat" for new functionality
- NEVER use "feat: add initial" for files with "IsNewFile: false" - these are modifications!
- For files marked "[EXISTING FILE - was modified]" in diff section → Use refactor/fix/chore, NOT feat

CRITICAL GROUPING RULES:
- Group files by LOGICAL CHANGE based on diff content
- If files are changed for the same reason, they belong in ONE commit
- IMPORTANT: Most files with status "modified" are REFACTORING, not new features
- For refactoring: analyze the diff to understand what changed (renamed variables, restructured code, etc.)
- Only use "add initial" or "setup" messages if you see truly NEW functionality being created from scratch
- Target: 3-8 commits for <50 files, 5-12 commits for 50-150 files, 10-20 commits for 150+ files
- Only separate genuinely DIFFERENT changes
- CRITICAL: Each file must appear in EXACTLY ONE commit - no duplicates across commits!

Rules:
1. Use conventional commits: feat, fix, refactor, chore, docs, test, build, ci, perf
2. Group related files - number of commits should scale with file count (see grouping rules above)
3. Each commit must include releaseHint: none, patch, minor, or major
4. Message should be lowercase, imperative mood, no period at end
5. breaking: true only for breaking API changes
6. Add "body" with bullet points explaining the actual changes you see in the diff
7. Scope should reflect the affected area (e.g., "cli", "api"), not individual files
8. CRITICAL: If ALL files in a commit are being DELETED (only deletions in diff), use type "chore" or "refactor", NOT "feat"
9. CRITICAL: If a commit is mostly deletions (>80% of lines are deletions), use "refactor" or "chore", NOT "feat"
10. CRITICAL: Check IsNewFile flag FIRST - if false, default to refactor/fix/chore unless diff shows truly new functionality

EXACT JSON SCHEMA (copy this structure):
{
  "commits": [
    {
      "id": "c1",
      "type": "feat",
      "scope": "area-scope",
      "message": "short description based on actual changes",
      "body": "- what changed\\n- why it changed",
      "files": ["file1.ts", "file2.ts", "file3.ts"],
      "releaseHint": "minor",
      "breaking": false,
      "confidence": 0.95
    }
  ]
}

VALID TYPE VALUES: feat, fix, refactor, chore, docs, test, build, ci, perf
VALID RELEASEHINT VALUES: none, patch, minor, major

EXAMPLE OUTPUT (based on actual diff content):
{
  "commits": [
    {
      "id": "c1",
      "type": "refactor",
      "scope": "cli",
      "message": "restructure command routing and plugin discovery",
      "body": "- reorganize command routing logic\\n- extract plugin discovery to separate module\\n- update tests to reflect new structure",
      "files": ["src/commands/routing.ts", "src/plugins/discovery.ts", "src/__tests__/routing.test.ts"],
      "releaseHint": "patch",
      "breaking": false,
      "confidence": 0.95
    }
  ]
}

REAL-WORLD EXAMPLES WITH DIFF CONTEXT (learn from these):

Example 1: Modified files - use diff to determine if feat or refactor
Diff shows:
  - Renamed variables (oldName → newName)
  - Restructured functions (extract to separate modules)
  - Updated imports and exports
❌ WRONG: feat(core): add new commit plan logic
✅ CORRECT: refactor(core): restructure commit plan and prompt generation
Reason: Diff shows reorganization, not new functionality

Example 2: New package - check IsNewFile flags in diff
All files show: IsNewFile: true, implements resource broker from scratch
✅ CORRECT: feat(core-resource-broker): add resource broker for rate limiting
Reason: Genuinely new package with new functionality

Example 3: Moved files - IsNewFile: false despite status "added"
Diff shows: [EXISTING FILE - was modified], same content as before
✅ CORRECT: refactor(analytics): reorganize analytics package structure
Reason: Files moved/reorganized, not newly created

Example 4: Bug fix in existing files
Diff shows: Fix null pointer exception, add validation check
✅ CORRECT: fix(auth): handle null token in authentication middleware
Reason: Fixing broken functionality = fix, not feat
`;

/**
 * Build prompt for LLM from file summaries (Phase 1)
 */
export function buildPrompt(
  summaries: FileSummary[],
  recentCommits: string[]
): string {
  const fileList = summaries
    .map((s) => {
      const stats = s.binary ? 'binary' : `+${s.additions}/-${s.deletions}`;
      return `- ${s.path} (${s.status}, ${stats})`;
    })
    .join('\n');

  const styleHint = recentCommits.length > 0
    ? `\nRecent commit style:\n${recentCommits.slice(0, 5).map((c) => `- "${c}"`).join('\n')}`
    : '';

  return `Files changed:
${fileList}
${styleHint}

Generate commit plan as JSON. If you're unsure about commit type/message from paths alone, set needsMoreContext: true and list files in requestedFiles.`;
}

/**
 * Build enhanced prompt with pattern analysis hints (Phase 1)
 */
export function buildEnhancedPrompt(
  summaries: FileSummary[],
  patternAnalysis: PatternAnalysis,
  recentCommits: string[]
): string {
  const fileList = summaries
    .map((s) => {
      const stats = s.binary ? 'binary' : `+${s.additions}/-${s.deletions}`;
      return `- ${s.path} (${s.status}, ${stats})`;
    })
    .join('\n');

  const styleHint = recentCommits.length > 0
    ? `\nRecent commit style:\n${recentCommits.slice(0, 5).map((c) => `- "${c}"`).join('\n')}`
    : '';

  // Add pattern hints if confidence is high
  const patternHint = patternAnalysis.confidence > 0.7
    ? `\n\n🎯 PATTERN DETECTED (confidence: ${(patternAnalysis.confidence * 100).toFixed(0)}%):
Pattern type: ${patternAnalysis.patternType}
Suggested commit type: ${patternAnalysis.suggestedType || 'unknown'}

Hints:
${patternAnalysis.hints.map(h => `  • ${h}`).join('\n')}

⚠️ IMPORTANT: Consider this pattern analysis when determining commit types!`
    : '';

  return `Files changed:
${fileList}
${styleHint}
${patternHint}

Generate commit plan as JSON. If you're unsure about commit type/message from paths alone, set needsMoreContext: true and list files in requestedFiles.`;
}

/**
 * Build prompt for LLM with diff content (Phase 2 - escalation)
 */
export function buildPromptWithDiff(
  summaries: FileSummary[],
  diffs: Map<string, string>,
  recentCommits: string[]
): string {
  const fileList = summaries
    .map((s) => {
      const stats = s.binary ? 'binary' : `+${s.additions}/-${s.deletions}`;
      const isNew = s.isNewFile ? 'IsNewFile: true' : 'IsNewFile: false';
      return `- ${s.path} (${s.status}, ${stats}, ${isNew})`;
    })
    .join('\n');

  const diffContent = Array.from(diffs.entries())
    .map(([path, diff]) => {
      // Find summary for this file to show isNewFile flag
      const summary = summaries.find((s) => s.path === path);
      const isNewLabel = summary?.isNewFile ? ' [NEW FILE - never existed before]' : ' [EXISTING FILE - was modified]';

      // Truncate very long diffs
      const truncatedDiff = diff.length > 2000
        ? diff.slice(0, 2000) + '\n... (truncated)'
        : diff;
      return `### ${path}${isNewLabel}\n\`\`\`diff\n${truncatedDiff}\n\`\`\``;
    })
    .join('\n\n');

  const styleHint = recentCommits.length > 0
    ? `\nRecent commit style:\n${recentCommits.slice(0, 5).map((c) => `- "${c}"`).join('\n')}`
    : '';

  return `Files changed:
${fileList}
${styleHint}

Diff content for requested files:
${diffContent}

Now generate accurate commit plan based on the actual changes you see:`;
}

/**
 * Parsed LLM response with confidence assessment
 */
export interface ParsedLLMResponse {
  needsMoreContext: boolean;
  requestedFiles: string[];
  commits: CommitGroup[];
  averageConfidence: number;
}

/**
 * Clean and extract JSON from LLM response
 * Handles common LLM quirks: markdown blocks, extra text, trailing commas
 */
function cleanJsonResponse(rawResponse: string): string {
  let cleaned = rawResponse.trim();

  // Remove markdown code blocks (```json...``` or ```...```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  cleaned = cleaned.trim();

  // Try to find JSON object boundaries if wrapped in text
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart < jsonEnd) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  // Remove trailing commas before closing brackets (common JSON error)
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  return cleaned;
}

/**
 * Parse LLM response into commit groups with confidence
 */
export function parseResponse(
  response: string,
  summaries?: FileSummary[],
  patternAnalysis?: PatternAnalysis
): ParsedLLMResponse {
  // Step 1: Clean response from markdown and common issues
  const cleaned = cleanJsonResponse(response);

  // Step 2: Try to parse JSON
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {
    // Enhanced error message with cleaned response preview
    const preview = cleaned.substring(0, 300).replace(/\n/g, ' ');
    throw new Error(
      `Failed to parse LLM response as JSON. ` +
      `Preview: "${preview}${cleaned.length > 300 ? '...' : ''}" ` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Step 3: Validate structure
  if (!parsed.commits || !Array.isArray(parsed.commits)) {
    throw new Error(
      `LLM response missing "commits" array. ` +
      `Got: ${JSON.stringify(parsed).substring(0, 200)}`
    );
  }

  // Allow empty commits array ONLY if needsMoreContext is true (escalation to Phase 2)
  if (parsed.commits.length === 0) {
    if (parsed.needsMoreContext) {
      // LLM is requesting escalation to Phase 2 - return early with empty commits
      return {
        needsMoreContext: true,
        requestedFiles: Array.isArray(parsed.requestedFiles) ? parsed.requestedFiles : [],
        commits: [],
        averageConfidence: 0,
      };
    }
    // Empty commits without escalation is an error
    throw new Error('LLM response has empty commits array and needsMoreContext is not set');
  }

  // Step 4: Validate and normalize each commit
  const commits = parsed.commits.map((commit: Record<string, unknown>, index: number) => {
    // Validate required fields
    if (!commit.type) {
      throw new Error(`Commit ${index + 1} missing required field "type"`);
    }
    if (!commit.files || !Array.isArray(commit.files)) {
      throw new Error(`Commit ${index + 1} missing required field "files" array`);
    }
    if (commit.files.length === 0) {
      throw new Error(`Commit ${index + 1} has empty files array`);
    }
    if (!commit.message) {
      throw new Error(`Commit ${index + 1} missing required field "message"`);
    }

    // Normalize and return
    const type = normalizeType(commit.type as string);
    const files = commit.files as string[];

    return {
      id: (commit.id as string) || `c${index + 1}`,
      type,
      scope: typeof commit.scope === 'string' ? commit.scope : undefined,
      message: typeof commit.message === 'string' ? commit.message : 'update files',
      body: typeof commit.body === 'string' ? commit.body : undefined,
      files,
      releaseHint: normalizeReleaseHint(commit.releaseHint as string),
      breaking: Boolean(commit.breaking),
      confidence: typeof commit.confidence === 'number' ? commit.confidence : 0.5,
    } satisfies CommitGroup & { confidence: number };
  });

  // Step 5: Calculate average confidence
  const totalConfidence = commits.reduce((sum: number, c: { confidence: number }) => sum + (c.confidence ?? 0.5), 0);
  const averageConfidence = commits.length > 0 ? totalConfidence / commits.length : 0;

  // Step 6: Post-process - Fix incorrect commit types based on file status and pattern analysis
  const commitsWithFixedTypes = summaries
    ? commits.map((c: CommitGroup & { confidence: number }) => fixCommitType(c, summaries, patternAnalysis))
    : commits;

  // Step 7: Extract confidence from commits for the response (CommitGroup doesn't have confidence)
  const commitsWithoutConfidence: CommitGroup[] = commitsWithFixedTypes.map((c: CommitGroup & { confidence: number }) => {
    const { confidence: _, ...commit } = c;
    void _;
    return commit;
  });

  return {
    needsMoreContext: Boolean(parsed.needsMoreContext),
    requestedFiles: Array.isArray(parsed.requestedFiles) ? parsed.requestedFiles : [],
    commits: commitsWithoutConfidence,
    averageConfidence,
  };
}

/**
 * Fix commit type based on file status heuristics and pattern analysis
 * Prevents LLM from marking deletions as 'feat', refactoring as 'feat', etc.
 */
function fixCommitType<T extends CommitGroup & { confidence: number }>(
  commit: T,
  summaries: FileSummary[],
  patternAnalysis?: PatternAnalysis
): T {
  // Get summaries for files in this commit
  const commitFiles = commit.files;
  const commitSummaries = summaries.filter((s) => commitFiles.includes(s.path));

  if (commitSummaries.length === 0) {
    return commit; // No summaries, can't validate
  }

  // Rule 1: If ALL files are deleted, this is NOT a feat
  const allDeleted = commitSummaries.every((s) => s.status === 'deleted');
  if (allDeleted && commit.type === 'feat') {
    return {
      ...commit,
      type: 'chore' as ConventionalType,
      message: commit.message.replace(/^add /i, 'remove ').replace(/^added /i, 'removed '),
    };
  }

  // Rule 2: If mostly deletions (>80% of changes are deletions), likely refactor/chore
  const totalAdditions = commitSummaries.reduce((sum, s) => sum + s.additions, 0);
  const totalDeletions = commitSummaries.reduce((sum, s) => sum + s.deletions, 0);
  const totalChanges = totalAdditions + totalDeletions;

  if (totalChanges > 0) {
    const deletionRatio = totalDeletions / totalChanges;

    // If >80% deletions and marked as 'feat', downgrade to 'refactor'
    if (deletionRatio > 0.8 && commit.type === 'feat') {
      return {
        ...commit,
        type: 'refactor' as ConventionalType,
      };
    }
  }

  // Rule 3: Pattern cross-check - use pattern detector confidence to override LLM
  // If pattern detector has high confidence (>0.8) and disagrees with LLM, use pattern's suggestion
  if (patternAnalysis && patternAnalysis.confidence > 0.8 && patternAnalysis.suggestedType) {
    const llmType = commit.type;
    const patternType = patternAnalysis.suggestedType;

    // Override if there's a mismatch and pattern is confident
    if (llmType !== patternType) {
      return {
        ...commit,
        type: patternType as ConventionalType,
      };
    }
  }

  // Rule 4: All modified files with low addition ratio → refactor, NOT feat
  const allModified = commitSummaries.every((s) => s.status === 'modified');

  if (allModified && totalChanges > 0 && commit.type === 'feat') {
    const additionRatio = totalAdditions / totalChanges;

    // If <40% additions (mostly deletions or renames) → refactor
    if (additionRatio < 0.4) {
      return {
        ...commit,
        type: 'refactor' as ConventionalType,
      };
    }

    // If 40-60% additions (balanced changes) → still likely refactor
    // Only keep feat if >60% additions (significant new code)
    if (additionRatio < 0.6) {
      return {
        ...commit,
        type: 'refactor' as ConventionalType,
      };
    }
  }

  // Rule 5: New package detection → feat, NOT chore
  // Detect: includes package.json, 10+ new files in same directory
  const hasPackageJson = commitSummaries.some((s) => s.path.endsWith('package.json'));

  if (hasPackageJson && commitSummaries.length >= 10) {
    const allAdded = commitSummaries.every((s) => s.status === 'added');
    const allIsNewFile = commitSummaries.every((s) => s.isNewFile === true);

    // All files added AND truly new (not moved) → this is a new package
    if (allAdded && allIsNewFile && commit.type === 'chore') {
      return {
        ...commit,
        type: 'feat' as ConventionalType,
        message: commit.message.replace(/^initialize /i, 'add ').replace(/^setup /i, 'add '),
      };
    }
  }

  return commit;
}

/**
 * Normalize commit type to valid conventional type
 */
function normalizeType(type: unknown): ConventionalType {
  const validTypes: ConventionalType[] = [
    'feat', 'fix', 'refactor', 'chore', 'docs', 'test', 'build', 'ci', 'perf',
  ];

  if (typeof type === 'string') {
    const normalized = type.toLowerCase() as ConventionalType;
    if (validTypes.includes(normalized)) {
      return normalized;
    }
  }

  return 'chore';
}

/**
 * Normalize release hint
 */
function normalizeReleaseHint(hint: unknown): 'none' | 'patch' | 'minor' | 'major' {
  if (typeof hint === 'string') {
    const normalized = hint.toLowerCase();
    if (['none', 'patch', 'minor', 'major'].includes(normalized)) {
      return normalized as 'none' | 'patch' | 'minor' | 'major';
    }
  }
  return 'none';
}
