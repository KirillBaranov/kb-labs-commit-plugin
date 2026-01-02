import { defineHandler, type PluginContextV3 } from '@kb-labs/sdk';
import {
  ApplyRequestSchema,
  ApplyResponseSchema,
  type ApplyRequest,
  type ApplyResponse,
} from '@kb-labs/commit-contracts';
import { applyCommitPlan } from '@kb-labs/commit-core/applier';
import { loadPlan } from '@kb-labs/commit-core/storage';
import * as path from 'node:path';

/**
 * POST /apply handler
 *
 * Applies the current commit plan by creating git commits.
 */
export default defineHandler({
  async execute(_ctx: PluginContextV3, input: ApplyRequest): Promise<ApplyResponse> {
    const { workspace, force } = input;

    try {
      const cwd = getWorkspacePath(workspace);

      // Load the plan first
      const plan = await loadPlan(cwd);
      if (!plan) {
        throw new Error('No commit plan found. Generate a plan first with POST /generate');
      }

      const result = await applyCommitPlan(cwd, plan, { force });

      return {
        result,
        workspace,
      };
    } catch (error) {
      throw new Error(`Failed to apply commits: ${error}`);
    }
  },
});

/**
 * Convert workspace ID to filesystem path
 */
function getWorkspacePath(workspace: string): string {
  const cwd = process.cwd();
  if (workspace === 'root' || workspace === '.') return cwd;
  return path.join(cwd, workspace.replace('@', '').replace(/\//g, '-'));
}
