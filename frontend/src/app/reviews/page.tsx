// frontend/src/app/reviews/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';
import { getStoredUser } from '@/lib/api';

interface Review {
  id: string;
  name: string;
  stars: number;
  message: string;
  date: string;
  submitted_at?: string;
  approvedAt?: string;
}

function StarDisplay({ stars }: { stars: number }) {
  const n = Math.min(5, Math.max(0, stars));
  return (
    <span style={{ letterSpacing: 1 }}>
      <span style={{ color: '#F59E0B' }}>{'★'.repeat(n)}</span>
      <span style={{ color: 'var(--border)', opacity: 0.4 }}>{'★'.repeat(5 - n)}</span>
    </span>
  );
}

export default function ReviewsPage() {
  const router   = useRouter();
  const [tab,        setTab]        = useState<'published' | 'pending'>('published');
  const [published,  setPublished]  = useState<Review[]>([]);
  const [pending,    setPending]    = useState<Review[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [busy,       setBusy]       = useState<string | null>(null);
  const [confirmId,  setConfirmId]  = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [noToken,    setNoToken]    = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) router.replace('/dashboard');
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // published: erst Admin-API, dann direkt von be-hui.com
      const [pubRes, penRes] = await Promise.all([
        fetch('/api/reviews?type=published&t=' + Date.now(), { cache: 'no-store' }),
        fetch('/api/reviews?type=pending&t='   + Date.now(), { cache: 'no-store' }),
      ]);

      let pubData: Review[] = [];
      let penData: Review[] = [];

      if (pubRes.ok) {
        const raw = await pubRes.json();
        pubData = Array.isArray(raw) ? raw : [];
      }

      // Falls Admin-API nichts hat (kein GH_TOKEN), direkt von be-hui.com laden
      if (pubData.length === 0) {
        try {
          const fallback = await fetch('https://be-hui.com/data/reviews.json?t=' + Date.now(), { cache: 'no-store' });
          if (fallback.ok) {
            const raw = await fallback.json();
            pubData = Array.isArray(raw) ? raw : [];
            if (pubData.length > 0) setNoToken(true);
          }
        } catch { /* ignore */ }
      } else {
        setNoToken(false);
      }

      if (penRes.ok) {
        const raw = await penRes.json();
        penData = Array.isArray(raw) ? raw : [];
      }

      setPublished([...pubData].reverse());
      setPending([...penData].reverse());
    } catch {
      setError('Verbindungsfehler — API nicht erreichbar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    setBusy(id);
    setConfirmId(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_published', id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Serverfehler');
      showToast('🗑️ Review gelöscht', 'info');
      await load();
    } catch (e) {
      showToast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Serverfehler');
      showToast('✅ Bewertung veröffentlicht', 'success');
      await load();
    } catch (e) {
      showToast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Serverfehler');
      showToast('🗑️ Abgelehnt & entfernt', 'info');
      await load();
    } catch (e) {
      showToast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannt'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const reviews = tab === 'published' ? published : pending;

  const ConfirmModal = () => {
    if (!confirmId) return null;
    return (
      <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center' }}>
        <div style={{ background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:16,padding:'28px 32px',maxWidth:380,width:'90%',textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,0.35)' }}>
          <div style={{ fontSize:32,marginBottom:12 }}>🗑️</div>
          <h3 style={{ color:'var(--text-primary)',marginBottom:8,fontSize:16 }}>Review löschen?</h3>
          <p style={{ color:'var(--text-muted)',fontSize:13,marginBottom:24 }}>
            Dieser Review wird sofort von <strong>be-hui.com</strong> entfernt. Nicht rückgängig machbar.
          </p>
          <div style={{ display:'flex',gap:10,justifyContent:'center' }}>
            <button onClick={() => setConfirmId(null)} style={{ padding:'9px 22px',borderRadius:9,background:'var(--bg-hover)',border:'1px solid var(--border)',color:'var(--text-secondary)',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'var(--font-body)' }}>Abbrechen</button>
            <button onClick={() => handleDelete(confirmId)} style={{ padding:'9px 22px',borderRadius:9,background:'rgba(239,68,68,0.9)',border:'none',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'var(--font-body)' }}>Ja, löschen</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout title="Review-Verwaltung">
      <ConfirmModal />

      {/* Stats */}
      <div style={{ display:'flex',gap:12,marginBottom:28,flexWrap:'wrap',alignItems:'stretch' }}>
        {[
          { icon:'✅', label:'Live auf Website',  value:published.length, accent:'var(--accent)',       bg:'rgba(30,216,200,0.08)' },
          { icon:'⏳', label:'Ausstehend',         value:pending.length,   accent:'#FBBF24',             bg:'rgba(251,191,36,0.08)' },
          { icon:'💬', label:'Gesamt',             value:published.length+pending.length, accent:'var(--text-secondary)', bg:'var(--bg-card)' },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg,border:'1px solid var(--border)',borderRadius:12,padding:'14px 20px',display:'flex',alignItems:'center',gap:14,minWidth:160 }}>
            <span style={{ fontSize:22 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize:26,fontWeight:700,color:s.accent,lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:3 }}>{s.label}</div>
            </div>
          </div>
        ))}
        <button onClick={load} style={{ marginLeft:'auto',padding:'10px 18px',borderRadius:10,background:'var(--bg-hover)',border:'1px solid var(--border)',color:'var(--text-secondary)',cursor:'pointer',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:7,fontFamily:'var(--font-body)' }}>🔄 Aktualisieren</button>
      </div>

      {/* Token-Warnung */}
      {noToken && (
        <div style={{ background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.3)',borderRadius:10,padding:'12px 16px',marginBottom:20,color:'#FBBF24',fontSize:13 }}>
          ⚠️ <strong>GH_TOKEN</strong> nicht in Vercel gesetzt — Reviews werden schreibgeschützt angezeigt. Löschen/Veröffentlichen erfordert den Token.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex',gap:4,marginBottom:20 }}>
        {([['published','✅ Veröffentlicht'],['pending','⏳ Ausstehend']] as const).map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding:'9px 20px',borderRadius:9,cursor:'pointer',fontFamily:'var(--font-body)',fontSize:13,fontWeight:600,border:tab===key?'none':'1px solid var(--border)',background:tab===key?'var(--accent)':'var(--bg-hover)',color:tab===key?'#0F1117':'var(--text-secondary)',transition:'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Fehler */}
      {error && (
        <div style={{ background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:10,padding:'12px 16px',marginBottom:20,color:'var(--red)',fontSize:13 }}>⚠️ {error}</div>
      )}

      {/* Tabelle */}
      <div style={{ background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden' }}>
        {/* Header */}
        <div style={{ display:'grid',gridTemplateColumns:tab==='published'?'130px 140px 90px 1fr 100px 110px':'130px 140px 90px 1fr 100px 170px',padding:'11px 18px',background:'var(--bg-secondary)',borderBottom:'1px solid var(--border)',fontSize:11,fontWeight:700,color:'var(--text-muted)',letterSpacing:'0.6px',textTransform:'uppercase',gap:8 }}>
          <span>ID</span><span>Name</span><span>Sterne</span><span>Nachricht</span><span>Datum</span><span>Aktion</span>
        </div>

        {loading && <div style={{ padding:'40px 0',textAlign:'center',color:'var(--text-muted)',fontSize:14 }}>⏳ Lädt…</div>}

        {!loading && reviews.length === 0 && (
          <div style={{ padding:'40px 0',textAlign:'center',color:'var(--text-muted)',fontSize:14 }}>
            {tab==='published' ? '💬 Noch keine veröffentlichten Bewertungen.' : '✅ Keine ausstehenden Bewertungen.'}
          </div>
        )}

        {!loading && reviews.map((r, idx) => (
          <div key={r.id} style={{ display:'grid',gridTemplateColumns:tab==='published'?'130px 140px 90px 1fr 100px 110px':'130px 140px 90px 1fr 100px 170px',padding:'13px 18px',borderBottom:idx<reviews.length-1?'1px solid var(--border)':'none',background:busy===r.id?'var(--bg-hover)':'transparent',opacity:busy===r.id?0.6:1,transition:'background 0.15s,opacity 0.2s',alignItems:'center',gap:8 }}>
            {/* ID */}
            <span style={{ fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-mono)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }} title={r.id}>{r.id.slice(0,10)}…</span>
            {/* Name */}
            <div style={{ display:'flex',alignItems:'center',gap:8,overflow:'hidden' }}>
              <div style={{ width:28,height:28,borderRadius:'50%',background:'var(--accent)',opacity:.85,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#0F1117',flexShrink:0 }}>{(r.name||'?').charAt(0).toUpperCase()}</div>
              <span style={{ fontSize:13,fontWeight:600,color:'var(--text-primary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{r.name}</span>
            </div>
            {/* Sterne */}
            <StarDisplay stars={r.stars} />
            {/* Nachricht */}
            <span style={{ fontSize:12.5,color:'var(--text-secondary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }} title={r.message}>{r.message}</span>
            {/* Datum */}
            <span style={{ fontSize:12,color:'var(--text-muted)',whiteSpace:'nowrap' }}>{r.date||'—'}</span>
            {/* Aktion */}
            <div style={{ display:'flex',gap:6,flexWrap:'nowrap' }}>
              {tab==='pending' && (
                <button onClick={() => handlePublish(r.id)} disabled={!!busy} style={{ padding:'6px 10px',borderRadius:7,border:'none',background:'var(--accent)',color:'#0F1117',fontSize:11,fontWeight:700,cursor:busy?'not-allowed':'pointer',fontFamily:'var(--font-body)',whiteSpace:'nowrap' }}>✅ Live</button>
              )}
              <button
                onClick={() => tab==='published' ? setConfirmId(r.id) : handleReject(r.id)}
                disabled={!!busy}
                style={{ padding:'6px 10px',borderRadius:7,background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.25)',color:'var(--red)',fontSize:11,fontWeight:700,cursor:busy?'not-allowed':'pointer',fontFamily:'var(--font-body)',whiteSpace:'nowrap' }}
              >🗑️ {tab==='published'?'Löschen':'Ablehnen'}</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:16,fontSize:11.5,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:6 }}>
        <span>💡</span>
        <span>Änderungen werden sofort auf <strong>be-hui.com</strong> wirksam.</span>
      </div>
    </DashboardLayout>
  );
}
