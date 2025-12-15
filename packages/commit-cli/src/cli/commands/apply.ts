/**
 * commit:apply command
 * Apply current commit plan
 */

import { defineCommand, useLoader, findRepoRoot, type CommandResult } from '@kb-labs/sdk';
import {
  applyCommitPlan,
  loadPlan,
  saveToHistory,
  clearPlan,
} from '@kb-labs/commit-core';
import type { ApplyOutput } from '@kb-labs/commit-contracts';
import { applyFlags } from './flags';

type ApplyCommandResult = CommandResult & {
  result?: ApplyOutput;
};

export const applyCommand = defineCommand({
  name: 'commit:apply',
  flags: applyFlags,

  async handler(ctx: any, _argv: string[], flags: any): Promise<ApplyCommandResult> {
    const cwd = (await findRepoRoot(ctx.cwd || process.cwd())) ?? process.cwd();

    // Load current plan
    const loadLoader = useLoader('Loading commit plan...');
    loadLoader.start();
    const plan = await loadPlan(cwd);

    if (!plan) {
      loadLoader.fail('No commit plan found');
      ctx.ui?.error?.('Run `kb commit:generate` first.');
      return {
        ok: false,
        error: 'No commit plan found',
      };
    }

    if (plan.commits.length === 0) {
      loadLoader.stop();
      ctx.ui?.warn?.('Commit plan is empty. Nothing to apply.');
      return {
        ok: true,
        result: {
          success: true,
          commits: [],
          errors: [],
        },
      };
    }
    loadLoader.succeed(`Loaded plan with ${plan.commits.length} commit(s)`);

    // Apply plan
    const applyLoader = useLoader(`Applying ${plan.commits.length} commit(s)...`);
    applyLoader.start();
    const result = await applyCommitPlan(cwd, plan, {
      force: flags.force,
    });

    // Save to history and clear current plan on success
    if (result.success) {
      await saveToHistory(cwd, plan, result);
      await clearPlan(cwd);
      applyLoader.succeed(`Applied ${result.appliedCommits.length} commit(s) successfully`);
    } else {
      applyLoader.fail('Failed to apply commits');
    }

    // Output
    const output: ApplyOutput = {
      success: result.success,
      commits: result.appliedCommits.map((c) => ({
        id: c.groupId,
        sha: c.sha,
        message: c.message,
      })),
      errors: result.errors,
    };

    if (flags.json) {
      ctx.ui?.json?.(output);
    } else {
      if (result.success) {
        for (const commit of result.appliedCommits) {
          ctx.ui?.info?.(`  ${commit.sha.substring(0, 7)} ${commit.message}`);
        }
      } else {
        for (const error of result.errors) {
          ctx.ui?.error?.(`  ${error}`);
        }
      }
    }

    return {
      ok: result.success,
      result: output,
      error: result.success ? undefined : result.errors.join('; '),
    };
  },
});
