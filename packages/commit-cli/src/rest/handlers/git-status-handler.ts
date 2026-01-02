import { defineHandler, type PluginContextV3, type TableData, type TableRow, type RestInput } from '@kb-labs/sdk';
import { getGitStatus, resolveScope } from '@kb-labs/commit-core/analyzer';

/**
 * GET /git-status handler
 *
 * Returns git status as table data for Studio table widget.
 */
export default defineHandler({
  async execute(ctx: PluginContextV3, input: RestInput<{ workspace?: string }>): Promise<TableData> {
    const workspace = input.query?.workspace || 'root';

    try {
      // Resolve scope for the workspace
      let scopePathForGit: string | undefined;
      if (workspace && workspace !== 'root' && workspace !== '.') {
        const resolvedScope = await resolveScope(ctx.cwd, workspace);
        if (resolvedScope.packagePaths.length === 1) {
          scopePathForGit = resolvedScope.packagePaths[0];
        } else {
          scopePathForGit = workspace;
        }
      }

      // Get git status with scope
      const status = await getGitStatus(ctx.cwd, { scope: scopePathForGit });

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
