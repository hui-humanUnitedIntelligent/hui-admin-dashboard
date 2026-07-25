// frontend/src/components/ui/Modal.tsx
'use client';

import { useEffect, useRef } from 'react';
import { zIndex } from './system';

interface ModalProps {
  open:       boolean;
  onClose:    () => void;
  title:      string;
  children:   React.ReactNode;
  footer?:    React.ReactNode;
  width?:     number;
  /** Verhindert Schließen via Overlay-Click */
  disableOutsideClick?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 420,
  disableOutsideClick = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId   = useRef(`modal-title-${Math.random().toString(36).slice(2)}`);

  // ── ESC-Taste schließt Modal ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // ── Focus-Trap: Fokus beim Öffnen ins Modal setzen ────────────────────────
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable[0]?.focus();
  }, [open]);

  // ── body scroll lock ──────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId.current}
      onClick={(e) => {
        if (!disableOutsideClick && e.target === e.currentTarget) onClose();
      }}
      className="modal-overlay"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: zIndex.modal,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(1px)',
      }}
    >
      <div
        ref={dialogRef}
        className="modal-box"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-hover)',
          borderRadius: 16,
          width,
          maxWidth: 'calc(100vw - 40px)',
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          animation: 'modalIn 0.15s ease',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h2
            id={titleId.current}
            style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Modal schließen"
            style={{
              width: 36, height: 36, borderRadius: 8,
              border: 'none', background: 'none',
              cursor: 'pointer', color: 'var(--text-muted)',
              fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s', flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: 8, justifyContent: 'flex-end',
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
      `}</style>
    </div>
  );
}
