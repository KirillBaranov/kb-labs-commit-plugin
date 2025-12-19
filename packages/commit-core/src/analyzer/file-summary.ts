/**
 * File summary extraction
 */

import { simpleGit, type SimpleGit, type DiffResultTextFile, type DiffResultBinaryFile } from 'simple-git';
import type { FileSummary } from '@kb-labs/commit-contracts';

/**
 * Type guard for text file diff result
 */
function isTextFile(file: DiffResultTextFile | DiffResultBinaryFile): file is DiffResultTextFile {
  return !file.binary;
}

/**
 * Check if file is truly new (never existed in repo history)
 * Returns true if file has no creation history in git
 * Supports nested git repositories
 */
async function isNewFile(cwd: string, filePath: string): Promise<boolean> {
  try {
    // Determine correct git repo for this file (handle nested repos)
    const segments = filePath.split('/');
    const potentialRepoDir = segments[0];
    const potentialRepoPath = `${cwd}/${potentialRepoDir}`;
    const potentialGitDir = `${potentialRepoPath}/.git`;

    // Check if it's a nested git repo
    const isNestedRepo = await existsAsync(potentialGitDir);

    let git: SimpleGit;
    let relativeFilePath: string;

    if (isNestedRepo) {
      // Use nested repo as git root, strip first segment from path
      git = simpleGit(potentialRepoPath);
      relativeFilePath = segments.slice(1).join('/');
    } else {
      // Use cwd as git root
      git = simpleGit(cwd);
      relativeFilePath = filePath;
    }

    // Check if file has creation history (when it was first added)
    // git log --diff-filter=A --format=%H -1 -- <file>
    // Returns commit hash if file was created, empty if never existed
    const result = await git.log(['--diff-filter=A', '--format=%H', '-1', '--', relativeFilePath]);

    // If no commits found, file is truly new (never existed before)
    return result.all.length === 0;
  } catch {
    // On error, assume it's new (safer to say "new" than claim it existed)
    return true;
  }
}

/**
 * Get file summaries with diff stats for given files
 */
export async function getFileSummaries(cwd: string, files: string[]): Promise<FileSummary[]> {
  if (files.length === 0) {
    return [];
  }

  const git: SimpleGit = simpleGit(cwd);
  const summaries: FileSummary[] = [];

  // Get diff stats for all files at once
  try {
    // Use numstat for additions/deletions count
    const diffSummary = await git.diffSummary(['--cached', '--', ...files]);

    for (const file of diffSummary.files) {
      // Check if file is truly new (never existed in repo history)
      // Pass cwd to support nested repos
      const isNew = await isNewFile(cwd, file.file);

      // Handle both text and binary files
      if (isTextFile(file)) {
        summaries.push({
          path: file.file,
          status: mapDiffStatus(file.insertions, file.deletions),
          additions: file.insertions,
          deletions: file.deletions,
          binary: false,
          isNewFile: isNew,
        });
      } else {
        // Binary file
        summaries.push({
          path: file.file,
          status: 'modified',
          additions: 0,
          deletions: 0,
          binary: true,
          isNewFile: isNew,
        });
      }
    }

    // Add any missing files (untracked)
    const missingFiles = files.filter((f) => !summaries.some((s) => s.path === f));
    for (const file of missingFiles) {
      // Untracked files are always new
      summaries.push({
        path: file,
        status: 'added',
        additions: 0,
        deletions: 0,
        binary: false,
        isNewFile: true,
      });
    }
  } catch {
    // Fallback: create basic summaries without diff stats
    for (const file of files) {
      summaries.push({
        path: file,
        status: 'modified',
        additions: 0,
        deletions: 0,
        binary: false,
        isNewFile: false, // Conservative assumption - treat as existing file
      });
    }
  }

  return summaries;
}

/**
 * Map insertions/deletions to status
 */
function mapDiffStatus(insertions: number, deletions: number): FileSummary['status'] {
  // Simple heuristic: if only insertions, likely added; if only deletions, likely deleted
  if (deletions === 0 && insertions > 0) {
    return 'added';
  }
  if (insertions === 0 && deletions > 0) {
    return 'deleted';
  }
  return 'modified';
}

/**
 * Get a short summary string for display
 */
export function formatFileSummary(summary: FileSummary): string {
  const stats = summary.binary
    ? 'binary'
    : `+${summary.additions}/-${summary.deletions}`;
  return `${summary.path} (${summary.status}, ${stats})`;
}

/**
 * Get diff content for specific files
 * Used when LLM requests more context (Phase 2 escalation)
 * Supports nested git repositories (files with prefix like 'kb-labs-sdk/...')
 */
export async function getFileDiffs(cwd: string, files: string[]): Promise<Map<string, string>> {
  if (files.length === 0) {
    return new Map();
  }

  const diffs = new Map<string, string>();

  // Group files by potential nested repo
  const filesByRepo = new Map<string, { repoPath: string; relativePath: string; originalPath: string }[]>();

  for (const file of files) {
    // Check if file is in a nested repo (first segment might be a git repo)
    const segments = file.split('/');
    const potentialRepoDir = segments[0];
    const potentialRepoPath = `${cwd}/${potentialRepoDir}`;
    const potentialGitDir = `${potentialRepoPath}/.git`;

    // Check if it's actually a nested git repo
    const isNestedRepo = await existsAsync(potentialGitDir);

    if (isNestedRepo) {
      // Use nested repo as git root, strip first segment from path
      const relativePath = segments.slice(1).join('/');
      const group = filesByRepo.get(potentialRepoPath) ?? [];
      group.push({ repoPath: potentialRepoPath, relativePath, originalPath: file });
      filesByRepo.set(potentialRepoPath, group);
    } else {
      // Use cwd as git root
      const group = filesByRepo.get(cwd) ?? [];
      group.push({ repoPath: cwd, relativePath: file, originalPath: file });
      filesByRepo.set(cwd, group);
    }
  }

  // Get diffs for each repo
  for (const [repoPath, fileInfos] of filesByRepo) {
    const git: SimpleGit = simpleGit(repoPath);

    for (const { relativePath, originalPath } of fileInfos) {
      try {
        // Try staged diff first, then unstaged
        let diff = await git.diff(['--cached', '--', relativePath]);
        if (!diff) {
          diff = await git.diff(['--', relativePath]);
        }
        if (!diff) {
          // For untracked files, try to read content
          diff = await git.show([`:${relativePath}`]).catch(() => '');
        }
        if (diff) {
          diffs.set(originalPath, diff);
        }
      } catch {
        // Skip files that can't be diffed
      }
    }
  }

  return diffs;
}

/**
 * Helper to check if path exists asynchronously
 */
async function existsAsync(path: string): Promise<boolean> {
  try {
    const { existsSync } = await import('node:fs');
    return existsSync(path);
  } catch {
    return false;
  }
}
