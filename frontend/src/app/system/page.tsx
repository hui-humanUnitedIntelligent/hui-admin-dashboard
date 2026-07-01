'use client';
// frontend/src/app/system/page.tsx
// System Status + Stripe Datenfluss-Grafik
import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';

type CheckStatus = 'ok' | 'error' | 'unknown' | 'checking';
interface ServiceCheck { name: string; status: CheckStatus; latency: number | null; detail: string; }

function StatusDot({ status }: { status: CheckStatus }) {
  const c = { ok:'var(--green)', error:'var(--red)', unknown:'var(--text-muted)', checking:'var(--gold)' }[status];
  return <span style={{ display:'inline-block', width:9, height:9, borderRadius:'50%', background:c,
    boxShadow: status==='ok' ? `0 0 6px ${c}` : 'none',
    animation: status==='checking' ? 'pulse 1s ease-in-out infinite' : 'none' }} />;
}

function ServiceCard({ check }: { check: ServiceCheck }) {
  const isErr = check.status === 'error';
  return (
    <div style={{ padding:'18px 20px', borderRadius:10,
      border:`1px solid ${isErr ? 'var(--red)' : 'var(--border)'}`,
      background: isErr ? 'rgba(248,113,113,0.05)' : 'var(--bg-secondary)',
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <StatusDot status={check.status} />
        <div>
          <p style={{ margin:0, fontSize:14, fontWeight:600,
            color: isErr ? 'var(--red)' : 'var(--text-primary)' }}>{check.name}</p>
          <p style={{ margin:'2px 0 0', fontSize:12,
            color: isErr ? 'var(--red)' : 'var(--text-muted)' }}>{check.detail}</p>
        </div>
      </div>
      {check.latency !== null && (
        <span style={{ fontSize:12, fontWeight:600,
          color: check.latency>500 ? 'var(--gold)' : check.latency>200 ? 'var(--gold)' : 'var(--green)',
          background:'var(--bg-tertiary)', padding:'3px 8px', borderRadius:6, flexShrink:0 }}>
          {check.latency}ms
        </span>
      )}
    </div>
  );
}

// ── Stripe Datenfluss-Grafik ─────────────────────────────────────────────────
function StripeDataflow() {
  const [activeFlow, setActiveFlow] = useState<string | null>(null);

  const NODE = {
    app:      { label:'🎨 App',          sub:'Studio-Bereich',            color:'#6C63FF', bg:'rgba(108,99,255,0.12)' },
    web:      { label:'🌐 Webseite',      sub:'be-hui.com',                color:'#10B981', bg:'rgba(16,185,129,0.12)' },
    stripe:   { label:'💳 Stripe',        sub:'Payment Gateway',           color:'#635BFF', bg:'rgba(99,91,255,0.15)' },
    supabase: { label:'🗄️ Supabase',      sub:'DB + Webhooks + RPCs',      color:'#3ECF8E', bg:'rgba(62,207,142,0.12)' },
    sadb:     { label:'🛡️ SADB',          sub:'Super Admin Dashboard',     color:'#F59E0B', bg:'rgba(245,158,11,0.12)' },
    edb:      { label:'👔 EDB',           sub:'Employee Dashboard',         color:'#EF4444', bg:'rgba(239,68,68,0.12)' },
  };

  const FLOWS: Record<string, { from:string; to:string; label:string; color:string; events:string[] }> = {
    checkout: {
      from:'app', to:'stripe', label:'Checkout / Payment Intent / Subscription',
      color:'#6C63FF',
      events:['Stripe Checkout','Payment Intent','Subscription Create','Customer Create'],
    },
    web_stripe: {
      from:'web', to:'stripe', label:'Spenden / Impact Pool / Einmalzahlung / Abo',
      color:'#10B981',
      events:['Checkout Session','Donation','Impact Pool Payment','One-Time Payment'],
    },
    webhook: {
      from:'stripe', to:'supabase', label:'Webhooks → Supabase Sync',
      color:'#635BFF',
      events:['payment_intent.succeeded','payment_intent.payment_failed','charge.refunded',
              'customer.subscription.created','customer.subscription.updated',
              'customer.subscription.deleted','payout.paid','payout.failed'],
    },
    sadb_read: {
      from:'supabase', to:'sadb', label:'Alle Finanzdaten live',
      color:'#F59E0B',
      events:['stripe_payments','stripe_subscriptions','stripe_webhooks','stripe_payouts',
              'stripe_ambassador_commissions','stripe_impact_pool','rpc_get_stripe_overview',
              'rpc_get_stripe_payments'],
    },
    edb_read: {
      from:'supabase', to:'edb', label:'Ambassador-Provisionen & Auszahlungen',
      color:'#EF4444',
      events:['stripe_ambassador_commissions','stripe_payouts','rpc_get_ambassador_earnings'],
    },
    web_read: {
      from:'supabase', to:'web', label:'Impact Pool & Stats',
      color:'#10B981',
      events:['stripe_impact_pool','rpc_get_stripe_overview'],
    },
    app_read: {
      from:'supabase', to:'app', label:'Zahlungsstatus & Subscriptions',
      color:'#6C63FF',
      events:['stripe_payments','stripe_subscriptions','stripe_customers'],
    },
  };

  const TABLES = [
    { name:'stripe_customers',             icon:'👤', desc:'Stripe Customer IDs ↔ User IDs' },
    { name:'stripe_payments',              icon:'💰', desc:'Zahlungen + Pool/Amb-Anteile' },
    { name:'stripe_subscriptions',         icon:'🔄', desc:'Aktive & beendete Abos' },
    { name:'stripe_webhooks',              icon:'📡', desc:'Webhook-Log & Audit Trail' },
    { name:'stripe_payouts',               icon:'📤', desc:'Auszahlungen (Ambassador, Talent)' },
    { name:'stripe_ambassador_commissions',icon:'🤝', desc:'Provisions-Buchungen (5%)' },
    { name:'stripe_impact_pool',           icon:'🌱', desc:'Pool-Monat: 15% Projekt + 85% Firma' },
  ];

  const RPCS = [
    { name:'rpc_create_stripe_customer',       dir:'→ Stripe', desc:'Customer anlegen/prüfen' },
    { name:'rpc_record_payment',               dir:'← Webhook', desc:'Zahlung + Pool + Provision buchen' },
    { name:'rpc_record_webhook',               dir:'← Webhook', desc:'Event-Log speichern' },
    { name:'rpc_update_impact_pool',           dir:'← Webhook', desc:'Pool-Monat akkumulieren' },
    { name:'rpc_record_ambassador_commission', dir:'← Webhook', desc:'5%-Provision buchen' },
    { name:'rpc_get_stripe_overview',          dir:'→ SADB/EDB', desc:'KPI-Übersicht' },
    { name:'rpc_get_stripe_payments',          dir:'→ SADB', desc:'Zahlungsliste paginiert' },
    { name:'rpc_get_ambassador_earnings',      dir:'→ EDB', desc:'Provisions-Summen' },
    { name:'rpc_save_stripe_customer',         dir:'→ Supabase', desc:'Customer ID persistieren' },
  ];

  const activeFlowData = activeFlow ? FLOWS[activeFlow] : null;

  const box = (key: keyof typeof NODE) => {
    const n = NODE[key];
    const isActive = activeFlowData && (activeFlowData.from === key || activeFlowData.to === key);
    return (
      <div onClick={() => setActiveFlow(null)} style={{
        background: n.bg, border:`2px solid ${isActive ? n.color : n.color+'55'}`,
        borderRadius:14, padding:'14px 18px', textAlign:'center', cursor:'pointer',
        boxShadow: isActive ? `0 0 20px ${n.color}55` : 'none',
        transition:'all .25s ease', transform: isActive ? 'scale(1.04)' : 'scale(1)',
        minWidth:130,
      }}>
        <div style={{ fontSize:20, marginBottom:4 }}>{n.label.split(' ')[0]}</div>
        <div style={{ fontSize:13, fontWeight:700, color:n.color }}>{n.label.split(' ').slice(1).join(' ')}</div>
        <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>{n.sub}</div>
      </div>
    );
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

      {/* ── Grafik ── */}
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)',
        borderRadius:16, padding:'28px 24px' }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-muted)',
          textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:20 }}>
          💳 Stripe Systemarchitektur — Datenflüsse
        </div>

        {/* Top Row: App + Webseite */}
        <div style={{ display:'flex', justifyContent:'space-around', marginBottom:16 }}>
          {box('app')} {box('web')}
        </div>

        {/* Pfeile App/Web → Stripe */}
        <div style={{ display:'flex', justifyContent:'space-around', alignItems:'center',
          marginBottom:8, position:'relative' }}>
          {[
            { key:'checkout',   label:'Checkout / PaymentIntent' },
            { key:'web_stripe', label:'Spenden / Abos' },
          ].map(f => (
            <button key={f.key} onClick={() => setActiveFlow(activeFlow===f.key ? null : f.key)}
              style={{
                background: activeFlow===f.key ? FLOWS[f.key].color : 'var(--bg-tertiary)',
                border:`1px solid ${FLOWS[f.key].color}`,
                color: activeFlow===f.key ? '#fff' : FLOWS[f.key].color,
                borderRadius:20, padding:'4px 12px', fontSize:10, fontWeight:700,
                cursor:'pointer', transition:'all .2s',
              }}>
              ↓ {f.label}
            </button>
          ))}
        </div>

        {/* Stripe Node */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
          {box('stripe')}
        </div>

        {/* Stripe → Supabase */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
          <button onClick={() => setActiveFlow(activeFlow==='webhook' ? null : 'webhook')}
            style={{
              background: activeFlow==='webhook' ? '#635BFF' : 'var(--bg-tertiary)',
              border:'1px solid #635BFF', color: activeFlow==='webhook' ? '#fff' : '#635BFF',
              borderRadius:20, padding:'5px 16px', fontSize:11, fontWeight:700,
              cursor:'pointer', transition:'all .2s',
            }}>
            ↓ Webhooks (8 Events)
          </button>
        </div>

        {/* Supabase Node */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
          {box('supabase')}
        </div>

        {/* Supabase → 4 Ziele */}
        <div style={{ display:'flex', justifyContent:'space-around', marginBottom:8, flexWrap:'wrap', gap:8 }}>
          {[
            { key:'sadb_read', label:'→ SADB (alle Daten)' },
            { key:'edb_read',  label:'→ EDB (Provisionen)' },
            { key:'web_read',  label:'→ Website (Pool)' },
            { key:'app_read',  label:'→ App (Status)' },
          ].map(f => (
            <button key={f.key} onClick={() => setActiveFlow(activeFlow===f.key ? null : f.key)}
              style={{
                background: activeFlow===f.key ? FLOWS[f.key].color : 'var(--bg-tertiary)',
                border:`1px solid ${FLOWS[f.key].color}`,
                color: activeFlow===f.key ? '#fff' : FLOWS[f.key].color,
                borderRadius:20, padding:'4px 10px', fontSize:10, fontWeight:700,
                cursor:'pointer', transition:'all .2s',
              }}>↓ {f.label}</button>
          ))}
        </div>

        {/* Bottom Row: SADB + EDB + Web + App */}
        <div style={{ display:'flex', justifyContent:'space-around', flexWrap:'wrap', gap:12 }}>
          {(['sadb','edb','web','app'] as const).map(k => box(k))}
        </div>

        {/* Sync-Badge */}
        <div style={{ textAlign:'center', marginTop:16 }}>
          <span style={{ fontSize:11, color:'#3ECF8E', background:'rgba(62,207,142,0.12)',
            border:'1px solid rgba(62,207,142,0.3)', borderRadius:20, padding:'4px 14px', fontWeight:600 }}>
            🔄 SADB ↔ EDB ↔ App ↔ Webseite — Single Source of Truth: Supabase
          </span>
        </div>
      </div>

      {/* ── Aktiver Flow Detail ── */}
      {activeFlowData && (
        <div style={{ background:'var(--bg-secondary)', border:`1px solid ${activeFlowData.color}55`,
          borderRadius:14, padding:'20px 24px',
          boxShadow:`0 0 30px ${activeFlowData.color}22` }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <div style={{ width:12, height:12, borderRadius:'50%', background:activeFlowData.color,
              boxShadow:`0 0 8px ${activeFlowData.color}` }} />
            <span style={{ fontWeight:700, fontSize:14, color:activeFlowData.color }}>
              {NODE[activeFlowData.from as keyof typeof NODE]?.label} → {NODE[activeFlowData.to as keyof typeof NODE]?.label}
            </span>
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>{activeFlowData.label}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {activeFlowData.events.map(e => (
              <span key={e} style={{ fontSize:11, fontFamily:'monospace', padding:'4px 10px',
                background:`${activeFlowData.color}18`, border:`1px solid ${activeFlowData.color}44`,
                borderRadius:8, color:activeFlowData.color, fontWeight:600 }}>{e}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabellen ── */}
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)',
        borderRadius:16, padding:'20px 24px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)',
          textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:14 }}>
          🗄️ Supabase Stripe-Tabellen (7)
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:10 }}>
          {TABLES.map(t => (
            <div key={t.name} style={{ display:'flex', gap:10, alignItems:'flex-start',
              padding:'10px 14px', background:'var(--bg-tertiary)', borderRadius:10,
              border:'1px solid var(--border)' }}>
              <span style={{ fontSize:18, flexShrink:0 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize:11, fontFamily:'monospace', fontWeight:700,
                  color:'#3ECF8E' }}>{t.name}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RPCs ── */}
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)',
        borderRadius:16, padding:'20px 24px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)',
          textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:14 }}>
          ⚡ Supabase RPCs (9)
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {RPCS.map(r => (
            <div key={r.name} style={{ display:'flex', alignItems:'center', gap:12,
              padding:'10px 14px', background:'var(--bg-tertiary)', borderRadius:10,
              border:'1px solid var(--border)' }}>
              <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6,
                background:'rgba(99,91,255,0.15)', color:'#635BFF', flexShrink:0,
                minWidth:80, textAlign:'center' }}>{r.dir}</span>
              <code style={{ fontSize:11, color:'#3ECF8E', fontWeight:700, flex:1 }}>{r.name}</code>
              <span style={{ fontSize:11, color:'var(--text-muted)', textAlign:'right' }}>{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Finanzflüsse ── */}
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)',
        borderRadius:16, padding:'20px 24px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)',
          textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:14 }}>
          💰 Automatische Finanzflüsse bei jeder Zahlung
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:12 }}>
          {[
            { icon:'🌱', label:'Impact Pool', pct:'15%', color:'#3ECF8E',
              desc:'Davon 15% → Projekte, 85% → Unternehmen' },
            { icon:'🤝', label:'Ambassador-Provision', pct:'5%', color:'#F59E0B',
              desc:'Automatisch wenn User über Ambassador geworben' },
            { icon:'💳', label:'Werk / Talent-Einnahmen', pct:'80%', color:'#6C63FF',
              desc:'Hauptumsatz — Werke, Talente, Abos, Spenden' },
            { icon:'📤', label:'Auszahlungen', pct:'Auto', color:'#EF4444',
              desc:'Ambassador & Talent-Auszahlungen via Stripe Payouts' },
          ].map(f => (
            <div key={f.label} style={{ background:'var(--bg-tertiary)',
              border:`1px solid ${f.color}44`, borderRadius:12, padding:'14px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:20 }}>{f.icon}</span>
                <span style={{ fontSize:18, fontWeight:800, color:f.color, fontFamily:'monospace' }}>{f.pct}</span>
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:f.color, marginBottom:4 }}>{f.label}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Haupt-Seite ──────────────────────────────────────────────────────────────
const INITIAL: ServiceCheck[] = [
  { name:'Supabase DB',      status:'unknown', latency:null, detail:'Noch nicht geprüft' },
  { name:'Supabase Auth',    status:'unknown', latency:null, detail:'Noch nicht geprüft' },
  { name:'Supabase Storage', status:'unknown', latency:null, detail:'Noch nicht geprüft' },
  { name:'API REST Layer',   status:'unknown', latency:null, detail:'Noch nicht geprüft' },
  { name:'Dashboard Server', status:'unknown', latency:null, detail:'Noch nicht geprüft' },
];

export default function SystemPage() {
  const [checks,       setChecks]      = useState<ServiceCheck[]>(INITIAL);
  const [running,      setRunning]     = useState(false);
  const [lastRun,      setLastRun]     = useState<string | null>(null);
  const [autoRefresh,  setAutoRefresh] = useState(false);
  const [envVars,      setEnvVars]     = useState<{ key: string; value: string }[]>([]);
  const [activeTab,    setActiveTab]   = useState<'status'|'stripe'>('status');

  useEffect(() => {
    fetch('/api/system/env', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setEnvVars(d.data); })
      .catch(() => {});
  }, []);

  const runChecks = useCallback(async () => {
    setRunning(true);
    setChecks(INITIAL.map(c => ({ ...c, status:'checking' as CheckStatus, detail:'Prüfe…' })));
    const results: ServiceCheck[] = [...INITIAL];
    for (const [i, check] of [
      ['db','Supabase DB'],['auth','Supabase Auth'],['storage','Supabase Storage'],
      ['api','API REST Layer'],['server','Dashboard Server']
    ].entries()) {
      const t = Date.now();
      try {
        const r = await fetch(`/api/system/health?check=${check[0]}`, { credentials:'include' });
        const d = await r.json();
        results[i] = { name: check[1], status: d.ok ? 'ok' : 'error',
          latency: Date.now()-t,
          detail: d.ok ? (d.detail ?? 'OK') : (d.error ?? 'Fehler') };
      } catch (e) {
        results[i] = { name: check[1], status:'error', latency: Date.now()-t,
          detail: 'Nicht erreichbar: ' + (e instanceof Error ? e.message : 'Unbekannt') };
      }
    }
    setChecks(results);
    setLastRun(new Date().toLocaleTimeString('de-DE'));
    setRunning(false);
  }, []);

  useEffect(() => { runChecks(); }, [runChecks]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(runChecks, 60_000);
    return () => clearInterval(id);
  }, [autoRefresh, runChecks]);

  const allOk      = checks.every(c => c.status === 'ok');
  const hasError   = checks.some(c  => c.status === 'error');
  const errorCount = checks.filter(c => c.status === 'error').length;

  return (
    <DashboardLayout>
      <PageHeader
        title="System"
        subtitle="Status & Stripe Datenarchitektur"
        actions={
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12,
              color:'var(--text-muted)', cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox" checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                style={{ accentColor:'var(--accent)', width:14, height:14 }} />
              Auto (60s)
            </label>
            <button onClick={runChecks} disabled={running}
              style={{ padding:'0 14px', height:32, borderRadius:7, fontSize:12, fontWeight:600,
                cursor:'pointer', border:'1px solid var(--accent)', background:'transparent',
                color:'var(--accent)', opacity: running ? 0.5 : 1, whiteSpace:'nowrap' }}>
              {running ? '⏳ Prüfe…' : '↺ Alle prüfen'}
            </button>
          </div>
        }
      />

      <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* Tab-Leiste */}
        <div style={{ display:'flex', gap:4, borderBottom:'1px solid var(--border)', paddingBottom:1 }}>
          {([['status','🖥️ System Status'],['stripe','💳 Stripe Datenfluss']] as const).map(([id,label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ padding:'8px 18px', borderRadius:'8px 8px 0 0', border:'1px solid var(--border)',
                borderBottom: activeTab===id ? '1px solid var(--bg-secondary)' : '1px solid var(--border)',
                background: activeTab===id ? 'var(--bg-secondary)' : 'transparent',
                color: activeTab===id ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:'-1px' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── TAB: System Status ── */}
        {activeTab === 'status' && (
          <>
            {/* Status-Banner */}
            <div style={{ padding:'16px 20px', borderRadius:10,
              background: hasError ? 'rgba(248,113,113,0.1)' : allOk ? 'rgba(78,205,196,0.08)' : 'var(--bg-secondary)',
              border:`1px solid ${hasError ? 'var(--red)' : allOk ? 'var(--green)' : 'var(--border)'}`,
              display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:22 }}>{hasError ? '🔴' : allOk ? '✅' : '⏳'}</span>
              <div>
                <p style={{ margin:0, fontWeight:700, fontSize:15,
                  color: hasError ? 'var(--red)' : allOk ? 'var(--green)' : 'var(--text-primary)' }}>
                  {hasError ? `${errorCount} Dienst${errorCount>1?'e':''} nicht erreichbar`
                    : allOk ? 'Alle Systeme operational' : 'Prüfung läuft…'}
                </p>
                {lastRun && <p style={{ margin:'2px 0 0', fontSize:12, color:'var(--text-muted)' }}>Letzte Prüfung: {lastRun}</p>}
              </div>
            </div>

            {hasError && (
              <div style={{ padding:'14px 18px', borderRadius:9,
                background:'rgba(248,113,113,0.07)', border:'1px solid rgba(248,113,113,0.3)' }}>
                <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:'var(--red)',
                  textTransform:'uppercase', letterSpacing:'0.06em' }}>⚠ Verbindungsprobleme</p>
                {checks.filter(c => c.status==='error').map(c => (
                  <div key={c.name} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:4 }}>
                    <span style={{ fontSize:12, color:'var(--red)', fontWeight:600, minWidth:130 }}>{c.name}:</span>
                    <span style={{ fontSize:12, color:'var(--red)', opacity:0.8 }}>{c.detail}</span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p style={{ margin:'0 0 10px', fontSize:11, fontWeight:700, textTransform:'uppercase',
                letterSpacing:'0.07em', color:'var(--text-muted)' }}>Services</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {checks.map(c => <ServiceCard key={c.name} check={c} />)}
              </div>
            </div>

            {envVars.length > 0 && (
              <div>
                <p style={{ margin:'0 0 10px', fontSize:11, fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'0.07em', color:'var(--text-muted)' }}>Environment-Konfiguration</p>
                <div style={{ borderRadius:9, border:'1px solid var(--border)', overflow:'hidden' }}>
                  {envVars.map((e, i) => (
                    <div key={e.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'11px 16px',
                      background: i%2===0 ? 'var(--bg-secondary)' : 'transparent',
                      borderBottom: i<envVars.length-1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize:12, fontFamily:'monospace', color:'var(--text-secondary)' }}>{e.key}</span>
                      <span style={{ fontSize:12, fontWeight:600,
                        color: e.value.startsWith('https://') ? 'var(--accent)' : 'var(--green)' }}>
                        {e.value.startsWith('https://') ? e.value : '✅ Gesetzt'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TAB: Stripe Datenfluss ── */}
        {activeTab === 'stripe' && <StripeDataflow />}

      </div>
    </DashboardLayout>
  );
}
