/**
 * commit:open command
 * Show current commit plan
 */

import { defineCommand, findRepoRoot, type CommandResult } from '@kb-labs/sdk';
import { loadPlan, getCurrentPlanPath, formatCommitMessage } from '@kb-labs/commit-core';
import type { OpenOutput } from '@kb-labs/commit-contracts';
import { jsonOnlyFlags } from './flags';

type OpenCommandResult = CommandResult & {
  result?: OpenOutput;
};

export const openCommand = defineCommand({
  name: 'commit:open',
  flags: jsonOnlyFlags,

  async handler(ctx: any, _argv: string[], flags: any): Promise<OpenCommandResult> {
    const cwd = (await findRepoRoot(ctx.cwd || process.cwd())) ?? process.cwd();

    // Load current plan
    const plan = await loadPlan(cwd);
    const planPath = getCurrentPlanPath(cwd);

    // Output
    const output: OpenOutput = {
      hasPlan: plan !== null,
      plan: plan ?? undefined,
      planPath: plan ? planPath : undefined,
    };

    if (flags.json) {
      ctx.ui?.json?.(output);
    } else {
      if (!plan) {
        ctx.ui?.info?.('No commit plan found. Run `kb commit:generate` to create one.');
      } else {
        ctx.ui?.success?.(`Commit plan: ${planPath}`);
        ctx.ui?.info?.(`Created: ${plan.createdAt}`);
        ctx.ui?.info?.(`Files: ${plan.metadata.totalFiles}`);
        ctx.ui?.info?.(`Commits: ${plan.metadata.totalCommits}`);
        ctx.ui?.info?.('');

        // Show commits
        for (let i = 0; i < plan.commits.length; i++) {
          const commit = plan.commits[i];
          if (commit) {
            const message = formatCommitMessage(commit);
            ctx.ui?.info?.(`${i + 1}. ${message}`);
            ctx.ui?.info?.(`   Files: ${commit.files.join(', ')}`);
            ctx.ui?.info?.(`   Release hint: ${commit.releaseHint}`);
            if (commit.breaking) {
              ctx.ui?.info?.('   BREAKING CHANGE');
            }
            ctx.ui?.info?.('');
          }
        }

        // Show git status at generation time
        const status = plan.gitStatus;
        const stagedCount = status.staged.length;
        const unstagedCount = status.unstaged.length;
        const untrackedCount = status.untracked.length;

        ctx.ui?.info?.('Git status at generation:');
        ctx.ui?.info?.(`  Staged: ${stagedCount} file(s)`);
        ctx.ui?.info?.(`  Unstaged: ${unstagedCount} file(s)`);
        ctx.ui?.info?.(`  Untracked: ${untrackedCount} file(s)`);
      }
    }

    return {
      ok: true,
      result: output,
    };
  },
});
