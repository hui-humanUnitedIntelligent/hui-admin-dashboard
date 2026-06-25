'use client';
import { useRouter } from 'next/navigation';
// frontend/src/app/system/page.tsx

import { isSuperAdmin } from '@/lib/roles';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useSystemHealth, useKPIs } from '@/lib/hooks/useSupabase';
import { SUPABASE_URL, SUPABASE_ANON } from '@/lib/api';

type CheckStatus = 'ok' | 'error' | 'unknown' | 'checking';

interface ServiceCheck {
  name: string;
  status: CheckStatus;
  latency: number;
  detail: string;
}

function StatusDot({ status }: { status: CheckStatus }) {
  const colors: Record<CheckStatus, string> = {
    ok:       'var(--green)',
    error:    'var(--red)',
    unknown:  'var(--text-muted)',
    checking: 'var(--gold)',
  };
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: colors[status],
      animation: status === 'checking' ? 'pulse 1s ease-in-out infinite' : status === 'ok' ? 'blink 3s ease-in-out infinite' : 'none',
    }} />
  );
}

const INITIAL_CHECKS: ServiceCheck[] = [
  { name: 'Supabase DB',      status: 'checking', latency: 0, detail: 'Prüfe...' },
  { name: 'Supabase Auth',    status: 'checking', latency: 0, detail: 'Prüfe...' },
  { name: 'Supabase Storage', status: 'checking', latency: 0, detail: 'Prüfe...' },
  { name: 'API REST Layer',   status: 'checking', latency: 0, detail: 'Prüfe...' },
];

export default function SystemPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isSuperAdmin(currentUser?.role)) router.replace("/dashboard");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.role]);
  if (!isSuperAdmin(currentUser?.role)) return null;

  const userRole = currentUser?.role;
  const health = useSystemHealth();
  const kpis   = useKPIs();
  const [checks, setChecks] = useState<ServiceCheck[]>(INITIAL_CHECKS);

  const runChecks = useCallback(async () => {
    setChecks(INITIAL_CHECKS.map((c) => ({ ...c, status: 'checking' as CheckStatus })));

    const results: ServiceCheck[] = [...INITIAL_CHECKS];

    // 1. Check DB
    const t0 = Date.now();
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      });
      results[0] = { name: 'Supabase DB', status: r.ok ? 'ok' : 'error', latency: Date.now() - t0, detail: r.ok ? `HTTP ${r.status}` : `Fehler ${r.status}` };
    } catch (e: unknown) {
      results[0] = { name: 'Supabase DB', status: 'error', latency: Date.now() - t0, detail: (e as Error).message };
    }

    // 2. Check Auth
    const t1 = Date.now();
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: SUPABASE_ANON },
      });
      results[1] = { name: 'Supabase Auth', status: r.ok ? 'ok' : 'error', latency: Date.now() - t1, detail: r.ok ? 'Healthy' : `HTTP ${r.status}` };
    } catch (e: unknown) {
      results[1] = { name: 'Supabase Auth', status: 'error', latency: Date.now() - t1, detail: (e as Error).message };
    }

    // 3. Check Storage
    const t2 = Date.now();
    try {
      const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
      });
      results[2] = { name: 'Supabase Storage', status: r.ok ? 'ok' : 'error', latency: Date.now() - t2, detail: r.ok ? 'Reachable' : `HTTP ${r.status}` };
    } catch (e: unknown) {
      results[2] = { name: 'Supabase Storage', status: 'error', latency: Date.now() - t2, detail: (e as Error).message };
    }

    // 4. Config check
    results[3] = {
      name: 'API REST Layer',
      status: SUPABASE_URL ? 'ok' : 'error',
      latency: 0,
      detail: SUPABASE_URL ? 'Konfiguriert' : 'NEXT_PUBLIC_SUPABASE_URL fehlt',
    };

    setChecks(results);
  }, []);

  useEffect(() => { runChecks(); }, [runChecks]);

  const allOk = checks.every((c) => c.status === 'ok');

  return (
    <DashboardLayout
      title="System Status"
      headerActions={
        <button onClick={runChecks} style={{ padding: '5px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
          
      <PageHeader
        title="System-Status"
        subtitle="Datenbankverbindung & Health-Checks"
        actionsRole="superadmin"
        userRole={userRole}
      />

↻ Alle prüfen
        </button>
      }
    >
      {/* Overall Status */}
      <div style={{
        background: allOk ? 'rgba(81,207,102,0.08)' : 'rgba(255,107,107,0.08)',
        border: `1px solid ${allOk ? 'rgba(81,207,102,0.3)' : 'rgba(255,107,107,0.3)'}`,
        borderRadius: 12, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18,
      }}>
        <div style={{ fontSize: 28 }}>{allOk ? '✅' : '⚠️'}</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: allOk ? 'var(--green)' : 'var(--red)' }}>
            {allOk ? 'Alle Systeme operational' : 'Probleme erkannt'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            Letzte Prüfung: gerade eben · DB-Latenz: {health.latency}ms
          </div>
        </div>
      </div>

      {/* Service Checks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 18 }} className="grid-2-1">
        {checks.map((c) => (
          <div key={c.name} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusDot status={c.status} />
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</span>
              </div>
              {c.latency > 0 && (
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: c.latency < 200 ? 'var(--green)' : c.latency < 500 ? 'var(--gold)' : 'var(--red)' }}>
                  {c.latency}ms
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: c.status === 'error' ? 'var(--red)' : 'var(--text-muted)' }}>
              {c.detail}
            </div>
          </div>
        ))}
      </div>

      {/* Platform Stats */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 14 }}>
          Plattform-Statistiken (Live)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }} className="grid-4">
          {[
            { label: 'User gesamt',      value: kpis.loading ? '…' : kpis.totalUsers.toLocaleString('de-DE'),   color: 'var(--accent)' },
            { label: 'Aktive Wirker',    value: kpis.loading ? '…' : kpis.activeWirker.toLocaleString('de-DE'), color: 'var(--purple)' },
            { label: 'Works publiziert', value: kpis.loading ? '…' : kpis.totalWorks.toLocaleString('de-DE'),   color: 'var(--gold)' },
            { label: 'Mitglieder',       value: kpis.loading ? '…' : kpis.activeMembers.toLocaleString('de-DE'),color: 'var(--green)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: 14, background: 'var(--bg-tertiary)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Env Config */}
      <div style={{ marginTop: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
          Environment-Konfiguration
        </div>
        {([
          ['NEXT_PUBLIC_SUPABASE_URL',              SUPABASE_URL ? '✅ Gesetzt'       : '❌ Fehlt'],
          ['NEXT_PUBLIC_SUPABASE_ANON_KEY',          SUPABASE_ANON ? '✅ Gesetzt'     : '❌ Fehlt'],
          ['NEXT_PUBLIC_API_URL',                    process.env.NEXT_PUBLIC_API_URL ? `✅ ${process.env.NEXT_PUBLIC_API_URL}` : 'ℹ️ Nicht gesetzt (Supabase-Modus)'],
        ] as [string, string][]).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: 11 }}>{key}</span>
            <span style={{ color: val.startsWith('✅') ? 'var(--green)' : val.startsWith('❌') ? 'var(--red)' : 'var(--gold)', fontSize: 11 }}>{val}</span>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
