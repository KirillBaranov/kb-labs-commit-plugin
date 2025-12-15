/**
 * commit:reset command
 * Clear current commit plan
 */

import { defineCommand, findRepoRoot, type CommandResult } from '@kb-labs/sdk';
import { clearPlan, hasPlan } from '@kb-labs/commit-core';
import type { ResetOutput } from '@kb-labs/commit-contracts';
import { emptyFlags } from './flags';

type ResetCommandResult = CommandResult & {
  result?: ResetOutput;
};

export const resetCommand = defineCommand({
  name: 'commit:reset',
  flags: emptyFlags,

  async handler(ctx: any, _argv: string[], _flags: any): Promise<ResetCommandResult> {
    const cwd = (await findRepoRoot(ctx.cwd || process.cwd())) ?? process.cwd();

    // Check if plan exists
    const exists = await hasPlan(cwd);

    if (!exists) {
      ctx.ui?.info?.('No commit plan to clear.');
      return {
        ok: true,
        result: {
          success: true,
          message: 'No commit plan to clear.',
        },
      };
    }

    // Clear plan
    await clearPlan(cwd);

    ctx.ui?.success?.('Commit plan cleared.');

    return {
      ok: true,
      result: {
        success: true,
        message: 'Commit plan cleared successfully.',
      },
    };
  },
});
