import { createCanvas, get2DContext } from '../image/canvas';
import { chainLabel, planScaleChain } from './scaleChain';
import {
  checkAbort,
  UpscaleCancelledError,
  UpscaleUnsupportedError,
  type UpscaleEngine,
  type UpscaleRequest,
} from './types';

type ModelFactor = 2 | 3 | 4;

/** Minimal surface of the UpscalerJS instance that we rely on. */
interface UpscalerInstance {
  ready: Promise<void>;
  upscale(input: HTMLCanvasElement, options: Record<string, unknown>): Promise<unknown>;
  abort(): void;
  dispose(): Promise<void>;
}

/** Every tensor this size or larger risks exhausting GPU memory. */
const MAX_OUTPUT_PIXELS = 80_000_000;

/**
 * Real super-resolution using ESRGAN-Slim (RDN) weights shipped with the app.
 * TensorFlow.js runs the network on the local GPU (WebGL) or CPU — the image
 * never leaves the machine.
 */
export class EsrganEngine implements UpscaleEngine {
  readonly id = 'esrgan' as const;
  readonly label = 'ESRGAN IA (local)';
  readonly description =
    'Rede neural de super-resolução (ESRGAN-Slim / RDN) executada no PC via TensorFlow.js. Reconstrói detalhes.';
  readonly offline = true;
  readonly maxOutputPixels = MAX_OUTPUT_PIXELS;
  readonly supportedScales = [2, 3, 4, 6, 8];

  private instances = new Map<ModelFactor, UpscalerInstance>();
  private active: UpscalerInstance | null = null;

  async upscale({ source, scale, patchSize, signal, onProgress }: UpscaleRequest): Promise<HTMLCanvasElement> {
    const chain = planScaleChain(scale);
    const outputPixels = source.width * source.height * scale * scale;
    if (outputPixels > MAX_OUTPUT_PIXELS) {
      throw new UpscaleUnsupportedError(
        `O resultado teria ${(outputPixels / 1_000_000).toFixed(1)} MP, acima do limite de 80 MP da IA local. Use uma escala menor.`,
      );
    }

    onProgress?.({ value: 0.01, message: `Carregando modelos locais (${chainLabel(chain)})…` });

    // Weight each pass by its output pixel count so the bar moves smoothly.
    const passWeights = chain.map((_factor, index) => {
      const pixels = source.width * source.height * chain.slice(0, index + 1).reduce((a, b) => a * b, 1) ** 2;
      return pixels;
    });
    const totalWeight = passWeights.reduce((a, b) => a + b, 0);

    let canvas = source;
    let completed = 0;

    for (let index = 0; index < chain.length; index += 1) {
      checkAbort(signal);
      const factor = chain[index] as ModelFactor;
      const upscaler = await this.getUpscaler(factor);
      checkAbort(signal);

      const weight = passWeights[index] / totalWeight;
      const patch = Math.max(factor * 4, Math.ceil(patchSize / factor) * factor);
      const padding = Math.min(8, Math.floor(patch / 4));

      onProgress?.({
        value: 0.02 + completed * 0.96,
        message:
          chain.length > 1
            ? `Passada ${index + 1}/${chain.length}: modelo ${factor}× em execução…`
            : `Modelo ${factor}× em execução…`,
      });

      const abortHandler = () => upscaler.abort();
      signal?.addEventListener('abort', abortHandler, { once: true });

      try {
        this.active = upscaler;
        const result = (await upscaler.upscale(canvas, {
          output: 'base64',
          patchSize: patch,
          padding,
          progress: (amount: number) => {
            onProgress?.({
              value: Math.min(0.99, 0.02 + (completed + amount * weight) * 0.96),
              message:
                chain.length > 1
                  ? `Passada ${index + 1}/${chain.length} (${factor}×): ${Math.round(amount * 100)}%`
                  : `Reconstruindo detalhes: ${Math.round(amount * 100)}%`,
            });
          },
        })) as string;
        checkAbort(signal);
        canvas = await base64ToCanvas(result);
      } catch (error) {
        if (signal?.aborted) throw new UpscaleCancelledError();
        throw error;
      } finally {
        signal?.removeEventListener('abort', abortHandler);
        this.active = null;
      }
      completed += weight;
    }

    onProgress?.({ value: 1, message: 'Concluído' });
    return canvas;
  }

  abortActive(): void {
    this.active?.abort();
  }

  private async getUpscaler(factor: ModelFactor): Promise<UpscalerInstance> {
    const cached = this.instances.get(factor);
    if (cached) return cached;

    const { default: Upscaler } = await import('upscaler');
    const instance = new Upscaler({
      model: {
        scale: factor,
        modelType: 'layers',
        path: modelUrl(factor),
        meta: {
          architecture: 'rdn',
          size: 'slim',
          dataset: 'div2k',
          patchSize: factor === 3 ? 129 : 128,
        },
        inputRange: [0, 255],
        outputRange: [0, 255],
      } as never,
    });

    // Kick off the download/compilation from local disk right away.
    const ready = instance as unknown as UpscalerInstance;
    await ready.ready;
    this.instances.set(factor, ready);
    return ready;
  }

  async dispose(): Promise<void> {
    for (const instance of this.instances.values()) {
      try {
        await instance.dispose();
      } catch {
        /* already disposed */
      }
    }
    this.instances.clear();
  }
}

function modelUrl(factor: number): string {
  return new URL(`models/esrgan-slim/x${factor}/model.json`, document.baseURI).href;
}

async function base64ToCanvas(base64: string): Promise<HTMLCanvasElement> {
  const response = await fetch(base64);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = createCanvas(bitmap.width, bitmap.height);
  get2DContext(canvas).drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}
