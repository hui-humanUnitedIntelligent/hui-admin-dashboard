// frontend/src/app/employee/experiences/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITEKTUR-REGEL: Diese Datei ist ein reiner Wrapper.
// Alle Logik, Daten und UI kommen aus ../../experiences/page.tsx (Superadmin-Komponente).
// KEINE eigene Logik. KEINE eigenen Tabellen. KEINE eigene Datenquelle.
// Änderungen bitte NUR in frontend/src/app/experiences/page.tsx vornehmen.
// ─────────────────────────────────────────────────────────────────────────────
import ErlebnisseProjektePage from '../../experiences/page';

export default function EmployeeExperiencesPage() {
  return <ErlebnisseProjektePage role="employee" />;
}
