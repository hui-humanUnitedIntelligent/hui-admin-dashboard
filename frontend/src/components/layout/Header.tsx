// frontend/src/components/layout/Header.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { clearAuth } from '@/lib/api';

interface HeaderProps {
  title: string;
  actions?: React.ReactNode;
  onMenuToggle?: () => void;
  employeeMode?: boolean;
}


async function handleLogout() {
  try {
    await fetch('/api/auth/admin-logout', { method: 'POST' });
    // Auch localStorage leeren
    localStorage.removeItem('hui_admin_token');
    localStorage.removeItem('hui_admin_user');
    localStorage.removeItem('hui_dashboard_mode');
    window.location.href = '/login';
  } catch {
    window.location.href = '/login';
  }
}

export default function Header({ title, actions, onMenuToggle, employeeMode }: HeaderProps) {
  const [time, setTime]           = useState<string>('');
  const [actionsOpen, setActionsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const handleSwitchDashboard = () => {
    // Modus löschen → zurück zum Login mit Auswahl
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hui_dashboard_mode');
    }
    window.location.href = '/login';
  };

  return (
    <>
      {/* ── Main Header ─────────────────────────────────────────────────── */}
      <header
        className="hui-header"
        style={{
          height: 52, minHeight: 52,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 20px 0 16px', gap: 10,
          position: 'sticky', top: 0, zIndex: 100,
        }}
      >
        {/* Burger — mobile only */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="show-mobile"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 8, cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 16, padding: '5px 9px', lineHeight: 1,
              display: 'none',
              flexShrink: 0,
            }}
            aria-label="Navigation öffnen"
          >☰</button>
        )}

        {/* Page title */}
        <h1 style={{
          flex: 1, fontSize: 14, fontWeight: 500,
          color: 'var(--text-primary)', margin: 0,
          letterSpacing: '-0.2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </h1>

        {/* Desktop: clock + switch + app-link */}
        <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="header-clock" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px',
            background: 'var(--bg-tertiary)',
            borderRadius: 6, border: '1px solid var(--border)',
          }}>
            <span className="live-dot" />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.3px' }}>
              {time || '--:--'}
            </span>
          </div>

          {/* Dashboard-Wechsel */}
          <button
            onClick={handleSwitchDashboard}
            title={employeeMode ? 'Zu Admin Dashboard wechseln' : 'Zu Employee Portal wechseln'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 7, cursor: 'pointer',
              fontSize: 11.5, color: 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
          >
            <span>{employeeMode ? '🛡️' : '👤'}</span>
            <span>{employeeMode ? 'Admin' : 'Employee'}</span>
          </button>

          {/* HUI App öffnen */}
          <a
            href="https://be-hui.vercel.app"
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px',
              background: 'var(--accent)',
              color: '#0F1117',
              borderRadius: 7, fontSize: 12, fontWeight: 600,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <span style={{ fontSize: 13 }}>🌐</span>
            <span>HUI App</span>
            <span style={{ fontSize: 10, opacity: 0.8 }}>↗</span>
          </a>

          {actions}
        </div>

        {/* Mobile: actions dropdown */}
        {actions && (
          <div className="show-mobile" style={{ position: 'relative', display: 'none' }}>
            <button
              onClick={() => setActionsOpen(p => !p)}
              style={{
                background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)',
                fontSize: 16, padding: '5px 10px', lineHeight: 1,
              }}
            >⋯</button>
            {actionsOpen && (
              <>
                <div onClick={() => setActionsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
                <div style={{
                  position: 'absolute', top: '110%', right: 0, zIndex: 201,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '10px 14px',
                  boxShadow: 'var(--shadow-lg)', minWidth: 200,
                  display: 'flex', flexDirection: 'column', gap: 8,
                  animation: 'fadeIn 0.15s ease-out',
                }}>
                  {actions}
                </div>
              </>
            )}
          </div>
        )}
      </header>
    </>
  );
}
