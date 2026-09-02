// frontend/src/app/startphase/[id]/page.tsx
// HUI Admin Dashboard — HUI Startphase Detailansicht
// Vollständige Bewerbungsdaten + Status + Kommunikation
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';

interface Application {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  interest: string | null;
  country_region: string | null;
  current_role: string | null;
  about_you: string | null;
  contributions: string[] | string;
  skills: string | null;
  project_name: string | null;
  project_offering: string | null;
  project_audience: string | null;
  project_impact: string | null;
  project_needs: string | null;
  project_missing: string | null;
  pioneer_reason: string | null;
  pioneer_wishes: string[] | string;
  pioneer_first_action: string | null;
  why_hui: string | null;
  what_contribute: string | null;
  status: string;
  consent_accepted: boolean;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Communication {
  id: string;
  direction: string;
  subject: string;
  message_body: string;
  sent: boolean;
  admin_name: string | null;
  created_at: string;
  error: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; value: string }> = {
  new:        { label: 'Neu',            color: '#4ECDC4', bg: 'rgba(78, 205, 196, 0.12)', value: 'new' },
  review:     { label: 'In Prüfung',      color: '#F5A623', bg: 'rgba(245, 166, 35, 0.12)', value: 'review' },
  question:   { label: 'Rückfrage',       color: '#E67E22', bg: 'rgba(230, 126, 34, 0.12)', value: 'question' },
  accepted:   { label: 'Angenommen',      color: '#27AE60', bg: 'rgba(39, 174, 96, 0.12)', value: 'accepted' },
  rejected:   { label: 'Nicht ausgewählt', color: '#E74C3C', bg: 'rgba(231, 76, 60, 0.12)', value: 'rejected' },
  completed:  { label: 'Abgeschlossen',   color: '#7F8C8D', bg: 'rgba(127, 140, 141, 0.12)', value: 'completed' },
};

const INTEREST_LABELS: Record<string, string> = {
  idea: 'Eine Idee',
  talent: 'Ein Talent',
  experience: 'Erfahrung',
  time: 'Zeit',
  support: 'Unterstützung',
  curiosity: 'Neugier',
  project: 'Projekt einbringen',
  work: 'Werk zeigen',
  pioneer: 'Pionier',
  connector: 'Menschen verbinden',
  explore: 'Kennenlernen',
  other: 'Anderes',
};

const PIONEER_WISHES: Record<string, string> = {
  test_features: 'Funktionen testen',
  feedback: 'Feedback geben',
  contribute_ideas: 'Ideen einbringen',
  early_access: 'Frühzugang',
  community: 'Community',
};

const card: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4,
};

const fieldValue: React.CSSProperties = {
  fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6,
};

function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function emptyVal(v: string | null | undefined) {
  if (!v || v.trim() === '') return '—';
  return v;
}

function arrToLabels(arr: string[] | string, labels: Record<string, string>): string {
  if (!arr) return '—';
  const items = Array.isArray(arr) ? arr : (typeof arr === 'string' ? (arr.startsWith('[') ? JSON.parse(arr) : [arr]) : [arr]);
  if (items.length === 0) return '—';
  return items.map((i: string) => labels[i] || i).join(', ');
}

