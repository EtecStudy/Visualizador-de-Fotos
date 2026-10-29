import { useEffect, useRef } from 'react';
import { ScanSearch, X } from 'lucide-react';
import { useAppStore } from '../state/useAppStore';

const LOUPE_W = 236;
const LOUPE_H = 156;

interface DetailLoupeProps {
  /** Preview canvas drawn by the viewer (already contains every edit). */
  canvas: HTMLCanvasElement | null;
  /** Size of the image in image pixels. */
  imageSize: { width: number; height: number };
}

/**
 * Floating 1:1 detail preview (like Lightroom's detail loupe). It shows the
 * edited pixels at real scale so sharpness/noise changes are actually visible.
 */
export function DetailLoupe({ canvas, imageSize }: DetailLoupeProps) {
  const visible = useAppStore((state) => state.loupeVisible);
  const toggle = useAppStore((state) => state.toggleLoupe);
  const zoom = useAppStore((state) => state.zoom);
  const pan = useAppStore((state) => state.pan);
  const fitScale = useAppStore((state) => state.fitScale);
  const stage = useAppStore((state) => state.stage);
  const targetRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible) return;
    const target = targetRef.current;
    if (!target || !canvas || !imageSize.width) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    target.width = LOUPE_W * dpr;
    target.height = LOUPE_H * dpr;
    const context = target.getContext('2d');
    if (!context) return;
    context.imageSmoothingEnabled = false;

    // Map the center of the stage back to preview-canvas pixels.
    const displayScale = fitScale * zoom;
    const factor = canvas.width / imageSize.width;
    const centerX = canvas.width / 2 - (pan.x / displayScale) * factor;
    const centerY = canvas.height / 2 - (pan.y / displayScale) * factor;
    const sourceWidth = LOUPE_W / dpr / factor;
    const sourceHeight = LOUPE_H / dpr / factor;

    const maxX = Math.max(0, canvas.width - sourceWidth);
    const maxY = Math.max(0, canvas.height - sourceHeight);
    const sx = Math.min(Math.max(0, centerX - sourceWidth / 2), maxX);
    const sy = Math.min(Math.max(0, centerY - sourceHeight / 2), maxY);

    context.clearRect(0, 0, target.width, target.height);
    context.drawImage(
      canvas,
      sx,
      sy,
      Math.min(sourceWidth, canvas.width),
      Math.min(sourceHeight, canvas.height),
      0,
      0,
      target.width,
      target.height,
    );
  }, [visible, canvas, imageSize.width, imageSize.height, zoom, pan, fitScale, stage.width, stage.height]);

  if (!visible || !canvas) return null;

  return (
    <div className="loupe" aria-label="Detalhe em tamanho real">
      <canvas ref={targetRef} style={{ width: LOUPE_W, height: LOUPE_H }} />
      <div className="loupe__bar">
        <span>
          <ScanSearch size={12} />
          Detalhe 1:1
        </span>
        <button type="button" className="loupe__close" onClick={toggle} aria-label="Fechar detalhe 1:1">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
