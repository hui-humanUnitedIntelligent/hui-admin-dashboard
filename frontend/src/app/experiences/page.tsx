// frontend/src/app/experiences/page.tsx
'use client';
import { ErlebnisseProjekteView } from '@/components/views/ExperiencesView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function ErlebnisseProjektePage() {
  const { currentUser } = useAuth();
  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <ErlebnisseProjekteView role={role} />;
}
