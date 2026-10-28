import type { ColorAdjustments } from '../types';
import { copyCanvas, createCanvas, createImageDataFrom, get2DContext } from '../image/canvas';
import { cssFilterFor, unsharpMask } from './filters';
import { getColorRenderer } from './webglRenderer';

export function needsColorPass(adjustments: ColorAdjustments): boolean {
  return (
    adjustments.brightness !== 0 ||
    adjustments.contrast !== 0 ||
    adjustments.saturation !== 0 ||
    adjustments.sharpness !== 0 ||
    adjustments.grayscale
  );
}

/**
 * Applies all color work to a canvas. Tries the GPU shader first and falls
 * back to Canvas2D filters + a CPU unsharp mask. Always returns a drawable
 * canvas (the same instance when there is nothing to do).
 */
export function applyColorPipeline(source: HTMLCanvasElement, adjustments: ColorAdjustments): HTMLCanvasElement {
  if (!needsColorPass(adjustments)) return source;

  const gpuResult = getColorRenderer().process(source, adjustments);
  // The renderer owns a single GPU canvas, so hand back an independent copy
  // (previews, compare view and export can all be alive at the same time).
  if (gpuResult) return copyCanvas(gpuResult);

  return applyCpuColor(source, adjustments);
}

export function applyCpuColor(source: HTMLCanvasElement, adjustments: ColorAdjustments): HTMLCanvasElement {
  const output = createCanvas(source.width, source.height);
  const context = get2DContext(output, adjustments.sharpness > 0);

  if (
    adjustments.brightness !== 0 ||
    adjustments.contrast !== 0 ||
    adjustments.saturation !== 0 ||
    adjustments.grayscale
  ) {
    context.filter = cssFilterFor(
      adjustments.brightness,
      adjustments.contrast,
      adjustments.saturation,
      adjustments.grayscale,
    );
  }
  context.drawImage(source, 0, 0);
  context.filter = 'none';

  if (adjustments.sharpness > 0) {
    const imageData = context.getImageData(0, 0, output.width, output.height);
    const sharpened = unsharpMask(
      { width: output.width, height: output.height, data: imageData.data },
      adjustments.sharpness / 100,
    );
    context.putImageData(createImageDataFrom(sharpened.data, output.width, output.height), 0, 0);
  }

  return output;
}
