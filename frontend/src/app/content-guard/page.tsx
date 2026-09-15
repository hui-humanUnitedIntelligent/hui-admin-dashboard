// frontend/src/app/content-guard/page.tsx
// SUPERADMIN-ONLY Route: /content-guard
// CONTENT-GUARD-001: "Chat Content Guard" — Trigger-Event-Logs des
// Awareness-Guards. Auth ausschliesslich ueber Middleware-Cookie
// (hui_admin_token/hui_admin_role) + guardAdmin in der API-Route.
'use client';

import ContentGuardView from '@/components/views/ContentGuardView';

export default function ContentGuardPage() {
  return <ContentGuardView />;
}
