// frontend/src/components/layout/PageHeader.tsx
// ── HUI Admin Dashboard — Einheitlicher Page-Header ──────────────────────────
'use client';

import React from 'react';
import Link from 'next/link';
import { hasRole } from '@/lib/roles';
import type { Role } from '@/lib/roles';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title:        string;
  subtitle?:    string;
  breadcrumbs?: BreadcrumbItem[];
  actions?:     React.ReactNode;
  /** Actions nur anzeigen wenn der User mindestens diese Rolle hat */
  actionsRole?: Role;
  /** Aktuelle Rolle des eingeloggten Users */
  userRole?:    string;
  /** Optionaler Badge neben dem Titel (z.B. "Beta", Zähler) */
  badge?:       React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  actions,
  actionsRole,
  userRole,
  badge,
}: PageHeaderProps) {
  // Actions anzeigen wenn: keine Rollenanforderung ODER User hat die Rolle
  const showActions = !actionsRole || hasRole(userRole, actionsRole);

  return (
    <div
      style={{
        display:       'flex',
        alignItems:    'center',
        justifyContent:'space-between',
        minHeight:     56,
        padding:       '0 0 24px 0',
        gap:           16,
        borderBottom:  '1px solid var(--border)',
        marginBottom:  28,
        animation:     'fadeIn 0.2s ease',
      }}
    >
      {/* Left: Breadcrumbs + Title + Subtitle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>›</span>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    style={{
                      color:          'var(--text-muted)',
                      fontSize:       11,
                      textDecoration: 'none',
                      transition:     'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Title + Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1
            style={{
              fontSize:      22,
              fontWeight:    650,
              color:         'var(--text-primary)',
              margin:        0,
              letterSpacing: '-0.4px',
              lineHeight:    1.2,
              overflow:      'hidden',
              textOverflow:  'ellipsis',
              whiteSpace:    'nowrap',
            }}
          >
            {title}
          </h1>
          {badge && (
            <span style={{ flexShrink: 0 }}>{badge}</span>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p
            style={{
              fontSize:   13,
              color:      'var(--text-muted)',
              margin:     0,
              lineHeight: 1.4,
              marginTop:  2,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Right: Actions (rollenbasiert) */}
      {showActions && actions && (
        <div
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        8,
            flexShrink: 0,
            flexWrap:   'nowrap',
            justifyContent: 'flex-end',
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
