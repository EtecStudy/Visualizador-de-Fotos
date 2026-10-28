import { useEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  tone?: 'default' | 'danger';
};

export function IconButton({ label, active, tone = 'default', className = '', children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? 'is-active' : ''} ${tone === 'danger' ? 'icon-btn--danger' : ''} ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      {...props}
    >
      {children}
    </button>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  onCommit?: () => void;
  onReset?: () => void;
  accent?: 'default' | 'neutral';
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  format = (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`,
  onChange,
  onCommit,
  onReset,
  accent = 'default',
}: SliderProps) {
  const resetting = useRef(false);
  const progress = ((value - min) / (max - min)) * 100;
  const isNeutral = Math.abs(value) < 0.001;

  return (
    <div className={`slider ${disabled ? 'is-disabled' : ''} slider--${accent}`}>
      <div className="slider__head">
        <span className="slider__label">{label}</span>
        <div className="slider__value-group">
          <span className={`slider__value ${isNeutral ? 'is-neutral' : ''}`}>{format(value)}</span>
          {onReset && (
            <button
              type="button"
              className="slider__reset"
              title={`Redefinir ${label.toLowerCase()}`}
              onClick={() => {
                resetting.current = true;
                onReset();
              }}
              disabled={isNeutral || disabled}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <input
        className="slider__input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        style={{ '--slider-progress': `${progress}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerDown={() => {
          resetting.current = false;
        }}
        onPointerUp={() => onCommit?.()}
        onPointerCancel={() => onCommit?.()}
        onKeyUp={() => onCommit?.()}
        onBlur={() => onCommit?.()}
        onDoubleClick={() => {
          if (!resetting.current) onReset?.();
        }}
      />
    </div>
  );
}

interface SwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
}

export function Switch({ label, description, checked, onChange, icon }: SwitchProps) {
  return (
    <button
      type="button"
      className={`switch-row ${checked ? 'is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      {icon && <span className="switch-row__icon">{icon}</span>}
      <span className="switch-row__text">
        <span className="switch-row__label">{label}</span>
        {description && <span className="switch-row__description">{description}</span>}
      </span>
      <span className="switch">
        <span className="switch__thumb" />
      </span>
    </button>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  dismissible?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = 'md',
  dismissible = true,
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        if (dismissible) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) return;
      const focusable = cardRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    const timer = setTimeout(() => {
      cardRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }, 40);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      clearTimeout(timer);
      previous?.focus?.();
    };
  }, [open, dismissible]);

  if (!open) return null;

  return createPortal(
    <div className="modal-root">
      <div className="modal-backdrop" onMouseDown={dismissible ? onClose : undefined} />
      <div className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={cardRef}>
        <header className="modal__header">
          {icon && <span className="modal__icon">{icon}</span>}
          <div className="modal__heading">
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {dismissible && (
            <IconButton label="Fechar" onClick={onClose}>
              <X size={18} />
            </IconButton>
          )}
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

interface SegmentedProps<T extends string> {
  options: Array<{ value: T; label: string; hint?: string }>;
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md', ariaLabel }: SegmentedProps<T>) {
  return (
    <div className={`segmented segmented--${size}`} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          title={option.hint}
          className={`segmented__item ${value === option.value ? 'is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span className="spinner" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.6" opacity="0.18" />
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite" />
        </path>
      </svg>
    </span>
  );
}
