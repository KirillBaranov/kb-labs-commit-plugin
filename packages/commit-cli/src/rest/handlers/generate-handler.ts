import { defineRestHandler, type RestHandlerContext } from '@kb-labs/sdk/rest';
import {
  GenerateRequestSchema,
  GenerateResponseSchema,
  type GenerateRequest,
  type GenerateResponse,
} from '@kb-labs/commit-contracts';
import { generateCommitPlan } from '@kb-labs/commit-core/generator';
import { savePlan } from '@kb-labs/commit-core/storage';
import * as path from 'node:path';

/**
 * POST /generate handler
 *
 * Generates a new commit plan for the workspace.
 * Uses LLM to analyze changes and group into conventional commits.
 */
export default defineRestHandler({
  name: 'commit:generate',
  input: GenerateRequestSchema,
  output: GenerateResponseSchema,

  async handler(request: GenerateRequest, ctx: RestHandlerContext): Promise<GenerateResponse> {
    const { workspace, scope, dryRun } = request;

    ctx.log('info', 'Generating commit plan', {
      requestId: ctx.requestId,
      workspace,
      scope,
      dryRun,
    });

    try {
      const cwd = getWorkspacePath(workspace);

      // Get LLM function from context if available
      const llmComplete = ctx.platform?.llm?.complete;

      // Generate plan
      const plan = await generateCommitPlan({
        cwd,
        scope,
        llmComplete,
        onProgress: (message) => {
          ctx.log('debug', 'Generation progress', { message });
        },
      });

      let planPath = '';

      // Save plan unless dry-run
      if (!dryRun) {
        planPath = await savePlan({ cwd, plan });

        ctx.log('info', 'Commit plan saved', {
          requestId: ctx.requestId,
          workspace,
          planPath,
          commits: plan.commits.length,
        });
      } else {
        ctx.log('info', 'Dry-run: plan not saved', {
          requestId: ctx.requestId,
          workspace,
          commits: plan.commits.length,
        });
      }

      return {
        plan,
        planPath,
        workspace,
      };
    } catch (error) {
      ctx.log('error', 'Failed to generate plan', {
        requestId: ctx.requestId,
        workspace,
        error: String(error),
      });

      throw new Error(`Failed to generate commit plan: ${error}`);
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
