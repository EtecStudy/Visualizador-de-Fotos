import type { RawImage } from '../color/filters';
import type { Size } from '../types';

type WeightTable = Array<{ start: number; weights: Float32Array }>;

function lanczosFunction(x: number, lobes: number): number {
  if (x === 0) return 1;
  if (x >= lobes) return 0;
  const px = Math.PI * x;
  return (lobes * Math.sin(px) * Math.sin(px / lobes)) / (px * px);
}

function buildWeights(sourceSize: number, targetSize: number, lobes: number): WeightTable {
  const scale = targetSize / sourceSize;
  const support = scale < 1 ? lobes / scale : lobes;
  const table: WeightTable = [];

  for (let i = 0; i < targetSize; i += 1) {
    const center = (i + 0.5) / scale - 0.5;
    const start = Math.max(0, Math.floor(center - support) + 1);
    const end = Math.min(sourceSize - 1, Math.ceil(center + support) - 1);
    const count = end - start + 1;
    const weights = new Float32Array(Math.max(1, count));
    let sum = 0;
    for (let j = 0; j < count; j += 1) {
      const distance = Math.abs(start + j - center);
      const weight = lanczosFunction(distance, lobes);
      weights[j] = weight;
      sum += weight;
    }
    if (sum !== 0) {
      for (let j = 0; j < weights.length; j += 1) weights[j] /= sum;
    } else {
      weights[0] = 1;
    }
    table.push({ start, weights });
  }
  return table;
}

/**
 * High-quality separable Lanczos resampling (premultiplied alpha).
 * Pure CPU code so it can also be used for offline/CLI tests.
 */
export function lanczosResize(image: RawImage, target: Size, lobes = 3): RawImage {
  const width = Math.max(1, Math.round(target.width));
  const height = Math.max(1, Math.round(target.height));
  if (width === image.width && height === image.height) {
    return { width, height, data: new Uint8ClampedArray(image.data) };
  }

  const horizontal = new Float32Array(width * image.height * 4);
  const xWeights = buildWeights(image.width, width, lobes);
  const source = image.data;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const { start, weights } = xWeights[x];
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < weights.length; k += 1) {
        const index = (y * image.width + start + k) * 4;
        const alpha = source[index + 3] / 255;
        const weight = weights[k];
        r += source[index] * alpha * weight;
        g += source[index + 1] * alpha * weight;
        b += source[index + 2] * alpha * weight;
        a += source[index + 3] * weight;
      }
      const out = (y * width + x) * 4;
      horizontal[out] = r;
      horizontal[out + 1] = g;
      horizontal[out + 2] = b;
      horizontal[out + 3] = a;
    }
  }

  const output = new Uint8ClampedArray(width * height * 4);
  const yWeights = buildWeights(image.height, height, lobes);

  for (let y = 0; y < height; y += 1) {
    const { start, weights } = yWeights[y];
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < weights.length; k += 1) {
        const index = ((start + k) * width + x) * 4;
        const weight = weights[k];
        r += horizontal[index] * weight;
        g += horizontal[index + 1] * weight;
        b += horizontal[index + 2] * weight;
        a += horizontal[index + 3] * weight;
      }
      const out = (y * width + x) * 4;
      const alpha = a <= 0 ? 0 : a;
      const unpremultiply = alpha > 0 ? 255 / alpha : 0;
      output[out] = r * unpremultiply;
      output[out + 1] = g * unpremultiply;
      output[out + 2] = b * unpremultiply;
      output[out + 3] = alpha;
    }
  }

  return { width, height, data: output };
}
