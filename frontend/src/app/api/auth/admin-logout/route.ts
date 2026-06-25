// frontend/src/app/api/auth/admin-logout/route.ts
// POST/GET /api/auth/admin-logout — löscht hui_admin_token + hui_admin_role
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function clearCookies() {
  const store = cookies();
  store.set({ name: 'hui_admin_token', value: '', maxAge: 0, path: '/' });
  store.set({ name: 'hui_admin_role',  value: '', maxAge: 0, path: '/' });
}

export async function POST() {
  clearCookies();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  clearCookies();
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'));
}
