import { useState } from 'react';
import { ChevronDown, ChevronUp, Images, Plus, X } from 'lucide-react';
import { useAppStore } from '../state/useAppStore';
import { isEditDirty } from '../core/editing/defaults';
import { IconButton } from './ui/primitives';

export function Filmstrip() {
  const photos = useAppStore((state) => state.photos);
  const activeId = useAppStore((state) => state.activeId);
  const editsByPhoto = useAppStore((state) => state.editsByPhoto);
  const filmstripOpen = useAppStore((state) => state.filmstripOpen);
  const setActive = useAppStore((state) => state.setActive);
  const closePhoto = useAppStore((state) => state.closePhoto);
  const openFromDialog = useAppStore((state) => state.openFromDialog);
  const toggleFilmstrip = useAppStore((state) => state.toggleFilmstrip);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (!photos.length) return null;

  if (!filmstripOpen) {
    return (
      <button type="button" className="filmstrip-collapsed" onClick={toggleFilmstrip} title="Mostrar filmes (T)">
        <Images size={15} />
        <span>{photos.length} fotos</span>
        <ChevronUp size={14} />
      </button>
    );
  }

  return (
    <footer className="filmstrip">
      <div className="filmstrip__head">
        <span className="filmstrip__title">
          <Images size={14} />
          {photos.length === 1 ? '1 foto' : `${photos.length} fotos`}
        </span>
        <IconButton label="Ocultar filmes (T)" onClick={toggleFilmstrip}>
          <ChevronDown size={16} />
        </IconButton>
      </div>
      <div className="filmstrip__track">
        {photos.map((photo) => {
          const edited = editsByPhoto[photo.id] ? isEditDirty(editsByPhoto[photo.id]) : false;
          return (
            <div
              key={photo.id}
              className={`thumb ${photo.id === activeId ? 'is-active' : ''}`}
              onClick={() => setActive(photo.id)}
              role="button"
              tabIndex={0}
              title={photo.name}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setActive(photo.id);
                }
              }}
            >
              <img src={photo.url} alt={photo.name} loading="lazy" draggable={false} />
              {edited && <span className="thumb__edited" title="Imagem editada" />}
              <button
                type="button"
                className={`thumb__remove ${confirming === photo.id ? 'is-confirming' : ''}`}
                title={confirming === photo.id ? 'Clique novamente para fechar' : 'Fechar imagem'}
                aria-label="Fechar imagem"
                onClick={(event) => {
                  event.stopPropagation();
                  if (confirming === photo.id) {
                    closePhoto(photo.id);
                    setConfirming(null);
                  } else {
                    setConfirming(photo.id);
                    setTimeout(() => setConfirming((current) => (current === photo.id ? null : current)), 2600);
                  }
                }}
              >
                <X size={12} />
              </button>
              {confirming === photo.id && <span className="thumb__confirm">Fechar?</span>}
            </div>
          );
        })}
        <button type="button" className="thumb thumb--add" onClick={() => void openFromDialog()} title="Adicionar imagens">
          <Plus size={20} />
          <span>Abrir</span>
        </button>
      </div>
    </footer>
  );
}
