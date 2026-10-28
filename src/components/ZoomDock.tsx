import { Grid3x3, Maximize2, Scan, ScanSearch, Square, ZoomIn, ZoomOut } from 'lucide-react';
import { useAppStore } from '../state/useAppStore';
import { IconButton } from './ui/primitives';

export function ZoomDock() {
  const zoom = useAppStore((state) => state.zoom);
  const fitScale = useAppStore((state) => state.fitScale);
  const gridVisible = useAppStore((state) => state.gridVisible);
  const loupeVisible = useAppStore((state) => state.loupeVisible);
  const toggleLoupe = useAppStore((state) => state.toggleLoupe);
  const zoomBy = useAppStore((state) => state.zoomBy);
  const fitToScreen = useAppStore((state) => state.fitToScreen);
  const actualSize = useAppStore((state) => state.actualSize);
  const toggleFullscreen = useAppStore((state) => state.toggleFullscreen);
  const toggleGrid = useAppStore((state) => state.toggleGrid);

  const percent = Math.round(fitScale * zoom * 100);
  const isFit = Math.abs(zoom - 1) < 0.001;
  const isActual = Math.abs(fitScale * zoom - 1) < 0.01;

  return (
    <div className="zoom-dock" role="toolbar" aria-label="Controles de zoom">
      <IconButton label="Diminuir zoom (-)" onClick={() => zoomBy(-1)}>
        <ZoomOut size={17} />
      </IconButton>
      <button
        type="button"
        className="zoom-dock__percent"
        onClick={fitToScreen}
        title="Ajustar à tela (0)"
      >
        {percent}%
      </button>
      <IconButton label="Aumentar zoom (+)" onClick={() => zoomBy(1)}>
        <ZoomIn size={17} />
      </IconButton>

      <span className="zoom-dock__sep" />

      <IconButton label="Ajustar à tela (0)" active={isFit} onClick={fitToScreen}>
        <Scan size={17} />
      </IconButton>
      <IconButton label="Tamanho original (1)" active={isActual && !isFit} onClick={actualSize}>
        <Square size={15} />
      </IconButton>
      <IconButton label="Grade de terços (G)" active={gridVisible} onClick={toggleGrid}>
        <Grid3x3 size={17} />
      </IconButton>
      <IconButton label="Detalhe 1:1 (D)" active={loupeVisible} onClick={toggleLoupe}>
        <ScanSearch size={17} />
      </IconButton>

      <span className="zoom-dock__sep" />

      <IconButton label="Tela cheia (F)" onClick={() => void toggleFullscreen()}>
        <Maximize2 size={17} />
      </IconButton>
    </div>
  );
}
