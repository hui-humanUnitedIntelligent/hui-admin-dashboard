// frontend/src/app/api/employees/route.ts
// Employee-Verwaltung: GET (Liste), POST (erstellen), PATCH (ändern), DELETE (löschen)
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

const SUPABASE_URL  = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// ── GET — alle Employees laden ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    // Auth-Users mit role=employee aus Admin API
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    });
    const body = await res.json() as { users?: Array<{id:string; email?:string; created_at:string; last_sign_in_at?:string; app_metadata?:Record<string,unknown>}> };
    const allUsers = body.users ?? [];

    const sb = getServiceClient();
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, display_name, username, email, role, avatar_url, created_at, last_seen_at, is_wirker')
      .in('role', ['employee', 'admin', 'superadmin', 'super_admin']);

    const profMap = new Map((profiles ?? []).map(p => [p.id, p]));

    // Employees = alle Auth-User deren app_metadata.role=employee ODER profile.role=employee
    const employees = allUsers
      .filter(u => {
        const appRole = String(u.app_metadata?.role ?? '').toLowerCase();
        const prof = profMap.get(u.id);
        const profRole = String(prof?.role ?? '').toLowerCase();
        return appRole === 'employee' || profRole === 'employee' || profRole === 'admin' || profRole === 'superadmin' || profRole === 'super_admin';
      })
      .map(u => {
        const p = profMap.get(u.id);
        return {
          id:              u.id,
          email:           u.email ?? p?.email ?? null,
          display_name:    p?.display_name ?? null,
          username:        p?.username ?? null,
          avatar_url:      p?.avatar_url ?? null,
          role:            p?.role ?? String(u.app_metadata?.role ?? 'employee'),
          created_at:      u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          last_seen_at:    p?.last_seen_at ?? null,
        };
      });

    return NextResponse.json({ employees, total: employees.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ── POST — neuen Employee erstellen ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { email, password, display_name, username } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'E-Mail und Passwort erforderlich' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: 'Passwort muss mindestens 8 Zeichen haben' }, { status: 400 });
    }

    // Auth-User anlegen
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        app_metadata: { role: 'employee' },
        user_metadata: { role: 'employee' },
      }),
    });
    const created = await createRes.json() as { id?: string; message?: string; msg?: string };

    if (!createRes.ok || !created.id) {
      const errMsg = created.message ?? created.msg ?? 'Fehler beim Erstellen';
      return NextResponse.json({ ok: false, error: errMsg }, { status: 400 });
    }

    const uid = created.id;

    // Profile anlegen
    const sb = getServiceClient();
    await sb.from('profiles').upsert({
      id:           uid,
      email,
      display_name: display_name || email.split('@')[0],
      username:     username     || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_'),
      role:         'employee',
      is_wirker:    false,
    });

    return NextResponse.json({ ok: true, id: uid, email });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ── PATCH — Password oder Display-Name ändern ──────────────────────────────
export async function PATCH(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { id, password, display_name } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'ID fehlt' }, { status: 400 });

    if (password) {
      if (password.length < 8) {
        return NextResponse.json({ ok: false, error: 'Passwort muss mindestens 8 Zeichen haben' }, { status: 400 });
      }
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const e = await res.json() as { message?: string };
        return NextResponse.json({ ok: false, error: e.message ?? 'Fehler' }, { status: 400 });
      }
    }

    if (display_name) {
      const sb = getServiceClient();
      await sb.from('profiles').update({ display_name }).eq('id', id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// ── DELETE — Employee löschen ──────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: 'ID fehlt' }, { status: 400 });

    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    });

    if (!res.ok) {
      const e = await res.json() as { message?: string };
      return NextResponse.json({ ok: false, error: e.message ?? 'Fehler' }, { status: 400 });
    }

    // Profile soft-delete
    const sb = getServiceClient();
    await sb.from('profiles').update({ role: 'deleted' }).eq('id', id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
