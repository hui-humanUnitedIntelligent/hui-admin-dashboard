'use client';
// frontend/src/app/escrow/page.tsx
// SADB: Treuhand — dünner Wrapper, Logik in EscrowView.tsx (siehe dort für Historie/Fix-Notiz)
import { EscrowView } from '@/components/views/EscrowView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function EscrowPage() {
  const { currentUser } = useAuth();
  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <EscrowView role={role} />;
}
