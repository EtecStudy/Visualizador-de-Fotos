import type { EditState, NormalizedRect, Rect, Size } from '../types';

export const MIN_STRAIGHTEN = -45;
export const MAX_STRAIGHTEN = 45;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Bounding box of a `width x height` rectangle rotated by `angle` degrees. */
export function rotatedBounds(width: number, height: number, angle: number): Size {
  const rad = toRadians(angle);
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: Math.max(1, Math.round(width * cos + height * sin)),
    height: Math.max(1, Math.round(width * sin + height * cos)),
  };
}

export function normalizedRotation(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  return normalized as 0 | 90 | 180 | 270;
}

/**
 * Size of the image after straighten + quarter turns.
 * Quarter turns happen around the already straightened bounds, so swapping
 * width/height is enough for 90°/270°.
 */
export function editBounds(source: Size, edit: Pick<EditState, 'rotation' | 'straighten'>): Size {
  const height = Math.max(1, source.height);
  const width = Math.max(1, source.width);
  const straight = edit.straighten % 360;
  const bounds = straight === 0 ? { width, height } : rotatedBounds(width, height, straight);
  const rotation = normalizedRotation(edit.rotation);
  return rotation % 180 === 90
    ? { width: bounds.height, height: bounds.width }
    : boundGuard(bounds);
}

function boundGuard(size: Size): Size {
  return { width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) };
}

/** Output size of the *final* image (bounds minus crop). */
export function editOutputSize(
  source: Size,
  edit: Pick<EditState, 'rotation' | 'straighten' | 'crop'>,
): Size {
  const bounds = editBounds(source, edit);
  if (!edit.crop) return bounds;
  const rect = cropToPixels(edit.crop, bounds);
  return { width: rect.width, height: rect.height };
}

/** Convert a normalized crop to integer pixels inside `bounds` (at least 1x1). */
export function cropToPixels(crop: NormalizedRect, bounds: Size): Rect {
  const x = clamp(crop.x, 0, 1) * bounds.width;
  const y = clamp(crop.y, 0, 1) * bounds.height;
  const maxWidth = bounds.width - x;
  const maxHeight = bounds.height - y;
  const width = clamp(crop.width, 0, 1) * bounds.width;
  const height = clamp(crop.height, 0, 1) * bounds.height;
  const roundedX = Math.round(x);
  const roundedY = Math.round(y);
  return {
    x: clamp(roundedX, 0, bounds.width - 1),
    y: clamp(roundedY, 0, bounds.height - 1),
    width: Math.max(1, Math.round(Math.min(width, maxWidth))),
    height: Math.max(1, Math.round(Math.min(height, maxHeight))),
  };
}

export function pixelsToNormalized(rect: Rect, bounds: Size): NormalizedRect {
  return {
    x: rect.x / bounds.width,
    y: rect.y / bounds.height,
    width: rect.width / bounds.width,
    height: rect.height / bounds.height,
  };
}

/** Scale a rect to fit inside `bounds` while preserving aspect ratio (contain). */
export function fitInside(source: Size, bounds: Size): Size {
  if (source.width <= 0 || source.height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(bounds.width / source.width, bounds.height / source.height);
  return { width: source.width * scale, height: source.height * scale };
}

/** Scale factor for "fit to screen" — never upscales past 100% by default. */
export function fitScaleFactor(image: Size, stage: Size, padding = 56, allowUpscale = false): number {
  if (!image.width || !image.height || !stage.width || !stage.height) return 1;
  const availableWidth = Math.max(32, stage.width - padding * 2);
  const availableHeight = Math.max(32, stage.height - padding * 2);
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
  return allowUpscale ? scale : Math.min(scale, 1);
}

/** Zoom levels exposed in the UI. */
export const ZOOM_STEPS = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8] as const;

export function nextZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) {
    return ZOOM_STEPS.find((step) => step > current + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  }
  const reversed = [...ZOOM_STEPS].reverse();
  return reversed.find((step) => step < current - 0.001) ?? ZOOM_STEPS[0];
}
