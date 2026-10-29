import type { FileService, OpenedFile, SaveResult } from '../types';

/** File service for the web build: <input type=file> + download links. */
export class BrowserFileService implements FileService {
  readonly kind = 'browser' as const;
  readonly capabilities = {
    nativeOpenDialog: false,
    nativeSaveDialog: false,
    revealInFolder: false,
    windowControls: false,
  };

  openImages(): Promise<OpenedFile[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif,image/svg+xml';
      input.style.display = 'none';
      document.body.appendChild(input);

      let settled = false;
      const finish = (files: File[]) => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(files.map((file) => ({ file })));
      };

      input.addEventListener('change', () => {
        finish(Array.from(input.files ?? []));
      });
      // Chrome fires `cancel` when the picker is dismissed.
      input.addEventListener('cancel', () => finish([]));
      window.addEventListener(
        'focus',
        () => {
          setTimeout(() => finish(Array.from(input.files ?? [])), 800);
        },
        { once: true },
      );

      input.click();
    });
  }

  async saveImage(blob: Blob, suggestedName: string): Promise<SaveResult> {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { saved: true, fileName: suggestedName };
  }

  async revealInFolder(): Promise<void> {
    /* not available in the browser */
  }

  async toggleFullscreen(): Promise<boolean> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return false;
    }
    await document.documentElement.requestFullscreen();
    return true;
  }

  async getVersion(): Promise<string> {
    return 'web';
  }
}
