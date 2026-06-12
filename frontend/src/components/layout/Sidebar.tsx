// frontend/src/components/layout/Sidebar.tsx
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { clearAuth } from '@/lib/api';
import { useSettings } from '@/components/providers/ThemeProvider';
import { useSystemHealth } from '@/lib/hooks/useSupabase';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  superadminOnly?: boolean;
}

interface NavGroup {
  id: string;
  label_de: string;
  label_en: string;
  icon: string;
  items_de: NavItem[];
  items_en: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'management',
    label_de: 'Management',
    label_en: 'Management',
    icon: '◎',
    items_de: [
      { href: '/users',        label: 'User-Management',  icon: '👥' },
      { href: '/admins',       label: 'Admin-Verwaltung', icon: '🛡️' },
      { href: '/ambassadors',  label: 'Ambassadors',      icon: '🤝' },
      { href: '/talents',      label: 'Talent-Pool',      icon: '⭐' },
      { href: '/transactions', label: 'Transaktionen',    icon: '⇄'  },
      { href: '/bookings',     label: 'Buchungen',        icon: '📅' },
      { href: '/impact',       label: 'Impact Pool',      icon: '🌱' },
      { href: '/reviews',      label: 'Reviews',          icon: '💬' },
    ],
    items_en: [
      { href: '/users',        label: 'User Management',  icon: '👥' },
      { href: '/admins',       label: 'Admin Management', icon: '🛡️' },
      { href: '/ambassadors',  label: 'Ambassadors',      icon: '🤝' },
      { href: '/talents',      label: 'Talent Pool',      icon: '⭐' },
      { href: '/transactions', label: 'Transactions',     icon: '⇄'  },
      { href: '/bookings',     label: 'Bookings',         icon: '📅' },
      { href: '/impact',       label: 'Impact Pool',      icon: '🌱' },
      { href: '/reviews',      label: 'Reviews',          icon: '💬' },
    ],
  },
  {
    id: 'content',
    label_de: 'Content',
    label_en: 'Content',
    icon: '🎨',
    items_de: [
      { href: '/works',        label: 'Werke & Content',  icon: '🖼️' },
      { href: '/experiences',  label: 'Erlebnisse & Projekte', icon: '🌿' },
      { href: '/impact-projekte', label: 'Impact Projekte',      icon: '💚', superadminOnly: true },
      { href: '/score-failures',  label: 'Vordef. Ablehnungsgründe', icon: '🔍', superadminOnly: true },
      { href: '/memberships',  label: 'Mitgliedschaften', icon: '🏅' },
    ],
    items_en: [
      { href: '/works',        label: 'Works & Content',  icon: '🖼️' },
      { href: '/experiences',  label: 'Experiences & Projects', icon: '🌿' },
      { href: '/impact-projekte', label: 'Impact Projects', icon: '💚', superadminOnly: true },
      { href: '/memberships',  label: 'Memberships',      icon: '🏅' },
    ],
  },
  {
    id: 'tools',
    label_de: 'Tools',
    label_en: 'Tools',
    icon: '🛠️',
    items_de: [
      { href: '/analytics',    label: 'Analytics',        icon: '📈' },
      { href: '/broadcast',    label: 'Broadcast',        icon: '📨' },
      { href: '/tickets',      label: 'Support-Tickets',  icon: '🎫' },
      { href: '/reports',      label: 'Reports',          icon: '📊' },
      { href: '/flags',        label: 'Feature-Flags',    icon: '🚩' },
      { href: '/churns',       label: 'Churns & Kündig.', icon: '📉' },
    ],
    items_en: [
      { href: '/analytics',    label: 'Analytics',        icon: '📈' },
      { href: '/broadcast',    label: 'Broadcast',        icon: '📨' },
      { href: '/tickets',      label: 'Support Tickets',  icon: '🎫' },
      { href: '/reports',      label: 'Reports',          icon: '📊' },
      { href: '/flags',        label: 'Feature Flags',    icon: '🚩' },
      { href: '/churns',       label: 'Churns',           icon: '📉' },
    ],
  },
  {
    id: 'system',
    label_de: 'System',
    label_en: 'System',
    icon: '🔧',
    items_de: [
      { href: '/audit',        label: 'Audit Logs',       icon: '📋' },
      { href: '/system',       label: 'System Status',    icon: '🔧' },
      { href: '/exports',      label: 'Daten-Export',     icon: '📥' },
      { href: '/settings',     label: 'Einstellungen',    icon: '⚙️' },
    ],
    items_en: [
      { href: '/audit',        label: 'Audit Logs',       icon: '📋' },
      { href: '/system',       label: 'System Status',    icon: '🔧' },
      { href: '/exports',      label: 'Data Export',      icon: '📥' },
      { href: '/settings',     label: 'Settings',         icon: '⚙️' },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { logout, currentUser } = useAuth();
  const { lang } = useSettings();
  const { supabase: dbStatus } = useSystemHealth(60000);

  // Track which groups are open — default: the group that contains the active route is open
  const getDefaultOpen = () => {
    const open: Record<string, boolean> = {};
    for (const g of NAV_GROUPS) {
      const items = lang === 'en' ? g.items_en : g.items_de;
      const hasActive = items.some(i =>
        pathname === i.href || (
          pathname.startsWith(i.href) &&
          (pathname.length === i.href.length || pathname[i.href.length] === '/')
        )
      );
      open[g.id] = hasActive;
    }
    return open;
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getDefaultOpen);

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isActive = (href: string) =>
    pathname === href || (
      href !== '/dashboard' &&
      pathname.startsWith(href) &&
      // Sicherstellen dass kein falscher Prefix-Match passiert (/impact ≠ /impact-projekte)
      (pathname.length === href.length || pathname[href.length] === '/')
    );

  const sidebarContent = (
    <aside style={{
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

        {/* Dashboard — always visible, no dropdown */}
        <Link
          href="/dashboard"
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '9px 18px',
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: isActive('/dashboard') ? 600 : 500,
            borderLeft: `2px solid ${isActive('/dashboard') ? 'var(--accent)' : 'transparent'}`,
            background: isActive('/dashboard') ? 'var(--accent-dim)' : 'transparent',
            color: isActive('/dashboard') ? 'var(--accent)' : 'var(--text-primary)',
            transition: 'all 0.12s',
            marginBottom: 4,
          }}
          onMouseEnter={e => { if (!isActive('/dashboard')) { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}}
          onMouseLeave={e => { if (!isActive('/dashboard')) { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}}
        >
          <span style={{ fontSize: 15 }}>⊞</span>
          <span>Dashboard</span>
        </Link>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '4px 18px 8px' }} />

        {/* Collapsible Groups */}
        {NAV_GROUPS.map(group => {
          const items   = lang === 'en' ? group.items_en : group.items_de;
          const label   = lang === 'en' ? group.label_en : group.label_de;
          const isOpen  = openGroups[group.id] ?? false;
          const anyActive = items.some(i => isActive(i.href));

          return (
            <div key={group.id} style={{ marginBottom: 2 }}>

              {/* Group header — click to toggle */}
              <button
                onClick={() => toggleGroup(group.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  width: '100%', padding: '8px 18px',
                  background: anyActive && !isOpen ? 'var(--accent-dim)' : 'transparent',
                  border: 'none',
                  borderLeft: `2px solid ${anyActive && !isOpen ? 'var(--accent)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = anyActive && !isOpen ? 'var(--accent-dim)' : 'transparent'; }}
              >
                <span style={{ fontSize: 14 }}>{group.icon}</span>
                <span style={{
                  flex: 1, textAlign: 'left',
                  fontSize: 13, fontWeight: 600,
                  color: anyActive && !isOpen ? 'var(--accent)' : 'var(--text-primary)',
                }}>
                  {label}
                </span>
                <span style={{
                  fontSize: 10, color: 'var(--text-muted)',
                  transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.2s',
                  display: 'inline-block',
                }}>▾</span>
              </button>

              {/* Dropdown items */}
              {isOpen && (
                <div style={{ paddingBottom: 4 }}>
                  {items.map(item => {
                    // Reviews: nur für Admins (alle Admin-Rollen)
                    if (item.href === '/reviews' && !currentUser) return null;
                    // superadminOnly: im Superadmin-Dashboard immer sichtbar
                    // (Wer hier eingeloggt ist, hat Admin-Zugang — Employees nutzen EmployeeSidebar)
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 18px 6px 38px',
                          textDecoration: 'none',
                          fontSize: 12.5,
                          borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                          background: active ? 'var(--accent-dim)' : 'transparent',
                          color: active ? 'var(--accent)' : 'var(--text-secondary)',
                          fontWeight: active ? 500 : 400,
                          transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}}
                        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}}
                      >
                        <span style={{ fontSize: 13, opacity: 0.8 }}>{item.icon}</span>
                        <span>{item.label}</span>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), #2BC5BB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#0F1117', flexShrink: 0,
          }}>
            {currentUser?.email?.slice(0, 2).toUpperCase() ?? 'AD'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.email ?? 'Admin'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 500 }}>🛡️ Superadmin DB</div>
          </div>
        </div>
        {/* ── Switch to Super Admin — nur für superadmin sichtbar ── */}
        {(currentUser?.role === 'superadmin' || currentUser?.role === 'super_admin') && (
          <button
            onClick={() => {
              localStorage.removeItem('hui_dashboard_mode');
              window.location.href = '/login';
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', marginBottom: 8, width: '100%',
              background: 'rgba(116,192,252,0.08)',
              border: '1px solid rgba(116,192,252,0.2)',
              borderRadius: 7, cursor: 'pointer', textAlign: 'left',
              fontSize: 11.5, color: '#74C0FC', fontWeight: 500,
              fontFamily: 'var(--font-body)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(116,192,252,0.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(116,192,252,0.08)'; }}
          >
            <span>👤</span>
            <span>→ Employee Portal</span>
          </button>
        )}

        <button
          onClick={logout}
          style={{
            width: '100%', padding: '6px 0',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 7, cursor: 'pointer',
            fontSize: 11.5, color: 'var(--text-muted)',
            fontFamily: 'var(--font-body)',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--red)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--red)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
        >
          {lang === 'en' ? '← Sign out' : '← Abmelden'}
        </button>
      </div>
    </aside>
  );

  // Mobile overlay
  if (mobileOpen !== undefined) {
    return (
      <>
        {mobileOpen && (
          <div
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 49, backdropFilter: 'blur(2px)',
            }}
          />
        )}
        <div style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
        }}>
          {sidebarContent}
        </div>
      </>
    );
  }

  return sidebarContent;
}
