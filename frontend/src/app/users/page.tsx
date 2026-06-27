// frontend/src/app/users/page.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { showToast } from '@/components/ui/Toast';
import UserTable from '@/components/users/UserTable';
import { useUsers, MergedUser } from '@/lib/hooks/useUsers';

type TabKey     = 'active' | 'blocked' | 'deleted' | 'wirker' | 'duplicates';
type RoleFilter = 'all' | 'basisuser' | 'member' | 'wirker' | 'admin';

function KPICard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)',
      borderRadius:12, padding:'20px 24px', minWidth:140 }}>
      <div style={{ fontSize:28, fontWeight:700, color }}>{value}</div>
      <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4,
        textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
    </div>
  );
}

function normalizeName(s: string) {
  return (s||'').toLowerCase().replace(/[^a-z0-9]/g,'').trim();
}
function findDuplicates(users: MergedUser[]): MergedUser[] {
  const seen = new Map<string,MergedUser[]>();
  for (const u of users) {
    const key = normalizeName(u.display_name||u.username||u.email||'');
    if (key.length < 4) continue;
    if (!seen.has(key)) seen.set(key,[]);
    seen.get(key)!.push(u);
  }
  const dupes: MergedUser[] = [];
  seen.forEach(arr => { if (arr.length>1) dupes.push(...arr); });
  return [...new Map(dupes.map(u=>[u.id,u])).values()];
}

