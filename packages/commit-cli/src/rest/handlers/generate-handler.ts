import { defineHandler, type PluginContextV3 } from '@kb-labs/sdk';
import {
  GenerateRequestSchema,
  GenerateResponseSchema,
  type GenerateRequest,
  type GenerateResponse,
} from '@kb-labs/commit-contracts';
import { generateCommitPlan } from '@kb-labs/commit-core/generator';
import { savePlan, getCurrentPlanPath } from '@kb-labs/commit-core/storage';
import { resolveScopePath } from './scope-resolver';

/**
 * POST /generate handler
 *
 * Generates a new commit plan for the given scope.
 * Uses LLM to analyze changes and group into conventional commits.
 */
export default defineHandler({
  async execute(ctx: PluginContextV3, input: GenerateRequest): Promise<GenerateResponse> {
    const { scope = 'root', dryRun } = input;

    try {
      // Get LLM function from platform hook
      const llmComplete = ctx.platform?.llm?.complete;

      // Generate plan with scope - generator will resolve it internally
      const plan = await generateCommitPlan({
        cwd: ctx.cwd,
        scope: scope === 'root' ? undefined : scope,
        llmComplete,
        onProgress: (message) => {
        },
      });

      let planPath = '';

      // Save plan unless dry-run
      if (!dryRun) {
        await savePlan(ctx.cwd, plan, scope);
        planPath = getCurrentPlanPath(ctx.cwd, scope);
      }

      return {
        plan,
        planPath,
        scope,
      };
    } catch (error) {
      throw new Error(`Failed to generate commit plan: ${error}`);
    }
  },
});
