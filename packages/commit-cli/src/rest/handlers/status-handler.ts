import { defineRestHandler, type RestHandlerContext } from '@kb-labs/sdk/rest';
import {
  StatusResponseSchema,
  type StatusResponse,
} from '@kb-labs/commit-contracts';
import { loadPlan } from '@kb-labs/commit-core/storage';
import { getGitStatus } from '@kb-labs/commit-core/analyzer';
import * as path from 'node:path';

/**
 * GET /status handler
 *
 * Returns current status for a workspace:
 * - Whether a plan exists
 * - Git status summary
 * - Files and commits count
 */
export default defineRestHandler({
  name: 'commit:status',
  output: StatusResponseSchema,

  async handler(request: { workspace?: string }, ctx: RestHandlerContext): Promise<StatusResponse> {
    const workspace = request.workspace || 'root';

    ctx.log('info', 'Getting commit status', {
      requestId: ctx.requestId,
      workspace,
    });

    try {
      const cwd = getWorkspacePath(workspace);

      // Load current plan
      const plan = await loadPlan({ cwd });

      // Get git status
      let gitStatus;
      let filesChanged = 0;

      try {
        gitStatus = await getGitStatus({ cwd });
        filesChanged =
          gitStatus.status.staged.length +
          gitStatus.status.unstaged.length +
          gitStatus.status.untracked.length;
      } catch (err) {
        ctx.log('warn', 'Failed to get git status', { error: String(err) });
      }

      return {
        workspace,
        hasPlan: !!plan,
        planTimestamp: plan?.createdAt,
        gitStatus: gitStatus?.status,
        filesChanged,
        commitsInPlan: plan?.commits.length || 0,
      };
    } catch (error) {
      ctx.log('error', 'Failed to get status', {
        requestId: ctx.requestId,
        workspace,
        error: String(error),
      });

      return {
        workspace,
        hasPlan: false,
        filesChanged: 0,
        commitsInPlan: 0,
      };
    }
  },
});

/**
 * Convert workspace ID to filesystem path
 */
function getWorkspacePath(workspace: string): string {
  const cwd = process.cwd();

  if (workspace === 'root' || workspace === '.') {
    return cwd;
  }

  // For scoped packages, convert @scope/name to path
  // Assume workspace follows pattern: packages/<name> or .<workspace-name>
  return path.join(cwd, workspace.replace('@', '').replace('/', '-'));
}
