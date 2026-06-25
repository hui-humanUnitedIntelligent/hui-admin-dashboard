'use client';
import { useAuth } from '@/lib/hooks/useAuth';
import ScoreFailuresView from '@/components/views/ScoreFailuresView';
export default function ScoreFailuresPage() {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  if (!isSuperAdmin(role)) {
    if (typeof window !== 'undefined') window.location.replace('/dashboard');
    return null;
  }

  return <ScoreFailuresView />;
}
