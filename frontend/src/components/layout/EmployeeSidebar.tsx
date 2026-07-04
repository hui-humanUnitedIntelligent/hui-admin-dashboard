// frontend/src/components/layout/EmployeeSidebar.tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSettings } from '@/components/providers/ThemeProvider';
import { useSystemHealth } from '@/lib/hooks/useSupabase';
import { EMPLOYEE_NAV, navLabel, groupLabel } from '@/config/navigation';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function EmployeeSidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { logout, currentUser } = useAuth();
  const { lang } = useSettings();
  const { supabase: dbStatus } = useSystemHealth(60000);

  // ── Active-State: exakter Match ODER Pfad-Präfix mit '/' ──────────────────
  // Korrekter Check: /employee/users darf NICHT /employee/users-extra matchen
  const isActive = (href: string): boolean =>
    pathname === href || (
      pathname.startsWith(href) &&
      (pathname.length === href.length || pathname[href.length] === '/')
    );

  // ── Default: Gruppe mit aktivem Item öffnen ────────────────────────────────
  const getDefaultOpen = () => {
    const open: Record<string, boolean> = {};
    for (const g of EMPLOYEE_NAV) {
      open[g.id] = g.items.some(i => isActive(i.href));
    }
    return open;
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getDefaultOpen);
  const toggleGroup = (id: string) =>
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));

  const sidebarContent = (
    <aside style={{
      width: 230, minWidth: 230,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0, zIndex: 50,
    }}>

      {/* ── Brand ── */}
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, #74C0FC, #4dabf7)',
            borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
            color: '#0F1117', letterSpacing: '0.5px',
            boxShadow: '0 0 12px rgba(116,192,252,0.3)',
          }}>HUI</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Employee Portal</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: dbStatus === 'ok' ? '#51CF66' : '#aaa', display: 'inline-block' }} />
              <span style={{ fontSize: 9.5, color: dbStatus === 'ok' ? 'var(--green)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {dbStatus === 'ok' ? 'Live' : 'Connecting'}
              </span>
            </div>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px',
            background: 'rgba(116,192,252,0.15)', color: '#74C0FC',
            border: '1px solid rgba(116,192,252,0.3)', borderRadius: 4, letterSpacing: '0.4px',
          }}>STAFF</span>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 4, lineHeight: 1 }}>✕</button>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>

        {/* Dashboard — immer sichtbar */}
        <Link
          href="/employee/dashboard"
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '9px 18px', textDecoration: 'none', fontSize: 13,
            fontWeight: isActive('/employee/dashboard') ? 600 : 500,
            borderLeft: `2px solid ${isActive('/employee/dashboard') ? '#74C0FC' : 'transparent'}`,
            background: isActive('/employee/dashboard') ? 'rgba(116,192,252,0.08)' : 'transparent',
            color: isActive('/employee/dashboard') ? '#74C0FC' : 'var(--text-primary)',
            transition: 'all 0.12s', marginBottom: 4,
          }}
          onMouseEnter={e => { if (!isActive('/employee/dashboard')) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { if (!isActive('/employee/dashboard')) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <span style={{ fontSize: 15 }}>⊞</span>
          <span>Dashboard</span>
        </Link>

        <div style={{ height: 1, background: 'var(--border)', margin: '4px 18px 8px' }} />

        {/* ── Collapsible Groups ── */}
        {EMPLOYEE_NAV.map(group => {
          const label    = groupLabel(group, lang);
          const isOpen   = openGroups[group.id] ?? false;
          const anyActive = group.items.some(i => isActive(i.href));

          return (
            <div key={group.id} style={{ marginBottom: 2 }}>

              {/* Group-Header */}
              <button
                onClick={() => toggleGroup(group.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  width: '100%', padding: '8px 18px',
                  background: anyActive && !isOpen ? 'rgba(116,192,252,0.08)' : 'transparent',
                  border: 'none',
                  borderLeft: `2px solid ${anyActive && !isOpen ? '#74C0FC' : 'transparent'}`,
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = anyActive && !isOpen ? 'rgba(116,192,252,0.08)' : 'transparent'; }}
              >
                <span style={{ fontSize: 14 }}>{group.icon}</span>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600, color: anyActive && !isOpen ? '#74C0FC' : 'var(--text-primary)' }}>
                  {label}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
              </button>

              {/* Dropdown-Items */}
              {isOpen && (
                <div style={{ paddingBottom: 4 }}>
                  {group.items.map(item => {
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
                          fontWeight: active ? 600 : 400,
                          borderLeft: `2px solid ${active ? '#74C0FC' : 'transparent'}`,
                          background: active ? 'rgba(116,192,252,0.08)' : 'transparent',
                          color: active ? '#74C0FC' : 'var(--text-secondary)',
                          borderRadius: '0 6px 6px 0', transition: 'all 0.12s',
                          marginBottom: 1,
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <span style={{ fontSize: 13, width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{item.icon}</span>
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

      {/* ── Footer ── */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>

        {/* Current User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #74C0FC, #4dabf7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#0F1117', flexShrink: 0,
          }}>
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'E'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.name || 'Employee'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.email || ''}
            </div>
          </div>
        </div>

        {/* Switch to Admin Dashboard */}
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
          <span>🛡️</span>
          <span>{lang === 'en' ? 'Switch to Admin' : 'Zu Admin wechseln'}</span>
        </button>

        {/* Logout */}
        <button
          onClick={async () => { await logout(); }}
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
