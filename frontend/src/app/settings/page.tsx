// frontend/src/app/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import { SUPABASE_URL } from '@/lib/api';
import { showToast } from '@/components/ui/Toast';

const STORAGE_KEY_REFRESH  = 'hui_admin_refresh';
const STORAGE_KEY_PAGESIZE = 'hui_admin_pagesize';
const STORAGE_KEY_THEME    = 'hui_admin_theme';
const STORAGE_KEY_LANG     = 'hui_admin_lang';

export default function SettingsPage() {
  const [saved, setSaved]           = useState(false);
  const [refreshRate, setRefreshRate] = useState('30');
  const [pageSize, setPageSize]       = useState('50');
  const [theme, setTheme]             = useState('dark');
  const [lang, setLang]               = useState('de');
  const [loaded, setLoaded]           = useState(false);

  // ── Load saved values on mount ──────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const r  = localStorage.getItem(STORAGE_KEY_REFRESH);
      const ps = localStorage.getItem(STORAGE_KEY_PAGESIZE);
      const th = localStorage.getItem(STORAGE_KEY_THEME);
      const lg = localStorage.getItem(STORAGE_KEY_LANG);
      if (r)  setRefreshRate(r);
      if (ps) setPageSize(ps);
      if (th) setTheme(th);
      if (lg) setLang(lg);
    }
    setLoaded(true);
  }, []);

  // ── Save all settings ────────────────────────────────────────
  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_REFRESH,  refreshRate);
      localStorage.setItem(STORAGE_KEY_PAGESIZE, pageSize);
      localStorage.setItem(STORAGE_KEY_THEME,    theme);
      localStorage.setItem(STORAGE_KEY_LANG,     lang);
    }
    setSaved(true);
    showToast('✅ Einstellungen gespeichert', 'success');
    setTimeout(() => setSaved(false), 3000);
  };

  // ── Reset to defaults ────────────────────────────────────────
  const handleReset = () => {
    setRefreshRate('30');
    setPageSize('50');
    setTheme('dark');
    setLang('de');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_REFRESH);
      localStorage.removeItem(STORAGE_KEY_PAGESIZE);
      localStorage.removeItem(STORAGE_KEY_THEME);
      localStorage.removeItem(STORAGE_KEY_LANG);
    }
    showToast('Einstellungen zurückgesetzt', 'info');
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const sectionStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    padding: '14px 18px',
    borderBottom: '1px solid var(--border)',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 18px',
    borderBottom: '1px solid var(--border)',
    gap: 20,
  };

  if (!loaded) return null;

  return (
    <DashboardLayout title="Einstellungen">

      {/* ── Connection Config ─────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>🔌 Verbindungs-Konfiguration</div>
        <div style={{ padding: 18 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>
              Supabase URL
            </label>
            <input
              readOnly
              value={SUPABASE_URL || '(nicht gesetzt — ENV-Variable fehlt)'}
              style={{ ...inputStyle, color: SUPABASE_URL ? 'var(--green)' : 'var(--red)', cursor: 'default' }}
            />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Gesetzt via: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>NEXT_PUBLIC_SUPABASE_URL</code>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>
              Supabase Anon Key
            </label>
            <input
              readOnly
              value={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '••••••••••••••••••••••••••' : '(nicht gesetzt)'}
              style={{ ...inputStyle, color: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'var(--green)' : 'var(--red)', cursor: 'default' }}
            />
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Gesetzt via: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            </div>
          </div>
          <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            ℹ️ Umgebungsvariablen werden in <strong>Vercel → Settings → Environment Variables</strong> gesetzt.
          </div>
        </div>
      </div>

      {/* ── Dashboard Preferences ─────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>⚙️ Dashboard-Einstellungen</div>

        <div style={rowStyle}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Auto-Refresh Intervall</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Wie oft werden Live-Daten aktualisiert?</div>
          </div>
          <select value={refreshRate} onChange={(e) => setRefreshRate(e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="10">10 Sek.</option>
            <option value="30">30 Sek.</option>
            <option value="60">1 Min.</option>
            <option value="300">5 Min.</option>
          </select>
        </div>

        <div style={rowStyle}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Einträge pro Seite</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Standard für Tabellen</div>
          </div>
          <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>

        <div style={rowStyle}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Theme</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Erscheinungsbild des Dashboards</div>
          </div>
          <select value={theme} onChange={(e) => setTheme(e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="dark">Dark (Standard)</option>
            <option value="light">Light</option>
          </select>
        </div>

        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Sprache</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dashboard-Sprache</div>
          </div>
          <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Saved indicator */}
        {saved && (
          <div style={{ margin: '0 18px 0', padding: '10px 14px', background: 'rgba(81,207,102,0.1)', border: '1px solid rgba(81,207,102,0.3)', borderRadius: 8, fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 8 }}>
            ✅ Einstellungen wurden gespeichert und werden beim nächsten Öffnen automatisch geladen.
          </div>
        )}

        <div style={{ padding: 18, display: 'flex', gap: 10 }}>
          <Button variant="primary" onClick={handleSave}>
            {saved ? '✓ Gespeichert!' : '💾 Speichern'}
          </Button>
          <Button variant="ghost" onClick={handleReset}>
            Zurücksetzen
          </Button>
        </div>
      </div>

      {/* ── Gespeicherte Werte (Live-Vorschau) ───────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>📋 Aktuell gespeicherte Werte</div>
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 10 }}>
          {[
            ['Auto-Refresh',     `${refreshRate} Sek.`],
            ['Einträge/Seite',   pageSize],
            ['Theme',            theme === 'dark' ? 'Dark' : 'Light'],
            ['Sprache',          lang === 'de' ? 'Deutsch' : 'English'],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 18px 14px', fontSize: 11, color: 'var(--text-muted)' }}>
          💡 Werte werden im Browser (localStorage) gespeichert und beim nächsten Öffnen automatisch geladen.
        </div>
      </div>

      {/* ── Info ─────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>ℹ️ Dashboard-Info</div>
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 10 }}>
          {[
            ['Version',   'v2.0.0-live'],
            ['Mode',      SUPABASE_URL ? 'Live — Supabase' : 'Demo'],
            ['Framework', 'Next.js 14'],
            ['Charts',    'Chart.js'],
            ['Build',     new Date().toLocaleDateString('de-DE')],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

    </DashboardLayout>
  );
}
