// frontend/src/app/works/page.tsx
'use client';

import { useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { showToast } from '@/components/ui/Toast';
import { useWorks, HuiWork } from '@/lib/hooks/useSupabase';

// ── Helpers ───────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Heute';
  if (days < 30)  return `Vor ${days}d`;
  return new Date(iso).toLocaleDateString('de-DE');
}

function fmt(n: number | null | undefined) {
  return (n ?? 0).toLocaleString('de-DE');
}

// ── Sensitive-Content Detector ────────────────────────────────────────────
const SENSITIVE_KEYWORDS = [
  'nackt','nude','sex','porn','erotik','18+','adult','xxx','escort',
  'waffe','weapon','gun','messer','knife','droge','drug','kokain','heroin',
  'cannabis','geld waschen','money launder','hack','betrug','fraud',
  'fake','gefälscht','illegal','verboten','stolen','gestohlen',
];
const HIGH_PRICE_THRESHOLD = 5000; // €

function detectSensitive(w: HuiWork & Record<string, unknown>): { flagged: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const text = [
    w.title || '', w.description || '', w.caption || '',
    (w.tags as string[] || []).join(' '),
    w.category || '',
  ].join(' ').toLowerCase();

  const hit = SENSITIVE_KEYWORDS.find((kw) => text.includes(kw));
  if (hit) reasons.push(`🚨 Keyword erkannt: "${hit}"`);

  const price = (w.price as number) || 0;
  if (price > HIGH_PRICE_THRESHOLD) reasons.push(`💰 Ungewöhnlich hoher Preis: €${price.toLocaleString('de-DE')}`);

  if (!w.title || String(w.title).trim().length < 2) reasons.push('⚠️ Fehlender oder sehr kurzer Titel');

  const imgs: string[] = Array.isArray(w.images)
    ? w.images.map((i: unknown) => { try { return typeof i === 'string' && i.startsWith('{') ? JSON.parse(i).url : String(i); } catch { return String(i); } }).filter(Boolean)
    : [];
  if (imgs.length === 0 && !w.cover_url) reasons.push('📷 Kein Bild / Media vorhanden');

  return { flagged: reasons.length > 0, reasons };
}

// ── Image parser ──────────────────────────────────────────────────────────
function parseImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => {
    try {
      if (typeof i === 'string' && i.startsWith('{')) return JSON.parse(i).url || '';
      if (typeof i === 'object' && i !== null) return (i as Record<string, string>).url || '';
      return String(i);
    } catch { return ''; }
  }).filter(Boolean);
}

// ── Status Badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === 'published') return <Badge variant="success" dot>Published</Badge>;
  if (status === 'draft')     return <Badge variant="neutral" dot>Draft</Badge>;
  if (status === 'flagged')   return <Badge variant="danger"  dot>⚑ Gemeldet</Badge>;
  if (status === 'deleted')   return <Badge variant="neutral">Gelöscht</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

// ── Admin API call ────────────────────────────────────────────────────────
async function workAction(action: string, workId: string, data: Record<string, unknown> = {}): Promise<boolean> {
  try {
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: workId, data }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); console.error(action, e); return false; }
    return true;
  } catch (e) { console.error(e); return false; }
}

// ── Skeleton ──────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <tr>
      {[...Array(8)].map((_, i) => (
        <td key={i} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ height: 11, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 2s ease-in-out infinite', width: i===0 ? '70%':'50%' }} />
        </td>
      ))}
    </tr>
  );
}

// ── Edit Form ─────────────────────────────────────────────────────────────
interface EditForm {
  title: string; description: string; caption: string; category: string;
  tags: string; price: string; status: string; visibility: string;
  allow_comments: boolean; allow_likes: boolean; allow_shares: boolean;
  for_sale: boolean; is_showcase_only: boolean; location_text: string;
}

function buildForm(w: HuiWork & Record<string, unknown>): EditForm {
  return {
    title:            String(w.title || ''),
    description:      String(w.description || ''),
    caption:          String(w.caption || ''),
    category:         String(w.category || ''),
    tags:             ((w.tags as string[]) || []).join(', '),
    price:            String(w.price || 0),
    status:           String(w.status || 'draft'),
    visibility:       String(w.visibility || 'public'),
    allow_comments:   w.allow_comments !== false,
    allow_likes:      w.allow_likes !== false,
    allow_shares:     w.allow_shares !== false,
    for_sale:         Boolean(w.for_sale),
    is_showcase_only: Boolean(w.is_showcase_only),
    location_text:    String(w.location_text || ''),
  };
}

