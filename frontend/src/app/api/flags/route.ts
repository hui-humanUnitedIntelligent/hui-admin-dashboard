// frontend/src/app/api/flags/route.ts
// Feature Flags — stored in Vercel KV via JSON file simulation using profile metadata
// We store flags as a JSON in a special "system" profile OR in localStorage + server config
// Best approach: store in a dedicated notifications entry with user_id=null substitute
// Actually: use a simple JSON config stored as a notification of type='feature_flags_config'
// with a fixed known title so we can always fetch/update it

import { NextRequest, NextResponse } from 'next/server';

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

// Default flags
const DEFAULT_FLAGS: Record<string, { label: string; description: string; enabled: boolean; target: string; category: string }> = {
  new_payment_page:      { label: 'Neue Zahlungsseite',       description: 'Aktiviert die überarbeitete Checkout-UI',           enabled: false, target: 'all',       category: 'Zahlung'    },
  wirker_marketplace:    { label: 'Wirker-Marketplace Beta',   description: 'Zeigt den neuen Wirker-Marktplatz',                 enabled: false, target: 'wirker',    category: 'Features'   },
  impact_voting_v2:      { label: 'Impact-Voting V2',          description: 'Neues gewichtetes Abstimmungssystem',               enabled: false, target: 'members',   category: 'Impact'     },
  stories_feature:       { label: 'Stories-Funktion',          description: 'Stories sichtbar für alle User',                    enabled: true,  target: 'all',       category: 'Content'    },
  maintenance_mode:      { label: 'Wartungsmodus',             description: 'Zeigt allen Usern eine Wartungsseite',              enabled: false, target: 'all',       category: 'System'     },
  new_onboarding:        { label: 'Neues Onboarding',          description: 'Überarbeiteter Registrierungsflow',                 enabled: false, target: 'basisuser', category: 'UX'         },
  realtime_chat:         { label: 'Echtzeit-Chat',             description: 'WebSocket-basierter Chat (Beta)',                   enabled: true,  target: 'all',       category: 'Features'   },
  ai_recommendations:    { label: 'KI-Empfehlungen',           description: 'Personalisierte Wirker-Vorschläge per ML',         enabled: false, target: 'all',       category: 'KI'         },
};

const CONFIG_TITLE = '__hui_feature_flags_v1__';

async function loadFlags(): Promise<Record<string, unknown>> {
  const url = `${SUPA}/rest/v1/invitations?title=eq.${encodeURIComponent(CONFIG_TITLE)}&select=id,body&limit=1`;
  const res = await fetch(url, { headers: H });
  const data = await res.json().catch(() => []);
  if (Array.isArray(data) && data[0]?.body) {
    try { return JSON.parse(data[0].body); } catch (_) {}
  }
  return DEFAULT_FLAGS;
}

async function saveFlags(flags: Record<string, unknown>): Promise<boolean> {
  const url = `${SUPA}/rest/v1/invitations?title=eq.${encodeURIComponent(CONFIG_TITLE)}&select=id&limit=1`;
  const existing = await fetch(url, { headers: H }).then(r => r.json()).catch(() => []);
  const body = JSON.stringify(flags);

  if (Array.isArray(existing) && existing[0]?.id) {
    const res = await fetch(`${SUPA}/rest/v1/invitations?id=eq.${existing[0].id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ body }),
    });
    return res.ok;
  } else {
    const res = await fetch(`${SUPA}/rest/v1/invitations`, {
      method: 'POST', headers: H,
      body: JSON.stringify({ title: CONFIG_TITLE, body, text: '{}', created_at: new Date().toISOString() }),
    });
    return res.ok;
  }
}

export async function GET() {
  if (!KEY) return NextResponse.json({ error: 'No key' }, { status: 500 });
  const flags = await loadFlags();
  return NextResponse.json(flags);
}

export async function POST(req: NextRequest) {
  if (!KEY) return NextResponse.json({ error: 'No key' }, { status: 500 });
  const { action, flagKey, value, newFlag } = await req.json();

  if (action === 'toggle') {
    const flags = await loadFlags() as Record<string, Record<string, unknown>>;
    if (!flags[flagKey]) return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
    flags[flagKey].enabled = value;
    const ok = await saveFlags(flags);
    return NextResponse.json({ ok });
  }

  if (action === 'update') {
    const flags = await loadFlags() as Record<string, Record<string, unknown>>;
    if (!flags[flagKey]) return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
    flags[flagKey] = { ...flags[flagKey], ...value };
    const ok = await saveFlags(flags);
    return NextResponse.json({ ok });
  }

  if (action === 'create') {
    const flags = await loadFlags() as Record<string, Record<string, unknown>>;
    const key = newFlag.key?.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    if (!key) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    flags[key] = { label: newFlag.label, description: newFlag.description || '', enabled: false, target: newFlag.target || 'all', category: newFlag.category || 'Custom' };
    const ok = await saveFlags(flags);
    return NextResponse.json({ ok });
  }

  if (action === 'delete') {
    const flags = await loadFlags() as Record<string, Record<string, unknown>>;
    delete flags[flagKey];
    const ok = await saveFlags(flags);
    return NextResponse.json({ ok });
  }

  if (action === 'reset') {
    const ok = await saveFlags(DEFAULT_FLAGS);
    return NextResponse.json({ ok });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
