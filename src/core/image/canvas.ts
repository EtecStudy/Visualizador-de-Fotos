export function createImageDataFrom(data: Uint8ClampedArray, width: number, height: number): ImageData {
  const imageData = new ImageData(width, height);
  imageData.data.set(data);
  return imageData;
}

import type { Size } from '../types';

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function get2DContext(canvas: HTMLCanvasElement, readFrequently = false): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', readFrequently ? { willReadFrequently: true } : undefined);
  if (!context) throw new Error('Não foi possível criar o contexto 2D do canvas.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  return context;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Falha ao codificar a imagem. Tente um formato diferente.'));
      },
      type,
      quality,
    );
  });
}

/** Independent copy: the WebGL renderer reuses a single canvas internally. */
export function copyCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const copy = createCanvas(source.width, source.height);
  get2DContext(copy).drawImage(source, 0, 0);
  return copy;
}

/** Largest preview scale that keeps rendering snappy while staying detailed. */
export function previewScale(bounds: Size, maxDimension: number): number {
  const longest = Math.max(bounds.width, bounds.height);
  if (!Number.isFinite(maxDimension) || longest <= maxDimension) return 1;
  return maxDimension / longest;
}

export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    image.src = url;
  });
}

