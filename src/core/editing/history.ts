/**
 * Generic linear undo/redo history. Framework agnostic and easy to unit test.
 */
export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export const DEFAULT_HISTORY_LIMIT = 80;

export function createHistory<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [] };
}

/** Records a new state, discarding the redo stack. */
export function pushHistory<T>(
  history: HistoryState<T>,
  next: T,
  equals: (a: T, b: T) => boolean = Object.is,
  limit = DEFAULT_HISTORY_LIMIT,
): HistoryState<T> {
  if (equals(history.present, next)) return history;
  const past = [...history.past, history.present];
  const trimmed = past.length > limit ? past.slice(past.length - limit) : past;
  return { past: trimmed, present: next, future: [] };
}

/** Replaces the present without touching the past (used for live drags/sliders). */
export function replacePresent<T>(history: HistoryState<T>, next: T): HistoryState<T> {
  return { ...history, present: next };
}

export function undo<T>(history: HistoryState<T>): HistoryState<T> {
  if (!history.past.length) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: HistoryState<T>): HistoryState<T> {
  if (!history.future.length) return history;
  const [next, ...rest] = history.future;
  return { past: [...history.past, history.present], present: next, future: rest };
}

export function canUndo<T>(history: HistoryState<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: HistoryState<T>): boolean {
  return history.future.length > 0;
}
