// frontend/src/app/website-reviews/page.tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';

interface WebReview {
  id: string; name: string; email: string | null; stars: number | null;
  message: string; source: string; page: string | null;
  status: string; is_featured: boolean; created_at: string; updated_at: string;
}

const STARS = (n: number | null) => {
  if (!n) return null;
  return <span style={{ color:'#F59E0B', fontSize:13 }}>{'★'.repeat(n)}{'☆'.repeat(5-n)}</span>;
};

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d}d`;
}

const SQL_HINT = `CREATE TABLE IF NOT EXISTS public.website_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL DEFAULT 'Anonym',
  email       text,
  stars       smallint CHECK (stars BETWEEN 1 AND 5),
  message     text NOT NULL,
  source      text DEFAULT 'website',
  page        text,
  status      text DEFAULT 'published',
  is_featured boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);`;

export default function WebsiteReviewsPage() {
  const [reviews,     setReviews]     = useState<WebReview[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [total,       setTotal]       = useState(0);
  const [search,      setSearch]      = useState('');
  const [editId,      setEditId]      = useState<string | null>(null);
  const [editData,    setEditData]    = useState<Partial<WebReview>>({});
  const [saving,      setSaving]      = useState(false);
  const [delId,       setDelId]       = useState<string | null>(null);
  const [showSql,     setShowSql]     = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (q) params.set('search', q);
      const res = await fetch(`/api/website-reviews?${params}`, { credentials: 'include', cache: 'no-store' });
      const d = await res.json();
      setTableExists(d.tableExists !== false);
      setReviews(d.reviews ?? []);
      setTotal(d.total ?? 0);
    } catch(e) {
      showToast('Ladefehler: ' + String(e), 'error');
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, []);

  const onSearch = (v: string) => {
    setSearch(v);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => load(v), 400);
  };

  const startEdit = (r: WebReview) => { setEditId(r.id); setEditData({ name: r.name, message: r.message, stars: r.stars, status: r.status, is_featured: r.is_featured }); };
  const cancelEdit = () => { setEditId(null); setEditData({}); };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    const res = await fetch('/api/website-reviews', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editId, ...editData }),
    });
    const d = await res.json();
    setSaving(false);
    if (d.ok) {
      showToast('Gespeichert.', 'success');
      setReviews(prev => prev.map(r => r.id === editId ? { ...r, ...editData } : r));
      cancelEdit();
    } else showToast('Fehler: ' + d.error, 'error');
  };

  const deleteReview = async (id: string) => {
    if (!window.confirm('Review loeschen?')) return;
    setDelId(id);
    const res = await fetch('/api/website-reviews', {
      method: 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const d = await res.json();
    setDelId(null);
    if (d.ok) { showToast('Geloescht.', 'info'); setReviews(prev => prev.filter(r => r.id !== id)); setTotal(t => t-1); }
    else showToast('Fehler: ' + d.error, 'error');
  };

  return (
    <DashboardLayout title="Webseite Review">
      <div style={{ padding:'20px 24px', maxWidth:1200, margin:'0 auto' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Webseite Review</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>
              {loading ? '...' : `${total} Reviews von der HUI-Webseite`}
            </p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => load()} disabled={loading}
              style={{ padding:'6px 14px', borderRadius:7, border:'1px solid var(--border)',
                background:'var(--bg-secondary)', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>
              {loading ? '...' : '\u21ba'}
            </button>
          </div>
        </div>

        {/* Tabelle fehlt noch */}
        {!tableExists && (
          <div style={{ padding:20, borderRadius:10, background:'rgba(99,102,241,0.06)', border:'1px solid #818CF8', marginBottom:20 }}>
            <p style={{ fontWeight:600, color:'#818CF8', margin:'0 0 8px' }}>⚙️ Datenbank-Tabelle noch nicht angelegt</p>
            <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 0 10px' }}>
              Fuehre dieses SQL im Supabase SQL-Editor aus, dann ist alles bereit:
            </p>
            <button onClick={() => setShowSql(!showSql)} style={{ padding:'4px 12px', borderRadius:6,
              border:'1px solid #818CF8', background:'transparent', color:'#818CF8', fontSize:12, cursor:'pointer' }}>
              {showSql ? 'SQL ausblenden' : 'SQL anzeigen'}
            </button>
            {showSql && (
              <pre style={{ marginTop:10, padding:'12px 14px', borderRadius:8, background:'var(--bg-secondary)',
                fontSize:11, color:'var(--text-secondary)', overflowX:'auto', whiteSpace:'pre-wrap' }}>
                {SQL_HINT}
              </pre>
            )}
          </div>
        )}

        {tableExists && (
          <>
            {/* Suche */}
            <div style={{ marginBottom:14 }}>
              <input type="text" placeholder="Suche nach Name oder Text..." value={search} onChange={e => onSearch(e.target.value)}
                style={{ width:'100%', padding:'7px 12px', borderRadius:7, border:'1px solid var(--border)',
                  background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:12, boxSizing:'border-box' }} />
            </div>

            {loading && <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)', fontSize:13 }}>Laedt...</div>}

            {!loading && reviews.length === 0 && (
              <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)', fontSize:13 }}>
                <p style={{ marginBottom:8 }}>Noch keine Webseiten-Reviews.</p>
                <p style={{ fontSize:11 }}>Reviews kommen via <code style={{ background:'var(--bg-secondary)', padding:'2px 6px', borderRadius:4 }}>POST /api/website-reviews</code> aus dem Webseiten-Formular.</p>
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {reviews.map(r => (
                <div key={r.id} style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px' }}>
                  {editId === r.id ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      <div style={{ display:'flex', gap:8 }}>
                        <input value={editData.name ?? ''} onChange={e => setEditData(p=>({...p,name:e.target.value}))}
                          placeholder="Name" style={{ flex:1, padding:'5px 10px', borderRadius:6, border:'1px solid var(--border)',
                            background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:12 }} />
                        <select value={editData.stars ?? ''} onChange={e => setEditData(p=>({...p,stars:e.target.value?Number(e.target.value):null}))}
                          style={{ padding:'5px 10px', borderRadius:6, border:'1px solid var(--border)',
                            background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:12 }}>
                          <option value="">Sterne</option>
                          {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} ★</option>)}
                        </select>
                        <select value={editData.status ?? 'published'} onChange={e => setEditData(p=>({...p,status:e.target.value}))}
                          style={{ padding:'5px 10px', borderRadius:6, border:'1px solid var(--border)',
                            background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:12 }}>
                          <option value="published">Veroeffentlicht</option>
                          <option value="hidden">Versteckt</option>
                        </select>
                      </div>
                      <textarea value={editData.message ?? ''} onChange={e => setEditData(p=>({...p,message:e.target.value}))}
                        style={{ width:'100%', padding:'7px 10px', borderRadius:6, border:'1px solid var(--accent)',
                          background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:12,
                          resize:'vertical', minHeight:60, boxSizing:'border-box' }} />
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={saveEdit} disabled={saving}
                          style={{ padding:'4px 12px', borderRadius:5, border:'none',
                            background:'var(--accent)', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                          {saving ? '...' : 'Speichern'}
                        </button>
                        <button onClick={cancelEdit}
                          style={{ padding:'4px 12px', borderRadius:5, border:'1px solid var(--border)',
                            background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{r.name}</span>
                        {r.stars && STARS(r.stars)}
                        {r.page && <span style={{ fontSize:10, color:'var(--text-muted)' }}>📄 {r.page}</span>}
                        {r.is_featured && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(34,197,94,0.1)', color:'#22C55E' }}>Featured</span>}
                        {r.status === 'hidden' && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(148,163,184,0.1)', color:'var(--text-muted)' }}>Versteckt</span>}
                        <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)' }}>{timeAgo(r.created_at)}</span>
                        <button onClick={() => startEdit(r)} style={{ padding:'2px 8px', borderRadius:5,
                          border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:11, cursor:'pointer' }}>✏️</button>
                        <button onClick={() => deleteReview(r.id)} disabled={delId===r.id} style={{ padding:'2px 8px', borderRadius:5,
                          border:'1px solid var(--red)', background:'transparent', color:'var(--red)', fontSize:11, cursor:'pointer' }}>
                          {delId===r.id?'...':'🗑'}
                        </button>
                      </div>
                      <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0, lineHeight:1.4 }}>{r.message}</p>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop:12, fontSize:11, color:'var(--text-muted)', textAlign:'right' }}>{reviews.length} von {total}</div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
