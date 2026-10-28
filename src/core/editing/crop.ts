import type { NormalizedRect, Rect, Size } from '../types';
import { clamp } from './geometry';

export type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

export interface AspectPreset {
  id: string;
  label: string;
  /** null = free crop, 'original' = source aspect, number = ratio (width / height) */
  ratio: number | 'original' | null;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: 'free', label: 'Livre', ratio: null },
  { id: 'original', label: 'Original', ratio: 'original' },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
  { id: '2:3', label: '2:3', ratio: 2 / 3 },
];

export const MIN_CROP_PIXELS = 16;

export function fullCrop(): NormalizedRect {
  return { x: 0, y: 0, width: 1, height: 1 };
}

export function isFullCrop(rect: NormalizedRect, epsilon = 1e-4): boolean {
  return (
    Math.abs(rect.x) < epsilon &&
    Math.abs(rect.y) < epsilon &&
    Math.abs(rect.width - 1) < epsilon &&
    Math.abs(rect.height - 1) < epsilon
  );
}

export function clampNormalizedRect(rect: NormalizedRect): NormalizedRect {
  const width = clamp(rect.width, 0, 1);
  const height = clamp(rect.height, 0, 1);
  return {
    x: clamp(rect.x, 0, 1 - width),
    y: clamp(rect.y, 0, 1 - height),
    width,
    height,
  };
}

/** Rect between two arbitrary points (used by drag-to-create). */
export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): NormalizedRect {
  return clampNormalizedRect({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  });
}

/** Largest rect with a given pixel aspect, centered inside `bounds`. */
export function centeredRect(bounds: Size, aspect: number | null, coverage = 0.86): NormalizedRect {
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) {
    const width = clamp(coverage, 0.05, 1);
    const height = clamp(coverage, 0.05, 1);
    return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
  }
  let pixelWidth = bounds.width * coverage;
  let pixelHeight = pixelWidth / aspect;
  if (pixelHeight > bounds.height * coverage) {
    pixelHeight = bounds.height * coverage;
    pixelWidth = pixelHeight * aspect;
  }
  return {
    x: (bounds.width - pixelWidth) / 2 / bounds.width,
    y: (bounds.height - pixelHeight) / 2 / bounds.height,
    width: pixelWidth / bounds.width,
    height: pixelHeight / bounds.height,
  };
}

/** Fit an existing rect to an aspect ratio, keeping its center. */
export function applyAspectToRect(rect: NormalizedRect, aspect: number | null, bounds: Size): NormalizedRect {
  if (!aspect) return clampNormalizedRect(rect);
  const px: Rect = {
    x: rect.x * bounds.width,
    y: rect.y * bounds.height,
    width: rect.width * bounds.width,
    height: rect.height * bounds.height,
  };
  const centerX = px.x + px.width / 2;
  const centerY = px.y + px.height / 2;

  let width = px.width;
  let height = width / aspect;
  if (height > px.height) {
    height = px.height;
    width = height * aspect;
  }
  // Never exceed the image.
  if (width > bounds.width) {
    width = bounds.width;
    height = width / aspect;
  }
  if (height > bounds.height) {
    height = bounds.height;
    width = height * aspect;
  }
  const x = clamp(centerX - width / 2, 0, bounds.width - width);
  const y = clamp(centerY - height / 2, 0, bounds.height - height);
  return {
    x: x / bounds.width,
    y: y / bounds.height,
    width: width / bounds.width,
    height: height / bounds.height,
  };
}

/**
 * Resize a crop rect by dragging one handle. All coordinates are in the same
 * (pixel) space as `bounds`; `dx`/`dy` are drag deltas in that same space.
 * The aspect ratio, when provided, is in pixel units.
 */
