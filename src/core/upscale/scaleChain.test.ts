import { describe, expect, it } from 'vitest';
import { planScaleChain, totalChainScale } from './scaleChain';

describe('scale chain', () => {
  it('uses native models when possible', () => {
    expect(planScaleChain(2)).toEqual([2]);
    expect(planScaleChain(3)).toEqual([3]);
    expect(planScaleChain(4)).toEqual([4]);
  });

  it('composes bigger factors from native models', () => {
    expect(totalChainScale(planScaleChain(6))).toBe(6);
    expect(totalChainScale(planScaleChain(8))).toBe(8);
    expect(totalChainScale(planScaleChain(9))).toBe(9);
    expect(totalChainScale(planScaleChain(12))).toBe(12);
    expect(totalChainScale(planScaleChain(16))).toBe(16);
  });

  it('returns short chains', () => {
    expect(planScaleChain(8)).toHaveLength(2);
    expect(planScaleChain(16).length).toBeLessThanOrEqual(3);
  });

  it('rejects invalid scales', () => {
    expect(() => planScaleChain(1)).toThrow();
    expect(() => planScaleChain(2.5)).toThrow();
    expect(() => planScaleChain(5)).toThrow();
  });
});
