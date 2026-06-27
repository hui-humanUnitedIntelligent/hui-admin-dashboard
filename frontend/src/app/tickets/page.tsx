'use client';
// frontend/src/app/tickets/page.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';

// ── Typen ─────────────────────────────────────────────────────────────────────
interface Attachment { name:string; url:string; type:string; size:number }
interface Ticket {
  id:            string;
  created_at:    string;
  ticket_number: string;
  name:          string;
  email:         string;
  phone:         string;
  category:      string;
  priority:      string;
  subject:       string;
  message:       string;
  status:        'open'|'replied'|'closed';
  attachments:   Attachment[];
  admin_reply:   string|null;
  replied_at:    string|null;
  read_by_admin: boolean;
  user_id:       string|null;
}
interface Stats { open:number; replied:number; closed:number; total:number; unread:number }

const PRIORITY_COLORS: Record<string,string> = {
  urgent:'var(--red)', high:'var(--gold)', normal:'var(--accent)', low:'var(--text-muted)',
};
const PRIORITY_LABELS: Record<string,string> = {
  urgent:'🔴 Urgent', high:'🟡 Hoch', normal:'🔵 Normal', low:'⚪ Niedrig',
};
const CATEGORY_ICONS: Record<string,string> = {
  fehler:'🐛', verbesserung:'💡', anfrage:'📋', hilfe:'🆘',
  passwort:'🔐', konto:'◎', zahlung:'💳', sonstiges:'📝', system:'⚙️',
};
const STATUS_COLORS: Record<string,{bg:string;color:string;label:string}> = {
  open:    { bg:'rgba(239,68,68,0.1)',    color:'var(--red)',   label:'🔴 Offen'       },
  replied: { bg:'rgba(245,158,11,0.1)',   color:'var(--gold)',  label:'🟡 Beantwortet' },
  closed:  { bg:'rgba(16,185,129,0.1)',   color:'var(--green)', label:'🟢 Geschlossen' },
};

function timeAgo(iso:string) {
  if (!iso) return '—';
  const d = Math.floor((Date.now()-new Date(iso).getTime())/60000);
  if (d<1)    return 'Gerade eben';
  if (d<60)   return `Vor ${d} Min.`;
  if (d<1440) return `Vor ${Math.floor(d/60)} Std.`;
  return `${Math.floor(d/1440)}d — ${new Date(iso).toLocaleDateString('de-DE')}`;
}

