// frontend/src/app/employee/recommendation-reports/page.tsx
'use client';
import { RecommendationReportsView } from '@/components/views/RecommendationReportsView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function EmployeeRecommendationReportsPage() {
  const { currentUser } = useAuth();
  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <RecommendationReportsView role={role} />;
}
