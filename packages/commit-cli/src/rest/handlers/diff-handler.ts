import { defineHandler, type PluginContextV3, type RestInput, useLogger } from '@kb-labs/sdk';
import { FileDiffResponseSchema, type FileDiffResponse } from '@kb-labs/commit-contracts';
import { getFileDiff } from '@kb-labs/commit-core/analyzer';
import { resolveScopePath } from './scope-resolver';

/**
 * GET /diff handler
 *
 * Returns the diff for a specific file in the scope.
 */
export default defineHandler({
  async execute(ctx: PluginContextV3, input: RestInput<{ scope?: string; file?: string }>): Promise<FileDiffResponse> {
    const logger = useLogger();
    const scope = input.query?.scope || 'root';
    const file = input.query?.file;

    logger.info('[diff-handler] Request received', { scope, file });

    if (!file) {
      throw new Error('File path is required');
    }

    try {
      // Resolve scope to actual directory path
      const scopeCwd = resolveScopePath(ctx.cwd, scope);
      logger.info('[diff-handler] Resolved scope', { scope, scopeCwd });

      // Get file diff (git runs FROM scopeCwd)
      logger.info('[diff-handler] Calling getFileDiff', { cwd: scopeCwd, file });
      const result = await getFileDiff(scopeCwd, file);

      return {
        scope,
        file,
        diff: result.diff,
        additions: result.additions,
        deletions: result.deletions,
      };
    } catch (error) {
      throw new Error(`Failed to get diff for file: ${error}`);
    }
  },
});
