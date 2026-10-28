import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

interface CanvasSurfaceProps {
  canvas: HTMLCanvasElement | null;
  className?: string;
  style?: CSSProperties;
  mode?: 'fill' | 'contain';
}

/**
 * Mounts an already-rendered canvas element (renderPhoto returns canvases)
 * without copying pixels again.
 */
export function CanvasSurface({ canvas, className = '', style, mode = 'contain' }: CanvasSurfaceProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    if (canvas) {
      canvas.classList.add('rendered-canvas');
      host.appendChild(canvas);
    }
    return () => {
      host.replaceChildren();
    };
  }, [canvas]);

  return <div ref={hostRef} className={`canvas-surface canvas-surface--${mode} ${className}`} style={style} />;
}
