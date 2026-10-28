import { create } from 'zustand';
import type {
  ColorAdjustments,
  EditState,
  NormalizedRect,
  OpenedFile,
  PhotoAsset,
  Point,
  Size,
} from '../core/types';
import {
  DEFAULT_HISTORY_LIMIT,
  pushHistory,
} from '../core/editing/history';
import {
  createDefaultEdit,
  editsEqual,
  normalizeEdit,
  normalizeAdjustments,
} from '../core/editing/defaults';
import { editBounds, nextZoom, clamp } from '../core/editing/geometry';
import {
  applyAspectToRect,
  ASPECT_PRESETS,
  centeredRect,
  fullCrop,
  isFullCrop,
} from '../core/editing/crop';
import { createPhotoAsset, disposeAsset, loadPhotoFromFile } from '../core/image/decode';
import { isSupportedImage } from '../core/image/format';
import { getFileService } from '../core/files';
import { MAX_ZOOM, MIN_ZOOM } from '../core/viewer/viewTransform';
import type { UpscaleEngineId } from '../core/upscale/types';

export const EMPTY_EDIT: EditState = Object.freeze(createDefaultEdit()) as EditState;
const ZERO_POINT: Point = Object.freeze({ x: 0, y: 0 }) as Point;
const ORIGIN: Size = Object.freeze({ width: 0, height: 0 }) as Size;

