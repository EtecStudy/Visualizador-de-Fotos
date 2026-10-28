import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `base: './'` keeps the built bundle loadable from the file:// protocol
// used by Electron in production.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'chrome120',
    sourcemap: false,
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks: {
          tensorflow: ['@tensorflow/tfjs'],
          upscaler: ['upscaler'],
        },
      },
    },
  },
  optimizeDeps: {
    // TensorFlow.js ships CommonJS helpers (e.g. `long`) that must be
    // pre-bundled by esbuild to work as native ESM in the browser.
    include: ['@tensorflow/tfjs', 'upscaler', 'long'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
