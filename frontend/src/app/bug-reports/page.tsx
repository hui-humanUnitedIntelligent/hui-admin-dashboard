'use client';
// frontend/src/app/bug-reports/page.tsx
// ── Superadmin Dashboard: Fehlermeldungen der Nutzer (2026-08-19) ──────────────
import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { supabase } from '@/lib/supabase';

interface Attachment { name: string; url: string; type: string; size: number; }

interface BugReport {
  id: string;
  user_id: string | null;
  username: string | null;
  email: string | null;
  device_model: string | null;
  device_os: string | null;
  app_version: string | null;
  description: string;
  attachments: Attachment[];
  status: 'offen' | 'in_bearbeitung' | 'gelöst';
  category: string;
  source: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  offen:          { label: 'Offen',          color: '#F59E0B' },
  in_bearbeitung: { label: 'In Bearbeitung', color: '#3B82F6' },
  gelöst:         { label: 'Gelöst',         color: '#10B981' },
};

export default function BugReportsPage() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setReports((data || []) as BugReport[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    try {
      const res = await fetch('/api/bug-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'update_status', status }),
      });
      if (!res.ok) throw new Error('Update fehlgeschlagen');
      
      // Log event
      await supabase.rpc('rpc_log_bug_report_event', {
        p_event_type: status === 'gelöst' ? 'bug_report_closed' : 'bug_report_opened',
        p_bug_report_id: id,
        p_actor_type: 'admin',
        p_payload: { status },
      });

      setReports(prev => prev.map(r => r.id === id ? { ...r, status: status as BugReport['status'] } : r));
      if (selectedReport?.id === id) {
        setSelectedReport(prev => prev ? { ...prev, status: status as BugReport['status'] } : null);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Fehler beim Aktualisieren');
    }
  }, [selectedReport]);

  const deleteReport = useCallback(async (id: string) => {
    if (!confirm('Diese Fehlermeldung wirklich löschen?')) return;
    try {
      const res = await fetch('/api/bug-reports', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Löschen fehlgeschlagen');

      // Log event
      await supabase.rpc('rpc_log_bug_report_event', {
        p_event_type: 'bug_report_deleted',
        p_bug_report_id: id,
        p_actor_type: 'admin',
      });

      setReports(prev => prev.filter(r => r.id !== id));
      if (selectedReport?.id === id) setSelectedReport(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Fehler beim Löschen');
    }
  }, [selectedReport]);

  const filtered = filterStatus === 'all' 
    ? reports 
    : reports.filter(r => r.status === filterStatus);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Fehlermeldungen der Nutzer"
        subtitle="Bug-Report System — direkt aus der App gemeldete Fehler"
      />

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: 'Alle' },
          { key: 'offen', label: 'Offen' },
          { key: 'in_bearbeitung', label: 'In Bearbeitung' },
          { key: 'gelöst', label: 'Gelöst' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            style={{
              padding: '6px 16px', borderRadius: 20,
              border: filterStatus === f.key ? 'none' : '1px solid rgba(0,0,0,0.1)',
              background: filterStatus === f.key ? '#16D7C5' : 'transparent',
              color: filterStatus === f.key ? '#fff' : 'inherit',
              fontSize: 13, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >{f.label}</button>
        ))}
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Lädt…</div>}
      {error && <div style={{ padding: 16, color: '#EF4444', background: 'rgba(239,68,68,0.08)', borderRadius: 12 }}>{error}</div>}

      {!loading && !error && (
        <>
          {/* Table */}
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
              Keine Fehlermeldungen vorhanden.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.08)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 8px' }}>Nutzer</th>
                    <th style={{ padding: '10px 8px' }}>Gerät</th>
                    <th style={{ padding: '10px 8px' }}>App-Version</th>
                    <th style={{ padding: '10px 8px' }}>Beschreibung</th>
                    <th style={{ padding: '10px 8px' }}>Uploads</th>
                    <th style={{ padding: '10px 8px' }}>Zeitstempel</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                    <th style={{ padding: '10px 8px' }}>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const st = STATUS_LABELS[r.status] || STATUS_LABELS.offen;
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', verticalAlign: 'top' }}>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ fontWeight: 600 }}>{r.username || '—'}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>{r.email || ''}</div>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <div>{r.device_model || '—'}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>{r.device_os || ''}</div>
                        </td>
                        <td style={{ padding: '10px 8px' }}>{r.app_version || '—'}</td>
                        <td style={{ padding: '10px 8px', maxWidth: 250 }}>
                          <div style={{
                            maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }} title={r.description}>
                            {r.description}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          {(r.attachments || []).length > 0 ? (
                            <span style={{ cursor: 'pointer', color: '#16D7C5' }} onClick={() => setSelectedReport(r)}>
                              {(r.attachments || []).length} Datei(en)
                            </span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: 12, color: '#666' }}>
                          {formatDate(r.created_at)}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 12,
                            fontSize: 11, fontWeight: 600,
                            background: st.color + '20', color: st.color,
                          }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button
                              onClick={() => setSelectedReport(r)}
                              style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: 'transparent', fontSize: 11, cursor: 'pointer' }}
                            >Öffnen</button>
                            {r.status !== 'gelöst' && (
                              <button
                                onClick={() => updateStatus(r.id, 'gelöst')}
                                style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: '#10B981', color: '#fff', fontSize: 11, cursor: 'pointer' }}
                              >Schließen</button>
                            )}
                            {r.status === 'gelöst' && (
                              <button
                                onClick={() => updateStatus(r.id, 'in_bearbeitung')}
                                style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', fontSize: 11, cursor: 'pointer' }}
                              >Öffnen</button>
                            )}
                            <button
                              onClick={() => deleteReport(r.id)}
                              style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 11, cursor: 'pointer' }}
                            >Löschen</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Detail Modal */}
          {selectedReport && (
            <div
              onClick={() => setSelectedReport(null)}
              style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(0,0,0,0.4)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  background: '#fff', borderRadius: 16, padding: 24,
                  maxWidth: 600, width: '90%', maxHeight: '80vh',
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontFamily: 'Inter, sans-serif' }}>
                    Fehlermeldung Detail
                  </h3>
                  <button onClick={() => setSelectedReport(null)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
                  <div><strong>Nutzer:</strong> {selectedReport.username || '—'}</div>
                  <div><strong>E-Mail:</strong> {selectedReport.email || '—'}</div>
                  <div><strong>Gerät:</strong> {selectedReport.device_model || '—'}</div>
                  <div><strong>OS:</strong> {selectedReport.device_os || '—'}</div>
                  <div><strong>App-Version:</strong> {selectedReport.app_version || '—'}</div>
                  <div><strong>Quelle:</strong> {selectedReport.source}</div>
                  <div><strong>Erstellt:</strong> {formatDate(selectedReport.created_at)}</div>
                  <div><strong>Status:</strong> {STATUS_LABELS[selectedReport.status]?.label || selectedReport.status}</div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <strong style={{ fontFamily: 'Inter, sans-serif', fontSize: 13 }}>Beschreibung:</strong>
                  <p style={{ marginTop: 8, padding: 12, background: '#f5f5f5', borderRadius: 8, fontSize: 13, fontFamily: 'Inter, sans-serif', whiteSpace: 'pre-wrap' }}>
                    {selectedReport.description}
                  </p>
                </div>

                {(selectedReport.attachments || []).length > 0 && (
                  <div>
                    <strong style={{ fontFamily: 'Inter, sans-serif', fontSize: 13 }}>Uploads ({selectedReport.attachments.length}):</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginTop: 8 }}>
                      {selectedReport.attachments.map((att, i) => (
                        <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                          {att.type?.startsWith('video') ? (
                            <div style={{
                              width: '100%', aspectRatio: '1', borderRadius: 8,
                              background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 24,
                            }}>🎬</div>
                          ) : (
                            <img src={att.url} alt={att.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
