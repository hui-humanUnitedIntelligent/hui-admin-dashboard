'use client';
// frontend/src/app/system/page.tsx
import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';

// ─── Typen ────────────────────────────────────────────────────────────────────
type CheckStatus = 'ok' | 'error' | 'unknown' | 'checking';

interface ServiceCheck {
  name: string;
  status: CheckStatus;
  latency: number | null;
  detail: string;
}

// ─── Status-Punkt ─────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: CheckStatus }) {
  const c = { ok:'var(--green)', error:'var(--red)', unknown:'var(--text-muted)', checking:'var(--gold)' }[status];
  return (
    <span style={{ display:'inline-block', width:9, height:9, borderRadius:'50%', background:c,
      boxShadow: status === 'ok' ? `0 0 6px ${c}` : 'none',
      animation: status === 'checking' ? 'pulse 1s ease-in-out infinite' : 'none',
    }} />
  );
}

// ─── Service-Karte ────────────────────────────────────────────────────────────
function ServiceCard({ check }: { check: ServiceCheck }) {
  const isErr = check.status === 'error';
  return (
    <div style={{ padding:'18px 20px', borderRadius:10, border:`1px solid ${isErr ? 'var(--red)' : 'var(--border)'}`,
      background: isErr ? 'rgba(248,113,113,0.05)' : 'var(--bg-secondary)',
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <StatusDot status={check.status} />
        <div>
          <p style={{ margin:0, fontSize:14, fontWeight:600, color: isErr ? 'var(--red)' : 'var(--text-primary)' }}>
            {check.name}
          </p>
          <p style={{ margin:'2px 0 0', fontSize:12, color: isErr ? 'var(--red)' : 'var(--text-muted)' }}>
            {check.detail}
          </p>
        </div>
      </div>
      {check.latency !== null && (
        <span style={{ fontSize:12, fontWeight:600,
          color: check.latency > 500 ? 'var(--gold)' : check.latency > 200 ? 'var(--gold)' : 'var(--green)',
          background:'var(--bg-tertiary)', padding:'3px 8px', borderRadius:6, flexShrink:0 }}>
          {check.latency}ms
        </span>
      )}
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
  const [checks,  setChecks]  = useState<ServiceCheck[]>(INITIAL);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);

  // Env-Vars via API laden
  useEffect(() => {
    fetch('/api/system/env', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setEnvVars(d.data); })
      .catch(() => {});
  }, []);

  const runChecks = useCallback(async () => {
    setRunning(true);
    setChecks(INITIAL.map(c => ({ ...c, status: 'checking' as CheckStatus, detail: 'Prüfe…' })));

    const results: ServiceCheck[] = [...INITIAL];

    // 1. Supabase DB — via interne API um CORS/Key zu vermeiden
    const t0 = Date.now();
    try {
      const r = await fetch('/api/system/health?check=db', { credentials: 'include' });
      const d = await r.json();
      results[0] = { name:'Supabase DB', status: d.ok ? 'ok' : 'error',
        latency: Date.now() - t0, detail: d.ok ? `HTTP 200 — ${d.rows ?? 0} Profile` : d.error ?? 'Fehler' };
    } catch (e) {
      results[0] = { name:'Supabase DB', status:'error', latency: Date.now()-t0,
        detail: 'Verbindung unterbrochen: ' + (e instanceof Error ? e.message : 'Unbekannt') };
    }

    // 2. Supabase Auth
    const t1 = Date.now();
    try {
      const r = await fetch('/api/system/health?check=auth', { credentials: 'include' });
      const d = await r.json();
      results[1] = { name:'Supabase Auth', status: d.ok ? 'ok' : 'error',
        latency: Date.now()-t1, detail: d.ok ? 'Healthy' : d.error ?? 'Auth-Dienst nicht erreichbar' };
    } catch (e) {
      results[1] = { name:'Supabase Auth', status:'error', latency: Date.now()-t1,
        detail: 'Verbindung unterbrochen: ' + (e instanceof Error ? e.message : 'Unbekannt') };
    }

    // 3. Supabase Storage
    const t2 = Date.now();
    try {
      const r = await fetch('/api/system/health?check=storage', { credentials: 'include' });
      const d = await r.json();
      results[2] = { name:'Supabase Storage', status: d.ok ? 'ok' : 'error',
        latency: Date.now()-t2, detail: d.ok ? 'Reachable' : d.error ?? 'Storage nicht erreichbar' };
    } catch (e) {
      results[2] = { name:'Supabase Storage', status:'error', latency: Date.now()-t2,
        detail: 'Verbindung unterbrochen: ' + (e instanceof Error ? e.message : 'Unbekannt') };
    }

    // 4. API REST Layer (intern)
    const t3 = Date.now();
    try {
      const r = await fetch('/api/system/health?check=api', { credentials: 'include' });
      const d = await r.json();
      results[3] = { name:'API REST Layer', status: d.ok ? 'ok' : 'error',
        latency: Date.now()-t3, detail: d.ok ? 'Konfiguriert & erreichbar' : d.error ?? 'API nicht erreichbar' };
    } catch (e) {
      results[3] = { name:'API REST Layer', status:'error', latency: Date.now()-t3,
        detail: 'Server nicht erreichbar: ' + (e instanceof Error ? e.message : 'Unbekannt') };
    }

    // 5. Dashboard Server selbst
    const t4 = Date.now();
    try {
      const r = await fetch('/api/system/health?check=server', { credentials: 'include' });
      const d = await r.json();
      results[4] = { name:'Dashboard Server', status: d.ok ? 'ok' : 'error',
        latency: Date.now()-t4, detail: d.ok ? `Next.js v${d.version ?? '?'} — OK` : d.error ?? 'Fehler' };
    } catch (e) {
      results[4] = { name:'Dashboard Server', status:'error', latency: Date.now()-t4,
        detail: 'Dashboard nicht erreichbar: ' + (e instanceof Error ? e.message : 'Unbekannt') };
    }

    setChecks(results);
    setLastRun(new Date().toLocaleTimeString('de-DE'));
    setRunning(false);
  }, []);

  // Beim Laden direkt prüfen
  useEffect(() => { runChecks(); }, [runChecks]);

  // Auto-Refresh alle 60s
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(runChecks, 60_000);
    return () => clearInterval(id);
  }, [autoRefresh, runChecks]);

  const allOk    = checks.every(c => c.status === 'ok');
  const hasError = checks.some(c  => c.status === 'error');
  const errorCount = checks.filter(c => c.status === 'error').length;

  return (
    <DashboardLayout>
      <PageHeader
        title="System Status"
        subtitle="Datenbankverbindung & Health-Checks"
        actions={
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12,
              color:'var(--text-muted)', cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox" checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                style={{ accentColor:'var(--accent)', width:14, height:14 }}
              />
              Auto (60s)
            </label>
            <button onClick={runChecks} disabled={running}
              style={{ padding:'7px 16px', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer',
                border:'1px solid var(--accent)', background:'transparent', color:'var(--accent)',
                opacity: running ? 0.5 : 1 }}>
              {running ? '⏳ Prüfe…' : '↺ Alle prüfen'}
            </button>
          </div>
        }
      />

      <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:20 }}>

        {/* Status-Banner */}
        <div style={{ padding:'16px 20px', borderRadius:10,
          background: hasError ? 'rgba(248,113,113,0.1)' : allOk ? 'rgba(78,205,196,0.08)' : 'var(--bg-secondary)',
          border: `1px solid ${hasError ? 'var(--red)' : allOk ? 'var(--green)' : 'var(--border)'}`,
          display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:22 }}>{hasError ? '🔴' : allOk ? '✅' : '⏳'}</span>
          <div>
            <p style={{ margin:0, fontWeight:700, fontSize:15,
              color: hasError ? 'var(--red)' : allOk ? 'var(--green)' : 'var(--text-primary)' }}>
              {hasError
                ? `${errorCount} Dienst${errorCount > 1 ? 'e' : ''} nicht erreichbar`
                : allOk ? 'Alle Systeme operational'
                : 'Prüfung läuft…'}
            </p>
            {lastRun && (
              <p style={{ margin:'2px 0 0', fontSize:12, color:'var(--text-muted)' }}>
                Letzte Prüfung: {lastRun}
              </p>
            )}
          </div>
        </div>

        {/* Fehler-Detail-Box */}
        {hasError && (
          <div style={{ padding:'14px 18px', borderRadius:9, background:'rgba(248,113,113,0.07)',
            border:'1px solid rgba(248,113,113,0.3)' }}>
            <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:'var(--red)',
              textTransform:'uppercase', letterSpacing:'0.06em' }}>⚠ Verbindungsprobleme</p>
            {checks.filter(c => c.status === 'error').map(c => (
              <div key={c.name} style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:4 }}>
                <span style={{ fontSize:12, color:'var(--red)', fontWeight:600, minWidth:130 }}>{c.name}:</span>
                <span style={{ fontSize:12, color:'var(--red)', opacity:0.8 }}>{c.detail}</span>
              </div>
            ))}
          </div>
        )}

        {/* Service Cards 2×2 Grid */}
        <div>
          <p style={{ margin:'0 0 10px', fontSize:11, fontWeight:700, textTransform:'uppercase',
            letterSpacing:'0.07em', color:'var(--text-muted)' }}>Services</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {checks.map(c => <ServiceCard key={c.name} check={c} />)}
          </div>
        </div>

        {/* Environment-Konfiguration */}
        {envVars.length > 0 && (
          <div>
            <p style={{ margin:'0 0 10px', fontSize:11, fontWeight:700, textTransform:'uppercase',
              letterSpacing:'0.07em', color:'var(--text-muted)' }}>Environment-Konfiguration</p>
            <div style={{ borderRadius:9, border:'1px solid var(--border)', overflow:'hidden' }}>
              {envVars.map((e, i) => (
                <div key={e.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'11px 16px', background: i%2===0 ? 'var(--bg-secondary)' : 'transparent',
                  borderBottom: i < envVars.length-1 ? '1px solid var(--border)' : 'none' }}>
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

      </div>
    </DashboardLayout>
  );
}
