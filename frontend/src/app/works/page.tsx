// frontend/src/app/works/page.tsx
'use client';
import { WorksView } from '@/components/views/WorksView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function WorksPage() {
  const { currentUser } = useAuth();
  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <WorksView role={role} />;
}
