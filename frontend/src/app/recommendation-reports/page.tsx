// frontend/src/app/recommendation-reports/page.tsx
'use client';
import { RecommendationReportsView } from '@/components/views/RecommendationReportsView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function RecommendationReportsPage() {
  const { currentUser } = useAuth();
  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <RecommendationReportsView role={role} />;
}
