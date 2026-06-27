// frontend/src/app/website-reviews/page.tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';

interface WebReview {
  id: string; name: string; email: string | null; stars: number | null;
  message: string; source: string; page: string | null;
  status: string; is_featured: boolean; created_at: string;
}
interface Counts { pending: number; published: number; rejected: number; }

function Stars({ n }: { n: number | null }) {
  if (!n) return null;
  return <span style={{ color:'#F59E0B', fontSize:13 }}>{'★'.repeat(n)}{'☆'.repeat(5-n)}</span>;
}
function timeAgo(iso: string) {
  const d = Math.floor((Date.now()-new Date(iso).getTime())/86400000);
  return d===0?'heute':d===1?'gestern':`vor ${d}d`;
}

const STATUS_STYLE: Record<string,{bg:string;color:string;label:string}> = {
  pending:   { bg:'rgba(245,158,11,0.12)',  color:'#F59E0B',  label:'⏳ Ausstehend' },
  published: { bg:'rgba(34,197,94,0.12)',   color:'#22C55E',  label:'✓ Freigegeben' },
  rejected:  { bg:'rgba(255,107,107,0.12)', color:'var(--red)',label:'✗ Abgelehnt' },
};
function Badge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg:'rgba(148,163,184,0.1)', color:'var(--text-muted)', label: status };
  return <span style={{ padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:600, background:s.bg, color:s.color }}>{s.label}</span>;
}

const SQL_HINT = `CREATE TABLE IF NOT EXISTS public.website_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL DEFAULT 'Anonym',
  email       text,
  stars       smallint CHECK (stars BETWEEN 1 AND 5),
  message     text NOT NULL,
  source      text DEFAULT 'website',
  page        text,
  status      text DEFAULT 'pending',
  is_featured boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);`;

