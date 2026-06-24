// frontend/src/components/ui/Card.tsx
// ── HUI Admin Dashboard — Einheitliche Card-Komponente ───────────────────────
'use client';

import React from 'react';

interface CardProps {
  children:   React.ReactNode;
  header?:    React.ReactNode;
  footer?:    React.ReactNode;
  padding?:   number | string;
  style?:     React.CSSProperties;
  /** Klickbare Card */
  onClick?:   () => void;
  /** Kein Border */
  flat?:      boolean;
}

export default function Card({
  children, header, footer,
  padding = 16,
  style,
  onClick,
  flat = false,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
      style={{
        background: 'var(--bg-secondary)',
        border: flat ? 'none' : '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
        ...style,
      }}
      onMouseEnter={onClick ? e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hover)'; } : undefined}
      onMouseLeave={onClick ? e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; } : undefined}
    >
      {header && (
        <div style={{
          padding: `12px ${typeof padding === 'number' ? padding : padding}px`,
          borderBottom: '1px solid var(--border)',
          fontWeight: 500, fontSize: 13, color: 'var(--text-primary)',
        }}>
          {header}
        </div>
      )}
      <div style={{
        padding: typeof padding === 'number' ? padding : padding,
      }}>
        {children}
      </div>
      {footer && (
        <div style={{
          padding: `10px ${typeof padding === 'number' ? padding : padding}px`,
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-tertiary)',
        }}>
          {footer}
        </div>
      )}
    </div>
  );
}
