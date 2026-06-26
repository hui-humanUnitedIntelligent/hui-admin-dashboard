// frontend/src/components/layout/DashboardLayout.tsx
'use client';

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import EmployeeSidebar from './EmployeeSidebar';
import Header from './Header';
interface DashboardLayoutProps {
  children:       React.ReactNode;
  title?:         string;
  headerActions?: React.ReactNode;
  employeeMode?:  boolean;
}

export default function DashboardLayout({
  children,
  title,
  headerActions,
  employeeMode = false,
}: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted,    setMounted]    = useState(false);

  useEffect(() => {
    setMounted(true);
    // Middleware schützt bereits serverseitig — kein client-side redirect nötig
    // Nur als letzter Fallback nach kurzem Delay (verhindert false-redirects bei SSR-Hydration)
    const timer = setTimeout(() => {
      const hasToken = document.cookie.includes('hui_admin_token=');
      if (!hasToken) {
        window.location.href = '/login';
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  const SidebarComponent = employeeMode ? EmployeeSidebar : Sidebar;

  return (
    <div
      style={{
        display:       'flex',
        minHeight:     '100vh',
        background:    'var(--bg-primary)',
        color:         'var(--text-primary)',
        fontFamily:    'var(--font-body)',
        position:      'relative',
        overflow:      'hidden',
      }}
    >
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <SidebarComponent
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* ── Mobile overlay ────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 49,
          }}
        />
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Header
          title={title ?? ''}
          actions={headerActions}
          onMenuToggle={() => setMobileOpen(prev => !prev)}
          employeeMode={employeeMode}
        />

        <main
          style={{
            flex:       1,
            padding:    '28px 28px 40px',
            overflowY:  'auto',
            overflowX:  'hidden',
          }}
        >
          {/* Injects userRole into children via CSS variable (workaround, real role via useAuth) */}
          {children}
        </main>
      </div>
    </div>
  );
}
