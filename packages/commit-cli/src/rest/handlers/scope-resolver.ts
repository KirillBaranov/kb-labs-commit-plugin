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

  // Remove @ prefix first
  let normalized = scope.replace(/^@/, '');

  // Extract scope and package name
  // '@kb-labs/kb-labs' → scope='kb-labs', pkg='kb-labs'
  // '@kb-labs/mind' → scope='kb-labs', pkg='mind'
  const parts = normalized.split('/');

  if (parts.length === 2) {
    const [scopeName, pkgName] = parts;
    // If scope === package (e.g., @kb-labs/kb-labs), use just the scope name
    if (scopeName === pkgName && scopeName) {
      normalized = scopeName;
    } else if (scopeName && pkgName) {
      // Otherwise combine: kb-labs-mind
      normalized = `${scopeName}-${pkgName}`;
    }
  } else {
    // Plain name without scope, just clean it up
    normalized = normalized
      .replace(/\*/g, '')          // Remove wildcards
      .replace(/:/g, '-');         // Replace : with -
  }

  return path.join(baseCwd, normalized);
}
