import type { Point, Size } from '../types';
import { clamp, fitScaleFactor } from '../editing/geometry';

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 16;

/** Display scale = fitScale * zoom. */
export function displayScale(fitScale: number, zoom: number): number {
  return fitScale * zoom;
}

export function fitScale(image: Size, stage: Size): number {
  return fitScaleFactor(image, stage, 48, false);
}

/** Keeps the image reachable: stops panning far past the stage edges. */
export function clampPan(pan: Point, rendered: Size, stage: Size): Point {
  const slackX = Math.max(0, (rendered.width - stage.width) / 2) + stage.width * 0.18;
  const slackY = Math.max(0, (rendered.height - stage.height) / 2) + stage.height * 0.18;
  return {
    x: clamp(pan.x, -slackX, slackX),
    y: clamp(pan.y, -slackY, slackY),
  };
}

/**
 * Zoom keeping the point under the cursor stable.
 * `point` and the returned pan are in stage pixels, pan relative to center.
 */
export function panForZoomAtPoint(
  pan: Point,
  oldScale: number,
  newScale: number,
  point: Point,
  stage: Size,
): Point {
  if (oldScale <= 0) return pan;
  const centerX = stage.width / 2;
  const centerY = stage.height / 2;
  const imageX = (point.x - centerX - pan.x) / oldScale;
  const imageY = (point.y - centerY - pan.y) / oldScale;
  return {
    x: point.x - centerX - imageX * newScale,
    y: point.y - centerY - imageY * newScale,
  };
}

export function zoomPercent(zoom: number): string {
  const percent = zoom * 100;
  if (percent >= 10) return `${Math.round(percent)}%`;
  return `${percent.toFixed(1)}%`;
}
