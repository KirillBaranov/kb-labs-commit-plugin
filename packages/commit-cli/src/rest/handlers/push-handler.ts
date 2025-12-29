import { defineHandler } from '@kb-labs/sdk';
import {
  PushRequestSchema,
  PushResponseSchema,
  type PushRequest,
  type PushResponse,
} from '@kb-labs/commit-contracts';
import { pushCommits } from '@kb-labs/commit-core/applier';
import * as path from 'node:path';

/**
 * POST /push handler
 *
 * Pushes commits to the remote repository.
 */
export default defineHandler({
  async execute(ctx, input: PushRequest): Promise<PushResponse> {
    const { workspace, remote, force } = input;

    try {
      const cwd = getWorkspacePath(workspace);

      const result = await pushCommits(cwd, { remote, force });

      return {
        result,
        workspace,
      };
    } catch (error) {
      throw new Error(`Failed to push commits: ${error}`);
    }
  },
});

/**
 * Convert workspace ID to filesystem path
 */
function getWorkspacePath(workspace: string): string {
  const cwd = process.cwd();
  if (workspace === 'root' || workspace === '.') return cwd;
  return path.join(cwd, workspace.replace('@', '').replace(/\//g, '-'));
}
