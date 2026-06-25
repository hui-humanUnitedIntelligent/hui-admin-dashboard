// frontend/src/components/layout/Section.tsx
// ── HUI Admin Dashboard — Einheitlicher Section-Wrapper ──────────────────────
'use client';

import React from 'react';
import { hasRole } from '@/lib/roles';
import type { Role } from '@/lib/roles';

export interface SectionProps {
  title?:        string;
  subtitle?:     string;
  actions?:      React.ReactNode;
  children:      React.ReactNode;
  /** Section nur anzeigen wenn User mindestens diese Rolle hat */
  requiredRole?: Role;
  /** Aktuelle Rolle des eingeloggten Users */
  userRole?:     string;
  /** Kein Card-Wrapper — direktes Rendering der Children */
  flat?:         boolean;
  /** Optionaler top-margin override (default: 28px zwischen Sections) */
  spacing?:      number;
  /** Padding innerhalb der Card (default: 20) */
  padding?:      number;
}

export default function Section({
  title,
  subtitle,
  actions,
  children,
  requiredRole,
  userRole,
  flat = false,
  spacing = 0,
  padding = 20,
}: SectionProps) {
  // Section ausblenden wenn Rolle nicht ausreicht
  if (requiredRole && !hasRole(userRole, requiredRole)) return null;

  const content = (
    <>
      {/* Section Header */}
      {(title || actions) && (
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            marginBottom:   title ? 16 : 0,
            gap:            12,
          }}
        >
          <div>
            {title && (
              <h2
                style={{
                  fontSize:      13,
                  fontWeight:    600,
                  color:         'var(--text-secondary)',
                  margin:        0,
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                }}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
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
      )}
      {children}
    </>
  );

  if (flat) {
    return (
      <div style={{ marginTop: spacing }}>
        {content}
      </div>
    );
  }

  return (
    <div
      style={{
        background:   'var(--bg-secondary)',
        border:       '1px solid var(--border)',
        borderRadius: 12,
        padding:      padding,
        marginTop:    spacing,
      }}
    >
      {content}
    </div>
  );
}
