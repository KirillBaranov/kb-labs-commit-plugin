import { defineHandler, type PluginContextV3 } from '@kb-labs/sdk';
import {
  ApplyRequestSchema,
  ApplyResponseSchema,
  type ApplyRequest,
  type ApplyResponse,
} from '@kb-labs/commit-contracts';
import { applyCommitPlan } from '@kb-labs/commit-core/applier';
import { loadPlan } from '@kb-labs/commit-core/storage';
import { resolveScopePath } from './scope-resolver';

/**
 * POST /apply handler
 *
 * Applies the current commit plan by creating git commits.
 */
export default defineHandler({
  async execute(ctx: PluginContextV3, input: ApplyRequest): Promise<ApplyResponse> {
    const { scope = 'root', force } = input;

    try {
      // Resolve scope to actual directory path
      const scopeCwd = resolveScopePath(ctx.cwd, scope);

      // Load the plan first
      const plan = await loadPlan(ctx.cwd, scope);
      if (!plan) {
        throw new Error('No commit plan found. Generate a plan first with POST /generate');
      }

      // Apply commits (git runs FROM scopeCwd)
      const result = await applyCommitPlan(scopeCwd, plan, { force });

      return {
        result,
        scope,
      };
    } catch (error) {
      throw new Error(`Failed to apply commits: ${error}`);
    }
  },
});
