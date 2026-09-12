// frontend/src/app/api/broadcast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/app/lib/auth-guard';
import { getServiceClient } from '@/app/lib/supabase-server';

export async function GET(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const sb = getServiceClient();
    const action = req.nextUrl.searchParams.get('action');

    if (action === 'stats') {
      const [total, wirker, members, admins] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }).not('email', 'like', '%hui-commerce.test%'),
        sb.from('profiles').select('id', { count: 'exact', head: true }).not('email', 'like', '%hui-commerce.test%').eq('is_wirker', true),
        sb.from('profiles').select('id', { count: 'exact', head: true }).not('email', 'like', '%hui-commerce.test%').eq('is_member', true),
        sb.from('profiles').select('id', { count: 'exact', head: true }).not('email', 'like', '%hui-commerce.test%').in('role', ['admin', 'superadmin']),
      ]);
      const { data: bData } = await sb.from('notifications').select('title,created_at').eq('type', 'broadcast');
      const seen = new Set<string>();
      for (const n of (bData ?? [])) {
        seen.add(`${n.title}|${n.created_at?.slice(0, 16)}`);
      }
      return NextResponse.json({
        total_users:      total.count ?? 0,
        wirker:           wirker.count ?? 0,
        members:          members.count ?? 0,
        admins:           admins.count ?? 0,
        total_broadcasts: seen.size,
      });
    }

    // ── BROADCAST-413-FIX (2026-09-12): Signierte Upload-URL fuer Trailer ──
    // BEWEIS (live gegen hui-admin.com getestet): Vercel Serverless hat ein
    // hartes 4.5MB Request-Body-Limit — ein 10MB multipart POST beantwortet
    // Vercel mit HTTP 413 FUNCTION_PAYLOAD_TOO_LARGE, die Route laeuft NIE.
    // Michaels Tilo.MOV (echtes iPhone-Video) ist groesser -> Broadcast kam
    // nicht an, ohne jede Fehlermeldung (der alte handleSend hatte try/finally
    // OHNE catch). Fix: Der Browser laedt das Video direkt zu Supabase Storage
    // hoch (Bucket-Limit 500MB gilt weiter, KEIN Vercel-Limit) — diese Route
    // signiert nur die Upload-URL (Admin-Gate bleibt serverseitig) und der
    // POST erhaelt die finale Storage-URL als winziges JSON. Mechanik E2E
    // verifiziert (2026-09-12): sign -> PUT mit ?token -> HTTP 200 ->
    // public-URL liefert Inhalte, Testobjekt wieder entfernt.
    if (action === 'sign_trailer') {
      const filename = req.nextUrl.searchParams.get('filename') || '';
      const size = Number(req.nextUrl.searchParams.get('size') || 0);
      const mime = req.nextUrl.searchParams.get('mime') || '';
      if (!size || size > MAX_BROADCAST_VIDEO_BYTES) return NextResponse.json({ ok: false, error: 'Datei zu groß (max 500MB)' }, { status: 400 });
      if (!mime.startsWith('video/')) return NextResponse.json({ ok: false, error: 'Bitte ein Video-Format wählen (MP4, WebM, etc.)' }, { status: 400 });
      const extMatch = /\.(mp4|webm|mov|m4v|ogv)$/i.exec(filename);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'mp4';
      const fileName = `trailer-${Date.now()}.${ext}`;
      const sbSign = getServiceClient();
      const { data: signed, error: signErr } = await sbSign.storage.from('broadcasts').createSignedUploadUrl(fileName);
      if (signErr || !signed) return NextResponse.json({ ok: false, error: `Upload-Signatur fehlgeschlagen: ${signErr?.message || 'unbekannt'}` }, { status: 500 });
      const { data: pub } = sbSign.storage.from('broadcasts').getPublicUrl(fileName);
      const sbUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
      return NextResponse.json({
        ok: true,
        path: signed.path,
        upload_url: `${sbUrl}/storage/v1/object/upload/sign/broadcasts/${signed.path}?token=${encodeURIComponent(signed.token)}`,
        public_url: pub.publicUrl,
      });
    }

    // list — Verlauf
    const { data } = await sb
      .from('notifications')
      .select('id,title,body,type,created_at,user_id,data')
      .eq('type', 'broadcast')
      .order('created_at', { ascending: false })
      .limit(500);

    const map = new Map<string, { id: string; title: string; body: string; target_group: string; sent_count: number; created_at: string; }>();
    for (const n of (data ?? [])) {
      const key = `${n.title}|${n.created_at?.slice(0, 16)}`;
      if (!map.has(key)) {
        // BROADCAST-TARGET-GATE (2026-09-11): echte Zielgruppe aus data-JSONB
        // statt hardcoded 'all' (Migration 137 schreibt sie ab jetzt mit).
        const tg = (n.data as { target_group?: string } | null)?.target_group || 'all';
        map.set(key, { id: n.id, title: n.title, body: n.body ?? '', target_group: tg, sent_count: 1, created_at: n.created_at });
      } else {
        map.get(key)!.sent_count++;
      }
    }
    return NextResponse.json(Array.from(map.values()));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── VIDEO-BROADCAST-001 (2026-09-11): Multipart-Upload ────────────────────────
