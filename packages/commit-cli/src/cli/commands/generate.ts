/**
 * commit:generate command
 * Generate commit plan from git changes
 */

import { defineCommand, useLLM, useLoader, useConfig, findRepoRoot, displayArtifacts, type CommandResult, type ArtifactInfo } from '@kb-labs/sdk';
import { stat } from 'node:fs/promises';
import {
  generateCommitPlan,
  savePlan,
  hasChanges,
  getGitStatus,
  getCurrentPlanPath,
} from '@kb-labs/commit-core';
import {
  type GenerateOutput,
  type CommitPluginConfig,
  type CommitEnv,
  resolveCommitConfig,
} from '@kb-labs/commit-contracts';
import { generateFlags } from './flags';

type GenerateCommandResult = CommandResult & {
  result?: GenerateOutput;
};

export const generateCommand = defineCommand({
  name: 'commit:generate',
  flags: generateFlags,

  async handler(ctx: any, _argv: string[], flags: any): Promise<GenerateCommandResult> {
    const llm = useLLM();
    const cwd = (await findRepoRoot(ctx.cwd || process.cwd())) ?? process.cwd();

    // Load config from kb.config.json + env overrides
    const fileConfig = await useConfig<Partial<CommitPluginConfig>>();
    const env = (ctx.env ?? {}) as CommitEnv;
    const config = resolveCommitConfig(fileConfig ?? {}, env);

    // Use CLI flag scope, or fallback to config default scope
    const effectiveScope = flags.scope ?? config.scope?.default;

    // Check for changes
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
    statusLoader.succeed('Found changes to commit');

    // Generate plan
    const analyzeLoader = useLoader('Analyzing changes...');
    analyzeLoader.start();

    // Create LLM wrapper with config values
    const llmComplete =
      llm && config.llm.enabled
        ? async (prompt: string, options?: { systemPrompt?: string; temperature?: number; maxTokens?: number }) => {
            console.error('[commit:generate] LLM wrapper called');
            try {
              console.error('[commit:generate] Calling llm.complete...');
              const result = await llm.complete(prompt, {
                ...options,
                temperature: options?.temperature ?? config.llm.temperature,
                maxTokens: options?.maxTokens ?? config.llm.maxTokens,
              });
              console.error('[commit:generate] LLM success, content preview:', result.content.substring(0, 200));
              return {
                content: result.content,
                tokensUsed: result.usage ? result.usage.promptTokens + result.usage.completionTokens : undefined,
              };
            } catch (error) {
              console.error('[commit:generate] LLM error:', error instanceof Error ? error.message : String(error));
              console.error('[commit:generate] Full error:', error);
              throw error;
            }
          }
        : undefined;

    console.error('[commit:generate] llmComplete:', !!llmComplete, 'llm:', !!llm, 'enabled:', config.llm.enabled);

    const plan = await generateCommitPlan({
      cwd,
      scope: effectiveScope,
      llmComplete,
      config,
      onProgress: (message) => analyzeLoader.update({ text: message }),
    });

    // Save plan
    const saveLoader = useLoader('Saving plan...');
    saveLoader.start();
    await savePlan(cwd, plan);
    const planPath = getCurrentPlanPath(cwd);
    saveLoader.succeed('Plan saved');

    analyzeLoader.succeed(`Generated commit plan with ${plan.commits.length} commit(s)`);

    // Output
    const output: GenerateOutput = {
      plan,
      planPath,
    };

    if (flags.json) {
      ctx.ui?.json?.(output);
    } else {
      // Build commits section
      const commitsItems = plan.commits.map((commit) => {
        const scope = commit.scope ? `(${commit.scope})` : '';
        return `${commit.type}${scope}: ${commit.message} [${commit.files.length} file(s)]`;
      });

      // Build artifacts section
      const artifacts: ArtifactInfo[] = [];
      try {
        const planStats = await stat(planPath);
        artifacts.push({
          name: 'Commit Plan',
          path: planPath,
          size: planStats.size,
          modified: planStats.mtime,
          description: 'Generated commit plan in JSON format',
        });
      } catch {
        // Ignore stat errors
      }

      const sections: Array<{ header?: string; items: string[] }> = [];

      // Add commits section
      if (commitsItems.length > 0) {
        sections.push({
          header: 'Commits',
          items: commitsItems,
        });
      }

      // Add artifacts section
      if (artifacts.length > 0) {
        const artifactsLines = displayArtifacts(artifacts, {
          showSize: true,
          showTime: true,
          showDescription: true,
          maxItems: 10,
          title: '',
        });
        sections.push({
          header: 'Artifacts',
          items: artifactsLines,
        });
      }

      // Build summary
      const summary: Record<string, string | number> = {
        'Files': plan.metadata.totalFiles,
        'Commits': plan.metadata.totalCommits,
      };

      if (plan.metadata.llmUsed) {
        summary['LLM'] = plan.metadata.escalated ? 'Phase 2 (with diff)' : 'Phase 1';
        if (plan.metadata.tokensUsed) {
          summary['Tokens'] = plan.metadata.tokensUsed;
        }
      } else {
        summary['Generator'] = 'Heuristics';
      }

      ctx.ui?.success?.('Commit Plan Generated', {
        summary,
        sections,
      });
    }

    return {
      ok: true,
      result: output,
    };
  },
});
