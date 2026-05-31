// frontend/src/app/flags/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { showToast } from '@/components/ui/Toast';

interface Flag {
  label: string;
  description: string;
  enabled: boolean;
  target: string;
  category: string;
}
type Flags = Record<string, Flag>;

const TARGET_OPTIONS = ['all', 'wirker', 'members', 'admins', 'basisuser'];
const CATEGORY_OPTIONS = ['Features', 'Zahlung', 'Impact', 'Content', 'System', 'UX', 'KI', 'Custom'];

const TARGET_LABELS: Record<string, string> = {
  all: '🌍 Alle', wirker: '⭐ Wirker', members: '🏅 Members', admins: '🛡️ Admins', basisuser: '◎ Basisuser',
};

function CategoryBadge({ cat }: { cat: string }) {
  const colors: Record<string, string> = {
    Features: 'var(--accent)', Zahlung: 'var(--green)', Impact: 'var(--purple)',
    Content: 'var(--gold)', System: 'var(--red)', UX: 'var(--blue)', KI: '#FF6EFF', Custom: 'var(--text-muted)',
  };
  const c = colors[cat] || 'var(--text-muted)';
  return (
    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: `${c}22`, color: c, fontWeight: 700, border: `1px solid ${c}44` }}>{cat}</span>
  );
}

