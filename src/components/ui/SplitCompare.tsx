import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { GripVertical } from 'lucide-react';

interface SplitCompareProps {
  before: ReactNode;
  after: ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  hint?: boolean;
}

/** Before/after comparison with a draggable split handle. */
export function SplitCompare({
  before,
  after,
  beforeLabel = 'Original',
  afterLabel = 'Editada',
  className = '',
  hint = true,
}: SplitCompareProps) {
  const [split, setSplit] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClient = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.min(100, Math.max(0, next)));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromClient(event.clientX);
  };

  return (
    <div
      className={`split ${className}`}
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={(event) => {
        if (dragging.current) updateFromClient(event.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <div className="split__layer">{before}</div>
      <div className="split__layer split__layer--after" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
        {after}
      </div>

      <div className="split__divider" style={{ left: `${split}%` }}>
        <span
          className="split__grip"
          role="slider"
          aria-label="Posição da comparação"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(split)}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') setSplit((value) => Math.max(0, value - 4));
            if (event.key === 'ArrowRight') setSplit((value) => Math.min(100, value + 4));
          }}
        >
          <GripVertical size={16} />
        </span>
      </div>

      <span className="split__label split__label--before">{beforeLabel}</span>
      <span className="split__label split__label--after">{afterLabel}</span>
      {hint && <span className="split__hint">Arraste para comparar</span>}
    </div>
  );
}
