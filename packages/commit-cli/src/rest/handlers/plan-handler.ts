import { defineHandler, type PluginContextV3, type CardListData, type CardData } from '@kb-labs/sdk';
import { loadPlan } from '@kb-labs/commit-core/storage';

/**
 * GET /plan handler
 *
 * Returns the current commit plan as CardListData for Studio cardlist widget.
 */
export default defineHandler({
  async execute(ctx: PluginContextV3, input: { scope?: string }): Promise<CardListData> {
    const scope = input.scope || 'root';

    try {
      const plan = await loadPlan(ctx.cwd, scope);

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
