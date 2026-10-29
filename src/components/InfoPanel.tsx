import { useEffect, useRef } from 'react';
import { FolderSearch, Image as ImageIcon, Pencil, Trash2, X } from 'lucide-react';
import type { PhotoAsset } from '../core/types';
import { activeEdit, useAppStore } from '../state/useAppStore';
import { describeEdit, isEditDirty } from '../core/editing/defaults';
import { editBounds, editOutputSize } from '../core/editing/geometry';
import { formatBytes, formatLabel } from '../core/image/format';
import { getFileService } from '../core/files';
import { formatDimensions, formatMegapixels } from '../utils/formatDisplay';
import { IconButton } from './ui/primitives';

export function InfoPanel({ photo }: { photo: PhotoAsset }) {
  const edit = useAppStore(activeEdit);
  const closePhoto = useAppStore((state) => state.closePhoto);
  const toggleInfo = useAppStore((state) => state.toggleInfo);
  const setMode = useAppStore((state) => state.setMode);
  const notify = useAppStore((state) => state.notify);
  const panelRef = useRef<HTMLDivElement>(null);
  const service = getFileService();

  useEffect(() => {
    const handlePointer = (event: PointerEvent) => {
      if (!panelRef.current) return;
      const target = event.target as Node;
      if (panelRef.current.contains(target)) return;
      if ((target as HTMLElement).closest('[aria-label^="Informações"]')) return;
      toggleInfo();
    };
    const timer = setTimeout(() => document.addEventListener('pointerdown', handlePointer), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointer);
    };
  }, [toggleInfo]);

  const bounds = editBounds(photo, edit);
  const outputSize = editOutputSize(photo, edit);
  const dirty = isEditDirty(edit);
  const cropped = Boolean(edit.crop);

  return (
    <div className="info-panel" ref={panelRef} role="dialog" aria-label="Informações da imagem">
      <header className="info-panel__header">
        <span className="info-panel__icon">
          <ImageIcon size={16} />
        </span>
        <h3>Informações</h3>
        <IconButton label="Fechar informações" onClick={toggleInfo}>
          <X size={16} />
        </IconButton>
      </header>

      <div className="info-panel__preview">
        <img src={photo.url} alt={photo.name} draggable={false} />
      </div>

      <div className="info-panel__name" title={photo.name}>
        {photo.name}
      </div>
      {photo.path && <div className="info-panel__path">{photo.path}</div>}

      <dl className="info-list">
        <div>
          <dt>Formato</dt>
          <dd>{formatLabel(photo.format)}</dd>
        </div>
        <div>
          <dt>Resolução original</dt>
          <dd>{formatDimensions(photo.width, photo.height)}</dd>
        </div>
        <div>
          <dt>Tamanho</dt>
          <dd>{formatBytes(photo.sizeBytes)}</dd>
        </div>
        <div>
          <dt>Megapixels</dt>
          <dd>{formatMegapixels(photo.width, photo.height)}</dd>
        </div>
      </dl>

      {dirty && (
        <>
          <div className="info-panel__section">Edição atual</div>
          <dl className="info-list">
            <div>
              <dt>Resultado</dt>
              <dd>
                {formatDimensions(outputSize.width, outputSize.height)}
                <span className="info-panel__muted"> · {formatMegapixels(outputSize.width, outputSize.height)}</span>
              </dd>
            </div>
            <div>
              <dt>Rotação</dt>
              <dd>{edit.rotation}°</dd>
            </div>
            {edit.straighten !== 0 && (
              <div>
                <dt>Endireitar</dt>
                <dd>{edit.straighten.toFixed(1)}°</dd>
              </div>
            )}
            {cropped && (
              <div>
                <dt>Recorte</dt>
                <dd>
                  {Math.round(edit.crop!.width * bounds.width)} × {Math.round(edit.crop!.height * bounds.height)} px
                </dd>
              </div>
            )}
            <div>
              <dt>Ajustes</dt>
              <dd className="info-panel__wrap">{describeEdit(edit)}</dd>
            </div>
          </dl>
        </>
      )}

      <div className="info-panel__actions">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            setMode('edit');
            toggleInfo();
          }}
        >
          <Pencil size={14} />
          Editar
        </button>
        {photo.path && service.capabilities.revealInFolder && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              void service.revealInFolder(photo.path!).catch(() => notify('Não foi possível abrir a pasta.', 'error'));
            }}
          >
            <FolderSearch size={14} />
            Mostrar na pasta
          </button>
        )}
        <button
          type="button"
          className="btn btn--ghost btn--sm btn--danger"
          onClick={() => {
            closePhoto(photo.id);
            toggleInfo();
          }}
        >
          <Trash2 size={14} />
          Fechar imagem
        </button>
      </div>
    </div>
  );
}
