// frontend/src/components/dashboard/PageSection.tsx
// ── HUI Admin Dashboard — Einheitlicher Section-Wrapper ──────────────────────
'use client';

import React from 'react';

interface PageSectionProps {
  children:   React.ReactNode;
  title?:     string;
  actions?:   React.ReactNode;
  /** Kein Innen-Padding */
  noPadding?: boolean;
  style?:     React.CSSProperties;
}

export default function PageSection({
  children, title, actions, noPadding = false, style,
}: PageSectionProps) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
      ...style,
    }}>
      {title && (
        <div style={{
          padding: '11px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: 'var(--text-primary)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {title}
          </span>
          {actions}
        </div>
      )}
      <div style={noPadding ? undefined : { padding: 16 }}>
        {children}
      </div>
    </div>
  );
}
