import { Check, Crop, Maximize, RotateCcw, Trash2, X } from 'lucide-react';
import { activeEdit, findAspectPreset, useActivePhoto, useAppStore } from '../../state/useAppStore';
import { editBounds } from '../../core/editing/geometry';
import {
  ASPECT_PRESETS,
  centeredRect,
  cropAspectRatio,
  formatAspect,
} from '../../core/editing/crop';
import { formatDimensions, formatMegapixels } from '../../utils/formatDisplay';

export function CropPanel() {
  const photo = useActivePhoto();
  const edit = useAppStore(activeEdit);
  const cropRect = useAppStore((state) => state.cropRect);
  const cropAspectId = useAppStore((state) => state.cropAspectId);
  const setCropAspect = useAppStore((state) => state.setCropAspect);
  const setCropRect = useAppStore((state) => state.setCropRect);
  const applyCrop = useAppStore((state) => state.applyCrop);
  const endCrop = useAppStore((state) => state.endCrop);
  const setEdit = useAppStore((state) => state.setEdit);

  if (!photo) return null;

  const bounds = editBounds(photo, edit);
  const preset = findAspectPreset(cropAspectId);
  const aspectValue =
    preset.ratio === 'original' ? bounds.width / bounds.height : typeof preset.ratio === 'number' ? preset.ratio : null;
  const width = Math.round(cropRect.width * bounds.width);
  const height = Math.round(cropRect.height * bounds.height);

  const resetSelection = () => {
    setCropRect(centeredRect(bounds, aspectValue, 0.9));
  };

  return (
    <div className="panel">
      <p className="panel__hint">
        Arraste sobre a imagem para desenhar a área de recorte, ou use as alças nos cantos e laterais para ajustar.
      </p>

      <section className="panel__section">
        <span className="panel__label">Proporção</span>
        <div className="aspect-grid">
          {ASPECT_PRESETS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`aspect-btn ${cropAspectId === option.id ? 'is-active' : ''}`}
              onClick={() => setCropAspect(option.id)}
              title={option.ratio === 'original' ? 'Proporção original da imagem' : option.label}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <div className="crop-summary">
        <div>
          <span>Seleção</span>
          <strong>{formatDimensions(width, height)} px</strong>
        </div>
        <div>
          <span>Proporção</span>
          <strong>{formatAspect(cropAspectRatio(cropRect, bounds))}</strong>
        </div>
        <div>
          <span>Resultado</span>
          <strong>{formatMegapixels(width, height)}</strong>
        </div>
      </div>

      <div className="panel__actions">
        <button type="button" className="btn btn--primary btn--block" onClick={applyCrop}>
          <Check size={16} />
          Aplicar recorte
        </button>
        <div className="panel__actions-row">
          <button type="button" className="btn btn--ghost btn--sm" onClick={resetSelection}>
            <RotateCcw size={14} />
            Redefinir
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={endCrop}>
            <X size={14} />
            Cancelar
          </button>
        </div>
        {edit.crop && (
          <button
            type="button"
            className="btn btn--ghost btn--sm btn--block"
            onClick={() => {
              setEdit({ ...edit, crop: null });
              setCropRect({ x: 0, y: 0, width: 1, height: 1 });
            }}
          >
            <Trash2 size={14} />
            Remover recorte aplicado
          </button>
        )}
      </div>

      <div className="panel__note">
        <Maximize size={14} />
        <span>
          O recorte é aplicado ao salvar a imagem; o arquivo original permanece intacto. Você pode desfazer a
          qualquer momento.
        </span>
      </div>

      <div className="panel__note panel__note--subtle">
        <Crop size={14} />
        <span>Dica: comece com 1:1 para redes sociais ou 16:9 para telas largas.</span>
      </div>
    </div>
  );
}