export default function WebsiteReviewsPage() {
  const [reviews,     setReviews]     = useState<WebReview[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [total,       setTotal]       = useState(0);
  const [counts,      setCounts]      = useState<Counts>({ pending:0, published:0, rejected:0 });
  const [filter,      setFilter]      = useState<string>('all');
  const [search,      setSearch]      = useState('');
  const [editId,      setEditId]      = useState<string|null>(null);
  const [editMsg,     setEditMsg]     = useState('');
  const [saving,      setSaving]      = useState<string|null>(null);
  const [showSql,     setShowSql]     = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const load = useCallback(async (status=filter, q=search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit:'200' });
      if (status !== 'all') params.set('status', status);
      if (q) params.set('search', q);
      const res = await fetch(`/api/website-reviews?${params}`, { credentials:'include', cache:'no-store' });
      const d   = await res.json();
      setTableExists(d.tableExists !== false);
      setReviews(d.reviews ?? []);
      setTotal(d.total ?? 0);
      if (d.counts) setCounts(d.counts);
    } catch(e) {
      showToast('Ladefehler: '+String(e), 'error');
    } finally { setLoading(false); }
  }, [filter, search]);

  useEffect(() => { load(); }, []);

  const onSearch = (v: string) => {
    setSearch(v);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => load(filter, v), 400);
  };

  const onFilter = (f: string) => { setFilter(f); load(f, search); };

  const action = async (id: string, act: string, extra?: Record<string,unknown>) => {
    setSaving(id+'_'+act);
    const res = await fetch('/api/website-reviews', {
      method:'PATCH', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id, action: act, ...extra }),
    });
    const d = await res.json();
    setSaving(null);
    if (d.ok) {
      const labels: Record<string,string> = {
        approve:'Freigegeben ✓', reject:'Abgelehnt', feature:'Als Featured markiert', unfeature:'Featured entfernt'
      };
      showToast(labels[act] ?? 'Gespeichert', 'success');
      await load(filter, search);
    } else showToast('Fehler: '+(d.error||'?'), 'error');
  };

  const saveEdit = async (id: string) => {
    if (!editMsg.trim()) return;
    setSaving(id+'_edit');
    const res = await fetch('/api/website-reviews', {
      method:'PATCH', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id, message: editMsg }),
    });
    const d = await res.json();
    setSaving(null);
    if (d.ok) {
      showToast('Gespeichert', 'success');
      setEditId(null);
      setReviews(prev => prev.map(r => r.id===id ? {...r, message:editMsg} : r));
    } else showToast('Fehler: '+(d.error||'?'), 'error');
  };

  const deleteReview = async (id: string) => {
    if (!window.confirm('Review endgültig löschen?')) return;
    setSaving(id+'_del');
    const res = await fetch('/api/website-reviews', {
      method:'DELETE', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id }),
    });
    const d = await res.json();
    setSaving(null);
    if (d.ok) {
      showToast('Gelöscht', 'info');
      setReviews(prev => prev.filter(r => r.id!==id));
      setTotal(t => t-1);
    } else showToast('Fehler: '+(d.error||'?'), 'error');
  };

  const isSaving = (id: string, act: string) => saving === id+'_'+act;

  return (
    <DashboardLayout title="Webseite Review">
      <div style={{ padding:'20px 24px', maxWidth:1100, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Webseite Review</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>
              Reviews von be-hui.com — freigeben damit sie im Slider erscheinen
            </p>
          </div>
          <button onClick={() => load()} disabled={loading}
            style={{ padding:'6px 14px', borderRadius:7, border:'1px solid var(--border)',
              background:'var(--bg-secondary)', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>
            {loading ? '...' : '↺'}
          </button>
        </div>

        {/* Tabelle nicht angelegt */}
        {!tableExists && (
          <div style={{ padding:20, borderRadius:10, background:'rgba(99,102,241,0.06)',
            border:'1px solid #818CF8', marginBottom:20 }}>
            <p style={{ fontWeight:600, color:'#818CF8', margin:'0 0 8px' }}>⚙️ Datenbank-Tabelle noch nicht angelegt</p>
            <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 0 10px' }}>
              Führe dieses SQL im <a href="https://supabase.com/dashboard/project/gxztrhvhcxhmunhhkfjd/sql"
                target="_blank" rel="noopener" style={{ color:'#818CF8' }}>Supabase SQL Editor</a> aus:
            </p>
            <button onClick={() => setShowSql(!showSql)} style={{ padding:'4px 12px', borderRadius:6,
              border:'1px solid #818CF8', background:'transparent', color:'#818CF8', fontSize:12, cursor:'pointer' }}>
              {showSql ? 'SQL ausblenden' : 'SQL anzeigen'}
            </button>
            {showSql && (
              <pre style={{ marginTop:10, padding:'12px 14px', borderRadius:8, background:'var(--bg-secondary)',
                fontSize:11, color:'var(--text-secondary)', overflowX:'auto', whiteSpace:'pre-wrap', userSelect:'all' }}>
                {SQL_HINT}
              </pre>
            )}
          </div>
        )}

        {tableExists && (
          <>
            {/* Status-Kacheln */}
            <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap' }}>
              {[
                { k:'all',       l:'Alle',         n: counts.pending+counts.published+counts.rejected, c:'var(--text-muted)' },
                { k:'pending',   l:'⏳ Ausstehend', n: counts.pending,   c:'#F59E0B' },
                { k:'published', l:'✓ Freigegeben', n: counts.published, c:'#22C55E' },
                { k:'rejected',  l:'✗ Abgelehnt',   n: counts.rejected,  c:'var(--red)' },
              ].map(({ k, l, n, c }) => (
                <button key={k} onClick={() => onFilter(k)}
                  style={{ padding:'8px 16px', borderRadius:20, fontSize:12, cursor:'pointer',
                    border:`1px solid ${filter===k ? c : 'var(--border)'}`,
                    background: filter===k ? `${c}18` : 'transparent',
                    color: filter===k ? c : 'var(--text-muted)',
                    fontWeight: filter===k ? 700 : 400 }}>
                  {l} <span style={{ marginLeft:4, opacity:0.8 }}>({n})</span>
                </button>
              ))}
              <input type="text" placeholder="Suchen..." value={search} onChange={e => onSearch(e.target.value)}
                style={{ flex:1, minWidth:160, padding:'6px 12px', borderRadius:20, border:'1px solid var(--border)',
                  background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:12 }} />
            </div>

            {/* Pending-Banner */}
            {counts.pending > 0 && filter !== 'rejected' && (
              <div style={{ padding:'10px 16px', borderRadius:8, marginBottom:14,
                background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)',
                display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18 }}>⏳</span>
                <span style={{ fontSize:13, color:'#F59E0B', fontWeight:600 }}>
                  {counts.pending} neue Bewertung{counts.pending!==1?'en':''} warten auf Freigabe
                </span>
                {filter !== 'pending' && (
                  <button onClick={() => onFilter('pending')}
                    style={{ marginLeft:'auto', padding:'4px 12px', borderRadius:6,
                      border:'1px solid #F59E0B', background:'transparent',
                      color:'#F59E0B', fontSize:12, cursor:'pointer' }}>
                    Jetzt prüfen →
                  </button>
                )}
              </div>
            )}

            {loading && <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)', fontSize:13 }}>Lädt...</div>}
            {!loading && reviews.length === 0 && (
              <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)', fontSize:13 }}>
                {filter==='pending' ? 'Keine ausstehenden Reviews — alles erledigt ✓' : 'Keine Reviews gefunden.'}
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {reviews.map(r => (
                <div key={r.id} style={{
                  background: r.status==='pending' ? 'rgba(245,158,11,0.04)' : 'var(--bg-secondary)',
                  border: `1px solid ${r.status==='pending' ? 'rgba(245,158,11,0.25)' : 'var(--border)'}`,
                  borderRadius:10, padding:'14px 18px',
                }}>
                  {editId === r.id ? (
                    /* Edit-Modus */
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <span style={{ fontWeight:600, fontSize:13 }}>{r.name}</span>
                        <Stars n={r.stars} />
                        <Badge status={r.status} />
                      </div>
                      <textarea value={editMsg} onChange={e => setEditMsg(e.target.value)}
                        style={{ width:'100%', padding:'8px 12px', borderRadius:7,
                          border:'1px solid var(--accent)', background:'var(--bg-secondary)',
                          color:'var(--text-primary)', fontSize:13, resize:'vertical',
                          minHeight:70, boxSizing:'border-box' }} />
                      <div style={{ display:'flex', gap:6, marginTop:8 }}>
                        <button onClick={() => saveEdit(r.id)} disabled={!!isSaving(r.id,'edit')}
                          style={{ padding:'5px 14px', borderRadius:6, border:'none',
                            background:'var(--accent)', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                          {isSaving(r.id,'edit') ? '...' : 'Speichern'}
                        </button>
                        <button onClick={() => setEditId(null)}
                          style={{ padding:'5px 14px', borderRadius:6, border:'1px solid var(--border)',
                            background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal-Modus */
                    <>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                        {/* Avatar-Kreis */}
                        <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--accent-dim)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:11, fontWeight:700, color:'var(--accent)', flexShrink:0 }}>
                          {(r.name||'?')[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>{r.name}</span>
                        <Stars n={r.stars} />
                        <Badge status={r.status} />
                        {r.is_featured && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4,
                          background:'rgba(34,197,94,0.1)', color:'#22C55E' }}>⭐ Featured</span>}
                        {r.page && <span style={{ fontSize:10, color:'var(--text-muted)' }}>📄 {r.page}</span>}
                        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)' }}>
                          {timeAgo(r.created_at)}
                        </span>
                      </div>

                      <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 0 10px', lineHeight:1.5 }}>
                        „{r.message}"
                      </p>

                      {/* Aktions-Buttons */}
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        {r.status === 'pending' && (
                          <>
                            <button disabled={!!saving} onClick={() => action(r.id,'approve')}
                              style={{ padding:'4px 12px', borderRadius:6, border:'1px solid #22C55E',
                                background:'rgba(34,197,94,0.1)', color:'#22C55E', fontSize:12,
                                cursor:'pointer', fontWeight:600 }}>
                              {isSaving(r.id,'approve') ? '...' : '✓ Freigeben'}
                            </button>
                            <button disabled={!!saving} onClick={() => action(r.id,'reject')}
                              style={{ padding:'4px 12px', borderRadius:6, border:'1px solid var(--red)',
                                background:'rgba(255,107,107,0.06)', color:'var(--red)', fontSize:12, cursor:'pointer' }}>
                              {isSaving(r.id,'reject') ? '...' : '✗ Ablehnen'}
                            </button>
                          </>
                        )}
                        {r.status === 'published' && (
                          <>
                            <button disabled={!!saving} onClick={() => action(r.id, r.is_featured?'unfeature':'feature')}
                              style={{ padding:'4px 12px', borderRadius:6,
                                border:'1px solid rgba(34,197,94,0.4)',
                                background:'rgba(34,197,94,0.06)', color:'#22C55E', fontSize:12, cursor:'pointer' }}>
                              {isSaving(r.id,'feature')||isSaving(r.id,'unfeature') ? '...'
                                : r.is_featured ? '★ Featured entfernen' : '☆ Featured'}
                            </button>
                            <button disabled={!!saving} onClick={() => action(r.id,'reject')}
                              style={{ padding:'4px 12px', borderRadius:6, border:'1px solid var(--border)',
                                background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
                              Zurückziehen
                            </button>
                          </>
                        )}
                        {r.status === 'rejected' && (
                          <button disabled={!!saving} onClick={() => action(r.id,'approve')}
                            style={{ padding:'4px 12px', borderRadius:6, border:'1px solid #22C55E',
                              background:'rgba(34,197,94,0.06)', color:'#22C55E', fontSize:12, cursor:'pointer' }}>
                            ↩ Wiederherstellen
                          </button>
                        )}
                        <button onClick={() => { setEditId(r.id); setEditMsg(r.message); }}
                          style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)',
                            background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
                          ✏️
                        </button>
                        <button disabled={!!saving} onClick={() => deleteReview(r.id)}
                          style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--red)',
                            background:'transparent', color:'var(--red)', fontSize:12, cursor:'pointer' }}>
                          {isSaving(r.id,'del') ? '...' : '🗑'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop:12, fontSize:11, color:'var(--text-muted)', textAlign:'right' }}>
              {reviews.length} von {total} Reviews
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
