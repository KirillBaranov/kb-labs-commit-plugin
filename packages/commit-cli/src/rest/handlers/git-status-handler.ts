import { defineHandler, type PluginContextV3, type TableData, type TableRow, type RestInput } from '@kb-labs/sdk';
import { getGitStatus } from '@kb-labs/commit-core/analyzer';
import { resolveScopePath } from './scope-resolver';

/**
 * GET /git-status handler
 *
 * Returns git status as table data for Studio table widget.
 */
export default defineHandler({
  async execute(ctx: PluginContextV3, input: RestInput<{ scope?: string }>): Promise<TableData> {
    const scope = input.query?.scope || 'root';

    try {
      // Resolve scope to actual directory path
      const scopeCwd = resolveScopePath(ctx.cwd, scope);

      // Get git status (git runs FROM scopeCwd, no filtering)
      const status = await getGitStatus(scopeCwd);

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
