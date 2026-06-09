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
// api imports handled via useWorks hook

// ── Types ─────────────────────────────────────────────────────────────────
type WorkWithMeta = HuiWork & Record<string, unknown> & {
  _sensitive: { flagged: boolean; reasons: string[] };
};

type TabKey = 'all' | 'published' | 'pending' | 'rejected' | 'draft' | 'flagged' | 'deleted' | 'sensitive';

interface EditForm {
  title: string; description: string; caption: string; category: string;
  tags: string; price: string; status: string; visibility: string;
  allow_comments: boolean; allow_likes: boolean; allow_shares: boolean;
  for_sale: boolean; is_showcase_only: boolean; location_text: string;
}

// ── Sensitive detector ────────────────────────────────────────────────────
const SENSITIVE_KEYWORDS = [
  'nackt','nude','sex','porn','erotik','18+','adult','xxx','escort',
  'waffe','weapon','gun','messer','knife','droge','drug','kokain','heroin',
  'cannabis','geld waschen','money launder','hack','betrug','fraud',
  'fake','gefälscht','illegal','verboten','stolen','gestohlen',
];
const HIGH_PRICE_THRESHOLD = 5000;

function detectSensitive(w: WorkWithMeta): { flagged: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const text = [w.title||'', w.description||'', w.caption||'', ((w.tags as string[])||[]).join(' '), w.category||''].join(' ').toLowerCase();
  const hit = SENSITIVE_KEYWORDS.find((kw) => text.includes(kw));
  if (hit) reasons.push(`🚨 Keyword: "${hit}"`);
  const price = (w.price as number) || 0;
  if (price > HIGH_PRICE_THRESHOLD) reasons.push(`💰 Hoher Preis: €${price.toLocaleString('de-DE')}`);
  if (!w.title || String(w.title).trim().length < 2) reasons.push('⚠️ Fehlender Titel');
  const imgs = parseImages(w.images as unknown);
  if (imgs.length === 0 && !w.cover_url) reasons.push('📷 Kein Bild');
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

// ── Helpers ───────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Heute';
  if (days < 30) return `Vor ${days}d`;
  return new Date(iso).toLocaleDateString('de-DE');
}
function fmt(n: number | null | undefined) { return (n ?? 0).toLocaleString('de-DE'); }

function buildForm(w: WorkWithMeta): EditForm {
  return {
    title: String(w.title||''), description: String(w.description||''),
    caption: String(w.caption||''), category: String(w.category||''),
    tags: ((w.tags as string[])||[]).join(', '), price: String(w.price||0),
    status: String(w.status||'draft'), visibility: String(w.visibility||'public'),
    allow_comments: w.allow_comments !== false, allow_likes: w.allow_likes !== false,
    allow_shares: w.allow_shares !== false, for_sale: Boolean(w.for_sale),
    is_showcase_only: Boolean(w.is_showcase_only), location_text: String(w.location_text||''),
  };
}

// ── API call ──────────────────────────────────────────────────────────────
async function workAction(action: string, workId: string, data: Record<string, unknown> = {}): Promise<boolean> {
  try {
    const res = await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: workId, data }),
    });
    return res.ok;
  } catch { return false; }
}

// ── Components ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === 'published')      return <Badge variant="success" dot>Published</Badge>;
  if (status === 'pending_review') return <Badge variant="warning" dot>⏳ Pending</Badge>;
  if (status === 'rejected')       return <Badge variant="danger"  dot>❌ Abgelehnt</Badge>;
  if (status === 'draft')          return <Badge variant="neutral" dot>Draft</Badge>;
  if (status === 'flagged')        return <Badge variant="danger"  dot>⚑ Gemeldet</Badge>;
  if (status === 'deleted')        return <Badge variant="neutral">🗑 Gelöscht</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

function Skeleton() {
  return (
    <tr>
      {[...Array(8)].map((_, i) => (
        <td key={i} style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ height:11, background:'var(--bg-tertiary)', borderRadius:4, animation:'pulse 2s ease-in-out infinite', width: i===0?'70%':'50%' }}/>
        </td>
      ))}
    </tr>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────
