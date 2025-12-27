import { defineRestHandler, type RestHandlerContext } from '@kb-labs/sdk/rest';
import {
  ResetResponseSchema,
  type ResetResponse,
} from '@kb-labs/commit-contracts';
import { deletePlan } from '@kb-labs/commit-core/storage';
import * as path from 'node:path';

/**
 * DELETE /plan handler
 *
 * Deletes the current commit plan.
 */
export default defineRestHandler({
  name: 'commit:reset',
  output: ResetResponseSchema,

  async handler(request: { workspace?: string }, ctx: RestHandlerContext): Promise<ResetResponse> {
    const workspace = request.workspace || 'root';

    ctx.log('info', 'Resetting commit plan', {
      requestId: ctx.requestId,
      workspace,
    });

    try {
      const cwd = getWorkspacePath(workspace);

      await deletePlan({ cwd });

      ctx.log('info', 'Plan deleted', {
        requestId: ctx.requestId,
        workspace,
      });

      return {
        success: true,
        message: 'Commit plan deleted successfully',
        workspace,
      };
    } catch (error) {
      ctx.log('error', 'Failed to delete plan', {
        requestId: ctx.requestId,
        workspace,
        error: String(error),
      });

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
  return path.join(cwd, workspace.replace('@', '').replace('/', '-'));
}
