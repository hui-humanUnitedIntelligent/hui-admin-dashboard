// frontend/src/app/impact-projekte/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN-ONLY Route: /impact-projekte
// Zeigt alle eingereichten Herzensprojekte aus dem Impact Pool
// Auth: Server-seitig via guardAdmin in der API — Client nutzt Redirect nach Session-Check
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ImpactApplicationsView from '@/components/views/ImpactApplicationsView';

export default function ImpactProjektePage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Nutze Supabase-Session (nicht localStorage) für Auth-Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login');
        return;
      }
      const role = (session.user.user_metadata?.role as string)
                ?? (session.user.app_metadata?.role  as string)
                ?? '';
      const isSuperAdmin = role === 'superadmin' || role === 'super_admin';
      if (!isSuperAdmin) {
        router.replace('/dashboard');
        return;
      }
      setAuthorized(true);
    });
  }, [router]);

  if (!authorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)', fontSize: 14 }}>
        Zugriff wird geprüft…
      </div>
    );
  }

  return <ImpactApplicationsView />;
}
