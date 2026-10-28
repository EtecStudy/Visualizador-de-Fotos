import type { ImageFormat } from '../types';

const MIME_BY_FORMAT: Record<Exclude<ImageFormat, 'UNKNOWN'>, string> = {
  JPG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
  GIF: 'image/gif',
  BMP: 'image/bmp',
  AVIF: 'image/avif',
  SVG: 'image/svg+xml',
  TIFF: 'image/tiff',
};

export const SUPPORTED_INPUT_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'avif',
  'svg',
] as const;

export const SUPPORTED_INPUT_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif',
  'image/svg+xml',
];

export function extensionOf(fileName: string): string {
  const clean = fileName.split(/[?#]/)[0];
  const index = clean.lastIndexOf('.');
  if (index <= 0 || index === clean.length - 1) return '';
  return clean.slice(index + 1).toLowerCase();
}

export function baseNameOf(fileName: string): string {
  const clean = fileName.replace(/\\/g, '/').split('/').pop() ?? fileName;
  const index = clean.lastIndexOf('.');
  return index > 0 ? clean.slice(0, index) : clean;
}

export function detectFormat(fileName: string, mime?: string): ImageFormat {
  const ext = extensionOf(fileName);
  if (ext === 'jpg' || ext === 'jpeg') return 'JPG';
  if (ext === 'png') return 'PNG';
  if (ext === 'webp') return 'WEBP';
  if (ext === 'gif') return 'GIF';
  if (ext === 'bmp') return 'BMP';
  if (ext === 'avif') return 'AVIF';
  if (ext === 'svg') return 'SVG';
  if (ext === 'tif' || ext === 'tiff') return 'TIFF';

  switch (mime) {
    case 'image/jpeg':
      return 'JPG';
    case 'image/png':
      return 'PNG';
    case 'image/webp':
      return 'WEBP';
    case 'image/gif':
      return 'GIF';
    case 'image/bmp':
      return 'BMP';
    case 'image/avif':
      return 'AVIF';
    case 'image/svg+xml':
      return 'SVG';
    case 'image/tiff':
      return 'TIFF';
    default:
      return 'UNKNOWN';
  }
}

export function mimeForFormat(format: ImageFormat): string {
  if (format === 'UNKNOWN') return 'application/octet-stream';
  return MIME_BY_FORMAT[format];
}

export function formatLabel(format: ImageFormat): string {
  if (format === 'JPG') return 'JPEG';
  return format;
}

export function isSupportedImage(file: { name: string; type?: string }): boolean {
  const ext = extensionOf(file.name);
  if ((SUPPORTED_INPUT_EXTENSIONS as readonly string[]).includes(ext)) return true;
  return !!file.type && SUPPORTED_INPUT_MIME.includes(file.type);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export const SAVE_FORMATS = [
  { id: 'jpeg', label: 'JPEG', extension: 'jpg', mime: 'image/jpeg', supportsQuality: true },
  { id: 'png', label: 'PNG', extension: 'png', mime: 'image/png', supportsQuality: false },
  { id: 'webp', label: 'WEBP', extension: 'webp', mime: 'image/webp', supportsQuality: true },
] as const;

export type SaveFormatId = (typeof SAVE_FORMATS)[number]['id'];

export function saveFormatMeta(id: SaveFormatId) {
  return SAVE_FORMATS.find((format) => format.id === id) ?? SAVE_FORMATS[0];
}
