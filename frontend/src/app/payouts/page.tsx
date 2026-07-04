'use client';
// frontend/src/app/payouts/page.tsx
// SADB: Auszahlungen (Ambassador) — dünner Wrapper, Logik in PayoutsView.tsx
import { PayoutsView } from '@/components/views/PayoutsView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function PayoutsPage() {
  const { currentUser } = useAuth();
  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <PayoutsView role={role} />;
}
