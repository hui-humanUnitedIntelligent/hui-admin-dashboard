// frontend/src/app/tickets/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { isSuperAdmin } from '@/lib/roles';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { showToast } from '@/components/ui/Toast';
import { getSessionToken } from '@/lib/session';

interface Ticket {
  id: string; user_id: string; title: string; body: string;
  created_at: string;
  _status: 'open' | 'replied' | 'closed';
  _priority: 'low' | 'normal' | 'high' | 'urgent';
  _category: string;
  _reply: string | null;
  _replied_at: string | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'var(--red)', high: 'var(--gold)', normal: 'var(--accent)', low: 'var(--text-muted)',
};
const STATUS_LABELS: Record<string, string> = {
  open: '🔴 Offen', replied: '🟡 Beantwortet', closed: '🟢 Geschlossen',
};
const CATEGORY_ICONS: Record<string, string> = {
  general: '💬', technical: '🔧', billing: '💶', account: '◎', content: '🎨', other: '📝',
};

function timeAgo(iso: string) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (d < 1) return 'Gerade eben';
  if (d < 60) return `Vor ${d} Min.`;
  if (d < 1440) return `Vor ${Math.floor(d/60)} Std.`;
  return `${Math.floor(d/1440)}d · ${new Date(iso).toLocaleDateString('de-DE')}`;
}

export default function TicketsPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (currentUser && !isSuperAdmin(currentUser.role)) {
      router.replace("/employee");
    }
  }, [currentUser, router]);
  const userRole = currentUser?.role;
  const [tickets, setTickets]         = useState<Ticket[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<'all' | 'open' | 'replied' | 'closed'>('open');
  const [selected, setSelected]       = useState<Ticket | null>(null);
  const [reply, setReply]             = useState('');
  const [actioning, setActioning]     = useState(false);
  const [search, setSearch]           = useState('');

  // New ticket form
  const [showCreate, setShowCreate]   = useState(false);
  const [form, setForm]               = useState({ subject: '', message: '', category: 'general', priority: 'normal' });
  const [creating, setCreating]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/tickets?status=all', { headers: { Authorization: 'Bearer ' + (getSessionToken() || '') } }).then(r => r.json()).catch(() => []);
    setTickets(Array.isArray(res) ? res : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = tickets
    .filter(t => tab === 'all' || t._status === tab)
    .filter(t => !search.trim() || t.title.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase()));

  const counts = {
    all:     tickets.length,
    open:    tickets.filter(t => t._status === 'open').length,
    replied: tickets.filter(t => t._status === 'replied').length,
    closed:  tickets.filter(t => t._status === 'closed').length,
  };

  const doAction = async (action: string, extra: Record<string,unknown> = {}) => {
    if (!selected) return;
    setActioning(true);
    const tkn = getSessionToken();
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tkn || '') },
      body: JSON.stringify({ action, ticketId: selected.id, reply, ...extra }),
    });
    const data = await res.json();
    setActioning(false);
    if (res.ok) {
      showToast(`Aktion ausgeführt`, 'success');
      setReply('');
      setSelected(null);
      load();
    } else { showToast(data.error || 'Fehler', 'error'); }
  };

  const doCreate = async () => {
    if (!form.subject.trim() || !form.message.trim()) { showToast('Betreff und Nachricht erforderlich', 'error'); return; }
    setCreating(true);
    const tkn = getSessionToken();
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (tkn || '') },
      body: JSON.stringify({ action: 'create', subject: form.subject, message: form.message, category: form.category, priority: form.priority }),
    });
    setCreating(false);
    if (res.ok) {
      showToast('Ticket erstellt', 'success');
      setForm({ subject: '', message: '', category: 'general', priority: 'normal' });
      setShowCreate(false);
      load();
    } else { showToast('Fehler beim Erstellen', 'error'); }
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: 'var(--bg-primary)',
    border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5,
    color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
  };
  const tabBtnStyle = (t: typeof tab): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 8, border: '1px solid',
    borderColor: tab === t ? 'var(--accent)' : 'var(--border)',
    background: tab === t ? 'var(--accent-dim)' : 'transparent',
    color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
    cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <DashboardLayout
      title="Support-Tickets"
      headerActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          
      <PageHeader
        title="Support-Tickets"
        subtitle="Nutzeranfragen & Support"
        actionsRole="admin"
        userRole={userRole}
      />

