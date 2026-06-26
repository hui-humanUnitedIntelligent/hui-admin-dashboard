// frontend/src/app/api/auth/admin-logout/route.ts
import { NextResponse } from 'next/server';

const CLEAR = { maxAge: 0, path: '/' };

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('hui_admin_token', '', CLEAR);
  res.cookies.set('hui_admin_role',  '', CLEAR);
  return res;
}

export async function GET() {
  const res = NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'));
  res.cookies.set('hui_admin_token', '', CLEAR);
  res.cookies.set('hui_admin_role',  '', CLEAR);
  return res;
}
