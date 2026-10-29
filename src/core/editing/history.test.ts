import { describe, expect, it } from 'vitest';
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redo,
  replacePresent,
  undo,
} from './history';

const equals = (a: { value: number }, b: { value: number }) => a.value === b.value;

describe('history', () => {
  it('pushes states and keeps the past', () => {
    let history = createHistory({ value: 0 });
    history = pushHistory(history, { value: 1 }, equals);
    history = pushHistory(history, { value: 2 }, equals);
    expect(history.present.value).toBe(2);
    expect(history.past.map((entry) => entry.value)).toEqual([0, 1]);
    expect(canUndo(history)).toBe(true);
    expect(canRedo(history)).toBe(false);
  });

  it('ignores identical states', () => {
    const initial = createHistory({ value: 1 });
    const next = pushHistory(initial, { value: 1 }, equals);
    expect(next).toBe(initial);
  });

  it('undoes and redoes', () => {
    let history = createHistory({ value: 0 });
    history = pushHistory(history, { value: 1 }, equals);
    history = undo(history);
    expect(history.present.value).toBe(0);
    expect(canRedo(history)).toBe(true);
    history = redo(history);
    expect(history.present.value).toBe(1);
  });

  it('drops the future when a new state is pushed', () => {
    let history = createHistory({ value: 0 });
    history = pushHistory(history, { value: 1 }, equals);
    history = undo(history);
    history = pushHistory(history, { value: 5 }, equals);
    expect(canRedo(history)).toBe(false);
    expect(history.past.map((entry) => entry.value)).toEqual([0]);
  });

  it('replaces the present without creating history entries', () => {
    let history = createHistory({ value: 0 });
    history = pushHistory(history, { value: 1 }, equals);
    history = replacePresent(history, { value: 2 });
    expect(history.past).toHaveLength(1);
    expect(history.present.value).toBe(2);
  });

  it('limits the amount of undo steps', () => {
    let history = createHistory({ value: 0 });
    for (let index = 1; index <= 10; index += 1) {
      history = pushHistory(history, { value: index }, equals, 5);
    }
    expect(history.past).toHaveLength(5);
    expect(history.past[0].value).toBe(5);
  });

  it('does nothing when undo/redo is not possible', () => {
    const history = createHistory({ value: 0 });
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });
});
