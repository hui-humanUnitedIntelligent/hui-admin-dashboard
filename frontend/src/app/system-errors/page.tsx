'use client';
// frontend/src/app/system-errors/page.tsx
// ── Systemfehler & White-Screens (2026-08-22) ────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';

interface SystemErrorReport {
  id: string; error_id: string; error_type: string; error_code: string | null;
  message: string | null; stack: string | null; filename: string | null;
  lineno: number | null; colno: number | null; route: string | null;
  component: string | null; device_model: string | null; os_version: string | null;
  app_version: string | null; browser_version: string | null; network_status: string | null;
  user_id: string | null; app_state: Record<string, unknown> | null;
  last_user_action: string | null; known_cause_id: number | null;
  known_cause_name: string | null; priority: string; frequency: number;
  fingerprint: string | null; status: string; admin_notes: string | null;
  created_at: string; updated_at: string;
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  CRITICAL: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'CRITICAL' },
  HIGH:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'HIGH' },
  MEDIUM:   { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'MEDIUM' },
  LOW:      { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', label: 'LOW' },
};
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  new: { color: '#F59E0B', label: 'Neu' }, investigating: { color: '#3B82F6', label: 'Untersuchung' },
  resolved: { color: '#10B981', label: 'Gelöst' }, ignored: { color: '#6B7280', label: 'Ignoriert' },
};
const ERROR_TYPE_LABELS: Record<string, string> = {
  white_screen: 'White Screen', chunk_load_error: 'Chunk Load Error', render_error: 'Render Error',
  uncaught: 'Uncaught Exception', unhandledrejection: 'Unhandled Promise',
  css_white_screen: 'CSS White Screen', ota_error: 'OTA Fehler', init_crash: 'Init Crash',
  custom: 'Benutzerdefiniert', diagnostic_test: 'Diagnose-Test',
};

