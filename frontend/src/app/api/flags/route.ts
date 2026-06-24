// frontend/src/app/api/flags/route.ts
import { NextRequest } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { ok, fail, notFound, serverError, validationError } from '@/app/lib/api-response';
import { getServiceClient } from '@/app/lib/supabase-server';

type FlagEntry = { label: string; description: string; enabled: boolean; target: string; category: string };

const DEFAULT_FLAGS: Record<string, FlagEntry> = {
  new_payment_page:   { label: 'Neue Zahlungsseite',     description: 'Aktiviert die überarbeitete Checkout-UI',    enabled: false, target: 'all',    category: 'Zahlung'  },
  wirker_marketplace: { label: 'Wirker-Marketplace Beta', description: 'Zeigt den neuen Wirker-Marktplatz',          enabled: false, target: 'wirker', category: 'Features' },
  impact_voting_v2:   { label: 'Impact-Voting V2',        description: 'Neues gewichtetes Abstimmungssystem',        enabled: false, target: 'members',category: 'Impact'   },
  stories_feature:    { label: 'Stories-Funktion',         description: 'Stories sichtbar für alle User',            enabled: true,  target: 'all',    category: 'Content'  },
  maintenance_mode:   { label: 'Wartungsmodus',            description: 'Zeigt allen Usern eine Wartungsseite',      enabled: false, target: 'all',    category: 'System'   },
  new_onboarding:     { label: 'Neues Onboarding',         description: 'Überarbeiteter Registrierungsflow',         enabled: false, target: 'basisuser', category: 'UX'  },
  realtime_chat:      { label: 'Echtzeit-Chat',            description: 'WebSocket-basierter Chat (Beta)',           enabled: true,  target: 'all',    category: 'Features' },
  ai_recommendations: { label: 'KI-Empfehlungen',          description: 'Personalisierte Wirker-Vorschläge per ML', enabled: false, target: 'all',    category: 'KI'       },
};

const CONFIG_TITLE = '__hui_feature_flags_v1__';

async function loadFlags() {
  const sb = getServiceClient();
  const { data } = await sb.from('invitations').select('id,body').eq('title', CONFIG_TITLE).limit(1).single();
  if (data?.body) { try { return { id: data.id as string, flags: JSON.parse(data.body) as Record<string, FlagEntry> }; } catch (_) {} }
  return { id: null as string | null, flags: { ...DEFAULT_FLAGS } };
}

async function saveFlags(id: string | null, flags: Record<string, FlagEntry>) {
  const sb = getServiceClient();
  const bodyStr = JSON.stringify(flags);
  if (id) {
    const { error } = await sb.from('invitations').update({ body: bodyStr }).eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await sb.from('invitations').insert({ title: CONFIG_TITLE, body: bodyStr, text: '{}', created_at: new Date().toISOString() });
    if (error) throw error;
  }
}

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const { flags } = await loadFlags();
    return ok(flags);
  } catch (err) { return serverError(err, 'flags GET'); }
}

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const body = await req.json().catch(() => ({}));
    const { action, flagKey, value, newFlag } = body as {
      action?: string; flagKey?: string; value?: unknown; newFlag?: Partial<FlagEntry> & { key?: string };
    };
    if (!action) return validationError({ action: 'Pflichtfeld' });

    const { id, flags } = await loadFlags();

    switch (action) {
      case 'toggle': {
        if (!flagKey || !flags[flagKey]) return notFound('Feature Flag');
        flags[flagKey].enabled = Boolean(value);
        await saveFlags(id, flags);
        return ok({ flagKey, enabled: flags[flagKey].enabled });
      }
      case 'update': {
        if (!flagKey || !flags[flagKey]) return notFound('Feature Flag');
        flags[flagKey] = { ...flags[flagKey], ...(value as Partial<FlagEntry>) };
        await saveFlags(id, flags);
        return ok(flags[flagKey]);
      }
      case 'create': {
        if (!newFlag?.key) return validationError({ key: 'Pflichtfeld' });
        const key = newFlag.key.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
        if (!key) return validationError({ key: 'Ungültiger Schlüssel' });
        flags[key] = { label: newFlag.label ?? key, description: newFlag.description ?? '', enabled: false, target: newFlag.target ?? 'all', category: newFlag.category ?? 'Custom' };
        await saveFlags(id, flags);
        return ok(flags[key]);
      }
      case 'delete': {
        if (!flagKey || !flags[flagKey]) return notFound('Feature Flag');
        delete flags[flagKey];
        await saveFlags(id, flags);
        return ok({ deleted: true, flagKey });
      }
      case 'reset': {
        await saveFlags(id, { ...DEFAULT_FLAGS });
        return ok({ reset: true });
      }
      default: return fail(`Unbekannte Aktion: ${action}`);
    }
  } catch (err) { return serverError(err, 'flags POST'); }
}
