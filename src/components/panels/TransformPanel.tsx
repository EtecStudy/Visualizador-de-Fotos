import { RotateCcw, RotateCw, Undo2 } from 'lucide-react';
import { activeEdit, useAppStore } from '../../state/useAppStore';
import { editBounds } from '../../core/editing/geometry';
import { Slider } from '../ui/primitives';
import { formatDimensions } from '../../utils/formatDisplay';

export function TransformPanel() {
  const edit = useAppStore(activeEdit);
  const photo = useAppStore((state) => state.photos.find((entry) => entry.id === state.activeId) ?? null);
  const rotate = useAppStore((state) => state.rotate);
  const setStraighten = useAppStore((state) => state.setStraighten);
  const endGesture = useAppStore((state) => state.endGesture);
  const setEdit = useAppStore((state) => state.setEdit);

  if (!photo) return null;
  const bounds = editBounds(photo, edit);

  return (
    <div className="panel">
      <section className="panel__section">
        <span className="panel__label">Girar</span>
        <div className="rotate-row">
          <button type="button" className="tool-card" onClick={() => rotate(-90)} title="Girar 90° à esquerda">
            <span className="tool-card__icon">
              <RotateCcw size={20} />
            </span>
            <span className="tool-card__title">Esquerda</span>
            <span className="tool-card__meta">90°</span>
          </button>
          <button type="button" className="tool-card" onClick={() => rotate(90)} title="Girar 90° à direita">
            <span className="tool-card__icon">
              <RotateCw size={20} />
            </span>
            <span className="tool-card__title">Direita</span>
            <span className="tool-card__meta">90°</span>
          </button>
        </div>
        <div className="transform-readout">
          <span>Rotação atual</span>
          <strong>{edit.rotation}°</strong>
          <span className="transform-readout__sep" />
          <span>Dimensões</span>
          <strong>{formatDimensions(bounds.width, bounds.height)}</strong>
        </div>
      </section>

      <section className="panel__section">
        <span className="panel__label">Endireitar</span>
        <Slider
          label="Ângulo"
          value={edit.straighten}
          min={-45}
          max={45}
          step={0.1}
          onChange={(value) => setStraighten(value, 'straighten')}
          onCommit={endGesture}
          onReset={() => setStraighten(0)}
          format={(value) => `${value.toFixed(1)}°`}
        />
        <p className="panel__hint">
          Use a grade de terços como referência. Ao endireitar, os cantos vazios ficam transparentes — use o
          recorte para removê-los.
        </p>
      </section>

      <div className="panel__actions">
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => setEdit({ ...edit, rotation: 0, straighten: 0 })}
          disabled={edit.rotation === 0 && edit.straighten === 0}
        >
          <Undo2 size={14} />
          Redefinir rotação e endireitamento
        </button>
      </div>

      <div className="panel__note">
        <RotateCw size={14} />
        <span>
          As rotações de 90° são instantâneas e não perdem qualidade. O endireitamento é recalculado sempre a
          partir da imagem original.
        </span>
      </div>
    </div>
  );
}
