/**
 * LLM prompt building and response parsing
 */

import type { FileSummary, CommitGroup, ConventionalType } from '@kb-labs/commit-contracts';

/**
 * System prompt for LLM - Phase 1 (file summaries only)
 */
export const SYSTEM_PROMPT = `You are a git commit message generator. Analyze the changed files and generate a commit plan.

Output valid JSON only. No markdown, no explanations.

IMPORTANT: You must assess your confidence level. If file paths and stats alone are not enough to determine the correct commit type and message, set needsMoreContext to true and list the files you need to see the diff for.

CRITICAL GROUPING RULES:
- Group files by LOGICAL CHANGE, not by file type or directory
- If multiple files implement the same feature/fix/refactor, they belong in ONE commit
- For initial project setup (many new files): group by package or functional area (contracts, core, cli, docs, tests)
- Target: 3-8 commits for <50 files, 5-12 commits for 50-150 files, 10-20 commits for 150+ files
- Ask yourself: "Would a developer make these changes in separate commits?" If no, group them!

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

JSON schema:
{
  "needsMoreContext": false,
  "requestedFiles": ["file1.ts"],
  "commits": [
    {
      "id": "c1",
      "type": "feat|fix|refactor|chore|docs|test|build|ci|perf",
      "scope": "area-scope",
      "message": "short description of the logical change",
      "body": "- affected file 1\\n- affected file 2",
      "files": ["file1.ts", "file2.ts", "file3.ts"],
      "releaseHint": "none|patch|minor|major",
      "breaking": false,
      "confidence": 0.8
    }
  ]
}`;

/**
 * System prompt for LLM - Phase 2 (with diff context)
 */
export const SYSTEM_PROMPT_WITH_DIFF = `You are a git commit message generator. You now have the actual diff content for better context.

Output valid JSON only. No markdown, no explanations.

CRITICAL GROUPING RULES:
- Group files by LOGICAL CHANGE based on diff content
- If files are changed for the same reason, they belong in ONE commit
- For initial project setup (many new files): group by package or functional area (contracts, core, cli, docs, tests)
- Target: 3-8 commits for <50 files, 5-12 commits for 50-150 files, 10-20 commits for 150+ files
- Only separate genuinely DIFFERENT changes

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

JSON schema:
{
  "commits": [
    {
      "id": "c1",
      "type": "feat|fix|refactor|chore|docs|test|build|ci|perf",
      "scope": "area-scope",
      "message": "short description based on actual changes",
      "body": "- what changed\\n- why it changed",
      "files": ["file1.ts", "file2.ts", "file3.ts"],
      "releaseHint": "none|patch|minor|major",
      "breaking": false,
      "confidence": 0.95
    }
  ]
}`;

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
      return `- ${s.path} (${s.status}, ${stats})`;
    })
    .join('\n');

  const diffContent = Array.from(diffs.entries())
    .map(([path, diff]) => {
      // Truncate very long diffs
      const truncatedDiff = diff.length > 2000
        ? diff.slice(0, 2000) + '\n... (truncated)'
        : diff;
      return `### ${path}\n\`\`\`diff\n${truncatedDiff}\n\`\`\``;
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
 * Parse LLM response into commit groups with confidence
 */
export function parseResponse(response: string, summaries?: FileSummary[]): ParsedLLMResponse {
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = response.trim();

  // Remove markdown code block if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    jsonStr = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    if (!parsed.commits || !Array.isArray(parsed.commits)) {
      throw new Error('Invalid response: missing commits array');
    }

    const commits = parsed.commits.map((commit: Record<string, unknown>, index: number) => {
      // Validate and normalize each commit
      const type = normalizeType(commit.type as string);
      const files = Array.isArray(commit.files) ? commit.files as string[] : [];

      if (files.length === 0) {
        throw new Error(`Commit ${index + 1} has no files`);
      }

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

    // Calculate average confidence
    const totalConfidence = commits.reduce((sum: number, c: { confidence: number }) => sum + (c.confidence ?? 0.5), 0);
    const averageConfidence = commits.length > 0 ? totalConfidence / commits.length : 0;

    // 🔧 Post-process: Fix incorrect commit types based on file status
    const commitsWithFixedTypes = summaries
      ? commits.map((c: CommitGroup & { confidence: number }) => fixCommitType(c, summaries))
      : commits;

    // Extract confidence from commits for the response (CommitGroup doesn't have confidence)
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
  } catch (error) {
    throw new Error(
      `Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Fix commit type based on file status heuristics
 * Prevents LLM from marking deletions as 'feat'
 */
function fixCommitType<T extends CommitGroup & { confidence: number }>(
  commit: T,
  summaries: FileSummary[]
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
