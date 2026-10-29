import type { ColorAdjustments, EditState } from '../types';
import { clamp, MAX_STRAIGHTEN, MIN_STRAIGHTEN, normalizedRotation } from './geometry';

/** Shared, read-only defaults so the UI never mutates module constants. */
export const DEFAULT_ADJUSTMENTS: ColorAdjustments = Object.freeze({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  grayscale: false,
}) as ColorAdjustments;

export function createDefaultEdit(): EditState {
  return {
    rotation: 0,
    straighten: 0,
    crop: null,
    adjustments: { ...DEFAULT_ADJUSTMENTS },
  };
}

export function hasAdjustments(adjustments: ColorAdjustments): boolean {
  return (
    adjustments.brightness !== 0 ||
    adjustments.contrast !== 0 ||
    adjustments.saturation !== 0 ||
    adjustments.sharpness !== 0 ||
    adjustments.grayscale
  );
}

export function isEditDirty(edit: EditState): boolean {
  return (
    edit.rotation !== 0 ||
    edit.straighten !== 0 ||
    edit.crop !== null ||
    hasAdjustments(edit.adjustments)
  );
}

export function normalizeAdjustments(input: Partial<ColorAdjustments>, base = DEFAULT_ADJUSTMENTS): ColorAdjustments {
  const merged = { ...base, ...input };
  return {
    brightness: clamp(round(merged.brightness), -100, 100),
    contrast: clamp(round(merged.contrast), -100, 100),
    saturation: clamp(round(merged.saturation), -100, 100),
    sharpness: clamp(round(merged.sharpness), 0, 100),
    grayscale: Boolean(merged.grayscale),
  };
}

export function normalizeEdit(edit: EditState): EditState {
  return {
    rotation: normalizedRotation(edit.rotation),
    straighten: clamp(round(edit.straighten * 10) / 10, MIN_STRAIGHTEN, MAX_STRAIGHTEN),
    crop: edit.crop ? clampCrop(edit.crop) : null,
    adjustments: normalizeAdjustments(edit.adjustments),
  };
}

function clampCrop(crop: NonNullable<EditState['crop']>): NonNullable<EditState['crop']> {
  const x = clamp(crop.x, 0, 0.999);
  const y = clamp(crop.y, 0, 0.999);
  return {
    x,
    y,
    width: clamp(crop.width, 0.001, 1 - x),
    height: clamp(crop.height, 0.001, 1 - y),
  };
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function editsEqual(a: EditState, b: EditState): boolean {
  if (a === b) return true;
  return (
    a.rotation === b.rotation &&
    a.straighten === b.straighten &&
    a.adjustments.brightness === b.adjustments.brightness &&
    a.adjustments.contrast === b.adjustments.contrast &&
    a.adjustments.saturation === b.adjustments.saturation &&
    a.adjustments.sharpness === b.adjustments.sharpness &&
    a.adjustments.grayscale === b.adjustments.grayscale &&
    cropEquals(a.crop, b.crop)
  );
}

function cropEquals(a: EditState['crop'], b: EditState['crop']): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    nearlyEqual(a.x, b.x) &&
    nearlyEqual(a.y, b.y) &&
    nearlyEqual(a.width, b.width) &&
    nearlyEqual(a.height, b.height)
  );
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

/** Human readable "DESFAZER ..." labels could rely on this later. */
export function describeEdit(edit: EditState): string {
  const parts: string[] = [];
  if (edit.rotation) parts.push(`rotação ${edit.rotation}°`);
  if (edit.straighten) parts.push(`endireitar ${edit.straighten}°`);
  if (edit.crop) parts.push('recorte');
  if (edit.adjustments.grayscale) parts.push('preto e branco');
  if (edit.adjustments.brightness) parts.push('brilho');
  if (edit.adjustments.contrast) parts.push('contraste');
  if (edit.adjustments.saturation) parts.push('saturação');
  if (edit.adjustments.sharpness) parts.push('nitidez');
  return parts.length ? parts.join(', ') : 'imagem original';
}
