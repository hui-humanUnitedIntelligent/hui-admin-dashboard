// frontend/src/app/api/migrate/website-reviews/route.ts
// Einmal-Route: Tabelle erstellen + bestehende Reviews migrieren
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

const EXISTING_REVIEWS = [{"id": "92f62f2e-da2f-407f-b074-3f105ea17b78", "name": "Jonas K.", "stars": 5, "message": "Die Plattform funktioniert zuverlässig, transparent und ohne versteckte Kosten. Ich finde schnell Talente, die wirklich helfen — und gleichzeitig unterstützt jede Buchung soziale Projekte. Das ist modernes, verantwortungsvolles Buchen.“", "date": "7.6.2026"}, {"id": "d2f6603a-0085-4267-a183-09f355c40630", "name": "Daniel K.", "stars": 5, "message": "Ich war überrascht, wie schnell ich über HUI die richtige Unterstützung gefunden habe. Freundlich, sicher und komplett stressfrei. Und dass gleichzeitig soziale Projekte profitieren, ist für mich das Sahnehäubchen.", "date": "7.6.2026", "approvedAt": "2026-06-07T13:16:06.438Z"}, {"id": "ec901d90-6b57-4336-b886-59cb251c2576", "name": "Sophie Lauper", "stars": 5, "message": "Ich liebe die Idee hinter HUI. Es fühlt sich an, als wäre man Teil einer Bewegung, die wirklich etwas verändert. Nicht nur buchen — sondern Wirkung erzeugen. Das macht HUI einzigartig.", "date": "7.6.2026", "approvedAt": "2026-06-07T13:16:08.792Z"}, {"id": "3b36bc67-4ecf-4077-9f1a-c8206d2d63fd", "name": "Markus", "stars": 5, "message": "HUI hat mir geholfen, meine Talente endlich sichtbar zu machen. Ich bekomme faire Anfragen, sichere Zahlungen und weiß gleichzeitig, dass jede Buchung etwas Gutes bewirkt. Genau so sollte moderne Arbeit funktionieren.", "date": "7.6.2026", "approvedAt": "2026-06-07T13:16:11.374Z"}];

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const sb = getServiceClient();
    
    // Test ob Tabelle schon existiert
    const { data: test, error: testErr } = await sb
      .from('website_reviews').select('id').limit(1);
    
    if (testErr && (testErr.code === 'PGRST205' || testErr.message.includes('schema cache'))) {
      return NextResponse.json({ 
        ok: false, 
        tableExists: false,
        message: 'Tabelle muss im Supabase SQL Editor erstellt werden.',
        sql: `CREATE TABLE IF NOT EXISTS public.website_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL DEFAULT 'Anonym',
  email       text,
  stars       smallint CHECK (stars BETWEEN 1 AND 5),
  message     text NOT NULL,
  source      text DEFAULT 'website',
  page        text,
  status      text DEFAULT 'published',
  is_featured boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);`
      });
    }

    // Tabelle existiert — bestehende Reviews einfügen
    const { count: existing } = await sb
      .from('website_reviews').select('*', { count: 'exact', head: true });
    
    if ((existing ?? 0) > 0) {
      return NextResponse.json({ ok: true, message: `Tabelle hat bereits ${existing} Eintraege. Migration uebersprungen.`, migrated: 0 });
    }

    // Reviews migrieren
    const toInsert = EXISTING_REVIEWS.map((r: {name?: string; message?: string; stars?: number; approvedAt?: string}) => ({
      name:       r.name    || 'Anonym',
      message:    r.message || '',
      stars:      r.stars   || null,
      status:     'published',
      source:     'website',
      created_at: r.approvedAt || new Date().toISOString(),
    })).filter((r: {message: string}) => r.message.trim());

    const { data, error } = await sb.from('website_reviews').insert(toInsert).select('id');
    if (error) return NextResponse.json({ ok: false, error: error.message });

    return NextResponse.json({ ok: true, migrated: data?.length ?? 0, message: `${data?.length} Reviews migriert.` });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
