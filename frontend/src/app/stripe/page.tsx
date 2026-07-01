'use client';
// frontend/src/app/stripe/page.tsx
// SADB Stripe-Dashboard — alle Zahlungen, Abos, Provisionen, Impact Pool
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/lib/hooks/useAuth';

function eur(cents: number | null | undefined) {
  return `€${((cents ?? 0) / 100).toFixed(2)}`;
}
function eurDec(val: number | null | undefined) {
  return `€${(val ?? 0).toFixed(2)}`;
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    succeeded:'#51cf66', paid:'#51cf66', active:'#51cf66', processed:'#51cf66',
    pending:'#ffd43b', processing:'#ffd43b',
    failed:'#ff6b6b', canceled:'#868e96', refunded:'#74c0fc',
  };
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20,
      background: (map[status] || '#868e96') + '22', color: map[status] || '#868e96' }}>
      {status}
    </span>
  );
}

export default function StripeDashboardPage() {
  const { currentUser } = useAuth();
  const [tab,       setTab]       = useState<'overview'|'payments'|'subs'|'commissions'|'payouts'|'webhooks'|'pool'>('overview');
  const [overview,  setOverview]  = useState<any>(null);
  const [payments,  setPayments]  = useState<any[]>([]);
  const [subs,      setSubs]      = useState<any[]>([]);
  const [commissions,setCommissions] = useState<any[]>([]);
  const [payouts,   setPayouts]   = useState<any[]>([]);
  const [webhooks,  setWebhooks]  = useState<any[]>([]);
  const [pool,      setPool]      = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [toast,     setToast]     = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, payRes, subRes, comRes, outRes, whRes, poolRes] = await Promise.all([
        fetch('/api/stripe?type=overview', { credentials:'include' }).then(r => r.json()),
        fetch('/api/stripe?type=payments&limit=100', { credentials:'include' }).then(r => r.json()),
        fetch('/api/stripe?type=subscriptions', { credentials:'include' }).then(r => r.json()),
        fetch('/api/stripe?type=commissions', { credentials:'include' }).then(r => r.json()),
        fetch('/api/stripe?type=payouts', { credentials:'include' }).then(r => r.json()),
        fetch('/api/stripe?type=webhooks', { credentials:'include' }).then(r => r.json()),
        fetch('/api/stripe?type=impact_pool', { credentials:'include' }).then(r => r.json()),
      ]);
      setOverview(ovRes.data);
      setPayments(Array.isArray(payRes.data) ? payRes.data : []);
      setSubs(Array.isArray(subRes.data) ? subRes.data : []);
      setCommissions(Array.isArray(comRes.data) ? comRes.data : []);
      setPayouts(Array.isArray(outRes.data) ? outRes.data : []);
      setWebhooks(Array.isArray(whRes.data) ? whRes.data : []);
      setPool(Array.isArray(poolRes.data) ? poolRes.data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabs = [
    { id:'overview',    label:'Übersicht' },
    { id:'payments',    label:`Zahlungen (${payments.length})` },
    { id:'subs',        label:`Abos (${subs.length})` },
    { id:'commissions', label:`Provisionen (${commissions.length})` },
    { id:'payouts',     label:`Auszahlungen (${payouts.length})` },
    { id:'pool',        label:'Impact Pool' },
    { id:'webhooks',    label:`Webhooks (${webhooks.length})` },
  ];

  const th: React.CSSProperties = { padding:'10px 14px', textAlign:'left', fontSize:10,
    textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--text-muted)', fontWeight:600,
    borderBottom:'1px solid var(--border)', background:'var(--bg-tertiary)', whiteSpace:'nowrap' };
  const td: React.CSSProperties = { padding:'10px 14px', fontSize:12, color:'var(--text-primary)', whiteSpace:'nowrap' };

  return (
    <DashboardLayout title="Stripe">
      {toast && <div style={{ position:'fixed', top:20, right:20, zIndex:9999,
        background:'#51cf66', color:'#fff', padding:'10px 20px', borderRadius:8, fontSize:13, fontWeight:600 }}>{toast}</div>}

      <PageHeader title="💳 Stripe Dashboard" subtitle="Alle Zahlungen, Abos, Provisionen & Impact Pool"
        actionsRole={currentUser?.role as any} userRole={currentUser?.role ?? 'employee'} />

      {/* KPI Overview */}
      {overview && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
          {[
            { label:'Zahlungen gesamt', val: String(overview.total_payments ?? 0),    icon:'💳' },
            { label:'Gesamtvolumen',    val: eurDec(overview.total_volume_eur),        icon:'💰' },
            { label:'Aktive Abos',      val: String(overview.active_subs ?? 0),        icon:'🔄' },
            { label:'Impact Pool (Monat)', val: eurDec(overview.impact_pool_eur),     icon:'🌱' },
            { label:'Projekt-Anteil',   val: eurDec(overview.project_share_eur),       icon:'📊' },
            { label:'Provisionen offen',val: eurDec(overview.amb_pending_eur),         icon:'🤝' },
          ].map(k => (
            <div key={k.label} style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)',
              borderRadius:12, padding:'16px 18px' }}>
              <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase',
                letterSpacing:'0.6px', marginBottom:4 }}>{k.icon} {k.label}</div>
              <div style={{ fontSize:22, fontWeight:700, color:'var(--accent)',
                fontFamily:'var(--font-mono)' }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, flexWrap:'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding:'7px 14px', borderRadius:8, border:'1px solid var(--border)', cursor:'pointer',
            background: tab===t.id ? 'var(--accent)' : 'var(--bg-secondary)',
            color:       tab===t.id ? '#fff'          : 'var(--text-muted)',
            fontSize:12, fontWeight:600,
          }}>{t.label}</button>
        ))}
        <button onClick={load} style={{ marginLeft:'auto', padding:'7px 14px', borderRadius:8,
          border:'1px solid var(--border)', background:'var(--bg-secondary)', color:'var(--text-muted)',
          cursor:'pointer', fontSize:12 }}>🔄</button>
      </div>

      {loading && <div style={{ color:'var(--text-muted)', fontSize:13 }}>Laden…</div>}

      {/* ZAHLUNGEN */}
      {tab === 'payments' && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr>
              {['ID','Nutzer','Betrag','Typ','Status','Pool-Anteil','Amb-Anteil','Datum'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={td}><code style={{ fontSize:10 }}>{(p.id||'').slice(0,20)}…</code></td>
                  <td style={td}>{p.username ? `@${p.username}` : p.email || '—'}</td>
                  <td style={td}>{eurDec(p.amount_eur)}</td>
                  <td style={td}>{p.payment_type || '—'}</td>
                  <td style={td}><StatusBadge status={p.status} /></td>
                  <td style={td}>{eurDec(p.pool_share_eur)}</td>
                  <td style={td}>{eurDec(p.amb_share_eur)}</td>
                  <td style={td}>{fmtDate(p.created_at)}</td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign:'center', color:'var(--text-muted)' }}>Noch keine Zahlungen</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ABOS */}
      {tab === 'subs' && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Abo-ID','Nutzer','Plan','Betrag','Status','Läuft bis','Erstellt'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={td}><code style={{ fontSize:10 }}>{s.stripe_subscription_id?.slice(0,20)}…</code></td>
                  <td style={td}>{s.user_id?.slice(0,8)}…</td>
                  <td style={td}>{s.plan_name || s.stripe_price_id || '—'}</td>
                  <td style={td}>{eur(s.amount)}</td>
                  <td style={td}><StatusBadge status={s.status} /></td>
                  <td style={td}>{fmtDate(s.current_period_end)}</td>
                  <td style={td}>{fmtDate(s.created_at)}</td>
                </tr>
              ))}
              {subs.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign:'center', color:'var(--text-muted)' }}>Noch keine Abos</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* PROVISIONEN */}
      {tab === 'commissions' && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Ambassador','Betrag','Status','Erstellt'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {commissions.map(c => (
                <tr key={c.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={td}>{c.ambassador?.username ? `@${c.ambassador.username}` : c.ambassador_id?.slice(0,8)}</td>
                  <td style={td}>{eur(c.amount)}</td>
                  <td style={td}><StatusBadge status={c.status} /></td>
                  <td style={td}>{fmtDate(c.created_at)}</td>
                </tr>
              ))}
              {commissions.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign:'center', color:'var(--text-muted)' }}>Noch keine Provisionen</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* IMPACT POOL */}
      {tab === 'pool' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {pool.map(p => (
            <div key={p.id} style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontWeight:700, fontSize:15 }}>🌱 {p.month}</div>
                <StatusBadge status={p.distributed ? 'paid' : 'pending'} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                {[
                  { label:'Gesamt-Einfluss', val: eur(p.total_inflow) },
                  { label:'Projekt-Anteil (15%)', val: eur(p.project_share) },
                  { label:'Unternehmens-Anteil (85%)', val: eur(p.company_share) },
                ].map(s => (
                  <div key={s.label} style={{ background:'var(--bg-tertiary)', borderRadius:8, padding:'10px 14px' }}>
                    <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'var(--accent)' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {pool.length === 0 && <div style={{ color:'var(--text-muted)', textAlign:'center', fontSize:13, padding:40 }}>Noch keine Impact-Pool-Daten</div>}
        </div>
      )}

      {/* WEBHOOKS */}
      {tab === 'webhooks' && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Event-ID','Typ','Status','Fehler','Empfangen'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {webhooks.map(w => (
                <tr key={w.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={td}><code style={{ fontSize:10 }}>{w.stripe_event_id?.slice(0,20)}…</code></td>
                  <td style={td}><code style={{ fontSize:10 }}>{w.event_type}</code></td>
                  <td style={td}><StatusBadge status={w.status} /></td>
                  <td style={td} title={w.error_message || ''}>{w.error_message ? w.error_message.slice(0,40)+'…' : '—'}</td>
                  <td style={td}>{fmtDate(w.created_at)}</td>
                </tr>
              ))}
              {webhooks.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign:'center', color:'var(--text-muted)' }}>Noch keine Webhooks</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* AUSZAHLUNGEN */}
      {tab === 'payouts' && (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              {['Payout-ID','Betrag','Typ','Status','Ankunft','Erstellt'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {payouts.map(p => (
                <tr key={p.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={td}><code style={{ fontSize:10 }}>{p.stripe_payout_id?.slice(0,20)}…</code></td>
                  <td style={td}>{eur(p.amount)}</td>
                  <td style={td}>{p.payout_type || '—'}</td>
                  <td style={td}><StatusBadge status={p.status} /></td>
                  <td style={td}>{fmtDate(p.arrival_date)}</td>
                  <td style={td}>{fmtDate(p.created_at)}</td>
                </tr>
              ))}
              {payouts.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign:'center', color:'var(--text-muted)' }}>Noch keine Auszahlungen</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
