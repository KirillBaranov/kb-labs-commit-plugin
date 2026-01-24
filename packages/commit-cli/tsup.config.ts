import { defineConfig } from 'tsup';
import nodePreset from '@kb-labs/devkit/tsup/node';

export default defineConfig({
  ...nodePreset,
  tsconfig: 'tsconfig.build.json',
  entry: [
    'src/index.ts',
    'src/manifest.ts',
    'src/lifecycle/setup.ts',
    'src/cli/commands/run.ts',
    'src/cli/commands/generate.ts',
    'src/cli/commands/apply.ts',
    'src/cli/commands/push.ts',
    'src/cli/commands/open.ts',
    'src/cli/commands/reset.ts',
    // REST API handlers
    'src/rest/handlers/scopes-handler.ts',
    'src/rest/handlers/status-handler.ts',
    'src/rest/handlers/actions-handler.ts',
    'src/rest/handlers/generate-handler.ts',
    'src/rest/handlers/plan-handler.ts',
    'src/rest/handlers/apply-handler.ts',
    'src/rest/handlers/push-handler.ts',
    'src/rest/handlers/reset-handler.ts',
    'src/rest/handlers/git-status-handler.ts',
    'src/rest/handlers/files-handler.ts',
    'src/rest/handlers/diff-handler.ts',
    'src/rest/handlers/summarize-handler.ts',
  ],
  external: [
    '@kb-labs/sdk',
    '@kb-labs/commit-core',
    '@kb-labs/commit-contracts',
  ],
  dts: {
    resolve: true,
    skipLibCheck: true,
  },
  clean: true,
  sourcemap: true,
});
