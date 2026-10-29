import { Blend, Contrast, Droplets, Focus, RotateCcw, Sun } from 'lucide-react';
import { useActiveEdit, useActivePhoto, useAppStore } from '../../state/useAppStore';
import { hasAdjustments } from '../../core/editing/defaults';
import { useHistogram } from '../../hooks/useHistogram';
import { Slider, Switch } from '../ui/primitives';
import { Histogram } from './Histogram';

export function AdjustPanel() {
  const edit = useActiveEdit();
  const photo = useActivePhoto();
  const updateAdjustments = useAppStore((state) => state.updateAdjustments);
  const endGesture = useAppStore((state) => state.endGesture);
  const toggleGrayscale = useAppStore((state) => state.toggleGrayscale);
  const resetAdjustments = useAppStore((state) => state.resetAdjustments);
  const bins = useHistogram(photo);
  const adjustments = edit.adjustments;

  return (
    <div className="panel">
      <section className="panel__section">
        <header className="panel__section-head">
          <span className="panel__section-title">
            <Sun size={14} />
            Luz e cor
          </span>
          <Histogram bins={bins} />
        </header>

        <Slider
          label="Brilho"
          value={adjustments.brightness}
          min={-100}
          max={100}
          onChange={(value) => updateAdjustments({ brightness: value }, 'brightness')}
          onCommit={endGesture}
          onReset={() => updateAdjustments({ brightness: 0 })}
        />
        <Slider
          label="Contraste"
          value={adjustments.contrast}
          min={-100}
          max={100}
          onChange={(value) => updateAdjustments({ contrast: value }, 'contrast')}
          onCommit={endGesture}
          onReset={() => updateAdjustments({ contrast: 0 })}
        />
        <Slider
          label="Saturação"
          value={adjustments.saturation}
          min={-100}
          max={100}
          onChange={(value) => updateAdjustments({ saturation: value }, 'saturation')}
          onCommit={endGesture}
          onReset={() => updateAdjustments({ saturation: 0 })}
        />
      </section>

      <section className="panel__section">
        <Switch
          label="Preto e branco"
          description="Remove toda a informação de cor"
          checked={adjustments.grayscale}
          onChange={toggleGrayscale}
          icon={<Blend size={15} />}
        />
      </section>

      <section className="panel__section">
        <header className="panel__section-head">
          <span className="panel__section-title">
            <Focus size={14} />
            Detalhe
          </span>
        </header>
        <Slider
          label="Nitidez"
          value={adjustments.sharpness}
          min={0}
          max={100}
          onChange={(value) => updateAdjustments({ sharpness: value }, 'sharpness')}
          onCommit={endGesture}
          onReset={() => updateAdjustments({ sharpness: 0 })}
          accent="neutral"
          format={(value) => `${Math.round(value)}%`}
        />
        <p className="panel__hint">
          A nitidez realça bordas com uma máscara de nitidez (unsharp mask) aplicada em tempo real na GPU.
        </p>
      </section>

      <div className="panel__quick">
        <span className="panel__quick-label">Atalhos de tom</span>
        <div className="quick-grid">
          <button
            type="button"
            className="quick-btn"
            onClick={() => {
              updateAdjustments({ contrast: 14, saturation: 6 });
            }}
          >
            <Contrast size={14} />
            Vibrante
          </button>
          <button
            type="button"
            className="quick-btn"
            onClick={() => {
              updateAdjustments({ brightness: 10, contrast: -8, saturation: -10 });
            }}
          >
            <Droplets size={14} />
            Suave
          </button>
          <button
            type="button"
            className="quick-btn"
            onClick={() => {
              updateAdjustments({ brightness: -6, contrast: 22, saturation: -14 });
            }}
          >
            <Sun size={14} />
            Dramático
          </button>
        </div>
      </div>

      <button
        type="button"
        className="panel__reset"
        onClick={resetAdjustments}
        disabled={!hasAdjustments(adjustments)}
      >
        <RotateCcw size={14} />
        Redefinir ajustes de cor
      </button>
    </div>
  );
}
