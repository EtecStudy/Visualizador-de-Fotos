import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, X } from 'lucide-react';
import { useActiveEdit, useActivePhoto, useAppStore, findAspectPreset } from '../state/useAppStore';
import { editBounds, fitScaleFactor } from '../core/editing/geometry';
import { clampPan, panForZoomAtPoint } from '../core/viewer/viewTransform';
import { formatDimensions, formatMegapixels } from '../utils/formatDisplay';
import { usePreviewCanvas } from '../hooks/usePreviewCanvas';
import { CanvasSurface } from './ui/CanvasSurface';
import { SplitCompare } from './ui/SplitCompare';
import { Spinner } from './ui/primitives';
import { EmptyState } from './EmptyState';
import { ZoomDock } from './ZoomDock';
import { CropOverlay } from './CropOverlay';
import { CropBar } from './CropBar';
import { DetailLoupe } from './DetailLoupe';

interface PanDrag {
  originX: number;
  originY: number;
  panX: number;
  panY: number;
}

export function ViewerStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<PanDrag | null>(null);
  const [dragging, setDragging] = useState(false);

  const photo = useActivePhoto();
  const edit = useActiveEdit();
  const cropActive = useAppStore((state) => state.cropActive);
  const compare = useAppStore((state) => state.compare);
  const zoom = useAppStore((state) => state.zoom);
  const pan = useAppStore((state) => state.pan);
  const fitScale = useAppStore((state) => state.fitScale);
  const stage = useAppStore((state) => state.stage);
  const gridVisible = useAppStore((state) => state.gridVisible);
  const cropRect = useAppStore((state) => state.cropRect);
  const cropAspectId = useAppStore((state) => state.cropAspectId);
  const photosCount = useAppStore((state) => state.photos.length);

  const setView = useAppStore((state) => state.setView);
  const stepPhoto = useAppStore((state) => state.stepPhoto);
  const setCropRect = useAppStore((state) => state.setCropRect);
  const applyCrop = useAppStore((state) => state.applyCrop);
  const endCrop = useAppStore((state) => state.endCrop);
  const toggleCompare = useAppStore((state) => state.toggleCompare);
  const fitToScreen = useAppStore((state) => state.fitToScreen);
  const actualSize = useAppStore((state) => state.actualSize);

  const bounds = useMemo(
    () => (photo ? editBounds(photo, edit) : { width: 0, height: 0 }),
    [photo, edit],
  );
  const preview = usePreviewCanvas(photo, edit, {
    applyCrop: !cropActive,
    maxDimension: 3600,
    interactiveDimension: 1600,
  });

  const displayScale = fitScale * zoom;
  const displayWidth = bounds.width * displayScale;
  const displayHeight = bounds.height * displayScale;
  const canPan =
    Boolean(photo) && (displayWidth > (stage.width || 0) + 1 || displayHeight > (stage.height || 0) + 1);

  const aspectPreset = findAspectPreset(cropAspectId);
  const cropAspect =
    aspectPreset.ratio === 'original'
      ? bounds.width / bounds.height
      : typeof aspectPreset.ratio === 'number'
        ? aspectPreset.ratio
        : null;

  // Measure the stage and recompute "fit" whenever the image bounds change.
  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      const size = { width: rect.width, height: rect.height };
      const nextFit =
        bounds.width && bounds.height ? fitScaleFactor(bounds, size, 48, false) : 1;
      useAppStore.getState().setStageMetrics(size, nextFit);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [bounds.width, bounds.height]);

  // Keep the image reachable after zoom/resize.
  useEffect(() => {
    if (!photo) return;
    const state = useAppStore.getState();
    const rendered = {
      width: bounds.width * state.fitScale * state.zoom,
      height: bounds.height * state.fitScale * state.zoom,
    };
    const clamped = clampPan(state.pan, rendered, state.stage);
    if (Math.abs(clamped.x - state.pan.x) > 0.5 || Math.abs(clamped.y - state.pan.y) > 0.5) {
      state.setView({ pan: clamped });
    }
  }, [photo, bounds.width, bounds.height, fitScale, zoom, pan]);

  // Wheel / trackpad zoom anchored at the cursor.
  useEffect(() => {
    const element = stageRef.current;
    if (!element || !photo || compare) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const state = useAppStore.getState();
      const speed = event.ctrlKey ? 0.012 : 0.0022;
      const factor = Math.exp(-event.deltaY * speed);
      const nextZoom = Math.min(16, Math.max(0.05, state.zoom * factor));
      const oldScale = state.fitScale * state.zoom;
      const newScale = state.fitScale * nextZoom;
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const nextPan = panForZoomAtPoint(state.pan, oldScale, newScale, point, {
        width: rect.width,
        height: rect.height,
      });
      state.setView({ zoom: nextZoom, pan: nextPan });
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [photo, compare]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!photo || compare || cropActive || event.button !== 0 || !canPan) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, input, .zoom-dock, .crop-bar, .crop-overlay')) return;
    const state = useAppStore.getState();
    dragRef.current = {
      originX: event.clientX,
      originY: event.clientY,
      panX: state.pan.x,
      panY: state.pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const state = useAppStore.getState();
    const rendered = {
      width: bounds.width * state.fitScale * state.zoom,
      height: bounds.height * state.fitScale * state.zoom,
    };
    setView({
      pan: clampPan(
        {
          x: drag.panX + (event.clientX - drag.originX),
          y: drag.panY + (event.clientY - drag.originY),
        },
        rendered,
        state.stage,
      ),
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!photo || compare || cropActive) return;
    if ((event.target as HTMLElement).closest('button')) return;
    if (zoom > 1.001) fitToScreen();
    else actualSize();
  };

  const outputSize = preview.outputSize.width ? preview.outputSize : bounds;

  return (
    <section
      className={`stage ${compare ? 'is-comparing' : ''} ${cropActive ? 'is-cropping' : ''} ${
        dragging ? 'is-dragging' : ''
      } ${canPan ? 'is-pannable' : ''}`}
      ref={stageRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      aria-label="Área de visualização"
    >
      {!photo && <EmptyState />}

      {photo && compare && (
        <div className="stage__compare">
          <SplitCompare
            before={<img src={photo.url} alt="Foto original" className="compare-media" draggable={false} />}
            after={<CanvasSurface canvas={preview.canvas} mode="contain" className="compare-media" />}
            beforeLabel="Original"
            afterLabel="Editada"
          />
          <button type="button" className="btn btn--soft btn--sm stage__compare-exit" onClick={toggleCompare}>
            <X size={14} />
            Sair da comparação
          </button>
        </div>
      )}

      {photo && !compare && (
        <>
          <div
            className="photo-frame"
            style={{
              width: bounds.width,
              height: bounds.height,
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${displayScale})`,
            }}
          >
            <CanvasSurface canvas={preview.canvas} mode="fill" className="photo-frame__canvas" />

            {(gridVisible || cropActive || edit.straighten !== 0) && (
              <svg
                className={`thirds ${cropActive ? 'thirds--subtle' : ''}`}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line x1="33.333" y1="0" x2="33.333" y2="100" />
                <line x1="66.666" y1="0" x2="66.666" y2="100" />
                <line x1="0" y1="33.333" x2="100" y2="33.333" />
                <line x1="0" y1="66.666" x2="100" y2="66.666" />
              </svg>
            )}

            {cropActive && (
              <CropOverlay
                rect={cropRect}
                aspect={cropAspect}
                scale={displayScale}
                pixelSize={bounds}
                onChange={setCropRect}
              />
            )}
          </div>

          {!preview.canvas && !preview.error && (
            <div className="stage__loading">
              <Spinner size={22} />
              <span>Preparando imagem…</span>
            </div>
          )}

          {preview.error && (
            <div className="stage__error" role="alert">
              <strong>Não foi possível renderizar esta imagem</strong>
              <span>{preview.error}</span>
            </div>
          )}

          {photosCount > 1 && (
            <>
              <button
                type="button"
                className="stage__nav stage__nav--prev"
                onClick={() => stepPhoto(-1)}
                title="Foto anterior (←)"
                aria-label="Foto anterior"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className="stage__nav stage__nav--next"
                onClick={() => stepPhoto(1)}
                title="Próxima foto (→)"
                aria-label="Próxima foto"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          <div className="stage__meta">
            <ImageIcon size={13} />
            <span>{formatDimensions(outputSize.width, outputSize.height)}</span>
            <span className="stage__meta-sep">·</span>
            <span>{photo.format}</span>
            <span className="stage__meta-sep">·</span>
            <span>{formatMegapixels(outputSize.width, outputSize.height)}</span>
            {preview.isRefining && <span className="stage__meta-refining">aprimorando…</span>}
          </div>

          {!cropActive && (
            <DetailLoupe canvas={preview.canvas} imageSize={outputSize} />
          )}

          {cropActive ? (
            <CropBar
              width={Math.round(cropRect.width * bounds.width)}
              height={Math.round(cropRect.height * bounds.height)}
              onCancel={endCrop}
              onApply={applyCrop}
            />
          ) : (
            <ZoomDock />
          )}
        </>
      )}
    </section>
  );
}
