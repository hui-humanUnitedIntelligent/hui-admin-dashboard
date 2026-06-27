// frontend/src/app/api/flags/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardSuperAdmin } from '@/app/lib/auth-guard';
import { ok, fail, serverError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

type FlagEntry = {
  label: string;
  description: string;
  enabled: boolean;
  target: string;
  category: string;
  created_at?: string;
  updated_at?: string;
};
type Flags = Record<string, FlagEntry>;

// ── Default Flags (Fallback wenn DB leer) ─────────────────────────────────
const DEFAULT_FLAGS: Flags = {
  new_payment_page:   { label:'Neue Zahlungsseite',       description:'Aktiviert die überarbeitete Checkout-UI mit Stripe-Integration',    enabled:false, target:'all',     category:'Zahlung'  },
  wirker_marketplace: { label:'Wirker-Marketplace Beta',  description:'Zeigt den neuen Wirker-Marktplatz für Wirker-Accounts',              enabled:false, target:'wirker',  category:'Features' },
  impact_voting_v2:   { label:'Impact-Voting V2',         description:'Neues gewichtetes Abstimmungssystem mit Slidern für Members',        enabled:false, target:'members', category:'Impact'   },
  stories_feature:    { label:'Stories-Funktion',         description:'Kurzvideos & Stories im Feed aktivieren',                            enabled:false, target:'all',     category:'Content'  },
  ki_empfehlungen:    { label:'KI-Empfehlungen',          description:'Personalisierte Inhaltsempfehlungen via KI im Entdecken-Bereich',    enabled:false, target:'all',     category:'KI'       },
  dark_mode_v2:       { label:'Dark Mode V2',             description:'Überarbeitetes Dark-Mode-Farbschema mit besseren Kontrasten',        enabled:true,  target:'all',     category:'UX'       },
  impact_pool_live:   { label:'Impact Pool Live-Anzeige', description:'Echtzeit-Anzeige des aktuellen Impact-Pools für Members',            enabled:true,  target:'members', category:'Impact'   },
  ambassador_program: { label:'Ambassador-Programm',      description:'Ambassador-Bereich inkl. Referral-Links freischalten',               enabled:false, target:'all',     category:'Features' },
  booking_system_v2:  { label:'Buchungssystem V2',        description:'Neues Buchungssystem mit Kalenderintegration',                       enabled:false, target:'wirker',  category:'Features' },
  notifications_push: { label:'Push-Benachrichtigungen',  description:'Browser/Mobile Push-Benachrichtigungen aktivieren',                 enabled:false, target:'all',     category:'System'   },
  maintenance_mode:   { label:'Wartungsmodus',            description:'Alle Nutzer sehen Wartungsseite — nur Admins können sich einloggen', enabled:false, target:'all',     category:'System'   },
  new_profile_v2:     { label:'Profil V2',                description:'Überarbeitetes Nutzerprofil mit Portfolio-Ansicht',                  enabled:false, target:'all',     category:'UX'       },
};

// In-Memory Store (persistiert über Vercel-Restarts per Re-Deploy)
// Für echte Persistenz: feature_flags Tabelle in Supabase anlegen
let memStore: Flags | null = null;

function getStore(): Flags {
  if (!memStore) memStore = { ...DEFAULT_FLAGS };
  return memStore;
}

// Versuche Supabase zu nutzen (falls Tabelle existiert)
async function loadFromDB(): Promise<Flags | null> {
  try {
    const sb = getServiceClient();
    const { data, error } = await sb.from('feature_flags').select('*').order('created_at');
    if (error || !data?.length) return null;
    const flags: Flags = {};
    for (const row of data) {
      flags[row.key] = {
        label:       row.label,
        description: row.description ?? '',
        enabled:     Boolean(row.enabled),
        target:      row.target ?? 'all',
        category:    row.category ?? 'Features',
        created_at:  row.created_at,
        updated_at:  row.updated_at,
      };
    }
    return flags;
  } catch { return null; }
}

async function saveToDB(key: string, patch: Partial<FlagEntry>): Promise<boolean> {
  try {
    const sb = getServiceClient();
    const { error } = await sb.from('feature_flags')
      .upsert({ key, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    return !error;
  } catch { return false; }
}

async function deleteToDB(key: string): Promise<boolean> {
  try {
    const sb = getServiceClient();
    const { error } = await sb.from('feature_flags').delete().eq('key', key);
    return !error;
  } catch { return false; }
}

// ── GET /api/flags ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  try {
    const flags = (await loadFromDB()) ?? getStore();
    return ok(flags);
  } catch (err) {
    return serverError(err, 'flags GET');
  }
}

// ── PATCH /api/flags — toggle oder update ─────────────────────────────────
export async function PATCH(req: NextRequest) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json() as { key?: string; keys?: string[]; enabled?: boolean; label?: string; description?: string; target?: string; category?: string; action?: string };
    const store = (await loadFromDB()) ?? getStore();

    // Bulk-Toggle mehrerer Keys
    if (body.action === 'bulk_toggle' && Array.isArray(body.keys)) {
      const results: Record<string, boolean> = {};
      for (const k of body.keys) {
        if (!store[k]) continue;
        const newEnabled = body.enabled ?? !store[k].enabled;
        store[k] = { ...store[k], enabled: newEnabled, updated_at: new Date().toISOString() };
        await saveToDB(k, { enabled: newEnabled });
        results[k] = newEnabled;
      }
      memStore = store;
      return ok({ updated: results });
    }

    // Einzelner Key
    const { key } = body;
    if (!key) return fail('key erforderlich');
    if (!store[key]) return fail(`Flag '${key}' nicht gefunden`);

    const patch: Partial<FlagEntry> = {};
    if (body.enabled !== undefined) patch.enabled     = body.enabled;
    if (body.label)                  patch.label       = body.label;
    if (body.description !== undefined) patch.description = body.description;
    if (body.target)                 patch.target      = body.target;
    if (body.category)               patch.category    = body.category;
    patch.updated_at = new Date().toISOString();

    store[key] = { ...store[key], ...patch };
    memStore = store;
    await saveToDB(key, patch);

    return ok({ key, flag: store[key] });
  } catch (err) {
    return serverError(err, 'flags PATCH');
  }
}

