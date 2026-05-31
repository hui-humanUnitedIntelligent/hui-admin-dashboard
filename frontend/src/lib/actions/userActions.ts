// frontend/src/lib/actions/userActions.ts
// ── HUI Admin — User Management Actions ──────────────────────────────────
// Alle Writes gehen über /api/admin (server-side, Service Role Key)
// Reads: direkt via Supabase anon key (nur lesen, kein RLS-Problem)

export type UserRole  = 'basisuser' | 'basis_user' | 'member' | 'wirker' | 'admin' | 'superadmin';
export type UserGroup = 'wirker' | 'talent' | 'impact' | 'basisuser' | 'member' | 'pending';

export interface ProfileEditData {
  display_name?: string;
  bio?:          string;
  location?:     string;
  talent?:       string;
  tagline?:      string;
  is_available?: boolean;
  skills?:       string[];
}

// ── Core: call server-side admin API ─────────────────────────────────────
async function adminAction(
  action: string,
  userId: string,
  data: Record<string, unknown> = {}
): Promise<boolean> {
  try {
    const res = await fetch('/api/admin', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, userId, data }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[adminAction] ${action} failed:`, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[adminAction] ${action} error:`, e);
    return false;
  }
}

// ── 1. Block / Unblock ───────────────────────────────────────────────────
export async function blockUser(userId: string): Promise<boolean> {
  return adminAction('block_user', userId);
}
export async function unblockUser(userId: string, previousRole?: string): Promise<boolean> {
  return adminAction('unblock_user', userId, { previousRole: previousRole || 'basisuser' });
}

// ── 2. Soft Delete ───────────────────────────────────────────────────────
export async function softDeleteUser(userId: string): Promise<boolean> {
  return adminAction('delete_user', userId);
}

// ── 3. Change Role ───────────────────────────────────────────────────────
export async function changeUserRole(userId: string, newRole: UserRole): Promise<boolean> {
  return adminAction('change_role', userId, { role: newRole });
}

// ── 4. Change Group ──────────────────────────────────────────────────────
export async function changeUserGroup(userId: string, newGroup: UserGroup): Promise<boolean> {
  return adminAction('change_group', userId, { group: newGroup });
}

// ── 5. Edit Profile ──────────────────────────────────────────────────────
export async function editProfile(userId: string, data: ProfileEditData): Promise<boolean> {
  return adminAction('edit_profile', userId, data as Record<string, unknown>);
}

// ── 6. Toggle Wirker ─────────────────────────────────────────────────────
export async function toggleWirkerStatus(userId: string, currentValue: boolean): Promise<boolean> {
  return adminAction('toggle_wirker', userId, { is_wirker: !currentValue });
}
