/**
 * Workspace resolver - finds actual filesystem paths for package names
 */
import { glob } from 'glob';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

/**
 * Cache for workspace paths (cleared on each invocation)
 */
let workspaceCache: Map<string, string> | null = null;

/**
 * Resolve package name to filesystem path
 *
 * @example
 * resolveWorkspacePath('@kb-labs/sdk') → '/path/to/kb-labs/kb-labs-sdk'
 * resolveWorkspacePath('@kb-labs/workflow-constants') → '/path/to/kb-labs/kb-labs-workflow/packages/workflow-constants'
 */
export async function resolveWorkspacePath(packageName: string, cwd: string): Promise<string> {
  // Root workspace
  if (packageName === 'root' || packageName === '.') {
    return cwd;
  }

  // Build cache if not exists
  if (!workspaceCache) {
    workspaceCache = await buildWorkspaceCache(cwd);
  }

  // Lookup in cache
  const resolved = workspaceCache.get(packageName);
  if (resolved) {
    return resolved;
  }

  // Fallback to root if not found
  return cwd;
}

/**
 * Build workspace cache from package.json files
 */
async function buildWorkspaceCache(cwd: string): Promise<Map<string, string>> {
  const cache = new Map<string, string>();

  try {
    // Find all package.json files in monorepo
    // Pattern: */packages/*/package.json (nested monorepos)
    const packageFiles = await glob('*/packages/*/package.json', {
      cwd,
      absolute: true,
    });

    for (const pkgFile of packageFiles) {
      try {
        const pkgDir = path.dirname(pkgFile);
        const pkgContent = await fs.readFile(pkgFile, 'utf-8');
        const pkg = JSON.parse(pkgContent);

        if (pkg.name && typeof pkg.name === 'string') {
          cache.set(pkg.name, pkgDir);
        }
      } catch {
        // Skip invalid package.json
      }
    }

    // Also check top-level monorepo packages (e.g., kb-labs-sdk/package.json)
    const topLevelPackages = await glob('*/package.json', {
      cwd,
      absolute: true,
      ignore: ['node_modules/**'],
    });

    for (const pkgFile of topLevelPackages) {
      try {
        const pkgDir = path.dirname(pkgFile);
        const pkgContent = await fs.readFile(pkgFile, 'utf-8');
        const pkg = JSON.parse(pkgContent);

        if (pkg.name && typeof pkg.name === 'string') {
          cache.set(pkg.name, pkgDir);
        }
      } catch {
        // Skip invalid package.json
      }
    }
  } catch (error) {
    // Return empty cache on error
  }

  return cache;
}

/**
 * Clear workspace cache (call when workspaces change)
 */
export function clearWorkspaceCache(): void {
  workspaceCache = null;
}
