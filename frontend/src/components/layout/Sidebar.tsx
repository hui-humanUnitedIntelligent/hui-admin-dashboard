// frontend/src/components/layout/Sidebar.tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSettings } from '@/components/providers/ThemeProvider';
import { useSystemHealth } from '@/lib/hooks/useSupabase';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  group: string;
}

const NAV_DE: NavItem[] = [
  { href: '/dashboard',    label: 'Dashboard',        icon: '⊞', group: 'Übersicht'  },
  { href: '/users',        label: 'User-Management',  icon: '◎', group: 'Management' },
  { href: '/admins',       label: 'Admin-Verwaltung', icon: '🛡️', group: 'Management' },
  { href: '/talents',      label: 'Talent-Pool',      icon: '⭐', group: 'Management' },
  { href: '/transactions', label: 'Transaktionen',    icon: '⇄', group: 'Management' },
  { href: '/bookings',     label: 'Buchungen',        icon: '📅', group: 'Management' },
  { href: '/impact',       label: 'Impact Pool',      icon: '🌱', group: 'Management' },
  { href: '/works',        label: 'Werke & Content',  icon: '🎨', group: 'Content'    },
  { href: '/memberships',  label: 'Mitgliedschaften', icon: '🏅', group: 'Content'    },
  { href: '/audit',        label: 'Audit Logs',       icon: '📋', group: 'System'     },
  { href: '/system',       label: 'System Status',    icon: '🔧', group: 'System'     },
  { href: '/exports',      label: 'Daten-Export',     icon: '📥', group: 'System'     },
  { href: '/settings',     label: 'Einstellungen',    icon: '⚙',  group: 'System'     },
];

const NAV_EN: NavItem[] = [
  { href: '/dashboard',    label: 'Dashboard',        icon: '⊞', group: 'Overview'   },
  { href: '/users',        label: 'User Management',  icon: '◎', group: 'Management' },
  { href: '/admins',       label: 'Admin Management', icon: '🛡️', group: 'Management' },
  { href: '/talents',      label: 'Talent Pool',      icon: '⭐', group: 'Management' },
  { href: '/transactions', label: 'Transactions',     icon: '⇄', group: 'Management' },
  { href: '/bookings',     label: 'Bookings',         icon: '📅', group: 'Management' },
  { href: '/impact',       label: 'Impact Pool',      icon: '🌱', group: 'Management' },
  { href: '/works',        label: 'Werke & Content',  icon: '🎨', group: 'Content'    },
  { href: '/memberships',  label: 'Memberships',      icon: '🏅', group: 'Content'    },
  { href: '/audit',        label: 'Audit Logs',       icon: '📋', group: 'System'     },
  { href: '/system',       label: 'System Status',    icon: '🔧', group: 'System'     },
  { href: '/exports',      label: 'Data Export',      icon: '📥', group: 'System'     },
  { href: '/settings',     label: 'Settings',         icon: '⚙',  group: 'System'     },
];

const GROUPS_DE = ['Übersicht', 'Management', 'Content', 'System'];
const GROUPS_EN = ['Overview',  'Management', 'Content', 'System'];

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { logout, currentUser } = useAuth();
  const { lang } = useSettings();
  const { supabase: dbStatus } = useSystemHealth(60000);

  const NAV    = lang === 'en' ? NAV_EN    : NAV_DE;
  const GROUPS = lang === 'en' ? GROUPS_EN : GROUPS_DE;

  const grouped = GROUPS.reduce<Record<string, NavItem[]>>((acc, g) => {
    acc[g] = NAV.filter((n) => n.group === g);
    return acc;
  }, {});

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 999, display: 'none',
          }}
          className="hide-desktop"
        />
      )}

      <aside
        style={{
          width: 230,
          minWidth: 230,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          transition: 'transform 0.3s ease',
        }}
      >
        {/* ── Logo ── */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36, height: 36,
                background: 'linear-gradient(135deg, var(--accent), #2BC5BB)',
                borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 11, fontWeight: 700,
                color: '#0F1117', letterSpacing: '0.5px',
                boxShadow: '0 0 12px rgba(78,205,196,0.3)',
              }}
            >
              HUI
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Admin Control
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <span className="live-dot" style={{ width: 5, height: 5 }} />
                <span style={{ fontSize: 10, color: dbStatus === 'ok' ? 'var(--green)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {dbStatus === 'ok' ? 'Live' : dbStatus === 'error' ? 'Offline' : 'Connecting'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
          {GROUPS.map((group) => (
            <div key={group}>
              <div
                style={{
                  fontSize: 9, fontWeight: 700,
                  letterSpacing: '1.8px', textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  padding: '10px 20px 4px',
                }}
              >
                {group}
              </div>
              {grouped[group].map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '8px 20px',
                      textDecoration: 'none',
                      fontSize: 12.5,
                      borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                      background: active ? 'var(--accent-dim)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      transition: 'all 0.12s',
                      fontWeight: active ? 500 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── Footer: Admin User ── */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px',
              background: 'var(--bg-tertiary)',
              borderRadius: 10,
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent), #2BC5BB)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#0F1117', flexShrink: 0,
              }}
            >
              {getInitials(currentUser?.name || 'Admin')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11.5, fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {currentUser?.name || 'Admin'}
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                {currentUser?.role || 'Super Admin'}
              </div>
            </div>
            <button
              onClick={logout}
              title="Abmelden"
              style={{
                background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-muted)',
                fontSize: 14, padding: 2, lineHeight: 1,
                transition: 'color 0.15s',
                borderRadius: 4,
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--red)')}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
            >
              ⏏
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

