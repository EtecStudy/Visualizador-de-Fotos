import { beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_EDIT, useAppStore } from './useAppStore';
import { createDefaultEdit } from '../core/editing/defaults';

const store = () => useAppStore.getState();
const editOf = (id = 'photo-1') => store().editsByPhoto[id] ?? EMPTY_EDIT;

describe('app store history', () => {
  beforeEach(() => {
    useAppStore.setState({
      photos: [],
      activeId: 'photo-1',
      editsByPhoto: { 'photo-1': createDefaultEdit() },
      past: [],
      future: [],
      lastCommit: null,
      cropActive: false,
      cropRect: { x: 0, y: 0, width: 1, height: 1 },
      cropAspectId: 'free',
      zoom: 1,
      pan: { x: 0, y: 0 },
      compare: false,
      mode: 'edit',
      toast: null,
    });
  });

  it('records adjustments and undoes them', () => {
    store().updateAdjustments({ brightness: 25 });
    expect(editOf().adjustments.brightness).toBe(25);
    expect(store().past).toHaveLength(1);

    store().undo();
    expect(editOf().adjustments.brightness).toBe(0);
    expect(store().future).toHaveLength(1);

    store().redo();
    expect(editOf().adjustments.brightness).toBe(25);
  });

  it('coalesces rapid slider changes into a single history entry', () => {
    store().updateAdjustments({ contrast: 10 }, 'contrast');
    store().updateAdjustments({ contrast: 20 }, 'contrast');
    store().updateAdjustments({ contrast: 30 }, 'contrast');
    expect(store().past).toHaveLength(1);
    expect(editOf().adjustments.contrast).toBe(30);

    store().endGesture();
    store().updateAdjustments({ contrast: 40 }, 'contrast');
    expect(store().past).toHaveLength(2);
  });

  it('does not create history for identical values', () => {
    store().updateAdjustments({ brightness: 0 });
    expect(store().past).toHaveLength(0);
    store().updateAdjustments({ grayscale: false });
    expect(store().past).toHaveLength(0);
  });

  it('rotates both ways and wraps around', () => {
    store().rotate(90);
    expect(editOf().rotation).toBe(90);
    store().rotate(-90);
    store().rotate(-90);
    expect(editOf().rotation).toBe(270);
    store().rotate(90);
    expect(editOf().rotation).toBe(0);
  });

  it('clamps the straighten angle', () => {
    store().setStraighten(200);
    expect(editOf().straighten).toBe(45);
    store().setStraighten(-200);
    expect(editOf().straighten).toBe(-45);
  });

  it('toggles grayscale and resets all edits', () => {
    store().toggleGrayscale();
    expect(editOf().adjustments.grayscale).toBe(true);
    store().resetAllEdits();
    expect(editOf()).toEqual(createDefaultEdit());
  });

  it('applies a crop only when the selection is smaller than the frame', () => {
    useAppStore.setState({ cropRect: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }, cropActive: true });
    store().applyCrop();
    expect(editOf().crop).toEqual({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 });
    expect(store().cropActive).toBe(false);

    useAppStore.setState({ cropRect: { x: 0, y: 0, width: 1, height: 1 }, cropActive: true });
    store().applyCrop();
    expect(editOf().crop).toBeNull();
  });

  it('keeps per-photo edits when switching the active photo', () => {
    store().updateAdjustments({ saturation: 40 });
    useAppStore.setState({ activeId: 'photo-2', editsByPhoto: { ...store().editsByPhoto, 'photo-2': createDefaultEdit() } });
    expect(editOf('photo-2').adjustments.saturation).toBe(0);
    expect(editOf('photo-1').adjustments.saturation).toBe(40);
    useAppStore.setState({ activeId: 'photo-1' });
    expect(editOf().adjustments.saturation).toBe(40);
  });

  it('limits zoom and resets the view when fitting', () => {
    store().setView({ zoom: 99 });
    expect(store().zoom).toBeLessThanOrEqual(16);
    store().fitToScreen();
    expect(store().zoom).toBe(1);
    expect(store().pan).toEqual({ x: 0, y: 0 });
  });

  it('computes 100% zoom from the fit scale', () => {
    useAppStore.setState({ fitScale: 0.5 });
    store().actualSize();
    expect(store().zoom).toBeCloseTo(2);
  });
});
