// frontend/src/app/reviews/page.tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';

interface Review {
  id: string; source: string; refId: string | null; refTitle: string | null; refType: string | null;
  userId: string; userName: string; userAvatar: string | null;
  text: string; createdAt: string; sensitive: boolean; sensitiveMatches: string[];
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d}d`;
}

export default function AppReviewsPage() {
  const [reviews, setReviews]     = useState<Review[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter,  setFilter]      = useState<'all' | 'sensitive'>('all');
  const [search,  setSearch]      = useState('');
  const [total,   setTotal]       = useState(0);
  const [sensCount, setSensCount] = useState(0);
  const [editId,  setEditId]      = useState<string | null>(null);
  const [editText,setEditText]    = useState('');
  const [saving,  setSaving]      = useState(false);
  const [delId,   setDelId]       = useState<string | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q = search, f = filter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500', filter: f });
      if (q) params.set('search', q);
      const res = await fetch(`/api/reviews?${params}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setReviews(d.reviews ?? []);
      setTotal(d.total ?? 0);
      setSensCount(d.sensitiveCount ?? 0);
    } catch(e) {
      showToast('Ladefehler: ' + String(e), 'error');
    } finally { setLoading(false); }
  }, [search, filter]);

  useEffect(() => { load(); }, []);

  const onSearch = (v: string) => {
    setSearch(v);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => load(v, filter), 400);
  };

  const onFilter = (f: 'all' | 'sensitive') => { setFilter(f); load(search, f); };

  const startEdit = (r: Review) => { setEditId(r.id); setEditText(r.text); };
  const cancelEdit = () => { setEditId(null); setEditText(''); };

  const saveEdit = async () => {
    if (!editId || !editText.trim()) return;
    setSaving(true);
    const res = await fetch('/api/reviews', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editId, text: editText }),
    });
    const d = await res.json();
    setSaving(false);
    if (d.ok) {
      showToast('Gespeichert.', 'success');
      setReviews(prev => prev.map(r => r.id === editId ? { ...r, text: editText } : r));
      cancelEdit();
    } else showToast('Fehler: ' + d.error, 'error');
  };

  const deleteReview = async (id: string) => {
    if (!window.confirm('Kommentar loeschen?')) return;
    setDelId(id);
    const res = await fetch('/api/reviews', {
      method: 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const d = await res.json();
    setDelId(null);
    if (d.ok) { showToast('Geloescht.', 'info'); setReviews(prev => prev.filter(r => r.id !== id)); setTotal(t => t-1); }
    else showToast('Fehler: ' + d.error, 'error');
  };

  const displayed = reviews;

  return (
    <DashboardLayout title="App Review">
      <div style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', margin:0 }}>App Review</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>
              {loading ? '...' : `${total} Kommentare`}
              {sensCount > 0 && <span style={{ marginLeft:8, color:'#F59E0B', fontWeight:600 }}> ⚠️ {sensCount} sensitiv</span>}
            </p>
          </div>
          <button onClick={() => load()} disabled={loading}
            style={{ padding:'6px 14px', borderRadius:7, border:'1px solid var(--border)',
              background:'var(--bg-secondary)', color:'var(--text-primary)', cursor:'pointer', fontSize:12 }}>
            {loading ? '...' : '\u21ba'}
          </button>
        </div>

        {/* Filter + Suche */}
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
          {([['all','Alle'], ['sensitive','⚠️ Sensitiv']] as const).map(([k,l]) => (
            <button key={k} onClick={() => onFilter(k)}
              style={{ padding:'4px 12px', borderRadius:16, border:`1px solid ${filter===k?'var(--accent)':'var(--border)'}`,
                background: filter===k ? 'var(--accent-dim)' : 'transparent',
                color: filter===k ? 'var(--accent)' : 'var(--text-muted)',
                fontSize:12, cursor:'pointer', fontWeight: filter===k ? 600 : 400 }}>
              {l}{k==='sensitive' && sensCount>0 ? ` (${sensCount})` : k==='all' ? ` (${total})` : ''}
            </button>
          ))}
          <input type="text" placeholder="Suchen..." value={search} onChange={e => onSearch(e.target.value)}
            style={{ flex:1, minWidth:180, padding:'5px 12px', borderRadius:7, border:'1px solid var(--border)',
              background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:12 }} />
        </div>

        {/* Liste */}
        {loading && <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)', fontSize:13 }}>Laedt...</div>}
        {!loading && displayed.length === 0 && (
          <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)', fontSize:13 }}>Keine Kommentare.</div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {displayed.map(r => (
            <div key={r.id} style={{
              background: r.sensitive ? 'rgba(245,158,11,0.05)' : 'var(--bg-secondary)',
              border: `1px solid ${r.sensitive ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
              borderRadius:8, padding:'10px 14px',
            }}>
              {/* Zeile 1: Avatar + Name + Ref + Sensitive + Zeit + Aktionen */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: editId===r.id ? 8 : 4 }}>
                {/* Avatar mini */}
                {r.userAvatar ? (
                  <img src={r.userAvatar} alt="" style={{ width:22, height:22, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                ) : (
                  <div style={{ width:22, height:22, borderRadius:'50%', background:'var(--accent-dim)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:10, color:'var(--accent)', fontWeight:700, flexShrink:0 }}>
                    {(r.userName||'?')[0].toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{r.userName}</span>
                {r.refTitle && (
                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                    → <span style={{ color:'var(--accent)' }}>{r.refTitle}</span>
                  </span>
                )}
                {r.sensitive && (
                  <span title={`Sensitiv: ${r.sensitiveMatches.join(', ')}`}
                    style={{ fontSize:10, padding:'1px 6px', borderRadius:4,
                      background:'rgba(245,158,11,0.12)', color:'#F59E0B', fontWeight:600, cursor:'help' }}>
                    ⚠️ {r.sensitiveMatches.slice(0,2).join(', ')}{r.sensitiveMatches.length>2?'...':''}
                  </span>
                )}
                <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                  {timeAgo(r.createdAt)}
                </span>
                {editId !== r.id && (
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => startEdit(r)} style={{ padding:'2px 8px', borderRadius:5,
                      border:'1px solid var(--border)', background:'transparent',
                      color:'var(--text-muted)', fontSize:11, cursor:'pointer' }}>✏️</button>
                    <button onClick={() => deleteReview(r.id)} disabled={delId===r.id} style={{ padding:'2px 8px', borderRadius:5,
                      border:'1px solid var(--red)', background:'transparent',
                      color:'var(--red)', fontSize:11, cursor:'pointer', opacity: delId===r.id ? 0.5 : 1 }}>
                      {delId===r.id ? '...' : '🗑'}
                    </button>
                  </div>
                )}
              </div>

              {/* Kommentar-Text oder Edit-Feld */}
              {editId === r.id ? (
                <div>
                  <textarea value={editText} onChange={e => setEditText(e.target.value)}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:6, border:'1px solid var(--accent)',
                      background:'var(--bg-secondary)', color:'var(--text-primary)', fontSize:12,
                      resize:'vertical', minHeight:60, boxSizing:'border-box' }} />
                  <div style={{ display:'flex', gap:6, marginTop:5 }}>
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
                <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0, lineHeight:1.4 }}>{r.text}</p>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop:12, fontSize:11, color:'var(--text-muted)', textAlign:'right' }}>
          {displayed.length} von {total} Kommentaren
        </div>
      </div>
    </DashboardLayout>
  );
}
