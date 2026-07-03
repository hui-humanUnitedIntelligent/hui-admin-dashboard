// frontend/src/app/talents/page.tsx
'use client';
import { TalentsView } from '@/components/views/TalentsView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function TalentsPage() {
  const { currentUser } = useAuth();
  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <TalentsView role={role} />;
}
