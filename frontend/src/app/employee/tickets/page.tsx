// frontend/src/app/employee/tickets/page.tsx
// READ-ONLY Employee-Ansicht: Support-Tickets (nur lesen, keine Admin-Actions)
'use client';

import { useState, useCallback, useEffect } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
import { getSessionToken } from '@/lib/session';

interface Ticket {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  _status:   'open' | 'replied' | 'closed';
  _priority: 'low' | 'normal' | 'high' | 'urgent';
  _category: string;
  _reply:    string | null;
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Offen', replied: 'Beantwortet', closed: 'Geschlossen',
};
const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'neutral' | 'success'> = {
  urgent: 'danger', high: 'warning', normal: 'default', low: 'success',
};

function timeAgo(iso: string) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (d < 60) return `Vor ${d} Min.`;
  if (d < 1440) return `Vor ${Math.floor(d/60)} Std.`;
  return `Vor ${Math.floor(d/1440)} Tagen`;
}

export default function EmployeeTicketsPage() {
  const [tickets,  setTickets]  = useState<Ticket[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<'all' | 'open' | 'replied' | 'closed'>('all');
  const [selected, setSelected] = useState<Ticket | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getSessionToken();
      const res   = await fetch('/api/tickets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json();
      setTickets(j.data ?? []);
    } catch { /* ignore */ }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t._status === filter);

  return (
    <EmployeeLayout title="Support-Tickets">
      <PageHeader
        title="Support-Tickets"
        subtitle={`${filtered.length} Tickets ${filter !== 'all' ? `(${STATUS_LABEL[filter]})` : ''} · read-only`}
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
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Laden…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(t => (
            <div
              key={t.id}
              onClick={() => setSelected(selected?.id === t.id ? null : t)}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 18px', cursor: 'pointer',
                transition: 'border-color 0.15s',
                borderColor: selected?.id === t.id ? 'var(--accent)' : 'var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                    {t.title?.replace('[TICKET]', '').trim() || '(kein Titel)'}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {timeAgo(t.created_at)} · {t._category || 'Allgemein'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Badge variant={PRIORITY_VARIANT[t._priority] ?? 'neutral'}>
                    {t._priority || 'normal'}
                  </Badge>
                  <Badge variant={t._status === 'open' ? 'danger' : t._status === 'replied' ? 'warning' : 'success'}>
                    {STATUS_LABEL[t._status] || 'Offen'}
                  </Badge>
                </div>
              </div>

              {/* Detail-Ansicht bei Klick */}
              {selected?.id === t.id && t._reply && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 8,
                  background: 'var(--bg-primary)', border: '1px solid var(--border)',
                  fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Admin-Antwort:</div>
                  {t._reply}
                </div>
              )}
              {selected?.id === t.id && !t._reply && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                  Noch keine Antwort.
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
