import { defineRestHandler, type RestHandlerContext } from '@kb-labs/sdk/rest';
import {
  WorkspacesResponseSchema,
  type WorkspacesResponse,
} from '@kb-labs/commit-contracts';
import { glob } from 'glob';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

/**
 * GET /workspaces handler
 *
 * Discovers all workspaces (git repositories) in the current directory.
 * For monorepos, finds all packages with their own .git or package.json.
 */
export default defineRestHandler({
  name: 'commit:workspaces',
  output: WorkspacesResponseSchema,

  async handler(_request: unknown, ctx: RestHandlerContext): Promise<WorkspacesResponse> {
    ctx.log('info', 'Discovering workspaces', { requestId: ctx.requestId });

    const cwd = process.cwd();
    const workspaces: WorkspacesResponse['workspaces'] = [];

    try {
      // Strategy 1: Find all directories with package.json (monorepo packages)
      const packageFiles = await glob('**/package.json', {
        cwd,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        absolute: true,
      });

      for (const pkgFile of packageFiles) {
        try {
          const pkgDir = path.dirname(pkgFile);
          const pkgContent = await fs.readFile(pkgFile, 'utf-8');
          const pkg = JSON.parse(pkgContent);

          // Check if this directory has git (either its own .git or parent repo)
          const hasGit = await checkGitRepo(pkgDir);

          if (hasGit && pkg.name) {
            workspaces.push({
              id: pkg.name,
              name: pkg.name,
              path: path.relative(cwd, pkgDir) || '.',
              description: pkg.description,
            });
          }
        } catch (err) {
          // Skip invalid package.json
          ctx.log('warn', 'Failed to parse package.json', { file: pkgFile, error: String(err) });
        }
      }

      // If no workspaces found, add root workspace
      if (workspaces.length === 0) {
        const rootPkgPath = path.join(cwd, 'package.json');
        try {
          const rootPkgContent = await fs.readFile(rootPkgPath, 'utf-8');
          const rootPkg = JSON.parse(rootPkgContent);

          workspaces.push({
            id: rootPkg.name || 'root',
            name: rootPkg.name || 'Root',
            path: '.',
            description: rootPkg.description,
          });
        } catch {
          // No package.json, use generic root
          workspaces.push({
            id: 'root',
            name: 'Root',
            path: '.',
            description: 'Root workspace',
          });
        }
      }

      ctx.log('info', 'Workspaces discovered', {
        requestId: ctx.requestId,
        count: workspaces.length
      });

      return { workspaces };
    } catch (error) {
      ctx.log('error', 'Failed to discover workspaces', {
        requestId: ctx.requestId,
        error: String(error)
      });

      // Return empty on error
      return { workspaces: [] };
    }
  },
});

/**
 * Check if directory is in a git repository
 */
async function checkGitRepo(dir: string): Promise<boolean> {
  let current = dir;

  // Walk up directory tree looking for .git
  while (current !== path.dirname(current)) {
    try {
      const gitPath = path.join(current, '.git');
      await fs.access(gitPath);
      return true;
    } catch {
      current = path.dirname(current);
    }
  }

  return false;
}
