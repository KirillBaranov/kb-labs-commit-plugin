import { defineHandler } from '@kb-labs/sdk';
import {
  GenerateRequestSchema,
  GenerateResponseSchema,
  type GenerateRequest,
  type GenerateResponse,
} from '@kb-labs/commit-contracts';
import { generateCommitPlan } from '@kb-labs/commit-core/generator';
import { savePlan, getCurrentPlanPath } from '@kb-labs/commit-core/storage';
import * as path from 'node:path';

/**
 * POST /generate handler
 *
 * Generates a new commit plan for the workspace.
 * Uses LLM to analyze changes and group into conventional commits.
 */
export default defineHandler({
  async execute(ctx, input: GenerateRequest): Promise<GenerateResponse> {
    const { workspace, scope, dryRun } = input;

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
        },
      });

      let planPath = '';

      // Save plan unless dry-run
      if (!dryRun) {
        await savePlan(cwd, plan);
        planPath = getCurrentPlanPath(cwd);
      }

      return {
        plan,
        planPath,
        workspace,
      };
    } catch (error) {
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

  return path.join(cwd, workspace.replace('@', '').replace(/\//g, '-'));
}