export default function FlagsPage() {
  const [flags, setFlags]         = useState<Flags>({});
  const [loading, setLoading]     = useState(true);
  const [toggling, setToggling]   = useState<Record<string, boolean>>({});
  const [editing, setEditing]     = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterCat, setFilterCat]  = useState('all');
  const [newFlag, setNewFlag]      = useState({ key: '', label: '', description: '', target: 'all', category: 'Custom' });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/flags').then(r => r.json()).catch(() => ({}));
    setFlags(res || {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (key: string, val: boolean) => {
    setToggling(p => ({ ...p, [key]: true }));
    // Optimistic update
    setFlags(p => ({ ...p, [key]: { ...p[key], enabled: val } }));
    const res = await fetch('/api/flags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', flagKey: key, value: val }),
    });
    if (!res.ok) {
      setFlags(p => ({ ...p, [key]: { ...p[key], enabled: !val } })); // revert
      showToast('Fehler beim Speichern', 'error');
    } else {
      showToast(val ? `✅ "${flags[key]?.label}" aktiviert` : `🔴 "${flags[key]?.label}" deaktiviert`, 'info');
    }
    setToggling(p => ({ ...p, [key]: false }));
  };

  const deleteFlag = async (key: string) => {
    if (!confirm(`Flag "${flags[key]?.label}" wirklich löschen?`)) return;
    const res = await fetch('/api/flags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', flagKey: key }),
    });
    if (res.ok) { showToast('Flag gelöscht', 'info'); load(); }
    else showToast('Fehler', 'error');
  };

  const createFlag = async () => {
    if (!newFlag.key || !newFlag.label) { showToast('Key und Label erforderlich', 'error'); return; }
    const res = await fetch('/api/flags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', newFlag }),
    });
    if (res.ok) {
      showToast('Flag erstellt', 'success');
      setNewFlag({ key: '', label: '', description: '', target: 'all', category: 'Custom' });
      setShowCreate(false);
      load();
    } else showToast('Fehler', 'error');
  };

  const resetDefaults = async () => {
    if (!confirm('Alle Flags auf Standard zurücksetzen?')) return;
    const res = await fetch('/api/flags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    });
    if (res.ok) { showToast('Zurückgesetzt', 'info'); load(); }
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '8px 11px', background: 'var(--bg-primary)',
    border: '1px solid var(--border)', borderRadius: 8, fontSize: 12,
    color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
  };

  const entries = Object.entries(flags);
  const categories = ['all', ...Array.from(new Set(entries.map(([, f]) => f.category)))];
  const filtered = filterCat === 'all' ? entries : entries.filter(([, f]) => f.category === filterCat);

  const enabledCount  = entries.filter(([, f]) => f.enabled).length;
  const disabledCount = entries.length - enabledCount;

  // Toggle switch component
  const Switch = ({ on, disabled: dis, onChange }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => !dis && onChange(!on)}
      disabled={dis}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: dis ? 'default' : 'pointer',
        background: on ? 'var(--green)' : 'var(--bg-tertiary)',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)',
      }}
      aria-checked={on}
      role="switch"
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: on ? 23 : 3,
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </button>
  );

  return (
    <DashboardLayout
      title="Feature-Flags"
      headerActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--green)', background: 'var(--green-dim)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--green)', fontWeight: 600 }}>
            ✅ {enabledCount} aktiv
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>
            🔴 {disabledCount} inaktiv
          </span>
          <button onClick={() => setShowCreate(p => !p)} style={{ padding: '5px 12px', background: 'var(--accent)', border: 'none', borderRadius: 8, fontSize: 11, color: '#0F1117', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-body)' }}>+ Flag</button>
          <button onClick={resetDefaults} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↺ Reset</button>
          <button onClick={load} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻</button>
        </div>
      }
    >
      {/* Info Banner */}
      <div style={{ padding: '10px 16px', background: 'rgba(78,205,196,0.06)', border: '1px solid rgba(78,205,196,0.2)', borderRadius: 10, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--accent)' }}>ℹ️ Feature-Flags</strong> — Schalte App-Funktionen ohne Code-Deploy ein/aus. Änderungen werden sofort in der Datenbank gespeichert und von der HUI-App per API gelesen.
      </div>

      {/* Create Flag Form */}
      {showCreate && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)', borderRadius: 12, padding: 20, marginBottom: 16, animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>➕ Neues Feature-Flag</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>Key (snake_case)</label>
              <input value={newFlag.key} onChange={e => setNewFlag(p => ({ ...p, key: e.target.value.replace(/\s/g, '_').toLowerCase() }))} placeholder="z.B. new_feature_xyz" style={input} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>Label</label>
              <input value={newFlag.label} onChange={e => setNewFlag(p => ({ ...p, label: e.target.value }))} placeholder="z.B. Neue Feature XYZ" style={input} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>Zielgruppe</label>
              <select value={newFlag.target} onChange={e => setNewFlag(p => ({ ...p, target: e.target.value }))} style={input}>
                {TARGET_OPTIONS.map(t => <option key={t} value={t}>{TARGET_LABELS[t] || t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>Kategorie</label>
              <select value={newFlag.category} onChange={e => setNewFlag(p => ({ ...p, category: e.target.value }))} style={input}>
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>Beschreibung</label>
            <input value={newFlag.description} onChange={e => setNewFlag(p => ({ ...p, description: e.target.value }))} placeholder="Was macht dieses Flag?" style={input} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowCreate(false)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)' }}>Abbrechen</button>
            <button onClick={createFlag} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0F1117', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)' }}>Flag erstellen</button>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }} className="tab-bar">
        {categories.map(c => (
          <button key={c} onClick={() => setFilterCat(c)} style={{
            padding: '5px 12px', borderRadius: 8, border: '1px solid',
            borderColor: filterCat === c ? 'var(--accent)' : 'var(--border)',
            background: filterCat === c ? 'var(--accent-dim)' : 'transparent',
            color: filterCat === c ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap',
          }}>{c === 'all' ? `Alle (${entries.length})` : c}</button>
        ))}
      </div>

      {/* Flags Grid */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Lade Flags…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {filtered.map(([key, flag]) => (
            <div
              key={key}
              style={{
                background: 'var(--bg-secondary)',
                border: `1px solid ${flag.enabled ? 'rgba(81,207,102,0.25)' : 'var(--border)'}`,
                borderLeft: `3px solid ${flag.enabled ? 'var(--green)' : 'var(--border-strong)'}`,
                borderRadius: 12, padding: 16,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{flag.label}</span>
                    <CategoryBadge cat={flag.category} />
                  </div>
                  {flag.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{flag.description}</div>
                  )}
                </div>
                <Switch on={flag.enabled} disabled={toggling[key]} onChange={v => toggle(key, v)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>{key}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    {TARGET_LABELS[flag.target] || flag.target}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: flag.enabled ? 'var(--green)' : 'var(--text-muted)' }}>
                    {flag.enabled ? '● AN' : '○ AUS'}
                  </span>
                  <button
                    onClick={() => deleteFlag(key)}
                    title="Flag löschen"
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
                    onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--red)')}
                    onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
                  >🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
