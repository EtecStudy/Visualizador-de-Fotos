import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { NormalizedRect } from '../core/types';
import type { CropHandle } from '../core/editing/crop';
import {
  applyAspectToRect,
  clampNormalizedRect,
  normalizedToPixelRect,
  pixelRectToNormalized,
  rectFromPoints,
  resizeCropRect,
} from '../core/editing/crop';
import { formatDimensions } from '../utils/formatDisplay';

interface CropOverlayProps {
  rect: NormalizedRect;
  aspect: number | null;
  scale: number;
  pixelSize: { width: number; height: number };
  onChange: (rect: NormalizedRect) => void;
}

type DragState =
  | { kind: 'resize'; handle: CropHandle; startX: number; startY: number; startRect: NormalizedRect; layout: { width: number; height: number } }
  | { kind: 'move'; startX: number; startY: number; startRect: NormalizedRect; layout: { width: number; height: number } }
  | { kind: 'create'; startPoint: { x: number; y: number }; layout: { width: number; height: number } };

const HANDLES: Array<{ id: Exclude<CropHandle, 'move'>; className: string }> = [
  { id: 'nw', className: 'crop-overlay__handle--nw' },
  { id: 'n', className: 'crop-overlay__handle--n' },
  { id: 'ne', className: 'crop-overlay__handle--ne' },
  { id: 'e', className: 'crop-overlay__handle--e' },
  { id: 'se', className: 'crop-overlay__handle--se' },
  { id: 's', className: 'crop-overlay__handle--s' },
  { id: 'sw', className: 'crop-overlay__handle--sw' },
  { id: 'w', className: 'crop-overlay__handle--w' },
];

export function CropOverlay({ rect, aspect, scale, pixelSize, onChange }: CropOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const measure = () => {
    const bounds = overlayRef.current?.getBoundingClientRect();
    const width = bounds ? bounds.width / scale : 1;
    const height = bounds ? bounds.height / scale : 1;
    return { width, height };
  };

  const pointFromEvent = (event: ReactPointerEvent) => {
    const bounds = overlayRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    const handle = target.dataset.handle as Exclude<CropHandle, 'move'> | undefined;
    const inside = target.dataset.cropBody === 'true';
    const layout = measure();
    overlayRef.current?.setPointerCapture(event.pointerId);

    if (handle) {
      dragRef.current = {
        kind: 'resize',
        handle,
        startX: event.clientX,
        startY: event.clientY,
        startRect: rect,
        layout,
      };
      event.preventDefault();
      return;
    }
    if (inside) {
      dragRef.current = {
        kind: 'move',
        startX: event.clientX,
        startY: event.clientY,
        startRect: rect,
        layout,
      };
      event.preventDefault();
      return;
    }

    const point = pointFromEvent(event);
    dragRef.current = { kind: 'create', startPoint: point, layout };
    onChange(applyAspectToRect(rectFromPoints(point, point), aspect, layout));
    event.preventDefault();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === 'create') {
      const point = pointFromEvent(event);
      const raw = rectFromPoints(drag.startPoint, point);
      const minimum = 8 / Math.max(drag.layout.width, drag.layout.height);
      onChange(
        applyAspectToRect(
          raw.width < minimum || raw.height < minimum ? { ...raw, width: minimum, height: minimum } : raw,
          aspect,
          drag.layout,
        ),
      );
      return;
    }

    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;
    const pixelRect = normalizedToPixelRect(drag.startRect, drag.layout);
    const resized = resizeCropRect(
      pixelRect,
      drag.kind === 'move' ? 'move' : drag.handle,
      dx,
      dy,
      drag.layout,
      aspect,
    );
    onChange(clampNormalizedRect(pixelRectToNormalized(resized, drag.layout)));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  const handleSize = 14 / scale;
  const lineWidth = 1.5 / scale;
  const cropWidth = Math.round(rect.width * pixelSize.width);
  const cropHeight = Math.round(rect.height * pixelSize.height);

  return (
    <div
      className="crop-overlay"
      ref={overlayRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="crop-overlay__mask"
        style={{
          left: `${rect.x * 100}%`,
          top: `${rect.y * 100}%`,
          width: `${rect.width * 100}%`,
          height: `${rect.height * 100}%`,
          boxShadow: `0 0 0 ${9999 / scale}px rgba(5, 6, 8, 0.62)`,
          borderWidth: lineWidth,
        }}
      >
        <div
          className="crop-overlay__body"
          data-crop-body="true"
          title="Arraste para mover o recorte"
        >
          <span className="crop-overlay__third crop-overlay__third--v1" style={{ width: lineWidth }} />
          <span className="crop-overlay__third crop-overlay__third--v2" style={{ width: lineWidth }} />
          <span className="crop-overlay__third crop-overlay__third--h1" style={{ height: lineWidth }} />
          <span className="crop-overlay__third crop-overlay__third--h2" style={{ height: lineWidth }} />
        </div>

        {HANDLES.map((handle) => (
          <span
            key={handle.id}
            data-handle={handle.id}
            className={`crop-overlay__handle ${handle.className}`}
            style={{ width: handleSize, height: handleSize, borderWidth: lineWidth }}
          />
        ))}

        <span
          className="crop-overlay__size"
          style={{
            left: 8 / scale,
            top: 8 / scale,
            transform: `scale(${1 / scale})`,
            transformOrigin: 'top left',
          }}
        >
          {formatDimensions(cropWidth, cropHeight)}
        </span>
      </div>
    </div>
  );
}
