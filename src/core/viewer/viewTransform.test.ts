import { describe, expect, it } from 'vitest';
import { clampPan, displayScale, fitScale, panForZoomAtPoint, zoomPercent } from './viewTransform';

const stage = { width: 1000, height: 800 };

describe('view transform', () => {
  it('computes display scale from fit and zoom', () => {
    expect(displayScale(0.5, 2)).toBe(1);
  });

  it('fits large images and does not upscale small ones', () => {
    expect(fitScale({ width: 2000, height: 1600 }, stage)).toBeLessThan(0.5);
    expect(fitScale({ width: 100, height: 100 }, stage)).toBe(1);
  });

  it('keeps the point under the cursor stable while zooming', () => {
    const point = { x: 750, y: 300 };
    const pan = { x: 0, y: 0 };
    const oldScale = 0.5;
    const newScale = 1;
    const nextPan = panForZoomAtPoint(pan, oldScale, newScale, point, stage);
    // The same image point must project to the same screen point.
    const imagePoint = {
      x: (point.x - stage.width / 2 - pan.x) / oldScale,
      y: (point.y - stage.height / 2 - pan.y) / oldScale,
    };
    const projected = {
      x: stage.width / 2 + nextPan.x + imagePoint.x * newScale,
      y: stage.height / 2 + nextPan.y + imagePoint.y * newScale,
    };
    expect(projected.x).toBeCloseTo(point.x, 5);
    expect(projected.y).toBeCloseTo(point.y, 5);
  });

  it('clamps panning to a reachable area', () => {
    const pan = clampPan({ x: 99999, y: -99999 }, { width: 2000, height: 1600 }, stage);
    expect(pan.x).toBeLessThan(99999);
    expect(pan.y).toBeGreaterThan(-99999);
  });

  it('formats zoom percentages', () => {
    expect(zoomPercent(1)).toBe('100%');
    expect(zoomPercent(0.05)).toBe('5.0%');
  });
});
