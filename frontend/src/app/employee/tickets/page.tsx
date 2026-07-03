// frontend/src/app/employee/tickets/page.tsx
// READ-ONLY Employee-Ansicht: Support-Tickets (nur lesen, keine Admin-Actions)
'use client';

import { useState, useCallback, useEffect } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';

// ── Typen -- identisch zur Superadmin-Seite (tickets/page.tsx), da beide denselben
// /api/tickets-Endpoint (Thread-gruppiert aus 'notifications') konsumieren ──────────
interface Attachment { name: string; url: string; type: string; size: number }
interface TicketMsg {
  id: string; created_at: string; ticket_number: string;
  name: string; email: string; subject: string; full_subject: string;
  message: string; category: string; priority: string;
  status: 'open' | 'replied' | 'closed'; attachments: Attachment[];
  admin_reply: string | null; replied_at: string | null;
  read_by_admin: boolean; is_followup: boolean;
}
interface Thread {
  ticket_number: string; subject: string; name: string; email: string; phone: string;
  category: string; priority: string; user_id: string | null;
  created_at: string; updated_at: string;
  status: 'open' | 'replied' | 'closed'; unread: boolean;
  message_count: number; messages: TicketMsg[]; preview: string;
}
interface Stats { open: number; replied: number; closed: number; total: number; unread: number }

const STATUS_LABEL: Record<string, string> = {
  open: 'Offen', replied: 'Beantwortet', closed: 'Geschlossen',
};
const STATUS_VARIANT: Record<string, 'danger' | 'warning' | 'success'> = {
  open: 'danger', replied: 'warning', closed: 'success',
};
const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'neutral' | 'success'> = {
  urgent: 'danger', high: 'warning', normal: 'neutral', low: 'success',
};

function timeAgo(iso: string) {
  if (!iso) return '\u2014';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (d < 60) return `Vor ${d} Min.`;
  if (d < 1440) return `Vor ${Math.floor(d / 60)} Std.`;
  return `Vor ${Math.floor(d / 1440)} Tagen`;
}

export default function EmployeeTicketsPage() {
  const [threads,  setThreads]  = useState<Thread[]>([]);
  const [stats,    setStats]    = useState<Stats>({ open: 0, replied: 0, closed: 0, total: 0, unread: 0 });
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<'all' | 'open' | 'replied' | 'closed'>('all');
  const [selected, setSelected] = useState<Thread | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // /api/tickets liefert gruppierte Threads (SSOT: 'notifications' Tabelle,
      // type='support_ticket'), keine separate 'tickets'-Tabelle existiert.
      const res  = await fetch('/api/tickets?limit=500', { credentials: 'include' });
      const json = await res.json();
      if (json.data) {
        setThreads(Array.isArray(json.data.threads) ? json.data.threads : []);
        setStats(json.data.stats ?? { open: 0, replied: 0, closed: 0, total: 0, unread: 0 });
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? threads : threads.filter(t => t.status === filter);

  // Letzte Admin-Antwort im Thread (falls vorhanden) fuer die Detail-Ansicht
  function latestReply(t: Thread): string | null {
    const withReply = [...t.messages].reverse().find(m => m.admin_reply);
    return withReply?.admin_reply ?? null;
  }

  return (
    <EmployeeLayout title="Support-Tickets">
      <PageHeader
        title="Support-Tickets"
        subtitle={`${filtered.length} von ${stats.total} Tickets ${filter !== 'all' ? `(${STATUS_LABEL[filter]})` : ''} \u00b7 read-only`}
        actionsRole="employee"
      />

      {/* Filter-Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'open', 'replied', 'closed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)',
              background: filter === f ? 'var(--accent)' : 'transparent',
              color: filter === f ? '#0f1117' : 'var(--text-muted)',
              fontWeight: 600, fontSize: 12, cursor: 'pointer',
            }}
          >
            {f === 'all' ? 'Alle' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Laden\u2026</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(t => (
            <div
              key={t.ticket_number}
              onClick={() => setSelected(selected?.ticket_number === t.ticket_number ? null : t)}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 18px', cursor: 'pointer',
                transition: 'border-color 0.15s',
                borderColor: selected?.ticket_number === t.ticket_number ? 'var(--accent)' : 'var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                    {t.subject || '(kein Betreff)'}
                    {t.unread && <span style={{ marginLeft: 6, color: 'var(--red)' }}>\u25cf</span>}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {t.name || t.email} \u00b7 {timeAgo(t.updated_at)} \u00b7 {t.category || 'Allgemein'} \u00b7 {t.message_count} Nachricht{t.message_count === 1 ? '' : 'en'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Badge variant={PRIORITY_VARIANT[t.priority] ?? 'neutral'}>{t.priority || 'normal'}</Badge>
                  <Badge variant={STATUS_VARIANT[t.status] ?? 'danger'}>{STATUS_LABEL[t.status] || 'Offen'}</Badge>
                </div>
              </div>

              {/* Detail-Ansicht bei Klick */}
              {selected?.ticket_number === t.ticket_number && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 8,
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Letzte Nachricht:</div>
                  <div style={{ marginBottom: latestReply(t) ? 10 : 0 }}>{t.preview}</div>
                  {latestReply(t) && (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Admin-Antwort:</div>
                      <div>{latestReply(t)}</div>
                    </>
                  )}
                  {!latestReply(t) && (
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>Noch keine Antwort.</div>
                  )}
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Keine Tickets gefunden.
            </div>
          )}
        </div>
      )}
    </EmployeeLayout>
  );
}
