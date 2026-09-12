'use client';
import { useRouter } from 'next/navigation';
// frontend/src/app/broadcast/page.tsx

import { isSuperAdmin } from '@/lib/roles';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { showToast } from '@/components/ui/Toast';
import { getSessionToken } from '@/lib/session';
import { useSettings } from '@/components/providers/ThemeProvider';

interface BroadcastRecord { id: string; title: string; body: string; target_group: string; sent_count: number; created_at: string; }
interface Stats { total_users: number; wirker: number; members: number; admins: number; total_broadcasts: number; }

const TARGET_GROUPS = [
  { key: 'all',       label: '🌍 Alle User',     desc: 'Alle registrierten Nutzer' },
  { key: 'wirker',    label: '⭐ Wirker',         desc: 'Nur Wirker' },
  { key: 'members',   label: '🏅 Members',        desc: 'Nur Mitglieder' },
  { key: 'admins',    label: '🛡️ Admins',         desc: 'Admins & Superadmins' },
  { key: 'basisuser', label: '◎ Basisuser',       desc: 'Nicht-Wirker, Nicht-Mitglieder' },
];

function timeAgo(iso: string) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (d < 1) return 'Gerade eben';
  if (d < 60) return `Vor ${d} Min.`;
  if (d < 1440) return `Vor ${Math.floor(d/60)} Std.`;
  return new Date(iso).toLocaleDateString('de-DE');
}

// BROADCAST-PREVIEW-001 (2026-09-12): Die Vorschau ist eine exakte 1:1-Replik
// der be-hui-Feed-Karte, die aus dem Broadcast entsteht (Trigger
// trg_broadcast_to_beitrag, Migration 136): myHUI-Systemprofil (Fuchs-Avatar,
// profiles.display_name='myHUI', id 152619c1-…ed2 — SSOT der Avatar-URL),
// Bot-Badge + SYSTEMNACHRICHT-Label (HumanHeader isBroadcast-Zweig),
// Titel+Text pre-line (unifiedNormalizer: caption + '\n\n' + content),
// Trailer-Video in breiten-exakter Hoehe (VIDEO-BREITEN-FIX: Hoehe =
// Breite/Aspect, object-contain, KEINE Caps/Balken) und der YouTube-Link
// als teal klickbarer Verweis (LinkifiedText-Verhalten im Feed).
const MYHUI_AVATAR_URL = 'https://gxztrhvhcxhmunhhkfjd.supabase.co/storage/v1/object/public/media/avatars/152619c1-9adc-40bf-9078-eb67f5024ed2/fox-avatar.png';

// VIDEO-BREITEN-FIX (2026-09-11, permanente Regel, Bug 93ce2b88 — siehe
// be-hui BaseFeedCard.jsx getAdaptiveMediaHeight()): Bei Video-Containern
// mit object-fit:"contain" MUSS die Container-Hoehe EXAKT aus
// containerWidth / aspect folgen — jede feste maxHeight/Orientierungs-Cap
// erzeugt Letterbox-Balken (genau der hier gemeldete Bug: Tilo.MOV als
// 9:16-Hochformat wurde durch die alte maxHeight:220 auf eine breite,
// kurze Box gequetscht statt volle Hoehe zu bekommen). SSOT-Formel 1:1
// aus dem be-hui-Feed uebernommen: natural = containerWidth/aspect,
// geclampt auf [150, min(920, max(600, 92% Viewport-Hoehe))] — NUR
// physikalische Extrem-Randfaelle (Panorama-Floor / Riesenfenster-Cap),
// keine Orientierungs-Logik. AdaptiveVideoBox ist die EINE Komponente
// fuer jede Video-Vorschau in diesem Formular (Upload-Widget + Vorschau-
// Karte) — kein duplizierter Sizing-Code.
function computeAdaptiveVideoHeight(aspect: number | null, containerWidth: number): number {
  if (!aspect || !containerWidth) return 260; // Platzhalter bis Metadaten da sind (kein Layout-Sprung)
  const natural = containerWidth / aspect;
  const vh = (typeof window !== 'undefined' && window.innerHeight) || 844;
  const maxH = Math.min(920, Math.max(600, vh * 0.92));
  return Math.min(Math.max(natural, 150), maxH);
}

