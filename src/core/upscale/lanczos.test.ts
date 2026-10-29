import { describe, expect, it } from 'vitest';
import { lanczosResize } from './lanczos';

function solid(width: number, height: number, rgba: [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data.set(rgba, index * 4);
  }
  return { width, height, data };
}

describe('lanczos resize', () => {
  it('returns a copy when the size does not change', () => {
    const image = solid(4, 4, [10, 20, 30, 255]);
    const result = lanczosResize(image, { width: 4, height: 4 });
    expect(result.width).toBe(4);
    expect(result.data).not.toBe(image.data);
    expect(Array.from(result.data.slice(0, 4))).toEqual([10, 20, 30, 255]);
  });

  it('scales dimensions exactly', () => {
    const image = solid(10, 5, [255, 0, 0, 255]);
    const result = lanczosResize(image, { width: 20, height: 10 });
    expect(result.width).toBe(20);
    expect(result.height).toBe(10);
    expect(result.data).toHaveLength(20 * 10 * 4);
  });

  it('preserves solid colors', () => {
    const image = solid(16, 16, [12, 200, 90, 255]);
    const result = lanczosResize(image, { width: 32, height: 32 });
    const center = (16 * 32 + 16) * 4;
    expect(result.data[center]).toBeCloseTo(12, 0);
    expect(result.data[center + 1]).toBeCloseTo(200, 0);
    expect(result.data[center + 2]).toBeCloseTo(90, 0);
    expect(result.data[center + 3]).toBe(255);
  });

  it('keeps transparency', () => {
    const image = solid(8, 8, [0, 0, 0, 0]);
    const result = lanczosResize(image, { width: 16, height: 16 });
    expect(result.data[3]).toBe(0);
  });
});