async function apiAction(action: string, userId: string, extra: Record<string,unknown>={}) {
  const res = await fetch(`/api/users/${userId}`, {
    method:'PATCH', credentials:'include',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action, ...extra }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiDelete(userId: string) {
  const res = await fetch(`/api/users/${userId}`, {
    method:'DELETE', credentials:'include',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── User-Detail-Modal ────────────────────────────────────────────────────────
function UserDetailModal({
  user, onClose, onBlock, onUnblock, onDelete, refetch
}: {
  user: MergedUser;
  onClose: () => void;
  onBlock:   (u: MergedUser, reason: string) => void;
  onUnblock: (u: MergedUser) => void;
  onDelete:  (u: MergedUser) => void;
  refetch: () => void;
}) {
  const [view,        setView]        = useState<'info' | 'block' | 'note'>('info');
  const [blockReason, setBlockReason] = useState(user.blocked_reason || '');
  const [saving,      setSaving]      = useState(false);

  const saveNote = async () => {
    setSaving(true);
    try {
      await apiAction('update_block_reason', user.id, { reason: blockReason });
      showToast('Notiz gespeichert.', 'success');
      refetch();
    } catch { showToast('Fehler beim Speichern.', 'error'); }
    finally { setSaving(false); }
  };

  const isBlocked = user.blocked;

  const avatar = user.avatar_url;
  const initials = ((user.display_name||user.username||user.email||'?')
    .split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase());

  function Row({ label, val }: { label: string; val: string | null | undefined }) {
    if (!val || val === '—') return null;
    return (
      <div style={{ display:'flex', gap:12, borderBottom:'1px solid var(--border)', paddingBottom:8 }}>
        <span style={{ width:130, color:'var(--text-secondary)', flexShrink:0, fontSize:12 }}>{label}</span>
        <span style={{ color:'var(--text-primary)', wordBreak:'break-all', fontSize:13 }}>{val}</span>
      </div>
    );
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:9000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div style={{ background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:16,
        width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', padding:28 }}
        onClick={e=>e.stopPropagation()}>

        {/* Close */}
        <button onClick={onClose} style={{ position:'absolute', top:16, right:20, background:'none',
          border:'none', fontSize:20, cursor:'pointer', color:'var(--text-muted)' }}>×</button>

        {/* Avatar + Name */}
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
          {avatar ? (
            <img src={avatar} alt="" style={{ width:72, height:72, borderRadius:'50%',
              objectFit:'cover', border:'2px solid var(--border)', flexShrink:0 }} />
          ) : (
            <div style={{ width:72, height:72, borderRadius:'50%', background:'var(--accent-dim)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:26, fontWeight:700, color:'var(--accent)', flexShrink:0 }}>
              {initials}
            </div>
          )}
          <div>
            <h2 style={{ fontSize:17, fontWeight:700, color:'var(--text-primary)', margin:'0 0 4px' }}>
              {user.display_name || user.full_name || user.username || 'Unbekannt'}
            </h2>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>{user.email}</div>
            {user.phone && <div style={{ fontSize:12, color:'var(--text-muted)' }}>{user.phone}</div>}
            <div style={{ marginTop:6 }}>
              {isBlocked ? (
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4,
                  background:'rgba(246,173,85,0.15)', color:'#f6ad55', fontWeight:600 }}>
                  🔒 Blockiert
                </span>
              ) : (
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4,
                  background:'rgba(104,211,145,0.15)', color:'#68d391', fontWeight:600 }}>
                  ✓ Aktiv
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:18, borderBottom:'1px solid var(--border)', paddingBottom:12 }}>
          {([['info','Profil-Info'], ['block', isBlocked ? 'Entsperren' : 'Blockieren'], ['note','Admin-Notiz']] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setView(k)}
              style={{ padding:'5px 14px', borderRadius:16, fontSize:12, cursor:'pointer',
                border:`1px solid ${view===k?'var(--accent)':'var(--border)'}`,
                background: view===k ? 'var(--accent-dim)' : 'transparent',
                color: view===k ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: view===k ? 600 : 400 }}>
              {l}
            </button>
          ))}
        </div>

        {/* Profil-Info */}
        {view === 'info' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <Row label="ID"           val={user.id} />
            <Row label="E-Mail"       val={user.email} />
            <Row label="Telefon"      val={user.phone} />
            <Row label="Name"         val={user.display_name || user.full_name} />
            <Row label="Username"     val={user.username} />
            <Row label="Rolle"        val={user.role} />
            <Row label="Membership"   val={user.membership_type} />
            <Row label="Wirker"       val={user.is_wirker ? 'Ja ★' : 'Nein'} />
            <Row label="Status"       val={isBlocked ? 'Blockiert' : 'Aktiv'} />
            <Row label="Trust Score"  val={user.trust_score > 0 ? String(user.trust_score) : null} />
            <Row label="Impact"       val={user.impact_eur > 0 ? `€ ${user.impact_eur.toFixed(2)}` : null} />
            <Row label="Standort"     val={(user as unknown as Record<string,string>).location_label || (user as unknown as Record<string,string>).location} />
            <Row label="Registriert"  val={new Date(user.created_at).toLocaleDateString('de-DE')} />
            <Row label="Letzter Login" val={user.last_seen_at ? new Date(user.last_seen_at).toLocaleDateString('de-DE') : null} />
            <Row label="Quelle"       val={user.source} />
            {isBlocked && user.blocked_reason && (
              <div style={{ marginTop:4, padding:'10px 14px', borderRadius:8,
                background:'rgba(246,173,85,0.08)', border:'1px solid rgba(246,173,85,0.3)' }}>
                <p style={{ fontSize:11, color:'#f6ad55', fontWeight:600, margin:'0 0 4px' }}>Blockierungsgrund</p>
                <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>{user.blocked_reason}</p>
              </div>
            )}
            <div style={{ marginTop:8, padding:'10px 14px', borderRadius:8,
              background:'var(--bg-secondary)', border:'1px solid var(--border)' }}>
              <p style={{ fontSize:11, color:'var(--text-muted)', margin:'0 0 2px' }}>Support-Kontakt</p>
              <a href="mailto:support@be-hui.com" style={{ fontSize:13, color:'var(--accent)',
                textDecoration:'none', fontWeight:500 }}>support@be-hui.com</a>
            </div>
          </div>
        )}

        {/* Block / Unblock */}
        {view === 'block' && (
          <div>
            {isBlocked ? (
              <div>
                <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:16 }}>
                  Nutzer <strong>{user.display_name||user.email}</strong> ist aktuell blockiert.
                  Nach dem Entsperren kann er die App wieder normal nutzen.
                </p>
                {user.blocked_reason && (
                  <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:16,
                    background:'rgba(246,173,85,0.08)', border:'1px solid rgba(246,173,85,0.3)' }}>
                    <p style={{ fontSize:11, color:'#f6ad55', fontWeight:600, margin:'0 0 4px' }}>Aktueller Grund</p>
                    <p style={{ fontSize:13, color:'var(--text-secondary)', margin:0 }}>{user.blocked_reason}</p>
                  </div>
                )}
                <button onClick={()=>onUnblock(user)}
                  style={{ width:'100%', padding:'11px', borderRadius:8, border:'1px solid #68d391',
                    background:'rgba(104,211,145,0.1)', color:'#68d391', fontSize:14,
                    cursor:'pointer', fontWeight:600 }}>
                  ✓ Nutzer entsperren &amp; freigeben
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:12 }}>
                  Der Nutzer kann danach keine Werke, Talente oder Kommentare mehr abgeben.
                  Beim nächsten Login erhält er die Meldung: <em>"Dein Konto wird von einem Admin geprüft.
                  Bei Fragen: support@be-hui.com"</em>
                </p>
                <label style={{ fontSize:12, color:'var(--text-muted)', textTransform:'uppercase',
                  letterSpacing:'0.05em', display:'block', marginBottom:6 }}>
                  Blockierungsgrund *
                </label>
                <textarea
                  value={blockReason}
                  onChange={e=>setBlockReason(e.target.value)}
                  placeholder="Z.B.: Verstoß gegen Nutzungsbedingungen, unangemessene Inhalte..."
                  style={{ width:'100%', padding:'10px 12px', borderRadius:8,
                    border:'1px solid var(--border)', background:'var(--bg-secondary)',
                    color:'var(--text-primary)', fontSize:13, resize:'vertical',
                    minHeight:90, boxSizing:'border-box', marginBottom:14 }}
                />
                <button onClick={()=>onBlock(user, blockReason)}
                  disabled={!blockReason.trim()}
                  style={{ width:'100%', padding:'11px', borderRadius:8, border:'1px solid #f6ad55',
                    background: blockReason.trim() ? 'rgba(246,173,85,0.12)' : 'transparent',
                    color: blockReason.trim() ? '#f6ad55' : 'var(--text-muted)',
                    fontSize:14, cursor: blockReason.trim() ? 'pointer' : 'not-allowed',
                    fontWeight:600, marginBottom:10 }}>
                  🔒 Nutzer blockieren
                </button>
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:12 }}>
                  <button onClick={()=>onDelete(user)}
                    style={{ width:'100%', padding:'10px', borderRadius:8, border:'1px solid var(--red)',
                      background:'rgba(255,107,107,0.06)', color:'var(--red)',
                      fontSize:13, cursor:'pointer', fontWeight:500 }}>
                    🗑 Konto endgültig löschen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Admin-Notiz */}
        {view === 'note' && (
          <div>
            <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:12 }}>
              Schreibe eine interne Admin-Notiz zu diesem Nutzer. Diese ist nur für Admins sichtbar.
            </p>
            <textarea
              value={blockReason}
              onChange={e=>setBlockReason(e.target.value)}
              placeholder="Interne Notiz: z.B. warum der Nutzer blockiert wurde, was geprüft wird, ggf. Datum der geplanten Löschung..."
              style={{ width:'100%', padding:'10px 12px', borderRadius:8,
                border:'1px solid var(--border)', background:'var(--bg-secondary)',
                color:'var(--text-primary)', fontSize:13, resize:'vertical',
                minHeight:120, boxSizing:'border-box', marginBottom:14 }}
            />
            <button onClick={saveNote} disabled={saving}
              style={{ padding:'9px 20px', borderRadius:8, border:'none',
                background:'var(--accent)', color:'#fff', fontSize:13,
                cursor: saving ? 'not-allowed' : 'pointer', fontWeight:600, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Wird gespeichert...' : 'Notiz speichern'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Blockiert-Tab: extra Aktionen ────────────────────────────────────────────
function BlockedCard({
  user, onUnblock, onDelete, onInfo
}: {
  user: MergedUser;
  onUnblock: (u: MergedUser) => void;
  onDelete:  (u: MergedUser) => void;
  onInfo:    (u: MergedUser) => void;
}) {
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid rgba(246,173,85,0.25)',
      borderRadius:10, padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
      {/* Avatar */}
      {user.avatar_url ? (
        <img src={user.avatar_url} alt="" style={{ width:40, height:40, borderRadius:'50%',
          objectFit:'cover', flexShrink:0 }} />
      ) : (
        <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--accent-dim)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:14, fontWeight:700, color:'var(--accent)', flexShrink:0 }}>
          {((user.display_name||user.email||'?')[0]||'?').toUpperCase()}
        </div>
      )}
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)', margin:'0 0 2px' }}>
          {user.display_name || user.username || '—'}
        </p>
        <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>{user.email}</p>
        {user.blocked_reason && (
          <p style={{ fontSize:11, color:'#f6ad55', margin:'3px 0 0',
            maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            ⚠️ {user.blocked_reason}
          </p>
        )}
        <p style={{ fontSize:10, color:'var(--text-muted)', margin:'2px 0 0' }}>
          Blockiert: {user.blocked_at ? new Date(user.blocked_at).toLocaleDateString('de-DE') : '—'}
        </p>
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        <button onClick={()=>onInfo(user)} title="Info & Notiz"
          style={{ padding:'5px 10px', borderRadius:6, border:'1px solid var(--border)',
            background:'transparent', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
          ℹ️
        </button>
        <button onClick={()=>onUnblock(user)} title="Freigeben"
          style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #68d391',
            background:'rgba(104,211,145,0.08)', color:'#68d391', fontSize:12,
            cursor:'pointer', fontWeight:600 }}>
          Freigeben
        </button>
        <button onClick={()=>onDelete(user)} title="Endgültig löschen"
          style={{ padding:'5px 10px', borderRadius:6, border:'1px solid var(--red)',
            background:'rgba(255,107,107,0.06)', color:'var(--red)', fontSize:12, cursor:'pointer' }}>
          🗑
        </button>
      </div>
    </div>
  );
}