function AdaptiveVideoBox({ src, muted = false }: { src: string; muted?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  const [aspect, setAspect] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    setContainerW(containerRef.current.offsetWidth);
    const ro = new ResizeObserver(() => {
      if (containerRef.current) setContainerW(containerRef.current.offsetWidth);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Aspect-Ratio zuruecksetzen wenn sich die Quelle aendert (neue Datei ausgewaehlt)
  useEffect(() => { setAspect(null); }, [src]);

  const h = computeAdaptiveVideoHeight(aspect, containerW);
  return (
    <div ref={containerRef} style={{ width: '100%', height: h, background: '#000', borderRadius: 12, overflow: 'hidden' }}>
      <video
        src={src}
        controls
        muted={muted}
        playsInline
        preload="metadata"
        onLoadedMetadata={e => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
        }}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}

// URL-Linkify fuer die Vorschau (Spiegel von LinkifiedText.jsx im Feed:
// URLs werden teal + unterstrichen + klickbar, oeffnen im neuen Tab).
function PreviewLinkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('http') ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: '#0DC4B5', fontWeight: 600, textDecoration: 'underline', textDecorationColor: 'rgba(13,196,181,0.4)', wordBreak: 'break-all' }}>{part}</a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function BroadcastPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isSuperAdmin(currentUser?.role)) router.replace("/dashboard");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.role]);
  if (!isSuperAdmin(currentUser?.role)) return null;

  const userRole = currentUser?.role;
  const { t } = useSettings();
  const [stats, setStats]             = useState<Stats | null>(null);
  const [history, setHistory]         = useState<BroadcastRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState(false);
  const [deleting, setDeleting]       = useState<string | null>(null);

  // Form
  const [title, setTitle]             = useState('');
  const [body, setBody]               = useState('');
  const [targetGroup, setTargetGroup] = useState('all');
  const [preview, setPreview]         = useState(false);
  // ── VIDEO-BROADCAST-001 (2026-09-11): Trailer + YouTube-Link ──
  const [trailerFile, setTrailerFile] = useState<File | null>(null);
  const [trailerPreviewUrl, setTrailerPreviewUrl] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl]   = useState('');
  const [uploadingTrailer, setUploadingTrailer] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, h] = await Promise.all([
      fetch('/api/broadcast?action=stats', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      fetch('/api/broadcast?action=list', { credentials: 'include' }).then(r => r.json()).catch(() => []),
    ]);
    setStats(s);
    setHistory(Array.isArray(h) ? h : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const targetInfo = TARGET_GROUPS.find(g => g.key === targetGroup);

  // Estimated recipients
  const estimated = (() => {
    if (!stats) return '…';
    if (targetGroup === 'all')       return stats.total_users;
    if (targetGroup === 'wirker')    return stats.wirker;
    if (targetGroup === 'members')   return stats.members;
    if (targetGroup === 'admins')    return stats.admins;
    if (targetGroup === 'basisuser') return Math.max(0, stats.total_users - stats.wirker - stats.members - stats.admins);
    return 0;
  })();

  // ── VIDEO-BROADCAST-001 (2026-09-11) ─────────────────────────────────────────
  // Trailer-Select: NUR Format-Pruefung (MIME video/*) + Size (max 500MB).
  // KEINE Laengen-/Duration-Beschraenkung — Trailer duerfen beliebig lang sein.
  const MAX_BROADCAST_VIDEO_BYTES = 500 * 1024 * 1024;
  const YOUTUBE_URL_RE = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=[\w-]{6,}|youtu\.be\/[\w-]{6,})/;

  const handleTrailerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      showToast(t('broadcast.trailerInvalid'), 'error');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_BROADCAST_VIDEO_BYTES) {
      showToast(t('broadcast.trailerTooLarge'), 'error');
      e.target.value = '';
      return;
    }
    setTrailerFile(file);
    // Preview-URL (nur lokal, zum Anschauen vor dem Upload)
    if (trailerPreviewUrl) URL.revokeObjectURL(trailerPreviewUrl);
    setTrailerPreviewUrl(URL.createObjectURL(file));
  };

  const handleTrailerRemove = () => {
    if (trailerPreviewUrl) URL.revokeObjectURL(trailerPreviewUrl);
    setTrailerPreviewUrl(null);
    setTrailerFile(null);
  };

  const handleSend = async () => {
    // BROADCAST-OPTIONAL-MEDIA-001 (2026-09-12, Michael): Nur Titel + Text sind
    // Pflicht. Trailer-Video und YouTube-Link sind OPTIONAL — Format-Check nur
    // wenn gefuellt. Ohne beides erzeugt der be-hui-Trigger einen klassischen
    // Gedanke-Post (Migration 136 behandelt leere trailer_url/youtube_url
    // bereits korrekt, rueckwaertskompatibel).
    if (!title.trim() || !body.trim()) { showToast('Titel und Nachricht erforderlich', 'error'); return; }
    if (youtubeUrl.trim() && !YOUTUBE_URL_RE.test(youtubeUrl.trim())) { showToast(t('broadcast.youtubeInvalid'), 'error'); return; }
    if (!confirm(`Broadcast an ${estimated} User senden?`)) return;
    setSending(true);
    if (trailerFile) setUploadingTrailer(true);
    try {
    // multipart/form-data — die Route laedt den Trailer nach Supabase Storage
    // ('broadcasts'-Bucket) und schreibt trailer_url + youtube_url ins
    // notifications.data; der be-hui-Trigger erzeugt daraus den Feed-Moment.
    const fd = new FormData();
      fd.append('title', title);
      fd.append('body', body);
      fd.append('target_group', targetGroup);
      fd.append('youtube_url', youtubeUrl.trim());
      // BROADCAST-OPTIONAL-MEDIA-001: Trailer nur anhaengen wenn ausgewaehlt
      if (trailerFile) fd.append('trailer', trailerFile);
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(t('broadcast.trailerPosted'), 'success');
        setTitle(''); setBody(''); setPreview(false);
        handleTrailerRemove();
        setYoutubeUrl('');
        load();
      } else {
        showToast(data.error || 'Fehler beim Senden', 'error');
      }
    } finally { setSending(false); setUploadingTrailer(false); }
  };

  const handleDelete = async (broadcastId: string, title: string) => {
    if (!confirm(`Broadcast "${title}" und alle ${history.find(b => b.id === broadcastId)?.sent_count ?? 0} Nachrichten unwiderruflich löschen?`)) return;
    setDeleting(broadcastId);
    try {
      const dToken = getSessionToken();
    const res = await fetch(`/api/broadcast?broadcast_id=${encodeURIComponent(broadcastId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`🗑️ Broadcast gelöscht (${data.deleted_count} Nachrichten entfernt)`, 'success');
        load();
      } else {
        showToast(data.error || 'Fehler beim Löschen', 'error');
      }
    } finally {
      setDeleting(null);
    }
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '10px 13px',
    background: 'var(--bg-primary)', border: '1px solid var(--border)',
    borderRadius: 9, fontSize: 13, color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <DashboardLayout title="Broadcast — Push-Benachrichtigungen">
      <PageHeader
        title="Broadcast"
        subtitle="Nachrichten an alle Nutzer senden"
        actionsRole="superadmin"
        userRole={userRole}
        actions={
          <>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
              📨 {history.length} gesendet
            </span>
            <button onClick={load} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻</button>
          </>
        }
      />

      {/* ── Stats Row ── */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: 'Alle User',        value: stats?.total_users ?? '…', color: 'var(--accent)', icon: '🌍' },
          { label: 'Wirker',           value: stats?.wirker ?? '…',       color: 'var(--purple)', icon: '⭐' },
          { label: 'Members',          value: stats?.members ?? '…',      color: 'var(--gold)',   icon: '🏅' },
          { label: 'Broadcasts total', value: stats?.total_broadcasts ?? '…', color: 'var(--blue)', icon: '📨' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{loading ? '…' : value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 4 }}>{icon} {label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }} className="grid-2">
        {/* ── Compose ── */}
        <div>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✏️</span> Neue Broadcast-Nachricht
            </div>

            {/* Target group */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>Zielgruppe</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {TARGET_GROUPS.map(g => (
                  <button
                    key={g.key}
                    onClick={() => setTargetGroup(g.key)}
                    style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                      border: '1px solid', cursor: 'pointer', fontFamily: 'var(--font-body)',
                      borderColor: targetGroup === g.key ? 'var(--accent)' : 'var(--border)',
                      background: targetGroup === g.key ? 'var(--accent-dim)' : 'var(--bg-primary)',
                      color: targetGroup === g.key ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >{g.label}</button>
                ))}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                {targetInfo?.desc} · <strong style={{ color: 'var(--accent)' }}>~{estimated} Empfänger</strong>
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 5 }}>Titel *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="z.B. Neue Funktion verfügbar 🎉" style={input} maxLength={100} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: 'right' }}>{title.length}/100</div>
            </div>

            {/* Body */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 5 }}>Nachricht *</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Nachrichtentext…" rows={4} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} maxLength={500} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: 'right' }}>{body.length}/500</div>
            </div>

            {/* ── VIDEO-BROADCAST-001 (2026-09-11): Trailer-Video + YouTube-Link ── */}
            {/* Trailer-Video Upload */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>🎬 {t('broadcast.trailerLabel')}</label>
              {!trailerFile ? (
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '18px 13px', background: 'var(--bg-primary)', border: '1px dashed var(--border)',
                  borderRadius: 9, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: 16 }}>📤</span> {t('broadcast.trailerUpload')}
                  <input type="file" accept="video/*" onChange={handleTrailerSelect} style={{ display: 'none' }} />
                </label>
              ) : (
                <div style={{ border: '1px solid var(--accent)', borderRadius: 9, padding: 10, background: 'var(--bg-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      🎬 {trailerFile.name} <span style={{ color: 'var(--text-muted)' }}>({(trailerFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
                    </div>
                    <button onClick={handleTrailerRemove} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>✕</button>
                  </div>
                  {/* Video-Preview — Trailer vor dem Upload anschauen.
                      VIDEO-BREITEN-FIX: AdaptiveVideoBox statt fester maxHeight —
                      9:16-Hochformat (z.B. Tilo.MOV) bekommt jetzt die volle
                      breiten-exakte Hoehe statt in eine kurze Box gequetscht zu werden. */}
                  {trailerPreviewUrl && (
                    <AdaptiveVideoBox src={trailerPreviewUrl} />
                  )}
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Beliebige Länge · max 500MB · MP4, WebM, MOV</div>
            </div>

            {/* YouTube-Link (vollständiger Film) */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 5 }}>▶️ {t('broadcast.youtubeLabel')}</label>
              <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder={t('broadcast.youtubeUrl')} style={input} />
              {youtubeUrl && !YOUTUBE_URL_RE.test(youtubeUrl.trim()) && (
                <div style={{ fontSize: 10, color: '#e04050', marginTop: 3 }}>⚠️ {t('broadcast.youtubeInvalid')}</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPreview(p => !p)}
                style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500 }}
              >
                {preview ? '✕ Vorschau aus' : '👁 Vorschau'}
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !title.trim() || !body.trim()}
                style={{
                  flex: 1, padding: '9px 18px', borderRadius: 9, border: 'none',
                  background: sending || !title.trim() || !body.trim() ? 'var(--bg-tertiary)' : 'var(--accent)',
                  color: sending || !title.trim() || !body.trim() ? 'var(--text-muted)' : '#0F1117',
                  cursor: sending || !title.trim() || !body.trim() ? 'default' : 'pointer',
                  fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-body)',
                  transition: 'all 0.15s',
                }}
              >
                {sending
                  ? (uploadingTrailer ? `⏳ ${t('broadcast.trailerUploading')}` : '⏳ Wird gesendet…')
                  : `📨 An ${estimated} User senden`}
              </button>
            </div>
          </div>

          {/* Preview — BROADCAST-PREVIEW-001 (2026-09-12): exakte 1:1-Replik der
              be-hui-Feed-Karte (BaseFeedCard/HumanHeader/MomentContent/FeedActions).
              Spiegel-Quellen: T-Tokens + HumanHeader + FeedActions in
              BaseFeedCard.jsx, MomentContent isBroadcast-Zweig, Migration 136
              (Trigger-SQL: Titel -> caption, body [+ YT-Suffix] -> content,
              trailer_url -> type='video'). */}
          {preview && (title || body) && (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>👁 Vorschau — exakt der Feed-Post, den die Nutzer bekommen</div>

              {/* ── Feed-Karte (Spiegel: bgCard #FFFFFF, radius 16, border rgba(26,26,46,0.07), Schatten) ── */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid rgba(26,26,46,0.07)', boxShadow: '0 2px 20px rgba(26,26,46,0.08)', overflow: 'hidden' }}>

                {/* Header (Spiegel: HumanHeader — Avatar 52px, Name 16/600, Bot-Badge, Zeit) */}
                <div style={{ padding: '12px 16px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                    <img src={MYHUI_AVATAR_URL} alt="myHUI" style={{ width: 52, height: 52, borderRadius: 99, objectFit: 'cover', flexShrink: 0, background: '#F0EFED' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: '#1A1A2E', letterSpacing: -0.3, lineHeight: 1.25 }}>myHUI</span>
                      <span style={{ display: 'inline-flex', marginTop: 3, fontSize: 10.5, fontWeight: 600, color: '#0DC4B5', background: 'rgba(13,196,181,0.10)', border: '1px solid rgba(13,196,181,0.22)', borderRadius: 99, padding: '2px 8px', letterSpacing: 0.2 }}>Bot</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#808098', whiteSpace: 'nowrap', paddingTop: 2 }}>Gerade eben</span>
                  </div>
                  {/* SYSTEMNACHRICHT-Label (Spiegel: HumanHeader isBroadcast-Zweig, Coral #F47355) */}
                  <div style={{ marginTop: 9, marginBottom: 10 }}>
                    <span style={{ display: 'inline-block', fontSize: 12.5, fontWeight: 800, color: '#F47355', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Systemnachricht</span>
                  </div>
                </div>

                {/* Titel + Text (Spiegel: unifiedNormalizer caption+'\n\n'+content, MomentContent pre-line, URLs teal) */}
                <div style={{ padding: '0 16px 4px' }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#1A1A2E', lineHeight: 1.4, letterSpacing: '-0.02em', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                    <PreviewLinkified text={[title, youtubeUrl.trim() ? `${body}\n\n🎬 Ganzer Film: ${youtubeUrl.trim()}` : body].filter(Boolean).join('\n\n')} />
                  </span>
                </div>

                {/* Trailer-Video (Spiegel: FeedMedia — AdaptiveVideoBox, dieselbe
                    SSOT-Formel wie im echten Feed: Hoehe = Breite/Aspect, object-
                    contain auf #000, KEINE Balken, KEIN Crop. VIDEO-BREITEN-FIX. */}
                {trailerPreviewUrl && (
                  <div style={{ margin: '10px 16px 0' }}>
                    <AdaptiveVideoBox src={trailerPreviewUrl} muted />
                  </div>
                )}

                {/* Aktionsleiste (Spiegel: FeedActions — borderTop rgba(26,26,46,0.045),
                    zentrierte 5er-Gruppe Resonanz/Austauschen/Weitergeben/Merken/Melden,
                    Counts erst im echten Post sichtbar (ab 0), hier bewusst ohne Zahlen) */}
                <div style={{ borderTop: '1px solid rgba(26,26,46,0.045)', background: '#FFFFFF', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px 12px 3px', gap: 10 }}>
                    <span title="Resonanz" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 31, color: '#F47355' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    </span>
                    <span title="Austauschen" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 31, color: '#0DC4B5' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                    </span>
                    <span title="Weitergeben" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 31, color: '#0DC4B5' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                    </span>
                    <span title="Melden" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 31, color: '#C47A65' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </span>
                  </div>
                </div>
              </div>

              {/* Zielgruppen-Info unterhalb der Karte */}
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                📨 Geht an ~{estimated} User ({targetInfo?.label}) · erscheint im Feed als myHUI-Systemnachricht{trailerFile ? ' + Trailer-Video' : ''}{youtubeUrl.trim() ? ' + YouTube-Link' : ''}
              </div>
            </div>
          )}
        </div>

        {/* ── History ── */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            📋 Verlauf
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 500 }}>
            {loading ? (
              <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>Lade…</div>
            ) : history.length === 0 ? (
              <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                Noch keine Broadcasts gesendet
              </div>
            ) : history.map(b => (
              <div key={b.id} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.body}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 600 }}>
                        {TARGET_GROUPS.find(g => g.key === b.target_group)?.label || b.target_group}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                        {b.sent_count} Empfänger · {timeAgo(b.created_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(b.id, b.title)}
                    disabled={deleting === b.id}
                    title="Broadcast löschen"
                    style={{
                      flexShrink: 0,
                      width: 28, height: 28,
                      background: 'transparent',
                      border: '1px solid transparent',
                      borderRadius: 7,
                      cursor: deleting === b.id ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                      opacity: deleting === b.id ? 0.5 : 1,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--red)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.3)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                    }}
                  >
                    {deleting === b.id ? '…' : '🗑️'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
