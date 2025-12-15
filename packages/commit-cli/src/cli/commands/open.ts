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
        // Build commits section
        const commitsItems = plan.commits.map((commit, i) => {
          const message = formatCommitMessage(commit);
          const breaking = commit.breaking ? ' ⚠️  BREAKING' : '';
          return `${i + 1}. ${message} [${commit.files.length} file(s)]${breaking}`;
        });

        // Build git status section
        const status = plan.gitStatus;
        const statusItems = [
          `Staged: ${status.staged.length} file(s)`,
          `Unstaged: ${status.unstaged.length} file(s)`,
          `Untracked: ${status.untracked.length} file(s)`,
        ];

        const sections: Array<{ header?: string; items: string[] }> = [];

        sections.push({
          header: 'Commits',
          items: commitsItems,
        });

        sections.push({
          header: 'Git Status (at generation)',
          items: statusItems,
        });

        const summary: Record<string, string | number> = {
          'Plan path': planPath,
          'Created': plan.createdAt,
          'Total files': plan.metadata.totalFiles,
          'Total commits': plan.metadata.totalCommits,
        };

        if (plan.metadata.llmUsed) {
          summary['Generator'] = plan.metadata.escalated ? 'LLM (Phase 2)' : 'LLM (Phase 1)';
        } else {
          summary['Generator'] = 'Heuristics';
        }

        ctx.ui?.success?.('Current Commit Plan', {
          summary,
          sections,
        });
      }
    }

    return {
      ok: true,
      result: output,
    };
  },
});
