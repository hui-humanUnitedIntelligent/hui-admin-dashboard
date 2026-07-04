'use client';
// frontend/src/app/employee/payouts/page.tsx
// EDB: Auszahlungen — dünner Wrapper, Logik in PayoutsView.tsx
import { PayoutsView } from '@/components/views/PayoutsView';

export default function EmployeePayoutsPage() {
  return <PayoutsView role="employee" />;
}
