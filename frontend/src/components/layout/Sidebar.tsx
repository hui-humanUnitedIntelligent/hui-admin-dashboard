// frontend/src/components/layout/Sidebar.tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { clearAuth } from '@/lib/api';
import { useSettings } from '@/components/providers/ThemeProvider';
import { useSystemHealth } from '@/lib/hooks/useSupabase';
import { ADMIN_NAV, navLabel, groupLabel, filterItems } from '@/config/navigation';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { logout, currentUser } = useAuth();
  const { lang } = useSettings();
  const { supabase: dbStatus } = useSystemHealth(60000);
  const role = currentUser?.role;

  // ── Active-State: exakter Match ODER Pfad-Präfix mit '/' ──────────────────
  const isActive = (href: string): boolean =>
    pathname === href || (
      href !== '/dashboard' &&
      pathname.startsWith(href) &&
      (pathname.length === href.length || pathname[href.length] === '/')
    );

  // ── Default: Gruppe, die das aktive Item enthält, ist geöffnet ─────────────
  const getDefaultOpen = () => {
    const open: Record<string, boolean> = {};
    for (const g of ADMIN_NAV) {
      const items = filterItems(g.items, role);
      open[g.id] = items.some(i => isActive(i.href));
    }
    return open;
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getDefaultOpen);
  const toggleGroup = (id: string) =>
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));

  const isSuperAdmin = role === 'super_admin' || role === 'superadmin';

  const sidebarContent = (
    <aside style={{
      width: 230, minWidth: 230,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0, zIndex: 50,
    }}>

      {/* ── Logo / Brand ── */}
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, var(--accent), #2BC5BB)',
            borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            color: '#0F1117', letterSpacing: '0.5px',
            boxShadow: '0 0 12px rgba(78,205,196,0.3)',
          }}>HUI</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Admin Control</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <span className="live-dot" style={{ width: 5, height: 5 }} />
              <span style={{ fontSize: 9.5, color: dbStatus === 'ok' ? 'var(--green)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {dbStatus === 'ok' ? 'Live' : dbStatus === 'error' ? 'Offline' : 'Connecting'}
              </span>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 4, lineHeight: 1 }}>✕</button>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>

        {/* Dashboard — immer sichtbar */}
        <Link
          href="/dashboard"
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '9px 18px', textDecoration: 'none', fontSize: 13,
            fontWeight: isActive('/dashboard') ? 600 : 500,
            borderLeft: `2px solid ${isActive('/dashboard') ? 'var(--accent)' : 'transparent'}`,
            background: isActive('/dashboard') ? 'var(--accent-dim)' : 'transparent',
            color: isActive('/dashboard') ? 'var(--accent)' : 'var(--text-primary)',
            transition: 'all 0.12s', marginBottom: 4,
          }}
          onMouseEnter={e => { if (!isActive('/dashboard')) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { if (!isActive('/dashboard')) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <span style={{ fontSize: 15 }}>⊞</span>
          <span>Dashboard</span>
        </Link>

        <div style={{ height: 1, background: 'var(--border)', margin: '4px 18px 8px' }} />

        {/* ── Collapsible Groups ── */}
        {ADMIN_NAV.map(group => {
          const visibleItems = filterItems(group.items, role);
          if (visibleItems.length === 0) return null;  // Gruppe ausblenden wenn alle Items gefiltert

          const label    = groupLabel(group, lang);
          const isOpen   = openGroups[group.id] ?? false;
          const anyActive = visibleItems.some(i => isActive(i.href));

          return (
            <div key={group.id} style={{ marginBottom: 2 }}>

              {/* Group-Header */}
              <button
                onClick={() => toggleGroup(group.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  width: '100%', padding: '8px 18px',
                  background: anyActive && !isOpen ? 'var(--accent-dim)' : 'transparent',
                  border: 'none',
                  borderLeft: `2px solid ${anyActive && !isOpen ? 'var(--accent)' : 'transparent'}`,
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = anyActive && !isOpen ? 'var(--accent-dim)' : 'transparent'; }}
              >
                <span style={{ fontSize: 14 }}>{group.icon}</span>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600, color: anyActive && !isOpen ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {label}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
              </button>

              {/* Dropdown-Items */}
              {isOpen && (
                <div style={{ paddingBottom: 4 }}>
                  {visibleItems.map(item => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 18px 6px 38px',
                          textDecoration: 'none', fontSize: 12.5,
                          borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                          background: active ? 'var(--accent-dim)' : 'transparent',
                          color: active ? 'var(--accent)' : 'var(--text-secondary)',
                          fontWeight: active ? 500 : 400,
                          transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: 13, opacity: 0.8 }}>{item.icon}</span>
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

      {/* ── User Footer ── */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>

        {/* Current User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), #2BC5BB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#0F1117', flexShrink: 0,
          }}>
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.name || 'Admin'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.email || ''}
            </div>
          </div>
          {isSuperAdmin && (
            <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 500 }}>🛡️ Superadmin DB</div>
          )}
        </div>

        {/* Switch to Employee — nur für Superadmin */}
        {isSuperAdmin && (
          <button
            onClick={() => {
              localStorage.removeItem('hui_dashboard_mode');
              window.location.href = '/login';
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', marginBottom: 8, width: '100%',
              background: 'rgba(78,205,196,0.08)',
              border: '1px solid rgba(78,205,196,0.2)',
              borderRadius: 8, cursor: 'pointer', textAlign: 'left',
              fontSize: 11.5, color: 'var(--accent)', fontWeight: 600,
              fontFamily: 'var(--font-body)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(78,205,196,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(78,205,196,0.08)'; }}
          >
            <span>👤</span>
            <span>Employee Portal</span>
          </button>
        )}

        {/* Logout */}
        <button
          onClick={async () => { clearAuth(); await logout(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px', width: '100%',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 8, cursor: 'pointer', textAlign: 'left',
            fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500,
            fontFamily: 'var(--font-body)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#f03e3e'; (e.currentTarget as HTMLElement).style.color = '#f03e3e'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        >
          <span>⏻</span>
          <span>{lang === 'en' ? 'Logout' : 'Abmelden'}</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: sticky sidebar */}
      <div className="desktop-only" style={{ display: 'flex' }}>
        {sidebarContent}
      </div>

      {/* Mobile: overlay drawer */}
      {mobileOpen && (
        <>
          <div
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 49,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{ position: 'fixed', left: 0, top: 0, zIndex: 50, height: '100vh' }}>
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
