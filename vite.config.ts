import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ESM config: no __dirname
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: './',
  server: { port: 5181, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        'istek-yanit': resolve(root, 'istek-yanit/index.html'),
        'event-loop': resolve(root, 'event-loop/index.html'),
        'middleware-zinciri': resolve(root, 'middleware-zinciri/index.html'),
      },
    },
  },
  test: { include: ['tests/unit/**/*.test.ts'] },
});
