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

  useEffect(() => { setMounted(true); }, []);

  // Close sidebar on route change / resize
  useEffect(() => {
    const close = () => setMobileOpen(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, []);

  if (!mounted) return (
    // Instant skeleton — verhindert Layout-Shift
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: 'var(--bg-primary)', color: 'var(--text-primary)',
      fontFamily: 'var(--font-body)',
    }} />
  );

  const SidebarComponent = employeeMode ? EmployeeSidebar : Sidebar;

  return (
    <div
      style={{
        display:    'flex',
        minHeight:  '100vh',
        background: 'var(--bg-primary)',
        color:      'var(--text-primary)',
        fontFamily: 'var(--font-body)',
        position:   'relative',
        overflowX:  'hidden',
        maxWidth:   '100vw',
      }}
    >
      {/* ── Desktop Sidebar ──────────────────────────────── */}
      <div className="desktop-only" style={{ display: 'flex', flexShrink: 0 }}>
        <SidebarComponent
          mobileOpen={false}
          onClose={() => {}}
        />
      </div>

      {/* ── Mobile Sidebar overlay ───────────────────────── */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 498,
              backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{
            position: 'fixed', left: 0, top: 0, bottom: 0,
            zIndex: 499,
            width: 'min(280px, 85vw)',
            overflowY: 'auto',
            boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
          }}>
            <SidebarComponent
              mobileOpen={true}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}

      {/* ── Main content ─────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        minWidth: 0, overflowX: 'hidden', maxWidth: '100%',
      }}>
        <Header
          title={title ?? ''}
          actions={headerActions}
          onMenuToggle={() => setMobileOpen(prev => !prev)}
          employeeMode={employeeMode}
        />

        <main
          style={{
            flex:      1,
            padding:   '24px 24px 40px',
            overflowY: 'auto',
            overflowX: 'hidden',
            maxWidth:  '100%',
            boxSizing: 'border-box',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
