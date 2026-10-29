import { createCanvas, createImageDataFrom, get2DContext } from '../image/canvas';
import { lanczosResize } from './lanczos';
import {
  checkAbort,
  scaledSize,
  UpscaleUnsupportedError,
  type UpscaleEngine,
  type UpscaleRequest,
} from './types';

const MAX_OUTPUT_PIXELS = 24_000_000;

/** Lanczos3 resampling — fast, no AI, useful as a fallback / for huge images. */
export class LanczosEngine implements UpscaleEngine {
  readonly id = 'lanczos' as const;
  readonly label = 'Lanczos 3 (clássico)';
  readonly description = 'Reamostragem de alta qualidade, sem IA. Muito rápido e previsível.';
  readonly offline = true;
  readonly maxOutputPixels = MAX_OUTPUT_PIXELS;
  readonly supportedScales = [2, 3, 4, 6, 8];

  async upscale({ source, scale, signal, onProgress }: UpscaleRequest): Promise<HTMLCanvasElement> {
    const target = scaledSize({ width: source.width, height: source.height }, scale);
    if (target.width * target.height > MAX_OUTPUT_PIXELS) {
      throw new UpscaleUnsupportedError(
        `O resultado teria ${target.width} × ${target.height} px. O modo Lanczos é limitado a 24 MP — use a IA em 2× ou reduza a imagem.`,
      );
    }
    checkAbort(signal);
    onProgress?.({ value: 0.1, message: 'Lendo pixels…' });

    const sourceContext = get2DContext(source, true);
    const imageData = sourceContext.getImageData(0, 0, source.width, source.height);
    await nextFrame();
    checkAbort(signal);
    onProgress?.({ value: 0.35, message: `Reamostragem Lanczos ${target.width} × ${target.height}…` });

    const resized = lanczosResize(
      { width: imageData.width, height: imageData.height, data: imageData.data },
      target,
      3,
    );
    checkAbort(signal);
    onProgress?.({ value: 0.9, message: 'Gravando resultado…' });

    const canvas = createCanvas(target.width, target.height);
    const context = get2DContext(canvas);
    context.putImageData(createImageDataFrom(resized.data, resized.width, resized.height), 0, 0);
    onProgress?.({ value: 1, message: 'Concluído' });
    return canvas;
  }

  async dispose(): Promise<void> {
    /* nothing to release */
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 16));
}