export type EditorMode = 'view' | 'edit';
export type ToolTab = 'adjust' | 'transform' | 'crop';
export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface AppState {
  // library
  photos: PhotoAsset[];
  activeId: string | null;
  editsByPhoto: Record<string, EditState>;
  // editor
  mode: EditorMode;
  past: EditState[];
  future: EditState[];
  lastCommit: { key: string; at: number } | null;
  cropActive: boolean;
  cropRect: NormalizedRect;
  cropAspectId: string;
  compare: boolean;
  toolTab: ToolTab;
  // viewer
  zoom: number;
  pan: Point;
  stage: Size;
  fitScale: number;
  gridVisible: boolean;
  infoOpen: boolean;
  filmstripOpen: boolean;
  loupeVisible: boolean;
  isFullscreen: boolean;
  // dialogs
  saveOpen: boolean;
  upscaleOpen: boolean;
  shortcutsOpen: boolean;
  busy: string | null;
  toast: Toast | null;
  // upscale preferences
  upscaleScale: number;
  upscaleEngine: UpscaleEngineId;
  upscalePatchSize: number;

  // library actions
  openFiles: (entries: OpenedFile[]) => Promise<void>;
  openFromDialog: () => Promise<void>;
  addFromFiles: (files: File[]) => Promise<void>;
  registerAsset: (asset: PhotoAsset, options?: { select?: boolean }) => void;
  addGeneratedBlob: (blob: Blob, name: string, origin: PhotoAsset['origin']) => Promise<PhotoAsset | null>;
  setActive: (id: string) => void;
  closePhoto: (id: string) => void;
  stepPhoto: (direction: 1 | -1) => void;

  // editing actions
  setMode: (mode: EditorMode) => void;
  setToolTab: (tab: ToolTab) => void;
  setEdit: (next: EditState, key?: string) => void;
  updateAdjustments: (patch: Partial<ColorAdjustments>, key?: string) => void;
  endGesture: () => void;
  rotate: (delta: 90 | -90) => void;
  setStraighten: (value: number, key?: string) => void;
  toggleGrayscale: () => void;
  resetAdjustments: () => void;
  resetAllEdits: () => void;
  undo: () => void;
  redo: () => void;

  // crop
  beginCrop: () => void;
  endCrop: () => void;
  setCropRect: (rect: NormalizedRect) => void;
  setCropAspect: (presetId: string) => void;
  applyCrop: () => void;

  // viewer actions
  setView: (view: { zoom?: number; pan?: Point }) => void;
  zoomBy: (direction: 1 | -1) => void;
  fitToScreen: () => void;
  actualSize: () => void;
  setStageMetrics: (stage: Size, fitScale: number) => void;
  toggleCompare: () => void;
  toggleGrid: () => void;
  toggleInfo: () => void;
  toggleFilmstrip: () => void;
  toggleLoupe: () => void;
  toggleFullscreen: () => Promise<void>;

  // dialogs & feedback
  setSaveOpen: (open: boolean) => void;
  setUpscaleOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setUpscaleSettings: (settings: { scale?: number; engineId?: UpscaleEngineId; patchSize?: number }) => void;
  notify: (message: string, tone?: ToastTone) => void;
  dismissToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
let toastCounter = 0;

export function activeEdit(state: Pick<AppState, 'activeId' | 'editsByPhoto'>): EditState {
  if (!state.activeId) return EMPTY_EDIT;
  return state.editsByPhoto[state.activeId] ?? EMPTY_EDIT;
}

export function activePhoto(state: Pick<AppState, 'activeId' | 'photos'>): PhotoAsset | null {
  if (!state.activeId) return null;
  return state.photos.find((photo) => photo.id === state.activeId) ?? null;
}

export function findAspectPreset(id: string) {
  return ASPECT_PRESETS.find((preset) => preset.id === id) ?? ASPECT_PRESETS[0];
}

export const useAppStore = create<AppState>((set, get) => {
  /** Applies an edit to the active photo, recording history. */
  const applyEdit = (next: EditState, key?: string) => {
    const state = get();
    if (!state.activeId) return;
    const previous = state.editsByPhoto[state.activeId] ?? EMPTY_EDIT;
    const normalized = normalizeEdit(next);
    if (editsEqual(previous, normalized)) return;

    const now = Date.now();
    const shouldCoalesce =
      Boolean(key) &&
      state.lastCommit?.key === key &&
      now - state.lastCommit!.at < 800 &&
      state.future.length === 0;

    const history = shouldCoalesce
      ? { past: state.past, next: normalized, future: state.future }
      : pushHistory(
          { past: state.past, present: previous, future: state.future },
          normalized,
          editsEqual,
          DEFAULT_HISTORY_LIMIT,
        );

    set({
      editsByPhoto: { ...state.editsByPhoto, [state.activeId]: normalized },
      past: history.past,
      future: history.future,
      lastCommit: key ? { key, at: now } : null,
    });
  };

  const resetViewer = () => set({ zoom: 1, pan: ZERO_POINT, compare: false });

  return {
    photos: [],
    activeId: null,
    editsByPhoto: {},
    mode: 'view',
    past: [],
    future: [],
    lastCommit: null,
    cropActive: false,
    cropRect: fullCrop(),
    cropAspectId: 'free',
    compare: false,
    toolTab: 'adjust',
    zoom: 1,
    pan: ZERO_POINT,
    stage: ORIGIN,
    fitScale: 1,
    gridVisible: false,
    infoOpen: false,
    filmstripOpen: true,
    loupeVisible: false,
    isFullscreen: false,
    saveOpen: false,
    upscaleOpen: false,
    shortcutsOpen: false,
    busy: null,
    toast: null,
    upscaleScale: 2,
    upscaleEngine: 'esrgan',
    upscalePatchSize: 128,

    openFiles: async (entries) => {
      const supported = entries.filter((entry) => isSupportedImage(entry.file));
      if (!supported.length) {
        get().notify('Nenhum formato suportado encontrado. Use JPG, PNG, WEBP, GIF, BMP ou AVIF.', 'warning');
        return;
      }
      set({ busy: `Abrindo ${supported.length === 1 ? 'imagem' : `${supported.length} imagens`}…` });
      const assets: PhotoAsset[] = [];
      const failed: string[] = [];

      for (const entry of supported) {
        try {
          assets.push(await loadPhotoFromFile(entry.file, entry.path));
        } catch {
          failed.push(entry.file.name);
        }
      }

      if (!assets.length) {
        set({ busy: null });
        get().notify('Não foi possível abrir as imagens selecionadas.', 'error');
        return;
      }

      set((state) => ({
        photos: [...state.photos, ...assets],
        activeId: assets[0].id,
        busy: null,
        mode: 'view',
        past: [],
        future: [],
        cropActive: false,
        compare: false,
        toolTab: 'adjust',
        zoom: 1,
        pan: ZERO_POINT,
        lastCommit: null,
      }));

      if (failed.length) {
        get().notify(`${failed.length} arquivo(s) não puderam ser abertos.`, 'warning');
      } else {
        get().notify(
          assets.length === 1 ? `“${assets[0].name}” aberto` : `${assets.length} imagens abertas`,
          'success',
        );
      }
    },

    openFromDialog: async () => {
      try {
        const entries = await getFileService().openImages();
        if (entries.length) await get().openFiles(entries);
      } catch (error) {
        get().notify(error instanceof Error ? error.message : 'Falha ao abrir o seletor de arquivos.', 'error');
      }
    },

    addFromFiles: async (files) => {
      await get().openFiles(files.map((file) => ({ file })));
    },

    registerAsset: (asset, options) => {
      set((state) => ({
        photos: [...state.photos, asset],
        activeId: options?.select ? asset.id : state.activeId,
        ...(options?.select
          ? { mode: 'view' as EditorMode, zoom: 1, pan: ZERO_POINT, past: [], future: [], compare: false }
          : {}),
      }));
    },

    addGeneratedBlob: async (blob, name, origin) => {
      try {
        const asset = await createPhotoAsset(blob, { name, origin });
        get().registerAsset(asset);
        return asset;
      } catch (error) {
        get().notify(error instanceof Error ? error.message : 'Falha ao adicionar a imagem.', 'error');
        return null;
      }
    },

    setActive: (id) => {
      if (get().activeId === id) return;
      set({
        activeId: id,
        cropActive: false,
        compare: false,
        past: [],
        future: [],
        lastCommit: null,
        zoom: 1,
        pan: ZERO_POINT,
        toolTab: get().mode === 'edit' ? 'adjust' : get().toolTab,
      });
    },

    closePhoto: (id) => {
      const state = get();
      const index = state.photos.findIndex((photo) => photo.id === id);
      if (index < 0) return;
      const asset = state.photos[index];
      const remaining = state.photos.filter((photo) => photo.id !== id);
      const wasActive = state.activeId === id;
      const nextActive = wasActive
        ? remaining[Math.min(index, remaining.length - 1)]?.id ?? null
        : state.activeId;
      const edits = { ...state.editsByPhoto };
      delete edits[id];

      set({
        photos: remaining,
        editsByPhoto: edits,
        activeId: nextActive,
        ...(wasActive
          ? {
              mode: 'view' as EditorMode,
              zoom: 1,
              pan: ZERO_POINT,
              past: [],
              future: [],
              cropActive: false,
              compare: false,
            }
          : {}),
      });

      // Give React one frame to unmount the preview before freeing the bitmap.
      setTimeout(() => disposeAsset(asset), 400);
    },

    stepPhoto: (direction) => {
      const state = get();
      if (state.photos.length < 2) return;
      const index = state.photos.findIndex((photo) => photo.id === state.activeId);
      const nextIndex = (index + direction + state.photos.length) % state.photos.length;
      state.setActive(state.photos[nextIndex].id);
    },

    setMode: (mode) => {
      if (mode === 'view') {
        set({ mode, cropActive: false, compare: false });
      } else {
        set({ mode, toolTab: 'adjust' });
      }
    },

    setToolTab: (tab) => {
      if (tab === 'crop') {
        get().beginCrop();
        return;
      }
      set({ toolTab: tab, cropActive: false, mode: 'edit' });
    },

    setEdit: (next, key) => applyEdit(next, key),

    updateAdjustments: (patch, key) => {
      const current = activeEdit(get());
      // Sharpness is the only adjustment that benefits from a 1:1 preview.
      if (key === 'sharpness' && !get().loupeVisible) set({ loupeVisible: true });
      applyEdit({ ...current, adjustments: normalizeAdjustments(patch, current.adjustments) }, key);
    },

    endGesture: () => set({ lastCommit: null }),

    rotate: (delta) => {
      const current = activeEdit(get());
      const rotation = (((current.rotation + delta) % 360) + 360) % 360;
      applyEdit({ ...current, rotation: rotation as EditState['rotation'] });
      resetViewer();
    },

    setStraighten: (value, key) => {
      const current = activeEdit(get());
      applyEdit({ ...current, straighten: clamp(value, -45, 45) }, key);
    },

    toggleGrayscale: () => {
      const current = activeEdit(get());
      applyEdit({
        ...current,
        adjustments: { ...current.adjustments, grayscale: !current.adjustments.grayscale },
      });
    },

    resetAdjustments: () => {
      const current = activeEdit(get());
      applyEdit({ ...current, adjustments: normalizeAdjustments({}) });
    },

    resetAllEdits: () => {
      applyEdit(createDefaultEdit());
      get().endGesture();
    },

    undo: () => {
      const state = get();
      if (!state.activeId || !state.past.length) return;
      const previous = state.past[state.past.length - 1];
      const present = activeEdit(state);
      set({
        editsByPhoto: { ...state.editsByPhoto, [state.activeId]: previous },
        past: state.past.slice(0, -1),
        future: [present, ...state.future].slice(0, DEFAULT_HISTORY_LIMIT),
        lastCommit: null,
        cropActive: false,
      });
    },

    redo: () => {
      const state = get();
      if (!state.activeId || !state.future.length) return;
      const [next, ...rest] = state.future;
      const present = activeEdit(state);
      set({
        editsByPhoto: { ...state.editsByPhoto, [state.activeId]: next },
        past: [...state.past, present].slice(-DEFAULT_HISTORY_LIMIT),
        future: rest,
        lastCommit: null,
        cropActive: false,
      });
    },

    beginCrop: () => {
      const state = get();
      const photo = activePhoto(state);
      if (!photo) return;
      const edit = activeEdit(state);
      const bounds = editBounds(photo, edit);
      const preset = findAspectPreset(state.cropAspectId);
      const aspect =
        preset.ratio === 'original'
          ? bounds.width / bounds.height
          : typeof preset.ratio === 'number'
            ? preset.ratio
            : null;
      const baseRect = edit.crop ?? centeredRect(bounds, aspect, 0.9);
      set({
        mode: 'edit',
        toolTab: 'crop',
        cropActive: true,
        cropRect: baseRect,
        compare: false,
      });
    },

    endCrop: () => set({ cropActive: false, toolTab: 'adjust' }),

    setCropRect: (rect) => set({ cropRect: rect }),

    setCropAspect: (presetId) => {
      const state = get();
      const photo = activePhoto(state);
      const preset = findAspectPreset(presetId);
      if (!photo) {
        set({ cropAspectId: presetId });
        return;
      }
      const bounds = editBounds(photo, activeEdit(state));
      const aspect =
        preset.ratio === 'original'
          ? bounds.width / bounds.height
          : typeof preset.ratio === 'number'
            ? preset.ratio
            : null;
      set({
        cropAspectId: presetId,
        cropRect: applyAspectToRect(state.cropRect, aspect, bounds),
      });
    },

    applyCrop: () => {
      const state = get();
      const edit = activeEdit(state);
      const rect = state.cropRect;
      applyEdit({ ...edit, crop: isFullCrop(rect) ? null : rect }, 'crop');
      set({ cropActive: false, toolTab: 'adjust', pan: ZERO_POINT, zoom: 1 });
    },

    setView: (view) => {
      const state = get();
      const zoom = clamp(view.zoom ?? state.zoom, MIN_ZOOM, MAX_ZOOM);
      set({ zoom, pan: view.pan ?? state.pan });
    },

    zoomBy: (direction) => {
      const state = get();
      const zoom = nextZoom(state.zoom, direction);
      set({ zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) });
    },

    fitToScreen: () => set({ zoom: 1, pan: ZERO_POINT }),

    actualSize: () => {
      const state = get();
      set({ zoom: clamp(1 / (state.fitScale || 1), MIN_ZOOM, MAX_ZOOM), pan: ZERO_POINT });
    },

    setStageMetrics: (stage, fitScale) => set({ stage, fitScale }),

    toggleCompare: () => {
      if (!get().activeId) return;
      set((state) => ({ compare: !state.compare, cropActive: false }));
    },

    toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),

    toggleInfo: () => set((state) => ({ infoOpen: !state.infoOpen })),

    toggleFilmstrip: () => set((state) => ({ filmstripOpen: !state.filmstripOpen })),

    toggleLoupe: () => set((state) => ({ loupeVisible: !state.loupeVisible })),

    toggleFullscreen: async () => {
      try {
        const isFullscreen = await getFileService().toggleFullscreen();
        set({ isFullscreen });
      } catch {
        get().notify('Não foi possível alternar a tela cheia.', 'warning');
      }
    },

    setSaveOpen: (open) => set({ saveOpen: open }),

    setUpscaleOpen: (open) => set({ upscaleOpen: open }),

    setShortcutsOpen: (open) => set({ shortcutsOpen: open }),

    setUpscaleSettings: (settings) =>
      set((state) => ({
        upscaleScale: settings.scale ?? state.upscaleScale,
        upscaleEngine: settings.engineId ?? state.upscaleEngine,
        upscalePatchSize: settings.patchSize ?? state.upscalePatchSize,
      })),

    notify: (message, tone = 'info') => {
      toastCounter += 1;
      if (toastTimer) clearTimeout(toastTimer);
      set({ toast: { id: toastCounter, message, tone } });
      toastTimer = setTimeout(() => set({ toast: null }), tone === 'error' ? 6000 : 3800);
    },

    dismissToast: () => {
      if (toastTimer) clearTimeout(toastTimer);
      set({ toast: null });
    },
  };
});

export const useActivePhoto = () => useAppStore((state) => activePhoto(state));
export const useActiveEdit = () => useAppStore((state) => activeEdit(state));
