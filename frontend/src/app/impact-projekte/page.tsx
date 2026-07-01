// frontend/src/app/impact-projekte/page.tsx
// ─────────────────────────────────────────────────────────────────────────────────────────
// SUPERADMIN-ONLY Route: /impact-projekte
// Zeigt alle eingereichten Herzensprojekte aus dem Impact Pool
// Auth: ausschliesslich über die Middleware (hui_admin_token/hui_admin_role Cookie)
// + serverseitigen guardAdmin in der API — kein eigener Client-Auth-Check mehr,
// da dieser auf supabase.auth.getSession() basierte und mit dem echten
// Login-System (Cookie-Session) nichts zu tun hatte → sofortiger Fehl-Redirect
// zu /login bei jedem Aufruf (ARCH-006.1: keine zweite Auth-Wahrheit).
// ─────────────────────────────────────────────────────────────────────────────────────────
'use client';

import ImpactApplicationsView from '@/components/views/ImpactApplicationsView';

export default function ImpactProjektePage() {
  return <ImpactApplicationsView />;
}
