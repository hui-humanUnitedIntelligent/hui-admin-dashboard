// frontend/src/app/api/auth/admin-logout/route.ts
// POST /api/auth/admin-logout — löscht hui_admin_token Cookie
import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('hui_admin_token', '', { maxAge: 0, path: '/' });
  res.cookies.set('hui_admin_role',  '', { maxAge: 0, path: '/' });
  return res;
}

export async function GET() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('hui_admin_token', '', { maxAge: 0, path: '/' });
  res.cookies.set('hui_admin_role',  '', { maxAge: 0, path: '/' });
  return res;
}
