/**
 * Vite config for Studio widget bundle (Module Federation remote).
 * Builds to dist/widgets/ alongside the main tsup build in dist/.
 *
 * Build: pnpm run build:studio
 * Dev:   pnpm run dev:studio
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { kbStudioRemote } from '@kb-labs/studio-plugin-tools';

export default defineConfig({
  plugins: [
    react(),
    kbStudioRemote({
      name: 'commitPlugin',
      exposes: {
        './CommitOverview': './src/studio/pages/CommitOverview.tsx',
      },
    }),
  ],
  root: '.',
  server: {
    port: 3010,
  },
  build: {
    target: 'esnext',
    minify: true,
    outDir: 'dist/widgets',
    emptyOutDir: false,
  },
});
