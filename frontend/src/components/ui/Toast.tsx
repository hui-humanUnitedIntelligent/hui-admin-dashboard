// frontend/src/components/ui/Toast.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { zIndex } from './system';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id:      number;
  message: string;
  type:    ToastType;
}

let toastId = 0;
let globalShowToast: ((msg: string, type?: ToastType) => void) | null = null;

/** Imperativ-API: showToast('Gespeichert') — nutzbar ohne Hook */
export function showToast(message: string, type: ToastType = 'success') {
  if (globalShowToast) globalShowToast(message, type);
}

const TYPE_ICONS: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

const TYPE_COLORS: Record<ToastType, string> = {
  success: 'var(--accent)',
  error:   'var(--red)',
  info:    'var(--blue)',
  warning: 'var(--gold)',
};

/** ToastContainer: einmalig in layout.tsx einbinden */
export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  useEffect(() => {
    globalShowToast = addToast;
    return () => { globalShowToast = null; };
  }, [addToast]);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      aria-label="Benachrichtigungen"
      style={{
        position: 'fixed', bottom: 20, right: 20,
        zIndex: zIndex.toast,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          role="status"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-hover)',
            borderRadius: 12,
            padding: '10px 16px',
            fontSize: 12,
            color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: 8,
            animation: 'toastIn 0.2s ease',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            maxWidth: 360,
            pointerEvents: 'auto',
          }}
        >
          <span
            aria-hidden="true"
            style={{ color: TYPE_COLORS[toast.type], fontSize: 14, fontWeight: 600, flexShrink: 0 }}
          >
            {TYPE_ICONS[toast.type]}
          </span>
          <span style={{ flex: 1 }}>{toast.message}</span>
        </div>
      ))}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
