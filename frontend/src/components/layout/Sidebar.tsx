'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',     label: 'Dashboard',       icon: '⊞' },
  { href: '/users',         label: 'Users',            icon: '◎', badge: 12 },
  { href: '/transactions',  label: 'Transaktionen',    icon: '⇄' },
  { href: '/impact',        label: 'Impact Pool',      icon: '◈' },
  { href: '/settings',      label: 'Einstellungen',    icon: '⚙' },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, currentUser } = useAuth();

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              background: 'var(--accent)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Space Mono, monospace',
              fontSize: 11,
              fontWeight: 700,
              color: '#0F1117',
              letterSpacing: '0.5px',
            }}
          >
            HUI
          </div>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              HUI Admin
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              Control Center
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            padding: '8px 20px 4px',
          }}
        >
          Übersicht
        </div>
        <Link
          href="/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 20px',
            textDecoration: 'none',
            fontSize: 13,
            borderLeft: `2px solid ${pathname === '/dashboard' ? 'var(--accent)' : 'transparent'}`,
            background: pathname === '/dashboard' ? 'var(--accent-dim)' : 'transparent',
            color: pathname === '/dashboard' ? 'var(--accent)' : 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 15 }}>⊞</span> Dashboard
        </Link>

        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            padding: '12px 20px 4px',
          }}
        >
          Management
        </div>

        {NAV_ITEMS.slice(1, 4).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 20px',
                textDecoration: 'none',
                fontSize: 13,
                borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 15, width: 18 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span
                  style={{
                    background: 'var(--accent)',
                    color: '#0F1117',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 10,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            padding: '12px 20px 4px',
          }}
        >
          System
        </div>
        <Link
          href="/settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 20px',
            textDecoration: 'none',
            fontSize: 13,
            borderLeft: `2px solid ${pathname === '/settings' ? 'var(--accent)' : 'transparent'}`,
            background: pathname === '/settings' ? 'var(--accent-dim)' : 'transparent',
            color: pathname === '/settings' ? 'var(--accent)' : 'var(--text-secondary)',
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 15 }}>⚙</span> Einstellungen
        </Link>
      </nav>

      {/* Footer: Admin-User */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            background: 'var(--bg-tertiary)',
            borderRadius: 8,
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#0F1117',
              flexShrink: 0,
            }}
          >
            {getInitials(currentUser?.name || 'Admin')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {currentUser?.name || 'Admin'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Super Admin
            </div>
          </div>
          <button
            onClick={logout}
            title="Abmelden"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 14,
              padding: 2,
              lineHeight: 1,
            }}
          >
            ⏏
          </button>
        </div>
      </div>
    </aside>
  );
}
