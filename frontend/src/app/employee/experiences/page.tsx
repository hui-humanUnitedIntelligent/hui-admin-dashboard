// frontend/src/app/employee/experiences/page.tsx
// ── Erlebnisse & Projekte — vollständige Live-Implementierung ─────────────
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
type TabKey = 'all' | 'pending' | 'approved' | 'rejected' | 'draft' | 'deleted' | 'sensitive';

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('de-DE'); }
function timeAgo(iso: string | undefined) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Heute';
  if (days < 30)  return `Vor ${days}d`;
  return new Date(iso).toLocaleDateString('de-DE');
}
function isUpdate(entry: HuiEntry) {
  if (!entry.last_submitted_at || !entry.created_at) return false;
  return new Date(entry.last_submitted_at).getTime() > new Date(entry.created_at).getTime() + 5000;
}

// ── API Action ─────────────────────────────────────────────────────────────
async function entryAction(
  action: string,
  entryId: string,
  data: Record<string, unknown> = {}
) {
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
function StatusBadge({ entry }: { entry: HuiEntry }) {
  const upd = isUpdate(entry);
  if (entry.status === 'approved')  return <><Badge variant="success" dot>✅ Approved</Badge>{upd && <Badge variant="warning"> Aktualisiert</Badge>}</>;
  if (entry.status === 'pending')   return <><Badge variant="warning" dot>⏳ Eingereicht</Badge>{upd && <span style={{fontSize:10,color:'#F59E0B',marginLeft:4}}>↻ Aktualisiert</span>}</>;
  if (entry.status === 'rejected')  return <Badge variant="danger"  dot>❌ Abgelehnt</Badge>;
  if (entry.status === 'draft')     return <Badge variant="neutral" dot>Draft</Badge>;
  if (entry.status === 'deleted')   return <Badge variant="neutral">🗑 Gelöscht</Badge>;
  return <Badge variant="neutral">{entry.status}</Badge>;
}

// ── Source Badge ───────────────────────────────────────────────────────────
function SourceBadge({ source }: { source: string }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: source === 'experiences' ? 'rgba(78,205,196,0.12)' : 'rgba(147,112,219,0.12)',
      color: source === 'experiences' ? 'var(--accent)' : '#9370DB',
      border: `1px solid ${source === 'experiences' ? 'rgba(78,205,196,0.3)' : 'rgba(147,112,219,0.3)'}`,
      letterSpacing: '0.5px', textTransform: 'uppercase',
    }}>
      {source === 'experiences' ? 'Erlebnis' : 'Projekt'}
    </span>
  );
}

