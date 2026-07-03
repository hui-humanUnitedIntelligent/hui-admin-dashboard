// frontend/src/app/bookings/page.tsx
'use client';
import { BookingsView } from '@/components/views/BookingsView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function BookingsPage() {
  const { currentUser } = useAuth();
  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <BookingsView role={role} />;
}