// Der Broadcast-POST sendet jetzt multipart/form-data mit:
//   trailer (File, video/*, max MAX_BROADCAST_VIDEO_BYTES — beliebig lang),
//   youtube_url (String, youtube.com/youtu.be), title, body, target_group.
// Trailer wird in den Supabase-Storage-Bucket 'broadcasts' (public-read,
// 500MB-Limit, video/* — Migration 136 be-hui) hochgeladen; die Storage-URL
// + YouTube-Link landen im notifications.data-JSONB. Der be-hui-Trigger
// trg_broadcast_to_beitrag erzeugt daraus transaktional den Feed-Moment
// (type='video' + klickbarer YouTube-Link) — KEIN posted_by_bot-Flag/Retry
// noetig (alte JSON-Requests ohne trailer bleiben kompatibel: Gedanke-Post).
const MAX_BROADCAST_VIDEO_BYTES = 500 * 1024 * 1024; // 500MB (Storage-Bucket-Limit identisch)
const YOUTUBE_URL_RE = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=[\w-]{6,}|youtu\.be\/[\w-]{6,})/;

export async function POST(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const contentType = req.headers.get('content-type') || '';
    let title = '', body = '', target_group = 'all', youtubeUrl = '';
    let trailerFile: File | null = null;
    let trailerUrlDirect = '';

    if (contentType.includes('multipart/form-data')) {
      // Alter multipart-Weg mit Trailer-File — NUR noch fuer Dateien <= 4MB
      // praktikabel (Vercel-Serverless-Body-Limit 4.5MB, siehe BROADCAST-413-FIX).
      // Das SADB-Frontend nutzt diesen Weg seit dem 413-Fix nicht mehr.
      const form = await req.formData();
      title = String(form.get('title') || '').trim();
      body = String(form.get('body') || '').trim();
      target_group = String(form.get('target_group') || 'all');
      youtubeUrl = String(form.get('youtube_url') || '').trim();
      const tf = form.get('trailer');
      if (tf instanceof File && tf.size > 0) trailerFile = tf;
    } else {
      // JSON-Weg (Standard): trailer_url = finale Storage-URL aus dem
      // Client-Direktupload (sign_trailer), KEIN File im Request-Body.
      const j = await req.json();
      title = String(j.title || '').trim();
      body = String(j.body || '').trim();
      target_group = String(j.target_group || 'all');
      youtubeUrl = String(j.youtube_url || '').trim();
      trailerUrlDirect = String(j.trailer_url || '').trim();
    }

    // BROADCAST-OPTIONAL-MEDIA-001 (2026-09-12, Michael): Nur Titel + Text sind
    // Pflicht. Trailer-Video und YouTube-Link sind OPTIONAL — Validierung nur
    // noch dann, wenn das jeweilige Feld gefüllt ist. Der be-hui-Trigger
    // (Migration 136) verarbeitet leere trailer_url/youtube_url bereits
    // korrekt: ohne Trailer = Gedanke-Post, ohne YouTube-Link = Text ohne
    // angehaengten Film-Verweis. Beide Felder leer = klassischer Text-Broadcast.
    if (!title || !body) return NextResponse.json({ ok: false, error: 'Titel und Inhalt erforderlich' }, { status: 400 });
    if (trailerFile && !trailerFile.type.startsWith('video/')) return NextResponse.json({ ok: false, error: 'Bitte ein Video-Format wählen (MP4, WebM, etc.)' }, { status: 400 });
    if (trailerFile && trailerFile.size > MAX_BROADCAST_VIDEO_BYTES) return NextResponse.json({ ok: false, error: 'Datei zu groß (max 500MB)' }, { status: 400 });
    if (youtubeUrl && !YOUTUBE_URL_RE.test(youtubeUrl)) return NextResponse.json({ ok: false, error: 'Ungültiger YouTube-Link' }, { status: 400 });
    // BROADCAST-413-FIX: Client-Direktupload-URL validieren — nur exakte
    // public-URLs aus dem broadcasts-Bucket des eigenen Supabase-Projekts
    // akzeptieren (kein Open Redirect / keine fremden Quellen im Feed).
    let trailerStorageUrl: string | null = null;
    if (trailerUrlDirect) {
      const sbUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
      const expectedPrefix = `${sbUrl}/storage/v1/object/public/broadcasts/`;
      const objectName = trailerUrlDirect.slice(expectedPrefix.length);
      if (!trailerUrlDirect.startsWith(expectedPrefix) || !/^[\w.-]+$/.test(objectName)) {
        return NextResponse.json({ ok: false, error: 'Ungültige Trailer-URL' }, { status: 400 });
      }
      trailerStorageUrl = trailerUrlDirect;
    }
    if (trailerFile) {
      // Extension aus dem Original-Namen (Fallsicherheit: immer .mp4 als Fallback)
      const extMatch = /\.(mp4|webm|mov|m4v|ogv)$/i.exec(trailerFile.name);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'mp4';
      const fileName = `trailer-${Date.now()}.${ext}`;
      const uploadData = await trailerFile.arrayBuffer();
      const sbUp = getServiceClient();
      const { data: upData, error: upErr } = await sbUp.storage
        .from('broadcasts')
        .upload(fileName, uploadData, { contentType: trailerFile.type, upsert: false });
      if (upErr || !upData) {
        return NextResponse.json({ ok: false, error: `Trailer-Upload fehlgeschlagen: ${upErr?.message || 'unbekannt'}` }, { status: 500 });
      }
      trailerStorageUrl = sbUp.storage.from('broadcasts').getPublicUrl(fileName).data.publicUrl;
    }

    const sb = getServiceClient();

    let userIds: string[] = [];
    if (target_group === 'wirker') {
      const { data } = await sb.from('profiles').select('id').not('email', 'like', '%hui-commerce.test%').eq('is_wirker', true);
      userIds = (data ?? []).map((p: { id: string }) => p.id);
    } else if (target_group === 'members') {
      const { data } = await sb.from('profiles').select('id').not('email', 'like', '%hui-commerce.test%').eq('is_member', true);
      userIds = (data ?? []).map((p: { id: string }) => p.id);
    } else if (target_group === 'admins') {
      const { data } = await sb.from('profiles').select('id').not('email', 'like', '%hui-commerce.test%').in('role', ['admin', 'superadmin']);
      userIds = (data ?? []).map((p: { id: string }) => p.id);
    } else if (target_group === 'basisuser') {
      const { data } = await sb.from('profiles').select('id,is_wirker,is_member,role').not('email', 'like', '%hui-commerce.test%');
      userIds = (data ?? []).filter((p: { is_wirker: boolean; is_member: boolean; role: string }) => !p.is_wirker && !p.is_member && p.role !== 'admin' && p.role !== 'superadmin').map((p: { id: string }) => p.id);
    } else {
      const { data } = await sb.from('profiles').select('id').not('email', 'like', '%hui-commerce.test%');
      userIds = (data ?? []).map((p: { id: string }) => p.id);
    }

    if (userIds.length === 0) return NextResponse.json({ ok: false, error: 'Keine Empfänger gefunden' }, { status: 400 });

    // data-JSONB: target_group + trailer_url + youtube_url.
    // BROADCAST-TARGET-GATE (2026-09-11, Migration 137 be-hui): target_group wird
    // JEDES Mal mitgeschrieben — der be-hui-Trigger trg_broadcast_to_beitrag
    // postet NUR noch target_group='all' als oeffentlichen Feed-Moment; private
    // Zielgruppen (admins/wirker/members/basisuser) bleiben reine
    // Resonanzzentrum-Nachrichten. Vorher: JEDE Zielgruppe wurde public gepostet
    // (Michael-Report: Admin-Test-Broadcast "fuer alle sichtbar").
    // trailer_url + youtube_url bauen (bei 'all') den Video-Feed-Moment.
    const broadcastData = {
      target_group,
      ...(trailerStorageUrl ? { trailer_url: trailerStorageUrl } : {}),
      ...(youtubeUrl ? { youtube_url: youtubeUrl } : {}),
    };
    const notifications = userIds.map(uid => ({ user_id: uid, type: 'broadcast', title, body, is_read: false, read: false, data: broadcastData }));
    const CHUNK = 500;
    // BUGFIX (2026-08-18): Insert-Fehler wurden bisher NICHT geprueft -- z.B. wenn
    // der DB-Trigger trg_broadcast_to_beitrag() beim Anlegen des myHUI-Feed-Posts
    // fehlschlaegt (z.B. FK-Verletzung, weil das myHUI-System-Profil fehlt), wird
    // die GESAMTE notifications-INSERT-Transaktion zurueckgerollt -- der Broadcast
    // kommt dann bei NIEMANDEM an, obwohl die Route bisher trotzdem "ok:true"
    // zurueckgab. Jetzt: Fehler pro Chunk sammeln und als echten Fehler melden.
    let sentCount = 0;
    const errors: string[] = [];
    for (let i = 0; i < notifications.length; i += CHUNK) {
      const chunk = notifications.slice(i, i + CHUNK);
      const { error } = await sb.from('notifications').insert(chunk);
      if (error) {
        errors.push(error.message);
      } else {
        sentCount += chunk.length;
      }
    }
    if (sentCount === 0) {
      return NextResponse.json({ ok: false, error: `Broadcast fehlgeschlagen: ${errors.join('; ') || 'unbekannter Fehler'}` }, { status: 500 });
    }
    if (errors.length > 0) {
      return NextResponse.json({ ok: true, sent_count: sentCount, warning: `Teilweise fehlgeschlagen: ${errors.join('; ')}` });
    }
    return NextResponse.json({ ok: true, sent_count: sentCount });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardAdmin(req);
  if (guard) return guard;
  try {
    const sb = getServiceClient();
    const broadcast_id = req.nextUrl.searchParams.get('broadcast_id');
    if (!broadcast_id) return NextResponse.json({ error: 'broadcast_id fehlt' }, { status: 400 });
    // BROADCAST-DELETE-FEEDPOST-FIX (2026-09-11, Michael-Report "SADB-
    // Loeschen funktioniert nicht"): Der bisherige Handler loeschte NUR die
    // notifications-Zeilen — der Feed-Post (beitraege, moment_source=
    // 'system_broadcast', vom DB-Trigger angelegt) blieb fuer ALLE sichtbar.
    // Jetzt 3 Schritte: notifications + Feed-Post + Trailer-Storage-Objekt.
    const { data: ref } = await sb.from('notifications').select('title,body,data,created_at').eq('id', broadcast_id).single();
    if (!ref) return NextResponse.json({ error: 'Broadcast nicht gefunden' }, { status: 404 });
    const minTime = ref.created_at.slice(0, 16);
    const maxTime = new Date(new Date(ref.created_at).getTime() + 60000).toISOString();

    // 1) Notifications (alle Empfaenger-Kopien, wie bisher)
    const { count: notifCount } = await sb.from('notifications').delete({ count: 'exact' })
      .eq('type', 'broadcast').eq('title', ref.title).gte('created_at', minTime).lte('created_at', maxTime);

    // 2) Feed-Post (vom Trigger trx_broadcast_to_beitrag angelegt — gleiche
    //    Transaktion wie der notifications-Insert, also im selben Zeitfenster)
    const { count: feedPostCount } = await sb.from('beitraege').delete({ count: 'exact' })
      .eq('moment_source', 'system_broadcast')
      .eq('caption', ref.title)
      .gte('created_at', new Date(new Date(ref.created_at).getTime() - 60000).toISOString())
      .lte('created_at', maxTime);

    // 3) Trailer-Objekt aus dem 'broadcasts'-Bucket (sonst bleibt es als
    //    Storage-Leiche liegen; das taegliche 30-Tage-Cron fasst es nicht an,
    //    wenn der Post manuell geloescht wird)
    let trailerDeleted = false;
    const trailerUrl = (ref.data as { trailer_url?: string } | null)?.trailer_url;
    if (trailerUrl) {
      const fileName = trailerUrl.split('/').pop();
      if (fileName) {
        const { error: trailerErr } = await sb.storage.from('broadcasts').remove([fileName]);
        trailerDeleted = !trailerErr;
      }
    }

    return NextResponse.json({
      ok: true,
      deleted_count: notifCount ?? 0,
      deleted_feed_posts: feedPostCount ?? 0,
      trailer_deleted: trailerDeleted,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
