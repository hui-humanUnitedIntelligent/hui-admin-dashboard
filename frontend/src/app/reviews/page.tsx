// frontend/src/app/reviews/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Button from '@/components/ui/Button';
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

function StarDisplay({ stars, size = 14 }: { stars: number; size?: number }) {
  const n = Math.min(5, Math.max(0, Number(stars) || 0));
  return (
    <span style={{ letterSpacing: 2, fontSize: size }}>
      <span style={{ color: '#F59E0B' }}>{'★'.repeat(n)}</span>
      <span style={{ color: '#CBD5E1' }}>{'★'.repeat(5 - n)}</span>
    </span>
  );
}

export default function ReviewsPage() {
  const router  = useRouter();
  const [tab,        setTab]        = useState<'published' | 'pending'>('published');
  const [published,  setPublished]  = useState<Review[]>([]);
  const [pending,    setPending]    = useState<Review[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [busy,       setBusy]       = useState<string | null>(null);
  const [confirmId,  setConfirmId]  = useState<string | null>(null);
  const [detailReview, setDetailReview] = useState<Review | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) router.replace('/dashboard');
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pubRes, penRes] = await Promise.all([
        fetch(`/api/reviews?type=published&t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/reviews?type=pending&t=${Date.now()}`,   { cache: 'no-store' }),
      ]);
      const pubData: Review[] = pubRes.ok ? await pubRes.json() : [];
      const penData: Review[] = penRes.ok ? await penRes.json() : [];
      setPublished(Array.isArray(pubData) ? [...pubData].reverse() : []);
      setPending(Array.isArray(penData)   ? [...penData].reverse()  : []);
    } catch (e) {
      setError('Verbindungsfehler: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const apiPost = async (action: string, id: string) => {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
    return data;
  };

  const handleDelete = async (id: string) => {
    setBusy(id); setConfirmId(null);
    try {
      await apiPost('delete', id);
      showToast('🗑️ Review gelöscht', 'info');
      await load();
    } catch (e) { showToast('❌ ' + (e instanceof Error ? e.message : 'Unbekannt'), 'error'); }
    finally { setBusy(null); }
  };

  const handlePublish = async (id: string) => {
    setBusy(id);
    try {
      const d = await apiPost('approve', id);
      showToast(`✅ Review von ${d.name || 'Nutzer'} veröffentlicht`, 'success');
      await load();
    } catch (e) { showToast('❌ ' + (e instanceof Error ? e.message : 'Unbekannt'), 'error'); }
    finally { setBusy(null); }
  };

  const handleReject = async (id: string) => {
    setBusy(id);
    try {
      await apiPost('reject', id);
      showToast('🗑️ Abgelehnt & entfernt', 'info');
      await load();
    } catch (e) { showToast('❌ ' + (e instanceof Error ? e.message : 'Unbekannt'), 'error'); }
    finally { setBusy(null); }
  };

  const reviews = tab === 'published' ? published : pending;

  // Farbe für Avatar
  const avatarColor = (id: string) => {
    const colors = ['#4ECDC4','#F7B731','#B197FC','#74C0FC','#51CF66','#FF6B6B','#1ED8C8'];
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
    return colors[Math.abs(h) % colors.length];
  };

  return (
    <DashboardLayout title="Review-Verwaltung">

      {/* ── Detail Modal ─────────────────────────────────────────────────── */}
      {/* ── Detail Modal ──────────────────────────────────────────────────── */}
      {detailReview && (
        <Modal
          open={!!detailReview}
          onClose={() => setDetailReview(null)}
          title={`Review — ${detailReview.name}`}
          width={520}
          footer={
            <>
              {tab === 'pending' && (
                <Button variant="primary" onClick={() => { setDetailReview(null); handlePublish(detailReview.id); }}>
                  ✅ Veröffentlichen
                </Button>
              )}
              <Button
                variant="danger"
                onClick={() => { setDetailReview(null); tab === 'published' ? setConfirmId(detailReview.id) : handleReject(detailReview.id); }}
              >
                🗑️ {tab === 'published' ? 'Löschen' : 'Ablehnen'}
              </Button>
              <Button variant="ghost" onClick={() => setDetailReview(null)}>Schließen</Button>
            </>
          }
        >
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
            <div style={{ width:44, height:44, borderRadius:'50%', background:avatarColor(detailReview.id), display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#0F1117', flexShrink:0 }}>
              {(detailReview.name||'?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:3 }}>{detailReview.name}</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <StarDisplay stars={detailReview.stars} size={15} />
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>{detailReview.date}</span>
              </div>
            </div>
          </div>
          <div style={{ background:'var(--bg-tertiary)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px', marginBottom:14 }}>
            <p style={{ color:'var(--text-secondary)', fontSize:13.5, lineHeight:1.7, margin:0, whiteSpace:'pre-wrap' }}>
              „{detailReview.message}"
            </p>
          </div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
            ID: <code style={{ fontSize:10 }}>{detailReview.id}</code>
            {detailReview.submitted_at && <span style={{ marginLeft:8 }}>· {new Date(detailReview.submitted_at).toLocaleString('de-DE')}</span>}
          </div>
        </Modal>
      )}

      {/* ── Confirm Modal ────────────────────────────────────────────────── */}
      {/* ── Confirm Modal ─────────────────────────────────────────────────── */}
      <ConfirmModal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => { if (confirmId) handleDelete(confirmId); }}
        title="Review löschen?"
        message="Dieser Review wird sofort und dauerhaft von be-hui.com entfernt."
        confirmLabel="Ja, löschen"
        cancelLabel="Abbrechen"
        confirmVariant="danger"
      />


      {/* ── Stats ── */}
      <div style={{ display:'flex', gap:12, marginBottom:28, flexWrap:'wrap' }}>
        {[
          { icon:'✅', label:'Live auf Website',  value:published.length, accent:'var(--accent)',          bg:'rgba(30,216,200,0.08)' },
          { icon:'⏳', label:'Ausstehend',         value:pending.length,   accent:'#FBBF24',                bg:'rgba(251,191,36,0.08)' },
          { icon:'💬', label:'Gesamt',             value:published.length+pending.length, accent:'var(--text-secondary)', bg:'var(--bg-card)' },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, border:'1px solid var(--border)', borderRadius:12, padding:'14px 20px', display:'flex', alignItems:'center', gap:14, minWidth:160 }}>
            <span style={{ fontSize:22 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize:26, fontWeight:700, color:s.accent, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{s.label}</div>
            </div>
          </div>
        ))}
        <button onClick={load} disabled={loading} style={{ marginLeft:'auto', padding:'10px 18px', borderRadius:10, background:'var(--bg-hover)', border:'1px solid var(--border)', color:'var(--text-secondary)', cursor:'pointer', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:7, fontFamily:'var(--font-body)', opacity:loading?0.6:1 }}>
          🔄 {loading ? 'Lädt…' : 'Aktualisieren'}
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex', gap:4, marginBottom:20 }}>
        {([['published','✅ Veröffentlicht'],['pending','⏳ Ausstehend']] as const).map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding:'9px 20px', borderRadius:9, cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13, fontWeight:600, border:tab===key?'none':'1px solid var(--border)', background:tab===key?'var(--accent)':'var(--bg-hover)', color:tab===key?'#0F1117':'var(--text-secondary)', transition:'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Fehler */}
      {error && (
        <div style={{ background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:10, padding:'12px 16px', marginBottom:20, color:'#EF4444', fontSize:13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Tabelle ── */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:tab==='published'?'110px 160px 100px 1fr 100px 120px':'110px 160px 100px 1fr 100px 180px', padding:'11px 18px', background:'var(--bg-secondary)', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.6px', textTransform:'uppercase', gap:8 }}>
          <span>ID</span><span>Name</span><span>Sterne</span><span>Nachricht</span><span>Datum</span><span>Aktion</span>
        </div>

        {loading && <div style={{ padding:'48px 0', textAlign:'center', color:'var(--text-muted)', fontSize:14 }}>⏳ Daten werden geladen…</div>}

        {!loading && reviews.length === 0 && (
          <div style={{ padding:'48px 0', textAlign:'center', color:'var(--text-muted)', fontSize:14 }}>
            {tab==='published' ? '💬 Noch keine veröffentlichten Bewertungen.' : '✅ Keine ausstehenden Bewertungen.'}
          </div>
        )}

        {!loading && reviews.map((r, idx) => (
          <div
            key={r.id}
            onClick={() => setDetailReview(r)}
            style={{ display:'grid', gridTemplateColumns:tab==='published'?'110px 160px 100px 1fr 100px 120px':'110px 160px 100px 1fr 100px 180px', padding:'14px 18px', borderBottom:idx<reviews.length-1?'1px solid var(--border)':'none', background:busy===r.id?'var(--bg-hover)':'transparent', opacity:busy===r.id?0.5:1, transition:'background 0.15s, opacity 0.2s', alignItems:'center', gap:8, cursor:'pointer' }}
            onMouseEnter={e => { if (busy!==r.id) (e.currentTarget as HTMLElement).style.background='var(--bg-hover)'; }}
            onMouseLeave={e => { if (busy!==r.id) (e.currentTarget as HTMLElement).style.background='transparent'; }}
          >
            <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.id}>{r.id.slice(0,10)}…</span>
            <div style={{ display:'flex', alignItems:'center', gap:8, overflow:'hidden' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:avatarColor(r.id), display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#0F1117', flexShrink:0 }}>
                {(r.name||'?').charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.name}</span>
            </div>
            <StarDisplay stars={r.stars} />
            <span style={{ fontSize:12.5, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.message}>{r.message}</span>
            <span style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{r.date||'—'}</span>
            <div style={{ display:'flex', gap:6 }} onClick={e => e.stopPropagation()}>
              {tab==='pending' && (
                <button onClick={() => handlePublish(r.id)} disabled={!!busy} style={{ padding:'6px 11px', borderRadius:7, border:'none', background:'var(--accent)', color:'#0F1117', fontSize:11, fontWeight:700, cursor:busy?'not-allowed':'pointer', fontFamily:'var(--font-body)', whiteSpace:'nowrap' }}>
                  ✅ Live
                </button>
              )}
              <button
                onClick={() => tab==='published' ? setConfirmId(r.id) : handleReject(r.id)}
                disabled={!!busy}
                style={{ padding:'6px 11px', borderRadius:7, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', color:'#EF4444', fontSize:11, fontWeight:700, cursor:busy?'not-allowed':'pointer', fontFamily:'var(--font-body)', whiteSpace:'nowrap' }}
              >🗑️ {tab==='published'?'Löschen':'Ablehnen'}</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:16, fontSize:11.5, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:6 }}>
        <span>💡</span>
        <span>Zeile anklicken zum Lesen · Änderungen wirken sofort auf <strong>be-hui.com</strong></span>
      </div>
    </DashboardLayout>
  );
}
