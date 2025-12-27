import { defineRestHandler, type RestHandlerContext } from '@kb-labs/sdk/rest';
import {
  PushRequestSchema,
  PushResponseSchema,
  type PushRequest,
  type PushResponse,
} from '@kb-labs/commit-contracts';
import { pushCommits } from '@kb-labs/commit-core/applier';
import * as path from 'node:path';

/**
 * POST /push handler
 *
 * Pushes commits to the remote repository.
 */
export default defineRestHandler({
  name: 'commit:push',
  input: PushRequestSchema,
  output: PushResponseSchema,

  async handler(request: PushRequest, ctx: RestHandlerContext): Promise<PushResponse> {
    const { workspace, remote, force } = request;

    ctx.log('info', 'Pushing commits', {
      requestId: ctx.requestId,
      workspace,
      remote,
      force,
    });

    try {
      const cwd = getWorkspacePath(workspace);

      const result = await pushCommits({ cwd, remote, force });

      ctx.log('info', 'Commits pushed', {
        requestId: ctx.requestId,
        workspace,
        success: result.success,
        commits: result.commitsPushed,
      });

      return {
        result,
        workspace,
      };
    } catch (error) {
      ctx.log('error', 'Failed to push commits', {
        requestId: ctx.requestId,
        workspace,
        error: String(error),
      });

      throw new Error(`Failed to push commits: ${error}`);
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
