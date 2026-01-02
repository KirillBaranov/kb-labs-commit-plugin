import { defineHandler, type PluginContextV3, type RestInput, useLogger } from '@kb-labs/sdk';
import { FileDiffResponseSchema, type FileDiffResponse } from '@kb-labs/commit-contracts';
import { getFileDiff, resolveScope } from '@kb-labs/commit-core/analyzer';
import * as path from 'node:path';

/**
 * GET /diff handler
 *
 * Returns the diff for a specific file in the workspace.
 */
export default defineHandler({
  async execute(ctx: PluginContextV3, input: RestInput<{ workspace?: string; file?: string }>): Promise<FileDiffResponse> {
    const logger = useLogger();
    const workspace = input.query?.workspace || 'root';
    const file = input.query?.file;

    logger.info('[diff-handler] Request received', { workspace, file });

    if (!file) {
      throw new Error('File path is required');
    }

    try {
      // Resolve scope for the workspace
      let cwd = ctx.cwd;
      let relativeFile = file;
      logger.info('[diff-handler] Starting with ctx.cwd', { cwd });

      if (workspace && workspace !== 'root' && workspace !== '.') {
        const resolvedScope = await resolveScope(ctx.cwd, workspace);
        logger.info('[diff-handler] Resolved scope', {
          workspace,
          packagePaths: resolvedScope.packagePaths,
          packageCount: resolvedScope.packagePaths.length
        });

        // Use the first package path if resolved to a single package
        const packagePath = resolvedScope.packagePaths[0];
        if (packagePath) {
          cwd = path.join(ctx.cwd, packagePath);
          logger.info('[diff-handler] Using package path as cwd', { cwd });

          // Strip workspace prefix from file path
          if (file.startsWith(packagePath + '/')) {
            relativeFile = file.substring(packagePath.length + 1);
            logger.info('[diff-handler] Stripped workspace prefix from file', { original: file, relative: relativeFile });
          }
        }
      }

      logger.info('[diff-handler] Calling getFileDiff', { cwd, file: relativeFile });
      const result = await getFileDiff(cwd, relativeFile);

      return {
        workspace,
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
