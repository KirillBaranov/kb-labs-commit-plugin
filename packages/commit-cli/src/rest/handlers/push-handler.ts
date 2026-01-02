import { defineHandler, type PluginContextV3 } from '@kb-labs/sdk';
import {
  PushRequestSchema,
  PushResponseSchema,
  type PushRequest,
  type PushResponse,
} from '@kb-labs/commit-contracts';
import { pushCommits } from '@kb-labs/commit-core/applier';
import { resolveScopePath } from './scope-resolver';

/**
 * POST /push handler
 *
 * Pushes commits to the remote repository.
 */
export default defineHandler({
  async execute(ctx: PluginContextV3, input: PushRequest): Promise<PushResponse> {
    const { scope = 'root', remote, force } = input;

    try {
      // Resolve scope to actual directory path
      const scopeCwd = resolveScopePath(ctx.cwd, scope);

      // Push commits (git runs FROM scopeCwd)
      const result = await pushCommits(scopeCwd, { remote, force });

      return {
        result,
        scope,
      };
    } catch (error) {
      throw new Error(`Failed to push commits: ${error}`);
    }
  },
});
