/**
 * commit:push command
 * Push commits to remote
 */

import { defineCommand, useLoader, findRepoRoot, type CommandResult } from '@kb-labs/sdk';
import { pushCommits } from '@kb-labs/commit-core';
import type { PushOutput } from '@kb-labs/commit-contracts';
import { pushFlags } from './flags';

type PushCommandResult = CommandResult & {
  result?: PushOutput;
};

export const pushCommand = defineCommand({
  name: 'commit:push',
  flags: pushFlags,

  async handler(ctx: any, _argv: string[], flags: any): Promise<PushCommandResult> {
    const cwd = (await findRepoRoot(ctx.cwd || process.cwd())) ?? process.cwd();

    // Push
    const pushLoader = useLoader('Pushing commits...');
    pushLoader.start();
    const result = await pushCommits(cwd, {
      force: flags.force,
    });

    // Output
    const output: PushOutput = {
      success: result.success,
      remote: result.remote,
      branch: result.branch,
      commits: result.commitsPushed,
    };

    if (result.success) {
      if (result.commitsPushed > 0) {
        pushLoader.succeed(`Pushed ${result.commitsPushed} commit(s) to ${result.remote}/${result.branch}`);
      } else {
        pushLoader.succeed('Nothing to push - already up to date');
      }
    } else {
      pushLoader.fail(`Failed to push: ${result.error}`);
    }

    if (flags.json) {
      ctx.ui?.json?.(output);
    }

    return {
      ok: result.success,
      result: output,
      error: result.error,
    };
  },
});
