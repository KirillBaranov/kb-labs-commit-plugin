/**
 * Git status analysis
 */

import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { simpleGit, type SimpleGit, type StatusResult } from 'simple-git';
import type { GitStatus } from '@kb-labs/commit-contracts';

export interface GitStatusOptions {
  /** Scope path pattern (e.g., 'kb-labs-sdk/**') */
  scope?: string;
}

/**
 * Get current git status (staged, unstaged, untracked files)
 * Supports nested git repositories when scope points to a directory with .git
 */
export async function getGitStatus(cwd: string, options: GitStatusOptions = {}): Promise<GitStatus> {
  const { scope } = options;

  // Check if scope points to a nested git repository
  if (scope) {
    const nestedRepo = detectNestedRepo(cwd, scope);
    if (nestedRepo) {
      return getNestedRepoStatus(cwd, nestedRepo);
    }
  }

  // Regular git status from cwd
  const git: SimpleGit = simpleGit(cwd);
  const status: StatusResult = await git.status();

  return {
    staged: [...status.staged],
    unstaged: [...status.modified, ...status.deleted].filter(
      (f) => !status.staged.includes(f)
    ),
    untracked: [...status.not_added],
  };
}

/**
 * Detect if scope points to a nested git repository
 * Returns the nested repo path if found, undefined otherwise
 */
function detectNestedRepo(cwd: string, scope: string): string | undefined {
  // Extract base directory from scope pattern
  // 'kb-labs-sdk/**' -> 'kb-labs-sdk'
  // 'packages/foo/**' -> 'packages/foo'
  const baseDir = scope.split('/').filter(p => !p.includes('*'))[0];
  if (!baseDir) return undefined;

  const nestedPath = join(cwd, baseDir);
  const nestedGit = join(nestedPath, '.git');

  // Check if it's a nested git repo
  if (existsSync(nestedGit)) {
    return nestedPath;
  }

  return undefined;
}

/**
 * Get git status from a nested repository
 * Prefixes all paths with the relative path to the nested repo
 */
async function getNestedRepoStatus(rootCwd: string, nestedPath: string): Promise<GitStatus> {
  const git: SimpleGit = simpleGit(nestedPath);
  const status: StatusResult = await git.status();

  // Calculate relative prefix for file paths
  const prefix = relative(rootCwd, nestedPath);
  const prefixPath = (file: string) => prefix ? `${prefix}/${file}` : file;

  return {
    staged: status.staged.map(prefixPath),
    unstaged: [...status.modified, ...status.deleted]
      .filter((f) => !status.staged.includes(f))
      .map(prefixPath),
    untracked: status.not_added.map(prefixPath),
  };
}

/**
 * Get all changed files (staged + unstaged + untracked)
 */
export function getAllChangedFiles(status: GitStatus): string[] {
  return [...new Set([...status.staged, ...status.unstaged, ...status.untracked])];
}

/**
 * Check if there are any changes
 */
export function hasChanges(status: GitStatus): boolean {
  return status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0;
}

/**
 * Get current branch name
 */
export async function getCurrentBranch(cwd: string): Promise<string> {
  const git: SimpleGit = simpleGit(cwd);
  const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
  return branch.trim();
}

/**
 * Check if branch is protected (main/master)
 */
export function isProtectedBranch(branch: string): boolean {
  const protectedBranches = ['main', 'master', 'develop', 'release', 'production'];
  return protectedBranches.includes(branch.toLowerCase());
}
