import { Check, Crop, Redo2, RotateCcw, RotateCw, SlidersHorizontal, Undo2 } from 'lucide-react';
import { activeEdit, useAppStore } from '../state/useAppStore';
import { isEditDirty } from '../core/editing/defaults';
import { AdjustPanel } from './panels/AdjustPanel';
import { CropPanel } from './panels/CropPanel';
import { TransformPanel } from './panels/TransformPanel';

export function Inspector() {
  const toolTab = useAppStore((state) => state.toolTab);
  const setToolTab = useAppStore((state) => state.setToolTab);
  const setMode = useAppStore((state) => state.setMode);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const resetAllEdits = useAppStore((state) => state.resetAllEdits);
  const canUndo = useAppStore((state) => state.past.length > 0);
  const canRedo = useAppStore((state) => state.future.length > 0);
  const dirty = useAppStore((state) => isEditDirty(activeEdit(state)));

  return (
    <aside className="inspector" aria-label="Ferramentas de edição">
      <div className="inspector__tabs" role="tablist" aria-label="Ferramentas">
        <button
          type="button"
          role="tab"
          aria-selected={toolTab === 'adjust'}
          className={`inspector__tab ${toolTab === 'adjust' ? 'is-active' : ''}`}
          onClick={() => setToolTab('adjust')}
        >
          <SlidersHorizontal size={16} />
          Ajustes
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={toolTab === 'crop'}
          className={`inspector__tab ${toolTab === 'crop' ? 'is-active' : ''}`}
          onClick={() => setToolTab('crop')}
        >
          <Crop size={16} />
          Recortar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={toolTab === 'transform'}
          className={`inspector__tab ${toolTab === 'transform' ? 'is-active' : ''}`}
          onClick={() => setToolTab('transform')}
        >
          <RotateCw size={16} />
          Transformar
        </button>
      </div>

      <div className="inspector__body">
        {toolTab === 'adjust' && <AdjustPanel />}
        {toolTab === 'crop' && <CropPanel />}
        {toolTab === 'transform' && <TransformPanel />}
      </div>

      <footer className="inspector__footer">
        <div className="history-buttons">
          <button type="button" className="btn btn--ghost btn--sm" onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">
            <Undo2 size={15} />
            Desfazer
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={redo}
            disabled={!canRedo}
            title="Refazer (Ctrl+Shift+Z)"
          >
            <Redo2 size={15} />
            Refazer
          </button>
        </div>
        <div className="inspector__footer-row">
          <button type="button" className="btn btn--ghost btn--sm" onClick={resetAllEdits} disabled={!dirty}>
            <RotateCcw size={15} />
            Redefinir
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setMode('view')}>
            <Check size={15} />
            Concluir
          </button>
        </div>
      </footer>
    </aside>
  );
}