// ── POST /api/flags — neue Flag anlegen ───────────────────────────────────
export async function POST(req: NextRequest) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  try {
    const body = await req.json() as { key?: string; label?: string; description?: string; target?: string; category?: string };
    const { key, label } = body;
    if (!key || !label) return fail('key und label erforderlich');
    if (!/^[a-z0-9_]+$/.test(key)) return fail('key: nur Kleinbuchstaben, Zahlen, Unterstriche');

    const store = (await loadFromDB()) ?? getStore();
    if (store[key]) return fail(`Flag '${key}' existiert bereits`);

    const newFlag: FlagEntry = {
      label,
      description:  body.description ?? '',
      enabled:      false,
      target:       body.target   ?? 'all',
      category:     body.category ?? 'Features',
      created_at:   new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    };

    store[key] = newFlag;
    memStore = store;
    await saveToDB(key, newFlag);

    return ok({ key, flag: newFlag });
  } catch (err) {
    return serverError(err, 'flags POST');
  }
}

// ── DELETE /api/flags ─────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const guard = await guardSuperAdmin(req);
  if (guard) return guard;

  try {
    const { key } = await req.json() as { key?: string };
    if (!key) return fail('key erforderlich');

    const store = (await loadFromDB()) ?? getStore();
    if (!store[key]) return fail(`Flag '${key}' nicht gefunden`);

    delete store[key];
    memStore = store;
    await deleteToDB(key);

    return ok({ deleted: key });
  } catch (err) {
    return serverError(err, 'flags DELETE');
  }
}
