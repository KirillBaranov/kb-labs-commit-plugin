import { defineRestHandler, type RestHandlerContext } from '@kb-labs/sdk/rest';
import {
  PlanResponseSchema,
  type PlanResponse,
} from '@kb-labs/commit-contracts';
import { loadPlan } from '@kb-labs/commit-core/storage';
import * as path from 'node:path';

/**
 * GET /plan handler
 *
 * Returns the current commit plan for the workspace, if one exists.
 */
export default defineRestHandler({
  name: 'commit:plan',
  output: PlanResponseSchema,

  async handler(request: { workspace?: string }, ctx: RestHandlerContext): Promise<PlanResponse> {
    const workspace = request.workspace || 'root';

    ctx.log('info', 'Getting commit plan', {
      requestId: ctx.requestId,
      workspace,
    });

    try {
      const cwd = getWorkspacePath(workspace);
      const plan = await loadPlan({ cwd });

      if (plan) {
        ctx.log('info', 'Plan found', {
          requestId: ctx.requestId,
          workspace,
          commits: plan.commits.length,
        });

        return {
          hasPlan: true,
          plan,
          workspace,
        };
      } else {
        ctx.log('info', 'No plan found', {
          requestId: ctx.requestId,
          workspace,
        });

        return {
          hasPlan: false,
          workspace,
        };
      }
    } catch (error) {
      ctx.log('error', 'Failed to load plan', {
        requestId: ctx.requestId,
        workspace,
        error: String(error),
      });

      return {
        hasPlan: false,
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

  if (workspace === 'root' || workspace === '.') {
    return cwd;
  }

  return path.join(cwd, workspace.replace('@', '').replace('/', '-'));
}
