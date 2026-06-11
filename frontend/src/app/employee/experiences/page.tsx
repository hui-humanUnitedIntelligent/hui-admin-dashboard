// frontend/src/app/employee/experiences/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITEKTUR-REGEL: Dieser Page ist ein reiner Wrapper.
// Alle Logik, Daten und UI kommen aus @/app/experiences/page (ErlebnisseProjekteView).
// KEINE eigene Logik. KEINE eigene Datenquelle. KEINE Duplikation.
// Änderungen NUR in frontend/src/app/experiences/page.tsx vornehmen — gilt automatisch für beide Rollen.
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import { ErlebnisseProjekteView } from '@/app/experiences/page';

export default function EmployeeExperiencesPage() {
  return <ErlebnisseProjekteView role="employee" />;
}