function TabBar({ tab, setTab, counts }: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  counts: Record<TabKey, number>;
}) {
  const tabs: { key: TabKey; label: string; icon: string; danger?: boolean }[] = [
    { key: 'all',       label: 'Alle',           icon: '' },
    { key: 'pending',   label: 'Eingereicht',     icon: '⏳', danger: false },
    { key: 'published', label: 'Published',       icon: '●' },
    { key: 'rejected',  label: 'Abgelehnt',       icon: '✕', danger: true },
    { key: 'draft',     label: 'Draft',           icon: '' },
    { key: 'flagged',   label: 'Gemeldet',        icon: '⚑', danger: true },
    { key: 'deleted',   label: 'Gelöscht',        icon: '🗑' },
    { key: 'sensitive', label: 'Sensitiv',        icon: '⚠️', danger: true },
  ];
  return (
    <div style={{ display:'flex', gap:4, marginBottom:14, borderBottom:'1px solid var(--border)', paddingBottom:10, flexWrap:'wrap' }}>
      {tabs.map(({ key, label, icon, danger }) => {
        const active = tab === key;
        const cnt = counts[key];
        return (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 400,
              border: `1px solid ${active ? (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)') : 'var(--border)'}`,
              background: active ? (key === 'pending' ? 'rgba(245,158,11,0.12)' : danger ? 'var(--red-dim)' : 'var(--accent-dim)') : 'var(--bg-secondary)',
              color: active ? (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)') : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {icon && <span style={{ fontSize: 10 }}>{icon}</span>}
            {label}
            {cnt > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9, fontSize: 10, fontWeight: 700,
                background: active ? (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)') : (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--bg-tertiary)'),
                color: active ? '#fff' : (key === 'pending' || danger ? '#fff' : 'var(--text-secondary)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
              }}>{cnt}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function WorksPage() {
  const [tab, setTab]               = useState<TabKey>('all');
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState<WorkWithMeta | null>(null);
  const [editMode, setEditMode]     = useState(false);
  const [form, setForm]             = useState<EditForm | null>(null);
  const [saving, setSaving]         = useState(false);
  const [busy, setBusy]             = useState<Record<string, boolean>>({});
  const [confirm, setConfirm]       = useState<{ open:boolean; title:string; message:string; onConfirm:()=>void; loading:boolean }>({
    open:false, title:'', message:'', onConfirm:()=>{}, loading:false
  });

  // Load all status groups via useWorks (uses service role key → bypasses RLS)
  const { works: allWorks,     loading,        refetch: refetchAll  } = useWorks({ status: 'all',     limit: 500, refreshInterval: 30000 });
  const { works: deletedWorks, refetch: refetchDeleted } = useWorks({ status: 'deleted', limit: 500, refreshInterval: 30000 });
  const { works: flaggedWorks,  refetch: refetchFlagged  } = useWorks({ status: 'flagged',         limit: 500, refreshInterval: 30000 });
  const { works: pendingWorks,  refetch: refetchPending  } = useWorks({ status: 'pending_review', limit: 500, refreshInterval: 15000 });
  const { works: rejectedWorks, refetch: refetchRejected } = useWorks({ status: 'rejected',        limit: 500, refreshInterval: 30000 });

  const refetchAllTabs = useCallback(() => {
    refetchAll();
    refetchDeleted();
    refetchFlagged();
    refetchPending();
    refetchRejected();
  }, [refetchAll, refetchDeleted, refetchFlagged, refetchPending, refetchRejected]);

  // Annotate all works with sensitive flag
  const annotate = (list: HuiWork[]): WorkWithMeta[] =>
    list.map((w) => ({ ...w, _sensitive: detectSensitive({ ...w, _sensitive: { flagged: false, reasons: [] } } as WorkWithMeta) }));

  const annotatedAll      = useMemo(() => annotate(allWorks),     [allWorks]);
  const annotatedDeleted  = useMemo(() => annotate(deletedWorks), [deletedWorks]);
  const annotatedFlagged  = useMemo(() => annotate(flaggedWorks), [flaggedWorks]);
  const annotatedPending  = useMemo(() => annotate(pendingWorks), [pendingWorks]);
  const annotatedRejected = useMemo(() => annotate(rejectedWorks),[rejectedWorks]);

  // Tab counts
    const counts: Record<TabKey, number> = useMemo(() => ({
    all:       annotatedAll.filter(w => !(['deleted','flagged','pending_review','rejected'] as string[]).includes(w.status as string)).length,
    published: annotatedAll.filter(w => w.status === 'published').length,
    pending:   annotatedPending.length,
    rejected:  annotatedRejected.length,
    draft:     annotatedAll.filter(w => w.status === 'draft').length,
    flagged:   annotatedFlagged.length,
    deleted:   annotatedDeleted.length,
    sensitive: annotatedAll.filter(w => w._sensitive.flagged && w.status !== 'deleted').length,
  }), [annotatedAll, annotatedFlagged, annotatedDeleted, annotatedPending, annotatedRejected]);

  // Active list based on tab
  const activeList = useMemo(() => {
    let base: WorkWithMeta[] = [];
    if (tab === 'deleted')   base = annotatedDeleted;
    else if (tab === 'flagged')   base = annotatedFlagged;
    else if (tab === 'sensitive') base = annotatedAll.filter(w => w._sensitive.flagged && w.status !== 'deleted');
    else if (tab === 'published') base = annotatedAll.filter(w => w.status === 'published');
    else if (tab === 'draft')     base = annotatedAll.filter(w => w.status === 'draft');
    else if ((tab as string) === 'pending')   base = annotatedPending;
    else if ((tab as string) === 'rejected')  base = annotatedRejected;
    else base = annotatedAll.filter(w => !(['deleted','flagged','pending_review','rejected'] as string[]).includes(w.status as string)); // 'all'

    if (search) {
      const q = search.toLowerCase();
      base = base.filter(w =>
        (w.title||'').toLowerCase().includes(q) ||
        (w.category||'').toLowerCase().includes(q) ||
        (w.description||'').toLowerCase().includes(q)
      );
    }
    return base;
  }, [tab, annotatedAll, annotatedDeleted, annotatedFlagged, search]);

  const setBusyFor = (id: string, v: boolean) => setBusy(p => ({ ...p, [id]: v }));

  const openDetail = (w: WorkWithMeta) => { setSelected(w); setForm(buildForm(w)); setEditMode(false); };

  // ── Save Edit ──────────────────────────────────────────────────────────
  const handleSaveEdit = useCallback(async () => {
    if (!selected || !form) return;
    setSaving(true);
    const ok = await workAction('update_work', selected.id, {
      ...form,
      price: parseFloat(form.price)||0,
      price_eur: parseFloat(form.price)||0,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setSaving(false);
    if (ok) { showToast('✅ Work gespeichert', 'success'); refetchAllTabs(); setEditMode(false); }
    else showToast('Speichern fehlgeschlagen', 'error');
  }, [selected, form, refetchAllTabs]);

  // ── Restore (deleted → draft) ──────────────────────────────────────────
  const handleRestore = useCallback((w: WorkWithMeta) => {
    setConfirm({
      open:true, loading:false,
      title: '♻️ Werk wiederherstellen',
      message: `„${w.title||'Kein Titel'}" wird wiederhergestellt und sofort als "Published" in der App sichtbar.`,
      onConfirm: async () => {
        setConfirm(p => ({ ...p, loading:true }));
        const ok = await workAction('restore_work', w.id);
        setConfirm(p => ({ ...p, loading:false, open:false }));
        if (ok) { showToast('✅ Werk wiederhergestellt', 'success'); refetchAllTabs(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetchAllTabs]);

  // ── Hard Delete (permanent, irreversible) ──────────────────────────────
  const handleHardDelete = useCallback((w: WorkWithMeta) => {
    setConfirm({
      open: true, loading: false,
      title: '⚠️ Endgültig löschen',
      message: `ACHTUNG: „${w.title || 'Kein Titel'}" wird DAUERHAFT aus der Datenbank gelöscht. Diese Aktion kann NICHT rückgängig gemacht werden!`,
      onConfirm: async () => {
        setConfirm(p => ({ ...p, loading: true }));
        const ok = await workAction('hard_delete_work', w.id);
        setConfirm(p => ({ ...p, loading: false, open: false }));
        if (ok) { showToast('Werk dauerhaft gelöscht', 'info'); refetchAllTabs(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetchAllTabs]);

  // ── Unflag (flagged → published) ───────────────────────────────────────
  const handleUnflag = useCallback((w: WorkWithMeta) => {
    setConfirm({
      open:true, loading:false,
      title: '✅ Meldung auflösen',
      message: `„${w.title||'Kein Titel'}" wird von der Meldeliste entfernt und wieder öffentlich geschaltet.`,
      onConfirm: async () => {
        setConfirm(p => ({ ...p, loading:true }));
        const ok = await workAction('unflag_work', w.id);
        setConfirm(p => ({ ...p, loading:false, open:false }));
        if (ok) { showToast('✅ Meldung aufgelöst, Werk ist wieder live', 'success'); refetchAllTabs(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetchAllTabs]);

  // ── Flag ───────────────────────────────────────────────────────────────
  const handleFlag = useCallback(async (w: WorkWithMeta) => {
    setBusyFor(w.id, true);
    const ok = await workAction('flag_work', w.id, { status:'flagged' });
    setBusyFor(w.id, false);
    if (ok) { showToast('⚑ Werk gemeldet', 'info'); refetchAllTabs(); }
    else showToast('Fehler', 'error');
  }, [refetchAllTabs]);

  // ── Unpublish ──────────────────────────────────────────────────────────
  const handleUnpublish = useCallback((w: WorkWithMeta) => {
    setConfirm({
      open:true, loading:false,
      title: '📤 Werk depublizieren',
      message: `„${w.title||'Kein Titel'}" wird auf Draft gesetzt und versteckt.`,
      onConfirm: async () => {
        setConfirm(p => ({ ...p, loading:true }));
        const ok = await workAction('unpublish_work', w.id);
        setConfirm(p => ({ ...p, loading:false, open:false }));
        if (ok) { showToast('Werk depubliziert', 'info'); refetchAllTabs(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetchAllTabs]);

  // ── Delete ─────────────────────────────────────────────────────────────
  const handleDelete = useCallback((w: WorkWithMeta) => {
    setConfirm({
      open:true, loading:false,
      title: '🗑 Werk löschen',
      message: `„${w.title||'Kein Titel'}" wird als gelöscht markiert. Du kannst es später unter "Gelöscht" wiederherstellen.`,
      onConfirm: async () => {
        setConfirm(p => ({ ...p, loading:true }));
        const ok = await workAction('delete_work', w.id);
        setConfirm(p => ({ ...p, loading:false, open:false }));
        if (ok) { showToast('Werk gelöscht', 'info'); refetchAllTabs(); setSelected(null); }
        else showToast('Fehler', 'error');
      },
    });
  }, [refetchAllTabs]);

  // ── Approve (draft/flagged/pending → published) ──────────────────────
  const handleApprove = useCallback(async (w: WorkWithMeta) => {
    setBusyFor(w.id, true);
    const ok = await workAction('approve_work', w.id);
    setBusyFor(w.id, false);
    if (ok) { showToast('✅ Work freigegeben', 'success'); refetchAllTabs(); }
    else showToast('Fehler', 'error');
  }, [refetchAllTabs]);

  // ── Reject (pending_review → rejected) ────────────────────────────────
  const [rejectModal, setRejectModal] = useState<{ open: boolean; work: WorkWithMeta | null; reason: string }>({
    open: false, work: null, reason: ''
  });

  const handleReject = useCallback((w: WorkWithMeta) => {
    setRejectModal({ open: true, work: w, reason: '' });
  }, []);

  const handleRejectConfirm = useCallback(async () => {
    const w = rejectModal.work;
    if (!w) return;
    const reason = rejectModal.reason.trim() || 'Nicht genehmigt';
    setRejectModal(p => ({ ...p, open: false }));
    setBusyFor(w.id, true);
    const ok = await workAction('reject_work', w.id, { reason });
    setBusyFor(w.id, false);
    if (ok) { showToast('❌ Werk abgelehnt — Nutzer benachrichtigt', 'success'); refetchAllTabs(); }
    else showToast('Fehler', 'error');
  }, [rejectModal, refetchAllTabs]);

  // ── Styles ─────────────────────────────────────────────────────────────
  const fieldStyle: React.CSSProperties = {
    width:'100%', padding:'7px 10px', background:'var(--bg-tertiary)',
    border:'1px solid var(--border)', borderRadius:7, fontSize:12,
    color:'var(--text-primary)', fontFamily:'var(--font-body)', outline:'none',
  };

  // ── Tab context messages ────────────────────────────────────────────────
  const tabBanners: Partial<Record<TabKey, { bg: string; border: string; color: string; text: string }>> = {
    pending:   { bg:'rgba(234,179,8,0.06)',   border:'var(--gold)', color:'var(--gold)', text:'⏳ Diese Werke warten auf Freigabe. Prüfe sie und klicke auf ✅ Freigeben oder ❌ Ablehnen.' },
    rejected:  { bg:'rgba(255,107,107,0.06)', border:'var(--red)',  color:'var(--red)',  text:'❌ Abgelehnte Werke. Nutzer können sie überarbeiten und erneut einreichen.' },
    deleted:   { bg:'rgba(255,107,107,0.06)', border:'var(--red)',  color:'var(--red)',  text:'🗑 Hier siehst du gelöschte Werke. Du kannst sie als Draft wiederherstellen.' },
    flagged:   { bg:'rgba(247,183,49,0.08)', border:'var(--gold)', color:'var(--gold)', text:'⚑ Gemeldete Werke sind versteckt. Du kannst die Meldung auflösen oder das Werk endgültig löschen.' },
    sensitive: { bg:'rgba(255,107,107,0.06)', border:'var(--red)',  color:'var(--red)',  text:'⚠️ Werke mit verdächtigen Keywords, hohen Preisen oder fehlenden Bildern. Prüfe jeden Eintrag.' },
  };

  const banner = tabBanners[tab];

  return (
    <DashboardLayout
      title="Werke & Content"
      headerActions={
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {counts.pending > 0 && (
            <button onClick={() => setTab('pending')} style={{ fontSize:11, background:'rgba(245,158,11,0.12)', color:'#F59E0B', padding:'3px 10px', borderRadius:20, border:'1px solid #F59E0B', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
              ⏳ {counts.pending} eingereicht
            </button>
          )}
          {counts.flagged > 0 && (
            <button onClick={() => setTab('flagged')} style={{ fontSize:11, background:'var(--red-dim)', color:'var(--red)', padding:'3px 10px', borderRadius:20, border:'1px solid var(--red)', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)' }}>
              ⚑ {counts.flagged} gemeldet
            </button>
          )}
          {counts.sensitive > 0 && (
            <button onClick={() => setTab('sensitive')} style={{ fontSize:11, background:'var(--gold-dim)', color:'var(--gold)', padding:'3px 10px', borderRadius:20, border:'1px solid var(--gold)', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)' }}>
              ⚠️ {counts.sensitive} sensitiv
            </button>
          )}
          <span style={{ fontSize:11, color:'var(--green)', background:'rgba(81,207,102,0.1)', padding:'3px 10px', borderRadius:20, border:'1px solid rgba(81,207,102,0.2)' }}>● Live</span>
          <button onClick={refetchAllTabs} style={{ padding:'5px 10px', background:'var(--bg-tertiary)', border:'1px solid var(--border)', borderRadius:8, fontSize:11, color:'var(--text-secondary)', cursor:'pointer', fontFamily:'var(--font-body)' }}>↻</button>
        </div>
      }
    >
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:16 }} className="grid-6">
        {[
          { label:'Werke gesamt',   value: loading ? '…' : fmt(counts.published + counts.draft), color:'var(--accent)' },
          { label:'Published',      value: loading ? '…' : fmt(counts.published),               color:'var(--green)'  },
          { label:'Draft',          value: loading ? '…' : fmt(counts.draft),                   color:'var(--gold)'   },
          { label:'Eingereicht',    value: loading ? '…' : fmt(counts.pending),                 color:'#F59E0B'       },
          { label:'Gemeldet',       value: loading ? '…' : fmt(counts.flagged),                 color:'var(--red)'    },
          { label:'Gelöscht',       value: loading ? '…' : fmt(counts.deleted),                 color:'var(--text-muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 18px' }}>
            <div style={{ fontSize:22, fontWeight:700, color, fontFamily:'var(--font-mono)' }}>{value}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginTop:3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <TabBar tab={tab} setTab={setTab} counts={counts} />

      {/* Context Banner */}
      {banner && (
        <div style={{ marginBottom:12, padding:'10px 14px', background:banner.bg, border:`1px solid ${banner.border}`, borderRadius:8, fontSize:12, color:banner.color }}>
          {banner.text}
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom:12, position:'relative' }}>
        <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:12 }}>🔍</span>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={`In ${tab === 'deleted' ? 'gelöschten' : tab === 'flagged' ? 'gemeldeten' : 'allen'} Werken suchen…`}
          style={{ ...fieldStyle, paddingLeft:30, boxSizing:'border-box' }}
        />
      </div>

      {/* Count hint */}
      <div style={{ marginBottom:8, fontSize:11, color:'var(--text-muted)' }}>
        {loading ? 'Lädt…' : `${activeList.length} Einträge`}
        {tab === 'deleted'   && counts.deleted   > 0 && ' · Klicke auf ein Werk, um es wiederherzustellen'}
        {tab === 'flagged'   && counts.flagged   > 0 && ' · Klicke auf ein Werk, um die Meldung zu verwalten'}
        {tab === 'sensitive' && counts.sensitive > 0 && ' · Klicke auf ein Werk, um den Inhalt zu prüfen'}
      </div>

      {/* Table */}
      <div style={{ background:'var(--bg-secondary)', border:`1px solid ${tab==='deleted'?'rgba(255,107,107,0.2)':tab==='flagged'?'rgba(247,183,49,0.2)':'var(--border)'}`, borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background: tab==='deleted' ? 'rgba(255,107,107,0.04)' : tab==='flagged' ? 'rgba(247,183,49,0.04)' : undefined }}>
                {['', 'Titel', 'Kategorie', 'Status', 'Preis', 'Engagement', 'Erstellt', 'Aktionen'].map(h => (
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontWeight:600, letterSpacing:'0.7px', textTransform:'uppercase', color:'var(--text-muted)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <><Skeleton/><Skeleton/><Skeleton/><Skeleton/></>
              ) : activeList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding:48, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
                    {tab === 'deleted'   ? '🗑 Keine gelöschten Werke' :
                     tab === 'flagged'   ? '✅ Keine gemeldeten Werke' :
                     tab === 'sensitive' ? '✅ Kein sensitiver Inhalt gefunden' :
                     'Keine Werke gefunden'}
                  </td>
                </tr>
              ) : activeList.map((w) => {
                const imgs = parseImages(w.images as unknown);
                const cover = (w.cover_url as string) || imgs[0] || '';
                const isBusy = busy[w.id];
                const price = (w.price as number) || 0;

                return (
                  <tr key={w.id} className="tr-hover"
                    style={{ background: w._sensitive.flagged && tab !== 'deleted' ? 'rgba(255,107,107,0.02)' : undefined }}
                    onClick={() => openDetail(w)}
                  >
                    {/* Thumbnail */}
                    <td style={{ padding:'8px 10px', borderBottom:'1px solid var(--border)', width:44 }}>
                      <div style={{ width:36, height:36, borderRadius:8, overflow:'hidden', background:'var(--bg-tertiary)', position:'relative' }}>
                        {cover
                          ? <img src={cover} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { e.currentTarget.style.display='none'; }}/>
                          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🎨</div>
                        }
                        {tab === 'deleted' && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🗑</div>}
                      </div>
                    </td>
                    {/* Title */}
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', maxWidth:200 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        {w._sensitive.flagged && tab !== 'deleted' && <span title={w._sensitive.reasons.join('\n')} style={{ color:'var(--red)', fontSize:12, cursor:'help' }}>⚠️</span>}
                        <div>
                          <div style={{ color:'var(--text-primary)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:170, textDecoration: w.status === 'deleted' ? 'line-through' : 'none', opacity: w.status === 'deleted' ? 0.6 : 1 }}>
                            {w.title || <span style={{ color:'var(--text-muted)' }}>—</span>}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
                            <span style={{ color:'var(--text-muted)', fontSize:10, fontFamily:'var(--font-mono)' }}>{String(w.id).slice(0,8)}…</span>
                            {tab === 'pending' && (
                              Boolean((w as Record<string,unknown>).is_update)
                                ? <span style={{ padding:'1px 5px', borderRadius:4, fontSize:8, fontWeight:700, background:'rgba(168,139,250,0.18)', color:'#A78BFA' }}>UPDATE</span>
                                : <span style={{ padding:'1px 5px', borderRadius:4, fontSize:8, fontWeight:700, background:'rgba(42,191,172,0.18)', color:'#2ABFAC' }}>NEU</span>
                            )}
                            {tab === 'pending' && Boolean((w as Record<string,unknown>).last_submitted_at) && (
                              <span style={{ fontSize:9, color:'var(--text-muted)' }}>
                                {timeAgo(String((w as Record<string,unknown>).last_submitted_at ?? ''))}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>{w.category||'—'}</td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)' }}><StatusBadge status={String(w.status||'draft')}/></td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', fontFamily:'var(--font-mono)', fontSize:11, color: price>HIGH_PRICE_THRESHOLD ? 'var(--red)' : price>0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                      {price > 0 ? `€${price.toLocaleString('de-DE')}` : '—'}
                    </td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', fontSize:11, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>
                      <span title="Likes">❤ {w.likes_count||0}</span>
                      <span style={{ marginLeft:6 }} title="Views">👁 {w.views_count||0}</span>
                      <span style={{ marginLeft:6 }} title="Kommentare">💬 {w.comments_count||0}</span>
                    </td>
                    <td style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', color:'var(--text-muted)', fontSize:11, whiteSpace:'nowrap' }}>{timeAgo(String(w.created_at||''))}</td>
                    {/* Row Actions — context-aware */}
                    <td style={{ padding:'8px 10px', borderBottom:'1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:3 }}>
                        <button title="Details" onClick={() => openDetail(w)}
                          style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--accent)', cursor:'pointer', fontSize:12 }}>👁</button>

                        {/* DELETED tab: Restore + Hard Delete */}
                        {tab === 'deleted' && (
                          <>
                            <button title="Wiederherstellen" disabled={isBusy} onClick={() => handleRestore(w)}
                              style={{ padding:'3px 8px', borderRadius:5, border:'1px solid var(--green)', background:'var(--green-dim)', color:'var(--green)', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                              {isBusy ? '…' : '♻️ Restore'}
                            </button>
                            <button title="Endgültig löschen" disabled={isBusy} onClick={() => handleHardDelete(w)}
                              style={{ padding:'3px 8px', borderRadius:5, border:'1px solid var(--red)', background:'var(--red-dim)', color:'var(--red)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                              {isBusy ? '…' : '🗑 Löschen'}
                            </button>
                          </>
                        )}

                        {/* FLAGGED tab: Unflag + Delete */}
                        {tab === 'flagged' && (
                          <>
                            <button title="Meldung auflösen" disabled={isBusy} onClick={() => handleUnflag(w)}
                              style={{ padding:'3px 8px', borderRadius:5, border:'1px solid var(--green)', background:'var(--green-dim)', color:'var(--green)', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                              {isBusy ? '…' : '✅ Auflösen'}
                            </button>
                            <button title="Löschen" disabled={isBusy} onClick={() => handleDelete(w)}
                              style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--red)', background:'var(--red-dim)', color:'var(--red)', cursor:'pointer', fontSize:12 }}>🗑</button>
                          </>
                        )}

                        {/* PENDING tab: Freigeben + Ablehnen */}
                        {(tab as string) === 'pending' && (
                          <>
                            <button title="Freigeben" disabled={isBusy} onClick={() => handleApprove(w)}
                              style={{ padding:'3px 8px', borderRadius:5, border:'1px solid var(--green)', background:'var(--green-dim)', color:'var(--green)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                              {isBusy ? '…' : '✅ Freigeben'}
                            </button>
                            <button title="Ablehnen" disabled={isBusy} onClick={() => handleReject(w)}
                              style={{ padding:'3px 8px', borderRadius:5, border:'1px solid var(--red)', background:'var(--red-dim)', color:'var(--red)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                              {isBusy ? '…' : '❌ Ablehnen'}
                            </button>
                          </>
                        )}

                        {/* REJECTED tab: Wieder freigeben */}
                        {(tab as string) === 'rejected' && (
                          <>
                            <button title="Doch freigeben" disabled={isBusy} onClick={() => handleApprove(w)}
                              style={{ padding:'3px 8px', borderRadius:5, border:'1px solid var(--green)', background:'var(--green-dim)', color:'var(--green)', cursor:'pointer', fontSize:11, fontWeight:700 }}>
                              {isBusy ? '…' : '✅ Freigeben'}
                            </button>
                          </>
                        )}

                        {/* ALL / PUBLISHED / DRAFT / SENSITIVE tabs */}
                        {tab !== 'deleted' && tab !== 'flagged' && (tab as string) !== 'pending' && (tab as string) !== 'rejected' && (
                          <>
                            {w.status === 'draft' && (
                              <button title="Freigeben" disabled={isBusy} onClick={() => handleApprove(w)}
                                style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--green)', background:'var(--green-dim)', color:'var(--green)', cursor:'pointer', fontSize:12 }}>✓</button>
                            )}
                            {w.status === 'published' && (
                              <button title="Melden" disabled={isBusy} onClick={() => handleFlag(w)}
                                style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--gold)', background:'var(--gold-dim)', color:'var(--gold)', cursor:'pointer', fontSize:12 }}>⚑</button>
                            )}
                            <button title="Löschen" disabled={isBusy} onClick={() => handleDelete(w)}
                              style={{ padding:'3px 7px', borderRadius:5, border:'1px solid var(--red)', background:'var(--red-dim)', color:'var(--red)', cursor:'pointer', fontSize:12 }}>🗑</button>
                          </>
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

      {/* ── Detail / Edit Modal ─────────────────────────────────────────── */}
      {selected && (
        <Modal
          open
          onClose={() => { setSelected(null); setEditMode(false); }}
          title={editMode ? `✏️ Bearbeiten: ${selected.title||'Kein Titel'}` : `📄 Werk Details`}
          width={700}
          footer={
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Button variant="ghost" onClick={() => { setSelected(null); setEditMode(false); }}>Schließen</Button>
              {!editMode ? (
                <>
                  <Button variant="primary" onClick={() => setEditMode(true)}>✏️ Bearbeiten</Button>

                  {/* Status-specific actions */}
                  {selected.status === 'deleted' && (
                    <>
                      <Button variant="primary" onClick={() => handleRestore(selected)}>♻️ Wiederherstellen</Button>
                      <Button variant="danger" onClick={() => handleHardDelete(selected)}>🗑 Endgültig löschen</Button>
                    </>
                  )}
                  {selected.status === 'flagged' && (
                    <>
                      <Button variant="primary" onClick={() => handleUnflag(selected)}>✅ Meldung auflösen</Button>
                      <Button variant="danger"  onClick={() => handleDelete(selected)}>🗑 Löschen</Button>
                    </>
                  )}
                  {selected.status === 'published' && (
                    <>
                      <Button variant="ghost"  onClick={() => handleUnpublish(selected)}>📤 Depublizieren</Button>
                      <Button variant="danger" onClick={() => handleFlag(selected)}>⚑ Melden</Button>
                      <Button variant="danger" onClick={() => handleDelete(selected)}>🗑 Löschen</Button>
                    </>
                  )}
                  {selected.status === 'draft' && (
                    <>
                      <Button variant="primary" onClick={() => handleApprove(selected)}>✅ Freigeben</Button>
                      <Button variant="danger"  onClick={() => handleDelete(selected)}>🗑 Löschen</Button>
                    </>
                  )}
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
          {(selected as any)._sensitive?.flagged && (
            <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--red-dim)', border:'1px solid var(--red)', borderRadius:8 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--red)', marginBottom:4 }}>⚠️ Sensitiver Inhalt erkannt</div>
              {((selected as any)._sensitive.reasons as string[]).map((r: string, i: number) => (
                <div key={i} style={{ fontSize:11, color:'var(--red)', marginTop:2 }}>{r}</div>
              ))}
            </div>
          )}

          {/* Status banner in modal */}
          {selected.status === 'deleted' && (
            <div style={{ marginBottom:14, padding:'10px 14px', background:'rgba(255,107,107,0.07)', border:'1px solid var(--red)', borderRadius:8, fontSize:12, color:'var(--red)' }}>
              🗑 Dieses Werk ist als gelöscht markiert und in der App <strong>nicht sichtbar</strong>.
              <br/><span style={{ marginTop:4, display:'block', opacity:0.8 }}>♻️ Wiederherstellen → setzt es als Draft zurück · 🗑 Endgültig löschen → unwiderruflich aus der Datenbank entfernen</span>
            </div>
          )}
          {selected.status === 'flagged' && (
            <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--gold-dim)', border:'1px solid var(--gold)', borderRadius:8, fontSize:12, color:'var(--gold)' }}>
              ⚑ Dieses Werk ist gemeldet und für User versteckt. Prüfe den Inhalt und löse die Meldung auf oder lösche das Werk.
            </div>
          )}

          {/* Media */}
          {(() => {
            const imgs = parseImages(selected.images as unknown);
            const cover = (selected.cover_url as string) || imgs[0];
            const all = cover ? [cover, ...imgs.filter(u => u !== cover)] : imgs;
            return all.length > 0 ? (
              <div style={{ display:'flex', gap:6, marginBottom:14, overflowX:'auto', paddingBottom:4 }}>
                {all.slice(0,6).map((url, i) => (
                  <div key={i} style={{ flexShrink:0, width:i===0?180:80, height:i===0?120:80, borderRadius:8, overflow:'hidden', background:'var(--bg-tertiary)', border:`${i===0?2:1}px solid ${i===0?'var(--accent)':'var(--border)'}` }}>
                    <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { e.currentTarget.style.display='none'; }}/>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ height:70, background:'var(--bg-tertiary)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:12, marginBottom:14, border:'1px solid var(--border)' }}>📷 Kein Bild</div>
            );
          })()}

          {!editMode ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {([
                ['ID',           String(selected.id)],
                ['Titel',        String(selected.title||'—')],
                ['Status',       String(selected.status||'—')],
                ['Sichtbarkeit', String(selected.visibility||'—')],
                ['Kategorie',    String(selected.category||'—')],
                ['Post-Typ',     String(selected.post_type||'—')],
                ['Preis',        `€${((selected.price as number)||0).toLocaleString('de-DE')}`],
                ['Für Verkauf',  Boolean(selected.for_sale)?'Ja':'Nein'],
                ['Lagerbestand', String(selected.stock_quantity??'—')],
                ['Kommentare',   Boolean(selected.allow_comments)?'✅ erlaubt':'🚫 gesperrt'],
                ['Likes',        Boolean(selected.allow_likes)?'✅ erlaubt':'🚫 gesperrt'],
                ['Standort',     String(selected.location_text||'—')],
                ['Views',        String(selected.views_count||0)],
                ['Likes #',      String(selected.likes_count||0)],
                ['Kommentare #', String(selected.comments_count||0)],
                ['Erstellt',     timeAgo(String(selected.created_at||''))],
                ['User-ID',      String(selected.user_id||'—').slice(0,18)+'…'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ padding:'7px 10px', background:'var(--bg-tertiary)', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:12, color:'var(--text-primary)', fontWeight:500, wordBreak:'break-all' }}>{v}</div>
                </div>
              ))}
              {selected.description && (
                <div style={{ gridColumn:'1/-1', padding:'7px 10px', background:'var(--bg-tertiary)', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Beschreibung</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>{String(selected.description)}</div>
                </div>
              )}
              {selected.caption && (
                <div style={{ gridColumn:'1/-1', padding:'7px 10px', background:'var(--bg-tertiary)', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Caption</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>{String(selected.caption)}</div>
                </div>
              )}
              {Array.isArray(selected.tags) && (selected.tags as string[]).length > 0 && (
                <div style={{ gridColumn:'1/-1', padding:'7px 10px', background:'var(--bg-tertiary)', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Tags</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {(selected.tags as string[]).map(t => (
                      <span key={t} style={{ padding:'2px 8px', borderRadius:20, background:'var(--accent-dim)', color:'var(--accent)', fontSize:11 }}>#{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : form ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Titel</label>
                  <input style={fieldStyle} value={form.title} onChange={e => setForm({...form, title:e.target.value})}/>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Kategorie</label>
                  <select style={fieldStyle} value={form.category} onChange={e => setForm({...form, category:e.target.value})}>
                    {['Sonstiges','Musik','Design','Digitale Kunst','Fotografie','Video','Dienstleistung','Handwerk','Mode','Essen & Trinken'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Status</label>
                  <select style={fieldStyle} value={form.status} onChange={e => setForm({...form, status:e.target.value})}>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="flagged">Gemeldet</option>
                    <option value="deleted">Gelöscht</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Sichtbarkeit</label>
                  <select style={fieldStyle} value={form.visibility} onChange={e => setForm({...form, visibility:e.target.value})}>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="unlisted">Unlisted</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Preis (€)</label>
                  <input style={fieldStyle} type="number" min="0" value={form.price} onChange={e => setForm({...form, price:e.target.value})}/>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Standort</label>
                  <input style={fieldStyle} value={form.location_text} onChange={e => setForm({...form, location_text:e.target.value})}/>
                </div>
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Beschreibung</label>
                <textarea style={{...fieldStyle, height:70, resize:'vertical'}} value={form.description} onChange={e => setForm({...form, description:e.target.value})}/>
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Caption</label>
                <textarea style={{...fieldStyle, height:50, resize:'vertical'}} value={form.caption} onChange={e => setForm({...form, caption:e.target.value})}/>
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Tags (kommagetrennt)</label>
                <input style={fieldStyle} value={form.tags} onChange={e => setForm({...form, tags:e.target.value})} placeholder="tag1, tag2, tag3"/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                {([['allow_comments','Kommentare'],['allow_likes','Likes'],['allow_shares','Shares'],['for_sale','Zum Verkauf'],['is_showcase_only','Nur Showcase']] as [keyof EditForm, string][]).map(([k, lbl]) => (
                  <label key={k} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-secondary)', cursor:'pointer', padding:'6px 8px', background:'var(--bg-tertiary)', borderRadius:6 }}>
                    <input type="checkbox" checked={Boolean(form[k])} onChange={e => setForm({...form, [k]:e.target.checked})}/>
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
        onClose={() => setConfirm(p => ({...p, open:false}))}
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
// deploy-trigger: 2026-06-08
