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
    staged: status.staged.filter(f => !shouldIgnoreFile(f)),
    unstaged: [...status.modified, ...status.deleted]
      .filter((f) => !status.staged.includes(f))
      .filter(f => !shouldIgnoreFile(f)),
    untracked: status.not_added.filter(f => !shouldIgnoreFile(f)),
  };
}

/**
 * Detect if scope points to a nested git repository
 * Returns the nested repo path if found, undefined otherwise
 */
function detectNestedRepo(cwd: string, scope: string): string | undefined {
  // Normalize package scope to directory name first
  // '@kb-labs/release-manager' -> 'kb-labs-release-manager'
  // '@kb-labs/mind/**' -> 'kb-labs-mind'
  // 'kb-labs-sdk/**' -> 'kb-labs-sdk'
  // 'packages/foo/**' -> 'packages/foo'
  const normalizedScope = scope
    .replace(/^@/, '')           // Remove leading @
    .replace(/\//g, '-')         // Replace / with -
    .replace(/\*\*/g, '')        // Remove wildcards
    .replace(/\/\*/g, '')        // Remove trailing /*
    .replace(/-+$/, '')          // Remove trailing dashes
    .trim();

  // Extract base directory from normalized scope
  // 'kb-labs-release-manager' -> 'kb-labs-release-manager'
  // 'packages-foo' -> 'packages-foo'
  const baseDir = normalizedScope.split('-').length > 0 ? normalizedScope : scope.split('/').filter(p => !p.includes('*'))[0];
  if (!baseDir) {
    return undefined;
  }

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
    staged: status.staged
      .filter(f => !shouldIgnoreFile(f))
      .map(prefixPath),
    unstaged: [...status.modified, ...status.deleted]
      .filter((f) => !status.staged.includes(f))
      .filter(f => !shouldIgnoreFile(f))
      .map(prefixPath),
    untracked: status.not_added
      .filter(f => !shouldIgnoreFile(f))
      .map(prefixPath),
  };
}

/**
 * Check if file should be ignored (node_modules, dist, etc.)
 */
function shouldIgnoreFile(file: string): boolean {
  const ignoredPaths = [
    'node_modules/',
    '.git/',
    'dist/',
    'build/',
    '.next/',
    '.turbo/',
    'coverage/',
    '.cache/',
    '.temp/',
    'tmp/',
  ];

  return ignoredPaths.some(path => file.includes(path));
}

/**
 * Get all changed files (staged + unstaged + untracked)
 * Filters out node_modules and other build artifacts
 */
export function getAllChangedFiles(status: GitStatus): string[] {
  const allFiles = [...new Set([...status.staged, ...status.unstaged, ...status.untracked])];
  return allFiles.filter(file => !shouldIgnoreFile(file));
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
