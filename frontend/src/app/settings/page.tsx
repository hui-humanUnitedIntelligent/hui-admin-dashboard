// frontend/src/app/settings/page.tsx
'use client';
import { SettingsView } from '@/components/views/SettingsView';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const role: 'superadmin' | 'employee' = isSuperAdmin(currentUser?.role) ? 'superadmin' : 'employee';
  return <SettingsView role={role} />;
}
