// frontend/src/app/employee/experiences/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE-ROUTE: /employee/experiences
// Alle Logik, UI und Daten: @/components/views/ExperiencesView (IDENTISCH mit Superadmin)
// Einziger Unterschied: role="employee" → kein Löschen-Button
// ─────────────────────────────────────────────────────────────────────────────
import { ErlebnisseProjekteView } from '@/components/views/ExperiencesView';

export default function EmployeeExperiencesPage() {
  return <ErlebnisseProjekteView role="employee" />;
}
