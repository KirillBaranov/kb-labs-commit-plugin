/**
 * Heuristic commit plan generation (fallback when LLM unavailable)
 */

import type { FileSummary, CommitGroup, ConventionalType } from '@kb-labs/commit-contracts';
import { dirname, extname, basename } from 'node:path';

/**
 * Generate commit plan using heuristics (no LLM)
 *
 * Groups files by:
 * 1. Directory (same directory = same commit)
 * 2. File type (test files, docs, config)
 */
export function generateHeuristicPlan(summaries: FileSummary[]): CommitGroup[] {
  if (summaries.length === 0) {
    return [];
  }

  // Group files by category
  const groups = new Map<string, FileSummary[]>();

  for (const summary of summaries) {
    const category = categorizeFile(summary.path);
    const existing = groups.get(category) || [];
    existing.push(summary);
    groups.set(category, existing);
  }

  // Convert groups to commits
  const commits: CommitGroup[] = [];
  let commitIndex = 1;

  for (const [category, files] of groups) {
    const type = categoryToType(category);
    const scope = inferScope(files.map((f) => f.path));

    commits.push({
      id: `c${commitIndex++}`,
      type,
      scope,
      message: generateMessage(type, files),
      files: files.map((f) => f.path),
      releaseHint: inferReleaseHint(type, files),
      breaking: false,
    });
  }

  return commits;
}

/**
 * Categorize file for grouping
 */
function categorizeFile(path: string): string {
  const ext = extname(path);
  const name = basename(path);
  const dir = dirname(path);

  // Test files
  if (
    path.includes('.test.') ||
    path.includes('.spec.') ||
    path.includes('__tests__') ||
    dir.includes('/test/') ||
    dir.includes('/tests/')
  ) {
    return 'test';
  }

  // Documentation
  if (ext === '.md' || dir.includes('/docs/') || name === 'README.md') {
    return 'docs';
  }

  // Config files
  if (
    name.startsWith('.') ||
    name.includes('config') ||
    ['package.json', 'tsconfig.json', 'eslint.config.js'].includes(name)
  ) {
    return 'config';
  }

  // CI/CD
  if (dir.includes('.github') || dir.includes('.gitlab') || name.includes('ci')) {
    return 'ci';
  }

  // Build related
  if (dir.includes('/build/') || dir.includes('/dist/') || name.includes('build')) {
    return 'build';
  }

  // Group by top-level directory
  const topDir = dir.split('/')[0] || 'root';
  return `src:${topDir}`;
}

/**
 * Map category to conventional commit type
 */
function categoryToType(category: string): ConventionalType {
  if (category === 'test') return 'test';
  if (category === 'docs') return 'docs';
  if (category === 'config') return 'chore';
  if (category === 'ci') return 'ci';
  if (category === 'build') return 'build';
  return 'chore'; // Default for src:* categories
}

/**
 * Infer scope from file paths
 */
function inferScope(paths: string[]): string | undefined {
  if (paths.length === 0) return undefined;

  // Find common directory
  const dirs = paths.map((p) => dirname(p).split('/'));
  const firstDir = dirs[0];
  if (!firstDir) return undefined;

  if (dirs.length === 1) {
    return firstDir.length > 1 ? firstDir[1] : firstDir[0];
  }

  // Find common prefix
  const commonPrefix: string[] = [];
  const minLength = Math.min(...dirs.map((d) => d.length));
  for (let i = 0; i < minLength; i++) {
    const segment = firstDir[i];
    if (segment && dirs.every((d) => d[i] === segment)) {
      commonPrefix.push(segment);
    } else {
      break;
    }
  }

  // Use last segment of common prefix as scope
  if (commonPrefix.length > 0) {
    const scope = commonPrefix[commonPrefix.length - 1];
    if (scope && scope !== '.' && scope !== 'src') {
      return scope;
    }
  }

  return undefined;
}

/**
 * Generate commit message
 */
function generateMessage(type: ConventionalType, files: FileSummary[]): string {
  const count = files.length;

  // Check if all additions
  const allAdded = files.every((f) => f.status === 'added');
  const allDeleted = files.every((f) => f.status === 'deleted');

  if (type === 'test') {
    if (allAdded) return `add ${count} test file${count > 1 ? 's' : ''}`;
    return `update ${count} test file${count > 1 ? 's' : ''}`;
  }

  if (type === 'docs') {
    if (allAdded) return `add documentation`;
    return `update documentation`;
  }

  if (type === 'ci') {
    return `update ci configuration`;
  }

  if (type === 'build') {
    return `update build configuration`;
  }

  if (type === 'chore') {
    if (files.some((f) => f.path.includes('package.json'))) {
      return `update dependencies`;
    }
    return `update configuration`;
  }

  // Default for src files
  if (allAdded) {
    return `add ${count} file${count > 1 ? 's' : ''}`;
  }
  if (allDeleted) {
    return `remove ${count} file${count > 1 ? 's' : ''}`;
  }
  return `update ${count} file${count > 1 ? 's' : ''}`;
}

/**
 * Infer release hint from type and files
 */
function inferReleaseHint(
  type: ConventionalType,
  _files: FileSummary[]
): 'none' | 'patch' | 'minor' | 'major' {
  switch (type) {
    case 'feat':
      return 'minor';
    case 'fix':
      return 'patch';
    case 'perf':
      return 'patch';
    case 'refactor':
      return 'patch';
    default:
      return 'none';
  }
}
