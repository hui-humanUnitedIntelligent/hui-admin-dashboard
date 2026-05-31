// frontend/src/lib/actions/userActions.ts
// ── HUI Admin — User Management Actions ──────────────────────────────────
// Alle Aktionen schreiben direkt in Supabase + loggen in activity_logs

import { sbUpdate, sbQuery, SUPABASE_URL, SUPABASE_ANON, SUPABASE_SERVICE } from '../api';

export type UserRole  = 'basisuser' | 'wirker' | 'admin' | 'superadmin';
export type UserGroup = 'wirker' | 'talent' | 'impact' | 'pending';

// ── Raw PATCH helper (table-level, not just by id) ─────────────────────
async function sbPatch(
  table: string,
  filter: Record<string, string>,
  data: Record<string, unknown>
): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return false;
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(filter).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_SERVICE || SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  return res.ok;
}

// ── Activity Log ────────────────────────────────────────────────────────
export async function logActivity(
  adminId: string | null,
  targetUserId: string,
  action: string,
  meta: Record<string, unknown> = {}
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/activity_logs`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_SERVICE || SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        admin_id: adminId,
        user_id: targetUserId,
        action,
        meta,
        created_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Tabelle ggf. nicht vorhanden — ignorieren
  }
}

// ── 1. Block / Unblock ──────────────────────────────────────────────────
export async function blockUser(
  userId: string,
  adminId: string | null = null
): Promise<boolean> {
  const ok = await sbUpdate('profiles', userId, { status: 'blocked', updated_at: new Date().toISOString() });
  if (ok) await logActivity(adminId, userId, 'block_user', { status: 'blocked' });
  return ok;
}

export async function unblockUser(
  userId: string,
  adminId: string | null = null
): Promise<boolean> {
  const ok = await sbUpdate('profiles', userId, { status: 'active', updated_at: new Date().toISOString() });
  if (ok) await logActivity(adminId, userId, 'unblock_user', { status: 'active' });
  return ok;
}

// ── 2. Soft Delete ──────────────────────────────────────────────────────
export async function softDeleteUser(
  userId: string,
  adminId: string | null = null
): Promise<boolean> {
  const ok = await sbUpdate('profiles', userId, {
    deleted_at: new Date().toISOString(),
    status: 'deleted',
    updated_at: new Date().toISOString(),
  });
  if (ok) await logActivity(adminId, userId, 'soft_delete_user', { deleted_at: new Date().toISOString() });
  return ok;
}

// ── 3. Change Role ──────────────────────────────────────────────────────
export async function changeUserRole(
  userId: string,
  newRole: UserRole,
  adminId: string | null = null
): Promise<boolean> {
  const ok = await sbUpdate('profiles', userId, { role: newRole, updated_at: new Date().toISOString() });
  if (ok) await logActivity(adminId, userId, 'change_role', { role: newRole });
  return ok;
}

// ── 4. Change Group ─────────────────────────────────────────────────────
export async function changeUserGroup(
  userId: string,
  newGroup: UserGroup,
  adminId: string | null = null
): Promise<boolean> {
  const updates: Record<string, unknown> = {
    group: newGroup,
    updated_at: new Date().toISOString(),
    is_wirker: newGroup === 'wirker' || newGroup === 'talent',
  };
  const ok = await sbUpdate('profiles', userId, updates);
  if (ok) await logActivity(adminId, userId, 'change_group', { group: newGroup });
  return ok;
}

// ── 5. Edit Profile ─────────────────────────────────────────────────────
export interface ProfileEditData {
  display_name?: string;
  bio?: string;
  location?: string;
  skills?: string[];
  talent?: string;
  is_available?: boolean;
}

export async function editProfile(
  userId: string,
  data: ProfileEditData,
  adminId: string | null = null
): Promise<boolean> {
  const payload: Record<string, unknown> = {
    ...data,
    updated_at: new Date().toISOString(),
  };
  const ok = await sbUpdate('profiles', userId, payload);
  if (ok) await logActivity(adminId, userId, 'edit_profile', data as Record<string, unknown>);
  return ok;
}

// ── 6. Toggle Wirker Status ─────────────────────────────────────────────
export async function toggleWirkerStatus(
  userId: string,
  current: boolean,
  adminId: string | null = null
): Promise<boolean> {
  const ok = await sbUpdate('profiles', userId, {
    is_wirker: !current,
    updated_at: new Date().toISOString(),
  });
  if (ok) await logActivity(adminId, userId, 'toggle_wirker', { is_wirker: !current });
  return ok;
}

// ── 7. Fetch single profile (for modal refresh) ─────────────────────────
export async function fetchProfile(userId: string) {
  const rows = await sbQuery(
    'profiles',
    { 'id': `eq.${userId}` },
    { select: 'id,display_name,username,avatar_url,bio,role,membership_type,is_wirker,has_talent_profile,talent,location,is_available,impact_eur,followers_count,created_at,status,group,deleted_at,skills', limit: 1 }
  );
  return rows[0] ?? null;
}
