// frontend/src/app/employee/works/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE-ROUTE: /employee/works
// Alle Logik, UI und Daten: @/components/views/WorksView (IDENTISCH mit Superadmin)
// Einziger Unterschied: role="employee" → keine destruktiven Buttons
// ─────────────────────────────────────────────────────────────────────────────
import { WorksView } from '@/components/views/WorksView';

export default function EmployeeWorksPage() {
  return <WorksView role="employee" />;
}
