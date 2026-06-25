// frontend/src/app/AuthGuard.tsx
// Server Component — prüft hui_admin_token Cookie serverseitig.
// KEIN 'use client' — nur Server Components können cookies() aus next/headers nutzen.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const token = cookieStore.get('hui_admin_token')?.value;

  if (!token) {
    redirect('/login');
  }

  return <>{children}</>;
}
