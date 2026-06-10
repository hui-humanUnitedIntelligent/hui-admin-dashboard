// frontend/src/app/experiences/page.tsx
'use client';

import { useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { showToast } from '@/components/ui/Toast';
import { useExperiencesAndProjects, HuiEntry } from '@/lib/hooks/useSupabase';

// ── Types ──────────────────────────────────────────────────────────────────
type TabKey = 'all' | 'pending' | 'published' | 'rejected' | 'draft' | 'deleted' | 'sensitive';

// ── Helpers ────────────────────────────────────────────────────────────────
function s(v: unknown): string { return v == null ? '—' : String(v); }

function timeAgo(iso: string | null | undefined) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Heute';
  if (days < 30)  return `Vor ${days}d`;
  return new Date(iso).toLocaleDateString('de-DE');
}

function isUpdated(entry: HuiEntry): boolean {
  const r = entry as Record<string, unknown>;
  if (r.is_update === true) return true;
  if (!entry.last_submitted_at || !entry.created_at) return false;
  return new Date(entry.last_submitted_at as string).getTime() > new Date(entry.created_at).getTime() + 5000;
}

function normStatus(e: HuiEntry): string {
  if (e.approval_status) return s(e.approval_status);
  if (e.status === 'pending_review') return 'pending';
  if (e.status === 'published')      return 'approved';
  if (e.status === 'rejected')       return 'rejected';
  if (e.status === 'draft')          return 'draft';
  if (e.status === 'deleted')        return 'deleted';
  return s(e.status) || 'unknown';
}

const isPending  = (e: HuiEntry) => normStatus(e) === 'pending';
const isApproved = (e: HuiEntry) => { const ns = normStatus(e); return ns === 'approved' || ns === 'published'; };
const isRejected = (e: HuiEntry) => normStatus(e) === 'rejected';
const isDraft    = (e: HuiEntry) => normStatus(e) === 'draft';
const isDeleted  = (e: HuiEntry) => normStatus(e) === 'deleted';
const isSensitive = (e: HuiEntry) => !e.title || String(e.title).trim().length < 2;

// ── API Action ─────────────────────────────────────────────────────────────
async function entryAction(action: string, id: string, data: Record<string, unknown> = {}): Promise<boolean> {
  try {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: id, data }),
    });
    return res.ok;
  } catch { return false; }
}

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ entry }: { entry: HuiEntry }) {
  const ns  = normStatus(entry);
  const upd = isUpdated(entry);
  if (ns === 'approved' || ns === 'published') return (
    <span style={{ display:'flex', alignItems:'center', gap:4 }}>
      <Badge variant="success" dot>Published</Badge>
      {upd && <span style={{ fontSize:9, color:'#F59E0B', fontWeight:700 }}>↻ Upd.</span>}
    </span>
  );
  if (ns === 'pending') return (
    <span style={{ display:'flex', alignItems:'center', gap:4 }}>
      <Badge variant="warning" dot>⏳ Eingereicht</Badge>
      {upd && <span style={{ fontSize:9, color:'#F59E0B', fontWeight:700 }}>↻ Akt.</span>}
    </span>
  );
  if (ns === 'rejected') return <Badge variant="danger" dot>❌ Abgelehnt</Badge>;
  if (ns === 'draft')    return <Badge variant="neutral" dot>Draft</Badge>;
  if (ns === 'deleted')  return <Badge variant="neutral">🗑 Gelöscht</Badge>;
  return <Badge variant="neutral">{s(entry.status)}</Badge>;
}

// ── Source Badge ───────────────────────────────────────────────────────────
function SourceBadge({ source }: { source: string }) {
  const isExp = source === 'experiences';
  return (
    <span style={{
      fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4,
      background: isExp ? 'rgba(78,205,196,0.12)' : 'rgba(147,112,219,0.12)',
      color: isExp ? 'var(--accent)' : '#9370DB',
      border: `1px solid ${isExp ? 'rgba(78,205,196,0.3)' : 'rgba(147,112,219,0.3)'}`,
      letterSpacing:'0.5px', textTransform:'uppercase' as const,
    }}>
      {isExp ? 'Erlebnis' : 'Projekt'}
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <tr>
      {[...Array(8)].map((_, i) => (
        <td key={i} style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ height:11, background:'var(--bg-tertiary)', borderRadius:4, animation:'pulse 2s ease-in-out infinite', width:i===0?'70%':'50%' }}/>
        </td>
      ))}
    </tr>
  );
}

