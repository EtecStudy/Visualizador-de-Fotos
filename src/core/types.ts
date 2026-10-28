/** Shared domain types for Lumina. No DOM/React dependency in the pure helpers. */

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Rectangle in pixels. */
export interface Rect extends Point, Size {}

/** Rectangle in 0..1 coordinates relative to the image bounds. */
export interface NormalizedRect extends Rect {}

export type ImageFormat = 'JPG' | 'PNG' | 'WEBP' | 'GIF' | 'BMP' | 'AVIF' | 'SVG' | 'TIFF' | 'UNKNOWN';

export type Rotation = 0 | 90 | 180 | 270;

export interface ColorAdjustments {
  /** -100..100 */
  brightness: number;
  /** -100..100 */
  contrast: number;
  /** -100..100 */
  saturation: number;
  /** 0..100 */
  sharpness: number;
  grayscale: boolean;
}

/**
 * The full, serialisable edit description. Rendering is always derived from
 * the original bitmap + this state, which makes undo/redo and exporting
 * deterministic and non-destructive.
 */
export interface EditState {
  rotation: Rotation;
  /** Straighten angle in degrees, -45..45. */
  straighten: number;
  /** Applied crop, normalized against the rotated bounds. */
  crop: NormalizedRect | null;
  adjustments: ColorAdjustments;
}

/** A photo known to the library. */
export interface PhotoAsset {
  id: string;
  name: string;
  /** Absolute path on disk when opened through the desktop shell. */
  path?: string;
  mime: string;
  format: ImageFormat;
  width: number;
  height: number;
  sizeBytes: number;
  /** Object URL for the original blob (shown as "original"). */
  url: string;
  blob: Blob;
  bitmap: ImageBitmap;
  createdAt: number;
  /** Marks assets produced by the editor/upscaler instead of opened from disk. */
  origin: 'file' | 'edit' | 'upscale';
}

export interface SaveOptions {
  format: 'jpeg' | 'png' | 'webp';
  quality: number;
  fileName: string;
}

export interface SaveResult {
  saved: boolean;
  fileName?: string;
  path?: string;
  error?: string;
}

export interface OpenedFile {
  file: File;
  path?: string;
}

export interface FileService {
  readonly kind: 'desktop' | 'browser';
  readonly capabilities: {
    nativeOpenDialog: boolean;
    nativeSaveDialog: boolean;
    revealInFolder: boolean;
    windowControls: boolean;
  };
  openImages(): Promise<OpenedFile[]>;
  saveImage(blob: Blob, suggestedName: string, mime?: string): Promise<SaveResult>;
  revealInFolder(path: string): Promise<void>;
  toggleFullscreen(): Promise<boolean>;
  getVersion(): Promise<string>;
}
