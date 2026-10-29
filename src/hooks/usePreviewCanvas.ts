import { useEffect, useMemo, useRef, useState } from 'react';
import type { EditState, PhotoAsset, Size } from '../core/types';
import { renderPhoto } from '../core/render/photoRenderer';

interface PreviewResult {
  canvas: HTMLCanvasElement | null;
  outputSize: Size;
  bounds: Size;
  error: string | null;
  /** True while a higher quality render is still pending. */
  isRefining: boolean;
}

interface PreviewOptions {
  applyCrop?: boolean;
  /** High-quality pass once the user stops interacting. */
  maxDimension?: number;
  /** Cheap pass while the user is dragging sliders. */
  interactiveDimension?: number;
}

/**
 * Renders the edited photo to a canvas, using a fast preview while the user
 * is interacting and a full-quality pass shortly after the last change.
 */
export function usePreviewCanvas(
  asset: PhotoAsset | null,
  edit: EditState,
  options: PreviewOptions = {},
): PreviewResult {
  const { applyCrop = true, maxDimension = 3200, interactiveDimension = 1800 } = options;
  const [result, setResult] = useState<PreviewResult>({
    canvas: null,
    outputSize: { width: 0, height: 0 },
    bounds: { width: 0, height: 0 },
    error: null,
    isRefining: false,
  });
  const editKey = useMemo(
    () =>
      `${edit.rotation}|${edit.straighten}|${edit.adjustments.brightness}|${edit.adjustments.contrast}|${edit.adjustments.saturation}|${edit.adjustments.sharpness}|${edit.adjustments.grayscale}|${edit.crop ? `${edit.crop.x},${edit.crop.y},${edit.crop.width},${edit.crop.height}` : 'none'}|${applyCrop}`,
    [edit, applyCrop],
  );
  const latestRender = useRef(0);

  useEffect(() => {
    if (!asset) {
      setResult({ canvas: null, outputSize: { width: 0, height: 0 }, bounds: { width: 0, height: 0 }, error: null, isRefining: false });
      return;
    }

    let cancelled = false;
    let refineTimer: ReturnType<typeof setTimeout> | null = null;

    const render = (maxDimensionForPass: number, refining: boolean) => {
      if (cancelled) return;
      try {
        const rendered = renderPhoto(asset, edit, {
          maxDimension: maxDimensionForPass,
          applyCrop,
        });
        latestRender.current = performance.now();
        setResult({
          canvas: rendered.canvas,
          outputSize: rendered.outputSize,
          bounds: rendered.bounds,
          error: null,
          isRefining: refining,
        });
      } catch (error) {
        setResult((previous) => ({
          ...previous,
          error: error instanceof Error ? error.message : 'Falha ao renderizar a imagem.',
          isRefining: false,
        }));
      }
    };

    setResult((previous) => ({ ...previous, isRefining: true }));
    const frame = requestAnimationFrame(() => {
      render(interactiveDimension, true);
      refineTimer = setTimeout(() => render(maxDimension, false), 220);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (refineTimer) clearTimeout(refineTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id, editKey, maxDimension, interactiveDimension]);

  return result;
}
