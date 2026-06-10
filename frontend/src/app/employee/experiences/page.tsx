// frontend/src/app/employee/experiences/page.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Button from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { useExperiencesAndProjects, HuiEntry } from '@/lib/hooks/useSupabase';

// ── Types ──────────────────────────────────────────────────────────────────
type TabKey = 'all' | 'pending' | 'published' | 'rejected' | 'draft' | 'deleted' | 'sensitive';

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('de-DE'); }
function timeAgo(iso: string | null | undefined) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Heute';
  if (days < 30)  return `Vor ${days}d`;
  return new Date(iso).toLocaleDateString('de-DE');
}
function isUpdated(entry: HuiEntry): boolean {
  if (!entry.last_submitted_at || !entry.created_at) return false;
  return new Date(entry.last_submitted_at as string).getTime() > new Date(entry.created_at).getTime() + 5000;
}

// ── Hilfsfunktion unknown→string
function str(v: unknown): string { return v == null ? '—' : String(v); }

// ── API Action ─────────────────────────────────────────────────────────────
async function entryAction(action: string, entryId: string, data: Record<string, unknown> = {}): Promise<boolean> {
  try {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: entryId, data }),
    });
    return res.ok;
  } catch { return false; }
}

// ── Status Badge ───────────────────────────────────────────────────────────
function normEntryStatus(entry: HuiEntry): string {
  if (entry.approval_status) return entry.approval_status as string;
  if (entry.status === 'pending_review') return 'pending';
  if (entry.status === 'published')      return 'approved';
  if (entry.status === 'rejected')       return 'rejected';
  if (entry.status === 'draft')          return 'draft';
  if (entry.status === 'deleted')        return 'deleted';
  return entry.status || 'unknown';
}

function StatusBadge({ entry }: { entry: HuiEntry }) {
  const upd = isUpdated(entry);
  const ns  = normEntryStatus(entry);
  if (ns === 'approved') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Badge variant="success" dot>Approved</Badge>
      {upd && <span style={{ fontSize: 9, color: '#F59E0B', fontWeight: 700 }}>↻ Upd.</span>}
    </span>
  );
  if (ns === 'pending') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Badge variant="warning" dot>⏳ Eingereicht</Badge>
      {upd && <span style={{ fontSize: 9, color: '#F59E0B', fontWeight: 700 }}>↻ Akt.</span>}
    </span>
  );
  if (ns === 'rejected') return <Badge variant="danger" dot>❌ Abgelehnt</Badge>;
  if (ns === 'draft')    return <Badge variant="neutral" dot>Draft</Badge>;
  if (ns === 'deleted')  return <Badge variant="neutral">Gelöscht</Badge>;
  return <Badge variant="neutral">{entry.status}</Badge>;
}

// ── Source Badge ───────────────────────────────────────────────────────────
function SourceBadge({ source }: { source: string }) {
  const isExp = source === 'experiences';
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: isExp ? 'rgba(78,205,196,0.12)' : 'rgba(147,112,219,0.12)',
      color: isExp ? 'var(--accent)' : '#9370DB',
      border: `1px solid ${isExp ? 'rgba(78,205,196,0.3)' : 'rgba(147,112,219,0.3)'}`,
      letterSpacing: '0.5px', textTransform: 'uppercase' as const,
    }}>
      {isExp ? 'Erlebnis' : 'Projekt'}
    </span>
  );
}

