import { Check, Crop, X } from 'lucide-react';
import { formatDimensions } from '../utils/formatDisplay';

interface CropBarProps {
  width: number;
  height: number;
  onCancel: () => void;
  onApply: () => void;
}

export function CropBar({ width, height, onCancel, onApply }: CropBarProps) {
  return (
    <div className="crop-bar" role="toolbar" aria-label="Ações do recorte">
      <span className="crop-bar__size">
        <Crop size={15} />
        {formatDimensions(width, height)} px
      </span>
      <span className="crop-bar__hint">Arraste os cantos para ajustar</span>
      <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
        <X size={14} />
        Cancelar
      </button>
      <button type="button" className="btn btn--primary btn--sm" onClick={onApply}>
        <Check size={14} />
        Aplicar recorte
      </button>
    </div>
  );
}
