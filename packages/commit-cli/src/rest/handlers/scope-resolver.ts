import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Resolves scope to actual filesystem path.
 *
 * Scope IDs are relative folder paths from workspace root (returned by scopes-handler).
 * This is a direct path join — no name-to-folder guessing.
 *
 * @param baseCwd - Base directory (workspace root)
 * @param scope - Scope identifier: folder path like 'kb-labs-mind' or 'root'
 * @returns Resolved absolute path to the scope directory
 *
 * Examples:
 * - resolveScopePath('/kb-labs', 'root') → '/kb-labs'
 * - resolveScopePath('/kb-labs', 'kb-labs-mind') → '/kb-labs/kb-labs-mind'
 * - resolveScopePath('/kb-labs', 'nested/repo') → '/kb-labs/nested/repo'
 */
export function resolveScopePath(baseCwd: string, scope: string = 'root'): string {
  if (scope === 'root' || scope === '.') {
    return baseCwd;
  }

  const resolved = path.join(baseCwd, scope);

  // Validate the path exists
  if (!fs.existsSync(resolved)) {
    throw new Error(`Scope directory not found: ${resolved} (scope: "${scope}")`);
  }

  return resolved;
}
