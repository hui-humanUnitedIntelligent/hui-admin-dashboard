// frontend/src/app/employee/ambassadors/page.tsx
// EDB — Ambassador-Dashboard
// ARCH-006.1: Ambassadors = profiles WHERE role='ambassador' OR is_ambassador=true
'use client';

import { useState, useEffect, useCallback } from 'react';
import EmployeeLayout from '@/components/layout/EmployeeLayout';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/lib/hooks/useAuth';

// ── Typen ──────────────────────────────────────────────────────────────────
interface Ambassador {
  id: string; displayName: string; username: string;
  avatarUrl: string | null; email: string | null;
  role: string; impactEur: number; createdAt: string;
  referralCode: string | null; referralLink: string | null;
  referralCount: number; revenueEur: number;
  level: string; levelLabel: string; levelColor: string;
}

interface Work {
  id: string; title: string; status: string;
  approval_status: string | null; created_at: string;
}

interface Project {
  id: string; project_name: string; status: string;
  funding_goal: number | null; created_at: string;
}

interface Chat {
  chat_id: string; last_message: string | null;
  last_message_at: string | null; state: string;
  participants: { id: string; display_name?: string; avatar_url?: string }[];
}

// ── Helfer ─────────────────────────────────────────────────────────────────
function fmtEur(n: number | null | undefined): string {
  const v = n ?? 0;
  return v >= 1000 ? `€${(v/1000).toFixed(1)}K` : `€${v.toFixed(2)}`;
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function StatusBadge({ status }: { status: string }) {
  const map: Record<string,{bg:string;color:string;label:string}> = {
    approved:      { bg:'rgba(34,197,94,0.12)',  color:'#22C55E', label:'Genehmigt'   },
    rejected:      { bg:'rgba(239,68,68,0.12)',  color:'#EF4444', label:'Abgelehnt'   },
    pending:       { bg:'rgba(245,158,11,0.12)', color:'#F59E0B', label:'Ausstehend'  },
    pending_review:{ bg:'rgba(245,158,11,0.12)', color:'#F59E0B', label:'In Prüfung'  },
    published:     { bg:'rgba(34,197,94,0.12)',  color:'#22C55E', label:'Veröffentlicht'},
    active:        { bg:'rgba(14,165,233,0.12)', color:'#0EA5E9', label:'Aktiv'       },
    submitted:     { bg:'rgba(99,102,241,0.12)', color:'#6366F1', label:'Eingereicht' },
  };
  const s = map[status] ?? { bg:'rgba(148,163,184,0.12)', color:'var(--text-muted)', label: status };
  return (
    <span style={{ padding:'2px 8px', borderRadius:5, fontSize:11, fontWeight:600,
      background:s.bg, color:s.color, whiteSpace:'nowrap' }}>
      {s.label}
    </span>
  );
}


// ── EDB Referral Card mit aufklappbaren Details ──────────────────────────────
function EdbReferralCard({ ref: r }: { ref: any }) {
  const [open, setOpen] = useState(false);
  const initials = (r.display_name || r.username || '?').slice(0, 2).toUpperCase();
  return (
    <div>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
          background:'var(--bg-tertiary)',borderRadius: open ? '8px 8px 0 0' : 8,
          border:'1px solid var(--border)',cursor:'pointer' }}
      >
        <div style={{ width:32,height:32,borderRadius:'50%',background:'var(--accent)',
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:12,fontWeight:700,color:'#0F1117',flexShrink:0 }}>
          {initials}
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:12,fontWeight:600,color:'var(--text-primary)',
            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
            {r.display_name || r.username || '—'}
          </div>
          <div style={{ display:'flex',gap:8,marginTop:2 }}>
            {r.username && <span style={{ fontSize:10,color:'var(--text-muted)' }}>@{r.username}</span>}
            <span style={{ fontSize:10,color:'var(--text-muted)' }}>
              Reg. {r.joined_at ? new Date(r.joined_at).toLocaleDateString('de-DE') : '—'}
            </span>
            {r.is_active
              ? <span style={{ fontSize:10,fontWeight:700,color:'#22C55E' }}>⚡ aktiv</span>
              : <span style={{ fontSize:10,color:'var(--text-muted)' }}>😴 schlafend</span>
            }
          </div>
        </div>
        <span style={{ fontSize:11,color:'var(--text-muted)',display:'inline-block',
          transition:'transform .15s',transform:open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </div>
      {open && (
        <div style={{ padding:'10px 16px 12px',background:'rgba(99,102,241,0.05)',
          border:'1px solid var(--border)',borderTop:'none',borderRadius:'0 0 8px 8px',
          display:'flex',flexDirection:'column',gap:7 }}>
          {[
            { label:'E-Mail',   val: r.email, href: r.email ? `mailto:${r.email}` : null },
            { label:'Telefon',  val: r.phone, href: r.phone ? `tel:${r.phone}` : null },
            { label:'Rolle',    val: r.role ?? 'basisuser', href: null },
            { label:'Erste Zahlung', val: r.first_transaction_at
                ? new Date(r.first_transaction_at).toLocaleDateString('de-DE')
                : 'Noch keine', href: null },
            { label:'ID', val: r.id, href: null },
          ].map(row => (
            <div key={row.label} style={{ display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ fontSize:11,color:'var(--text-muted)',width:90,flexShrink:0 }}>{row.label}</span>
              {row.href
                ? <a href={row.href} style={{ fontSize:12,fontWeight:600,color:'var(--accent)',
                    textDecoration:'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                    {row.val || '—'}
                  </a>
                : <span style={{ fontSize:row.label==='ID' ? 10 : 12,
                    fontFamily:row.label==='ID' ? 'monospace' : undefined,
                    color:'var(--text-primary)',fontWeight:row.label==='ID' ? 400 : 600 }}>
                    {row.val || '—'}
                  </span>
              }
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Haupt-Drawer: Ambassador-Detail ────────────────────────────────────────
function AmbassadorDetailDrawer({
  amb, onClose,
}: { amb: Ambassador; onClose: () => void }) {
  const [tab, setTab]       = useState<'referrals'|'works'|'projects'|'messages'|'actions'>('referrals');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [works, setWorks]   = useState<Work[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats]   = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast]   = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadTab = useCallback(async (t: string) => {
    setLoading(true);
    try {
      if (t === 'referrals') {
        const r = await fetch(`/api/ambassador?type=referrals&ambassador_id=${amb.id}`, { credentials:'include' });
        const d = await r.json();
        setReferrals(d.referrals ?? []);
      } else if (t === 'works') {
        const r = await fetch(`/api/ambassador?type=works&ambassador_id=${amb.id}`, { credentials:'include' });
        const d = await r.json();
        setWorks(d.works ?? []);
      } else if (t === 'projects') {
        const r = await fetch(`/api/ambassador?type=projects&ambassador_id=${amb.id}`, { credentials:'include' });
        const d = await r.json();
        setProjects(d.projects ?? []);
      } else if (t === 'messages') {
        const r = await fetch(`/api/ambassador?type=messages&ambassador_id=${amb.id}`, { credentials:'include' });
        const d = await r.json();
        setChats(d.messages ?? []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [amb.id]);

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  async function sendMessage() {
    if (!msgText.trim()) return;
    setSending(true);
    try {
      const r = await fetch('/api/ambassador', {
        method:'PATCH', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'send_message',
          ambassador_id: amb.id,
          recipient_id:  amb.id, // Placeholder — in echtem Use-Case: Ziel-User-ID
          text: msgText,
        }),
      });
      const d = await r.json();
      if (d.ok) { showToast('✅ Nachricht gesendet'); setMsgText(''); loadTab('messages'); }
      else showToast('❌ Fehler: ' + (d.error ?? 'Unbekannt'));
    } finally { setSending(false); }
  }

  const tabs: { key: typeof tab; label: string }[] = [
    { key:'referrals', label:'Referrals' },
    { key:'works',    label:'Werke'    },
    { key:'projects', label:'Projekte' },
    { key:'messages', label:'Nachrichten'},
    { key:'actions',  label:'Aktionen' },
  ];

  return (
    <div onClick={onClose} style={{
      position:'fixed',inset:0,zIndex:10000,
      background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',
      display:'flex',alignItems:'flex-start',justifyContent:'flex-end',
    }}>
      {toast && (
        <div style={{ position:'fixed',top:20,right:520,zIndex:10001,
          background:'var(--accent)',color:'#fff',padding:'10px 20px',
          borderRadius:8,fontSize:13,fontWeight:600 }}>
          {toast}
        </div>
      )}
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%',maxWidth:560,height:'100vh',
        background:'var(--bg-secondary)',borderLeft:'1px solid var(--border)',
        overflowY:'auto',display:'flex',flexDirection:'column',
      }}>
        {/* Header */}
        <div style={{ padding:'20px 24px',borderBottom:'1px solid var(--border)',
          display:'flex',alignItems:'center',justifyContent:'space-between',
          background:'var(--bg-primary)',position:'sticky',top:0,zIndex:1 }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            {amb.avatarUrl
              ? <img src={amb.avatarUrl} alt="" style={{ width:44,height:44,borderRadius:'50%',objectFit:'cover' }}/>
              : <div style={{ width:44,height:44,borderRadius:'50%',background:'var(--accent)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:18,fontWeight:700,color:'#fff' }}>
                  {(amb.displayName?.[0] ?? '?').toUpperCase()}
                </div>
            }
            <div>
              <div style={{ fontWeight:700,fontSize:15 }}>{amb.displayName}</div>
              <div style={{ fontSize:12,color:'var(--text-muted)' }}>
                @{amb.username} · {amb.email ?? '—'} ·{' '}
                <span style={{ color: amb.levelColor }}>{amb.levelLabel}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'var(--bg-tertiary)',border:'1px solid var(--border)',
            borderRadius:8,padding:'6px 12px',color:'var(--text-muted)',cursor:'pointer',fontSize:13 }}>
            ✕ Schließen
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,padding:'16px 24px',
          borderBottom:'1px solid var(--border)' }}>
          {[
            { label:'Referrals',   value: String(amb.referralCount) },
            { label:'Umsatz',      value: fmtEur(amb.revenueEur)   },
            { label:'Impact',      value: fmtEur(amb.impactEur)    },
          ].map(k => (
            <div key={k.label} style={{ background:'var(--bg-tertiary)',borderRadius:10,
              padding:'12px 14px',textAlign:'center' }}>
              <div style={{ fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:1 }}>{k.label}</div>
              <div style={{ fontSize:18,fontWeight:700,color:'var(--accent)',marginTop:4 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex',borderBottom:'1px solid var(--border)',
          background:'var(--bg-primary)',position:'sticky',top:85,zIndex:1 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex:1,padding:'10px 4px',border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                background:'transparent',
                color: tab===t.key ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: tab===t.key ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab-Inhalte */}
        <div style={{ padding:'16px 24px',flex:1 }}>
          {loading ? (
            <div style={{ color:'var(--text-muted)',textAlign:'center',paddingTop:40 }}>Lade…</div>
          ) : tab === 'referrals' ? (
            <div>
              <div style={{ fontSize:12,color:'var(--text-muted)',marginBottom:12 }}>
                {referrals.length} geworbene Nutzer — klicken für Details
              </div>
              {referrals.length === 0
                ? <div style={{ color:'var(--text-muted)',fontSize:13 }}>Noch keine Referrals.</div>
                : <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                    {referrals.map((ref: any) => (
                      <EdbReferralCard key={ref.id} ref={ref} />
                    ))}
                  </div>
              }
            </div>
          ) : tab === 'works' ? (
            <div>
              <div style={{ fontSize:12,color:'var(--text-muted)',marginBottom:12 }}>
                {works.length} Werk{works.length !== 1 ? 'e' : ''}
              </div>
              {works.length === 0
                ? <div style={{ color:'var(--text-muted)',fontSize:13 }}>Keine Werke vorhanden.</div>
                : works.map(w => (
                  <div key={w.id} style={{ background:'var(--bg-tertiary)',borderRadius:10,
                    padding:'12px 14px',marginBottom:10,
                    border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                      <div style={{ fontWeight:600,fontSize:13,color:'var(--text-primary)' }}>{w.title || '(kein Titel)'}</div>
                      <StatusBadge status={w.approval_status || w.status || 'pending'} />
                    </div>
                    <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:4 }}>{fmtDate(w.created_at)}</div>
                  </div>
                ))
              }
            </div>
          ) : tab === 'projects' ? (
            <div>
              <div style={{ fontSize:12,color:'var(--text-muted)',marginBottom:12 }}>
                {projects.length} Projekt{projects.length !== 1 ? 'e' : ''}
              </div>
              {projects.length === 0
                ? <div style={{ color:'var(--text-muted)',fontSize:13 }}>Keine Projekte vorhanden.</div>
                : projects.map(p => (
                  <div key={p.id} style={{ background:'var(--bg-tertiary)',borderRadius:10,
                    padding:'12px 14px',marginBottom:10,border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start' }}>
                      <div style={{ fontWeight:600,fontSize:13 }}>{p.project_name || '(kein Name)'}</div>
                      <StatusBadge status={p.status} />
                    </div>
                    <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:4 }}>
                      {p.funding_goal ? fmtEur(p.funding_goal) + ' Ziel' : 'Kein Ziel'} · {fmtDate(p.created_at)}
                    </div>
                  </div>
                ))
              }
            </div>
          ) : tab === 'messages' ? (
            <div>
              <div style={{ fontSize:12,color:'var(--text-muted)',marginBottom:12 }}>
                {chats.length} Gespräch{chats.length !== 1 ? 'e' : ''}
              </div>
              {chats.length === 0
                ? <div style={{ color:'var(--text-muted)',fontSize:13 }}>Keine Nachrichten vorhanden.</div>
                : chats.map(c => (
                  <div key={c.chat_id} style={{ background:'var(--bg-tertiary)',borderRadius:10,
                    padding:'12px 14px',marginBottom:10,border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:13,fontWeight:600,color:'var(--text-primary)',marginBottom:4 }}>
                      {c.participants?.filter((p: any) => p.id !== amb.id)
                        .map((p: any) => p.display_name || p.id)
                        .join(', ') || 'Gespräch'}
                    </div>
                    {c.last_message && (
                      <div style={{ fontSize:12,color:'var(--text-muted)',
                        whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
                        {c.last_message}
                      </div>
                    )}
                    <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:4 }}>
                      {fmtDate(c.last_message_at)}
                    </div>
                  </div>
                ))
              }
            </div>
          ) : (
            // Aktionen
            <div>
              <div style={{ fontSize:13,fontWeight:600,color:'var(--text-primary)',marginBottom:16 }}>
                Nachricht senden
              </div>
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder="Nachricht an diesen Ambassador…"
                rows={4}
                style={{ width:'100%',boxSizing:'border-box',padding:'10px 12px',
                  background:'var(--bg-tertiary)',border:'1px solid var(--border)',
                  borderRadius:8,color:'var(--text-primary)',fontSize:13,resize:'vertical',outline:'none' }}
              />
              <button onClick={sendMessage} disabled={sending || !msgText.trim()}
                style={{ marginTop:10,padding:'9px 20px',background:'var(--accent)',
                  color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,
                  opacity: (sending || !msgText.trim()) ? 0.6 : 1 }}>
                {sending ? 'Sende…' : '📤 Senden'}
              </button>

              <div style={{ marginTop:24,padding:'14px',background:'var(--bg-tertiary)',
                borderRadius:10,border:'1px solid var(--border)' }}>
                <div style={{ fontSize:12,color:'var(--text-muted)',marginBottom:8 }}>Info</div>
                <div style={{ fontSize:12,color:'var(--text-primary)',lineHeight:1.6 }}>
                  Role: <b>{amb.role}</b><br/>
                  Mitglied seit: <b>{fmtDate(amb.createdAt)}</b><br/>
                  Referral-Code: <b>{amb.referralCode || '—'}</b><br/>
                  Referral-Link: <b style={{ fontSize:11 }}>{amb.referralLink || '—'}</b>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Haupt-Seite ─────────────────────────────────────────────────────────────
export default function AmbassadorsPage() {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role ?? 'employee';

  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [toast, setToast]             = useState('');
  const [selected, setSelected]       = useState<Ambassador | null>(null);
  const [acting, setActing]           = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/ambassador?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAmbassadors(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      console.error('[ambassadors]', e);
      setAmbassadors([]);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function toggleAmbassador(a: Ambassador) {
    if (userRole !== 'superadmin') return;
    setActing(a.id);
    try {
      const res = await fetch('/api/ambassador', {
        method:'PATCH', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ user_id: a.id, action: 'deactivate' }),
      });
      if (res.ok) { showToast('✅ Ambassador-Status entfernt'); load(); }
      else showToast('❌ Fehler beim Speichern');
    } finally { setActing(null); }
  }

  const filtered = ambassadors.filter(a =>
    !search ||
    a.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (a.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.username ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = ambassadors.reduce((s, a) => s + (a.revenueEur ?? 0), 0);
  const totalRef     = ambassadors.reduce((s, a) => s + (a.referralCount ?? 0), 0);

  const thStyle: React.CSSProperties = {
    padding:'10px 14px', textAlign:'left', fontSize:10,
    textTransform:'uppercase', letterSpacing:'0.6px',
    color:'var(--text-muted)', fontWeight:600,
  };
  const tdStyle: React.CSSProperties = { padding:'10px 14px' };

  return (
    <EmployeeLayout title="Ambassadors">
      {toast && (
        <div style={{ position:'fixed',top:20,right:20,zIndex:9999,background:'var(--accent)',
          color:'#fff',padding:'10px 20px',borderRadius:8,fontSize:13,fontWeight:600 }}>
          {toast}
        </div>
      )}

      {selected && (
        <AmbassadorDetailDrawer amb={selected} onClose={() => setSelected(null)} />
      )}

      <PageHeader
        title="Ambassadors"
        subtitle="Referral-Partner & Markenbotschafter"
        actionsRole={userRole as 'superadmin' | 'employee'}
        userRole={userRole}
      />

      {/* KPI-Kacheln */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12,marginBottom:20 }}>
        {[
          { label:'Ambassadors', val: String(ambassadors.length), icon:'🤝' },
          { label:'Referrals',   val: String(totalRef),           icon:'🔗' },
          { label:'Umsatz',      val: totalRevenue >= 1000 ? `€${(totalRevenue/1000).toFixed(1)}K` : `€${totalRevenue.toFixed(2)}`, icon:'💰' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--bg-secondary)',border:'1px solid var(--border)',borderRadius:12,padding:'16px 18px' }}>
            <div style={{ fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:4 }}>
              {k.icon} {k.label}
            </div>
            <div style={{ fontSize:22,fontWeight:700,color:'var(--accent)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Suche */}
      <div style={{ marginBottom:16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Name, E-Mail oder Username suchen…"
          style={{ width:'100%',maxWidth:400,padding:'8px 14px',
            background:'var(--bg-secondary)',border:'1px solid var(--border)',
            borderRadius:8,color:'var(--text-primary)',fontSize:13,outline:'none' }}
        />
      </div>

      {/* Tabelle */}
      {loading ? (
        <div style={{ color:'var(--text-muted)',padding:40,textAlign:'center' }}>Lade Ambassadors…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color:'var(--text-muted)',padding:40,textAlign:'center',fontSize:14 }}>
          {search ? 'Keine Ergebnisse für diese Suche.' : 'Noch keine Ambassadors vorhanden.'}
        </div>
      ) : (
        <div style={{ overflowX:'auto',borderRadius:12,border:'1px solid var(--border)' }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead style={{ background:'var(--bg-tertiary)' }}>
              <tr>
                <th style={thStyle}>Ambassador</th>
                <th style={thStyle}>Level</th>
                <th style={thStyle}>Referrals</th>
                <th style={thStyle}>Umsatz</th>
                <th style={thStyle}>Seit</th>
                <th style={thStyle}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={a.id}
                  onClick={() => setSelected(a)}
                  style={{
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    cursor:'pointer',
                    background: selected?.id === a.id ? 'var(--bg-tertiary)' : 'transparent',
                    transition:'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = selected?.id === a.id ? 'var(--bg-tertiary)' : 'transparent')}
                >
                  <td style={tdStyle}>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                      {a.avatarUrl
                        ? <img src={a.avatarUrl} alt="" style={{ width:34,height:34,borderRadius:'50%',objectFit:'cover' }}/>
                        : <div style={{ width:34,height:34,borderRadius:'50%',background:'var(--accent)',
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:14,fontWeight:700,color:'#fff',flexShrink:0 }}>
                            {(a.displayName?.[0] ?? '?').toUpperCase()}
                          </div>
                      }
                      <div>
                        <div style={{ fontWeight:600,fontSize:13,color:'var(--text-primary)' }}>{a.displayName}</div>
                        <div style={{ fontSize:11,color:'var(--text-muted)' }}>@{a.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: a.levelColor, fontWeight:700, fontSize:12 }}>{a.levelLabel}</span>
                  </td>
                  <td style={{ ...tdStyle, fontWeight:600, color:'var(--accent)' }}>{a.referralCount}</td>
                  <td style={tdStyle}>{a.revenueEur >= 1000 ? `€${(a.revenueEur/1000).toFixed(1)}K` : `€${a.revenueEur.toFixed(2)}`}</td>
                  <td style={{ ...tdStyle, fontSize:12, color:'var(--text-muted)' }}>
                    {new Date(a.createdAt).toLocaleDateString('de-DE', { day:'2-digit', month:'short', year:'numeric' })}
                  </td>
                  <td style={tdStyle} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setSelected(a)}
                      style={{ padding:'5px 12px',background:'var(--bg-tertiary)',
                        border:'1px solid var(--border)',borderRadius:6,
                        color:'var(--text-primary)',cursor:'pointer',fontSize:11,marginRight:6 }}>
                      Details
                    </button>
                    {userRole === 'superadmin' && (
                      <button onClick={() => toggleAmbassador(a)}
                        disabled={acting === a.id}
                        style={{ padding:'5px 12px',background:'rgba(239,68,68,0.1)',
                          border:'1px solid rgba(239,68,68,0.3)',borderRadius:6,
                          color:'#EF4444',cursor:'pointer',fontSize:11,
                          opacity: acting === a.id ? 0.5 : 1 }}>
                        {acting === a.id ? '…' : 'Entfernen'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </EmployeeLayout>
  );
}
