// frontend/src/components/views/MomenteView.tsx
// MOMENTE-REPORTS-001 v2: beitraege hat kein status-Feld
// Alle Momente live anzeigen mit vollständigen Details
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';

// ── Typen ─────────────────────────────────────────────────────────────────
interface MomentEntry {
  id:                  string;
  initiator_id:        string;
  initiator_name:      string | null;
  initiator_username:  string | null;
  initiator_avatar:    string | null;
  caption:             string | null;
  moment_type:         string | null;
  moment_source:       string | null;
  src:                 string | null;
  visibility_scope:    string;
  report_count:        number;
  is_reported:         boolean;
  is_removed:          boolean;
  derived_status:      string;
  created_at:          string;
}

type TabKey = 'all' | 'public' | 'reported' | 'deleted';

// ── Helpers ────────────────────────────────────────────────────────────────
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

function typeIcon(t: string | null): string {
  if (!t) return '💬';
  if (t === 'foto')    return '📷';
  if (t === 'video')   return '🎥';
  if (t === 'gedanke') return '💭';
  return '💬';
}

function typeLabel(t: string | null): string {
  if (!t) return '—';
  if (t === 'foto')    return 'Foto';
  if (t === 'video')   return 'Video';
  if (t === 'gedanke') return 'Gedanke';
  return t;
}

function statusStyle(s: string) {
  if (s === 'reported') return { bg:'rgba(244,115,85,0.12)', color:'#C0451A', border:'rgba(244,115,85,0.30)', label:'Gemeldet' };
  if (s === 'deleted')  return { bg:'rgba(100,100,120,0.10)', color:'#777', border:'rgba(100,100,120,0.20)', label:'Entfernt' };
  return                       { bg:'rgba(13,196,181,0.10)', color:'#0AA090', border:'rgba(13,196,181,0.25)', label:'Öffentlich' };
}

function visLabel(v: string | null): string {
  if (!v || v === 'public') return 'Öffentlich';
  if (v === 'friends')      return 'Freunde';
  if (v === 'private')      return 'Privat';
  return v;
}

function isImage(src: string | null): boolean {
  if (!src) return false;
  return /\.(jpg|jpeg|png|gif|webp|avif)/i.test(src) || src.includes('supabase.co/storage');
}

function isVideo(src: string | null): boolean {
  if (!src) return false;
  return /\.(mp4|mov|webm|ogg)/i.test(src);
}

