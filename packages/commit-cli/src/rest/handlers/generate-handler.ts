import { defineHandler, type PluginContextV3, type RestInput } from '@kb-labs/sdk';
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
  async execute(ctx: PluginContextV3, input: RestInput<unknown, GenerateRequest>): Promise<GenerateResponse> {
    const { scope = 'root', dryRun } = input.body ?? {};
    const startTime = Date.now();

    try {
      // Generate plan with scope - generator will resolve it internally
      // LLM access is handled via useLLM() hook inside generateCommitPlan
      const plan = await generateCommitPlan({
        cwd: ctx.cwd,
        scope: scope === 'root' ? undefined : scope,
        onProgress: (message) => {
        },
      });

      let planPath = '';

      // Save plan unless dry-run
      if (!dryRun) {
        await savePlan(ctx.cwd, plan, scope);
        planPath = getCurrentPlanPath(ctx.cwd, scope);
      }

      // Track success
      if (ctx.platform.analytics) {
        await ctx.platform.analytics.track('commit.plan.generated', {
          scope,
          dryRun,
          filesChanged: plan.metadata.totalFiles,
          commitsGenerated: plan.metadata.totalCommits,
          llmUsed: plan.metadata.llmUsed,
          tokensUsed: plan.metadata.tokensUsed,
          escalated: plan.metadata.escalated,
          durationMs: Date.now() - startTime,
        });
      }

      return {
        plan,
        planPath,
        scope,
      };
    } catch (error) {
      // Track error
      if (ctx.platform.analytics) {
        await ctx.platform.analytics.track('commit.plan.error', {
          scope,
          dryRun,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        });
      }

      throw new Error(`Failed to generate commit plan: ${error}`);
    }
  },
});
