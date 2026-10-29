#!/usr/bin/env node
/** Bundles the Electron main + preload scripts into electron-dist/. */
import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = resolve(root, 'electron-dist');

rmSync(outdir, { recursive: true, force: true });

await build({
  entryPoints: [resolve(root, 'electron/main.ts')],
  outfile: resolve(outdir, 'main.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  sourcemap: false,
  logLevel: 'info',
});

await build({
  entryPoints: [resolve(root, 'electron/preload.ts')],
  outfile: resolve(outdir, 'preload.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  sourcemap: false,
  logLevel: 'info',
});

console.log('[electron] main.cjs e preload.cjs gerados em electron-dist');
