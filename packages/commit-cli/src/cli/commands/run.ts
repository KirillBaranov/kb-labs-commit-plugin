/**
 * commit command (default flow)
 * Generate → Apply → (optional) Push
 */

import {
  defineCommand,
  useLLM,
  useLoader,
  useConfig,
  findRepoRoot,
  type PluginContextV3,
} from '@kb-labs/sdk';
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
  resolveCommitConfig,
  commitFlags,
  type CommitFlags,
  commitEnv,
} from '@kb-labs/commit-contracts';

// Input type with backward compatibility
type RunInput = CommitFlags & { argv?: string[] };

type RunResult = {
  exitCode: number;
  result?: CommitRunOutput;
  meta?: Record<string, unknown>;
};

export default defineCommand({
  id: 'commit:commit',
  description: 'Generate and apply commits (default flow)',

  handler: {
    async execute(ctx: PluginContextV3, input: RunInput): Promise<RunResult> {
      const startTime = Date.now();
      const llm = useLLM();
      const cwd = (await findRepoRoot(ctx.cwd || process.cwd())) ?? process.cwd();

      // Load config from kb.config.json + env overrides
      const fileConfig = await useConfig<Partial<CommitPluginConfig>>();

      // V3: Parse env variables with type safety and validation
      const env = commitEnv.parse(ctx.runtime);

      const config = resolveCommitConfig(fileConfig ?? {}, env);

      // V3: Flags come in input.flags object (not auto-merged)
      const flags = (input as any).flags ?? input;
      const effectiveScope = flags.scope ?? config.scope?.default;
      const dryRun = flags['dry-run'] ?? false;
      const withPush = flags['with-push'] ?? false;
      const outputJson = flags.json ?? false;

      // 1. Check for changes
      const statusLoader = useLoader('Checking git status...');
      statusLoader.start();
      const status = await getGitStatus(cwd, { scope: effectiveScope });

      if (!hasChanges(status)) {
        statusLoader.stop();
        ctx.ui?.warn?.('No changes to commit');
        return {
          exitCode: 1,
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
              const result = await llm.complete(prompt, {
                ...options,
                temperature: options?.temperature ?? config.llm.temperature,
                maxTokens: options?.maxTokens ?? config.llm.maxTokens,
              });
              return {
                content: result.content,
                tokensUsed: result.usage ? result.usage.promptTokens + result.usage.completionTokens : undefined,
              };
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
      if (dryRun) {
        const commitsItems = plan.commits.map((commit) => {
          const scope = commit.scope ? `(${commit.scope})` : '';
          return `${commit.type}${scope}: ${commit.message} [${commit.files.length} file(s)]`;
        });

        const summaryItems: string[] = [
          `Files: ${plan.metadata.totalFiles}`,
          `Commits: ${plan.metadata.totalCommits}`,
          'Mode: Dry Run',
        ];

        if (plan.metadata.llmUsed) {
          const llmPhase = plan.metadata.escalated ? 'Phase 2 (with diff)' : 'Phase 1';
          summaryItems.push(`LLM: ${llmPhase}`);
          if (plan.metadata.tokensUsed) {
            summaryItems.push(`Tokens: ${plan.metadata.tokensUsed}`);
          }
        } else {
          summaryItems.push('Generator: Heuristics');
        }

        ctx.ui?.success?.('Commit Plan (Dry Run)', {
          sections: [
            { header: 'Summary', items: summaryItems },
            { header: 'Commits', items: commitsItems },
          ],
        });

        return {
          exitCode: 0,
          result: {
            plan,
            applied: false,
            pushed: false,
            commits: plan.commits.map((c) => ({
              id: c.id,
              message: `${c.type}${c.scope ? `(${c.scope})` : ''}: ${c.message}`,
            })),
          },
          meta: {
            timing: Date.now() - startTime,
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
          exitCode: 1,
        };
      }

      // Save to history and clear
      await saveToHistory(cwd, plan, applyResult);
      await clearPlan(cwd);

      applyLoader.succeed(`Applied ${applyResult.appliedCommits.length} commit(s)`);

      // 4. Push (optional)
      let pushed = false;
      if (withPush) {
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

      if (outputJson) {
        ctx.ui?.json?.(output);
      } else {
        const colors = ctx.ui?.colors;

        // Header
        const header = colors?.bold?.('Applied commits:') ?? 'Applied commits:';
        ctx.ui?.write?.('');
        ctx.ui?.write?.(header);

        // Commits list
        for (const c of applyResult.appliedCommits) {
          const shortSha = c.sha.substring(0, 7);
          const firstLine = c.message.split('\n')[0];
          const coloredSha = colors?.muted?.(`[${shortSha}]`) ?? `[${shortSha}]`;
          ctx.ui?.write?.(`  ${coloredSha} ${firstLine}`);
        }
        ctx.ui?.write?.('');

        // Summary box with stats
        const summaryItems: string[] = [
          `Commits: ${applyResult.appliedCommits.length}`,
          `Pushed: ${pushed ? 'Yes' : 'No'}`,
        ];

        if (plan.metadata.llmUsed) {
          const llmPhase = plan.metadata.escalated ? 'Phase 2' : 'Phase 1';
          summaryItems.push(`LLM: ${llmPhase}`);
          if (plan.metadata.tokensUsed) {
            summaryItems.push(`Tokens: ${plan.metadata.tokensUsed}`);
          }
        }

        ctx.ui?.success?.('Done', {
          sections: [{ header: 'Summary', items: summaryItems }],
        });
      }

      return {
        exitCode: 0,
        result: output,
        meta: {
          timing: Date.now() - startTime,
        },
      };
    },
  },
});
