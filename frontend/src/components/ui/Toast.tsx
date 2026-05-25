'use client';

import { useState, useCallback, useEffect } from 'react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;
let globalShowToast: ((msg: string, type?: Toast['type']) => void) | null = null;

export function showToast(message: string, type: Toast['type'] = 'success') {
  if (globalShowToast) globalShowToast(message, type);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: Toast['type'] = 'success') => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    },
    []
  );

  useEffect(() => {
    globalShowToast = addToast;
    return () => { globalShowToast = null; };
  }, [addToast]);

  const TYPE_ICONS = { success: '✓', error: '✕', info: 'ℹ' };
  const TYPE_COLORS = {
    success: 'var(--accent)',
    error: 'var(--red)',
    info: 'var(--blue)',
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-hover)',
            borderRadius: 12,
            padding: '10px 16px',
            fontSize: 12,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'toastIn 0.2s ease',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          <span
            style={{
              color: TYPE_COLORS[toast.type],
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {TYPE_ICONS[toast.type]}
          </span>
          {toast.message}
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
