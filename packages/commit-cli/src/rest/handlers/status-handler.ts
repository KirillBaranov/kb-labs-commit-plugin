import { defineHandler, type RestInput, type MetricGroupData, type MetricData } from '@kb-labs/sdk';
import { loadPlan } from '@kb-labs/commit-core/storage';
import { getGitStatus } from '@kb-labs/commit-core/analyzer';
import { resolveWorkspacePath } from '../workspace-resolver';
import { relative } from 'node:path';

const STATUS_CACHE_TTL = 5000; // 5 seconds

/**
 * GET /status handler
 *
 * Returns current status for a workspace as metrics for Studio metric-group widget.
 * Uses ctx.platform.cache for git status caching.
 */
export default defineHandler({
  async execute(ctx, input: RestInput<{ workspace?: string }>): Promise<MetricGroupData> {
    const workspace = input.query?.workspace || 'root';

    try {
      const cwd = await resolveWorkspacePath(workspace, ctx.cwd);

      // Load current plan
      const plan = await loadPlan(cwd);

      // Get git status (with platform cache)
      let filesChanged = 0;
      const cacheKey = `git-status:${workspace}`;

      // Try to get from cache
      const cached = await ctx.platform.cache.get(cacheKey);

      if (cached !== null && cached !== undefined) {
        // Use cached value
        filesChanged = cached as number;
      } else {
        // Fetch fresh git status
        try {
          // For nested repos, calculate relative path from monorepo root to workspace
          let scope: string | undefined;
          if (workspace !== 'root' && workspace !== '.') {
            const relativePath = relative(ctx.cwd, cwd);
            scope = relativePath ? `${relativePath}/**` : undefined;
          }

          const gitStatus = await getGitStatus(ctx.cwd, scope ? { scope } : {});

          filesChanged =
            gitStatus.staged.length +
            gitStatus.unstaged.length +
            gitStatus.untracked.length;

          // Store in cache with TTL
          await ctx.platform.cache.set(cacheKey, filesChanged, STATUS_CACHE_TTL);
        } catch (err) {
          // Ignore git status errors
        }
      }

      const metrics: MetricData[] = [
        {
          value: filesChanged,
          label: 'Files Changed',
          status: filesChanged > 0 ? 'warning' : 'default',
        },
        {
          value: plan?.commits.length || 0,
          label: 'Commits in Plan',
          status: plan ? 'success' : 'default',
        },
        {
          value: plan ? 'Yes' : 'No',
          label: 'Has Plan',
          status: plan ? 'success' : 'default',
        },
      ];

      return { metrics };
    } catch (error) {
      return {
        metrics: [
          { value: 0, label: 'Files Changed', status: 'default' },
          { value: 0, label: 'Commits in Plan', status: 'default' },
          { value: 'No', label: 'Has Plan', status: 'default' },
        ],
      };
    }
  },
});
