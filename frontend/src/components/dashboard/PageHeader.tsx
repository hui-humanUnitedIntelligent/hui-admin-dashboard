// frontend/src/components/dashboard/PageHeader.tsx
// ── HUI Admin Dashboard — Einheitlicher Page-Header ──────────────────────────
'use client';

import React from 'react';

interface PageHeaderProps {
  title:      string;
  subtitle?:  string;
  badge?:     React.ReactNode;
  actions?:   React.ReactNode;
  /** Trennlinie unterhalb */
  divider?:   boolean;
}

export default function PageHeader({
  title, subtitle, badge, actions, divider = false,
}: PageHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      marginBottom: divider ? 0 : 18,
      paddingBottom: divider ? 14 : 0,
      borderBottom: divider ? '1px solid var(--border)' : 'none',
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={{
            fontSize: 16, fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0, letterSpacing: '-0.2px',
          }}>
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p style={{
            fontSize: 12, color: 'var(--text-muted)',
            margin: '3px 0 0', lineHeight: 1.4,
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
