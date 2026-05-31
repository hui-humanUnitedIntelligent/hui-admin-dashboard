// frontend/src/components/layout/DashboardLayout.tsx
'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  headerActions?: React.ReactNode;
}

export default function DashboardLayout({ children, title, headerActions }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* ── Desktop Sidebar ── */}
      <div className="hide-mobile">
        <Sidebar />
      </div>

      {/* ── Mobile Sidebar Drawer ── */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 997, backdropFilter: 'blur(3px)' }}
          />
          {/* Drawer */}
          <div className="mobile-drawer">
            <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* ── Main content ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header
          title={title}
          actions={headerActions}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        {/* Page content — class adds responsive padding & bottom-nav spacing */}
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
