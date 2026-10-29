import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Cpu,
  Download,
  Gauge,
  HardDrive,
  ImagePlus,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import type { PhotoAsset } from '../core/types';
import { activeEdit, useAppStore } from '../state/useAppStore';
import { editOutputSize } from '../core/editing/geometry';
import { baseNameOf } from '../core/image/format';
import { canvasToBlob } from '../core/image/canvas';
import { renderPhotoForExport } from '../core/render/photoRenderer';
import { getFileService } from '../core/files';
import { usePreviewCanvas } from '../hooks/usePreviewCanvas';
import {
  abortEngine,
  chainLabel,
  getEngine,
  listEngines,
  planScaleChain,
  scaledSize,
  UPSCALE_SCALE_OPTIONS,
  UpscaleCancelledError,
  type UpscaleEngineId,
} from '../core/upscale';
import { formatDimensions, formatMegapixels } from '../utils/formatDisplay';
import { Modal, Segmented, Spinner } from './ui/primitives';
import { CanvasSurface } from './ui/CanvasSurface';
import { SplitCompare } from './ui/SplitCompare';

type Phase = 'setup' | 'running' | 'done' | 'error';
type OutputFormat = 'png' | 'jpeg' | 'webp';

interface UpscaleResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  scale: number;
  durationMs: number;
}

const ENGINE_ICONS: Record<UpscaleEngineId, typeof Cpu> = {
  esrgan: Cpu,
  lanczos: Gauge,
};

export function UpscaleDialog() {
  const open = useAppStore((state) => state.upscaleOpen);
  const setOpen = useAppStore((state) => state.setUpscaleOpen);
  const photo = useAppStore((state) => state.photos.find((entry) => entry.id === state.activeId) ?? null);
  const [phase, setPhase] = useState<Phase>('setup');

  const close = () => {
    setPhase('setup');
    setOpen(false);
  };

  return (
    <Modal
      open={open && Boolean(photo)}
      onClose={close}
      title="Upscale por IA"
      subtitle="Super-resolução local com TensorFlow.js — nenhuma imagem sai do seu computador."
      icon={<Sparkles size={18} />}
      size="lg"
      dismissible={phase !== 'running'}
    >
      {photo && open && <UpscaleBody photo={photo} phase={phase} setPhase={setPhase} onClose={close} />}
    </Modal>
  );
}

interface UpscaleBodyProps {
  photo: PhotoAsset;
  phase: Phase;
  setPhase: (phase: Phase) => void;
  onClose: () => void;
}

