import { Cpu, FolderOpen, ImagePlus, Keyboard, Sparkles, Wand2, ZoomIn } from 'lucide-react';
import { useAppStore } from '../state/useAppStore';

const SAMPLES = [
  { file: 'samples/montanha.jpg', name: 'montanha.jpg' },
  { file: 'samples/retrato.jpg', name: 'retrato.jpg' },
];

export function EmptyState() {
  const openFromDialog = useAppStore((state) => state.openFromDialog);
  const addFromFiles = useAppStore((state) => state.addFromFiles);
  const notify = useAppStore((state) => state.notify);
  const setShortcutsOpen = useAppStore((state) => state.setShortcutsOpen);

  const loadSamples = async () => {
    try {
      const files = await Promise.all(
        SAMPLES.map(async (sample) => {
          const response = await fetch(new URL(sample.file, document.baseURI).href);
          if (!response.ok) throw new Error('Arquivo de exemplo indisponível');
          const blob = await response.blob();
          return new File([blob], sample.name, { type: blob.type || 'image/jpeg' });
        }),
      );
      await addFromFiles(files);
    } catch {
      notify('As fotos de exemplo não estão disponíveis nesta instalação.', 'warning');
    }
  };

  return (
    <div className="empty">
      <div className="empty__ambient" aria-hidden="true" />
      <div className="empty__content">
        <span className="empty__eyebrow">
          <span className="empty__dot" />
          Visualizador + editor + upscale por IA
        </span>
        <h1 className="empty__title">
          Suas fotos,
          <span> em detalhe.</span>
        </h1>
        <p className="empty__description">
          Abra imagens do computador ou arraste e solte aqui. Dê zoom, recorte, ajuste a luz, gire e aumente a
          resolução com super-resolução por IA — tudo processado localmente, sem enviar nada para a nuvem.
        </p>

        <div className="empty__actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={() => void openFromDialog()} data-autofocus>
            <FolderOpen size={18} />
            Abrir imagens
          </button>
          <button type="button" className="btn btn--soft btn--lg" onClick={() => void loadSamples()}>
            <Sparkles size={18} />
            Usar fotos de exemplo
          </button>
        </div>

        <div className="empty__formats">
          <span>JPG</span>
          <span>JPEG</span>
          <span>PNG</span>
          <span>WEBP</span>
          <span>GIF</span>
          <span>BMP</span>
          <span>AVIF</span>
        </div>

        <div className="empty__features">
          <div className="feature">
            <span className="feature__icon"><ZoomIn size={16} /></span>
            <div>
              <strong>Zoom até 1600%</strong>
              <span>Arraste, ajuste e veja cada pixel</span>
            </div>
          </div>
          <div className="feature">
            <span className="feature__icon"><Wand2 size={16} /></span>
            <div>
              <strong>Edição não destrutiva</strong>
              <span>Recorte, cor e nitidez com desfazer</span>
            </div>
          </div>
          <div className="feature">
            <span className="feature__icon"><Cpu size={16} /></span>
            <div>
              <strong>Upscale IA local</strong>
              <span>ESRGAN 2×, 3×, 4× no seu PC</span>
            </div>
          </div>
        </div>

        <button type="button" className="empty__shortcuts" onClick={() => setShortcutsOpen(true)}>
          <Keyboard size={14} />
          Ver atalhos de teclado
        </button>
      </div>

      <div className="empty__drop">
        <ImagePlus size={16} />
        Solte arquivos aqui para abrir
      </div>
    </div>
  );
}
