import type { Size } from '../types';

export type UpscaleEngineId = 'esrgan' | 'lanczos';

export interface UpscaleProgress {
  /** 0..1 */
  value: number;
  message: string;
}

export interface UpscaleRequest {
  source: HTMLCanvasElement;
  /** Integer scale factor: 2, 3, 4, 6 or 8. */
  scale: number;
  patchSize: number;
  signal?: AbortSignal;
  onProgress?: (progress: UpscaleProgress) => void;
}

export interface UpscaleEngine {
  id: UpscaleEngineId;
  label: string;
  description: string;
  /** Local AI model — no network, no upload. */
  offline: boolean;
  maxOutputPixels: number;
  supportedScales: number[];
  upscale(request: UpscaleRequest): Promise<HTMLCanvasElement>;
  dispose(): Promise<void>;
}

export class UpscaleCancelledError extends Error {
  constructor() {
    super('Upscale cancelado.');
    this.name = 'UpscaleCancelledError';
  }
}

export class UpscaleUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpscaleUnsupportedError';
  }
}

export const UPSCALE_SCALE_OPTIONS = [
  { scale: 2, label: '2×', hint: 'Rápido, dobra a resolução' },
  { scale: 3, label: '3×', hint: 'Modelo nativo 3×' },
  { scale: 4, label: '4×', hint: 'Máximo detalhe por passada' },
  { scale: 6, label: '6×', hint: 'Encadeia modelos 3× + 2×' },
  { scale: 8, label: '8×', hint: 'Encadeia modelos 4× + 2×' },
] as const;

export function scaledSize(size: Size, scale: number): Size {
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

export function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) throw new UpscaleCancelledError();
}
