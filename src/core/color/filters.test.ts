import { describe, expect, it } from 'vitest';
import { cssFilterFor, unsharpMask } from './filters';

function image(width: number, height: number, color: [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) data.set(color, index * 4);
  return { width, height, data };
}

describe('filters', () => {
  it('leaves flat areas untouched', () => {
    const source = image(4, 4, [100, 120, 140, 255]);
    const result = unsharpMask(source, 1);
    const index = (2 * 4 + 2) * 4;
    expect(result.data[index]).toBe(100);
    expect(result.data[index + 1]).toBe(120);
    expect(result.data[index + 2]).toBe(140);
    expect(result.data[index + 3]).toBe(255);
  });

  it('increases local contrast on edges', () => {
    const source = image(3, 3, [50, 50, 50, 255]);
    source.data.set([200, 200, 200, 255], (1 * 3 + 1) * 4);
    const result = unsharpMask(source, 1);
    const center = result.data[(1 * 3 + 1) * 4];
    expect(center).toBeGreaterThan(200);
  });

  it('never exceeds channel limits', () => {
    const source = image(3, 3, [255, 255, 255, 255]);
    source.data.set([0, 0, 0, 255], 16);
    const result = unsharpMask(source, 1);
    for (let index = 0; index < result.data.length; index += 1) {
      expect(result.data[index]).toBeGreaterThanOrEqual(0);
      expect(result.data[index]).toBeLessThanOrEqual(255);
    }
  });

  it('builds a CSS filter string', () => {
    const filter = cssFilterFor(0, 0, 0, false);
    expect(filter).toContain('brightness(1.000)');
    expect(filter).toContain('grayscale(0)');
  });
});
