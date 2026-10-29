import { describe, expect, it } from 'vitest';
import {
  baseNameOf,
  detectFormat,
  extensionOf,
  formatBytes,
  isSupportedImage,
  saveFormatMeta,
} from './format';
import { buildExportName } from './export';

describe('image formats', () => {
  it('reads extensions and base names', () => {
    expect(extensionOf('foto.JPG')).toBe('jpg');
    expect(extensionOf('sem-extensao')).toBe('');
    expect(baseNameOf('C:\\fotos\\praia.webp')).toBe('praia');
    expect(baseNameOf('praia.jpeg')).toBe('praia');
  });

  it('detects formats by name and mime', () => {
    expect(detectFormat('a.jpg')).toBe('JPG');
    expect(detectFormat('a.jpeg')).toBe('JPG');
    expect(detectFormat('a.png')).toBe('PNG');
    expect(detectFormat('a.webp')).toBe('WEBP');
    expect(detectFormat('arquivo', 'image/png')).toBe('PNG');
    expect(detectFormat('arquivo', 'application/pdf')).toBe('UNKNOWN');
  });

  it('validates supported inputs', () => {
    expect(isSupportedImage({ name: 'foto.jpg' })).toBe(true);
    expect(isSupportedImage({ name: 'doc.pdf', type: 'application/pdf' })).toBe(false);
    expect(isSupportedImage({ name: 'sem-extensao', type: 'image/webp' })).toBe(true);
  });

  it('formats byte counts', () => {
    expect(formatBytes(0)).toBe('0 KB');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('exposes save metadata', () => {
    expect(saveFormatMeta('png')).toMatchObject({ extension: 'png', supportsQuality: false });
    expect(saveFormatMeta('jpeg')).toMatchObject({ mime: 'image/jpeg' });
  });

  it('builds timestamped export names without touching the original', () => {
    const name = buildExportName('praia.jpg', 'editada', 'jpg');
    expect(name.startsWith('praia-editada-')).toBe(true);
    expect(name.endsWith('.jpg')).toBe(true);
  });
});
