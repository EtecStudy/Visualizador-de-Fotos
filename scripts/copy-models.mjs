#!/usr/bin/env node
/**
 * Copies the ESRGAN-Slim model weights (MIT licensed) from the npm package
 * into public/models so the app can run 100% offline — no CDN, no upload.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = join(root, 'node_modules', '@upscalerjs', 'esrgan-slim', 'models');
const destRoot = join(root, 'public', 'models', 'esrgan-slim');

if (!existsSync(pkgDir)) {
  console.warn('[models] @upscalerjs/esrgan-slim não instalado — pulando cópia dos modelos.');
  process.exit(0);
}

const scales = [2, 3, 4];
let total = 0;

for (const scale of scales) {
  const src = join(pkgDir, `x${scale}`);
  if (!existsSync(src)) {
    console.warn(`[models] modelo x${scale} não encontrado em ${src}`);
    continue;
  }
  const dest = join(destRoot, `x${scale}`);
  mkdirSync(dest, { recursive: true });
  for (const file of readdirSync(src)) {
    cpSync(join(src, file), join(dest, file));
    total += statSync(join(src, file)).size;
  }
}

// Keep the MIT license next to the weights.
cpSync(
  join(root, 'node_modules', '@upscalerjs', 'esrgan-slim', 'LICENSE'),
  join(destRoot, 'LICENSE'),
);

console.log(`[models] ESRGAN-Slim x2/x3/x4 prontos (${(total / 1024 / 1024).toFixed(2)} MB) em public/models/esrgan-slim`);
