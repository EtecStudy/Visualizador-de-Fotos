import { useEffect } from 'react';
import { useAppStore } from '../state/useAppStore';

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const state = useAppStore.getState();

      if (event.ctrlKey || event.metaKey) {
        switch (event.key.toLowerCase()) {
          case 'o':
            event.preventDefault();
            void state.openFromDialog();
            return;
          case 's':
            event.preventDefault();
            if (state.activeId) state.setSaveOpen(true);
            return;
          case 'z':
            event.preventDefault();
            if (event.shiftKey) state.redo();
            else state.undo();
            return;
          case 'y':
            event.preventDefault();
            state.redo();
            return;
          default:
            return;
        }
      }

      if (state.saveOpen || state.upscaleOpen || state.shortcutsOpen) return;
      if (event.altKey) return;

      const key = event.key;
      const lower = key.toLowerCase();

      if (lower === 'escape') {
        if (state.cropActive) state.endCrop();
        else if (state.compare) state.toggleCompare();
        else if (state.infoOpen) state.toggleInfo();
        else if (state.mode === 'edit') state.setMode('view');
        return;
      }

      if (key === 'ArrowRight') {
        event.preventDefault();
        state.stepPhoto(1);
        return;
      }
      if (key === 'ArrowLeft') {
        event.preventDefault();
        state.stepPhoto(-1);
        return;
      }

      switch (key) {
        case '+':
        case '=':
          state.zoomBy(1);
          return;
        case '-':
        case '_':
          state.zoomBy(-1);
          return;
        case '0':
          state.fitToScreen();
          return;
        case '1':
          state.actualSize();
          return;
        case 'Enter':
          if (state.cropActive) {
            event.preventDefault();
            state.applyCrop();
          }
          return;
        case 'Delete':
        case 'Backspace':
          if (state.activeId) {
            event.preventDefault();
            state.closePhoto(state.activeId);
          }
          return;
        case '?':
          event.preventDefault();
          state.setShortcutsOpen(true);
          return;
        default:
          break;
      }

      if (!state.activeId) return;

      switch (lower) {
        case 'f':
          void state.toggleFullscreen();
          break;
        case 'c':
          state.toggleCompare();
          break;
        case 'i':
          state.toggleInfo();
          break;
        case 'g':
          state.toggleGrid();
          break;
        case 'd':
          state.toggleLoupe();
          break;
        case 't':
          state.toggleFilmstrip();
          break;
        case 'e':
          state.setMode(state.mode === 'edit' ? 'view' : 'edit');
          break;
        case 'u':
          state.setUpscaleOpen(true);
          break;
        case 's':
          state.setSaveOpen(true);
          break;
        case 'r':
          state.rotate(event.shiftKey ? -90 : 90);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
