'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import '../styles/globals.css';

export const metadata = {
  title: 'HUI Admin',
  description: 'HUI Platform Administration',
  robots: 'noindex, nofollow',
};

const PUBLIC_PATHS = ['/login'];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('hui_admin_token')
        : null;

    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

    if (!token && !isPublic) {
      router.replace('/login');
    }
    if (token && isPublic) {
      router.replace('/dashboard');
    }
  }, [pathname, router]);

  return (
    <html lang="de">
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </head>
      <body>{children}</body>
    </html>
  );
}
