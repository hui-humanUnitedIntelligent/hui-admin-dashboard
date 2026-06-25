// frontend/src/components/layout/Sidebar.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { clearAuth } from '@/lib/api';
import { useSettings } from '@/components/providers/ThemeProvider';
import { useSystemHealth } from '@/lib/hooks/useSupabase';
import AdminNavigation from '@/components/navigation/AdminNavigation';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { logout, currentUser } = useAuth();
  const { lang }                = useSettings();
  const { supabase: dbStatus }  = useSystemHealth(60000);
  const role                    = currentUser?.role;

  const isSuperAdmin = role === 'super_admin' || role === 'superadmin' || role === 'admin';

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
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), #2BC5BB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#0F1117', flexShrink: 0,
          }}>H</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              HUI Admin
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: dbStatus === 'online' ? '#22c55e' : '#f59e0b',
                display: 'inline-block',
              }} />
              {dbStatus === 'online' ? 'Live' : 'Verbinde...'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Dashboard Quick-Link ── */}
      <div style={{ padding: '8px 12px 4px', flexShrink: 0 }}>
        <Link
          href="/dashboard"
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px', borderRadius: 8,
            textDecoration: 'none', fontSize: 13, fontWeight: 500,
            color: 'var(--text-primary)',
            background: 'transparent',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontSize: 15 }}>⊞</span>
          <span>{lang === 'en' ? 'Dashboard' : 'Dashboard'}</span>
        </Link>
        <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px 4px' }} />
      </div>

      {/* ── Rollenbasierte Navigation via AdminNavigation ── */}
      <AdminNavigation role={role} lang={lang} onClose={onClose} />

      {/* ── User Footer ── */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>

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
            <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600 }}>🛡️ SA</div>
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
            <span>{lang === 'en' ? 'Employee Portal' : 'Employee Portal'}</span>
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
