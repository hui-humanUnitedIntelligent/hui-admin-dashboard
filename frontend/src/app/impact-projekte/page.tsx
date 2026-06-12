// frontend/src/app/impact-projekte/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN-ONLY Route: /impact-projekte
// Zeigt alle eingereichten Herzensprojekte aus dem Impact Pool
// Employees haben KEINEN Zugriff auf diese Seite
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser } from '@/lib/api';
import ImpactApplicationsView from '@/components/views/ImpactApplicationsView';

export default function ImpactProjektePage() {
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    if (!user) { router.push('/login'); return; }
    const role = (user.role as string) || '';
    // Nur superadmin hat Zugriff
    const isSuperAdmin = role === 'superadmin' || role === 'super_admin';
    if (!isSuperAdmin) {
      router.push('/dashboard');
      return;
    }
  }, [router]);

  return <ImpactApplicationsView />;
}
