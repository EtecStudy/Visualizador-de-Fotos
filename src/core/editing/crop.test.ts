import { describe, expect, it } from 'vitest';
import {
  applyAspectToRect,
  centeredRect,
  clampNormalizedRect,
  cropAspectRatio,
  formatAspect,
  isFullCrop,
  rectFromPoints,
  resizeCropRect,
} from './crop';

const bounds = { width: 1000, height: 500 };

describe('crop helpers', () => {
  it('builds a source-aspect rect at full coverage', () => {
    const rect = centeredRect(bounds, 2, 1);
    expect(rect.x).toBeCloseTo(0);
    expect(rect.y).toBeCloseTo(0);
    expect(rect.width).toBeCloseTo(1);
    expect(rect.height).toBeCloseTo(1);
  });

  it('centers a square crop inside a wide image', () => {
    const rect = centeredRect(bounds, 1, 0.8);
    const pixelWidth = rect.width * bounds.width;
    const pixelHeight = rect.height * bounds.height;
    expect(pixelWidth).toBeCloseTo(pixelHeight);
    expect(rect.x + rect.width / 2).toBeCloseTo(0.5);
    expect(rect.y + rect.height / 2).toBeCloseTo(0.5);
  });

  it('applies an aspect ratio to an existing rect', () => {
    const rect = applyAspectToRect({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }, 16 / 9, bounds);
    expect(cropAspectRatio(rect, bounds)).toBeCloseTo(16 / 9, 4);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(1.0001);
    expect(rect.y + rect.height).toBeLessThanOrEqual(1.0001);
  });

  it('keeps aspect ratio when dragging a corner', () => {
    const rect = { x: 100, y: 100, width: 400, height: 200 };
    const resized = resizeCropRect(rect, 'se', 80, 30, bounds, 4 / 3);
    expect(resized.width / resized.height).toBeCloseTo(4 / 3, 4);
    expect(resized.x).toBe(100);
    expect(resized.y).toBe(100);
    expect(resized.width).toBeGreaterThan(400);
  });

  it('anchors the opposite corner when dragging north-west', () => {
    const rect = { x: 200, y: 100, width: 300, height: 300 };
    const resized = resizeCropRect(rect, 'nw', 50, 50, bounds, null);
    expect(resized.x).toBe(250);
    expect(resized.y).toBe(150);
    expect(resized.x + resized.width).toBe(500);
    expect(resized.y + resized.height).toBe(400);
  });

  it('moves the crop without changing size', () => {
    const rect = { x: 100, y: 100, width: 200, height: 200 };
    const moved = resizeCropRect(rect, 'move', 50, -40, bounds, null);
    expect(moved).toEqual({ x: 150, y: 60, width: 200, height: 200 });
  });

  it('never lets the crop leave the image', () => {
    const rect = { x: 100, y: 100, width: 200, height: 200 };
    const moved = resizeCropRect(rect, 'move', 9999, 9999, bounds, null);
    expect(moved.x + moved.width).toBeLessThanOrEqual(bounds.width);
    expect(moved.y + moved.height).toBeLessThanOrEqual(bounds.height);

    const resized = resizeCropRect(rect, 'se', 9999, 9999, bounds, null);
    expect(resized.x + resized.width).toBeLessThanOrEqual(bounds.width);
    expect(resized.y + resized.height).toBeLessThanOrEqual(bounds.height);
  });

  it('respects a minimum crop size', () => {
    const rect = { x: 100, y: 100, width: 200, height: 200 };
    const resized = resizeCropRect(rect, 'se', -9999, -9999, bounds, null, 16);
    expect(resized.width).toBeGreaterThanOrEqual(16);
    expect(resized.height).toBeGreaterThanOrEqual(16);
  });

  it('builds and clamps rects from points', () => {
    const rect = rectFromPoints({ x: 0.8, y: 0.9 }, { x: 0.2, y: 0.1 });
    expect(rect.x).toBeCloseTo(0.2);
    expect(rect.y).toBeCloseTo(0.1);
    expect(rect.width).toBeCloseTo(0.6);
    expect(rect.height).toBeCloseTo(0.8);

    const clamped = clampNormalizedRect({ x: -0.5, y: -0.5, width: 2, height: 2 });
    expect(clamped).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('detects full-frame crops', () => {
    expect(isFullCrop({ x: 0, y: 0, width: 1, height: 1 })).toBe(true);
    expect(isFullCrop({ x: 0, y: 0.1, width: 1, height: 0.9 })).toBe(false);
  });

  it('formats known aspect ratios', () => {
    expect(formatAspect(16 / 9)).toBe('16:9');
    expect(formatAspect(4 / 3)).toBe('4:3');
    expect(formatAspect(2.5)).toBe('2.50');
  });
});
