// frontend/src/app/works/page.tsx
'use client';
import { WorksView } from '@/components/views/WorksView';
import { useAuth } from '@/lib/hooks/useAuth';
import { normalizeRole } from '@/lib/roles';

export default function WorksPage() {
  const { currentUser } = useAuth();
  const role = normalizeRole(currentUser?.role);
  return <WorksView role={role} />;
}
