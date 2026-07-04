'use client';
// frontend/src/components/views/PayoutsView.tsx
// SADB+EDB: Auszahlungen — Vollseiten-Ansicht. Kern-Logik liegt in PayoutsPanel.tsx
// (wird ebenfalls von ambassadors/page.tsx als eingebettetes Modal-Fenster genutzt).
// ADMIN-DEDUP-025-FOLLOWUP (2026-07-04): war zuvor NUR unter /employee/payouts mit eigenem
// EmployeeLayout erreichbar -- Superadmin-Klick auf die Auszahlungsanfragen-Kacheln in
// /ambassadors landete dadurch fälschlich im kompletten Employee-Portal-Layout (Sidebar+Header
// wechselten). Konsolidiert auf DashboardLayout+employeeMode-Prop.
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/lib/hooks/useAuth';
import { PayoutsPanel } from './PayoutsPanel';

export function PayoutsView({ role }: { role: 'superadmin' | 'employee' }) {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;

  return (
    <DashboardLayout employeeMode={role === 'employee'} title="Auszahlungen">
      <PageHeader
        title="💸 Auszahlungen"
        subtitle="Ambassador-Provisionen · Auszahlungsstatus · Fehler"
        actionsRole={role === 'employee' ? 'employee' : 'admin'}
        userRole={userRole}
      />
      <PayoutsPanel role={role} />
    </DashboardLayout>
  );
}
