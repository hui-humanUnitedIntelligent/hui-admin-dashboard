'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('hui_admin_token')
      : null;
    const isLogin = pathname === '/login';
    if (!token && !isLogin) router.replace('/login');
    if (token && isLogin) router.replace('/dashboard');
  }, [pathname, router]);

  return <>{children}</>;
}
