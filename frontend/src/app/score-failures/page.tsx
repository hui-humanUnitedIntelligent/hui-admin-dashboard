'use client';
import { useRouter } from 'next/navigation';
import { isSuperAdmin } from '@/lib/roles';
import { useAuth } from '@/lib/hooks/useAuth';
import ScoreFailuresView from '@/components/views/ScoreFailuresView';
export default function ScoreFailuresPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isSuperAdmin(currentUser?.role)) router.replace("/dashboard");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.role]);
  if (!isSuperAdmin(currentUser?.role)) return null;

  return <ScoreFailuresView />;
}
