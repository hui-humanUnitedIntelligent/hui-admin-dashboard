// frontend/src/app/works/page.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WorksView } from '@/components/views/WorksView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function WorksPage() {
  const { currentUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (currentUser && !isSuperAdmin(currentUser.role)) {
      router.replace("/employee/works");
    }
  }, [currentUser, router]);

  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <WorksView role={role} />;
}
