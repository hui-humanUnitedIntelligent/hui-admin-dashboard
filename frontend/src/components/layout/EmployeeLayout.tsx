// frontend/src/components/layout/EmployeeLayout.tsx
'use client';

import { useState } from 'react';
import EmployeeSidebar from './EmployeeSidebar';
import Header from './Header';

interface EmployeeLayoutProps {
  children: React.ReactNode;
  title: string;
  headerActions?: React.ReactNode;
}

export default function EmployeeLayout({ children, title, headerActions }: EmployeeLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* Desktop Sidebar */}
      <div className="hide-mobile">
        <EmployeeSidebar />
      </div>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <>
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 997, backdropFilter: 'blur(3px)' }}
          />
          <div className="mobile-drawer">
            <EmployeeSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header
          title={title}
          actions={headerActions}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
