// frontend/src/app/transactions/page.tsx
'use client';
import { TransactionsView } from '@/components/views/TransactionsView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function TransactionsPage() {
  const { currentUser } = useAuth();
  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <TransactionsView role={role} />;
}
