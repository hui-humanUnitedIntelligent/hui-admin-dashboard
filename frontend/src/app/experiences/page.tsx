// frontend/src/app/experiences/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN-ROUTE: /experiences
// Alle Logik, UI und Daten: @/components/views/ExperiencesView
// Für Employee: /employee/experiences/page.tsx (identische Komponente, role="employee")
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import { ErlebnisseProjekteView } from '@/components/views/ExperiencesView';
import PageHeader from '@/components/layout/PageHeader';

export default function ErlebnisseProjektePage() {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;
  return <ErlebnisseProjekteView role="superadmin" />;
}
