import { Spinner } from './ui/primitives';

export function BusyOverlay({ label }: { label: string }) {
  return (
    <div className="busy-overlay" role="status" aria-live="polite">
      <div className="busy-overlay__card">
        <Spinner size={20} />
        <span>{label}</span>
      </div>
    </div>
  );
}
