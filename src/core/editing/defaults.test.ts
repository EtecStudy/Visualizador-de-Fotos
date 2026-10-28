import { describe, expect, it } from 'vitest';
import {
  createDefaultEdit,
  describeEdit,
  editsEqual,
  hasAdjustments,
  isEditDirty,
  normalizeAdjustments,
  normalizeEdit,
} from './defaults';

describe('edit defaults', () => {
  it('starts clean', () => {
    const edit = createDefaultEdit();
    expect(isEditDirty(edit)).toBe(false);
    expect(hasAdjustments(edit.adjustments)).toBe(false);
    expect(describeEdit(edit)).toBe('imagem original');
  });

  it('clamps adjustment values', () => {
    const adjustments = normalizeAdjustments({
      brightness: 500,
      contrast: -500,
      saturation: Number.NaN,
      sharpness: 900,
      grayscale: 1 as unknown as boolean,
    });
    expect(adjustments.brightness).toBe(100);
    expect(adjustments.contrast).toBe(-100);
    expect(adjustments.saturation).toBe(0);
    expect(adjustments.sharpness).toBe(100);
    expect(adjustments.grayscale).toBe(true);
  });

  it('normalizes rotation and straighten', () => {
    const edit = normalizeEdit({
      rotation: 450 as 90,
      straighten: 90,
      crop: { x: 0.5, y: 0.5, width: 0.8, height: 0.8 },
      adjustments: normalizeAdjustments({}),
    });
    expect(edit.rotation).toBe(90);
    expect(edit.straighten).toBe(45);
    expect(edit.crop).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
  });

  it('compares edits deeply', () => {
    const a = createDefaultEdit();
    const b = createDefaultEdit();
    expect(editsEqual(a, b)).toBe(true);
    b.adjustments.brightness = 10;
    expect(editsEqual(a, b)).toBe(false);
    expect(editsEqual(a, createDefaultEdit())).toBe(true);
  });

  it('reports dirty flags', () => {
    const edit = createDefaultEdit();
    edit.adjustments.grayscale = true;
    expect(isEditDirty(edit)).toBe(true);
    expect(describeEdit(edit)).toContain('preto e branco');
  });
});
