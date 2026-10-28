import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useAppStore } from '../state/useAppStore';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

export function Toast() {
  const toast = useAppStore((state) => state.toast);
  const dismiss = useAppStore((state) => state.dismissToast);
  if (!toast) return null;
  const Icon = ICONS[toast.tone];

  return (
    <div className={`toast toast--${toast.tone}`} key={toast.id} role="status" aria-live="polite">
      <span className="toast__icon">
        <Icon size={17} />
      </span>
      <span className="toast__message">{toast.message}</span>
      <button type="button" className="toast__close" onClick={dismiss} aria-label="Fechar aviso">
        <X size={14} />
      </button>
    </div>
  );
}