// ── Skeleton Row ───────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <tr>
      {[...Array(7)].map((_, i) => (
        <td key={i} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ height: 11, background: 'var(--bg-tertiary)', borderRadius: 4, width: i === 0 ? '70%' : '50%' }} />
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
    { key: 'all',       label: 'Alle',        icon: ''    },
    { key: 'pending',   label: 'Eingereicht', icon: '⏳'  },
    { key: 'published', label: 'Published',   icon: '●'   },
    { key: 'rejected',  label: 'Abgelehnt',   icon: '✕', danger: true },
    { key: 'draft',     label: 'Draft',       icon: ''    },
    { key: 'deleted',   label: 'Gelöscht',    icon: '🗑'  },
    { key: 'sensitive', label: 'Sensitiv',    icon: '⚠️', danger: true },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 10, flexWrap: 'wrap' }}>
      {tabs.map(({ key, label, icon, danger }) => {
        const active = tab === key;
        const cnt    = counts[key];
        const col    = key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)';
        const bg     = key === 'pending' ? 'rgba(245,158,11,0.12)' : danger ? 'var(--red-dim)' : 'var(--accent-dim)';
        return (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 400,
            border: `1px solid ${active ? col : 'var(--border)'}`,
            background: active ? bg : 'var(--bg-secondary)',
            color: active ? col : 'var(--text-secondary)',
            cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {icon && <span style={{ fontSize: 10 }}>{icon}</span>}
            {label}
            {cnt > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9, fontSize: 10, fontWeight: 700,
                background: active ? col : (key === 'pending' || danger ? col : 'var(--bg-tertiary)'),
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

// ── Main Page ──────────────────────────────────────────────────────────────
export default function EmployeeErlebnisseProjektePage() {
  const [tab,           setTab]           = useState<TabKey>('all');
  const [search,        setSearch]        = useState('');
  const [selected,      setSelected]      = useState<HuiEntry | null>(null);
  const [showDetail,    setShowDetail]    = useState(false);
  const [rejectTarget,  setRejectTarget]  = useState<HuiEntry | null>(null);
  const [rejectReason,  setRejectReason]  = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState<HuiEntry | null>(null);
  const [localDeleted,  setLocalDeleted]  = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Live Daten — nur ein einziger Query mit status='all' ─────────────────
  // Normalisierung erfolgt client-seitig über normStatus()
  const { entries: allEntries, loading, refetch: refAll } = useExperiencesAndProjects({
    status: 'all',
    limit: 1000,
    refreshInterval: 0,
  });

  const refetchAll = useCallback(() => { refAll(); }, [refAll]);

  // ── Counts ────────────────────────────────────────────────────────────────
  // ── Normalisierung: approval_status aus status ableiten ─────────────────
  function normStatus(e: HuiEntry): string {
    if (e.approval_status) return e.approval_status as string;
    if (e.status === 'pending_review') return 'pending';
    if (e.status === 'published')      return 'approved';
    if (e.status === 'rejected')       return 'rejected';
    if (e.status === 'draft')          return 'draft';
    if (e.status === 'deleted')        return 'deleted';
    return e.status || 'unknown';
  }
  function isPending(e: HuiEntry)  { const s = normStatus(e); return s === 'pending'; }
  function isApproved(e: HuiEntry) { const s = normStatus(e); return s === 'approved'; }
  function isRejected(e: HuiEntry) { const s = normStatus(e); return s === 'rejected'; }
  function isDraft(e: HuiEntry)    { return e.status === 'draft'; }
  function isDeleted(e: HuiEntry)  { return e.status === 'deleted'; }

  const counts = useMemo<Record<TabKey, number>>(() => ({
    all:       allEntries.filter(e => isApproved(e)).length,
    published:  allEntries.filter(e => isApproved(e)).length,
    draft:     allEntries.filter(e => isDraft(e)).length,
    pending:   allEntries.filter(e => isPending(e)).length,
    rejected:  allEntries.filter(e => isRejected(e)).length,
    deleted:   allEntries.filter(e => isDeleted(e)).length,
    sensitive: allEntries.filter(e => !e.title || String(e.title).trim().length < 2).length,
  }), [allEntries]);

  // ── Gefilterte Einträge ───────────────────────────────────────────────────
  const displayEntries = useMemo(() => {
    let base: HuiEntry[] = [];
    const visibleAll = allEntries.filter(e => !localDeleted.has(e.id));
    if      (tab === 'all')       base = visibleAll.filter(e => isApproved(e));
    else if (tab === 'published')  base = visibleAll.filter(e => isApproved(e));
    else if (tab === 'draft')     base = visibleAll.filter(e => isDraft(e));
    else if (tab === 'pending')   base = visibleAll.filter(e => isPending(e));
    else if (tab === 'rejected')  base = visibleAll.filter(e => isRejected(e));
    else if (tab === 'deleted')   base = visibleAll.filter(e => isDeleted(e));
    else if (tab === 'sensitive') base = visibleAll.filter(e => !e.title || String(e.title).trim().length < 2);
    else base = visibleAll;

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
    if (ok) { showToast(`Freigegeben: ${entry.title}`, 'success'); refetchAll(); }
    else      showToast('Fehler beim Freigeben', 'error');
    setActionLoading(null);
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejectLoading(true);
    const action = rejectTarget._source === 'experiences' ? 'reject_experience' : 'reject_project';
    const ok = await entryAction(action, rejectTarget.id, { reason: rejectReason.trim() });
    if (ok) {
      showToast(`Abgelehnt: ${rejectTarget.title}`, 'info');
      refetchAll();
      setRejectTarget(null);
      setRejectReason('');
    } else {
      showToast('Fehler beim Ablehnen', 'error');
    }
    setRejectLoading(false);
  };

  const handleDelete = async (entry: HuiEntry) => {
    const action = entry._source === 'experiences' ? 'delete_experience' : 'delete_project';
    setLocalDeleted(prev => new Set([...prev, entry.id]));
    setDeleteTarget(null);
    const ok = await entryAction(action, entry.id);
    if (ok) {
      showToast('Gelöscht ✓', 'info');
      setTimeout(() => setLocalDeleted(new Set()), 3000);
    } else {
      showToast('Fehler beim Löschen', 'error');
      setLocalDeleted(prev => { const s = new Set(prev); s.delete(entry.id); return s; });
    }
  };

  // ── Context Banners ───────────────────────────────────────────────────────
  const tabBanners: Partial<Record<TabKey, { bg: string; border: string; color: string; text: string }>> = {
    pending:   { bg: 'rgba(245,158,11,0.08)',  border: '#F59E0B',     color: '#F59E0B',     text: '⏳ Diese Erlebnisse & Projekte warten auf Freigabe.' },
    rejected:  { bg: 'rgba(255,107,107,0.06)', border: 'var(--red)',  color: 'var(--red)',  text: '❌ Abgelehnte Einträge. Nutzer können sie überarbeiten.' },
    deleted:   { bg: 'rgba(255,107,107,0.06)', border: 'var(--red)',  color: 'var(--red)',  text: '🗑 Gelöschte Einträge.' },
    sensitive: { bg: 'rgba(247,183,49,0.08)',  border: 'var(--gold)', color: 'var(--gold)', text: '⚠️ Einträge ohne Titel oder Pflichtfelder.' },
  };
  const banner = tabBanners[tab];

  const fieldStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
    outline: 'none', fontFamily: 'var(--font-body)',
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout
      employeeMode={true}
      title="Erlebnisse & Projekte"
      headerActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {counts.pending > 0 && (
            <button onClick={() => setTab('pending')} style={{
              fontSize: 11, background: 'rgba(245,158,11,0.12)', color: '#F59E0B',
              padding: '3px 10px', borderRadius: 20, border: '1px solid #F59E0B',
              fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}>
              ⏳ {counts.pending} eingereicht
            </button>
          )}
          <span style={{ fontSize: 11, color: 'var(--green)', background: 'rgba(81,207,102,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(81,207,102,0.2)' }}>● Live</span>
          <button onClick={refetchAll} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>↻</button>
        </div>
      }
    >
      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 16 }} className="grid-6">
        {([
          { label: 'Gesamt',      value: loading ? '…' : fmt(counts.published + counts.draft), color: 'var(--accent)'     },
          { label: 'Approved',    value: loading ? '…' : fmt(counts.published),                color: 'var(--green)'      },
          { label: 'Draft',       value: loading ? '…' : fmt(counts.draft),                   color: 'var(--gold)'       },
          { label: 'Eingereicht', value: loading ? '…' : fmt(counts.pending),                 color: '#F59E0B'           },
          { label: 'Abgelehnt',   value: loading ? '…' : fmt(counts.rejected),                color: 'var(--red)'        },
          { label: 'Gelöscht',    value: loading ? '…' : fmt(counts.deleted),                 color: 'var(--text-muted)' },
        ] as { label: string; value: string; color: string }[]).map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Tab Bar ── */}
      <TabBar tab={tab} setTab={setTab} counts={counts} />

      {/* ── Context Banner ── */}
      {banner && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: banner.bg, border: `1px solid ${banner.border}`, borderRadius: 8, fontSize: 12, color: banner.color }}>
          {banner.text}
        </div>
      )}

      {/* ── Search ── */}
      <div style={{ marginBottom: 12, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12 }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Titel, Kategorie oder Beschreibung suchen…"
          style={{ ...fieldStyle, paddingLeft: 30, boxSizing: 'border-box' }} />
      </div>

      {/* ── Tabelle ── */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-primary)' }}>
              {['Titel', 'Typ', 'Status', 'Preis/Wert', 'Kategorie', 'Erstellt', 'Aktionen'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--border)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [...Array(5)].map((_, i) => <Skeleton key={i} />)}
            {!loading && displayEntries.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🌿</div>
                  <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>Keine Einträge</div>
                  <div style={{ fontSize: 12 }}>{search ? `Keine Treffer für "${search}"` : 'In dieser Kategorie gibt es noch keine Einträge.'}</div>
                </td>
              </tr>
            )}
            {!loading && displayEntries.map(entry => (
              <tr key={entry.id}
                style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <td style={{ padding: '10px 12px', maxWidth: 260 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.title || '(kein Titel)'}
                  </div>
                  {isUpdated(entry) && <span style={{ fontSize: 9, color: '#F59E0B', fontWeight: 700 }}>↻ AKTUALISIERT</span>}
                  {entry.rejection_reason && (
                    <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      ❌ {String(entry.rejection_reason)}
                    </div>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}><SourceBadge source={entry._source} /></td>
                <td style={{ padding: '10px 12px' }}><StatusBadge entry={entry} /></td>
                <td style={{ padding: '10px 12px', color: entry.price ? 'var(--green)' : 'var(--text-muted)', fontWeight: entry.price ? 600 : 400 }}>
                  {entry.price ? `€${Number(entry.price).toLocaleString('de-DE')}` : '—'}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>{entry.category || '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {timeAgo((entry.last_submitted_at || entry.created_at) as string)}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <button onClick={() => { setSelected(entry); setShowDetail(true); }}
                      style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      Detail
                    </button>
                    {entry.status === 'pending' && (
                      <button disabled={actionLoading === entry.id} onClick={() => handleApprove(entry)}
                        style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(81,207,102,0.12)', border: '1px solid var(--green)', color: 'var(--green)', cursor: 'pointer', opacity: actionLoading === entry.id ? 0.5 : 1 }}>
                        {actionLoading === entry.id ? '…' : '✅ Freigeben'}
                      </button>
                    )}
                    {entry.status === 'pending' && (
                      <button onClick={() => { setRejectTarget(entry); setRejectReason(''); }}
                        style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', cursor: 'pointer' }}>
                        ❌ Ablehnen
                      </button>
                    )}
                    {entry.status !== 'deleted' && (
                      <button onClick={() => setDeleteTarget(entry)}
                        style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        🗑
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Detail Modal — exakt wie Werke & Content ── */}
      <Modal
        open={showDetail && selected !== null}
        title={selected !== null ? `${selected._source === 'experiences' ? '🌿 Erlebnis' : '📌 Projekt'}: ${selected.title || 'Kein Titel'}` : ''}
        width={700}
        onClose={() => setShowDetail(false)}
        footer={selected !== null ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Button variant="ghost" onClick={() => setShowDetail(false)}>Schließen</Button>
            {(isPending(selected) || normEntryStatus(selected) === 'pending') && (
              <Button variant="primary" onClick={() => { handleApprove(selected); setShowDetail(false); }}>✅ Freigeben</Button>
            )}
            {(isPending(selected) || normEntryStatus(selected) === 'pending') && (
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
        {selected !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* UPDATE-Banner */}
            {isUpdated(selected) && (
              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid #F59E0B', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>↻</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', marginBottom: 2 }}>Update eines bereits eingereichten Eintrags</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Der Nutzer hat diesen Eintrag nach einer Ablehnung überarbeitet und erneut eingereicht.
                    {selected.last_submitted_at && ` Letzte Einreichung: ${new Date(selected.last_submitted_at as string).toLocaleString('de-DE')}`}
                  </div>
                </div>
              </div>
            )}

            {/* Pending-Banner */}
            {isPending(selected) && !isUpdated(selected) && (
              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 8, fontSize: 12, color: '#F59E0B' }}>
                ⏳ Erste Einreichung — wartet auf Freigabe.
              </div>
            )}

            {/* Ablehnungs-Banner */}
            {isRejected(selected) && (
              <div style={{ padding: '10px 14px', background: 'rgba(255,107,107,0.06)', border: '1px solid var(--red)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>❌ Abgelehnter Eintrag</div>
                {selected.rejection_reason && (
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Ablehnungsgrund: </span>{String(selected.rejection_reason)}
                  </div>
                )}
              </div>
            )}

            {/* Cover-Bild */}
            {(() => {
              const cover = (selected as Record<string,unknown>).cover_url as string | undefined;
              const imgs: string[] = (() => {
                try { const p = JSON.parse((selected as Record<string,unknown>).images as string || '[]'); return Array.isArray(p) ? p.map((x: Record<string,unknown>) => x.url || x).filter(Boolean) as string[] : []; } catch { return []; }
              })();
              const all = cover ? [cover, ...imgs.filter(u => u !== cover)] : imgs;
              return all.length > 0 ? (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                  {all.slice(0, 5).map((url, i) => (
                    <div key={i} style={{ flexShrink: 0, width: i===0?180:80, height: i===0?120:80, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-tertiary)', border: `${i===0?2:1}px solid ${i===0?'var(--accent)':'var(--border)'}` }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }}/>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ height: 70, background: 'var(--bg-tertiary)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12, border: '1px solid var(--border)' }}>📷 Kein Bild</div>
              );
            })()}

            {/* Info-Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([
                ['Typ',             selected._source === 'experiences' ? 'Erlebnis' : 'Projekt'],
                ['Status (DB)',     String(selected.status || '—')],
                ['Freigabe-Status', normEntryStatus(selected)],
                ['Kategorie',       String(selected.category || '—')],
                ['Format',          String((selected as Record<string,unknown>).format || '—')],
                ['Preis',           selected.price ? `€${Number(selected.price).toLocaleString('de-DE')} ${(selected as Record<string,unknown>).price_per || ''}`.trim() : '—'],
                ['Max. Teilnehmer', String((selected as Record<string,unknown>).max_participants || '—')],
                ['Sichtbarkeit',    String((selected as Record<string,unknown>).visibility || '—')],
                ['Standort',        String((selected as Record<string,unknown>).location_text || '—')],
                ['Datum',           String((selected as Record<string,unknown>).date || '—')],
                ['Erstellt',        timeAgo(selected.created_at)],
                ['Eingereicht',     timeAgo(selected.last_submitted_at as string)],
                ['User-ID',         String(selected.user_id || '—').slice(0, 18) + '…'],
                ['Eintrag-ID',      String(selected.id || '—').slice(0, 18) + '…'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ padding: '7px 10px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, wordBreak: 'break-all' }}>{v}</div>
                </div>
              ))}
            </div>

            {selected.description && (
              <div style={{ padding: '7px 10px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Beschreibung</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{String(selected.description)}</div>
              </div>
            )}

            {(selected as Record<string,unknown>).caption && (
              <div style={{ padding: '7px 10px', background: 'var(--bg-tertiary)', borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Caption</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{str((selected as Record<string,unknown>).caption)}</div>
              </div>
            )}

          </div>
        )}
      </Modal>

      {/* ── Reject Modal — identisch zu Werke & Content ── */}
      <Modal
        open={rejectTarget !== null}
        title={rejectTarget !== null ? `❌ Ablehnen: „${rejectTarget.title}"` : ''}
        onClose={() => { setRejectTarget(null); setRejectReason(''); }}
      >
        {rejectTarget !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Info-Box */}
            <div style={{ background: 'rgba(255,107,107,0.06)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--red)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>„{rejectTarget.title || 'Dieser Eintrag'}"</strong> wird als abgelehnt markiert.
              Der Nutzer erhält eine Benachrichtigung im Resonanzzentrum mit dem Ablehnungsgrund.
            </div>
            {/* Grund-Eingabe */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Ablehnungsgrund <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <textarea
                autoFocus
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="z. B. Inhalte entsprechen nicht den Community-Richtlinien. Bitte überarbeite den Titel und die Beschreibung…"
                rows={4}
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'var(--bg-primary)', border: `1px solid ${rejectReason.trim() ? 'var(--border)' : 'var(--red)'}`,
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
                  resize: 'vertical', outline: 'none', fontFamily: 'var(--font-body)',
                  boxSizing: 'border-box', transition: 'border-color 0.2s',
                }}
              />
              {!rejectReason.trim() && (
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--red)' }}>Pflichtfeld — Grund ist erforderlich</p>
              )}
            </div>
            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="danger" disabled={!rejectReason.trim() || rejectLoading} onClick={handleRejectSubmit}>
                {rejectLoading ? '⏳ Wird abgelehnt…' : '❌ Ablehnen & Nutzer benachrichtigen'}
              </Button>
              <Button variant="ghost" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>Abbrechen</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm ── */}
      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget !== null ? `Löschen: ${deleteTarget.title}` : ''}
        message="Der Eintrag wird als gelöscht markiert und ist nicht mehr sichtbar."
        confirmLabel="Löschen"
        onConfirm={() => { if (deleteTarget !== null) handleDelete(deleteTarget); }}
      />

    </DashboardLayout>
  );
}
