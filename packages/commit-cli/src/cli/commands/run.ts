/**
 * commit command (default flow)
 * Generate → Apply → (optional) Push
 */

import { defineCommand, useLLM, useLoader, useConfig, findRepoRoot, type CommandResult } from '@kb-labs/sdk';
import {
  generateCommitPlan,
  savePlan,
  hasChanges,
  getGitStatus,
  applyCommitPlan,
  pushCommits,
  saveToHistory,
  clearPlan,
} from '@kb-labs/commit-core';
import {
  type CommitRunOutput,
  type CommitPluginConfig,
  type CommitEnv,
  resolveCommitConfig,
} from '@kb-labs/commit-contracts';
import { runFlags } from './flags';

type RunCommandResult = CommandResult & {
  result?: CommitRunOutput;
};

export const runCommand = defineCommand({
  name: 'commit',
  flags: runFlags,

  async handler(ctx: any, _argv: string[], flags: any): Promise<RunCommandResult> {
    const llm = useLLM();
    const cwd = (await findRepoRoot(ctx.cwd || process.cwd())) ?? process.cwd();

    // Load config from kb.config.json + env overrides
    const fileConfig = await useConfig<Partial<CommitPluginConfig>>();
    const env = (ctx.env ?? {}) as CommitEnv;
    const config = resolveCommitConfig(fileConfig ?? {}, env);

    // Use CLI flag scope, or fallback to config default scope
    const effectiveScope = flags.scope ?? config.scope?.default;

    // 1. Check for changes
    const statusLoader = useLoader('Checking git status...');
    statusLoader.start();
    const status = await getGitStatus(cwd, { scope: effectiveScope });

    if (!hasChanges(status)) {
      statusLoader.stop();
      ctx.ui?.warn?.('No changes to commit');
      return {
        ok: false,
        error: 'No changes to commit',
      };
    }
    statusLoader.succeed('Git status analyzed');

    // 2. Generate plan
    const analyzeLoader = useLoader('Analyzing changes...');
    analyzeLoader.start();

    // Create LLM wrapper with config values
    const llmComplete =
      llm && config.llm.enabled
        ? async (prompt: string, options?: { systemPrompt?: string; temperature?: number; maxTokens?: number }) => {
            try {
              const result = await llm.complete(prompt, {
                ...options,
                temperature: options?.temperature ?? config.llm.temperature,
                maxTokens: options?.maxTokens ?? config.llm.maxTokens,
              });
              return {
                content: result.content,
                tokensUsed: result.usage ? result.usage.promptTokens + result.usage.completionTokens : undefined,
              };
            } catch (error) {
              console.error('[commit:run] LLM error:', error instanceof Error ? error.message : String(error));
              throw error;
            }
          }
        : undefined;

    const plan = await generateCommitPlan({
      cwd,
      scope: effectiveScope,
      llmComplete,
      config,
      onProgress: (message) => analyzeLoader.update({ text: message }),
    });

    // Save plan
    await savePlan(cwd, plan);

    // Show plan summary
    analyzeLoader.succeed(`Generated commit plan with ${plan.commits.length} commit(s)`);

    // If dry-run, show plan and stop
    if (flags['dry-run']) {
      const commitsItems = plan.commits.map((commit) => {
        const scope = commit.scope ? `(${commit.scope})` : '';
        return `${commit.type}${scope}: ${commit.message} [${commit.files.length} file(s)]`;
      });

      const summary: Record<string, string | number> = {
        'Files': plan.metadata.totalFiles,
        'Commits': plan.metadata.totalCommits,
        'Mode': 'Dry Run',
      };

      if (plan.metadata.llmUsed) {
        summary['LLM'] = plan.metadata.escalated ? 'Phase 2 (with diff)' : 'Phase 1';
        if (plan.metadata.tokensUsed) {
          summary['Tokens'] = plan.metadata.tokensUsed;
        }
      } else {
        summary['Generator'] = 'Heuristics';
      }

      ctx.ui?.success?.('Commit Plan (Dry Run)', {
        summary,
        sections: [{ header: 'Commits', items: commitsItems }],
      });

      return {
        ok: true,
        result: {
          plan,
          applied: false,
          pushed: false,
          commits: plan.commits.map((c) => ({
            id: c.id,
            message: `${c.type}${c.scope ? `(${c.scope})` : ''}: ${c.message}`,
          })),
        },
      };
    }

    // 3. Apply plan
    const applyLoader = useLoader('Applying commits...');
    applyLoader.start();
    const applyResult = await applyCommitPlan(cwd, plan);

    if (!applyResult.success) {
      applyLoader.fail('Failed to apply commits');
      for (const error of applyResult.errors) {
        ctx.ui?.error?.(`  ${error}`);
      }
      return {
        ok: false,
        error: applyResult.errors.join('; '),
      };
    }

    // Save to history and clear
    await saveToHistory(cwd, plan, applyResult);
    await clearPlan(cwd);

    applyLoader.succeed(`Applied ${applyResult.appliedCommits.length} commit(s)`);

    // 4. Push (optional)
    let pushed = false;
    if (flags['with-push']) {
      const pushLoader = useLoader('Pushing commits...');
      pushLoader.start();
      const pushResult = await pushCommits(cwd);

      if (pushResult.success) {
        pushed = true;
        pushLoader.succeed(`Pushed to ${pushResult.remote}/${pushResult.branch}`);
      } else {
        pushLoader.fail(`Failed to push: ${pushResult.error}`);
      }
    }

    // Output
    const output: CommitRunOutput = {
      plan,
      applied: true,
      pushed,
      commits: applyResult.appliedCommits.map((c) => ({
        id: c.groupId,
        sha: c.sha,
        message: c.message,
      })),
    };

    if (flags.json) {
      ctx.ui?.json?.(output);
    } else {
      // Print commits BEFORE the summary box (clean output)
      ctx.ui?.write?.('\nApplied Commits:\n');
      for (const c of applyResult.appliedCommits) {
        const shortSha = c.sha.substring(0, 7);
        // Only show first line of message (no body)
        const firstLine = c.message.split('\n')[0];
        ctx.ui?.write?.(`  ${shortSha} ${firstLine}\n`);
      }
      ctx.ui?.write?.('\n');

      // Summary box with just stats
      const summary: Record<string, string | number> = {
        'Commits': applyResult.appliedCommits.length,
        'Pushed': pushed ? 'Yes' : 'No',
      };

      if (plan.metadata.llmUsed) {
        summary['LLM'] = plan.metadata.escalated ? 'Phase 2' : 'Phase 1';
        if (plan.metadata.tokensUsed) {
          summary['Tokens'] = plan.metadata.tokensUsed;
        }
      }

      ctx.ui?.success?.('Commits Created', { summary });
    }

    return {
      ok: true,
      result: output,
    };
  },
});
