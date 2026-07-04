// frontend/src/app/talent-offers/page.tsx
'use client';
import { TalentOffersView } from '@/components/views/TalentOffersView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function TalentOffersPage() {
  const { currentUser } = useAuth();
  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <TalentOffersView role={role} />;
}
