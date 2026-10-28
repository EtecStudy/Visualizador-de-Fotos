import { useEffect, useState } from 'react';
import type { PhotoAsset } from '../core/types';
import { createCanvas, get2DContext } from '../core/image/canvas';

const BINS = 64;

/** 64-bin luminance histogram of the original photo, for the adjust panel. */
export function useHistogram(asset: PhotoAsset | null): number[] {
  const [bins, setBins] = useState<number[]>(() => new Array(BINS).fill(0));

  useEffect(() => {
    if (!asset) {
      setBins(new Array(BINS).fill(0));
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      try {
        const targetWidth = Math.min(220, asset.width);
        const scale = targetWidth / asset.width;
        const canvas = createCanvas(targetWidth, Math.max(1, asset.height * scale));
        const context = get2DContext(canvas, true);
        context.drawImage(asset.bitmap, 0, 0, canvas.width, canvas.height);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const counts = new Array(BINS).fill(0);
        for (let index = 0; index < data.length; index += 4) {
          if (data[index + 3] < 8) continue;
          const luma = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
          const bin = Math.min(BINS - 1, Math.floor((luma / 255) * BINS));
          counts[bin] += 1;
        }
        const max = Math.max(...counts, 1);
        if (!cancelled) setBins(counts.map((count) => count / max));
      } catch {
        if (!cancelled) setBins(new Array(BINS).fill(0));
      }
    }, 60);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [asset]);

  return bins;
}
