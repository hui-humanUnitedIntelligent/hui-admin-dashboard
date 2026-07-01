'use client';
// frontend/src/app/employee/ambassadors/page.tsx
// EDB: Ambassador-Übersicht mit Stripe-Provisionen
import { useState, useEffect, useCallback } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';

function eur(val: number | null | undefined) {
  return `€${(val ?? 0).toFixed(2)}`;
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', { day:'2-digit', month:'short', year:'numeric' });
}
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20,
      background:`${color}22`, color, border:`1px solid ${color}44` }}>{label}</span>
  );
}

export default function EmployeeAmbassadorsPage() {
  const [ambassadors, setAmbassadors] = useState<any[]>([]);
  const [selected,    setSelected]    = useState<any | null>(null);
  const [earnings,    setEarnings]    = useState<any | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [search,      setSearch]      = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/ambassador?type=list', { credentials:'include' });
      const data = await res.json();
      setAmbassadors(Array.isArray(data.data) ? data.data : []);
    } catch { /* noop */ } finally { setLoading(false); }
  }, []);

  const loadEarnings = useCallback(async (ambassadorId: string) => {
    try {
      const res  = await fetch(`/api/stripe?type=commissions&ambassador_id=${ambassadorId}`, { credentials:'include' });
      const data = await res.json();
      // Earnings summary
      const items = Array.isArray(data.data) ? data.data : [];
      const pending = items.filter((c:any) => c.status==='pending').reduce((s:number,c:any)=>s+(c.amount??0),0);
      const paid    = items.filter((c:any) => c.status==='paid').reduce((s:number,c:any)=>s+(c.amount??0),0);
      setEarnings({ items, pending_eur: pending/100, paid_eur: paid/100, total: items.length });
    } catch { /* noop */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = ambassadors.filter(a =>
    !search || a.username?.toLowerCase().includes(search.toLowerCase())
      || a.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  const th: React.CSSProperties = { padding:'10px 14px', textAlign:'left', fontSize:10,
    textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--text-muted)',
    fontWeight:600, borderBottom:'1px solid var(--border)', background:'var(--bg-tertiary)', whiteSpace:'nowrap' };
  const td: React.CSSProperties = { padding:'10px 14px', fontSize:12, color:'var(--text-primary)' };

  return (
    <EmployeeLayout>
      <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:800 }}>🤝 Ambassadors</h1>
            <p style={{ margin:'4px 0 0', fontSize:12, color:'var(--text-muted)' }}>
              Provisionen, Referrals & Stripe-Earnings
            </p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Suche…"
              style={{ padding:'8px 14px', background:'var(--bg-secondary)',
                border:'1px solid var(--border)', borderRadius:8,
                color:'var(--text-primary)', fontSize:12, outline:'none', width:200 }} />
            <button onClick={load} style={{ padding:'8px 14px', borderRadius:8,
              border:'1px solid var(--border)', background:'var(--bg-secondary)',
              color:'var(--text-muted)', cursor:'pointer', fontSize:12 }}>🔄</button>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap:16 }}>

          {/* Ambassador-Tabelle */}
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                {['Ambassador','Status','Referrals','Erste Transaktion','Aktionen'].map(h =>
                  <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} style={{...td, textAlign:'center', color:'var(--text-muted)'}}>Laden…</td></tr>
                )}
                {filtered.map((a:any) => (
                  <tr key={a.id} style={{ borderBottom:'1px solid var(--border)',
                    background: selected?.id===a.id ? 'var(--bg-tertiary)' : 'transparent' }}>
                    <td style={td}>
                      <div style={{ fontWeight:600 }}>@{a.username || '—'}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{a.email || '—'}</div>
                    </td>
                    <td style={td}><Badge label={a.ambassador_status||'confirmed'} color="#51cf66" /></td>
                    <td style={td}>{a.referral_count ?? 0}</td>
                    <td style={td}>{fmtDate(a.first_transaction_at)}</td>
                    <td style={td}>
                      <button onClick={() => {
                        setSelected(a); setEarnings(null); loadEarnings(a.id);
                      }} style={{ padding:'4px 12px', borderRadius:6, border:'1px solid var(--accent)',
                        background:'transparent', color:'var(--accent)', cursor:'pointer', fontSize:11, fontWeight:600 }}>
                        💰 Earnings
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={5} style={{...td, textAlign:'center', color:'var(--text-muted)', padding:'40px'}}>
                    Keine Ambassadors gefunden
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Earnings-Panel */}
          {selected && (
            <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)',
              borderRadius:12, padding:'18px 20px', position:'sticky', top:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>@{selected.username}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>Stripe Provisionen</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background:'none', border:'none',
                  color:'var(--text-muted)', cursor:'pointer', fontSize:18 }}>✕</button>
              </div>

              {earnings ? (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                    {[
                      { label:'Ausstehend', val: eur(earnings.pending_eur), color:'#ffd43b' },
                      { label:'Ausgezahlt',  val: eur(earnings.paid_eur),   color:'#51cf66' },
                    ].map(k => (
                      <div key={k.label} style={{ background:'var(--bg-tertiary)', borderRadius:8, padding:'10px 14px' }}>
                        <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:4 }}>{k.label}</div>
                        <div style={{ fontSize:18, fontWeight:700, color:k.color }}>{k.val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)',
                    textTransform:'uppercase', marginBottom:8 }}>Letzte Buchungen</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:280, overflowY:'auto' }}>
                    {earnings.items.slice(0,20).map((c:any) => (
                      <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                        padding:'6px 10px', background:'var(--bg-tertiary)', borderRadius:8 }}>
                        <div>
                          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-primary)' }}>
                            {eur(c.amount/100)}
                          </div>
                          <div style={{ fontSize:10, color:'var(--text-muted)' }}>{fmtDate(c.created_at)}</div>
                        </div>
                        <Badge label={c.status} color={c.status==='paid'?'#51cf66':c.status==='refunded'?'#74c0fc':'#ffd43b'} />
                      </div>
                    ))}
                    {earnings.items.length === 0 && (
                      <div style={{ textAlign:'center', fontSize:12, color:'var(--text-muted)', padding:'20px' }}>
                        Noch keine Provisionen
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:13, padding:'30px' }}>Lade…</div>
              )}
            </div>
          )}
        </div>
      </div>
    </EmployeeLayout>
  );
}
