import { defineHandler, type SelectData, type SelectOptionItem, type PluginContextV3 } from '@kb-labs/sdk';
import { glob } from 'glob';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

/**
 * GET /scopes handler
 *
 * Fast discovery: finds all directories with package.json AND .git in the same directory.
 * Only shows root-level git repositories, not nested packages.
 * Git status analysis happens later when specific scope is selected.
 *
 * Returns SelectData format for Studio select widget.
 */
export default defineHandler({
  async execute(ctx: PluginContextV3, _input: unknown): Promise<SelectData> {
    const repoRoot = ctx.cwd;
    const options: SelectOptionItem[] = [];

    try {
      // Find all top-level directories with package.json
      const topLevelPackages = await glob('*/package.json', {
        cwd: repoRoot,
        absolute: true,
        ignore: ['node_modules/**'],
      });

      for (const pkgFile of topLevelPackages) {
        try {
          const pkgDir = path.dirname(pkgFile);
          const pkgContent = await fs.readFile(pkgFile, 'utf-8');
          const pkg = JSON.parse(pkgContent);

          // Check if .git exists DIRECTLY in this directory (not walking up!)
          const hasGit = await checkHasDirectGit(pkgDir);

          if (hasGit) {
            // Use package name if available, otherwise use directory name
            const dirName = path.basename(pkgDir);
            options.push({
              value: pkg.name || dirName,
              label: pkg.name || dirName,
              description: pkg.description,
            });
          }
        } catch {
          // Skip invalid package.json
        }
      }

      // Deduplicate by value (prevents virtual scroll bugs)
      const uniqueOptions = Array.from(
        new Map(options.map(opt => [opt.value, opt])).values()
      );

      // If no scopes found, add root scope
      if (uniqueOptions.length === 0) {
        const rootPkgPath = path.join(repoRoot, 'package.json');
        try {
          const rootPkgContent = await fs.readFile(rootPkgPath, 'utf-8');
          const rootPkg = JSON.parse(rootPkgContent);

          uniqueOptions.push({
            value: rootPkg.name || 'root',
            label: rootPkg.name || 'Root',
            description: rootPkg.description || 'Root scope',
          });
        } catch {
          // No package.json, use generic root
          uniqueOptions.push({
            value: 'root',
            label: 'Root',
            description: 'Root scope',
          });
        }
      }

      return {
        value: uniqueOptions[0]?.value || 'root', // Default to first option
        options: uniqueOptions,
      };
    } catch (error) {
      // Return error state
      return {
        value: 'root',
        options: [{ value: 'root', label: 'Root', description: 'Root scope' }],
        error: String(error),
      };
    }
  },
});

/**
 * Check if .git directory exists DIRECTLY in the given directory
 * Does NOT walk up the tree - only checks the exact directory
 */
async function checkHasDirectGit(dir: string): Promise<boolean> {
  try {
    const gitPath = path.join(dir, '.git');
    await fs.access(gitPath);
    return true;
  } catch {
    return false;
  }
}
