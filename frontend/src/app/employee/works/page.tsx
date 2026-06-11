// frontend/src/app/employee/works/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITEKTUR-REGEL: Dieser Page ist ein reiner Wrapper.
// Alle Logik, Daten und UI kommen aus @/app/works/page (WorksView).
// KEINE eigene Logik. KEINE eigene Datenquelle. KEINE Duplikation.
// Änderungen NUR in frontend/src/app/works/page.tsx vornehmen — gilt automatisch für beide Rollen.
// ─────────────────────────────────────────────────────────────────────────────
'use client';
import { WorksView } from '@/app/works/page';

export default function EmployeeWorksPage() {
  return <WorksView role="employee" />;
}
