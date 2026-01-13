/**
 * Tests for git-status.ts - nested repo detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { getGitStatus } from '../../src/analyzer/git-status';
import { simpleGit } from 'simple-git';

describe('git-status - detectNestedRepo', () => {
  const testRoot = join(process.cwd(), '.test-nested-repos');
  const parentRepo = join(testRoot, 'parent');
  const nestedRepo = join(testRoot, 'parent', 'kb-labs-release-manager');

  beforeEach(async () => {
    // Create test directory structure
    await mkdir(nestedRepo, { recursive: true });

    // Initialize parent git repo
    const parentGit = simpleGit(parentRepo);
    await parentGit.init();
    await parentGit.addConfig('user.name', 'Test User');
    await parentGit.addConfig('user.email', 'test@example.com');

    // Initialize nested git repo (submodule-like)
    const nestedGit = simpleGit(nestedRepo);
    await nestedGit.init();
    await nestedGit.addConfig('user.name', 'Test User');
    await nestedGit.addConfig('user.email', 'test@example.com');

    // Add a test file to nested repo
    await writeFile(join(nestedRepo, 'test.ts'), 'export const test = 1;');
  });

  afterEach(async () => {
    // Cleanup
    await rm(testRoot, { recursive: true, force: true });
  });

  it('should detect nested repo with @scope/package format', async () => {
    // Test with @kb-labs/release-manager scope
    const status = await getGitStatus(parentRepo, { scope: '@kb-labs/release-manager' });

    // Should find files from nested repo with prefixed paths
    expect(status.untracked).toContain('kb-labs-release-manager/test.ts');
  });

  it('should detect nested repo with package/** wildcard format', async () => {
    // Test with wildcard scope
    const status = await getGitStatus(parentRepo, { scope: 'kb-labs-release-manager/**' });

    // Should find files from nested repo with prefixed paths
    expect(status.untracked).toContain('kb-labs-release-manager/test.ts');
  });

  it('should detect nested repo with plain package name', async () => {
    // Test with plain package name
    const status = await getGitStatus(parentRepo, { scope: 'kb-labs-release-manager' });

    // Should find files from nested repo with prefixed paths
    expect(status.untracked).toContain('kb-labs-release-manager/test.ts');
  });

  it('should handle @scope/package with wildcards', async () => {
    // Test with @scope/package/** format
    const status = await getGitStatus(parentRepo, { scope: '@kb-labs/release-manager/**' });

    // Should find files from nested repo with prefixed paths
    expect(status.untracked).toContain('kb-labs-release-manager/test.ts');
  });

  it('should return parent repo status when scope does not match nested repo', async () => {
    // Add file to parent repo
    await writeFile(join(parentRepo, 'parent-file.ts'), 'export const parent = 1;');

    // Test with non-matching scope
    const status = await getGitStatus(parentRepo, { scope: '@kb-labs/non-existent' });

    // Should return empty or parent repo status (no nested detection)
    expect(status.untracked).not.toContain('kb-labs-release-manager/test.ts');
  });

  it('should handle scopes with multiple path segments correctly', async () => {
    // Create nested repo with deeper path: parent/packages/some-package
    const deepNested = join(testRoot, 'parent', 'packages-some-package');
    await mkdir(deepNested, { recursive: true });

    const deepGit = simpleGit(deepNested);
    await deepGit.init();
    await deepGit.addConfig('user.name', 'Test User');
    await deepGit.addConfig('user.email', 'test@example.com');
    await writeFile(join(deepNested, 'deep.ts'), 'export const deep = 1;');

    // Test with packages/some-package scope (with /)
    // This should normalize to packages-some-package
    const status = await getGitStatus(parentRepo, { scope: '@packages/some-package' });

    // Should find files from nested repo
    expect(status.untracked).toContain('packages-some-package/deep.ts');
  });

  it('should not detect nested repo when .git does not exist', async () => {
    // Create directory without .git
    const noGitDir = join(testRoot, 'parent', 'kb-labs-no-git');
    await mkdir(noGitDir, { recursive: true });
    await writeFile(join(noGitDir, 'file.ts'), 'export const test = 1;');

    // Should fall back to parent repo status (file still visible from parent)
    const status = await getGitStatus(parentRepo, { scope: '@kb-labs/no-git' });

    // File should be visible from parent repo (no nested .git, so parent sees it)
    expect(status.untracked).toContain('kb-labs-no-git/file.ts');
  });
});

describe('git-status - scope normalization edge cases', () => {
  const testRoot = join(process.cwd(), '.test-scope-normalize');
  const parentRepo = join(testRoot, 'parent');

  beforeEach(async () => {
    await mkdir(parentRepo, { recursive: true });

    const parentGit = simpleGit(parentRepo);
    await parentGit.init();
    await parentGit.addConfig('user.name', 'Test User');
    await parentGit.addConfig('user.email', 'test@example.com');
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it('should handle trailing slashes in scope', async () => {
    const nestedRepo = join(parentRepo, 'kb-labs-test');
    await mkdir(nestedRepo, { recursive: true });

    const nestedGit = simpleGit(nestedRepo);
    await nestedGit.init();
    await nestedGit.addConfig('user.name', 'Test User');
    await nestedGit.addConfig('user.email', 'test@example.com');
    await writeFile(join(nestedRepo, 'test.ts'), 'test');

    // Scope with trailing slash
    const status = await getGitStatus(parentRepo, { scope: '@kb-labs/test/' });

    expect(status.untracked).toContain('kb-labs-test/test.ts');
  });

  it('should handle multiple slashes in scope', async () => {
    const nestedRepo = join(parentRepo, 'kb-labs-test-package');
    await mkdir(nestedRepo, { recursive: true });

    const nestedGit = simpleGit(nestedRepo);
    await nestedGit.init();
    await nestedGit.addConfig('user.name', 'Test User');
    await nestedGit.addConfig('user.email', 'test@example.com');
    await writeFile(join(nestedRepo, 'test.ts'), 'test');

    // Scope with multiple slashes should normalize to dashes
    const status = await getGitStatus(parentRepo, { scope: '@kb-labs/test/package' });

    expect(status.untracked).toContain('kb-labs-test-package/test.ts');
  });

  it('should handle wildcard patterns correctly', async () => {
    const nestedRepo = join(parentRepo, 'kb-labs-wildcard');
    await mkdir(nestedRepo, { recursive: true });

    const nestedGit = simpleGit(nestedRepo);
    await nestedGit.init();
    await nestedGit.addConfig('user.name', 'Test User');
    await nestedGit.addConfig('user.email', 'test@example.com');
    await writeFile(join(nestedRepo, 'test.ts'), 'test');

    // Scope with wildcards (wildcards are stripped during normalization)
    const status = await getGitStatus(parentRepo, { scope: '@kb-labs/wildcard/**/*' });

    // Should still detect nested repo and include files
    // Note: Current behavior may show directory or files depending on git status
    expect(status.untracked.length).toBeGreaterThan(0);
    expect(
      status.untracked.some(f => f.startsWith('kb-labs-wildcard/'))
    ).toBe(true);
  });
});