function UpscaleBody({ photo, phase, setPhase, onClose }: UpscaleBodyProps) {
  const edit = useAppStore(activeEdit);
  const scale = useAppStore((state) => state.upscaleScale);
  const engineId = useAppStore((state) => state.upscaleEngine);
  const patchSize = useAppStore((state) => state.upscalePatchSize);
  const setUpscaleSettings = useAppStore((state) => state.setUpscaleSettings);
  const notify = useAppStore((state) => state.notify);
  const addGeneratedBlob = useAppStore((state) => state.addGeneratedBlob);
  const setActive = useAppStore((state) => state.setActive);
  const setMode = useAppStore((state) => state.setMode);
  const service = getFileService();

  const [progress, setProgress] = useState({ value: 0, message: '' });
  const [error, setError] = useState('');
  const [result, setResult] = useState<UpscaleResult | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png');
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const preview = usePreviewCanvas(photo, edit, { maxDimension: 1200, interactiveDimension: 900 });
  const baseSize = editOutputSize(photo, edit);
  const targetSize = scaledSize(baseSize, scale);
  const targetPixels = targetSize.width * targetSize.height;
  const engine = getEngine(engineId);
  const tooBig = targetPixels > engine.maxOutputPixels;
  const heavy = targetPixels > 24_000_000;
  const chain = (() => {
    try {
      return planScaleChain(scale);
    } catch {
      return [];
    }
  })();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      abortEngine(engineId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;
    const startedAt = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => clearInterval(timer);
  }, [phase]);

  const start = async () => {
    if (phase === 'running') return;
    setPhase('running');
    setError('');
    setResult(null);
    setProgress({ value: 0, message: 'Preparando a imagem em resolução total…' });
    await new Promise((resolve) => setTimeout(resolve, 90));

    const controller = new AbortController();
    controllerRef.current = controller;
    const startedAt = performance.now();

    try {
      const rendered = renderPhotoForExport(photo, edit);
      const output = await engine.upscale({
        source: rendered.canvas,
        scale,
        patchSize,
        signal: controller.signal,
        onProgress: (next) => {
          if (mountedRef.current) setProgress(next);
        },
      });
      if (!mountedRef.current) return;
      setResult({
        canvas: output,
        width: output.width,
        height: output.height,
        scale,
        durationMs: performance.now() - startedAt,
      });
      setPhase('done');
      notify('Upscale concluído. Compare o antes/depois e salve o resultado.', 'success');
    } catch (caught) {
      if (!mountedRef.current) return;
      if (caught instanceof UpscaleCancelledError || controller.signal.aborted) {
        setPhase('setup');
        setProgress({ value: 0, message: '' });
        notify('Upscale cancelado.', 'info');
      } else {
        setError(caught instanceof Error ? caught.message : 'Falha inesperada durante o upscale.');
        setPhase('error');
      }
    } finally {
      controllerRef.current = null;
    }
  };

  const cancel = () => {
    setProgress((current) => ({ ...current, message: 'Cancelando…' }));
    controllerRef.current?.abort();
    abortEngine(engineId);
  };

  const encodeResult = async (format: OutputFormat) => {
    if (!result) throw new Error('Nenhum resultado disponível.');
    const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
    const extension = format === 'jpeg' ? 'jpg' : format;
    const blob = await canvasToBlob(result.canvas, mime, format === 'png' ? undefined : 0.95);
    return { blob, fileName: `${baseNameOf(photo.name)}-upscale-${result.scale}x.${extension}` };
  };

  const saveResult = async () => {
    if (!result || saving) return;
    setSaving(true);
    try {
      const { blob, fileName } = await encodeResult(outputFormat);
      const saved = await service.saveImage(blob, fileName);
      if (saved.saved) {
        notify(`Upscale salvo como ${saved.fileName ?? fileName}`, 'success');
        onClose();
      } else if (saved.error) {
        notify(saved.error, 'error');
      }
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Falha ao salvar o upscale.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addToLibrary = async () => {
    if (!result || saving) return;
    setSaving(true);
    try {
      const { blob, fileName } = await encodeResult('png');
      const asset = await addGeneratedBlob(blob, fileName, 'upscale');
      if (asset) {
        setActive(asset.id);
        setMode('view');
        notify('Imagem ampliada adicionada à biblioteca.', 'success');
        onClose();
      }
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Falha ao adicionar à biblioteca.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (phase === 'running') {
    return (
      <>
        <div className="upscale-running">
          <div className="upscale-running__icon">
            <Sparkles size={26} />
          </div>
          <h3>Reconstruindo detalhes com IA local</h3>
          <p className="upscale-running__message">{progress.message || 'Carregando modelo…'}</p>
          <div className="progress">
            <div className="progress__bar" style={{ width: `${Math.round(progress.value * 100)}%` }} />
          </div>
          <div className="upscale-running__meta">
            <span>{Math.round(progress.value * 100)}%</span>
            <span>{(elapsed / 1000).toFixed(1)} s</span>
            <span>
              {chain.length ? chainLabel(chain) : `${scale}×`} · {formatDimensions(targetSize.width, targetSize.height)} px
            </span>
          </div>
          <p className="upscale-running__hint">
            O processamento acontece no seu computador. Dependendo do tamanho da imagem e da GPU, pode levar de
            alguns segundos a alguns minutos.
          </p>
        </div>
        <footer className="modal__footer">
          <span className="modal__footer-note">
            <HardDrive size={14} />
            100% local
          </span>
          <button type="button" className="btn btn--ghost" onClick={cancel}>
            <X size={16} />
            Cancelar upscale
          </button>
        </footer>
      </>
    );
  }

  if (phase === 'error') {
    return (
      <>
        <div className="upscale-error">
          <span className="upscale-error__icon">
            <AlertTriangle size={22} />
          </span>
          <div>
            <h3>Não foi possível concluir o upscale</h3>
            <p>{error}</p>
            <p className="upscale-error__hint">
              Dicas: tente uma escala menor, reduza o recorte ou use o motor Lanczos para imagens muito grandes.
            </p>
          </div>
        </div>
        <footer className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Fechar
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void start()}>
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </footer>
      </>
    );
  }

  if (phase === 'done' && result) {
    return (
      <>
        <div className="upscale-result">
          <SplitCompare
            className="upscale-result__compare"
            before={<CanvasSurface canvas={preview.canvas} mode="contain" />}
            after={<CanvasSurface canvas={result.canvas} mode="contain" />}
            beforeLabel="Antes"
            afterLabel={`Depois (${result.scale}×)`}
          />
          <div className="upscale-result__stats">
            <div>
              <span>Original</span>
              <strong>{formatDimensions(baseSize.width, baseSize.height)}</strong>
              <em>{formatMegapixels(baseSize.width, baseSize.height)}</em>
            </div>
            <ArrowRight size={16} className="upscale-result__arrow" />
            <div>
              <span>Ampliado</span>
              <strong>{formatDimensions(result.width, result.height)}</strong>
              <em>{formatMegapixels(result.width, result.height)}</em>
            </div>
            <div className="upscale-result__time">
              <span>Tempo</span>
              <strong>{(result.durationMs / 1000).toFixed(1)} s</strong>
              <em>{engine.label}</em>
            </div>
          </div>
          <div className="upscale-result__row">
            <span className="field__label">Formato de saída</span>
            <Segmented
              size="sm"
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpeg', label: 'JPEG' },
                { value: 'webp', label: 'WEBP' },
              ]}
              value={outputFormat}
              onChange={setOutputFormat}
              ariaLabel="Formato do arquivo ampliado"
            />
            <span className="upscale-result__filename">.{outputFormat === 'jpeg' ? 'jpg' : outputFormat}</span>
          </div>
        </div>
        <footer className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={() => setPhase('setup')} disabled={saving}>
            <RefreshCw size={15} />
            Novo upscale
          </button>
          <div className="modal__footer-actions">
            <button type="button" className="btn btn--soft" onClick={() => void addToLibrary()} disabled={saving}>
              <ImagePlus size={16} />
              Adicionar à biblioteca
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void saveResult()} disabled={saving}>
              {saving ? <Spinner size={16} /> : <Download size={16} />}
              {saving ? 'Preparando…' : 'Salvar imagem'}
            </button>
          </div>
        </footer>
      </>
    );
  }

  return (
    <>
      <div className="upscale-setup">
        <div className="upscale-setup__preview">
          <div className="upscale-setup__frame">
            <CanvasSurface canvas={preview.canvas} mode="contain" />
          </div>
          <div className="upscale-setup__preview-meta">
            <span>{formatDimensions(baseSize.width, baseSize.height)} px</span>
            <span className="chip chip--local">
              <HardDrive size={11} />
              local
            </span>
          </div>
        </div>

        <div className="upscale-setup__controls">
          <div className="field">
            <span className="field__label">Escala</span>
            <div className="scale-grid">
              {UPSCALE_SCALE_OPTIONS.map((option) => {
                const size = scaledSize(baseSize, option.scale);
                const pixels = size.width * size.height;
                const disabled = pixels > engine.maxOutputPixels;
                return (
                  <button
                    key={option.scale}
                    type="button"
                    className={`scale-btn ${scale === option.scale ? 'is-active' : ''}`}
                    onClick={() => setUpscaleSettings({ scale: option.scale })}
                    title={option.hint}
                    disabled={disabled}
                  >
                    <strong>{option.label}</strong>
                    <span>
                      {formatDimensions(size.width, size.height)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="resolution-flow">
            <div className="resolution-flow__side">
              <span>Original</span>
              <strong>{formatDimensions(baseSize.width, baseSize.height)}</strong>
              <em>{formatMegapixels(baseSize.width, baseSize.height)}</em>
            </div>
            <span className="resolution-flow__arrow">
              <ArrowRight size={18} />
              <em>{scale}×</em>
            </span>
            <div className="resolution-flow__side resolution-flow__side--accent">
              <span>Resultado</span>
              <strong>{formatDimensions(targetSize.width, targetSize.height)}</strong>
              <em>{formatMegapixels(targetSize.width, targetSize.height)}</em>
            </div>
          </div>

          {(tooBig || heavy) && (
            <div className={`upscale-warning ${tooBig ? 'is-error' : ''}`}>
              <AlertTriangle size={15} />
              <span>
                {tooBig
                  ? `Resultado acima do limite do motor (${Math.round(engine.maxOutputPixels / 1_000_000)} MP). Escolha uma escala menor.`
                  : 'Imagem grande: o processamento pode levar alguns minutos e consumir bastante memória.'}
              </span>
            </div>
          )}

          <div className="field">
            <span className="field__label">Motor de upscale</span>
            <div className="engine-list">
              {listEngines().map((option) => {
                const Icon = ENGINE_ICONS[option.id];
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`engine-card ${engineId === option.id ? 'is-active' : ''}`}
                    onClick={() => setUpscaleSettings({ engineId: option.id })}
                  >
                    <span className="engine-card__icon">
                      <Icon size={17} />
                    </span>
                    <span className="engine-card__text">
                      <span className="engine-card__title">
                        {option.label}
                        {option.id === 'esrgan' && <span className="chip chip--accent-soft">IA</span>}
                      </span>
                      <span className="engine-card__description">{option.description}</span>
                    </span>
                    <span className="engine-card__check">
                      {engineId === option.id && <Check size={15} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {engineId === 'esrgan' && (
            <div className="field field--row">
              <span className="field__label">Qualidade × velocidade</span>
              <Segmented
                size="sm"
                options={[
                  { value: '64', label: 'Detalhe' },
                  { value: '128', label: 'Equilibrado' },
                  { value: '256', label: 'Rápido' },
                ]}
                value={String(patchSize)}
                onChange={(value) => setUpscaleSettings({ patchSize: Number(value) })}
                ariaLabel="Tamanho do bloco de processamento"
              />
            </div>
          )}

          <p className="upscale-setup__note">
            <Cpu size={14} />
            {engineId === 'esrgan'
              ? `ESRGAN-Slim (RDN) ${chain.length > 1 ? `encadeado: ${chainLabel(chain)}` : `${scale}×`} · pesos de ~1 MB por escala incluídos no app, executados no seu PC.`
              : 'Lanczos é uma reamostragem clássica (sem IA): rápida e sem artefatos de rede, porém sem reconstruir detalhes.'}
          </p>
        </div>
      </div>

      <footer className="modal__footer">
        <span className="modal__footer-note">
          <HardDrive size={14} />
          Nada é enviado para a internet
        </span>
        <div className="modal__footer-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--accent"
            onClick={() => void start()}
            disabled={tooBig || !chain.length}
            data-autofocus
          >
            <Sparkles size={16} />
            Iniciar upscale {scale}×
          </button>
        </div>
      </footer>
    </>
  );
}