// ── Hauptkomponente ────────────────────────────────────────────────────────
export function MomenteView({ role }: { role: 'superadmin' | 'employee' }) {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role ?? 'employee';

  const [moments,  setMoments]  = useState<MomentEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<TabKey>('all');
  const [search,   setSearch]   = useState('');
  const [toast,    setToast]    = useState('');
  const [selected, setSelected] = useState<MomentEntry | null>(null);
  const [counts,   setCounts]   = useState({ all:0, public:0, reported:0, deleted:0 });

  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: tab, limit: '500' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/momente?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setMoments(Array.isArray(d.entries) ? d.entries : []);
      if (d.counts) setCounts(d.counts);
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
        showToast(action === 'delete' ? '🗑️ Moment entfernt' : '✅ Wiederhergestellt');
        setSelected(null);
        load();
      } else showToast('❌ Fehler');
    } catch { showToast('Netzwerkfehler'); }
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'all',      label: `Alle` },
    { key: 'public',   label: `Öffentlich` },
    { key: 'reported', label: `Gemeldet` },
    { key: 'deleted',  label: `Entfernt` },
  ];

  const filtered = search.trim()
    ? moments.filter(m =>
        (m.caption           || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.initiator_name    || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.initiator_username|| '').toLowerCase().includes(search.toLowerCase())
      )
    : moments;

  // ── Styles ────────────────────────────────────────────────────────────
  const thS: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '0.6px',
    color: 'var(--text-muted)', fontWeight: 600,
    borderBottom: '1px solid var(--border)',
  };
  const tdS: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle', fontSize: 13 };

  const content = (
    <>
      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:9999, background:'var(--accent)', color:'#fff', padding:'10px 20px', borderRadius:8, fontSize:13, fontWeight:600, boxShadow:'0 4px 20px rgba(0,0,0,0.2)' }}>
          {toast}
        </div>
      )}

      <PageHeader
        title="Momente"
        subtitle={`Community-Moderation · ${counts.all} Momente insgesamt`}
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
          <div key={k.label} style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
            <div style={{ fontSize:28, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
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
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {TABS.map(t => {
            const cnt = t.key === 'all' ? counts.all : t.key === 'public' ? counts.public : t.key === 'reported' ? counts.reported : counts.deleted;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)',
                  background: tab === t.key ? 'var(--accent)' : 'var(--bg-secondary)',
                  color:      tab === t.key ? '#fff' : 'var(--text-secondary)',
                  fontSize:12, fontWeight: tab === t.key ? 600 : 400, cursor:'pointer',
                  display:'flex', alignItems:'center', gap:6,
                }}
              >
                {t.label}
                <span style={{ background: tab === t.key ? 'rgba(255,255,255,0.25)' : 'var(--bg-tertiary)', borderRadius:99, padding:'0 6px', fontSize:10, fontWeight:700, color: tab === t.key ? '#fff' : 'var(--text-muted)' }}>
                  {cnt}
                </span>
                {t.key === 'reported' && counts.reported > 0 && tab !== 'reported' && (
                  <span style={{ width:7, height:7, borderRadius:99, background:'#ef4444', display:'inline-block', marginLeft:-4 }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabelle */}
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Lade Momente…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:60, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>💬</div>
            <div style={{ color:'var(--text-muted)', fontSize:14 }}>Keine Momente gefunden.</div>
            {tab !== 'all' && <div style={{ color:'var(--text-muted)', fontSize:12, marginTop:6 }}>Versuche den Tab "Alle".</div>}
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead style={{ background:'var(--bg-secondary)' }}>
              <tr>
                <th style={thS}>Ersteller</th>
                <th style={thS}>Typ</th>
                <th style={thS}>Vorschau / Caption</th>
                <th style={thS}>Sichtbarkeit</th>
                <th style={thS}>Status</th>
                <th style={thS}>Meldungen</th>
                <th style={thS}>Datum</th>
                <th style={thS}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const ss    = statusStyle(m.derived_status);
                const isOdd = i % 2 === 0;
                const initials = (m.initiator_name || m.initiator_username || '?')[0].toUpperCase();
                return (
                  <tr key={m.id}
                    onClick={() => setSelected(m)}
                    style={{ background: isOdd ? 'var(--bg-secondary)' : 'var(--bg-secondary)', cursor:'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = isOdd ? 'var(--bg-secondary)' : 'var(--bg-secondary)')}
                  >
                    {/* Ersteller */}
                    <td style={tdS}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {m.initiator_avatar ? (
                          <img src={m.initiator_avatar} alt="" style={{ width:30, height:30, borderRadius:99, objectFit:'cover', flexShrink:0 }} />
                        ) : (
                          <div style={{ width:30, height:30, borderRadius:99, background:'rgba(13,196,181,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#0AA090', flexShrink:0 }}>
                            {initials}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight:500, color:'var(--text-primary)', fontSize:13 }}>{m.initiator_name || '—'}</div>
                          {m.initiator_username && <div style={{ fontSize:11, color:'var(--text-muted)' }}>@{m.initiator_username}</div>}
                        </div>
                      </div>
                    </td>

                    {/* Typ */}
                    <td style={tdS}>
                      <span style={{ fontSize:18 }}>{typeIcon(m.moment_type)}</span>
                      <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.3px' }}>{typeLabel(m.moment_type)}</div>
                    </td>

                    {/* Vorschau + Caption */}
                    <td style={{ ...tdS, maxWidth:260 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {m.src && isImage(m.src) && (
                          <img src={m.src} alt="" style={{ width:40, height:40, borderRadius:6, objectFit:'cover', flexShrink:0, border:'1px solid var(--border)' }} />
                        )}
                        {m.src && isVideo(m.src) && (
                          <div style={{ width:40, height:40, borderRadius:6, background:'rgba(0,0,0,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🎥</div>
                        )}
                        <span style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color: m.caption ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: m.caption ? 'normal' : 'italic', fontSize:13 }}>
                          {m.caption || 'Kein Text'}
                        </span>
                      </div>
                    </td>

                    {/* Sichtbarkeit */}
                    <td style={tdS}>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>{visLabel(m.visibility_scope)}</span>
                    </td>

                    {/* Status */}
                    <td style={tdS}>
                      <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:600, background:ss.bg, color:ss.color, border:`1px solid ${ss.border}` }}>
                        {ss.label}
                      </span>
                    </td>

                    {/* Meldungen */}
                    <td style={tdS}>
                      {m.report_count > 0 ? (
                        <span style={{ fontWeight:700, color: m.report_count >= 5 ? '#C0451A' : m.report_count >= 3 ? '#E08040' : 'var(--text-secondary)', display:'flex', alignItems:'center', gap:4 }}>
                          ⚑ {m.report_count}
                        </span>
                      ) : (
                        <span style={{ color:'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Datum */}
                    <td style={{ ...tdS, color:'var(--text-muted)', fontSize:12, whiteSpace:'nowrap' }}>
                      {timeAgo(m.created_at)}
                    </td>

                    {/* Aktionen */}
                    <td style={tdS} onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:6 }}>
                        {!m.is_removed ? (
                          <button
                            onClick={() => handleAction(m.id, 'delete')}
                            style={{ padding:'4px 10px', borderRadius:6, border:'1px solid rgba(220,50,50,0.25)', background:'rgba(220,50,50,0.07)', color:'#C0451A', fontSize:11, fontWeight:600, cursor:'pointer' }}
                          >
                            Entfernen
                          </button>
                        ) : (
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

      {/* Footer */}
      {filtered.length > 0 && (
        <div style={{ marginTop:10, textAlign:'right', color:'var(--text-muted)', fontSize:11 }}>
          {filtered.length} Momente angezeigt
        </div>
      )}

      {/* Detail-Modal */}
      {selected && (() => {
        const ss = statusStyle(selected.derived_status);
        return (
          <div
            style={{ position:'fixed', inset:0, zIndex:10500, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
            onClick={() => setSelected(null)}
          >
            <div
              style={{ background:'var(--bg-secondary)', borderRadius:16, padding:28, maxWidth:560, width:'100%', boxShadow:'0 24px 80px rgba(0,0,0,0.28)', maxHeight:'90vh', overflowY:'auto' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:24 }}>{typeIcon(selected.moment_type)}</span>
                  <div>
                    <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', margin:0 }}>
                      {typeLabel(selected.moment_type)}-Moment
                    </h2>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{timeAgo(selected.created_at)}</div>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--text-muted)', lineHeight:1 }}>✕</button>
              </div>

              {/* Medien-Vorschau */}
              {selected.src && isImage(selected.src) && (
                <img src={selected.src} alt="Moment" style={{ width:'100%', maxHeight:280, objectFit:'cover', borderRadius:10, marginBottom:16, border:'1px solid var(--border)' }} />
              )}
              {selected.src && isVideo(selected.src) && (
                <video src={selected.src} controls style={{ width:'100%', maxHeight:280, borderRadius:10, marginBottom:16, border:'1px solid var(--border)' }} />
              )}

              {/* Caption */}
              {selected.caption && (
                <div style={{ background:'var(--bg-secondary)', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:14, color:'var(--text-primary)', lineHeight:1.6 }}>
                  {selected.caption}
                </div>
              )}

              {/* Details-Grid */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                {[
                  { l:'Ersteller',    v: selected.initiator_name     || '—' },
                  { l:'Nickname',     v: selected.initiator_username ? `@${selected.initiator_username}` : '—' },
                  { l:'Typ',          v: typeLabel(selected.moment_type) },
                  { l:'Sichtbarkeit', v: visLabel(selected.visibility_scope) },
                  { l:'Status',       v: ss.label },
                  { l:'Meldungen',    v: String(selected.report_count) },
                  { l:'Datum',        v: timeAgo(selected.created_at) },
                  { l:'ID',           v: selected.id.substring(0,8) + '…' },
                ].map(({ l, v }) => (
                  <div key={l} style={{ background:'var(--bg-secondary)', borderRadius:8, padding:'10px 14px' }}>
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4 }}>{l}</div>
                    <div style={{ fontSize:13, color:'var(--text-primary)', fontWeight:500 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Ersteller-Profil-Info */}
              <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg-secondary)', borderRadius:10, padding:'10px 14px', marginBottom:20 }}>
                {selected.initiator_avatar ? (
                  <img src={selected.initiator_avatar} alt="" style={{ width:36, height:36, borderRadius:99, objectFit:'cover' }} />
                ) : (
                  <div style={{ width:36, height:36, borderRadius:99, background:'rgba(13,196,181,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#0AA090' }}>
                    {(selected.initiator_name || '?')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight:600, fontSize:14, color:'var(--text-primary)' }}>{selected.initiator_name || '—'}</div>
                  {selected.initiator_username && <div style={{ fontSize:12, color:'var(--text-muted)' }}>@{selected.initiator_username}</div>}
                </div>
              </div>

              {/* Aktionen */}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={() => setSelected(null)} style={{ padding:'8px 18px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-secondary)', fontSize:13, cursor:'pointer' }}>
                  Schließen
                </button>
                {!selected.is_removed ? (
                  <button onClick={() => handleAction(selected.id, 'delete')} style={{ padding:'8px 18px', borderRadius:8, border:'none', background:'#ef4444', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    🗑️ Moment entfernen
                  </button>
                ) : (
                  <button onClick={() => handleAction(selected.id, 'restore')} style={{ padding:'8px 18px', borderRadius:8, border:'none', background:'var(--accent)', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    ✅ Wiederherstellen
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );

  return role === 'superadmin'
    ? <DashboardLayout>{content}</DashboardLayout>
    : <>{content}</>;
}
