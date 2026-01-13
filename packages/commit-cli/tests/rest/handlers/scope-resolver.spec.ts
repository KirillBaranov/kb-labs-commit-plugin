/**
 * Tests for scope-resolver.ts - Scope path resolution logic
 */

import { describe, it, expect } from 'vitest';
import { resolveScopePath } from '../../../src/rest/handlers/scope-resolver';
import { join } from 'node:path';

describe('resolveScopePath', () => {
  const baseCwd = '/Users/test/kb-labs';

  describe('root scope', () => {
    it('should resolve "root" to base directory', () => {
      const result = resolveScopePath(baseCwd, 'root');
      expect(result).toBe(baseCwd);
    });

    it('should resolve "." to base directory', () => {
      const result = resolveScopePath(baseCwd, '.');
      expect(result).toBe(baseCwd);
    });

    it('should use "root" as default when scope is undefined', () => {
      const result = resolveScopePath(baseCwd);
      expect(result).toBe(baseCwd);
    });
  });

  describe('scoped package names (@scope/package)', () => {
    it('should resolve @kb-labs/mind to kb-labs-mind', () => {
      const result = resolveScopePath(baseCwd, '@kb-labs/mind');
      expect(result).toBe(join(baseCwd, 'kb-labs-mind'));
    });

    it('should resolve @kb-labs/core to kb-labs-core', () => {
      const result = resolveScopePath(baseCwd, '@kb-labs/core');
      expect(result).toBe(join(baseCwd, 'kb-labs-core'));
    });

    it('should resolve @kb-labs/workflow to kb-labs-workflow', () => {
      const result = resolveScopePath(baseCwd, '@kb-labs/workflow');
      expect(result).toBe(join(baseCwd, 'kb-labs-workflow'));
    });
  });

  describe('self-referencing scoped packages (@scope/scope)', () => {
    it('should resolve @kb-labs/kb-labs to kb-labs (NOT kb-labs-kb-labs)', () => {
      const result = resolveScopePath(baseCwd, '@kb-labs/kb-labs');
      expect(result).toBe(join(baseCwd, 'kb-labs'));
    });

    it('should handle other self-referencing patterns', () => {
      const result = resolveScopePath('/test/foo', '@foo/foo');
      expect(result).toBe(join('/test/foo', 'foo'));
    });
  });

  describe('plain directory names (no scope)', () => {
    it('should resolve kb-labs-mind to kb-labs-mind', () => {
      const result = resolveScopePath(baseCwd, 'kb-labs-mind');
      expect(result).toBe(join(baseCwd, 'kb-labs-mind'));
    });

    it('should resolve kb-labs-core to kb-labs-core', () => {
      const result = resolveScopePath(baseCwd, 'kb-labs-core');
      expect(result).toBe(join(baseCwd, 'kb-labs-core'));
    });
  });

  describe('special characters and edge cases', () => {
    it('should remove wildcards from scope', () => {
      const result = resolveScopePath(baseCwd, 'kb-labs-*');
      expect(result).toBe(join(baseCwd, 'kb-labs-'));
    });

    it('should replace colons with dashes', () => {
      const result = resolveScopePath(baseCwd, 'kb-labs:test');
      expect(result).toBe(join(baseCwd, 'kb-labs-test'));
    });

    it('should handle multiple slashes in scoped name', () => {
      // Edge case: malformed scope with multiple slashes
      // @kb-labs/sub/path → kb-labs/sub/path (parts.length = 3, so it's treated as plain path)
      const result = resolveScopePath(baseCwd, '@kb-labs/sub/path');
      // Since parts.length !== 2, it falls through to plain name handling
      expect(result).toBe(join(baseCwd, 'kb-labs/sub/path'));
    });
  });

  describe('real-world monorepo examples', () => {
    it('should handle typical monorepo structure', () => {
      const examples = [
        { input: '@kb-labs/mind', expected: 'kb-labs-mind' },
        { input: '@kb-labs/core', expected: 'kb-labs-core' },
        { input: '@kb-labs/workflow', expected: 'kb-labs-workflow' },
        { input: '@kb-labs/plugin', expected: 'kb-labs-plugin' },
        { input: '@kb-labs/cli', expected: 'kb-labs-cli' },
        { input: '@kb-labs/kb-labs', expected: 'kb-labs' }, // Self-referencing
      ];

      examples.forEach(({ input, expected }) => {
        const result = resolveScopePath(baseCwd, input);
        expect(result).toBe(join(baseCwd, expected));
      });
    });

    it('should resolve paths correctly for nested directories', () => {
      const windowsPath = 'C:\\Users\\test\\kb-labs';
      const result = resolveScopePath(windowsPath, '@kb-labs/mind');
      expect(result).toBe(join(windowsPath, 'kb-labs-mind'));
    });
  });

  describe('expected path construction', () => {
    it('should construct valid filesystem paths', () => {
      const result = resolveScopePath(baseCwd, '@kb-labs/mind');

      // Should be absolute path
      expect(result.startsWith('/')).toBe(true);

      // Should end with the resolved directory name
      expect(result.endsWith('kb-labs-mind')).toBe(true);

      // Should contain base path
      expect(result.includes(baseCwd)).toBe(true);
    });

    it('should not create double directories for self-referencing scopes', () => {
      const result = resolveScopePath(baseCwd, '@kb-labs/kb-labs');

      // Should NOT be /Users/test/kb-labs/kb-labs-kb-labs
      expect(result).not.toContain('kb-labs-kb-labs');

      // Should be /Users/test/kb-labs/kb-labs
      expect(result).toBe(join(baseCwd, 'kb-labs'));
    });
  });
});