// ────────────────────────────────────────────────────────────────────────────
export default function WorksPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [flaggedOnly, setFlaggedOnly]   = useState(false);
  const [selected, setSelected]         = useState<(HuiWork & Record<string, unknown>) | null>(null);
  const [editMode, setEditMode]         = useState(false);
  const [form, setForm]                 = useState<EditForm | null>(null);
  const [saving, setSaving]             = useState(false);
  const [busy, setBusy]                 = useState<Record<string, boolean>>({});
  const [confirm, setConfirm]           = useState<{ open:boolean; title:string; message:string; onConfirm:()=>void; loading:boolean }>({
    open:false, title:'', message:'', onConfirm:()=>{}, loading:false
  });

  const { works, total, loading, refetch } = useWorks({ status: statusFilter, limit: 200, refreshInterval: 30000 });

  // Annotate works with sensitive flag
  const annotated = useMemo(() => works.map((w) => ({
    ...w,
    _sensitive: detectSensitive(w as HuiWork & Record<string, unknown>),
  })), [works]);

  const filtered = useMemo(() => {
    let res = annotated;
    if (search) {
      const q = search.toLowerCase();
      res = res.filter((w) =>
        (w.title || '').toLowerCase().includes(q) ||
        (w.category || '').toLowerCase().includes(q) ||
        (w.description || '').toLowerCase().includes(q)
      );
    }
    if (flaggedOnly) res = res.filter((w) => w._sensitive.flagged);
    return res;
  }, [annotated, search, flaggedOnly]);

  const flaggedCount = useMemo(() => annotated.filter((w) => w._sensitive.flagged).length, [annotated]);

  const setBusyFor = (id: string, v: boolean) => setBusy((p) => ({ ...p, [id]: v }));

  // ── Open Detail ──────────────────────────────────────────────────────────
  const openDetail = useCallback((w: HuiWork & Record<string, unknown>) => {
    setSelected(w);
    setForm(buildForm(w));
    setEditMode(false);
  }, []);

  // ── Save Edit ────────────────────────────────────────────────────────────
  const handleSaveEdit = useCallback(async () => {
    if (!selected || !form) return;
    setSaving(true);
    const ok = await workAction('update_work', selected.id, {
      ...form,
      price: parseFloat(form.price) || 0,
      price_eur: parseFloat(form.price) || 0,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setSaving(false);
    if (ok) {
      showToast('✅ Work gespeichert', 'success');
      refetch();
      setEditMode(false);
      // Optimistic: refetch will update the list
    } else {
      showToast('Speichern fehlgeschlagen', 'error');
    }
  }, [selected, form, refetch]);

  // ── Unpublish ────────────────────────────────────────────────────────────
  const handleUnpublish = useCallback((w: HuiWork & Record<string, unknown>) => {
    setConfirm({
      open: true, loading: false,
      title: '📤 Work depublizieren',
      message: `„${w.title || 'Kein Titel'}" wird auf Draft gesetzt und versteckt.`,
      onConfirm: async () => {
        setConfirm((p) => ({ ...p, loading: true }));
        const ok = await workAction('unpublish_work', w.id);
        setConfirm((p) => ({ ...p, loading: false, open: false }));
        if (ok) { showToast('Work depubliziert', 'info'); refetch(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetch]);

  // ── Flag ─────────────────────────────────────────────────────────────────
  const handleFlag = useCallback(async (w: HuiWork & Record<string, unknown>) => {
    setBusyFor(w.id, true);
    const ok = await workAction('flag_work', w.id, { status: 'flagged' });
    setBusyFor(w.id, false);
    if (ok) { showToast('⚑ Work gemeldet und versteckt', 'info'); refetch(); }
    else showToast('Fehler', 'error');
  }, [refetch]);

  // ── Approve ──────────────────────────────────────────────────────────────
  const handleApprove = useCallback(async (w: HuiWork & Record<string, unknown>) => {
    setBusyFor(w.id, true);
    const ok = await workAction('approve_work', w.id);
    setBusyFor(w.id, false);
    if (ok) { showToast('✅ Work freigegeben', 'success'); refetch(); }
    else showToast('Fehler', 'error');
  }, [refetch]);

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = useCallback((w: HuiWork & Record<string, unknown>) => {
    setConfirm({
      open: true, loading: false,
      title: '🗑 Work löschen',
      message: `„${w.title || 'Kein Titel'}" wird dauerhaft als gelöscht markiert.`,
      onConfirm: async () => {
        setConfirm((p) => ({ ...p, loading: true }));
        const ok = await workAction('delete_work', w.id);
        setConfirm((p) => ({ ...p, loading: false, open: false }));
        if (ok) { showToast('Work gelöscht', 'info'); refetch(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetch]);

  // ── Styles ───────────────────────────────────────────────────────────────
  const filterBtn = (active: boolean, danger?: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer',
    border: `1px solid ${active ? (danger ? 'var(--red)' : 'var(--accent)') : 'var(--border)'}`,
    background: active ? (danger ? 'var(--red-dim)' : 'var(--accent-dim)') : 'transparent',
    color: active ? (danger ? 'var(--red)' : 'var(--accent)') : 'var(--text-secondary)',
    fontFamily: 'var(--font-body)', transition: 'all 0.15s',
  });

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)', borderRadius: 7, fontSize: 12,
    color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none',
  };

  const kpiCard = (label: string, value: string | number, color: string) => (
    <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 3 }}>{label}</div>
    </div>
  );

  return (
    <DashboardLayout
      title="Works & Content"
      headerActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {flaggedCount > 0 && (
            <span style={{ fontSize: 11, background: 'var(--red-dim)', color: 'var(--red)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--red)', fontWeight: 600 }}>
              ⚠️ {flaggedCount} sensitiv
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--green)', background: 'rgba(81,207,102,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(81,207,102,0.2)' }}>● Live</span>
          <button onClick={refetch} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻</button>
        </div>
      }
    >
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }} className="grid-4">
        {kpiCard('Works gesamt',  loading ? '…' : fmt(total),                                         'var(--accent)')}
        {kpiCard('Published',     loading ? '…' : fmt(works.filter(w=>w.status==='published').length), 'var(--green)')}
        {kpiCard('Draft',         loading ? '…' : fmt(works.filter(w=>w.status==='draft').length),     'var(--gold)')}
        {kpiCard('Gemeldet ⚠️',   loading ? '…' : fmt(flaggedCount),                                  'var(--red)')}
        {kpiCard('Likes gesamt',  loading ? '…' : fmt(works.reduce((s,w)=>s+(w.likes_count||0),0)),   'var(--purple)')}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12 }}>🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Titel, Kategorie, Beschreibung…"
            style={{ ...fieldStyle, paddingLeft: 30, boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {['all','published','draft','flagged','deleted'].map((s) => (
            <button key={s} style={filterBtn(statusFilter===s)} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'Alle' : s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
          <button style={filterBtn(flaggedOnly, true)} onClick={() => setFlaggedOnly(!flaggedOnly)}>
            ⚠️ Nur Sensitiv {flaggedCount > 0 ? `(${flaggedCount})` : ''}
          </button>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{loading ? '…' : `${filtered.length} / ${total}`}</span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['', 'Titel', 'Kategorie', 'Status', 'Preis', 'Engagement', 'Erstellt', 'Aktionen'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.7px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><Skeleton/><Skeleton/><Skeleton/><Skeleton/><Skeleton/></>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Keine Works gefunden</td></tr>
              ) : filtered.map((w) => {
                const imgs = parseImages(w.images);
                const cover = w.cover_url as string || imgs[0] || '';
                const isBusy = busy[w.id];
                const isDeleted = w.status === 'deleted';
                const price = (w.price as number) || 0;

                return (
                  <tr key={w.id} className="tr-hover"
                    style={{ opacity: isDeleted ? 0.4 : 1, background: w._sensitive.flagged ? 'rgba(255,107,107,0.03)' : undefined }}
                    onClick={() => openDetail(w as HuiWork & Record<string, unknown>)}>
                    {/* Thumbnail */}
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', width: 44 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-tertiary)', flexShrink: 0 }}>
                        {cover
                          ? <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display='none'; }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎨</div>
                        }
                      </div>
                    </td>
                    {/* Title */}
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', maxWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {w._sensitive.flagged && <span title={w._sensitive.reasons.join('\n')} style={{ color: 'var(--red)', fontSize: 13, cursor: 'help' }}>⚠️</span>}
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                            {w.title || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>{String(w.id).slice(0,8)}…</div>
                        </div>
                      </div>
                    </td>
                    {/* Category */}
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {w.category || '—'}
                    </td>
                    {/* Status */}
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                      <StatusBadge status={String(w.status || 'draft')} />
                    </td>
                    {/* Price */}
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 11, color: price > HIGH_PRICE_THRESHOLD ? 'var(--red)' : price > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                      {price > 0 ? `€${price.toLocaleString('de-DE')}` : '—'}
                    </td>
                    {/* Engagement */}
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <span title="Likes">❤ {w.likes_count||0}</span>
                      <span style={{ marginLeft: 8 }} title="Views">👁 {w.views_count||0}</span>
                      <span style={{ marginLeft: 8 }} title="Kommentare">💬 {w.comments_count||0}</span>
                    </td>
                    {/* Created */}
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {timeAgo(String(w.created_at || ''))}
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button title="Details" onClick={() => openDetail(w as HuiWork & Record<string, unknown>)}
                          style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--accent)', cursor:'pointer', fontSize:12 }}>👁</button>
                        {w.status === 'flagged' || w.status === 'draft' ? (
                          <button title="Freigeben" disabled={isBusy} onClick={() => handleApprove(w as HuiWork & Record<string, unknown>)}
                            style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--green)', background:'var(--green-dim)', color:'var(--green)', cursor:'pointer', fontSize:12 }}>✓</button>
                        ) : (
                          <button title="Melden / Sperren" disabled={isBusy || isDeleted} onClick={() => handleFlag(w as HuiWork & Record<string, unknown>)}
                            style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--gold)', background:'var(--gold-dim)', color:'var(--gold)', cursor:'pointer', fontSize:12 }}>⚑</button>
                        )}
                        {w.status === 'published' && (
                          <button title="Depublizieren" disabled={isBusy} onClick={() => handleUnpublish(w as HuiWork & Record<string, unknown>)}
                            style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--text-secondary)', cursor:'pointer', fontSize:12 }}>📤</button>
                        )}
                        {!isDeleted && (
                          <button title="Löschen" disabled={isBusy} onClick={() => handleDelete(w as HuiWork & Record<string, unknown>)}
                            style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--red)', background:'var(--red-dim)', color:'var(--red)', cursor:'pointer', fontSize:12 }}>🗑</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail / Edit Modal ─────────────────────────────────────────────── */}
      {selected && (
        <Modal
          open
          onClose={() => { setSelected(null); setEditMode(false); }}
          title={editMode ? `✏️ Bearbeiten: ${selected.title || 'Kein Titel'}` : `📄 Work Details`}
          width={680}
          footer={
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={() => { setSelected(null); setEditMode(false); }}>Schließen</Button>
              {!editMode ? (
                <>
                  <Button variant="primary" onClick={() => setEditMode(true)}>✏️ Bearbeiten</Button>
                  {selected.status === 'published' && <Button variant="ghost" onClick={() => handleUnpublish(selected)}>📤 Depublizieren</Button>}
                  {(selected.status === 'flagged' || selected.status === 'draft') && <Button variant="primary" onClick={() => handleApprove(selected)}>✅ Freigeben</Button>}
                  {selected.status !== 'flagged' && <Button variant="danger" onClick={() => handleFlag(selected)}>⚑ Melden</Button>}
                  <Button variant="danger" onClick={() => handleDelete(selected)}>🗑 Löschen</Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setEditMode(false)}>Abbrechen</Button>
                  <Button variant="primary" onClick={handleSaveEdit} disabled={saving}>{saving ? '…' : '💾 Speichern'}</Button>
                </>
              )}
            </div>
          }
        >
          {/* Sensitive alert */}
          {selected._sensitive?.flagged && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>⚠️ Sensitiver Inhalt erkannt</div>
              {(selected._sensitive.reasons as string[]).map((r, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>{r}</div>
              ))}
            </div>
          )}

          {/* Media preview */}
          {(() => {
            const imgs = parseImages(selected.images as unknown);
            const cover = selected.cover_url as string || imgs[0];
            const allImgs = cover ? [cover, ...imgs.filter(u => u !== cover)] : imgs;
            return allImgs.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
                {allImgs.slice(0,6).map((url, i) => (
                  <div key={i} style={{ flexShrink: 0, width: i===0 ? 180 : 80, height: i===0 ? 120 : 80, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-tertiary)', border: i===0 ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
                    <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}
                      onError={(e) => { e.currentTarget.style.display='none'; }} />
                  </div>
                ))}
                {allImgs.length > 6 && (
                  <div style={{ flexShrink:0, width:80, height:80, borderRadius:8, background:'var(--bg-tertiary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, color:'var(--text-muted)', border:'1px solid var(--border)' }}>
                    +{allImgs.length-6}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ height: 80, background: 'var(--bg-tertiary)', borderRadius: 8, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:12, marginBottom:14, border:'1px solid var(--border)' }}>
                📷 Kein Bild
              </div>
            );
          })()}

          {!editMode ? (
            /* ── READ VIEW ── */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['ID',             String(selected.id)],
                ['Titel',          String(selected.title || '—')],
                ['Status',         String(selected.status || '—')],
                ['Sichtbarkeit',   String(selected.visibility || '—')],
                ['Kategorie',      String(selected.category || '—')],
                ['Post-Typ',       String(selected.post_type || '—')],
                ['Preis',          `€${(selected.price as number || 0).toLocaleString('de-DE')}`],
                ['Zum Verkauf',    Boolean(selected.for_sale) ? 'Ja' : 'Nein'],
                ['Lagerbestand',   String(selected.stock_quantity ?? '—')],
                ['Digitale Datei', Boolean(selected.is_digital) ? 'Ja' : 'Nein'],
                ['Kommentare',     Boolean(selected.allow_comments) ? '✅ erlaubt' : '🚫 gesperrt'],
                ['Likes',          Boolean(selected.allow_likes) ? '✅ erlaubt' : '🚫 gesperrt'],
                ['Shares',         Boolean(selected.allow_shares) ? '✅ erlaubt' : '🚫 gesperrt'],
                ['Standort',       String(selected.location_text || '—')],
                ['Sprache',        String(selected.language || '—')],
                ['Views',          String(selected.views_count || 0)],
                ['Likes count',    String(selected.likes_count || 0)],
                ['Kommentare #',   String(selected.comments_count || 0)],
                ['Erstellt',       timeAgo(String(selected.created_at || ''))],
                ['User-ID',        String(selected.user_id || '—').slice(0,16)+'…'],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: '7px 10px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing:'0.5px', marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, wordBreak:'break-all' }}>{v}</div>
                </div>
              ))}
              {selected.description && (
                <div style={{ gridColumn: '1/-1', padding: '7px 10px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Beschreibung</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{String(selected.description)}</div>
                </div>
              )}
              {selected.caption && (
                <div style={{ gridColumn: '1/-1', padding: '7px 10px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Caption</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{String(selected.caption)}</div>
                </div>
              )}
              {Array.isArray(selected.tags) && (selected.tags as string[]).length > 0 && (
                <div style={{ gridColumn: '1/-1', padding: '7px 10px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Tags</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {(selected.tags as string[]).map((t) => (
                      <span key={t} style={{ padding:'2px 8px', borderRadius:20, background:'var(--accent-dim)', color:'var(--accent)', fontSize:11 }}>#{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : form ? (
            /* ── EDIT VIEW ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display:'block', marginBottom:4 }}>Titel</label>
                  <input style={fieldStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display:'block', marginBottom:4 }}>Kategorie</label>
                  <select style={fieldStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {['Sonstiges','Musik','Design','Digitale Kunst','Fotografie','Video','Dienstleistung','Handwerk','Mode','Essen & Trinken'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display:'block', marginBottom:4 }}>Status</label>
                  <select style={fieldStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="flagged">Gemeldet</option>
                    <option value="deleted">Gelöscht</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display:'block', marginBottom:4 }}>Sichtbarkeit</label>
                  <select style={fieldStyle} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="unlisted">Unlisted</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display:'block', marginBottom:4 }}>Preis (€)</label>
                  <input style={fieldStyle} type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display:'block', marginBottom:4 }}>Standort</label>
                  <input style={fieldStyle} value={form.location_text} onChange={(e) => setForm({ ...form, location_text: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display:'block', marginBottom:4 }}>Beschreibung</label>
                <textarea style={{ ...fieldStyle, height: 70, resize: 'vertical' }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display:'block', marginBottom:4 }}>Caption</label>
                <textarea style={{ ...fieldStyle, height: 50, resize: 'vertical' }} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display:'block', marginBottom:4 }}>Tags (kommagetrennt)</label>
                <input style={fieldStyle} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tag1, tag2, tag3" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {([['allow_comments','Kommentare erlaubt'],['allow_likes','Likes erlaubt'],['allow_shares','Shares erlaubt'],['for_sale','Zum Verkauf'],['is_showcase_only','Nur Showcase']] as [keyof EditForm, string][]).map(([k, lbl]) => (
                  <label key={k} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)', cursor:'pointer', padding:'6px 8px', background:'var(--bg-tertiary)', borderRadius:6 }}>
                    <input type="checkbox" checked={Boolean(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </Modal>
      )}

      <ConfirmModal
        open={confirm.open}
        onClose={() => setConfirm((p) => ({ ...p, open: false }))}
        onConfirm={confirm.onConfirm}
        title={confirm.title}
        message={confirm.message}
        loading={confirm.loading}
        confirmLabel="Bestätigen"
        confirmVariant="danger"
      />
    </DashboardLayout>
  );
}
