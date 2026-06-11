// frontend/src/app/employee/works/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITEKTUR-REGEL: Diese Datei ist ein reiner Wrapper.
// Alle Logik, Daten und UI kommen aus ../../works/page.tsx (Superadmin-Komponente).
// KEINE eigene Logik. KEINE eigenen Tabellen. KEINE eigene Datenquelle.
// Änderungen an der Werke-Seite bitte NUR in frontend/src/app/works/page.tsx vornehmen.
// ─────────────────────────────────────────────────────────────────────────────
import WorksPage from '../../works/page';

export default function EmployeeWorksPage() {
  return <WorksPage role="employee" />;
}