export default function StartphaseDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [app, setApp] = useState<Application | null>(null);
  const [comms, setComms] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showCommForm, setShowCommForm] = useState(false);
  const [commSubject, setCommSubject] = useState('');
  const [commMessage, setCommMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [commResult, setCommResult] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, cRes] = await Promise.all([
        fetch(`/api/startphase/applications/${id}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/startphase/communications?application_id=${id}`, { cache: 'no-store' }).then(r => r.json()),
      ]);
      if (aRes.ok) {
        setApp(aRes.data.application);
        setAdminNotes(aRes.data.application.admin_notes || '');
      }
      if (cRes.ok) setComms(cRes.data.communications ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateStatus = async (newStatus: string) => {
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/startphase/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.ok) {
        setApp(json.data.application);
      }
    } catch {
      // ignore
    } finally {
      setStatusUpdating(false);
    }
  };

  const saveNotes = async () => {
    setNotesSaving(true);
    try {
      const res = await fetch(`/api/startphase/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: adminNotes }),
      });
      const json = await res.json();
      if (json.ok) {
        setApp(json.data.application);
      }
    } catch {
      // ignore
    } finally {
      setNotesSaving(false);
    }
  };

  const sendEmail = async () => {
    if (!commSubject.trim() || !commMessage.trim()) return;
    setSending(true);
    setCommResult(null);
    try {
      const res = await fetch('/api/startphase/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: id,
          subject: commSubject.trim(),
          message: commMessage.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        if (json.data.sent) {
          setCommResult('E-Mail erfolgreich versendet ✓');
          setCommSubject('');
          setCommMessage('');
          setShowCommForm(false);
        } else {
          setCommResult(json.data.message || json.data.error || 'E-Mail nicht versendet (RESEND_API_KEY fehlt?)');
        }
        // Kommunikationshistorie neu laden
        const cRes = await fetch(`/api/startphase/communications?application_id=${id}`, { cache: 'no-store' });
        const cJson = await cRes.json();
        if (cJson.ok) setComms(cJson.data.communications ?? []);
      } else {
        setCommResult(json.error || 'Fehler beim Senden');
      }
    } catch {
      setCommResult('Netzwerkfehler');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="HUI Admin — Startphase">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Lädt…</div>
      </DashboardLayout>
    );
  }

  if (!app) {
    return (
      <DashboardLayout title="HUI Admin — Startphase">
        <PageHeader title="Bewerbung nicht gefunden" breadcrumbs={[{ label: 'HUI Startphase', href: '/startphase' }]} />
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Diese Bewerbung existiert nicht oder wurde gelöscht.
        </div>
      </DashboardLayout>
    );
  }

  const contributionsStr = arrToLabels(app.contributions, INTEREST_LABELS);
  const wishesStr = arrToLabels(app.pioneer_wishes, PIONEER_WISHES);

  return (
    <DashboardLayout title="HUI Admin — Startphase">
      <PageHeader
        title={`${app.first_name} ${app.last_name}`}
        subtitle={app.email}
        breadcrumbs={[
          { label: 'Management', href: '/users' },
          { label: 'HUI Startphase', href: '/startphase' },
          { label: `${app.first_name} ${app.last_name}` },
        ]}
        actions={
          <a
            href="/startphase"
            style={{
              padding: '8px 16px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            ← Zurück
          </a>
        }
      />

      {/* Status Bar */}
      <div style={{
        ...card,
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status:</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 999,
            background: (STATUS_CONFIG[app.status] || STATUS_CONFIG.new).bg,
            color: (STATUS_CONFIG[app.status] || STATUS_CONFIG.new).color,
            fontSize: 13, fontWeight: 600,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: (STATUS_CONFIG[app.status] || STATUS_CONFIG.new).color }} />
            {(STATUS_CONFIG[app.status] || STATUS_CONFIG.new).label}
          </span>
        </div>

        {/* Status Selector */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => updateStatus(key)}
              disabled={statusUpdating || app.status === key}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: `1px solid ${app.status === key ? cfg.color : 'var(--border)'}`,
                background: app.status === key ? cfg.bg : 'transparent',
                color: app.status === key ? cfg.color : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 500,
                cursor: statusUpdating || app.status === key ? 'default' : 'pointer',
                opacity: statusUpdating ? 0.6 : app.status === key ? 1 : 0.7,
                transition: 'all 0.15s',
              }}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Persönliche Daten */}
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            Persönliche Daten
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><div style={fieldLabel}>Name</div><div style={fieldValue}>{app.first_name} {app.last_name}</div></div>
            <div><div style={fieldLabel}>E-Mail</div><div style={fieldValue}>{app.email}</div></div>
            <div><div style={fieldLabel}>Land / Region</div><div style={fieldValue}>{emptyVal(app.country_region)}</div></div>
            <div><div style={fieldLabel}>Aktuelle Rolle</div><div style={fieldValue}>{emptyVal(app.current_role)}</div></div>
            <div><div style={fieldLabel}>Über dich</div><div style={fieldValue}>{emptyVal(app.about_you)}</div></div>
          </div>
        </div>

        {/* Interesse & Beiträge */}
        <div style={card}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            Interesse & Beiträge
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={fieldLabel}>Vorausgewähltes Interesse</div>
              <div style={{ ...fieldValue, fontWeight: 600, color: 'var(--accent)' }}>
                {app.interest ? (INTEREST_LABELS[app.interest] || app.interest) : '—'}
              </div>
            </div>
            <div><div style={fieldLabel}>Beiträge (Contributions)</div><div style={fieldValue}>{contributionsStr}</div></div>
            <div><div style={fieldLabel}>Fähigkeiten / Talente</div><div style={fieldValue}>{emptyVal(app.skills)}</div></div>
            <div><div style={fieldLabel}>Warum HUI?</div><div style={fieldValue}>{emptyVal(app.why_hui)}</div></div>
            <div><div style={fieldLabel}>Was möchtest du beitragen?</div><div style={fieldValue}>{emptyVal(app.what_contribute)}</div></div>
          </div>
        </div>
      </div>

      {/* Projekt Details (nur wenn vorhanden) */}
      {(app.project_name || app.project_offering || app.project_audience || app.project_impact || app.project_needs || app.project_missing) && (
        <div style={{ ...card, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            Projekt-Details
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><div style={fieldLabel}>Projektname</div><div style={fieldValue}>{emptyVal(app.project_name)}</div></div>
            <div><div style={fieldLabel}>Zielgruppe</div><div style={fieldValue}>{emptyVal(app.project_audience)}</div></div>
            <div><div style={fieldLabel}>Was bietet das Projekt?</div><div style={fieldValue}>{emptyVal(app.project_offering)}</div></div>
            <div><div style={fieldLabel}>Welchen Impact?</div><div style={fieldValue}>{emptyVal(app.project_impact)}</div></div>
            <div><div style={fieldLabel}>Was braucht das Projekt?</div><div style={fieldValue}>{emptyVal(app.project_needs)}</div></div>
            <div><div style={fieldLabel}>Was fehlt heute?</div><div style={fieldValue}>{emptyVal(app.project_missing)}</div></div>
          </div>
        </div>
      )}

      {/* Pionier Details (nur wenn vorhanden) */}
      {(app.pioneer_reason || app.pioneer_first_action || (Array.isArray(app.pioneer_wishes) ? app.pioneer_wishes.length > 0 : app.pioneer_wishes)) && (
        <div style={{ ...card, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            Pionier-Details
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div><div style={fieldLabel}>Warum Pionier?</div><div style={fieldValue}>{emptyVal(app.pioneer_reason)}</div></div>
            <div><div style={fieldLabel}>Erste Aktion</div><div style={fieldValue}>{emptyVal(app.pioneer_first_action)}</div></div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={fieldLabel}>Wünsche</div>
              <div style={fieldValue}>{wishesStr}</div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Notizen */}
      <div style={{ ...card, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
          Admin-Notizen
        </h3>
        <textarea
          value={adminNotes}
          onChange={e => setAdminNotes(e.target.value)}
          placeholder="Interne Notizen zu dieser Bewerbung…"
          style={{
            width: '100%', minHeight: 80, resize: 'vertical',
            padding: '10px 12px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            fontSize: 13, fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={saveNotes}
            disabled={notesSaving}
            style={{
              padding: '6px 16px',
              background: 'var(--accent)',
              color: '#0F1117',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: notesSaving ? 'wait' : 'pointer',
              opacity: notesSaving ? 0.6 : 1,
            }}
          >
            {notesSaving ? 'Speichert…' : 'Notizen speichern'}
          </button>
        </div>
      </div>

      {/* Kommunikation */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Kommunikation ({comms.length})
          </h3>
          <button
            onClick={() => setShowCommForm(!showCommForm)}
            style={{
              padding: '6px 14px',
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {showCommForm ? 'Abbrechen' : 'E-Mail senden'}
          </button>
        </div>

        {/* Send Form */}
        {showCommForm && (
          <div style={{ marginBottom: 16, padding: 16, background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ ...fieldLabel, display: 'block', marginBottom: 6 }}>Betreff</label>
              <input
                type="text"
                value={commSubject}
                onChange={e => setCommSubject(e.target.value)}
                placeholder="z.B. Deine HUI Startphase Bewerbung"
                style={{
                  width: '100%', padding: '10px 12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: 13, outline: 'none',
                }}
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ ...fieldLabel, display: 'block', marginBottom: 6 }}>Nachricht</label>
              <textarea
                value={commMessage}
                onChange={e => setCommMessage(e.target.value)}
                placeholder="Hallo …"
                style={{
                  width: '100%', minHeight: 120, resize: 'vertical',
                  padding: '10px 12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: 13, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              Empfänger: {app.email} (serverseitig aus Bewerbung ermittelt)
            </div>
            {commResult && (
              <div style={{
                marginBottom: 10, padding: '10px 12px', borderRadius: 6,
                background: commResult.includes('erfolgreich') ? 'rgba(39, 174, 96, 0.08)' : 'rgba(231, 76, 60, 0.08)',
                color: commResult.includes('erfolgreich') ? '#27AE60' : '#E74C3C',
                fontSize: 13,
              }}>
                {commResult}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={sendEmail}
                disabled={sending || !commSubject.trim() || !commMessage.trim()}
                style={{
                  padding: '8px 20px',
                  background: 'var(--accent)',
                  color: '#0F1117',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: sending || !commSubject.trim() || !commMessage.trim() ? 'default' : 'pointer',
                  opacity: sending || !commSubject.trim() || !commMessage.trim() ? 0.6 : 1,
                }}
              >
                {sending ? 'Sendet…' : 'Senden'}
              </button>
            </div>
          </div>
        )}

        {/* History */}
        {comms.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Noch keine Kommunikation
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comms.map(c => (
              <div key={c.id} style={{
                padding: 14,
                background: 'var(--bg-primary)',
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
                      background: c.sent ? 'rgba(39, 174, 96, 0.12)' : 'rgba(231, 76, 60, 0.12)',
                      color: c.sent ? '#27AE60' : '#E74C3C',
                    }}>
                      {c.sent ? '✓ Gesendet' : '✗ Nicht gesendet'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(c.created_at)}</span>
                    {c.admin_name && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {c.admin_name}</span>}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {c.subject}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {c.message_body}
                </div>
                {c.error && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#E74C3C' }}>
                    Fehler: {c.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meta */}
      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 20 }}>
        <span>Erstellt: {fmtDate(app.created_at)}</span>
        <span>Aktualisiert: {fmtDate(app.updated_at)}</span>
        <span>Consent: {app.consent_accepted ? '✓ Ja' : '✗ Nein'}</span>
        <span>ID: {app.id}</span>
      </div>
    </DashboardLayout>
  );
}