export default function SystemErrorsPage() {
  const [reports, setReports] = useState<SystemErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [selected, setSelected] = useState<SystemErrorReport | null>(null);
  const [groupByFingerprint, setGroupByFingerprint] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterPriority !== 'all') params.set('priority', filterPriority);
      const res = await fetch('/api/system-errors?' + params.toString(), { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Laden fehlgeschlagen');
      setReports((json.data || []) as SystemErrorReport[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unbekannter Fehler'); }
    finally { setLoading(false); }
  }, [filterStatus, filterPriority]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    try {
      const res = await fetch('/api/system-errors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'update_status', status }) });
      if (!res.ok) throw new Error('Update fehlgeschlagen');
      setReports(prev => prev.map(r => r.id === id ? { ...r, status } as SystemErrorReport : r));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } as SystemErrorReport : null);
    } catch (e) { alert(e instanceof Error ? e.message : 'Fehler'); }
  }, [selected]);

  const deleteReport = useCallback(async (id: string) => {
    if (!confirm('Diesen Fehlerbericht wirklich löschen?')) return;
    try {
      const res = await fetch('/api/system-errors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error('Löschen fehlgeschlagen');
      setReports(prev => prev.filter(r => r.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) { alert(e instanceof Error ? e.message : 'Fehler'); }
  }, [selected]);

  const grouped = useCallback(() => {
    if (!groupByFingerprint) return reports;
    const map = new Map<string, SystemErrorReport[]>();
    reports.forEach(r => { const key = r.fingerprint || r.error_id; if (!map.has(key)) map.set(key, []); map.get(key)!.push(r); });
    return Array.from(map.values()).map(g => g.length === 1 ? g[0] : { ...g[0], frequency: g.length })
      .sort((a, b) => b.frequency - a.frequency || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [reports, groupByFingerprint]);

  const filtered = grouped();
  const stats = { total: reports.length, critical: reports.filter(r => r.priority === 'CRITICAL').length, high: reports.filter(r => r.priority === 'HIGH').length, newCount: reports.filter(r => r.status === 'new').length, resolved: reports.filter(r => r.status === 'resolved').length };
  const fmt = (iso: string) => { try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };

  return (
    <DashboardLayout>
      <PageHeader title="Systemfehler & White-Screens" subtitle="Automatische Fehlerberichte aus der App — errorReporter.js → Supabase" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[['Gesamt', stats.total, '#6C63FF'], ['Critical', stats.critical, '#EF4444'], ['High', stats.high, '#F59E0B'], ['Neu', stats.newCount, '#3B82F6'], ['Gelöst', stats.resolved, '#10B981']].map(([l, v, c]) => (
          <div key={l as string} style={{ padding: '14px 18px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: '#fff' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#888', fontWeight: 500 }}>{l as string}</p>
            <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 700, color: c as string }}>{v as number}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['all', 'Alle Status'], ['new', 'Neu'], ['investigating', 'Untersuchung'], ['resolved', 'Gelöst'], ['ignored', 'Ignoriert']].map(([k, l]) => (
          <button key={k as string} onClick={() => setFilterStatus(k as string)} style={{ padding: '6px 14px', borderRadius: 20, border: filterStatus === k ? 'none' : '1px solid rgba(0,0,0,0.1)', background: filterStatus === k ? '#16D7C5' : 'transparent', color: filterStatus === k ? '#fff' : 'inherit', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{l as string}</button>
        ))}
        <span style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.1)', margin: '0 4px' }} />
        {[['all', 'Alle Priorität'], ['CRITICAL', 'Critical'], ['HIGH', 'High'], ['MEDIUM', 'Medium'], ['LOW', 'Low']].map(([k, l]) => (
          <button key={k as string} onClick={() => setFilterPriority(k as string)} style={{ padding: '6px 14px', borderRadius: 20, border: filterPriority === k ? 'none' : '1px solid rgba(0,0,0,0.1)', background: filterPriority === k ? '#6C63FF' : 'transparent', color: filterPriority === k ? '#fff' : 'inherit', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{l as string}</button>
        ))}
        <span style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.1)', margin: '0 4px' }} />
        <button onClick={() => setGroupByFingerprint(!groupByFingerprint)} style={{ padding: '6px 14px', borderRadius: 20, border: groupByFingerprint ? 'none' : '1px solid rgba(0,0,0,0.1)', background: groupByFingerprint ? '#10B981' : 'transparent', color: groupByFingerprint ? '#fff' : 'inherit', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>{groupByFingerprint ? 'Gruppiert' : 'Einzeln'}</button>
      </div>
      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Lädt…</div>}
      {error && <div style={{ padding: 16, color: '#EF4444', background: 'rgba(239,68,68,0.08)', borderRadius: 12 }}>{error}</div>}
      {!loading && !error && (
        filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Keine Systemfehler vorhanden. Die App meldet automatisch Fehler an diese Seite.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
              <thead><tr style={{ borderBottom: '2px solid rgba(0,0,0,0.08)', textAlign: 'left' }}>
                <th style={{ padding: '10px 8px' }}>Priorität</th><th style={{ padding: '10px 8px' }}>Fehlertyp</th>
                <th style={{ padding: '10px 8px' }}>Nachricht</th><th style={{ padding: '10px 8px' }}>Route</th>
                <th style={{ padding: '10px 8px' }}>Gerät</th><th style={{ padding: '10px 8px' }}>Version</th>
                <th style={{ padding: '10px 8px' }}>Ursache</th><th style={{ padding: '10px 8px' }}>×Freq</th>
                <th style={{ padding: '10px 8px' }}>Zeit</th><th style={{ padding: '10px 8px' }}>Status</th>
                <th style={{ padding: '10px 8px' }}>Aktionen</th>
              </tr></thead>
              <tbody>{filtered.map(r => {
                const pc = PRIORITY_CONFIG[r.priority] || PRIORITY_CONFIG.LOW;
                const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.new;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', verticalAlign: 'top', cursor: 'pointer', background: r.priority === 'CRITICAL' ? 'rgba(239,68,68,0.03)' : 'transparent' }} onClick={() => setSelected(r)}>
                    <td style={{ padding: '10px 8px' }}><span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: pc.bg, color: pc.color }}>{pc.label}</span></td>
                    <td style={{ padding: '10px 8px', fontWeight: 600 }}>{ERROR_TYPE_LABELS[r.error_type] || r.error_type}{r.error_code && <div style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>{r.error_code}</div>}</td>
                    <td style={{ padding: '10px 8px', maxWidth: 250 }}><div style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.message || ''}>{r.message || '—'}</div></td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: '#666' }}>{r.route || '—'}</td>
                    <td style={{ padding: '10px 8px', fontSize: 12 }}><div>{r.device_model || '—'}</div><div style={{ fontSize: 11, color: '#888' }}>{r.os_version || ''}</div></td>
                    <td style={{ padding: '10px 8px', fontSize: 12 }}>{r.app_version || '—'}</td>
                    <td style={{ padding: '10px 8px' }}>{r.known_cause_name ? <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>#{r.known_cause_id} {r.known_cause_name}</span> : <span style={{ fontSize: 11, color: '#888' }}>—</span>}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>{r.frequency > 1 ? <span style={{ color: '#EF4444' }}>×{r.frequency}</span> : '1'}</td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: '#666' }}>{fmt(r.created_at)}</td>
                    <td style={{ padding: '10px 8px' }}><span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: sc.color + '20', color: sc.color }}>{sc.label}</span></td>
                    <td style={{ padding: '10px 8px' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button onClick={() => setSelected(r)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>Details</button>
                        {r.status !== 'resolved' && <button onClick={() => updateStatus(r.id, 'resolved')} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff', fontSize: 11, cursor: 'pointer' }}>Lösen</button>}
                        {r.status === 'new' && <button onClick={() => updateStatus(r.id, 'investigating')} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 11, cursor: 'pointer' }}>Unters.</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )
      )}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 700, width: '100%', maxHeight: '85vh', overflow: 'auto', padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div><h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{ERROR_TYPE_LABELS[selected.error_type] || selected.error_type}{selected.error_code && <span style={{ fontSize: 14, color: '#888', marginLeft: 8 }}>[{selected.error_code}]</span>}</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>ID: {selected.error_id.substring(0, 20)}… · {fmt(selected.created_at)}</p></div>
              <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {(() => { const pc = PRIORITY_CONFIG[selected.priority] || PRIORITY_CONFIG.LOW; const sc = STATUS_CONFIG[selected.status] || STATUS_CONFIG.new; return (<>
                <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: pc.bg, color: pc.color }}>{pc.label}</span>
                <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: sc.color + '20', color: sc.color }}>{sc.label}</span>
                {selected.known_cause_name && <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>#{selected.known_cause_id}: {selected.known_cause_name}</span>}
                {selected.frequency > 1 && <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>{selected.frequency}× aufgetreten</span>}
              </>); })()}
            </div>
            {selected.message && (<div style={{ marginBottom: 14 }}><p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fehlermeldung</p><pre style={{ margin: 0, fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#333' }}>{selected.message}</pre></div>)}
            {selected.stack && (<div style={{ marginBottom: 14 }}><p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Stacktrace</p><pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#666', maxHeight: 300, overflow: 'auto' }}>{selected.stack}</pre></div>)}
            <div style={{ marginBottom: 14 }}><p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Gerät & Umgebung</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                <div><span style={{ color: '#888' }}>Gerät:</span> <span style={{ fontWeight: 500 }}>{selected.device_model || '—'}</span></div>
                <div><span style={{ color: '#888' }}>OS:</span> <span style={{ fontWeight: 500 }}>{selected.os_version || '—'}</span></div>
                <div><span style={{ color: '#888' }}>Browser:</span> <span style={{ fontWeight: 500 }}>{selected.browser_version || '—'}</span></div>
                <div><span style={{ color: '#888' }}>App-Version:</span> <span style={{ fontWeight: 500 }}>{selected.app_version || '—'}</span></div>
                <div><span style={{ color: '#888' }}>Route:</span> <span style={{ fontWeight: 500 }}>{selected.route || '—'}</span></div>
                <div><span style={{ color: '#888' }}>Komponente:</span> <span style={{ fontWeight: 500 }}>{selected.component || '—'}</span></div>
                <div><span style={{ color: '#888' }}>Netzwerk:</span> <span style={{ fontWeight: 500 }}>{selected.network_status || '—'}</span></div>
                <div><span style={{ color: '#888' }}>Nutzer-ID:</span> <span style={{ fontWeight: 500 }}>{selected.user_id || '—'}</span></div>
                <div><span style={{ color: '#888' }}>Datei:</span> <span style={{ fontWeight: 500 }}>{selected.filename ? `${selected.filename}:${selected.lineno || '?'}:${selected.colno || '?'}` : '—'}</span></div>
                <div><span style={{ color: '#888' }}>Fingerprint:</span> <span style={{ fontWeight: 500, fontSize: 10 }}>{selected.fingerprint || '—'}</span></div>
              </div>
            </div>
            {selected.last_user_action && (<div style={{ marginBottom: 14 }}><p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Letzte Nutzer-Aktion</p><p style={{ margin: 0, fontSize: 12, color: '#333' }}>{selected.last_user_action}</p></div>)}
            {selected.app_state && (<div style={{ marginBottom: 14 }}><p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>App-State</p><pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#666', maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(selected.app_state, null, 2)}</pre></div>)}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selected.status !== 'resolved' && <button onClick={() => updateStatus(selected.id, 'resolved')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff', fontSize: 13, cursor: 'pointer' }}>Als gelöst markieren</button>}
                {selected.status === 'new' && <button onClick={() => updateStatus(selected.id, 'investigating')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 13, cursor: 'pointer' }}>In Untersuchung</button>}
                {selected.status !== 'ignored' && <button onClick={() => updateStatus(selected.id, 'ignored')} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: 'transparent', fontSize: 13, cursor: 'pointer' }}>Ignorieren</button>}
                <button onClick={() => deleteReport(selected.id)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #EF4444', background: 'transparent', color: '#EF4444', fontSize: 13, cursor: 'pointer' }}>Löschen</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
