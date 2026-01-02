import * as path from 'node:path';

/**
 * Resolves scope to actual filesystem path
 *
 * @param baseCwd - Base directory (usually ctx.cwd from monorepo root)
 * @param scope - Scope identifier (e.g., 'kb-labs-mind', '@kb-labs/mind', 'root')
 * @returns Resolved absolute path to the scope directory
 *
 * Examples:
 * - resolveScopePath('/kb-labs', 'root') → '/kb-labs'
 * - resolveScopePath('/kb-labs', 'kb-labs-mind') → '/kb-labs/kb-labs-mind'
 * - resolveScopePath('/kb-labs', '@kb-labs/mind') → '/kb-labs/kb-labs-mind'
 */
export function resolveScopePath(baseCwd: string, scope: string = 'root'): string {
  // Root scope = base directory
  if (scope === 'root' || scope === '.') {
    return baseCwd;
  }

  // Normalize scope to directory name
  // '@kb-labs/mind' → 'kb-labs-mind'
  // 'kb-labs-mind' → 'kb-labs-mind'
  const normalized = scope
    .replace(/^@/, '')           // Remove leading @
    .replace(/\//g, '-')         // Replace / with -
    .replace(/\*/g, '')          // Remove wildcards
    .replace(/:/g, '-');         // Replace : with -

  return path.join(baseCwd, normalized);
}