// ── Tab Bar ────────────────────────────────────────────────────────────────
function TabBar({ tab, setTab, counts }: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  counts: Record<TabKey, number>;
}) {
  const tabs: { key: TabKey; label: string; icon: string; danger?: boolean }[] = [
    { key: 'all',       label: 'Alle',        icon: ''   },
    { key: 'pending',   label: 'Eingereicht', icon: '⏳' },
    { key: 'published', label: 'Published',   icon: '●'  },
    { key: 'rejected',  label: 'Abgelehnt',   icon: '✕', danger: true },
    { key: 'draft',     label: 'Draft',       icon: ''   },
    { key: 'deleted',   label: 'Gelöscht',    icon: '🗑' },
    { key: 'sensitive', label: 'Sensitiv',    icon: '⚠️', danger: true },
  ];
  return (
    <div style={{ display:'flex', gap:4, marginBottom:14, borderBottom:'1px solid var(--border)', paddingBottom:10, flexWrap:'wrap' }}>
      {tabs.map(({ key, label, icon, danger }) => {
        const active = tab === key;
        const cnt    = counts[key];
        const col    = key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)';
        const bg     = key === 'pending' ? 'rgba(245,158,11,0.12)' : danger ? 'var(--red-dim)' : 'var(--accent-dim)';
        return (
          <button key={key} onClick={() => setTab(key)} style={{
            padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight: active ? 600 : 400,
            border:`1px solid ${active ? col : 'var(--border)'}`,
            background: active ? bg : 'var(--bg-secondary)',
            color: active ? col : 'var(--text-secondary)',
            cursor:'pointer', fontFamily:'var(--font-body)', transition:'all 0.15s',
            display:'flex', alignItems:'center', gap:5,
          }}>
            {icon && <span style={{ fontSize:10 }}>{icon}</span>}
            {label}
            {cnt > 0 && (
              <span style={{
                minWidth:18, height:18, borderRadius:9, fontSize:10, fontWeight:700,
                background: active ? col : (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--bg-tertiary)'),
                color: active ? '#fff' : (key === 'pending' || danger ? '#fff' : 'var(--text-secondary)'),
                display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px',
              }}>{cnt}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex:1, minWidth:100, padding:'14px 16px', background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:10 }}>
      <div style={{ fontSize:22, fontWeight:700, color, marginBottom:2 }}>{value.toLocaleString('de-DE')}</div>
      <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px' }}>{label}</div>
    </div>
  );
}

// ── Cover Images (typsicher) ───────────────────────────────────────────────
function EntryCoverImages({ entry }: { entry: HuiEntry }) {
  const rec = entry as Record<string, unknown>;
  const cover = typeof rec.cover_url === 'string' ? rec.cover_url : undefined;
  const imgs: string[] = (() => {
    try {
      const raw = rec.images;
      const parsed = JSON.parse(typeof raw === 'string' ? raw : '[]');
      return Array.isArray(parsed)
        ? (parsed as Record<string, unknown>[]).map(x => x.url || x).filter((u): u is string => typeof u === 'string')
        : [];
    } catch { return []; }
  })();
  const all = cover ? [cover, ...imgs.filter(u => u !== cover)] : imgs;
  if (all.length === 0) return (
    <div style={{ height:70, background:'var(--bg-tertiary)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', fontSize:12, border:'1px solid var(--border)' }}>
      📷 Kein Bild
    </div>
  );
  return (
    <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
      {all.slice(0,5).map((url, i) => (
        <div key={i} style={{ flexShrink:0, width:i===0?180:80, height:i===0?120:80, borderRadius:8, overflow:'hidden', background:'var(--bg-tertiary)', border:`${i===0?2:1}px solid ${i===0?'var(--accent)':'var(--border)'}` }}>
          <img src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }}/>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function ErlebnisseProjektePage() {
  const [tab,          setTab]         = useState<TabKey>('all');
  const [search,       setSearch]      = useState('');
  const [selected,     setSelected]    = useState<HuiEntry | null>(null);
  const [showDetail,   setShowDetail]  = useState(false);
  const [rejectTarget, setRejectTarget]= useState<HuiEntry | null>(null);
  const [rejectReason, setRejectReason]= useState('');
  const [rejectLoading,setRejectLoading]=useState(false);
  const [deleteTarget, setDeleteTarget]= useState<HuiEntry | null>(null);
  const [localDeleted, setLocalDeleted]= useState<Set<string>>(new Set());
  const [actionLoading,setActionLoading]=useState<string|null>(null);

  // ── Daten ─────────────────────────────────────────────────────────────────
  const { entries: allEntries, loading, refetch: refAll } = useExperiencesAndProjects({
    status: 'all',
    limit: 1000,
    refreshInterval: 0,
  });

  const refetchAll = useCallback(() => { refAll(); }, [refAll]);

  // ── Counts ────────────────────────────────────────────────────────────────
  const counts = useMemo<Record<TabKey, number>>(() => ({
    all:       allEntries.filter(e => isApproved(e)).length,
    published: allEntries.filter(e => isApproved(e)).length,
    draft:     allEntries.filter(e => isDraft(e)).length,
    pending:   allEntries.filter(e => isPending(e)).length,
    rejected:  allEntries.filter(e => isRejected(e)).length,
    deleted:   allEntries.filter(e => isDeleted(e)).length,
    sensitive: allEntries.filter(e => isSensitive(e)).length,
  }), [allEntries]);

  // ── Gefilterte Einträge ───────────────────────────────────────────────────
  const displayEntries = useMemo(() => {
    const visible = allEntries.filter(e => !localDeleted.has(e.id));
    let base: HuiEntry[];
    if      (tab === 'all')       base = visible.filter(e => isApproved(e));
    else if (tab === 'published') base = visible.filter(e => isApproved(e));
    else if (tab === 'draft')     base = visible.filter(e => isDraft(e));
    else if (tab === 'pending')   base = visible.filter(e => isPending(e));
    else if (tab === 'rejected')  base = visible.filter(e => isRejected(e));
    else if (tab === 'deleted')   base = visible.filter(e => isDeleted(e));
    else if (tab === 'sensitive') base = visible.filter(e => isSensitive(e));
    else base = visible;

    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(e =>
      (e.title       || '').toLowerCase().includes(q) ||
      (e.category    || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q)
    );
  }, [tab, search, allEntries, localDeleted]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleApprove = async (entry: HuiEntry) => {
    setActionLoading(entry.id);
    const action = entry._source === 'experiences' ? 'approve_experience' : 'approve_project';
    const ok = await entryAction(action, entry.id);
    setActionLoading(null);
    if (ok) {
      showToast(`✅ Freigegeben: ${entry.title || 'Eintrag'}`, 'success');
      refetchAll();
    } else {
      showToast('Fehler beim Freigeben', 'error');
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) { showToast('Bitte Ablehnungsgrund angeben', 'error'); return; }
    setRejectLoading(true);
    const action = rejectTarget._source === 'experiences' ? 'reject_experience' : 'reject_project';
    const ok = await entryAction(action, rejectTarget.id, { reason });
    setRejectLoading(false);
    if (ok) {
      showToast(`❌ Abgelehnt: ${rejectTarget.title || 'Eintrag'}`, 'info');
      setRejectTarget(null);
      setRejectReason('');
      refetchAll();
    } else {
      showToast('Fehler beim Ablehnen', 'error');
    }
  };

  const handleDelete = async (entry: HuiEntry) => {
    const action = entry._source === 'experiences' ? 'delete_experience' : 'delete_project';
    setLocalDeleted(prev => new Set([...prev, entry.id]));
    setDeleteTarget(null);
    const ok = await entryAction(action, entry.id);
    if (ok) {
      showToast('🗑 Gelöscht', 'info');
      setTimeout(() => setLocalDeleted(new Set()), 3000);
    } else {
      showToast('Fehler beim Löschen', 'error');
      setLocalDeleted(prev => { const s2 = new Set(prev); s2.delete(entry.id); return s2; });
    }
  };

  // ── Context Banners ───────────────────────────────────────────────────────
  const tabBanners: Partial<Record<TabKey, { bg:string; border:string; color:string; text:string }>> = {
    pending:   { bg:'rgba(245,158,11,0.08)',  border:'#F59E0B',    color:'#F59E0B',    text:'⏳ Diese Erlebnisse & Projekte warten auf Freigabe.' },
    rejected:  { bg:'rgba(255,107,107,0.06)', border:'var(--red)', color:'var(--red)', text:'❌ Abgelehnte Einträge. Nutzer können sie überarbeiten.' },
    deleted:   { bg:'rgba(255,107,107,0.06)', border:'var(--red)', color:'var(--red)', text:'🗑 Gelöschte Einträge.' },
    sensitive: { bg:'rgba(247,183,49,0.08)',  border:'var(--gold)',color:'var(--gold)',text:'⚠️ Einträge ohne Titel oder Pflichtfelder.' },
  };
  const banner = tabBanners[tab];

  return (
    <DashboardLayout title="Erlebnisse & Projekte">
      <div style={{ padding:'24px 28px', maxWidth:1400, margin:'0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ fontSize:22 }}>🌿</span>
            <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:'var(--text-primary)' }}>
              Erlebnisse &amp; Projekte
            </h1>
            <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'var(--accent-dim)', color:'var(--accent)', fontWeight:600 }}>
              {allEntries.length.toLocaleString('de-DE')} gesamt
            </span>
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>
            Verwaltung aller eingereichten Erlebnisse und Projekte — Freigabe, Ablehnung, Moderation
          </div>
        </div>

        {/* ── Statistik-Kacheln ── */}
        <div style={{ display:'flex', gap:10, marginBottom:22, flexWrap:'wrap' }}>
          <StatCard label="Erlebnisse gesamt" value={allEntries.filter(e => e._source === 'experiences').length}      color="var(--accent)" />
          <StatCard label="Published"          value={counts.published}  color="var(--green)"  />
          <StatCard label="Draft"              value={counts.draft}      color="var(--text-muted)" />
          <StatCard label="Eingereicht"        value={counts.pending}    color="#F59E0B"       />
          <StatCard label="Abgelehnt"          value={counts.rejected}   color="var(--red)"    />
          <StatCard label="Gelöscht"           value={counts.deleted}    color="var(--red)"    />
        </div>

        {/* ── Filterleiste ── */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, minWidth:220 }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', fontSize:14 }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Titel, Kategorie, Beschreibung …"
              style={{ width:'100%', padding:'8px 10px 8px 32px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:12, fontFamily:'var(--font-body)', outline:'none', boxSizing:'border-box' }}
            />
          </div>
          <button onClick={refetchAll} style={{ padding:'8px 14px', borderRadius:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', color:'var(--text-secondary)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)' }}>
            ↻ Aktualisieren
          </button>
        </div>

        {/* ── Tab Bar ── */}
        <TabBar tab={tab} setTab={setTab} counts={counts} />

        {/* ── Context Banner ── */}
        {banner && (
          <div style={{ marginBottom:14, padding:'10px 14px', background:banner.bg, border:`1px solid ${banner.border}`, borderRadius:8, fontSize:12, color:banner.color, fontWeight:500 }}>
            {banner.text}
          </div>
        )}

        {/* ── Tabelle ── */}
        <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'var(--bg-tertiary)', borderBottom:'1px solid var(--border)' }}>
                  {['Titel', 'Typ', 'Status', 'Preis/Wert', 'Kategorie', 'Erstellt', 'Ks.'].map(h => (
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:600, fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !allEntries.length
                  ? [...Array(5)].map((_, i) => <Skeleton key={i} />)
                  : displayEntries.length === 0
                    ? (
                      <tr>
                        <td colSpan={7} style={{ padding:'40px 20px', textAlign:'center', color:'var(--text-muted)' }}>
                          {search ? `Keine Treffer für „${search}"` : 'Keine Einträge in dieser Kategorie'}
                        </td>
                      </tr>
                    )
                    : displayEntries.map(entry => (
                      <tr
                        key={entry.id}
                        onClick={() => { setSelected(entry); setShowDetail(true); }}
                        style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}
                      >
                        {/* Titel */}
                        <td style={{ padding:'10px 12px', maxWidth:200 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                            <span style={{ fontWeight:500, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:160 }}>
                              {entry.title || <span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>Kein Titel</span>}
                            </span>
                            {isUpdated(entry) && (
                              <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'rgba(245,158,11,0.15)', color:'#F59E0B', fontWeight:700 }}>↻ UPD</span>
                            )}
                          </div>
                        </td>
                        {/* Typ */}
                        <td style={{ padding:'10px 12px' }}>
                          <SourceBadge source={entry._source || 'experiences'} />
                        </td>
                        {/* Status */}
                        <td style={{ padding:'10px 12px' }}>
                          <StatusBadge entry={entry} />
                        </td>
                        {/* Preis */}
                        <td style={{ padding:'10px 12px', color:'var(--text-secondary)', whiteSpace:'nowrap' }}>
                          {entry.price ? `€${Number(entry.price).toLocaleString('de-DE')}` : '—'}
                        </td>
                        {/* Kategorie */}
                        <td style={{ padding:'10px 12px', color:'var(--text-secondary)' }}>
                          {s(entry.category)}
                        </td>
                        {/* Erstellt */}
                        <td style={{ padding:'10px 12px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                          {timeAgo(entry.created_at)}
                        </td>
                        {/* Quick Actions */}
                        <td style={{ padding:'10px 12px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display:'flex', gap:4 }}>
                            {isPending(entry) && (
                              <>
                                <button
                                  disabled={actionLoading === entry.id}
                                  onClick={() => handleApprove(entry)}
                                  title="Freigeben"
                                  style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--accent)', background:'var(--accent-dim)', color:'var(--accent)', fontSize:10, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                                  {actionLoading === entry.id ? '…' : '✅'}
                                </button>
                                <button
                                  onClick={() => { setRejectTarget(entry); setRejectReason(''); }}
                                  title="Ablehnen"
                                  style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--red)', background:'var(--red-dim)', color:'var(--red)', fontSize:10, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                                  ❌
                                </button>
                              </>
                            )}
                            {isRejected(entry) && (
                              <button
                                onClick={() => handleApprove(entry)}
                                title="Trotzdem freigeben"
                                style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--accent)', background:'var(--accent-dim)', color:'var(--accent)', fontSize:10, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                                ✅
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteTarget(entry)}
                              title="Löschen"
                              style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--text-muted)', fontSize:10, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                              🗑
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {/* Pagination-Footer */}
          <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg-tertiary)' }}>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>
              {displayEntries.length} Einträge angezeigt {search && `(gefiltert aus ${allEntries.length})`}
            </span>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>
              Gesamt: {allEntries.length.toLocaleString('de-DE')} Datensätze
            </span>
          </div>
        </div>

        {/* ── Detail Modal ─────────────────────────────────────────────────── */}
        <Modal
          open={showDetail && selected !== null}
          title={selected ? `${selected._source === 'experiences' ? '🌿 Erlebnis' : '📌 Projekt'}: ${selected.title || 'Kein Titel'}` : ''}
          width={700}
          onClose={() => { setShowDetail(false); }}
          footer={selected ? (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <Button variant="ghost" onClick={() => setShowDetail(false)}>Schließen</Button>
              {isPending(selected) && (
                <Button variant="primary" onClick={() => { handleApprove(selected); setShowDetail(false); }}>✅ Freigeben</Button>
              )}
              {isPending(selected) && (
                <Button variant="danger" onClick={() => { setShowDetail(false); setRejectTarget(selected); setRejectReason(''); }}>❌ Ablehnen</Button>
              )}
              {isRejected(selected) && (
                <Button variant="primary" onClick={() => { handleApprove(selected); setShowDetail(false); }}>✅ Trotzdem freigeben</Button>
              )}
              {!isDeleted(selected) && (
                <Button variant="danger" onClick={() => { setShowDetail(false); setDeleteTarget(selected); }}>🗑 Löschen</Button>
              )}
            </div>
          ) : undefined}
        >
          {selected && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* UPDATE-Banner */}
              {isUpdated(selected) && (
                <div style={{ padding:'10px 14px', background:'rgba(245,158,11,0.08)', border:'1px solid #F59E0B', borderRadius:8, display:'flex', alignItems:'flex-start', gap:10 }}>
                  <span style={{ fontSize:16, flexShrink:0 }}>↻</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#F59E0B', marginBottom:2 }}>Update eines bereits eingereichten Eintrags</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', lineHeight:1.5 }}>
                      Der Nutzer hat diesen Eintrag nach einer Ablehnung überarbeitet und erneut eingereicht.
                      {selected.last_submitted_at ? ` Letzte Einreichung: ${new Date(selected.last_submitted_at as string).toLocaleString('de-DE')}` : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Erste Einreichung Banner */}
              {isPending(selected) && !isUpdated(selected) && (
                <div style={{ padding:'10px 14px', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.4)', borderRadius:8, fontSize:12, color:'#F59E0B', fontWeight:500 }}>
                  ⏳ Erste Einreichung — wartet auf Freigabe.
                </div>
              )}

              {/* Ablehnungsgrund-Banner */}
              {isRejected(selected) && (
                <div style={{ padding:'10px 14px', background:'rgba(255,107,107,0.06)', border:'1px solid var(--red)', borderRadius:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--red)', marginBottom:4 }}>❌ Abgelehnter Eintrag</div>
                  {selected.rejection_reason && (
                    <div style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.5 }}>
                      <span style={{ color:'var(--text-muted)' }}>Ablehnungsgrund: </span>
                      {s(selected.rejection_reason)}
                    </div>
                  )}
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>Der Nutzer kann den Eintrag überarbeiten und erneut einreichen.</div>
                </div>
              )}

              {/* Cover-Bilder */}
              <EntryCoverImages entry={selected} />

              {/* Info-Grid */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {((): [string, string][] => {
                  const r = selected as Record<string, unknown>;
                  return [
                    ['Typ',              selected._source === 'experiences' ? 'Erlebnis' : 'Projekt'],
                    ['Status (DB)',       s(selected.status)],
                    ['Freigabe-Status',   normStatus(selected)],
                    ['Kategorie',         s(selected.category)],
                    ['Format',            s(r.format)],
                    ['Preis',             selected.price ? `€${Number(selected.price).toLocaleString('de-DE')}` : '—'],
                    ['Max. Teilnehmer',   s(r.max_participants)],
                    ['Anmeldung nötig',   r.registration_required ? 'Ja' : 'Nein'],
                    ['Sichtbarkeit',      s(r.visibility)],
                    ['Standort',          s(r.location_text)],
                    ['Datum',             s(r.date)],
                    ['Erstellt',          timeAgo(selected.created_at)],
                    ['Eingereicht',       timeAgo(selected.last_submitted_at as string)],
                    ['User-ID',           s(selected.user_id).slice(0, 18) + '…'],
                    ['Eintrag-ID',        s(selected.id).slice(0, 18) + '…'],
                  ];
                })().map(([k, v]) => (
                  <div key={k} style={{ padding:'7px 10px', background:'var(--bg-tertiary)', borderRadius:6 }}>
                    <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:2 }}>{k}</div>
                    <div style={{ fontSize:12, color:'var(--text-primary)', fontWeight:500, wordBreak:'break-all' }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Beschreibung */}
              {selected.description && (
                <div style={{ padding:'7px 10px', background:'var(--bg-tertiary)', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Beschreibung</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>{s(selected.description)}</div>
                </div>
              )}

              {/* Caption */}
              {typeof (selected as Record<string, unknown>).caption === 'string' && (
                <div style={{ padding:'7px 10px', background:'var(--bg-tertiary)', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Caption</div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>{(selected as Record<string, unknown>).caption as string}</div>
                </div>
              )}

            </div>
          )}
        </Modal>

        {/* ── Reject Modal ─────────────────────────────────────────────────── */}
        <Modal
          open={rejectTarget !== null}
          title={rejectTarget ? `❌ Ablehnen: „${rejectTarget.title || 'Kein Titel'}"` : ''}
          onClose={() => { setRejectTarget(null); setRejectReason(''); }}
          footer={
            <div style={{ display:'flex', gap:6 }}>
              <Button variant="ghost" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>Abbrechen</Button>
              <Button variant="danger" onClick={handleRejectConfirm} disabled={rejectLoading || !rejectReason.trim()}>
                {rejectLoading ? '…' : '❌ Ablehnen'}
              </Button>
            </div>
          }
        >
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:13, color:'var(--text-secondary)', lineHeight:1.5 }}>
              Gib einen Ablehnungsgrund an. Der Nutzer sieht diesen Hinweis und kann den Eintrag überarbeiten.
            </div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Ablehnungsgrund eingeben …"
              rows={4}
              style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--text-primary)', fontSize:13, fontFamily:'var(--font-body)', resize:'vertical', outline:'none', boxSizing:'border-box' }}
            />
            {!rejectReason.trim() && (
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>⚠️ Pflichtfeld — Ablehnungsgrund erforderlich</div>
            )}
          </div>
        </Modal>

        {/* ── Delete Confirm ────────────────────────────────────────────────── */}
        <ConfirmModal
          open={deleteTarget !== null}
          title="🗑 Eintrag löschen?"
          message={`„${deleteTarget?.title || 'Kein Titel'}" wird gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`}
          confirmLabel="Löschen"
          confirmVariant="danger"
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
        />

      </div>
    </DashboardLayout>
  );
}
