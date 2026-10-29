import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { AppHeader } from './components/AppHeader';
import { ViewerStage } from './components/ViewerStage';
import { Inspector } from './components/Inspector';
import { Filmstrip } from './components/Filmstrip';
import { InfoPanel } from './components/InfoPanel';
import { SaveDialog } from './components/SaveDialog';
import { UpscaleDialog } from './components/UpscaleDialog';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { Toast } from './components/Toast';
import { BusyOverlay } from './components/BusyOverlay';
import { useActivePhoto, useAppStore } from './state/useAppStore';
import { desktopBridge, type DesktopFileEntry } from './core/files/desktopFileService';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function App() {
  useKeyboardShortcuts();
  const mode = useAppStore((state) => state.mode);
  const photo = useActivePhoto();
  const infoOpen = useAppStore((state) => state.infoOpen);
  const busy = useAppStore((state) => state.busy);
  const openFiles = useAppStore((state) => state.openFiles);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const bridge = desktopBridge();

  // Native file associations, "open with", and application menu commands.
  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;

    const openEntries = (entries: DesktopFileEntry[]) => {
      if (!entries.length) return;
      void openFiles(
        entries.map((entry) => ({
          file: new File([entry.data], entry.name),
          path: entry.path,
        })),
      );
    };

    void bridge
      .getPendingFiles()
      .then((entries) => {
        if (!cancelled) openEntries(entries);
      })
      .catch(() => undefined);

    const offFiles = bridge.onFilesOpened((entries) => openEntries(entries));
    const offMenu = bridge.onMenuAction((channel) => {
      const state = useAppStore.getState();
      if (channel === 'menu:open') void state.openFromDialog();
      else if (channel === 'menu:save' && state.activeId) state.setSaveOpen(true);
      else if (channel === 'menu:undo') state.undo();
      else if (channel === 'menu:redo') state.redo();
      else if (channel === 'menu:shortcuts') state.setShortcutsOpen(true);
    });

    return () => {
      cancelled = true;
      offFiles();
      offMenu();
    };
  }, [bridge, openFiles]);

  useEffect(() => {
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files');

    const handleEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    };
    const handleOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const handleLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.length) return;
      const bridge = desktopBridge();
      void openFiles(files.map((file) => ({ file, path: bridge?.pathForFile(file) })));
    };

    window.addEventListener('dragenter', handleEnter);
    window.addEventListener('dragover', handleOver);
    window.addEventListener('dragleave', handleLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleEnter);
      window.removeEventListener('dragover', handleOver);
      window.removeEventListener('dragleave', handleLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [openFiles]);

  return (
    <div className="app">
      <AppHeader />

      <div className="app__body">
        <div className="workspace">
          <ViewerStage />
          {mode === 'edit' && photo ? <Inspector /> : null}
        </div>
        <Filmstrip />
      </div>

      {photo && infoOpen && <InfoPanel photo={photo} />}

      <SaveDialog />
      <UpscaleDialog />
      <ShortcutsDialog />
      <Toast />
      {busy && <BusyOverlay label={busy} />}

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay__card">
            <span className="drop-overlay__icon">
              <ImagePlus size={26} />
            </span>
            <strong>Solte para abrir</strong>
            <span>JPG · PNG · WEBP · GIF · BMP · AVIF</span>
          </div>
        </div>
      )}
    </div>
  );
}
