#!/usr/bin/env node
/**
 * Desktop dev mode: starts Vite, bundles the Electron shell and launches it.
 * Usage: npm run desktop
 */
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const server = await createServer({ root, server: { port: 5173, strictPort: true, host: '127.0.0.1' } });
await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5173';
console.log(`[lumina] renderer em ${url}`);

await import('./build-electron.mjs');

const electronBinary = require('electron');
const child = spawn(electronBinary, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, LUMINA_DEV_URL: url },
});

const shutdown = async () => {
  await server.close();
  process.exit(0);
};

child.on('exit', shutdown);
process.on('SIGINT', () => {
  child.kill();
  void shutdown();
});
