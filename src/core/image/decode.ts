import type { PhotoAsset } from '../types';
import { detectFormat, mimeForFormat } from './format';
import { createCanvas, get2DContext, loadImageElement } from './canvas';

let assetCounter = 0;

function nextId(): string {
  assetCounter += 1;
  return `photo-${Date.now().toString(36)}-${assetCounter.toString(36)}`;
}

/**
 * Decodes a blob into an ImageBitmap, honouring EXIF orientation so phone
 * photos are shown upright from the very first frame.
 */
export async function decodeImageBlob(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    // Fallback for formats/engines where createImageBitmap fails (some SVGs,
    // older Electron builds): decode through an <img> element + canvas.
    const url = URL.createObjectURL(blob);
    try {
      const image = await loadImageElement(url);
      const canvas = createCanvas(image.naturalWidth, image.naturalHeight);
      get2DContext(canvas).drawImage(image, 0, 0);
      return await createImageBitmap(canvas);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export interface CreateAssetOptions {
  name?: string;
  path?: string;
  origin?: PhotoAsset['origin'];
  mime?: string;
}

export async function createPhotoAsset(blob: Blob, options: CreateAssetOptions = {}): Promise<PhotoAsset> {
  const bitmap = await decodeImageBlob(blob);
  const name = options.name ?? `imagem-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
  const mime = options.mime || blob.type || mimeForFormat(detectFormat(name));
  const format = detectFormat(name, mime);
  return {
    id: nextId(),
    name,
    path: options.path,
    mime,
    format,
    width: bitmap.width,
    height: bitmap.height,
    sizeBytes: blob.size,
    url: URL.createObjectURL(blob),
    blob,
    bitmap,
    createdAt: Date.now(),
    origin: options.origin ?? 'file',
  };
}

export async function loadPhotoFromFile(file: File, path?: string): Promise<PhotoAsset> {
  return createPhotoAsset(file, { name: file.name, path, origin: 'file' });
}

export function disposeAsset(asset: PhotoAsset): void {
  URL.revokeObjectURL(asset.url);
  asset.bitmap.close();
}
