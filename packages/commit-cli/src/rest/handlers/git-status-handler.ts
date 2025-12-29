import { defineHandler, type TableData, type TableRow } from '@kb-labs/sdk';
import { getGitStatus } from '@kb-labs/commit-core/analyzer';
import * as path from 'node:path';

/**
 * GET /git-status handler
 *
 * Returns git status as table data for Studio table widget.
 */
export default defineHandler({
  async execute(ctx, input: { workspace?: string }): Promise<TableData> {
    const workspace = input.workspace || 'root';

    try {
      const cwd = getWorkspacePath(workspace);

      const status = await getGitStatus(cwd);

      // Convert git status to table rows
      const rows: TableRow[] = [];

      // Add staged files
      for (const filePath of status.staged) {
        rows.push({
          path: filePath,
          status: 'staged',
        });
      }

      // Add unstaged files
      for (const filePath of status.unstaged) {
        rows.push({
          path: filePath,
          status: 'modified',
        });
      }

      // Add untracked files
      for (const filePath of status.untracked) {
        rows.push({
          path: filePath,
          status: 'untracked',
        });
      }

      return {
        rows,
        total: rows.length,
      };
    } catch (error) {
      throw new Error(`Failed to get git status: ${error}`);
    }
  },
});

/**
 * Convert workspace ID to filesystem path
 */
function getWorkspacePath(workspace: string): string {
  const cwd = process.cwd();
  if (workspace === 'root' || workspace === '.') return cwd;
  return path.join(cwd, workspace.replace('@', '').replace(/\//g, '-'));
}
