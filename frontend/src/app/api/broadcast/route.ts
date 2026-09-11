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

    // list — Verlauf
    const { data } = await sb
      .from('notifications')
      .select('id,title,body,type,created_at,user_id')
      .eq('type', 'broadcast')
      .order('created_at', { ascending: false })
      .limit(500);

    const map = new Map<string, { id: string; title: string; body: string; target_group: string; sent_count: number; created_at: string; }>();
    for (const n of (data ?? [])) {
      const key = `${n.title}|${n.created_at?.slice(0, 16)}`;
      if (!map.has(key)) {
        map.set(key, { id: n.id, title: n.title, body: n.body ?? '', target_group: 'all', sent_count: 1, created_at: n.created_at });
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

    if (contentType.includes('multipart/form-data')) {
      // Neuer Weg: multipart mit Trailer-File
      const form = await req.formData();
      title = String(form.get('title') || '').trim();
      body = String(form.get('body') || '').trim();
      target_group = String(form.get('target_group') || 'all');
      youtubeUrl = String(form.get('youtube_url') || '').trim();
      const tf = form.get('trailer');
      if (tf instanceof File && tf.size > 0) trailerFile = tf;
    } else {
      // Legacy-Weg: JSON ohne Trailer (Altlasten/Kompatibilitaet)
      const j = await req.json();
      title = String(j.title || '').trim();
      body = String(j.body || '').trim();
      target_group = String(j.target_group || 'all');
    }

    if (!title || !body) return NextResponse.json({ ok: false, error: 'Titel und Inhalt erforderlich' }, { status: 400 });
    if (contentType.includes('multipart/form-data')) {
      // Alle 3 Komponenten Pflicht (neues Video-Broadcast-Format)
      if (!trailerFile) return NextResponse.json({ ok: false, error: 'Trailer-Video erforderlich' }, { status: 400 });
      if (!youtubeUrl) return NextResponse.json({ ok: false, error: 'YouTube-Link erforderlich' }, { status: 400 });
      if (!trailerFile.type.startsWith('video/')) return NextResponse.json({ ok: false, error: 'Bitte ein Video-Format wählen (MP4, WebM, etc.)' }, { status: 400 });
      if (trailerFile.size > MAX_BROADCAST_VIDEO_BYTES) return NextResponse.json({ ok: false, error: 'Datei zu groß (max 500MB)' }, { status: 400 });
      if (!YOUTUBE_URL_RE.test(youtubeUrl)) return NextResponse.json({ ok: false, error: 'Ungültiger YouTube-Link' }, { status: 400 });
    }

    let trailerStorageUrl: string | null = null;
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

    // data-JSONB: trailer_url + youtube_url — der be-hui-Trigger liest beide
    // Felder und baut daraus den Feed-Moment (type='video', klickbarer Link).
    const broadcastData = {
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
    const { data: ref } = await sb.from('notifications').select('title,created_at').eq('id', broadcast_id).single();
    if (!ref) return NextResponse.json({ error: 'Broadcast nicht gefunden' }, { status: 404 });
    const minTime = ref.created_at.slice(0, 16);
    const maxTime = new Date(new Date(ref.created_at).getTime() + 60000).toISOString();
    const { count } = await sb.from('notifications').delete({ count: 'exact' })
      .eq('type', 'broadcast').eq('title', ref.title).gte('created_at', minTime).lte('created_at', maxTime);
    return NextResponse.json({ ok: true, deleted_count: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
