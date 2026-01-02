import { defineHandler, type RestInput, type PluginContextV3 } from '@kb-labs/sdk';
import { loadPlan } from '@kb-labs/commit-core/storage';
import { getGitStatus } from '@kb-labs/commit-core/analyzer';
import { resolveScopePath } from './scope-resolver';
import type { StatusResponse } from '@kb-labs/commit-contracts';

const STATUS_CACHE_TTL = 5000; // 5 seconds

/**
 * GET /status handler
 *
 * Returns current status for a scope according to StatusResponse contract.
 * Uses ctx.platform.cache for git status caching.
 */
export default defineHandler({
  async execute(ctx: PluginContextV3, input: RestInput<{ scope?: string }>): Promise<StatusResponse> {
    const scope = input.query?.scope || 'root';

    try {
      // Resolve scope to actual directory path
      const scopeCwd = resolveScopePath(ctx.cwd, scope);

      // Load current plan
      const plan = await loadPlan(ctx.cwd, scope);

      // Get git status (with platform cache)
      let filesChanged = 0;
      let gitStatus = null;
      const cacheKey = `git-status:${scope}`;

      // Try to get from cache
      const cached = await ctx.platform.cache.get(cacheKey);

      if (cached !== null && cached !== undefined) {
        // Use cached value
        const cachedData = cached as { count: number; status: any };
        filesChanged = cachedData.count;
        gitStatus = cachedData.status;
      } else {
        // Fetch fresh git status (git runs FROM scopeCwd)
        try {
          gitStatus = await getGitStatus(scopeCwd);

          filesChanged =
            gitStatus.staged.length +
            gitStatus.unstaged.length +
            gitStatus.untracked.length;

          // Store in cache with TTL
          await ctx.platform.cache.set(cacheKey, { count: filesChanged, status: gitStatus }, STATUS_CACHE_TTL);
        } catch (err) {
          // Ignore git status errors
        }
      }

      return {
        scope,
        hasPlan: !!plan,
        filesChanged,
        commitsInPlan: plan?.commits.length || 0,
        planTimestamp: plan?.createdAt,
        gitStatus: gitStatus || undefined,
      };
    } catch (error) {
      return {
        scope,
        hasPlan: false,
        filesChanged: 0,
        commitsInPlan: 0,
      };
    }
  },
});
