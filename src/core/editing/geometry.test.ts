import { describe, expect, it } from 'vitest';
import {
  cropToPixels,
  editBounds,
  editOutputSize,
  fitScaleFactor,
  fitInside,
  nextZoom,
  normalizedRotation,
  rotatedBounds,
  toRadians,
} from './geometry';

describe('geometry', () => {
  it('computes the bounding box of a rotated rectangle', () => {
    expect(rotatedBounds(100, 50, 0)).toEqual({ width: 100, height: 50 });
    expect(rotatedBounds(100, 50, 90)).toEqual({ width: 50, height: 100 });
    const straight = rotatedBounds(100, 50, 30);
    expect(straight.width).toBe(112);
    expect(straight.height).toBe(93);
  });

  it('normalizes quarter turns', () => {
    expect(normalizedRotation(90)).toBe(90);
    expect(normalizedRotation(-90)).toBe(270);
    expect(normalizedRotation(450)).toBe(90);
    expect(normalizedRotation(0)).toBe(0);
  });

  it('swaps bounds for 90 and 270 degree rotations', () => {
    expect(editBounds({ width: 800, height: 600 }, { rotation: 90, straighten: 0 })).toEqual({
      width: 600,
      height: 800,
    });
    expect(editBounds({ width: 800, height: 600 }, { rotation: 270, straighten: 0 })).toEqual({
      width: 600,
      height: 800,
    });
    expect(editBounds({ width: 800, height: 600 }, { rotation: 180, straighten: 0 })).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('keeps the bounds unchanged for a full straighten rotation', () => {
    const bounds = editBounds({ width: 400, height: 300 }, { rotation: 0, straighten: 90 });
    expect(bounds.width).toBe(300);
    expect(bounds.height).toBe(400);
  });

  it('converts a normalized crop into pixels', () => {
    const rect = cropToPixels({ x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, { width: 800, height: 400 });
    expect(rect).toEqual({ x: 200, y: 200, width: 400, height: 100 });
  });

  it('clamps crops that overflow the image', () => {
    const rect = cropToPixels({ x: 0.9, y: 0.9, width: 0.5, height: 0.5 }, { width: 100, height: 100 });
    expect(rect.x + rect.width).toBeLessThanOrEqual(100);
    expect(rect.y + rect.height).toBeLessThanOrEqual(100);
    expect(rect.width).toBeGreaterThanOrEqual(1);
  });

  it('derives the output size from bounds minus crop', () => {
    const size = editOutputSize(
      { width: 1000, height: 500 },
      { rotation: 90, straighten: 0, crop: { x: 0.5, y: 0, width: 0.5, height: 1 } },
    );
    expect(size).toEqual({ width: 250, height: 1000 });
  });

  it('fits an image inside a stage without upscaling beyond 100%', () => {
    expect(fitScaleFactor({ width: 1000, height: 500 }, { width: 500, height: 500 }, 0)).toBe(0.5);
    expect(fitScaleFactor({ width: 100, height: 100 }, { width: 500, height: 500 }, 0)).toBe(1);
    expect(fitScaleFactor({ width: 100, height: 100 }, { width: 500, height: 500 }, 0, true)).toBe(5);
  });

  it('fits inside while preserving aspect', () => {
    expect(fitInside({ width: 400, height: 200 }, { width: 200, height: 200 })).toEqual({
      width: 200,
      height: 100,
    });
  });

  it('steps through zoom levels', () => {
    expect(nextZoom(1, 1)).toBe(1.5);
    expect(nextZoom(1, -1)).toBe(0.75);
    expect(nextZoom(8, 1)).toBe(8);
    expect(nextZoom(0.05, -1)).toBe(0.05);
  });

  it('converts degrees to radians', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI);
  });
});
