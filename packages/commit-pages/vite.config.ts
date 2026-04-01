import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { kbStudioRemote } from '@kb-labs/studio-plugin-tools';

export default defineConfig({
  plugins: [
    react(),
    kbStudioRemote({
      name: 'commitPlugin',
      exposes: {
        './CommitOverview': './src/pages/CommitOverview.tsx',
      },
    }),
  ],
  server: {
    port: 3010,
  },
  build: {
    target: 'esnext',
    minify: true,
    outDir: 'dist/widgets',
  },
});
