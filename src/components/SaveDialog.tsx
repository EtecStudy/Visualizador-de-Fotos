import { useEffect, useState } from 'react';
import { Download, FileImage, Save, ShieldCheck } from 'lucide-react';
import type { PhotoAsset } from '../core/types';
import { activeEdit, useAppStore } from '../state/useAppStore';
import { baseNameOf, formatBytes, formatLabel, saveFormatMeta, type SaveFormatId } from '../core/image/format';
import { editOutputSize } from '../core/editing/geometry';
import { exportPhoto } from '../core/image/export';
import { getFileService } from '../core/files';
import { formatDimensions, formatMegapixels } from '../utils/formatDisplay';
import { usePreviewCanvas } from '../hooks/usePreviewCanvas';
import { Modal, Segmented, Slider, Spinner } from './ui/primitives';
import { CanvasSurface } from './ui/CanvasSurface';

const FORMAT_OPTIONS: Array<{ value: SaveFormatId; label: string; hint: string }> = [
  { value: 'jpeg', label: 'JPEG', hint: 'Compatível com tudo, bom para fotos' },
  { value: 'png', label: 'PNG', hint: 'Sem perdas, ideal para transparência' },
  { value: 'webp', label: 'WEBP', hint: 'Arquivos menores com boa qualidade' },
];

export function SaveDialog() {
  const open = useAppStore((state) => state.saveOpen);
  const photo = useAppStore((state) => state.photos.find((entry) => entry.id === state.activeId) ?? null);
  const setSaveOpen = useAppStore((state) => state.setSaveOpen);

  return (
    <Modal
      open={open && Boolean(photo)}
      onClose={() => setSaveOpen(false)}
      title="Salvar imagem editada"
      subtitle="Uma nova cópia será criada — o arquivo original permanece intacto."
      icon={<Download size={18} />}
      size="md"
      dismissible
    >
      {photo && <SaveDialogBody photo={photo} onClose={() => setSaveOpen(false)} />}
    </Modal>
  );
}

function SaveDialogBody({ photo, onClose }: { photo: PhotoAsset; onClose: () => void }) {
  const edit = useAppStore(activeEdit);
  const notify = useAppStore((state) => state.notify);
  const service = getFileService();
  const [format, setFormat] = useState<SaveFormatId>('jpeg');
  const [quality, setQuality] = useState(92);
  const [name, setName] = useState(baseNameOf(photo.name));
  const [saving, setSaving] = useState(false);

  const preview = usePreviewCanvas(photo, edit, { maxDimension: 900, interactiveDimension: 700 });
  const meta = saveFormatMeta(format);
  const outputSize = editOutputSize(photo, edit);
  const qualitySupported = meta.supportsQuality;
  const finalName = `${sanitizeName(name) || baseNameOf(photo.name)}.${meta.extension}`;

  useEffect(() => {
    if (photo.format === 'PNG' || photo.format === 'GIF') {
      setFormat('png');
      setQuality(100);
    } else if (photo.format === 'WEBP') {
      setFormat('webp');
      setQuality(92);
    } else {
      setFormat('jpeg');
      setQuality(92);
    }
    setName(`${baseNameOf(photo.name)}-editada`);
  }, [photo.id, photo.format, photo.name]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const exported = await exportPhoto(photo, edit, { format, quality, fileName: finalName });
      const result = await service.saveImage(exported.blob, exported.fileName);
      if (result.saved) {
        notify(`Imagem salva: ${result.fileName ?? exported.fileName}`, 'success');
        onClose();
      } else if (result.error) {
        notify(result.error, 'error');
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível salvar a imagem.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="save-dialog">
      <div className="save-dialog__preview">
        <div className="save-dialog__preview-frame">
          <CanvasSurface canvas={preview.canvas} mode="contain" />
        </div>
        <div className="save-dialog__preview-meta">
          <span>{formatDimensions(outputSize.width, outputSize.height)} px</span>
          <span>{formatMegapixels(outputSize.width, outputSize.height)}</span>
        </div>
      </div>

      <div className="save-dialog__form">
        <label className="field">
          <span className="field__label">Nome do arquivo</span>
          <div className="field__input-row">
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              spellCheck={false}
              data-autofocus
            />
            <span className="field__suffix">.{meta.extension}</span>
          </div>
        </label>

        <div className="field">
          <span className="field__label">Formato</span>
          <Segmented options={FORMAT_OPTIONS} value={format} onChange={setFormat} ariaLabel="Formato de saída" />
        </div>

        {qualitySupported && (
          <div className="field">
            <span className="field__label">Qualidade</span>
            <Slider
              label="Compressão"
              value={quality}
              min={40}
              max={100}
              onChange={setQuality}
              format={(value) => `${value}%`}
            />
          </div>
        )}

        <dl className="save-dialog__meta">
          <div>
            <dt>
              <FileImage size={13} /> Original
            </dt>
            <dd>
              {formatLabel(photo.format)} · {formatDimensions(photo.width, photo.height)} ·{' '}
              {formatBytes(photo.sizeBytes)}
            </dd>
          </div>
          <div>
            <dt>
              <Save size={13} /> Novo arquivo
            </dt>
            <dd>
              {meta.label} · {formatDimensions(outputSize.width, outputSize.height)}
            </dd>
          </div>
        </dl>

        <p className="save-dialog__note">
          <ShieldCheck size={15} />
          O arquivo original nunca é alterado. Para sobrescrever, escolha a mesma pasta e nome no diálogo do
          sistema.
        </p>

        <div className="save-dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Spinner size={16} /> : <Download size={16} />}
            {saving ? 'Salvando…' : service.kind === 'desktop' ? 'Salvar como…' : 'Baixar imagem'}
          </button>
        </div>
      </div>
    </div>
  );
}

function sanitizeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '').trim();
}