export function resizeCropRect(
  rect: Rect,
  handle: CropHandle,
  dx: number,
  dy: number,
  bounds: Size,
  aspect: number | null,
  minSize = MIN_CROP_PIXELS,
): Rect {
  if (handle === 'move') {
    const x = clamp(rect.x + dx, 0, Math.max(0, bounds.width - rect.width));
    const y = clamp(rect.y + dy, 0, Math.max(0, bounds.height - rect.height));
    return { x, y, width: rect.width, height: rect.height };
  }

  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;

  if (handle.includes('w')) left = clamp(left + dx, 0, right - minSize);
  if (handle.includes('e')) right = clamp(right + dx, left + minSize, bounds.width);
  if (handle.includes('n')) top = clamp(top + dy, 0, bottom - minSize);
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + minSize, bounds.height);

  let width = right - left;
  let height = bottom - top;

  if (aspect && aspect > 0) {
    if (handle === 'n' || handle === 's') {
      // Driving dimension: height. Keep horizontal center.
      const centerX = left + width / 2;
      width = Math.max(minSize, height * aspect);
      left = centerX - width / 2;
      right = centerX + width / 2;
    } else if (handle === 'e' || handle === 'w') {
      // Driving dimension: width. Keep vertical center.
      const centerY = top + height / 2;
      height = Math.max(minSize, width / aspect);
      top = centerY - height / 2;
      bottom = centerY + height / 2;
    } else {
      // Corner: width drives, the opposite corner stays anchored.
      height = Math.max(minSize, width / aspect);
      if (handle.includes('n')) top = bottom - height;
      else bottom = top + height;
    }

    // Shrink to fit the canvas if the aspect pushed us outside.
    const overflowWidth = Math.max(0, left < 0 ? -left : 0, right > bounds.width ? right - bounds.width : 0);
    const overflowHeight = Math.max(0, top < 0 ? -top : 0, bottom > bounds.height ? bottom - bounds.height : 0);
    if (overflowWidth > 0 || overflowHeight > 0) {
      const scaleDown = Math.min(
        overflowWidth > 0 ? (width - 2 * overflowWidth) / width : 1,
        overflowHeight > 0 ? (height - 2 * overflowHeight) / height : 1,
      );
      const safeScale = clamp(scaleDown, minSize / Math.max(width, height), 1);
      const newWidth = Math.max(minSize, width * safeScale);
      const newHeight = newWidth / aspect;
      if (handle.includes('w')) left = right - newWidth;
      else if (handle.includes('e')) right = left + newWidth;
      else {
        const centerX = left + width / 2;
        left = centerX - newWidth / 2;
        right = centerX + newWidth / 2;
      }
      if (handle.includes('n')) top = bottom - newHeight;
      else if (handle.includes('s')) bottom = top + newHeight;
      else {
        const centerY = top + height / 2;
        top = centerY - newHeight / 2;
        bottom = centerY + newHeight / 2;
      }
      width = right - left;
      height = bottom - top;
    }
  }

  // Final clamp inside the image.
  left = clamp(left, 0, Math.max(0, bounds.width - Math.min(width, bounds.width)));
  top = clamp(top, 0, Math.max(0, bounds.height - Math.min(height, bounds.height)));
  width = Math.min(width, bounds.width - left);
  height = Math.min(height, bounds.height - top);

  return { x: left, y: top, width, height };
}

/** Pixel rect to normalized, guarding against zero-size. */
export function pixelRectToNormalized(rect: Rect, bounds: Size): NormalizedRect {
  return {
    x: rect.x / bounds.width,
    y: rect.y / bounds.height,
    width: rect.width / bounds.width,
    height: rect.height / bounds.height,
  };
}

export function normalizedToPixelRect(rect: NormalizedRect, bounds: Size): Rect {
  return {
    x: rect.x * bounds.width,
    y: rect.y * bounds.height,
    width: rect.width * bounds.width,
    height: rect.height * bounds.height,
  };
}

export function cropAspectRatio(rect: NormalizedRect, bounds: Size): number {
  const width = rect.width * bounds.width;
  const height = rect.height * bounds.height;
  return height > 0 ? width / height : 1;
}

export function formatAspect(ratio: number): string {
  const presets = [
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
    { label: '3:2', value: 3 / 2 },
    { label: '2:3', value: 2 / 3 },
  ];
  const match = presets.find((preset) => Math.abs(preset.value - ratio) < 0.01);
  return match ? match.label : ratio.toFixed(2);
}