// ── Skeleton Row ───────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <tr>
      {[...Array(7)].map((_, i) => (
        <td key={i} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ height: 11, background: 'var(--bg-tertiary)', borderRadius: 4, animation: 'pulse 2s ease-in-out infinite', width: i === 0 ? '70%' : '50%' }} />
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
    { key: 'pending',   label: 'Eingereicht', icon: '⏳', danger: false },
    { key: 'approved',  label: 'Approved',    icon: '●'  },
    { key: 'rejected',  label: 'Abgelehnt',   icon: '✕', danger: true  },
    { key: 'draft',     label: 'Draft',       icon: ''   },
    { key: 'deleted',   label: 'Gelöscht',    icon: '🗑' },
    { key: 'sensitive', label: 'Sensitiv',    icon: '⚠️', danger: true  },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 10, flexWrap: 'wrap' }}>
      {tabs.map(({ key, label, icon, danger }) => {
        const active = tab === key;
        const cnt    = counts[key];
        return (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 400,
            border: `1px solid ${active ? (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)') : 'var(--border)'}`,
            background: active ? (key === 'pending' ? 'rgba(245,158,11,0.12)' : danger ? 'var(--red-dim)' : 'var(--accent-dim)') : 'var(--bg-secondary)',
            color: active ? (key === 'pending' ? '#F59E0B' : danger ? 'var(--red)' : 'var(--accent)') : 'var(--text-secondary)',
            cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
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

// ── Main Page ──────────────────────────────────────────────────────────────
export default function EmployeeErlebnisseProjektePage() {
  const [tab,    setTab]    = useState<TabKey>('all');
  const [search, setSearch] = useState('');

  // Detail Modal
  const [selected,        setSelected]        = useState<HuiEntry | null>(null);
  const [showDetail,      setShowDetail]      = useState(false);
  // Reject Modal
  const [rejectTarget,    setRejectTarget]    = useState<HuiEntry | null>(null);
  const [rejectReason,    setRejectReason]    = useState('');
  const [rejectLoading,   setRejectLoading]   = useState(false);
  // Delete Confirm
  const [deleteTarget,    setDeleteTarget]    = useState<HuiEntry | null>(null);
  // Action loading
  const [actionLoading,   setActionLoading]   = useState<string | null>(null);

  // ── Daten laden (alle gleichzeitig für Counts) ──────────────────────────
  const { entries: allEntries,      loading,          refetch: refetchAll      } = useExperiencesAndProjects({ status: 'all',      limit: 1000, refreshInterval: 30000 });
  const { entries: pendingEntries,  refetch: refPend  } = useExperiencesAndProjects({ status: 'pending',  limit: 500 });
  const { entries: rejectedEntries, refetch: refRej   } = useExperiencesAndProjects({ status: 'rejected', limit: 500 });
  const { entries: deletedEntries,  refetch: refDel   } = useExperiencesAndProjects({ status: 'deleted',  limit: 500 });

  const refetchAll_ = useCallback(() => {
    refetchAll(); refPend(); refRej(); refDel();
  }, [refetchAll, refPend, refRej, refDel]);

  // ── Counts ─────────────────────────────────────────────────────────────
  const counts = useMemo<Record<TabKey, number>>(() => {
    const approved  = allEntries.filter(e => e.status === 'approved').length;
    const draft     = allEntries.filter(e => e.status === 'draft').length;
    const pending   = pendingEntries.length;
    const rejected  = rejectedEntries.length;
    const deleted   = deletedEntries.length;
    const sensitive = allEntries.filter(e => !e.title || String(e.title).trim().length < 2).length;
    return {
      all:       approved + draft,
      approved,
      draft,
      pending,
      rejected,
      deleted,
      sensitive,
    };
  }, [allEntries, pendingEntries, rejectedEntries, deletedEntries]);

  // ── Aktuell angezeigte Einträge nach Tab ────────────────────────────────
  const displayEntries = useMemo(() => {
    let base: HuiEntry[] = [];
    if      (tab === 'all')       base = allEntries.filter(e => e.status === 'approved' || e.status === 'draft');
    else if (tab === 'approved')  base = allEntries.filter(e => e.status === 'approved');
    else if (tab === 'draft')     base = allEntries.filter(e => e.status === 'draft');
    else if (tab === 'pending')   base = pendingEntries;
    else if (tab === 'rejected')  base = rejectedEntries;
    else if (tab === 'deleted')   base = deletedEntries;
    else if (tab === 'sensitive') base = allEntries.filter(e => !e.title || String(e.title).trim().length < 2);
    else base = allEntries;

    if (search.trim()) {
      const q = search.toLowerCase();
      base = base.filter(e =>
        (e.title       || '').toLowerCase().includes(q) ||
        (e.category    || '').toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q)
      );
    }
    return base;
  }, [tab, search, allEntries, pendingEntries, rejectedEntries, deletedEntries]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleApprove = async (entry: HuiEntry) => {
    setActionLoading(entry.id);
    const action = entry._source === 'experiences' ? 'approve_experience' : 'approve_project';
    const ok = await entryAction(action, entry.id);
    if (ok) {
      showToast(`✅ „${entry.title}" wurde freigegeben`, 'success');
      refetchAll_();
    } else {
      showToast('Fehler beim Freigeben', 'error');
    }
    setActionLoading(null);
  };

  const handleRejectSubmit = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejectLoading(true);
    const action = rejectTarget._source === 'experiences' ? 'reject_experience' : 'reject_project';
    const ok = await entryAction(action, rejectTarget.id, { reason: rejectReason.trim() });
    if (ok) {
      showToast(`❌ „${rejectTarget.title}" wurde abgelehnt`, 'info');
      refetchAll_();
      setRejectTarget(null);
      setRejectReason('');
    } else {
      showToast('Fehler beim Ablehnen', 'error');
    }
    setRejectLoading(false);
  };

  const handleDelete = async (entry: HuiEntry) => {
    const action = entry._source === 'experiences' ? 'delete_experience' : 'delete_project';
    const ok = await entryAction(action, entry.id);
    if (ok) {
      showToast(`🗑 Gelöscht`, 'info');
      refetchAll_();
    } else {
      showToast('Fehler beim Löschen', 'error');
    }
    setDeleteTarget(null);
  };

  // ── Context Banners ──────────────────────────────────────────────────────
  const tabBanners: Partial<Record<TabKey, { bg: string; border: string; color: string; text: string }>> = {
    pending:  { bg: 'rgba(245,158,11,0.08)', border: '#F59E0B',      color: '#F59E0B',      text: '⏳ Diese Erlebnisse & Projekte warten auf Freigabe. Bitte prüfen und freigeben oder ablehnen.' },
    rejected: { bg: 'rgba(255,107,107,0.06)', border: 'var(--red)',  color: 'var(--red)',   text: '❌ Abgelehnte Einträge. Nutzer können sie überarbeiten und erneut einreichen.' },
    deleted:  { bg: 'rgba(255,107,107,0.06)', border: 'var(--red)',  color: 'var(--red)',   text: '🗑 Gelöschte Einträge.' },
    sensitive:{ bg: 'rgba(247,183,49,0.08)',  border: 'var(--gold)', color: 'var(--gold)',  text: '⚠️ Einträge ohne Titel oder mit fehlenden Pflichtfeldern. Bitte prüfen.' },
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
            <button onClick={() => setTab('pending')} style={{ fontSize: 11, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', padding: '3px 10px', borderRadius: 20, border: '1px solid #F59E0B', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              ⏳ {counts.pending} eingereicht
            </button>
          )}
          <span style={{ fontSize: 11, color: 'var(--green)', background: 'rgba(81,207,102,0.1)', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(81,207,102,0.2)' }}>● Live</span>
          <button onClick={refetchAll_} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻</button>
        </div>
      }
    >
      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 16 }} className="grid-6">
        {[
          { label: 'Gesamt',      value: loading ? '…' : fmt(counts.approved + counts.draft), color: 'var(--accent)'     },
          { label: 'Approved',    value: loading ? '…' : fmt(counts.approved),                color: 'var(--green)'      },
          { label: 'Draft',       value: loading ? '…' : fmt(counts.draft),                   color: 'var(--gold)'       },
          { label: 'Eingereicht', value: loading ? '…' : fmt(counts.pending),                 color: '#F59E0B'           },
          { label: 'Abgelehnt',   value: loading ? '…' : fmt(counts.rejected),                color: 'var(--red)'        },
          { label: 'Gelöscht',    value: loading ? '…' : fmt(counts.deleted),                 color: 'var(--text-muted)' },
        ].map(({ label, value, color }) => (
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
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Keine Einträge</div>
                  <div style={{ fontSize: 12 }}>{search ? `Keine Treffer für „${search}"` : 'In dieser Kategorie gibt es noch keine Einträge.'}</div>
                </td>
              </tr>
            )}
            {!loading && displayEntries.map(entry => (
              <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {/* Titel */}
                <td style={{ padding: '10px 12px', maxWidth: 260 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.title || '(kein Titel)'}
                  </div>
                  {isUpdate(entry) && (
                    <span style={{ fontSize: 9, color: '#F59E0B', fontWeight: 700, letterSpacing: '0.5px' }}>↻ AKTUALISIERT</span>
                  )}
                  {entry.rejection_reason && (
                    <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      ❌ {entry.rejection_reason}
                    </div>
                  )}
                </td>
                {/* Typ */}
                <td style={{ padding: '10px 12px' }}>
                  <SourceBadge source={entry._source} />
                </td>
                {/* Status */}
                <td style={{ padding: '10px 12px' }}>
                  <StatusBadge entry={entry} />
                </td>
                {/* Preis */}
                <td style={{ padding: '10px 12px', color: entry.price ? 'var(--green)' : 'var(--text-muted)', fontWeight: entry.price ? 600 : 400 }}>
                  {entry.price ? `€${Number(entry.price).toLocaleString('de-DE')}` : '—'}
                </td>
                {/* Kategorie */}
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                  {entry.category || '—'}
                </td>
                {/* Erstellt */}
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {timeAgo(entry.last_submitted_at || entry.created_at)}
                </td>
                {/* Aktionen */}
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {/* Details */}
                    <button onClick={() => { setSelected(entry); setShowDetail(true); }} style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 11,
                      background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)', cursor: 'pointer',
                    }}>Detail</button>

                    {/* Freigeben — nur bei pending */}
                    {entry.status === 'pending' && (
                      <button
                        disabled={actionLoading === entry.id}
                        onClick={() => handleApprove(entry)}
                        style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: 'rgba(81,207,102,0.12)', border: '1px solid var(--green)',
                          color: 'var(--green)', cursor: 'pointer',
                          opacity: actionLoading === entry.id ? 0.5 : 1,
                        }}>
                        {actionLoading === entry.id ? '…' : '✅ Freigeben'}
                      </button>
                    )}

                    {/* Ablehnen — bei pending */}
                    {entry.status === 'pending' && (
                      <button onClick={() => { setRejectTarget(entry); setRejectReason(''); }} style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: 'var(--red-dim)', border: '1px solid var(--red)',
                        color: 'var(--red)', cursor: 'pointer',
                      }}>❌ Ablehnen</button>
                    )}

                    {/* Löschen */}
                    {entry.status !== 'deleted' && (
                      <button onClick={() => setDeleteTarget(entry)} style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 11,
                        background: 'transparent', border: '1px solid var(--border)',
                        color: 'var(--text-muted)', cursor: 'pointer',
                      }}>🗑</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Detail Modal ── */}
      <Modal
        open={showDetail && !!selected}
        title={`${selected._source === 'experiences' ? '🌿 Erlebnis' : '📌 Projekt'}: ${selected.title}`} onClose={() => setShowDetail(false)}
      >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['Typ',        selected._source === 'experiences' ? 'Erlebnis' : 'Projekt'],
                ['Status',     selected.status],
                ['Kategorie',  selected.category || '—'],
                ['Preis',      selected.price ? `€${Number(selected.price).toLocaleString('de-DE')}` : '—'],
                ['Erstellt',   selected.created_at ? new Date(selected.created_at).toLocaleDateString('de-DE') : '—'],
                ['Aktualisiert', selected.last_submitted_at ? new Date(selected.last_submitted_at).toLocaleDateString('de-DE') : '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{v}</div>
                </div>
              ))}
            </div>
            {selected.description && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Beschreibung</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, background: 'var(--bg-primary)', borderRadius: 8, padding: 12 }}>{selected.description}</div>
              </div>
            )}
            {selected.rejection_reason && (
              <div style={{ padding: 12, background: 'rgba(255,107,107,0.06)', border: '1px solid var(--red)', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, marginBottom: 4 }}>❌ ABLEHNUNGSGRUND</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selected.rejection_reason}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, paddingTop: 6 }}>
              {selected.status === 'pending' && (
                <>
                  <Button variant="primary" onClick={() => { handleApprove(selected); setShowDetail(false); }}>✅ Freigeben</Button>
                  <Button variant="danger" onClick={() => { setShowDetail(false); setRejectTarget(selected); setRejectReason(''); }}>❌ Ablehnen</Button>
                </>
              )}
              <Button variant="ghost" onClick={() => setShowDetail(false)}>Schließen</Button>
            </div>
          </div>
      </Modal>

      {/* ── Reject Modal ── */}
      <Modal
        open={!!rejectTarget}
        title={`❌ „${rejectTarget.title}" ablehnen`} onClose={() => setRejectTarget(null)}
      >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Bitte gib einen Ablehnungsgrund ein. Der Nutzer wird per Benachrichtigung informiert.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="z. B. Inhalte entsprechen nicht den Community-Richtlinien…"
              rows={4}
              style={{
                width: '100%', padding: '10px 12px',
                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
                resize: 'vertical', outline: 'none', fontFamily: 'var(--font-body)',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="danger"
                disabled={!rejectReason.trim() || rejectLoading}
                onClick={handleRejectSubmit}
              >
                {rejectLoading ? 'Wird abgelehnt…' : '❌ Ablehnen & Nutzer benachrichtigen'}
              </Button>
              <Button variant="ghost" onClick={() => setRejectTarget(null)}>Abbrechen</Button>
            </div>
          </div>
      </Modal>

      {/* ── Delete Confirm ── */}
        <ConfirmModal
          open={!!deleteTarget}
          title={`🗑 „${deleteTarget.title}" löschen?`}
          message="Der Eintrag wird als gelöscht markiert und ist nicht mehr öffentlich sichtbar."
          confirmLabel="Löschen"
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />

    </DashboardLayout>
  );
}
