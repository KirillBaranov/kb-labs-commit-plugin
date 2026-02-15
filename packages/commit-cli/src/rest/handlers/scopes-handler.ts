import { defineHandler, type SelectData, type SelectOptionItem, type PluginContextV3 } from '@kb-labs/sdk';
import { glob } from 'glob';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

/**
 * GET /scopes handler
 *
 * Universal .git detection: scans for .git directories recursively (depth 2)
 * to find all git repositories in the workspace.
 *
 * Uses **folder name** as scope ID (not package.json name) to avoid
 * the mismatch bug where package name differs from folder name.
 *
 * Returns SelectData format for Studio select widget.
 */
export default defineHandler({
  async execute(ctx: PluginContextV3, _input: unknown): Promise<SelectData> {
    const repoRoot = ctx.cwd;
    const options: SelectOptionItem[] = [];

    try {
      // Find all .git directories up to depth 2 (covers nested repos)
      const gitDirs = await glob('*/.git', {
        cwd: repoRoot,
        ignore: ['node_modules/**', '.git'],
      });

      // Also check depth 2 for deeper nested repos
      const gitDirsDeep = await glob('*/*/.git', {
        cwd: repoRoot,
        ignore: ['node_modules/**', '**/node_modules/**'],
      });

      const allGitDirs = [...gitDirs, ...gitDirsDeep];

      for (const gitDir of allGitDirs) {
        try {
          // .git dir parent is the repo folder
          const repoRelPath = path.dirname(gitDir);
          const repoAbsPath = path.join(repoRoot, repoRelPath);

          // Use folder path relative to workspace root as scope ID
          const scopeId = repoRelPath;
          const dirName = path.basename(repoAbsPath);

          // Try to read package.json for metadata (optional)
          let pkgName: string | undefined;
          let description: string | undefined;
          try {
            const pkgContent = await fs.readFile(path.join(repoAbsPath, 'package.json'), 'utf-8');
            const pkg = JSON.parse(pkgContent);
            pkgName = pkg.name;
            description = pkg.description;
          } catch {
            // No package.json — that's fine, just use folder name
          }

          // Label: folder name, description includes package name if different
          const label = dirName;
          const desc = pkgName && pkgName !== dirName
            ? `${description || ''} (${pkgName})`.trim()
            : description;

          options.push({
            value: scopeId,
            label,
            description: desc || undefined,
          });
        } catch {
          // Skip inaccessible directories
        }
      }

      // Sort alphabetically
      options.sort((a, b) => a.label.localeCompare(b.label));

      // Deduplicate by value
      const uniqueOptions = Array.from(
        new Map(options.map(opt => [opt.value, opt])).values()
      );

      // Always add root scope if workspace root has .git
      const rootHasGit = await checkHasDirectGit(repoRoot);
      if (rootHasGit) {
        uniqueOptions.unshift({
          value: 'root',
          label: 'root (workspace)',
          description: 'Root workspace',
        });
      }

      // If nothing found at all, add root as fallback
      if (uniqueOptions.length === 0) {
        uniqueOptions.push({
          value: 'root',
          label: 'root',
          description: 'Root scope',
        });
      }

      return {
        value: uniqueOptions[0]?.value || 'root',
        options: uniqueOptions,
      };
    } catch (error) {
      return {
        value: 'root',
        options: [{ value: 'root', label: 'root', description: 'Root scope' }],
        error: String(error),
      };
    }
  },
});

/**
 * Check if .git directory exists DIRECTLY in the given directory
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
