import { EsrganEngine } from './esrganEngine';
import { LanczosEngine } from './classicEngine';
import type { UpscaleEngine, UpscaleEngineId } from './types';

const engineRegistry: Record<UpscaleEngineId, UpscaleEngine> = {
  esrgan: new EsrganEngine(),
  lanczos: new LanczosEngine(),
};

export function getEngine(id: UpscaleEngineId): UpscaleEngine {
  return engineRegistry[id];
}

export function listEngines(): UpscaleEngine[] {
  return [engineRegistry.esrgan, engineRegistry.lanczos];
}

export function abortEngine(id: UpscaleEngineId): void {
  const engine = engineRegistry[id];
  if (engine instanceof EsrganEngine) engine.abortActive();
}

export * from './types';
export * from './scaleChain';
