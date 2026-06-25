// frontend/src/app/experiences/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN-ROUTE: /experiences
// Alle Logik, UI und Daten: @/components/views/ExperiencesView
// Für Employee: /employee/experiences/page.tsx (identische Komponente, role="employee")
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import { ErlebnisseProjekteView } from '@/components/views/ExperiencesView';

export default function ErlebnisseProjektePage() {
  return <ErlebnisseProjekteView role="superadmin" />;
}
