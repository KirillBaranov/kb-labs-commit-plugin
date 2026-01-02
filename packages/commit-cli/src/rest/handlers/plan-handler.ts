import { defineHandler, type PluginContextV3, type CardListData, type CardData } from '@kb-labs/sdk';
import { loadPlan } from '@kb-labs/commit-core/storage';
import * as path from 'node:path';

/**
 * GET /plan handler
 *
 * Returns the current commit plan as CardListData for Studio cardlist widget.
 */
export default defineHandler({
  async execute(_ctx: PluginContextV3, input: { workspace?: string }): Promise<CardListData> {
    const workspace = input.workspace || 'root';

    try {
      const cwd = getWorkspacePath(workspace);
      const plan = await loadPlan(cwd);

      if (!plan || plan.commits.length === 0) {
        return {
          cards: [],
          total: 0,
        };
      }

      // Transform commit groups into cards
      const cards: CardData[] = plan.commits.map((commit) => {
        const typeColor =
          commit.type === 'feat'
            ? 'success'
            : commit.type === 'fix'
              ? 'warning'
              : 'default';

        return {
          title: commit.scope ? `${commit.type}(${commit.scope})` : commit.type,
          description: commit.message,
          meta: [
            { label: 'Type', value: commit.type },
            ...(commit.scope ? [{ label: 'Scope', value: commit.scope }] : []),
            { label: 'Files', value: String(commit.files.length) },
          ],
          status: typeColor,
          tags: commit.files.map((file) => ({ label: file })),
        };
      });

      return {
        cards,
        total: cards.length,
      };
    } catch (error) {
      return {
        cards: [],
        total: 0,
      };
    }
  },
});

/**
 * Convert workspace ID to filesystem path
 */
function getWorkspacePath(workspace: string): string {
  const cwd = process.cwd();

  if (workspace === 'root' || workspace === '.') {
    return cwd;
  }

  return path.join(cwd, workspace.replace('@', '').replace(/\//g, '-'));
}
