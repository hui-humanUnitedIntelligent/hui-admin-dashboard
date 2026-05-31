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

// ── Info-Texte pro Flag-Key ────────────────────────────────────
const FLAG_INFO: Record<string, { on: string; off: string; hint?: string }> = {
  new_payment_page: {
    on:   'Nutzer sehen das überarbeitete Checkout-UI mit neuer Zahlungslogik.',
    off:  'Das alte Checkout bleibt aktiv — keine Änderung für Nutzer.',
    hint: '💡 Nur für Zielgruppe "Alle" — betrifft alle Käufe auf der Plattform.',
  },
  wirker_marketplace: {
    on:   'Wirker sehen den neuen Marktplatz-Bereich in der App.',
    off:  'Der Marktplatz ist versteckt — Wirker sehen ihn nicht.',
    hint: '💡 Nur sichtbar für Nutzer mit Wirker-Status.',
  },
  impact_voting_v2: {
    on:   'Members können mit dem neuen gewichteten Abstimmungssystem für Impact-Projekte abstimmen.',
    off:  'Das alte Abstimmungssystem oder keine Abstimmung ist aktiv.',
    hint: '💡 Nur für Members — beeinflusst wie Impact-Punkte vergeben werden.',
  },
  stories_feature: {
    on:   'Alle User sehen den Stories-Bereich in der App — Beiträge können als Story gepostet werden.',
    off:  'Stories sind komplett ausgeblendet. Kein Nutzer kann sie sehen oder erstellen.',
  },
  maintenance_mode: {
    on:   '⚠️ ALLE Nutzer landen sofort auf der Wartungsseite — niemand kann die App normal nutzen!',
    off:  'Die App läuft normal. Kein Nutzer ist betroffen.',
    hint: '⚠️ Vorsicht: Dieser Schalter sperrt sofort die gesamte Plattform für alle User.',
  },
  new_onboarding: {
    on:   'Neue Nutzer beim Registrieren sehen den überarbeiteten Onboarding-Flow mit verbesserter UX.',
    off:  'Der alte Registrierungsflow bleibt aktiv.',
    hint: '💡 Betrifft nur neue Registrierungen — bestehende User sind nicht betroffen.',
  },
  realtime_chat: {
    on:   'Der WebSocket-basierte Echtzeit-Chat ist aktiv. Nutzer können live chatten.',
    off:  'Das Chat-Feature ist deaktiviert. Nachrichten können nicht gesendet werden.',
    hint: '💡 Stabile WebSocket-Verbindung zum Server erforderlich.',
  },
  ai_recommendations: {
    on:   'ML-basierte Wirker-Vorschläge werden für alle Nutzer angezeigt — personalisierter Feed.',
    off:  'Keine KI-Empfehlungen. Der Feed zeigt Standard-Sortierung.',
    hint: '💡 Benötigt ausreichend Nutzerdaten für sinnvolle Empfehlungen.',
  },
};

function getFlagInfo(key: string) {
  return FLAG_INFO[key] || null;
}

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

// ── Info Dropdown Component ───────────────────────────────────
function InfoDropdown({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const info = getFlagInfo(flagKey);
  if (!info) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}
        title="Was macht dieses Flag?"
        style={{
          width: 20, height: 20,
          borderRadius: '50%',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          background: open ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
          color: open ? 'var(--accent)' : 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
          flexShrink: 0,
          lineHeight: 1,
          fontFamily: 'var(--font-body)',
        }}
        onMouseEnter={e => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
            (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          }
        }}
      >
        ℹ
      </button>

      {open && (
        <>
          {/* Backdrop to close */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          />
          <div style={{
            position: 'absolute',
            top: 26, left: '50%',
            transform: 'translateX(-50%)',
            width: 260,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            zIndex: 100,
            padding: 14,
            animation: 'fadeIn 0.15s ease-out',
          }}>
            {/* Arrow */}
            <div style={{
              position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
              width: 10, height: 10,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderBottom: 'none', borderRight: 'none',
              rotate: '45deg',
            }} />

            {/* AN Status */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'rgba(81,207,102,0.15)', color: 'var(--green)', border: '1px solid rgba(81,207,102,0.3)' }}>● AN</span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.55 }}>{info.on}</p>
            </div>

            {/* AUS Status */}
            <div style={{ marginBottom: info.hint ? 10 : 0, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>○ AUS</span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{info.off}</p>
            </div>

            {/* Hint */}
            {info.hint && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5, borderLeft: '2px solid var(--accent)' }}>
                {info.hint}
              </div>
            )}

            {/* Current state indicator */}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Aktuell:</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: enabled ? 'var(--green)' : 'var(--text-muted)' }}>
                {enabled ? '● Aktiv' : '○ Inaktiv'}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function FlagsPage() {
  const [flags, setFlags]           = useState<Flags>({});
  const [loading, setLoading]       = useState(true);
  const [toggling, setToggling]     = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [filterCat, setFilterCat]   = useState('all');
  const [newFlag, setNewFlag]       = useState({ key: '', label: '', description: '', target: 'all', category: 'Custom' });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/flags').then(r => r.json()).catch(() => ({}));
    setFlags(res || {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (key: string, val: boolean) => {
    setToggling(p => ({ ...p, [key]: true }));
    setFlags(p => ({ ...p, [key]: { ...p[key], enabled: val } }));
    const res = await fetch('/api/flags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', flagKey: key, value: val }),
    });
    if (!res.ok) {
      setFlags(p => ({ ...p, [key]: { ...p[key], enabled: !val } }));
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
      aria-checked={on} role="switch"
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
        <strong style={{ color: 'var(--accent)' }}>ℹ️ Feature-Flags</strong> — Schalte App-Funktionen ohne Code-Deploy ein/aus. Klicke auf das <strong>ℹ</strong> Icon auf jeder Karte für Details.
      </div>

      {/* Create Flag Form */}
      {showCreate && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
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
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
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
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{flag.label}</span>
                    <CategoryBadge cat={flag.category} />
                    {/* ℹ Info button */}
                    <InfoDropdown flagKey={key} enabled={flag.enabled} />
                  </div>
                  {flag.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{flag.description}</div>
                  )}
                </div>
                <Switch on={flag.enabled} disabled={toggling[key]} onChange={v => toggle(key, v)} />
              </div>

              {/* Footer row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>{key}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    {TARGET_LABELS[flag.target] || flag.target}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
