// frontend/src/components/navigation/AdminNavigation.tsx
// ── Rollenbasierte Navigation — Single Source of Truth ──────────────────────
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { filterGroups, navLabel, groupLabel, ADMIN_NAV } from '@/config/navigation';
import { isSuperAdmin as checkSuperAdmin } from '@/lib/roles';

interface AdminNavigationProps {
  role?:    string;
  lang?:    string;
  onClose?: () => void;
}

export default function AdminNavigation({ role, lang = 'de', onClose }: AdminNavigationProps) {
  const pathname = usePathname();

  // Default: Gruppe mit aktivem Item ist offen
  const visibleGroups = filterGroups(ADMIN_NAV, role);
  const getDefaults = () => {
    const open: Record<string, boolean> = {};
    for (const g of visibleGroups) {
      open[g.id] = g.items.some(i =>
        pathname === i.href ||
        (i.href !== '/dashboard' && pathname.startsWith(i.href))
      );
    }
    return open;
  };
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getDefaults);

  const isActive = (href: string) =>
    pathname === href ||
    (href !== '/dashboard' && pathname.startsWith(href) && (pathname.length === href.length || pathname[href.length] === '/'));

  return (
    <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
      {visibleGroups.map(group => {
        const isOpen = openGroups[group.id] ?? false;
        return (
          <div key={group.id} style={{ marginBottom: 4 }}>
            {/* Gruppen-Header */}
            <button
              onClick={() => setOpenGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
              style={{
                width:          '100%',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                padding:        '6px 16px',
                background:     'none',
                border:         'none',
                cursor:         'pointer',
                color:          'var(--text-muted)',
                fontSize:       10,
                fontWeight:     600,
                letterSpacing:  '0.8px',
                textTransform:  'uppercase',
                transition:     'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <span>{groupLabel(group, lang)}</span>
              <span style={{ fontSize: 9, transition: 'transform 0.2s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
            </button>

            {/* Items */}
            {isOpen && (
              <div>
                {group.items.map(item => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      style={{
                        display:       'flex',
                        alignItems:    'center',
                        gap:           10,
                        padding:       '7px 16px 7px 22px',
                        marginBottom:  2,
                        borderRadius:  8,
                        textDecoration:'none',
                        fontSize:      13,
                        fontWeight:    active ? 500 : 400,
                        color:         active ? 'var(--accent)' : 'var(--text-secondary)',
                        background:    active ? 'var(--accent-dim)' : 'transparent',
                        transition:    'all 0.12s ease',
                        borderLeft:    active ? '2px solid var(--accent)' : '2px solid transparent',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'var(--bg-hover)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      <span style={{ fontSize: 14, lineHeight: 1, width: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</span>
                      <span>{navLabel(item, lang)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
