import { defineHandler, type PluginContextV3, type RestInput, useLogger, useLLM } from '@kb-labs/sdk';
import { type SummarizeRequest, type SummarizeResponse } from '@kb-labs/commit-contracts';
import { getFileDiff, getAllChangedFiles, getGitStatus, resolveScope } from '@kb-labs/commit-core/analyzer';
import * as path from 'node:path';

/**
 * POST /summarize handler
 *
 * Summarizes changes using LLM. Can summarize:
 * - All changes in workspace (if no file specified)
 * - Specific file changes (if file specified)
 */
export default defineHandler({
  async execute(ctx: PluginContextV3, input: RestInput<SummarizeRequest>): Promise<SummarizeResponse> {
    const logger = useLogger();
    const llm = useLLM();

    if (!llm) {
      throw new Error('LLM is not available. Please configure an LLM adapter.');
    }

    const { workspace, file } = input.body || {};

    if (!workspace) {
      throw new Error('Workspace is required');
    }

    logger.info('[summarize-handler] Request received', { workspace, file });

    try {
      // Resolve scope for the workspace
      let cwd = ctx.cwd;
      if (workspace && workspace !== 'root' && workspace !== '.') {
        const resolvedScope = await resolveScope(ctx.cwd, workspace);
        const packagePath = resolvedScope.packagePaths[0];
        if (packagePath) {
          cwd = path.join(ctx.cwd, packagePath);
        }
      }

      let prompt: string;

      if (file) {
        // Summarize specific file
        logger.info('[summarize-handler] Summarizing file', { file });

        // Strip workspace prefix if present
        let relativeFile = file;
        if (workspace && workspace !== 'root' && workspace !== '.') {
          const resolvedScope = await resolveScope(ctx.cwd, workspace);
          const packagePath = resolvedScope.packagePaths[0];
          if (packagePath && file.startsWith(packagePath + '/')) {
            relativeFile = file.substring(packagePath.length + 1);
          }
        }

        const diffResult = await getFileDiff(cwd, relativeFile);

        prompt = `Analyze this git diff and provide a concise summary of what changed in this file.

File: ${file}

Diff:
\`\`\`diff
${diffResult.diff}
\`\`\`

Provide a 2-3 sentence summary focusing on:
- What was added, modified, or removed
- The purpose/intent of the changes
- Any notable impacts

Keep it concise and technical.`;
      } else {
        // Summarize all changes
        logger.info('[summarize-handler] Summarizing all changes');

        const gitStatus = await getGitStatus(cwd);
        const files = getAllChangedFiles(gitStatus);

        if (files.length === 0) {
          return {
            workspace,
            summary: 'No changes detected in this workspace.',
          };
        }

        // Get diffs for all files (limit to first 10 to avoid token overflow)
        const filesToSummarize = files.slice(0, 10);
        const diffs = await Promise.all(
          filesToSummarize.map(async (f) => {
            const diff = await getFileDiff(cwd, f);
            return { file: f, diff: diff.diff, additions: diff.additions, deletions: diff.deletions };
          })
        );

        const diffsText = diffs
          .map((d) => `### ${d.file} (+${d.additions} -${d.deletions})\n\`\`\`diff\n${d.diff}\n\`\`\``)
          .join('\n\n');

        prompt = `Analyze these git diffs and provide a high-level summary of all changes in this workspace.

Total files changed: ${files.length}
${files.length > 10 ? `(Showing first 10 files)` : ''}

${diffsText}

Provide a 3-5 sentence summary covering:
- Overall theme of the changes
- Key features added, bugs fixed, or refactorings done
- Any notable architectural changes

Keep it concise and at a high level.`;
      }

      // Call LLM
      logger.info('[summarize-handler] Calling LLM');
      const result = await llm.complete(prompt, {
        systemPrompt: 'You are a technical code reviewer. Provide concise, accurate summaries of code changes.',
        temperature: 0.3,
        maxTokens: 500,
      });

      logger.info('[summarize-handler] LLM response received', {
        tokensUsed: result.usage.promptTokens + result.usage.completionTokens,
      });

      return {
        workspace,
        file,
        summary: result.content.trim(),
        tokensUsed: result.usage.promptTokens + result.usage.completionTokens,
      };
    } catch (error) {
      logger.error('[summarize-handler] Error', { error });
      throw new Error(`Failed to summarize changes: ${error}`);
    }
  },
});
