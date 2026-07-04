'use client';
// frontend/src/app/flags/page.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';

// ── Typen ─────────────────────────────────────────────────────────────────────
interface Flag {
  label:       string;
  description: string;
  enabled:     boolean;
  target:      string;
  category:    string;
  created_at?: string;
  updated_at?: string;
}
type Flags = Record<string, Flag>;

const TARGET_OPTIONS = ['all','wirker','members','admins','basisuser'];
const CATEGORY_OPTIONS = ['Features','Zahlung','Impact','Content','System','UX','KI','Custom'];
const TARGET_LABELS: Record<string,string> = {
  all:'🌍 Alle', wirker:'⭐ Wirker', members:'🏅 Members', admins:'🛡️ Admins', basisuser:'◎ Basisuser',
};
const CATEGORY_COLORS: Record<string,string> = {
  Features:'var(--accent)', Zahlung:'var(--green)', Impact:'#a78bfa', Content:'#fb923c',
  System:'var(--text-muted)', UX:'#38bdf8', KI:'#f472b6', Custom:'var(--gold)',
};

const EMPTY_FLAG = { key:'', label:'', description:'', target:'all', category:'Features' };

// ── Toggle Switch ──────────────────────────────────────────────────────────────
function Switch({ on, disabled: dis, onChange }: { on:boolean; disabled?:boolean; onChange:(v:boolean)=>void }) {
  return (
    <button onClick={() => !dis && onChange(!on)} disabled={dis}
      role="switch" aria-checked={on}
      style={{ width:44, height:24, borderRadius:12, border:'none', cursor: dis ? 'default':'pointer',
        background: on ? 'var(--accent)' : 'var(--bg-tertiary)',
        position:'relative', transition:'background 0.2s', flexShrink:0,
        opacity: dis ? 0.5 : 1 }}>
      <div style={{ width:18, height:18, borderRadius:'50%', background:'#fff',
        position:'absolute', top:3, left: on ? 23 : 3, transition:'left 0.2s' }} />
    </button>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────────
function Badge({ text, color }: { text:string; color:string }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, color, background: color+'20',
      padding:'2px 6px', borderRadius:4, textTransform:'uppercase', letterSpacing:'0.04em',
      whiteSpace:'nowrap' }}>
      {text}
    </span>
  );
}