// ── Hauptseite ───────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [activeTab,    setActiveTab]    = useState<TabKey>('active');
  const [roleFilter,   setRoleFilter]   = useState<RoleFilter>('all');
  const [search,       setSearch]       = useState('');
  const [viewUser,     setViewUser]     = useState<MergedUser | null>(null);

  const { users: allUsers, counts, loading, error, refetch } = useUsers({
    filter: 'all', search, limit: 1000, refreshInterval: 30_000,
  });

  const displayUsers = useMemo<MergedUser[]>(() => {
    let base: MergedUser[] = [];
    if (activeTab === 'active')     base = allUsers.filter(u => !u.blocked && !u.is_deleted);
    if (activeTab === 'blocked')    base = allUsers.filter(u => u.blocked && !u.is_deleted);
    if (activeTab === 'deleted')    base = allUsers.filter(u => u.is_deleted);
    if (activeTab === 'wirker')     base = allUsers.filter(u => u.is_wirker);
    if (activeTab === 'duplicates') base = findDuplicates(allUsers);
    if (roleFilter !== 'all') {
      if (roleFilter === 'basisuser') base = base.filter(u => !['member','wirker','admin','superadmin'].includes(u.role?.toLowerCase()||''));
      if (roleFilter === 'member')    base = base.filter(u => u.role?.toLowerCase()==='member'||u.is_member);
      if (roleFilter === 'wirker')    base = base.filter(u => u.is_wirker);
      if (roleFilter === 'admin')     base = base.filter(u => ['admin','superadmin'].includes(u.role?.toLowerCase()));
    }
    return base;
  }, [allUsers, activeTab, roleFilter]);

  const handleAction = useCallback(async (action: string, user: MergedUser) => {
    if (action === 'view') { setViewUser(user); return; }
    if (action === 'block' || action === 'unblock' || action === 'delete' || action === 'restore') {
      setViewUser(user);
    }
  }, []);

  const handleBlock = useCallback(async (user: MergedUser, reason: string) => {
    try {
      await apiAction('block', user.id, { reason });
      showToast(`${user.display_name||user.email} blockiert.`, 'success');
      setViewUser(null);
      refetch();
    } catch { showToast('Fehler beim Blockieren.', 'error'); }
  }, [refetch]);

  const handleUnblock = useCallback(async (user: MergedUser) => {
    try {
      await apiAction('unblock', user.id);
      showToast(`${user.display_name||user.email} freigegeben.`, 'success');
      setViewUser(null);
      refetch();
    } catch { showToast('Fehler beim Entsperren.', 'error'); }
  }, [refetch]);

  const handleDelete = useCallback(async (user: MergedUser) => {
    if (!window.confirm(`Konto von "${user.display_name||user.email}" endgültig löschen? Dies kann nicht rückgängig gemacht werden.`)) return;
    try {
      await apiDelete(user.id);
      showToast('Konto gelöscht.', 'info');
      setViewUser(null);
      refetch();
    } catch { showToast('Fehler beim Löschen.', 'error'); }
  }, [refetch]);

  const TABS = [
    { key:'active'     as TabKey, label:'Aktive User',  count:counts.active,  color:'#68d391' },
    { key:'blocked'    as TabKey, label:'Blockiert',     count:counts.blocked, color:'#f6ad55' },
    { key:'deleted'    as TabKey, label:'Gelöscht',      count:counts.deleted, color:'#fc8181' },
    { key:'wirker'     as TabKey, label:'Wirker',        count:counts.wirker,  color:'#d69e2e' },
    { key:'duplicates' as TabKey, label:'Duplikate',     count:findDuplicates(allUsers).length, color:'#f6ad55' },
  ];

  return (
    <DashboardLayout title="User Management">
      <PageHeader title="User Management" subtitle="Alle registrierten Nutzer verwalten" />

      {error && (
        <div style={{ background:'#fc818122', border:'1px solid #fc8181', borderRadius:8,
          padding:'12px 16px', marginBottom:16, color:'#fc8181', fontSize:13 }}>
          Fehler: {error}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'flex', gap:16, marginBottom:28, flexWrap:'wrap' }}>
        <KPICard label="Aktive User"  value={counts.active}  color="#68d391" />
        <KPICard label="Blockiert"    value={counts.blocked} color="#f6ad55" />
        <KPICard label="Gelöscht"     value={counts.deleted} color="#fc8181" />
        <KPICard label="Wirker"       value={counts.wirker}  color="#d69e2e" />
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={()=>setActiveTab(tab.key)} style={{
            padding:'7px 16px', borderRadius:20, fontSize:13, fontWeight:500, cursor:'pointer',
            background: activeTab===tab.key ? tab.color : 'var(--bg-card)',
            color:      activeTab===tab.key ? '#fff' : 'var(--text-secondary)',
            border:     `1px solid ${activeTab===tab.key ? tab.color : 'var(--border)'}`,
          }}>
            {activeTab===tab.key && '● '}{tab.label}
            {tab.count > 0 && <span style={{ marginLeft:6, opacity:0.8 }}>({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Suche + Rollen */}
      <div style={{ display:'flex', gap:12, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={`In ${TABS.find(t=>t.key===activeTab)?.label??'Usern'} suchen…`}
          style={{ flex:1, minWidth:200, padding:'9px 14px', borderRadius:8,
            background:'var(--bg-card)', border:'1px solid var(--border)',
            color:'var(--text-primary)', fontSize:13, outline:'none' }} />
        <div style={{ display:'flex', gap:6 }}>
          {(['all','basisuser','member','wirker','admin'] as RoleFilter[]).map(r=>(
            <button key={r} onClick={()=>setRoleFilter(r)} style={{
              padding:'7px 14px', borderRadius:16, fontSize:12, cursor:'pointer',
              background: roleFilter===r ? 'var(--accent)' : 'var(--bg-card)',
              color:      roleFilter===r ? 'var(--text-primary)' : 'var(--text-secondary)',
              border:     `1px solid ${roleFilter===r ? 'var(--accent)' : 'var(--border)'}`,
            }}>
              {r==='all'?'Alle':r==='basisuser'?'Basisuser':r==='member'?'Member':r==='wirker'?'Wirker':'Admin'}
            </button>
          ))}
        </div>
        <span style={{ fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>
          {displayUsers.length} / {counts.total}
        </span>
      </div>

      {/* Blockiert-Tab: eigene Karten-Ansicht */}
      {activeTab === 'blocked' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {loading && <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>Lädt...</div>}
          {!loading && displayUsers.length === 0 && (
            <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)', fontSize:14 }}>
              Keine blockierten Nutzer.
            </div>
          )}
          {displayUsers.map(u => (
            <BlockedCard key={u.id} user={u}
              onUnblock={handleUnblock}
              onDelete={handleDelete}
              onInfo={u2=>setViewUser(u2)}
            />
          ))}
        </div>
      ) : (
        /* Standard-Tabelle für alle anderen Tabs */
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <UserTable users={displayUsers} loading={loading} onAction={(action, user) => {
            if (action === 'view') setViewUser(user);
            else handleAction(action, user);
          }} />
        </div>
      )}

      {/* User-Detail-Modal */}
      {viewUser && (
        <UserDetailModal
          user={viewUser}
          onClose={()=>setViewUser(null)}
          onBlock={handleBlock}
          onUnblock={handleUnblock}
          onDelete={handleDelete}
          refetch={refetch}
        />
      )}
    </DashboardLayout>
  );
}
