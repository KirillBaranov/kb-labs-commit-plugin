import { defineRestHandler, type RestHandlerContext } from '@kb-labs/sdk/rest';
import {
  ApplyRequestSchema,
  ApplyResponseSchema,
  type ApplyRequest,
  type ApplyResponse,
} from '@kb-labs/commit-contracts';
import { applyCommits } from '@kb-labs/commit-core/applier';
import * as path from 'node:path';

/**
 * POST /apply handler
 *
 * Applies the current commit plan by creating git commits.
 */
export default defineRestHandler({
  name: 'commit:apply',
  input: ApplyRequestSchema,
  output: ApplyResponseSchema,

  async handler(request: ApplyRequest, ctx: RestHandlerContext): Promise<ApplyResponse> {
    const { workspace, force } = request;

    ctx.log('info', 'Applying commit plan', {
      requestId: ctx.requestId,
      workspace,
      force,
    });

    try {
      const cwd = getWorkspacePath(workspace);

      const result = await applyCommits({ cwd, force });

      ctx.log('info', 'Commits applied', {
        requestId: ctx.requestId,
        workspace,
        success: result.success,
        commits: result.appliedCommits.length,
      });

      return {
        result,
        workspace,
      };
    } catch (error) {
      ctx.log('error', 'Failed to apply commits', {
        requestId: ctx.requestId,
        workspace,
        error: String(error),
      });

      throw new Error(`Failed to apply commits: ${error}`);
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
