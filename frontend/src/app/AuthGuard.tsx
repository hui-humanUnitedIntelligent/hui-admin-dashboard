// frontend/src/app/AuthGuard.tsx
// Client-seitiger Guard — prüft ob hui_admin_role Cookie gesetzt ist.
// hui_admin_token ist HTTP-Only (nicht lesbar via JS) — aber hui_admin_role ist lesbar.
'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Neues Cookie-System (hui_admin_role) — Fallback auf altes localStorage
    const cookieRole = getCookie('hui_admin_role');
    const lsToken    = typeof window !== 'undefined' ? localStorage.getItem('hui_admin_token') : null;
    const isLoggedIn = !!(cookieRole || lsToken);
    const isLogin    = pathname === '/login';

    if (!isLoggedIn && !isLogin) router.replace('/login');
    if (isLoggedIn  && isLogin)  router.replace('/dashboard');
  }, [pathname, router]);

  return <>{children}</>;
}
