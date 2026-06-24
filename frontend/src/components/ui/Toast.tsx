// frontend/src/components/ui/Toast.tsx
'use client';

import { useEffect, useState } from 'react';
import { zIndex } from './system';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message:    string;
  type?:      ToastType;
  duration?:  number;
  onClose?:   () => void;
}

const TOAST_STYLES: Record<ToastType, { border: string; icon: string }> = {
  success: { border: 'var(--green)',  icon: '✓' },
  error:   { border: 'var(--red)',    icon: '✕' },
  warning: { border: 'var(--gold)',   icon: '⚠' },
  info:    { border: 'var(--blue)',   icon: 'ℹ' },
};

export default function Toast({
  message,
  type = 'success',
  duration = 3500,
  onClose,
}: ToastProps) {
  const [visible, setVisible] = useState(true);
  const style = TOAST_STYLES[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose?.(), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed', bottom: 24, right: 24,
        zIndex: zIndex.toast,
        padding: '10px 16px',
        background: 'var(--bg-secondary)',
        border: `1px solid ${style.border}`,
        borderRadius: 10,
        boxShadow: 'var(--shadow-lg)',
        display: 'flex', alignItems: 'center', gap: 10,
        minWidth: 220, maxWidth: 360,
        transition: 'all 0.3s ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <span style={{ fontSize: 16, color: style.border, flexShrink: 0 }} aria-hidden="true">
        {style.icon}
      </span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1, lineHeight: 1.4 }}>
        {message}
      </span>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onClose?.(), 300); }}
        aria-label="Benachrichtigung schließen"
        style={{
          background: 'none', border: 'none',
          color: 'var(--text-muted)', cursor: 'pointer',
          fontSize: 13, padding: 2, lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

/** Toast-Manager: mehrere Toasts verwalten */
export interface ToastMessage {
  id:      string;
  message: string;
  type:    ToastType;
}

interface ToastContainerProps {
  toasts:   ToastMessage[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div
      aria-label="Benachrichtigungen"
      style={{
        position: 'fixed', bottom: 24, right: 24,
        zIndex: zIndex.toast,
        display: 'flex', flexDirection: 'column', gap: 8,
        alignItems: 'flex-end',
      }}
    >
      {toasts.map(t => (
        <Toast
          key={t.id}
          message={t.message}
          type={t.type}
          onClose={() => onRemove(t.id)}
        />
      ))}
    </div>
  );
}
