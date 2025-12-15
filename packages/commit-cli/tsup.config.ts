import { defineConfig } from 'tsup';
import nodePreset from '@kb-labs/devkit/tsup/node.js';

export default defineConfig({
  ...nodePreset,
  tsconfig: 'tsconfig.build.json',
  entry: [
    'src/index.ts',
    'src/manifest.v2.ts',
    'src/lifecycle/setup.ts',
    'src/cli/commands/run.ts',
    'src/cli/commands/generate.ts',
    'src/cli/commands/apply.ts',
    'src/cli/commands/push.ts',
    'src/cli/commands/open.ts',
    'src/cli/commands/reset.ts',
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
