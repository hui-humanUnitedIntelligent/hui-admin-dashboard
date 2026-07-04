// frontend/src/components/views/ReportsView.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { showToast } from '@/components/ui/Toast';

interface PeriodReport {
  period: string;
  new_users: number; new_wirker: number; new_members: number;
  new_works: number; new_bookings: number; transactions: number;
  revenue: number; impact_pool: number; net_impact: number; company_share: number;
}
interface ReportData { type: string; periods: PeriodReport[]; totals: { users: number; wirker: number; members: number; works: number; bookings: number }; generated_at: string; }

function fmtEur(n: number) { return `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`; }
function periodLabel(p: string) {
  if (p.includes('W')) { const [y, w] = p.split('-W'); return `KW${w} '${y.slice(2)}`; }
  const d = new Date(p + '-01');
  return d.toLocaleString('de-DE', { month: 'short', year: '2-digit' });
}
function now() { return new Date().toLocaleString('de-DE'); }

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 28, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function ReportsView({ role }: { role: 'superadmin' | 'employee' }) {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;
  const [data, setData]       = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType]       = useState<'monthly' | 'weekly'>('monthly');
  const [periods, setPeriods] = useState(6);
  const [sending, setSending] = useState(false);
  const [email, setEmail]     = useState('');
  const [showEmail, setShowEmail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?type=${type}&periods=${periods}`, { credentials: 'include' });
      const json = await res.json();
      // API gibt { data: { periods, totals, ... } } zurück
      setData(json?.data ?? json ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [type, periods]);

  useEffect(() => { load(); }, [load]);

  // Download report as text
  const downloadReport = () => {
    if (!data) return;
    const lines: string[] = [
      '╔══════════════════════════════════════════════════════════════╗',
      `║  HUI Admin — ${type === 'monthly' ? 'Monats' : 'Wochen'}-Report`,
      `║  Erstellt: ${now()}`,
      '╚══════════════════════════════════════════════════════════════╝',
      '',
      '── GESAMTÜBERSICHT ────────────────────────────────────────────',
      `  User gesamt:    ${(data?.totals?.users ?? 0)}`,
      `  Wirker:         ${(data?.totals?.wirker ?? 0)}`,
      `  Members:        ${(data?.totals?.members ?? 0)}`,
      `  Werke:          ${(data?.totals?.works ?? 0)}`,
      `  Buchungen:      ${(data?.totals?.bookings ?? 0)}`,
      '',
      `── PERIODEN (${type === 'monthly' ? 'Monatlich' : 'Wöchentlich'}) ──────────────────────────────────────`,
    ];
    for (const p of data.periods) {
      lines.push('');
      lines.push(`  ┌─ ${periodLabel(p.period)} (${p.period})`);
      lines.push(`  │  Neue User:     ${p.new_users}  (Wirker: ${p.new_wirker}, Member: ${p.new_members})`);
      lines.push(`  │  Neue Werke:    ${p.new_works}`);
      lines.push(`  │  Buchungen:     ${p.new_bookings}`);
      lines.push(`  │  Transaktionen: ${p.transactions}`);
      lines.push(`  │  Umsatz:        ${fmtEur(p.revenue)}`);
      lines.push(`  │  Impact Pool:   ${fmtEur(p.impact_pool)} (Netto: ${fmtEur(p.net_impact)}, Firma: ${fmtEur(p.company_share)})`);
      lines.push(`  └─`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `hui-report-${type}-${new Date().toISOString().slice(0,10)}.txt`; a.click();
    URL.revokeObjectURL(url);
    showToast('Report heruntergeladen', 'success');
  };

  // Send via broadcast
  const sendReport = async () => {
    if (!data || !email.trim()) { showToast('Empfänger-Email erforderlich', 'error'); return; }
    setSending(true);
    const latest = data.periods[(data?.periods?.length ?? 0) - 1];
    const bodyText = latest
      ? `📊 ${type === 'monthly' ? 'Monats' : 'Wochen'}-Report ${periodLabel(latest.period)}\n\n` +
        `👥 Neue User: ${latest.new_users} | ⭐ Wirker: ${latest.new_wirker} | 🏅 Members: ${latest.new_members}\n` +
        `🎨 Werke: ${latest.new_works} | 📅 Buchungen: ${latest.new_bookings}\n` +
        `💶 Umsatz: ${fmtEur(latest.revenue)} | 🌱 Impact: ${fmtEur(latest.net_impact)}\n\n` +
        `Report erstellt am ${now()}`
      : 'Kein Report-Daten verfügbar.';

    // Send as broadcast to admins
    const res = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `📊 HUI ${type === 'monthly' ? 'Monats' : 'Wochen'}-Report`, body: bodyText, target_group: 'admins' }),
    });
    setSending(false);
    if (res.ok) { showToast('Report als Broadcast an Admins gesendet ✅', 'success'); setShowEmail(false); }
    else showToast('Fehler beim Senden', 'error');
  };

  const latest = data?.periods?.[(data?.periods?.length ?? 0) - 1];
  const maxRevenue = Math.max(...(data?.periods?.map(p => p.revenue) || [1]), 1);
  const maxUsers   = Math.max(...(data?.periods?.map(p => p.new_users) || [1]), 1);

  const tabBtn = (v: typeof type, l: string) => (
    <button onClick={() => setType(v)} style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid', borderColor: type === v ? 'var(--accent)' : 'var(--border)', background: type === v ? 'var(--accent-dim)' : 'transparent', color: type === v ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)' }}>{l}</button>
  );

  return (
    <DashboardLayout
      employeeMode={role === 'employee'}
      title="Automatische Reports"
    >
      <PageHeader
        title="Reports"
        subtitle={role === 'employee' ? 'Berichte & Auswertungen' : 'Automatisierte Berichte'}
        actionsRole={role === 'employee' ? 'employee' : 'admin'}
        userRole={userRole}
        actions={
          <>
            {tabBtn('monthly', 'Monatlich')} {tabBtn('weekly', 'Wöchentlich')}
            <select value={periods} onChange={e => setPeriods(Number(e.target.value))} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)', outline: 'none' }}>
              <option value={3}>3 Perioden</option>
              <option value={6}>6 Perioden</option>
              <option value={12}>12 Perioden</option>
            </select>
            <button onClick={downloadReport} disabled={!data} style={{ padding: '5px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>📥 Download</button>
            <button onClick={() => setShowEmail(p => !p)} style={{ padding: '5px 12px', background: 'var(--accent)', border: 'none', borderRadius: 8, fontSize: 11, color: '#0F1117', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-body)' }}>📨 Senden</button>
            <button onClick={load} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻</button>
          </>
        }
      />

      {/* Send modal */}
      {showEmail && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)', borderRadius: 12, padding: 18, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', animation: 'fadeIn 0.2s ease-out' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>📨 Report als Broadcast an alle Admins senden:</span>
          <button onClick={sendReport} disabled={sending} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0F1117', cursor: sending ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', opacity: sending ? 0.6 : 1 }}>
            {sending ? '…' : '✅ Jetzt senden'}
          </button>
          <button onClick={() => setShowEmail(false)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)' }}>Abbrechen</button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Lade Report-Daten…</div>
      ) : !data ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Fehler beim Laden</div>
      ) : (
        <>
          {/* Totals Row */}
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {[
              { label: 'User gesamt', value: (data?.totals?.users ?? 0),    color: 'var(--accent)', icon: '◎' },
              { label: 'Wirker',      value: (data?.totals?.wirker ?? 0),   color: 'var(--purple)', icon: '⭐' },
              { label: 'Members',     value: (data?.totals?.members ?? 0),  color: 'var(--gold)',   icon: '🏅' },
              { label: 'Werke',       value: (data?.totals?.works ?? 0),    color: 'var(--blue)',   icon: '🎨' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderTop: `3px solid ${color}` }}>
                <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 4 }}>{icon} {label}</div>
              </div>
            ))}
          </div>

          {/* Latest period highlight */}
          {latest && (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)', borderRadius: 12, padding: 20, marginBottom: 16, borderLeft: '4px solid var(--accent)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                📊 Aktueller Zeitraum — {periodLabel(latest.period)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                {[
                  { label: 'Neue User',    value: latest.new_users,    color: 'var(--accent)', fmt: String },
                  { label: 'Wirker',       value: latest.new_wirker,   color: 'var(--purple)', fmt: String },
                  { label: 'Neue Werke',   value: latest.new_works,    color: 'var(--blue)',   fmt: String },
                  { label: 'Buchungen',    value: latest.new_bookings, color: 'var(--gold)',   fmt: String },
                  { label: 'Umsatz',       value: latest.revenue,      color: 'var(--green)',  fmt: fmtEur },
                  { label: 'Impact Netto', value: latest.net_impact,   color: 'var(--green)',  fmt: fmtEur },
                ].map(({ label, value, color, fmt }) => (
                  <div key={label}>
                    <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{fmt(value as number)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Period Table */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              📅 Perioden-Übersicht
            </div>
            <div className="table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)' }}>
                    {['Zeitraum','Neue User','Wirker','Members','Werke','Buchungen','Umsatz','Impact','Netto-Impact'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {([...(data?.periods ?? [])]).reverse().map((p, i) => (
                    <tr key={p.period} className="tr-hover" style={{ background: i === 0 ? 'var(--accent-dim)' : 'transparent' }}>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontWeight: 700, color: i === 0 ? 'var(--accent)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {periodLabel(p.period)} {i === 0 && <span style={{ fontSize: 9, color: 'var(--accent)', marginLeft: 4 }}>← aktuell</span>}
                      </td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 600 }}>{p.new_users}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', color: 'var(--purple)' }}>{p.new_wirker}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', color: 'var(--gold)' }}>{p.new_members}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{p.new_works}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{p.new_bookings}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{fmtEur(p.revenue)}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{fmtEur(p.impact_pool)}</td>
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{fmtEur(p.net_impact)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bar visual */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="grid-2">
            {[
              { title: '👥 Neue User pro Periode', key: 'new_users' as const, max: maxUsers, color: 'var(--accent)' },
              { title: '💶 Umsatz pro Periode',    key: 'revenue'   as const, max: maxRevenue, color: 'var(--green)' },
            ].map(({ title, key, max, color }) => (
              <div key={title} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>{title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(data?.periods ?? []).map(p => (
                    <div key={p.period} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 48, flexShrink: 0 }}>{periodLabel(p.period)}</span>
                      <MiniBar value={p[key]} max={max} color={color} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>
            Zuletzt generiert: {new Date(data.generated_at).toLocaleString('de-DE')}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
