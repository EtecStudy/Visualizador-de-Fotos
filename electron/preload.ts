import { contextBridge, ipcRenderer, webUtils } from 'electron';

type FileEntry = { path: string; name: string; data: ArrayBuffer };

const bridge = {
  openImages: (): Promise<FileEntry[]> => ipcRenderer.invoke('dialog:openImages'),
  saveImage: (payload: { data: ArrayBuffer; fileName: string }) => ipcRenderer.invoke('file:saveImage', payload),
  revealInFolder: (target: string) => ipcRenderer.invoke('shell:reveal', target),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPendingFiles: (): Promise<FileEntry[]> => ipcRenderer.invoke('files:pending'),
  pathForFile: (file: File): string | undefined => {
    try {
      return webUtils.getPathForFile(file) || undefined;
    } catch {
      return undefined;
    }
  },
  onFilesOpened: (callback: (files: FileEntry[]) => void) => {
    const listener = (_event: unknown, files: FileEntry[]) => callback(files);
    ipcRenderer.on('files:opened', listener);
    return () => ipcRenderer.removeListener('files:opened', listener);
  },
  onMenuAction: (callback: (action: string) => void) => {
    const channels = ['menu:open', 'menu:save', 'menu:undo', 'menu:redo', 'menu:shortcuts'];
    const listeners = channels.map((channel) => {
      const listener = () => callback(channel);
      ipcRenderer.on(channel, listener);
      return { channel, listener };
    });
    return () => {
      for (const { channel, listener } of listeners) {
        ipcRenderer.removeListener(channel, listener);
      }
    };
  },
};

contextBridge.exposeInMainWorld('lumina', bridge);
