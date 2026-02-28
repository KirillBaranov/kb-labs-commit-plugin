import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { existsSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
}));

import { resolveScopePath } from '../../../src/rest/handlers/scope-resolver';

describe('resolveScopePath', () => {
  const baseCwd = '/Users/test/kb-labs';

  afterEach(() => {
    existsSyncMock.mockReset();
  });

  it('returns base directory for root-like scopes', () => {
    expect(resolveScopePath(baseCwd, 'root')).toBe(baseCwd);
    expect(resolveScopePath(baseCwd, '.')).toBe(baseCwd);
    expect(resolveScopePath(baseCwd)).toBe(baseCwd);
  });

  it('joins scope path directly and validates existence', () => {
    existsSyncMock.mockReturnValue(true);

    const scope = 'kb-labs-mind/packages/mind-cli';
    const resolved = resolveScopePath(baseCwd, scope);

    expect(resolved).toBe(join(baseCwd, scope));
    expect(existsSyncMock).toHaveBeenCalledWith(join(baseCwd, scope));
  });

  it('throws when resolved scope directory does not exist', () => {
    existsSyncMock.mockReturnValue(false);

    expect(() => resolveScopePath(baseCwd, '@kb-labs/mind')).toThrow(
      `Scope directory not found: ${join(baseCwd, '@kb-labs/mind')} (scope: "@kb-labs/mind")`,
    );
  });
});