// ── Bestätigungs-Modal ─────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }: {
  message:string; onConfirm:()=>void; onCancel:()=>void;
}) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={onCancel}>
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)',
        borderRadius:12, padding:24, maxWidth:380, width:'90%' }}
        onClick={e => e.stopPropagation()}>
        <p style={{ margin:'0 0 20px', fontSize:14, color:'var(--text-primary)', lineHeight:1.5 }}>{message}</p>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onCancel}
            style={{ padding:'7px 16px', borderRadius:7, border:'1px solid var(--border)',
              background:'transparent', color:'var(--text-secondary)', cursor:'pointer', fontSize:13 }}>
            Abbrechen
          </button>
          <button onClick={onConfirm}
            style={{ padding:'7px 16px', borderRadius:7, border:'none',
              background:'var(--red)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Flag-Karte ─────────────────────────────────────────────────────────────────
function FlagCard({ flagKey, flag, toggling, onToggle, onEdit, onDelete, selected, onSelect }: {
  flagKey:string; flag:Flag; toggling:boolean;
  onToggle:(k:string,v:boolean)=>void;
  onEdit:(k:string)=>void;
  onDelete:(k:string)=>void;
  selected:boolean;
  onSelect:(k:string)=>void;
}) {
  const catColor = CATEGORY_COLORS[flag.category] ?? 'var(--text-muted)';
  return (
    <div style={{ background:'var(--bg-secondary)',
      border:`1px solid ${flag.enabled ? 'rgba(78,205,196,0.35)' : selected ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius:10, padding:'14px 16px', display:'flex', flexDirection:'column', gap:10,
      transition:'border-color 0.15s', position:'relative' }}>

      {/* Auswahl-Checkbox */}
      <input type="checkbox" checked={selected} onChange={() => onSelect(flagKey)}
        style={{ position:'absolute', top:12, right:12, width:15, height:15,
          accentColor:'var(--accent)', cursor:'pointer' }} />

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:10, paddingRight:20 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {flag.label}
            </span>
            <Badge text={flag.category} color={catColor} />
          </div>
          {flag.description && (
            <p style={{ margin:0, fontSize:11, color:'var(--text-muted)', lineHeight:1.5 }}>
              {flag.description}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginTop:'auto' }}>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <Badge text={TARGET_LABELS[flag.target] ?? flag.target} color="var(--text-secondary)" />
          <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace',
            background:'var(--bg-tertiary)', padding:'2px 6px', borderRadius:4 }}>
            {flagKey}
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <span style={{ fontSize:11, fontWeight:700,
            color: flag.enabled ? 'var(--accent)' : 'var(--text-muted)' }}>
            {flag.enabled ? 'AN' : 'AUS'}
          </span>
          {/* Edit */}
          <button onClick={() => onEdit(flagKey)} title="Bearbeiten"
            style={{ background:'none', border:'1px solid var(--border)', borderRadius:6,
              color:'var(--text-muted)', cursor:'pointer', padding:'3px 7px', fontSize:12,
              transition:'all 0.15s' }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--accent)';(e.currentTarget as HTMLElement).style.color='var(--accent)'}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border)';(e.currentTarget as HTMLElement).style.color='var(--text-muted)'}}>
            ✏️
          </button>
          {/* Delete */}
          <button onClick={() => onDelete(flagKey)} title="Flag löschen"
            style={{ background:'none', border:'none', color:'var(--text-muted)',
              cursor:'pointer', padding:'3px 7px', fontSize:12, borderRadius:6,
              transition:'color 0.15s' }}
            onMouseEnter={e=>((e.currentTarget as HTMLElement).style.color='var(--red)')}
            onMouseLeave={e=>((e.currentTarget as HTMLElement).style.color='var(--text-muted)')}>
            🗑
          </button>
          <Switch on={flag.enabled} disabled={toggling} onChange={v => onToggle(flagKey, v)} />
        </div>
      </div>
    </div>
  );
}

// ── Edit/Create Modal ──────────────────────────────────────────────────────────
function FlagModal({ initial, isEdit, onSave, onClose, saving }: {
  initial: typeof EMPTY_FLAG & { key:string };
  isEdit:boolean;
  onSave:(data: typeof EMPTY_FLAG & { key:string })=>void;
  onClose:()=>void;
  saving:boolean;
}) {
  const [form, setForm] = useState(initial);
  const inp = (k: keyof typeof EMPTY_FLAG) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));
  const inputStyle = {
    width:'100%', padding:'8px 10px', borderRadius:7, border:'1px solid var(--border)',
    background:'var(--bg-tertiary)', color:'var(--text-primary)', fontSize:12,
    outline:'none', boxSizing:'border-box' as const,
  };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ background:'var(--bg-secondary)', border:'1px solid var(--border)',
        borderRadius:14, padding:24, maxWidth:480, width:'90%', maxHeight:'90vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin:'0 0 18px', fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>
          {isEdit ? '✏️ Flag bearbeiten' : '➕ Neue Flag'}
        </h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)',
              textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:4 }}>Key *</label>
            <input value={form.key} onChange={e => setForm(p=>({...p, key:e.target.value.replace(/[^a-z0-9_]/g,'').toLowerCase()}))}
              placeholder="z.B. dark_mode_v2" style={inputStyle} disabled={isEdit} />
          </div>
          <div>
            <label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)',
              textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:4 }}>Label *</label>
            <input value={form.label} onChange={inp('label')} placeholder="Dark Mode V2" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)',
              textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:4 }}>Zielgruppe</label>
            <select value={form.target} onChange={inp('target')} style={{...inputStyle}}>
              {TARGET_OPTIONS.map(t => <option key={t} value={t}>{TARGET_LABELS[t]||t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)',
              textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:4 }}>Kategorie</label>
            <select value={form.category} onChange={inp('category')} style={{...inputStyle}}>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop:10 }}>
          <label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)',
            textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:4 }}>Beschreibung</label>
          <textarea value={form.description} onChange={inp('description')}
            placeholder="Was bewirkt diese Flag?" rows={3}
            style={{...inputStyle, resize:'vertical', fontFamily:'inherit', lineHeight:1.5}} />
        </div>
        <div style={{ display:'flex', gap:8, marginTop:16, justifyContent:'flex-end' }}>
          <button onClick={onClose}
            style={{ padding:'7px 16px', borderRadius:7, border:'1px solid var(--border)',
              background:'transparent', color:'var(--text-secondary)', cursor:'pointer', fontSize:13 }}>
            Abbrechen
          </button>
          <button onClick={() => onSave(form)} disabled={saving || !form.key || !form.label}
            style={{ padding:'7px 18px', borderRadius:7, border:'none',
              background: saving ? 'var(--bg-tertiary)' : 'var(--accent)',
              color: saving ? 'var(--text-muted)' : '#000',
              cursor: saving ? 'default':'pointer', fontSize:13, fontWeight:600,
              opacity: (!form.key || !form.label) ? 0.5 : 1 }}>
            {saving ? '⏳ Speichern…' : isEdit ? '✅ Speichern' : '➕ Erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Haupt-Seite ────────────────────────────────────────────────────────────────
export default function FlagsPage() {
  const [flags,     setFlags]     = useState<Flags>({});
  const [loading,   setLoading]   = useState(true);
  const [toggling,  setToggling]  = useState<Record<string,boolean>>({});
  const [saving,    setSaving]    = useState(false);
  const [filterCat, setFilterCat] = useState('all');
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [modal,     setModal]     = useState<{ key:string; isEdit:boolean } | null>(null);
  const [confirm,   setConfirm]   = useState<string | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/flags', { credentials:'include' });
      const json = await res.json();
      if (json.data) setFlags(json.data as Flags);
    } catch { showToast('❌ Verbindungsfehler'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Toggle
  const toggle = async (key: string, enabled: boolean) => {
    setToggling(p => ({ ...p, [key]: true }));
    setFlags(p => ({ ...p, [key]: { ...p[key], enabled } }));
    try {
      await fetch('/api/flags', {
        method:'PATCH', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ key, enabled }),
      });
      showToast(`${enabled ? '✅' : '⭕'} "${flags[key]?.label}" ${enabled ? 'aktiviert' : 'deaktiviert'}`);
    } catch { setFlags(p => ({ ...p, [key]: { ...p[key], enabled: !enabled } })); }
    finally { setToggling(p => ({ ...p, [key]: false })); }
  };

  // Bulk Toggle
  const bulkToggle = async (enable: boolean) => {
    if (!selected.size) return;
    const keys = Array.from(selected);
    setFlags(p => {
      const n = { ...p };
      keys.forEach(k => { if (n[k]) n[k] = { ...n[k], enabled: enable }; });
      return n;
    });
    await fetch('/api/flags', {
      method:'PATCH', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'bulk_toggle', keys, enabled: enable }),
    });
    showToast(`${enable ? '✅' : '⭕'} ${keys.length} Flag(s) ${enable ? 'aktiviert' : 'deaktiviert'}`);
    setSelected(new Set());
  };

  // Select
  const toggleSelect = (k: string) => {
    setSelected(p => { const s = new Set(p); s.has(k) ? s.delete(k) : s.add(k); return s; });
  };
  const selectAll = () => {
    const visible = filteredEntries.map(([k]) => k);
    setSelected(prev => prev.size === visible.length ? new Set() : new Set(visible));
  };

  // Save (create/edit)
  const handleSave = async (form: typeof EMPTY_FLAG & { key:string }) => {
    setSaving(true);
    try {
      const isEdit = modal?.isEdit ?? false;
      const res = await fetch('/api/flags', {
        method: isEdit ? 'PATCH' : 'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(isEdit
          ? { key:form.key, label:form.label, description:form.description, target:form.target, category:form.category }
          : form),
      });
      const json = await res.json();
      if (json.data?.flag) {
        setFlags(p => ({ ...p, [form.key]: json.data.flag as Flag }));
        showToast(isEdit ? '✅ Flag aktualisiert' : '✅ Flag erstellt');
        setModal(null);
      } else { showToast('❌ ' + (json.error ?? 'Fehler')); }
    } catch { showToast('❌ Verbindungsfehler'); }
    finally { setSaving(false); }
  };

  // Delete
  const handleDelete = async (key: string) => {
    try {
      await fetch('/api/flags', {
        method:'DELETE', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ key }),
      });
      setFlags(p => { const n = { ...p }; delete n[key]; return n; });
      showToast(`🗑 "${flags[key]?.label}" gelöscht`);
    } catch { showToast('❌ Fehler beim Löschen'); }
    setConfirm(null);
  };

  // Reset
  const resetDefaults = async () => {
    if (!confirm) { setConfirm('__reset__'); return; }
    await fetch('/api/flags', {
      method:'PATCH', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'bulk_toggle', keys:Object.keys(flags), enabled:false }),
    });
    await load();
    showToast('↺ Alle Flags zurückgesetzt');
    setConfirm(null);
  };

  const entries = Object.entries(flags);
  const categories = ['all', ...Array.from(new Set(entries.map(([,f]) => f.category))).sort()];
  const filteredEntries = entries.filter(([k, f]) => {
    const matchCat = filterCat === 'all' || f.category === filterCat;
    const matchSrch = !search || k.includes(search.toLowerCase()) || f.label.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSrch;
  });
  const enabledCount  = entries.filter(([,f]) => f.enabled).length;
  const disabledCount = entries.length - enabledCount;

  const modalInitial = modal
    ? (modal.isEdit && flags[modal.key]
        ? { key:modal.key, ...flags[modal.key] }
        : { ...EMPTY_FLAG, key:'' })
    : { ...EMPTY_FLAG, key:'' };

  return (
    <DashboardLayout>
      <PageHeader
        title="Funktionsschalter"
        subtitle="Plattform-Features steuern"
        actions={
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--green)',
              background:'rgba(78,205,196,0.12)', padding:'3px 10px', borderRadius:6 }}>
              ● {enabledCount} aktiv
            </span>
            <span style={{ fontSize:11, color:'var(--text-muted)',
              background:'var(--bg-tertiary)', padding:'3px 10px', borderRadius:6 }}>
              ○ {disabledCount} inaktiv
            </span>
            <button onClick={() => setModal({ key:'', isEdit:false })}
              style={{ padding:'0 12px', height:30, borderRadius:6, border:'none',
                background:'var(--accent)', color:'#000', cursor:'pointer', fontSize:12, fontWeight:700 }}>
              + Flag
            </button>
            <button onClick={() => load()}
              style={{ padding:'0 10px', height:30, borderRadius:6,
                border:'1px solid var(--border)', background:'transparent',
                color:'var(--text-muted)', cursor:'pointer', fontSize:12 }} title="Aktualisieren">
              ↺
            </button>
          </div>
        }
      />

      <div style={{ padding:'0 28px 28px' }}>

        {/* Info-Banner */}
        <div style={{ padding:'10px 14px', background:'rgba(78,205,196,0.06)',
          border:'1px solid rgba(78,205,196,0.2)', borderRadius:8, marginBottom:16,
          fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>
          <strong style={{ color:'var(--accent)' }}>ℹ️ Funktionsschalter</strong> — Schalte App-Funktionen ohne Code-Deploy ein/aus.
          Änderungen wirken sofort für die gewählte Zielgruppe. Flags ohne DB-Persistenz werden beim nächsten Deploy zurückgesetzt.
        </div>

        {/* Bulk-Actions */}
        {selected.size > 0 && (
          <div style={{ padding:'10px 14px', background:'rgba(78,205,196,0.08)',
            border:'1px solid var(--accent)', borderRadius:8, marginBottom:12,
            display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:12, color:'var(--accent)', fontWeight:600 }}>
              {selected.size} ausgewählt
            </span>
            <button onClick={() => bulkToggle(true)}
              style={{ padding:'4px 12px', borderRadius:6, border:'none',
                background:'var(--green)', color:'#000', cursor:'pointer', fontSize:12, fontWeight:600 }}>
              ✅ Alle aktivieren
            </button>
            <button onClick={() => bulkToggle(false)}
              style={{ padding:'4px 12px', borderRadius:6, border:'none',
                background:'var(--bg-tertiary)', color:'var(--text-muted)', cursor:'pointer', fontSize:12 }}>
              ⭕ Alle deaktivieren
            </button>
            <button onClick={() => setSelected(new Set())}
              style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)',
                background:'transparent', color:'var(--text-muted)', cursor:'pointer', fontSize:12, marginLeft:'auto' }}>
              ✕ Aufheben
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center', flexWrap:'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Flag suchen…"
            style={{ padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)',
              background:'var(--bg-secondary)', color:'var(--text-primary)',
              fontSize:12, outline:'none', width:200 }} />
          {/* Kategorie-Filter */}
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {categories.map(c => (
              <button key={c} onClick={() => setFilterCat(c)}
                style={{ padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600,
                  cursor:'pointer', border:'1px solid',
                  background: filterCat === c ? 'var(--accent)' : 'transparent',
                  color:      filterCat === c ? '#000' : 'var(--text-muted)',
                  borderColor: filterCat === c ? 'var(--accent)' : 'var(--border)' }}>
                {c === 'all' ? `Alle (${entries.length})` : c}
              </button>
            ))}
          </div>
          {/* Alle auswählen */}
          <button onClick={selectAll}
            style={{ marginLeft:'auto', padding:'4px 10px', borderRadius:6, fontSize:11,
              border:'1px solid var(--border)', background:'transparent',
              color:'var(--text-muted)', cursor:'pointer' }}>
            {selected.size === filteredEntries.length && filteredEntries.length > 0 ? 'Alle ab' : 'Alle wählen'}
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ padding:60, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
            ⏳ Lade Flags…
          </div>
        ) : filteredEntries.length === 0 ? (
          <div style={{ padding:60, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
            Keine Flags gefunden.
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:12 }}>
            {filteredEntries.map(([key, flag]) => (
              <FlagCard key={key} flagKey={key} flag={flag}
                toggling={!!toggling[key]}
                onToggle={toggle}
                onEdit={k => setModal({ key:k, isEdit:true })}
                onDelete={k => setConfirm(k)}
                selected={selected.has(key)}
                onSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal !== null && (
        <FlagModal
          initial={modalInitial as typeof EMPTY_FLAG & { key:string }}
          isEdit={modal.isEdit}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}
      {confirm && confirm !== '__reset__' && (
        <ConfirmModal
          message={`Flag "${flags[confirm]?.label}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
          onConfirm={() => handleDelete(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:28, right:28, zIndex:2000,
          background:'var(--bg-secondary)', border:'1px solid var(--border)',
          borderRadius:10, padding:'12px 18px', fontSize:13, color:'var(--text-primary)',
          boxShadow:'0 4px 20px rgba(0,0,0,0.4)', animation:'fadeIn 0.2s ease' }}>
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
