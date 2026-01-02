import { defineHandler, type PluginContextV3 } from '@kb-labs/sdk';
import {
  ResetResponseSchema,
  type ResetResponse,
} from '@kb-labs/commit-contracts';
import { clearPlan } from '@kb-labs/commit-core/storage';
import * as path from 'node:path';

/**
 * DELETE /plan handler
 *
 * Deletes the current commit plan.
 */
export default defineHandler({
  async execute(_ctx: PluginContextV3, input: { workspace?: string }): Promise<ResetResponse> {
    const workspace = input.workspace || 'root';

    try {
      const cwd = getWorkspacePath(workspace);

      await clearPlan(cwd);

      return {
        success: true,
        message: 'Commit plan deleted successfully',
        workspace,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete plan: ${error}`,
        workspace,
      };
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
