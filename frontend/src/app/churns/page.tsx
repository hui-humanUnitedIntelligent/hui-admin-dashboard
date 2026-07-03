// frontend/src/app/churns/page.tsx
'use client';
import { ChurnsView } from '@/components/views/ChurnsView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function ChurnsPage() {
  const { currentUser } = useAuth();
  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <ChurnsView role={role} />;
}
