import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: [resolve('web/index.html'), resolve('web/guia.html')],
    },
  },
});
