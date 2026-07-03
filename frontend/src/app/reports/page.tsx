// frontend/src/app/reports/page.tsx
'use client';
import { ReportsView } from '@/components/views/ReportsView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function ReportsPage() {
  const { currentUser } = useAuth();
  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <ReportsView role={role} />;
}
