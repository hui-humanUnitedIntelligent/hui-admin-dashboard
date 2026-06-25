// frontend/src/app/lib/supabase-server.ts
// ── Zentraler Server-Side Supabase Client (Service Role) ─────────────────────
// NUR für Server Components und API Routes — NIEMALS im Client-Bundle.
// Verwendet SUPABASE_SERVICE_ROLE_KEY (server-only env var).

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _serviceClient: SupabaseClient | null = null;

/** Service-Role-Client — umgeht RLS komplett. Nur für Admin-Routes. */
export function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase Service-Role-Konfiguration fehlt (SUPABASE_SERVICE_ROLE_KEY)');
  }

  _serviceClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  });

  return _serviceClient;
}

/** Anon-Client — für Auth-Validierung (getUser mit user JWT). */
export function getAnonClient(): SupabaseClient {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL     || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  return createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
