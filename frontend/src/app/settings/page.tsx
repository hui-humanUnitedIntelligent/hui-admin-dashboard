'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/hooks/useAuth';

const PERMS_DEFAULT = [
  { name: 'User sperren/entsperren',    on: true  },
  { name: 'Transaktionen einsehen',     on: true  },
  { name: 'Impact Pool verwalten',      on: true  },
  { name: 'Admin-Einstellungen',        on: false },
  { name: 'Daten exportieren',          on: true  },
];

export default function SettingsPage() {
  const { logout } = useAuth();
  const [perms, setPerms] = useState(PERMS_DEFAULT);
  const [name, setName]   = useState('Michael Admin');
  const [email, setEmail] = useState('admin@hui-platform.io');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const handleSaveProfile = () => {
    showToast('Profil gespeichert ✓');
  };

  const handleSavePassword = () => {
    if (!currentPw || !newPw || !confirmPw) {
      showToast('Bitte alle Felder ausfüllen', 'error');
      return;
    }
    if (newPw !== confirmPw) {
      showToast('Passwörter stimmen nicht überein', 'error');
      return;
    }
    if (newPw.length < 8) {
      showToast('Passwort muss mindestens 8 Zeichen haben', 'error');
      return;
    }
    showToast('Passwort geändert ✓');
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
  };

  const togglePerm = (i: number) => {
    setPerms((prev) => prev.map((p, idx) => idx === i ? { ...p, on: !p.on } : p));
    showToast(`"${perms[i].name}" ${perms[i].on ? 'deaktiviert' : 'aktiviert'}`);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--text-primary)',
    fontFamily: 'DM Sans, sans-serif',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottom: '1px solid var(--border)',
  };

  const formLabel: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 5,
  };

  return (
    <DashboardLayout title="Einstellungen">
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        {/* Linke Spalte */}
        <div>
          {/* Profil */}
          <div style={cardStyle}>
            <div style={sectionLabel}>Admin-Profil</div>
            <div style={{ marginBottom: 14 }}>
              <label style={formLabel}>Vollständiger Name</label>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={formLabel}>E-Mail</label>
              <input
                style={inputStyle}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={formLabel}>Rolle</label>
              <input
                style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }}
                value="Super Admin"
                readOnly
              />
            </div>
            <Button variant="primary" onClick={handleSaveProfile}>Profil speichern</Button>
          </div>

          {/* Passwort */}
          <div style={cardStyle}>
            <div style={sectionLabel}>Passwort ändern</div>
            <div style={{ marginBottom: 12 }}>
              <label style={formLabel}>Aktuelles Passwort</label>
              <input style={inputStyle} type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="••••••••"
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={formLabel}>Neues Passwort</label>
              <input style={inputStyle} type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min. 8 Zeichen"
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={formLabel}>Bestätigen</label>
              <input style={inputStyle} type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••••"
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <Button variant="ghost" onClick={handleSavePassword}>Passwort ändern</Button>
          </div>
        </div>

        {/* Rechte Spalte */}
        <div>
          {/* Berechtigungen */}
          <div style={cardStyle}>
            <div style={sectionLabel}>Berechtigungen</div>
            {perms.map((perm, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < perms.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{perm.name}</span>
                <div
                  onClick={() => togglePerm(i)}
                  style={{
                    width: 34,
                    height: 18,
                    borderRadius: 9,
                    cursor: 'pointer',
                    position: 'relative',
                    background: perm.on ? 'var(--accent)' : 'var(--bg-card)',
                    border: perm.on ? 'none' : '1px solid var(--border-hover)',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: perm.on ? 18 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* System */}
          <div style={cardStyle}>
            <div style={sectionLabel}>System</div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
              API-Endpunkte sind konfiguriert (Dummy-Modus). Live-Verbindungen werden separat aktiviert, wenn Backend und Datenbank verbunden sind.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button variant="ghost" fullWidth icon="⚡" onClick={() => showToast('API-Status: Dummy-Modus · alle Endpunkte konfiguriert')}>
                API-Status prüfen
              </Button>
              <Button variant="ghost" fullWidth icon="⬇" onClick={() => showToast('System-Log wird exportiert…')}>
                System-Log exportieren
              </Button>
              <Button variant="danger" fullWidth icon="⏏" onClick={logout}>
                Abmelden
              </Button>
            </div>
          </div>

          {/* Version Info */}
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={sectionLabel}>System-Info</div>
            {[
              ['Version',     'v1.0.0 (Dummy-Modus)'],
              ['Umgebung',    'Development'],
              ['Backend',     'Nicht verbunden'],
              ['Datenbank',   'PostgreSQL (konfiguriert)'],
              ['JWT-Gültigkeit', '8 Stunden'],
            ].map(([key, val]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
                <span style={{ color: 'var(--text-muted)' }}>{key}</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'Space Mono, monospace', fontSize: 10 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
