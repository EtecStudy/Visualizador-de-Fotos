import {
  Aperture,
  Columns2,
  Download,
  FolderOpen,
  Info,
  Keyboard,
  Maximize,
  Minimize,
  Pencil,
  Sparkles,
  X,
} from 'lucide-react';
import { useAppStore, activeEdit } from '../state/useAppStore';
import { isEditDirty } from '../core/editing/defaults';
import { formatLabel } from '../core/image/format';
import { formatDimensions } from '../utils/formatDisplay';
import { IconButton } from './ui/primitives';

export function AppHeader() {
  const photo = useAppStore((state) => state.photos.find((entry) => entry.id === state.activeId) ?? null);
  const mode = useAppStore((state) => state.mode);
  const compare = useAppStore((state) => state.compare);
  const infoOpen = useAppStore((state) => state.infoOpen);
  const isFullscreen = useAppStore((state) => state.isFullscreen);
  const dirty = useAppStore((state) => isEditDirty(activeEdit(state)));

  const openFromDialog = useAppStore((state) => state.openFromDialog);
  const setMode = useAppStore((state) => state.setMode);
  const toggleCompare = useAppStore((state) => state.toggleCompare);
  const setUpscaleOpen = useAppStore((state) => state.setUpscaleOpen);
  const setSaveOpen = useAppStore((state) => state.setSaveOpen);
  const toggleInfo = useAppStore((state) => state.toggleInfo);
  const toggleFullscreen = useAppStore((state) => state.toggleFullscreen);
  const setShortcutsOpen = useAppStore((state) => state.setShortcutsOpen);

  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="brand">
          <span className="brand__mark">
            <Aperture size={19} strokeWidth={2.1} />
          </span>
          <span className="brand__text">
            Lumina
            <span className="brand__sub">fotos</span>
          </span>
        </div>

        {photo ? (
          <div className="doc">
            <span className="doc__name" title={photo.path ?? photo.name}>
              {photo.name}
            </span>
            <span className="doc__chips">
              <span className="chip">{formatLabel(photo.format)}</span>
              <span className="chip">{formatDimensions(photo.width, photo.height)}</span>
              {dirty && <span className="chip chip--accent">Editada</span>}
            </span>
          </div>
        ) : (
          <span className="topbar__tagline">Visualizador e editor de fotos</span>
        )}
      </div>

      <div className="topbar__actions">
        <button type="button" className="btn btn--ghost" onClick={() => void openFromDialog()}>
          <FolderOpen size={16} />
          <span className="btn__label">Abrir</span>
        </button>

        <button
          type="button"
          className={`btn ${mode === 'edit' ? 'btn--soft' : 'btn--ghost'}`}
          onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
          disabled={!photo}
        >
          {mode === 'edit' ? <X size={16} /> : <Pencil size={16} />}
          <span className="btn__label">{mode === 'edit' ? 'Concluir' : 'Editar'}</span>
        </button>

        <button
          type="button"
          className="btn btn--accent"
          onClick={() => setUpscaleOpen(true)}
          disabled={!photo}
          title="Upscale por IA (U)"
        >
          <Sparkles size={16} />
          <span className="btn__label">Upscale IA</span>
        </button>

        <span className="topbar__divider" />

        <IconButton label="Comparar antes/depois (C)" active={compare} onClick={toggleCompare} disabled={!photo}>
          <Columns2 size={18} />
        </IconButton>
        <IconButton label="Informações da imagem (I)" active={infoOpen} onClick={toggleInfo} disabled={!photo}>
          <Info size={18} />
        </IconButton>
        <IconButton label={isFullscreen ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'} onClick={() => void toggleFullscreen()}>
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </IconButton>
        <IconButton label="Atalhos de teclado (?)" onClick={() => setShortcutsOpen(true)}>
          <Keyboard size={18} />
        </IconButton>

        <button type="button" className="btn btn--primary" onClick={() => setSaveOpen(true)} disabled={!photo} title="Salvar como (Ctrl+S)">
          <Download size={16} />
          <span className="btn__label">Salvar</span>
        </button>
      </div>
    </header>
  );
}
