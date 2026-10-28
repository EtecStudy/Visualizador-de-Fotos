import type { EditState, PhotoAsset, Rect, Size } from '../types';
import { applyColorPipeline } from '../color/colorPipeline';
import { createCanvas, get2DContext, previewScale } from '../image/canvas';
import { cropToPixels, editBounds, toRadians } from '../editing/geometry';

export interface RenderOptions {
  /** Caps the longest side of the produced canvas (defaults to full resolution). */
  maxDimension?: number;
  /** Set to false while the crop tool is open, so the user sees the whole frame. */
  applyCrop?: boolean;
}

export interface RenderedPhoto {
  canvas: HTMLCanvasElement;
  /** Size of the final image in image pixels (not the preview pixels). */
  outputSize: Size;
  /** Size of the full, uncropped frame after rotation/straighten. */
  bounds: Size;
  crop: Rect | null;
  /** Preview scale factor applied to the canvas. */
  scale: number;
}

export class ImageTooLargeError extends Error {
  constructor(public readonly width: number, public readonly height: number) {
    super(
      `A imagem resultante é muito grande (${width} × ${height} px). Reduza o recorte ou o nível de upscale.`,
    );
    this.name = 'ImageTooLargeError';
  }
}

const MAX_EXPORT_PIXELS = 120_000_000; // ~120 MP, keeps canvas memory sane

export function renderPhoto(asset: PhotoAsset, edit: EditState, options: RenderOptions = {}): RenderedPhoto {
  const source: Size = { width: asset.width, height: asset.height };
  const bounds = editBounds(source, edit);
  const crop = edit.crop && options.applyCrop !== false ? cropToPixels(edit.crop, bounds) : null;
  const outputSize = crop ? { width: crop.width, height: crop.height } : bounds;

  const maxDimension = options.maxDimension ?? Number.POSITIVE_INFINITY;
  if (Number.isFinite(maxDimension) && outputSize.width * outputSize.height > MAX_EXPORT_PIXELS) {
    throw new ImageTooLargeError(outputSize.width, outputSize.height);
  }

  const scale = Math.min(previewScale(bounds, maxDimension), previewScale(outputSize, maxDimension));
  const geometry = drawGeometry(asset, edit, bounds, scale);

  let canvas = geometry;
  if (crop) {
    const sx = Math.round(crop.x * scale);
    const sy = Math.round(crop.y * scale);
    const sw = Math.max(1, Math.round(crop.width * scale));
    const sh = Math.max(1, Math.round(crop.height * scale));
    const cropped = createCanvas(sw, sh);
    const context = get2DContext(cropped);
    context.drawImage(geometry.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    canvas = { canvas: cropped };
  }

  const colored = applyColorPipeline(canvas.canvas, edit.adjustments);

  return {
    canvas: colored,
    outputSize,
    bounds,
    crop,
    scale,
  };
}

function drawGeometry(
  asset: PhotoAsset,
  edit: EditState,
  bounds: Size,
  scale: number,
): { canvas: HTMLCanvasElement } {
  const canvas = createCanvas(bounds.width * scale, bounds.height * scale);
  const context = get2DContext(canvas);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(toRadians(edit.straighten + edit.rotation));
  const drawWidth = asset.width * scale;
  const drawHeight = asset.height * scale;
  context.drawImage(asset.bitmap, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();
  return { canvas };
}

/** Full resolution export (colour + crop applied). */
export function renderPhotoForExport(asset: PhotoAsset, edit: EditState): RenderedPhoto {
  const source = { width: asset.width, height: asset.height };
  const bounds = editBounds(source, edit);
  const crop = edit.crop ? cropToPixels(edit.crop, bounds) : null;
  const outputSize = crop ? { width: crop.width, height: crop.height } : bounds;
  if (outputSize.width * outputSize.height > MAX_EXPORT_PIXELS) {
    throw new ImageTooLargeError(outputSize.width, outputSize.height);
  }
  return renderPhoto(asset, edit, { maxDimension: Number.POSITIVE_INFINITY, applyCrop: true });
}