// ── Ticket Detail Modal ────────────────────────────────────────────────────────
function TicketModal({ ticket, onClose, onUpdate }: {
  ticket:Ticket; onClose:()=>void;
  onUpdate:(id:string,action:string,extra?:object)=>Promise<void>;
}) {
  const [reply,    setReply]    = useState(ticket.admin_reply ?? '');
  const [sending,  setSending]  = useState(false);
  const [closing,  setClosing]  = useState(false);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    await onUpdate(ticket.id, 'reply', { reply });
    setSending(false);
    onClose();
  };

  const handleClose = async () => {
    setClosing(true);
    await onUpdate(ticket.id, 'close');
    setClosing(false);
    onClose();
  };

  const handleReopen = async () => {
    await onUpdate(ticket.id, 'reopen');
    onClose();
  };

  const sc = STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)',
        borderRadius:14, width:'100%', maxWidth:620, maxHeight:'90vh',
        display:'flex', flexDirection:'column', overflow:'hidden' }}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'18px 20px', borderBottom:'1px solid var(--border)',
          display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700,
                color:'var(--accent)', background:'rgba(78,205,196,0.1)',
                padding:'2px 8px', borderRadius:5 }}>{ticket.ticket_number}</span>
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:5,
                background:sc.bg, color:sc.color }}>{sc.label}</span>
              <span style={{ fontSize:11, fontWeight:700,
                color:PRIORITY_COLORS[ticket.priority] ?? 'var(--text-muted)' }}>
                {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
              </span>
            </div>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>
              {CATEGORY_ICONS[ticket.category] ?? '📝'} {ticket.subject}
            </h3>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none',
            color:'var(--text-muted)', cursor:'pointer', fontSize:20, padding:'0 4px' }}>×</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:14 }}>

          {/* Absender */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            {[
              { label:'Name',     value:ticket.name },
              { label:'E-Mail',   value:ticket.email },
              { label:'Telefon',  value:ticket.phone || '—' },
            ].map(f => (
              <div key={f.label} style={{ background:'var(--bg-tertiary)', borderRadius:8, padding:'10px 12px' }}>
                <p style={{ margin:0, fontSize:10, fontWeight:700, color:'var(--text-muted)',
                  textTransform:'uppercase', letterSpacing:'0.06em' }}>{f.label}</p>
                <p style={{ margin:'3px 0 0', fontSize:12, color:'var(--text-primary)',
                  wordBreak:'break-all' }}>{f.value}</p>
              </div>
            ))}
          </div>

          {/* Meta */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:'var(--text-muted)',
              background:'var(--bg-tertiary)', padding:'3px 8px', borderRadius:5 }}>
              📅 {new Date(ticket.created_at).toLocaleString('de-DE')}
            </span>
            <span style={{ fontSize:11, color:'var(--text-muted)',
              background:'var(--bg-tertiary)', padding:'3px 8px', borderRadius:5 }}>
              🏷️ {CATEGORY_ICONS[ticket.category] ?? '📝'} {ticket.category}
            </span>
            {ticket.user_id && (
              <span style={{ fontSize:11, color:'var(--text-muted)',
                background:'var(--bg-tertiary)', padding:'3px 8px', borderRadius:5 }}>
                👤 Registrierter Nutzer
              </span>
            )}
          </div>

          {/* Nachricht */}
          <div style={{ background:'var(--bg-tertiary)', borderRadius:10, padding:14 }}>
            <p style={{ margin:'0 0 8px', fontSize:11, fontWeight:700, color:'var(--text-muted)',
              textTransform:'uppercase', letterSpacing:'0.06em' }}>Nachricht</p>
            <p style={{ margin:0, fontSize:13, color:'var(--text-primary)', lineHeight:1.6,
              whiteSpace:'pre-wrap' }}>{ticket.message}</p>
          </div>

          {/* Anhänge */}
          {ticket.attachments?.length > 0 && (
            <div>
              <p style={{ margin:'0 0 8px', fontSize:11, fontWeight:700, color:'var(--text-muted)',
                textTransform:'uppercase', letterSpacing:'0.06em' }}>
                📎 Anhänge ({ticket.attachments.length})
              </p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {ticket.attachments.map((a,i) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer"
                    style={{ display:'flex', alignItems:'center', gap:6,
                      padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)',
                      background:'var(--bg-tertiary)', textDecoration:'none',
                      color:'var(--text-primary)', fontSize:12 }}>
                    <span>{a.type?.startsWith('image') ? '🖼' : a.type?.startsWith('video') ? '🎬' : '📄'}</span>
                    <span style={{ maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {a.name}
                    </span>
                    <span style={{ fontSize:10, color:'var(--text-muted)' }}>
                      {(a.size/1024/1024).toFixed(1)}MB
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Bisherige Antwort */}
          {ticket.admin_reply && (
            <div style={{ background:'rgba(78,205,196,0.06)', border:'1px solid rgba(78,205,196,0.2)',
              borderRadius:10, padding:14 }}>
              <p style={{ margin:'0 0 6px', fontSize:11, fontWeight:700, color:'var(--accent)',
                textTransform:'uppercase', letterSpacing:'0.06em' }}>
                ✅ Admin-Antwort vom {ticket.replied_at ? new Date(ticket.replied_at).toLocaleString('de-DE') : '—'}
              </p>
              <p style={{ margin:0, fontSize:13, color:'var(--text-primary)', lineHeight:1.6,
                whiteSpace:'pre-wrap' }}>{ticket.admin_reply}</p>
            </div>
          )}

          {/* Antwort-Box */}
          {ticket.status !== 'closed' && (
            <div>
              <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>
                📝 Antwort an {ticket.name}
              </p>
              <textarea value={reply} onChange={e=>setReply(e.target.value)}
                placeholder="Deine Antwort an den Nutzer..."
                rows={4}
                style={{ width:'100%', padding:'10px 12px', borderRadius:8, fontSize:13,
                  border:'1px solid var(--border)', background:'var(--bg-tertiary)',
                  color:'var(--text-primary)', resize:'vertical', outline:'none',
                  fontFamily:'inherit', lineHeight:1.5, boxSizing:'border-box' }} />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)',
          display:'flex', gap:8, flexWrap:'wrap', justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:8 }}>
            {ticket.status === 'closed' ? (
              <button onClick={handleReopen}
                style={{ padding:'7px 14px', borderRadius:7, border:'1px solid var(--border)',
                  background:'transparent', color:'var(--text-muted)', cursor:'pointer', fontSize:12 }}>
                ↺ Wiedereröffnen
              </button>
            ) : (
              <button onClick={handleClose} disabled={closing}
                style={{ padding:'7px 14px', borderRadius:7, border:'1px solid var(--border)',
                  background:'transparent', color:'var(--text-muted)', cursor:'pointer', fontSize:12 }}>
                {closing ? '…' : '🔒 Schließen'}
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose}
              style={{ padding:'7px 16px', borderRadius:7, border:'1px solid var(--border)',
                background:'transparent', color:'var(--text-secondary)', cursor:'pointer', fontSize:13 }}>
              Abbrechen
            </button>
            {ticket.status !== 'closed' && (
              <button onClick={handleReply} disabled={sending || !reply.trim()}
                style={{ padding:'7px 18px', borderRadius:7, border:'none',
                  background: (!reply.trim() || sending) ? 'var(--bg-tertiary)' : 'var(--accent)',
                  color: (!reply.trim() || sending) ? 'var(--text-muted)' : '#000',
                  cursor:(!reply.trim()||sending)?'default':'pointer', fontSize:13, fontWeight:600 }}>
                {sending ? '⏳ Sende…' : '✉️ Antwort senden'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Haupt-Seite ────────────────────────────────────────────────────────────────
export default function TicketsPage() {
  const [tickets,  setTickets]  = useState<Ticket[]>([]);
  const [stats,    setStats]    = useState<Stats>({ open:0, replied:0, closed:0, total:0, unread:0 });
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<'open'|'replied'|'closed'|'all'>('open');
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<Ticket|null>(null);
  const [toast,    setToast]    = useState<string|null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const showToast = (msg:string) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(()=>setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tickets?limit=200', { credentials:'include' });
      const json = await res.json();
      if (json.data) {
        setTickets(json.data.tickets ?? []);
        setStats(json.data.stats ?? { open:0,replied:0,closed:0,total:0,unread:0 });
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (id:string, action:string, extra?:object) => {
    try {
      const res = await fetch('/api/tickets', {
        method:'PATCH', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id, action, ...extra }),
      });
      const json = await res.json();
      if (json.data) {
        showToast(action==='reply' ? '✅ Antwort gesendet' : action==='close' ? '🔒 Ticket geschlossen' : '✅ Aktualisiert');
        await load();
      }
    } catch { showToast('❌ Fehler'); }
  };

  const handleDelete = async (id:string) => {
    await fetch('/api/tickets', {
      method:'DELETE', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id }),
    });
    showToast('🗑 Ticket gelöscht');
    setTickets(prev => prev.filter(t => t.id !== id));
    load();
  };

  const filtered = tickets.filter(t => {
    const matchTab    = tab === 'all' || t.status === tab;
    const matchSearch = !search || [t.ticket_number,t.name,t.email,t.subject]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchTab && matchSearch;
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Support-Tickets"
        subtitle="Nutzeranfragen & Support"
        actions={
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {stats.unread > 0 && (
              <span style={{ fontSize:11, fontWeight:700, color:'var(--red)',
                background:'rgba(239,68,68,0.12)', padding:'3px 10px', borderRadius:6,
                animation:'pulse 2s infinite' }}>
                🔔 {stats.unread} ungelesen
              </span>
            )}
            <button onClick={load}
              style={{ padding:'0 12px', height:30, borderRadius:6,
                border:'1px solid var(--border)', background:'transparent',
                color:'var(--text-muted)', cursor:'pointer', fontSize:12 }}>
              ↺
            </button>
          </div>
        }
      />

      <div style={{ padding:'0 28px 28px' }}>

        {/* Stats Kacheln */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'OFFEN',        value:stats.open,    color:'var(--red)'   },
            { label:'BEANTWORTET',  value:stats.replied, color:'var(--gold)'  },
            { label:'GESCHLOSSEN',  value:stats.closed,  color:'var(--green)' },
            { label:'GESAMT',       value:stats.total,   color:'var(--accent)'},
          ].map(s => (
            <div key={s.label}
              style={{ padding:'16px', borderRadius:10, border:'1px solid var(--border)',
                background:'var(--bg-secondary)', textAlign:'center' }}>
              <p style={{ margin:0, fontSize:28, fontWeight:800, color:s.color }}>{s.value}</p>
              <p style={{ margin:'4px 0 0', fontSize:10, fontWeight:700, color:'var(--text-muted)',
                textTransform:'uppercase', letterSpacing:'0.08em' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs + Suche */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {(['open','replied','closed','all'] as const).map(t => {
            const cnt = t==='all' ? stats.total : stats[t];
            const colors = STATUS_COLORS[t] ?? { color:'var(--text-muted)', bg:'transparent' };
            return (
              <button key={t} onClick={()=>setTab(t)}
                style={{ padding:'6px 14px', borderRadius:7, fontSize:13, fontWeight:600,
                  cursor:'pointer', border:'1px solid',
                  background: tab===t ? (STATUS_COLORS[t]?.bg ?? 'var(--bg-tertiary)') : 'transparent',
                  color:      tab===t ? (STATUS_COLORS[t]?.color ?? 'var(--accent)') : 'var(--text-muted)',
                  borderColor: tab===t ? 'var(--border)' : 'transparent' }}>
                {t==='all' ? `Alle (${cnt})` : `${STATUS_COLORS[t]?.label ?? t} (${cnt})`}
              </button>
            );
          })}
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Suchen…"
            style={{ marginLeft:'auto', padding:'6px 10px', borderRadius:7, fontSize:12,
              border:'1px solid var(--border)', background:'var(--bg-secondary)',
              color:'var(--text-primary)', outline:'none', width:200 }} />
        </div>

        {/* Tabelle */}
        <div style={{ borderRadius:10, border:'1px solid var(--border)', overflow:'hidden' }}>
          {/* Header */}
          <div style={{ display:'grid', gridTemplateColumns:'130px 1fr 130px 90px 90px 80px 44px',
            background:'var(--bg-tertiary)', borderBottom:'1px solid var(--border)',
            padding:'10px 16px', gap:8 }}>
            {['Ticket-Nr.','Betreff','Absender','Kategorie','Priorität','Status',''].map(h => (
              <span key={h} style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)',
                textTransform:'uppercase', letterSpacing:'0.06em',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding:60, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              ⏳ Lade Tickets…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:60, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              🎟 Keine Tickets{tab!=='all' ? ` mit Status "${tab}"` : ''}.
            </div>
          ) : filtered.map((t,i) => {
            const sc = STATUS_COLORS[t.status] ?? STATUS_COLORS.open;
            return (
              <div key={t.id}
                onClick={()=>setSelected(t)}
                style={{ display:'grid', gridTemplateColumns:'130px 1fr 130px 90px 90px 80px 44px',
                  padding:'10px 16px', gap:8, alignItems:'center',
                  borderBottom: i<filtered.length-1 ? '1px solid var(--border)' : 'none',
                  background: !t.read_by_admin ? 'rgba(78,205,196,0.04)' : 'transparent',
                  cursor:'pointer', transition:'background 0.1s' }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(78,205,196,0.06)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=!t.read_by_admin?'rgba(78,205,196,0.04)':'transparent'}>
                <div>
                  <span style={{ fontFamily:'monospace', fontSize:11, fontWeight:700,
                    color:'var(--accent)' }}>{t.ticket_number}</span>
                  {!t.read_by_admin && (
                    <span style={{ marginLeft:4, fontSize:9, fontWeight:700,
                      color:'var(--red)', background:'rgba(239,68,68,0.12)',
                      padding:'1px 5px', borderRadius:4 }}>NEU</span>
                  )}
                  <p style={{ margin:'2px 0 0', fontSize:10, color:'var(--text-muted)' }}>
                    {timeAgo(t.created_at)}
                  </p>
                </div>
                <div style={{ overflow:'hidden' }}>
                  <p style={{ margin:0, fontSize:13, fontWeight:600, color:'var(--text-primary)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {CATEGORY_ICONS[t.category]??'📝'} {t.subject}
                  </p>
                  <p style={{ margin:'2px 0 0', fontSize:11, color:'var(--text-muted)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {t.message.slice(0,60)}…
                  </p>
                </div>
                <div style={{ overflow:'hidden' }}>
                  <p style={{ margin:0, fontSize:12, color:'var(--text-primary)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</p>
                  <p style={{ margin:'2px 0 0', fontSize:11, color:'var(--text-muted)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.email}</p>
                </div>
                <span style={{ fontSize:11, color:'var(--text-secondary)',
                  background:'var(--bg-tertiary)', padding:'2px 7px', borderRadius:5 }}>
                  {CATEGORY_ICONS[t.category]??'📝'} {t.category}
                </span>
                <span style={{ fontSize:11, fontWeight:700,
                  color:PRIORITY_COLORS[t.priority]??'var(--text-muted)' }}>
                  {PRIORITY_LABELS[t.priority]?.split(' ')[1] ?? t.priority}
                </span>
                <span style={{ fontSize:11, fontWeight:600, padding:'3px 7px', borderRadius:5,
                  background:sc.bg, color:sc.color, whiteSpace:'nowrap' }}>
                  {sc.label.split(' ')[1]}
                </span>
                <button onClick={e=>{e.stopPropagation();handleDelete(t.id);}}
                  title="Löschen"
                  style={{ background:'none', border:'none', color:'var(--text-muted)',
                    cursor:'pointer', fontSize:14, borderRadius:5, padding:4 }}
                  onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='var(--red)')}
                  onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='var(--text-muted)')}>
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <TicketModal
          ticket={selected}
          onClose={()=>setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:28, right:28, zIndex:2000,
          background:'var(--bg-secondary)', border:'1px solid var(--border)',
          borderRadius:10, padding:'12px 18px', fontSize:13, color:'var(--text-primary)',
          boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
