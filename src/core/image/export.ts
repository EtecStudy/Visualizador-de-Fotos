import type { EditState, PhotoAsset, SaveOptions } from '../types';
import { canvasToBlob } from './canvas';
import { baseNameOf, saveFormatMeta } from './format';
import { renderPhotoForExport } from '../render/photoRenderer';

const timestamp = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
};

export function buildExportName(sourceName: string, suffix: string, extension: string): string {
  const base = baseNameOf(sourceName) || 'imagem';
  return `${base}-${suffix}-${timestamp()}.${extension}`;
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
  mime: string;
}

export async function exportPhoto(asset: PhotoAsset, edit: EditState, options: SaveOptions): Promise<ExportResult> {
  const rendered = renderPhotoForExport(asset, edit);
  const { canvas, outputSize } = rendered;
  const format = saveFormatMeta(options.format);
  const blob = await canvasToBlob(canvas, format.mime, format.supportsQuality ? options.quality / 100 : undefined);
  const fileName = options.fileName.endsWith(`.${format.extension}`)
    ? options.fileName
    : `${baseNameOf(options.fileName)}.${format.extension}`;

  // Release the huge export canvas as soon as possible.
  canvas.width = 1;
  canvas.height = 1;

  return { blob, fileName, width: outputSize.width, height: outputSize.height, mime: format.mime };
}

export function defaultSaveName(asset: PhotoAsset, format: 'jpeg' | 'png' | 'webp', suffix = 'editada'): string {
  const extension = saveFormatMeta(format).extension;
  return buildExportName(asset.name, suffix, extension);
}