<button
            onClick={() => setShowCreate(p => !p)}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0F1117', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
          >+ Ticket erstellen</button>
          <button onClick={load} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻</button>
        </div>
      }
    >
      {/* ── Stats ── */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: 'Offen',        value: counts.open,    color: 'var(--red)'    },
          { label: 'Beantwortet',  value: counts.replied, color: 'var(--gold)'   },
          { label: 'Geschlossen',  value: counts.closed,  color: 'var(--green)'  },
          { label: 'Gesamt',       value: counts.all,     color: 'var(--accent)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', borderTop: `3px solid ${color}`, cursor: 'pointer' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{loading ? '…' : value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Create ticket form ── */}
      {showCreate && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)', borderRadius: 12, padding: 20, marginBottom: 16, animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>📝 Neues Ticket erstellen</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>Kategorie</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={input}>
                <option value="general">💬 Allgemein</option>
                <option value="technical">🔧 Technisch</option>
                <option value="billing">💶 Zahlung</option>
                <option value="account">◎ Account</option>
                <option value="content">🎨 Content</option>
                <option value="other">📝 Sonstiges</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>Priorität</label>
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={input}>
                <option value="low">🟢 Niedrig</option>
                <option value="normal">🔵 Normal</option>
                <option value="high">🟡 Hoch</option>
                <option value="urgent">🔴 Dringend</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Betreff *" style={input} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} placeholder="Beschreibung *" rows={3} style={{ ...input, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)' }}>Abbrechen</button>
            <button onClick={doCreate} disabled={creating} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0F1117', cursor: creating ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', opacity: creating ? 0.6 : 1 }}>{creating ? '…' : 'Ticket erstellen'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* ── Ticket List ── */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Tabs + search */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="tab-bar" style={{ display: 'flex', gap: 6 }}>
              {(['open','replied','closed','all'] as const).map(t => (
                <button key={t} style={tabBtnStyle(t)} onClick={() => setTab(t)}>
                  {t === 'all' ? `Alle (${counts.all})` : t === 'open' ? `Offen (${counts.open})` : t === 'replied' ? `Beantw. (${counts.replied})` : `Geschl. (${counts.closed})`}
                </button>
              ))}
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…" style={{ ...input, padding: '6px 11px' }} />
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 550 }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Lade…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎫</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Keine Tickets</div>
              </div>
            ) : filtered.map(t => (
              <div
                key={t.id}
                onClick={() => { setSelected(t); setReply(''); }}
                style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'background 0.1s',
                  background: selected?.id === t.id ? 'var(--accent-dim)' : 'transparent',
                  borderLeft: `3px solid ${PRIORITY_COLORS[t._priority] || 'transparent'}`,
                }}
                onMouseEnter={e => { if (selected?.id !== t.id) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={e => { if (selected?.id !== t.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 12 }}>{CATEGORY_ICONS[t._category] || '💬'}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.title.replace('[TICKET] ', '')}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(t.created_at)}</div>
                  </div>
                  <div style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10,
                    background: t._status === 'open' ? 'rgba(255,107,107,0.12)' : t._status === 'replied' ? 'var(--gold-dim)' : 'var(--green-dim)',
                    color: t._status === 'open' ? 'var(--red)' : t._status === 'replied' ? 'var(--gold)' : 'var(--green)',
                    fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {STATUS_LABELS[t._status]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Ticket Detail ── */}
        {selected && (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {CATEGORY_ICONS[selected._category]} {selected.title.replace('[TICKET] ', '')}
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>

            <div style={{ flex: 1, padding: 18, overflowY: 'auto' }}>
              {/* Meta */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {selected._category}
                </span>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: 'var(--bg-tertiary)', color: PRIORITY_COLORS[selected._priority], border: '1px solid var(--border)', fontWeight: 700 }}>
                  {selected._priority}
                </span>
                <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {timeAgo(selected.created_at)}
                </span>
              </div>

              {/* User message */}
              <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: '12px 14px', marginBottom: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>📩 User-Anfrage</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.body}</div>
              </div>

              {/* Existing reply */}
              {selected._reply && (
                <div style={{ background: 'var(--accent-dim)', borderRadius: 10, padding: '12px 14px', marginBottom: 12, border: '1px solid var(--accent)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.6px' }}>✅ Admin-Antwort · {timeAgo(selected._replied_at || '')}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected._reply}</div>
                </div>
              )}

              {/* Reply box */}
              {selected._status !== 'closed' && (
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>
                    {selected._reply ? 'Antwort aktualisieren' : 'Antworten'}
                  </label>
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Antwort schreiben…"
                    rows={4}
                    style={{ ...input, resize: 'vertical', lineHeight: 1.5 }}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selected._status !== 'closed' && (
                <>
                  {reply.trim() && (
                    <button onClick={() => doAction('reply')} disabled={actioning}
                      style={{ flex: 1, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0F1117', cursor: actioning ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)', opacity: actioning ? 0.6 : 1 }}>
                      {actioning ? '…' : '📨 Antwort senden'}
                    </button>
                  )}
                  <button onClick={() => doAction('close')} disabled={actioning}
                    style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--green)', background: 'var(--green-dim)', color: 'var(--green)', cursor: actioning ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                    ✅ Schließen
                  </button>
                </>
              )}
              {selected._status === 'closed' && (
                <button onClick={() => doAction('reopen')} disabled={actioning}
                  style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--gold)', background: 'var(--gold-dim)', color: 'var(--gold)', cursor: actioning ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                  🔄 Wieder öffnen
                </button>
              )}
              <button onClick={() => doAction('delete')} disabled={actioning}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--red)', background: 'var(--red-dim)', color: 'var(--red)', cursor: actioning ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                🗑 Löschen
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
