import { defineRestHandler, type RestHandlerContext } from '@kb-labs/sdk/rest';
import {
  GitStatusResponseSchema,
  type GitStatusResponse,
} from '@kb-labs/commit-contracts';
import { getGitStatus } from '@kb-labs/commit-core/analyzer';
import * as path from 'node:path';

/**
 * GET /git-status handler
 *
 * Returns git status with file summaries for the workspace.
 */
export default defineRestHandler({
  name: 'commit:git-status',
  output: GitStatusResponseSchema,

  async handler(request: { workspace?: string }, ctx: RestHandlerContext): Promise<GitStatusResponse> {
    const workspace = request.workspace || 'root';

    ctx.log('info', 'Getting git status', {
      requestId: ctx.requestId,
      workspace,
    });

    try {
      const cwd = getWorkspacePath(workspace);

      const { status, summaries } = await getGitStatus({ cwd });

      const totalFiles = status.staged.length + status.unstaged.length + status.untracked.length;

      ctx.log('info', 'Git status retrieved', {
        requestId: ctx.requestId,
        workspace,
        totalFiles,
      });

      return {
        workspace,
        status,
        summaries,
        totalFiles,
      };
    } catch (error) {
      ctx.log('error', 'Failed to get git status', {
        requestId: ctx.requestId,
        workspace,
        error: String(error),
      });

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
  return path.join(cwd, workspace.replace('@', '').replace('/', '-'));
}
