// frontend/src/components/views/MomenteView.tsx
// MOMENTE-REPORTS-001: Community-Verwaltung für Momente-Posts
// Zeigt alle Momente (öffentlich / gemeldet / entfernt) mit Moderationsaktionen
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { getServiceClient } from '@/app/lib/supabase-server';

// ── Typen ─────────────────────────────────────────────────────────────────
interface MomentEntry {
  id:                  string;
  initiator_id:        string;
  initiator_name:      string | null;
  initiator_username:  string | null;
  initiator_avatar:    string | null;
  caption:             string | null;
  moment_type:         string | null;
  status:              string;
  created_at:          string;
  report_count:        number;
}

type TabKey = 'all' | 'public' | 'reported' | 'deleted';

// ── Hilfsfunktionen ────────────────────────────────────────────────────────
function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)   return 'Gerade eben';
  if (m < 60)  return `Vor ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `Vor ${h}h`;
  const d = Math.floor(h / 24);
  return `Vor ${d}d`;
}

function statusColor(s: string) {
  if (s === 'reported') return { bg: 'rgba(244,115,85,0.12)', color: '#C0451A', border: 'rgba(244,115,85,0.30)' };
  if (s === 'deleted')  return { bg: 'rgba(26,26,46,0.07)',   color: '#666',    border: 'rgba(26,26,46,0.14)' };
  return                       { bg: 'rgba(13,196,181,0.10)', color: '#0AA090', border: 'rgba(13,196,181,0.25)' };
}

function statusLabel(s: string) {
  if (s === 'reported') return 'Gemeldet';
  if (s === 'deleted')  return 'Entfernt';
  return 'Öffentlich';
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────
export function MomenteView({ role }: { role: 'superadmin' | 'employee' }) {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role ?? 'employee';

  const [moments,  setMoments]  = useState<MomentEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<TabKey>('all');
  const [search,   setSearch]   = useState('');
  const [toast,    setToast]    = useState('');
  const [selected, setSelected] = useState<MomentEntry | null>(null);
  const [counts,   setCounts]   = useState({ all: 0, public: 0, reported: 0, deleted: 0 });

  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: tab === 'all' ? 'all' : tab, limit: '200' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/momente?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setMoments(Array.isArray(d.entries) ? d.entries : []);
      setCounts({
        all:      d.counts?.all      ?? d.total ?? 0,
        public:   d.counts?.public   ?? 0,
        reported: d.counts?.reported ?? 0,
        deleted:  d.counts?.deleted  ?? 0,
      });
    } catch (e) {
      console.error('[momente]', e);
      setMoments([]);
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id: string, action: 'delete' | 'restore') {
    try {
      const res = await fetch('/api/momente', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        showToast(action === 'delete' ? '🗑️ Moment entfernt' : '✅ Moment wiederhergestellt');
        load(); setSelected(null);
      } else showToast('❌ Fehler');
    } catch { showToast('Netzwerkfehler'); }
  }

  // ── Style-Konstanten ────────────────────────────────────────────────────
  const thS: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '0.6px',
    color: 'var(--text-muted)', fontWeight: 600,
    borderBottom: '1px solid var(--border)',
  };
  const tdS: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle', fontSize: 13 };

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'all',      label: `Alle ${counts.all}` },
    { key: 'public',   label: `Öffentlich ${counts.public}` },
    { key: 'reported', label: `Gemeldet ${counts.reported}` },
    { key: 'deleted',  label: `Entfernt ${counts.deleted}` },
  ];

  const filtered = moments.filter(m =>
    !search ||
    (m.caption       || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.initiator_name|| '').toLowerCase().includes(search.toLowerCase()) ||
    (m.initiator_username || '').toLowerCase().includes(search.toLowerCase())
  );

  const content = (
    <>
      {toast && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:9999, background:'var(--accent)', color:'#fff', padding:'10px 20px', borderRadius:8, fontSize:13, fontWeight:600 }}>
          {toast}
        </div>
      )}

      <PageHeader
        title="Momente"
        subtitle="Community-Moderation · Gemeldete & öffentliche Momente"
        actionsRole={userRole as 'superadmin' | 'employee'}
        userRole={userRole}
        actions={
          <button onClick={load} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
            ↺ Refresh
          </button>
        }
      />

      {/* KPI-Kacheln */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Gesamt',     value:counts.all,      color:'var(--accent)' },
          { label:'Öffentlich', value:counts.public,   color:'#0AA090' },
          { label:'Gemeldet',   value:counts.reported, color:'#C0451A' },
          { label:'Entfernt',   value:counts.deleted,  color:'var(--text-muted)' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
            <div style={{ fontSize:26, fontWeight:800, color:k.color }}>{k.value}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Suche + Tabs */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Suche nach Caption, Name, Nickname…"
          style={{ flex:1, minWidth:200, padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--text-primary)', fontSize:13, outline:'none' }}
        />
        <div style={{ display:'flex', gap:6 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)',
                background: tab === t.key ? 'var(--accent)' : 'var(--bg-secondary)',
                color:      tab === t.key ? '#fff' : 'var(--text-secondary)',
                fontSize:12, fontWeight: tab === t.key ? 600 : 400, cursor:'pointer',
              }}
            >
              {t.label}
              {t.key === 'reported' && counts.reported > 0 && (
                <span style={{ marginLeft:6, background:'#ef4444', color:'#fff', borderRadius:99, padding:'0 5px', fontSize:10, fontWeight:700 }}>
                  {counts.reported}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tabelle */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Lade…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Keine Momente gefunden.</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead style={{ background:'var(--bg-secondary)' }}>
              <tr>
                <th style={thS}>Ersteller</th>
                <th style={thS}>Caption</th>
                <th style={thS}>Typ</th>
                <th style={thS}>Status</th>
                <th style={thS}>Meldungen</th>
                <th style={thS}>Erstellt</th>
                <th style={thS}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const sc   = statusColor(m.status);
                const isOdd = i % 2 === 0;
                return (
                  <tr key={m.id}
                    onClick={() => setSelected(m)}
                    style={{ background: isOdd ? 'var(--bg-card)' : 'var(--bg-secondary)', cursor:'pointer', transition:'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = isOdd ? 'var(--bg-card)' : 'var(--bg-secondary)')}
                  >
                    {/* Ersteller */}
                    <td style={tdS}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:99, background:'rgba(13,196,181,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#0AA090', flexShrink:0 }}>
                          {(m.initiator_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight:500, color:'var(--text-primary)' }}>{m.initiator_name || '—'}</div>
                          {m.initiator_username && <div style={{ fontSize:11, color:'var(--text-muted)' }}>@{m.initiator_username}</div>}
                        </div>
                      </div>
                    </td>

                    {/* Caption */}
                    <td style={{ ...tdS, maxWidth:220 }}>
                      <span style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text-secondary)' }}>
                        {m.caption || <em style={{ color:'var(--text-muted)' }}>Kein Text</em>}
                      </span>
                    </td>

                    {/* Typ */}
                    <td style={tdS}>
                      <span style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.3px' }}>
                        {m.moment_type || '—'}
                      </span>
                    </td>

                    {/* Status-Badge */}
                    <td style={tdS}>
                      <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:sc.bg, color:sc.color, border:`1px solid ${sc.border}` }}>
                        {statusLabel(m.status)}
                      </span>
                    </td>

                    {/* Meldungen */}
                    <td style={tdS}>
                      {m.report_count > 0 ? (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontWeight:700, color: m.report_count >= 5 ? '#C0451A' : m.report_count >= 3 ? '#E08040' : 'var(--text-secondary)' }}>
                          ⚑ {m.report_count}
                        </span>
                      ) : (
                        <span style={{ color:'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Datum */}
                    <td style={{ ...tdS, color:'var(--text-muted)', fontSize:12 }}>
                      {timeAgo(m.created_at)}
                    </td>

                    {/* Aktionen */}
                    <td style={tdS} onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:6 }}>
                        {m.status !== 'deleted' && (
                          <button
                            onClick={() => handleAction(m.id, 'delete')}
                            style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(220,50,50,0.25)', background:'rgba(220,50,50,0.07)', color:'#C0451A', fontSize:11, fontWeight:600, cursor:'pointer' }}
                          >
                            Entfernen
                          </button>
                        )}
                        {m.status === 'deleted' && (
                          <button
                            onClick={() => handleAction(m.id, 'restore')}
                            style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(13,196,181,0.25)', background:'rgba(13,196,181,0.07)', color:'#0AA090', fontSize:11, fontWeight:600, cursor:'pointer' }}
                          >
                            Wiederherstellen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail-Modal */}
      {selected && (
        <div
          style={{ position:'fixed', inset:0, zIndex:10500, background:'rgba(15,20,35,0.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ background:'var(--bg-card)', borderRadius:16, padding:28, maxWidth:520, width:'100%', boxShadow:'0 24px 80px rgba(0,0,0,0.28)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', margin:0 }}>
                💬 Moment-Details
              </h2>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-muted)' }}>✕</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[
                { l:'Ersteller',  v: selected.initiator_name  || '—' },
                { l:'Nickname',   v: selected.initiator_username ? `@${selected.initiator_username}` : '—' },
                { l:'Typ',        v: selected.moment_type     || '—' },
                { l:'Status',     v: statusLabel(selected.status) },
                { l:'Meldungen',  v: String(selected.report_count) },
                { l:'Erstellt',   v: timeAgo(selected.created_at) },
              ].map(({ l, v }) => (
                <div key={l} style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'10px 14px' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4 }}>{l}</div>
                  <div style={{ fontSize:13, color:'var(--text-primary)', fontWeight:500 }}>{v}</div>
                </div>
              ))}
            </div>

            {selected.caption && (
              <div style={{ marginTop:10, background:'var(--bg-secondary)', borderRadius:8, padding:'10px 14px' }}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4 }}>Caption</div>
                <div style={{ fontSize:13, color:'var(--text-primary)', lineHeight:1.5 }}>{selected.caption}</div>
              </div>
            )}

            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={() => setSelected(null)} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>
                Schließen
              </button>
              {selected.status !== 'deleted' && (
                <button onClick={() => handleAction(selected.id, 'delete')} style={{ padding:'8px 18px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  🗑️ Moment entfernen
                </button>
              )}
              {selected.status === 'deleted' && (
                <button onClick={() => handleAction(selected.id, 'restore')} style={{ padding:'8px 18px', borderRadius:8, border:'none', background:'var(--accent)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  ✅ Wiederherstellen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  return role === 'superadmin'
    ? <DashboardLayout>{content}</DashboardLayout>
    : <>{content}</>;
}
