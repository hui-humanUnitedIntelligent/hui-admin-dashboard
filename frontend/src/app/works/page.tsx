// frontend/src/app/works/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN-ROUTE: /works
// Alle Logik, UI und Daten: @/components/views/WorksView
// Für Employee: /employee/works/page.tsx (identische Komponente, role="employee")
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import { WorksView } from '@/components/views/WorksView';

export default function WorksPage() {
  return <WorksView role="superadmin" />;
}
