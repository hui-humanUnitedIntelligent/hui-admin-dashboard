// frontend/src/components/layout/DashboardLayout.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import EmployeeSidebar from './EmployeeSidebar';
import Header from './Header';
import { getStoredUser } from '@/lib/api';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  headerActions?: React.ReactNode;
  employeeMode?: boolean;
}

export default function DashboardLayout({ children, title, headerActions, employeeMode }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    if (!user) { router.push('/login'); return; }
    const mode = typeof window !== 'undefined' ? localStorage.getItem('hui_dashboard_mode') : null;
    if (employeeMode && mode === 'super')    { router.push('/dashboard'); return; }
    if (!employeeMode && mode === 'employee') { router.push('/employee/dashboard'); return; }
  }, [router, employeeMode]);

  const SidebarComp = employeeMode ? EmployeeSidebar : Sidebar;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* Desktop Sidebar */}
      <div className="hide-mobile">
        <SidebarComp />
      </div>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <>
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 997, backdropFilter: 'blur(3px)' }}
          />
          <div className="mobile-drawer">
            <SidebarComp mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Header
          title={title}
          actions={headerActions}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          employeeMode={employeeMode}
        />
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
