import type { FileService, OpenedFile, SaveResult } from '../types';

export interface DesktopFileEntry {
  path: string;
  name: string;
  data: ArrayBuffer;
}

export interface DesktopBridge {
  openImages(): Promise<DesktopFileEntry[]>;
  saveImage(payload: { data: ArrayBuffer; fileName: string }): Promise<SaveResult>;
  revealInFolder(path: string): Promise<void>;
  toggleFullscreen(): Promise<boolean>;
  getVersion(): Promise<string>;
  getPendingFiles(): Promise<DesktopFileEntry[]>;
  pathForFile(file: File): string | undefined;
  onFilesOpened(callback: (files: DesktopFileEntry[]) => void): () => void;
  onMenuAction(callback: (channel: string) => void): () => void;
}

declare global {
  interface Window {
    lumina?: DesktopBridge;
  }
}

export function desktopBridge(): DesktopBridge | undefined {
  return typeof window !== 'undefined' ? window.lumina : undefined;
}

/** File service backed by native Windows dialogs (Electron main process). */
export class DesktopFileService implements FileService {
  readonly kind = 'desktop' as const;
  readonly capabilities = {
    nativeOpenDialog: true,
    nativeSaveDialog: true,
    revealInFolder: true,
    windowControls: true,
  };

  constructor(private readonly bridge: DesktopBridge) {}

  async openImages(): Promise<OpenedFile[]> {
    const files = await this.bridge.openImages();
    return files.map((entry) => ({
      path: entry.path,
      file: new File([entry.data], entry.name, { type: mimeFromName(entry.name) }),
    }));
  }

  saveImage(blob: Blob, suggestedName: string): Promise<SaveResult> {
    return blob.arrayBuffer().then((data) => this.bridge.saveImage({ data, fileName: suggestedName }));
  }

  revealInFolder(path: string): Promise<void> {
    return this.bridge.revealInFolder(path);
  }

  toggleFullscreen(): Promise<boolean> {
    return this.bridge.toggleFullscreen();
  }

  getVersion(): Promise<string> {
    return this.bridge.getVersion();
  }

  pathForFile(file: File): string | undefined {
    return this.bridge.pathForFile(file);
  }
}

function mimeFromName(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    case 'avif':
      return 'image/avif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/jpeg';
  }
}
