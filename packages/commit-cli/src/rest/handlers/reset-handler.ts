import { defineHandler, type PluginContextV3, type RestInput } from '@kb-labs/sdk';
import {
  type ResetResponse,
} from '@kb-labs/commit-contracts';
import { clearPlan } from '@kb-labs/commit-core/storage';

/**
 * DELETE /plan handler
 *
 * Deletes the current commit plan.
 */
export default defineHandler({
  async execute(ctx: PluginContextV3, input: RestInput<{ scope?: string }, unknown>): Promise<ResetResponse> {
    const scope = input.query?.scope || 'root';

    try {
      await clearPlan(ctx.cwd, scope);

      return {
        success: true,
        message: 'Commit plan deleted successfully',
        scope,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete plan: ${error}`,
        scope,
      };
    }
  },
});
