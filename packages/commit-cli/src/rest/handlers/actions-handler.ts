import { defineHandler, type PluginContextV3, type RestInput } from '@kb-labs/sdk';
import type { ActionsResponse } from '@kb-labs/commit-contracts';

/**
 * GET /actions handler
 *
 * Returns minimal data for actions widget (widget mainly displays action buttons).
 * Returns currently selected workspace for context.
 */
export default defineHandler({
  async execute(_ctx: PluginContextV3, input: RestInput<{ workspace?: string }>): Promise<ActionsResponse> {
    const workspace = input.query?.workspace;

    return {
      workspace,
    };
  },
});
