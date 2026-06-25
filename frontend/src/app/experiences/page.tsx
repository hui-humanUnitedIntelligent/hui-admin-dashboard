// frontend/src/app/experiences/page.tsx
'use client';
import { ErlebnisseProjekteView } from '@/components/views/ExperiencesView';
import { useAuth } from '@/lib/hooks/useAuth';
import { normalizeRole } from '@/lib/roles';

export default function ErlebnisseProjektePage() {
  const { currentUser } = useAuth();
  const role = normalizeRole(currentUser?.role);
  return <ErlebnisseProjekteView role={role} />;
}
