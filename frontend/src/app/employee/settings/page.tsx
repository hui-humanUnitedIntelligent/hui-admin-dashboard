// frontend/src/app/employee/settings/page.tsx
'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import { showToast } from '@/components/ui/Toast';
import { useSettings, Theme, Lang } from '@/components/providers/ThemeProvider';

const STORAGE_KEY_REFRESH  = 'hui_admin_refresh';
const STORAGE_KEY_PAGESIZE = 'hui_admin_pagesize';

export default function EmployeeSettingsPage() {
  const { theme, lang, setTheme, setLang, t } = useSettings();

  const [refreshRate, setRefreshRate] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_REFRESH)  || '30' : '30')
  );
  const [pageSize, setPageSize] = useState(
    () => (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_PAGESIZE) || '50' : '50')
  );

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_REFRESH,  refreshRate);
      localStorage.setItem(STORAGE_KEY_PAGESIZE, pageSize);
    }
    showToast(t('settings.saved'), 'success');
  };

  const handleReset = () => {
    setTheme('dark');
    setLang('de');
    setRefreshRate('30');
    setPageSize('50');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_REFRESH);
      localStorage.removeItem(STORAGE_KEY_PAGESIZE);
    }
    showToast(t('settings.resetDone'), 'info');
  };

  // ── Styles ───────────────────────────────────────────────────────────────
  const section: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  };
  const row: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px', borderBottom: '1px solid var(--border)',
  };
  const rowLast: React.CSSProperties = { ...row, borderBottom: 'none' };
  const label: React.CSSProperties = {
    fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
  };
  const desc: React.CSSProperties = {
    fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
  };
  const selectStyle: React.CSSProperties = {
    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    background: 'var(--bg-tertiary)', border: '1px solid var(--border-strong)',
    color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
    outline: 'none', cursor: 'pointer', minWidth: 130,
  };

  // Theme toggle cards
  const themeCard = (value: Theme, icon: string, labelText: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
    border: `2px solid ${theme === value ? 'var(--accent)' : 'var(--border)'}`,
    background: theme === value ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
    color: theme === value ? 'var(--accent)' : 'var(--text-secondary)',
    fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)',
    transition: 'all 0.2s', userSelect: 'none',
  });

  const langCard = (value: Lang): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
    border: `2px solid ${lang === value ? 'var(--accent)' : 'var(--border)'}`,
    background: lang === value ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
    color: lang === value ? 'var(--accent)' : 'var(--text-secondary)',
    fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-body)',
    transition: 'all 0.2s', userSelect: 'none',
  });

  return (
    <DashboardLayout employeeMode={true} title={t('settings.title')}>
      <div style={{ maxWidth: 680 }}>

        {/* ── Appearance ── */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, fontWeight: 600 }}>
          {lang === 'de' ? 'Erscheinungsbild' : 'Appearance'}
        </div>
        <div style={section}>
          {/* Theme */}
          <div style={row}>
            <div>
              <div style={label}>{t('settings.theme')}</div>
              <div style={desc}>{t('settings.theme.desc')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={themeCard('dark',  '🌙', t('settings.theme.dark'))}  onClick={() => setTheme('dark')}>
                🌙 {t('settings.theme.dark')}
              </button>
              <button style={themeCard('light', '☀️', t('settings.theme.light'))} onClick={() => setTheme('light')}>
                ☀️ {t('settings.theme.light')}
              </button>
            </div>
          </div>

          {/* Language */}
          <div style={rowLast}>
            <div>
              <div style={label}>{t('settings.lang')}</div>
              <div style={desc}>{t('settings.lang.desc')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={langCard('de')} onClick={() => setLang('de')}>
                🇩🇪 Deutsch
              </button>
              <button style={langCard('en')} onClick={() => setLang('en')}>
                🇬🇧 English
              </button>
            </div>
          </div>
        </div>

        {/* ── Data ── */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, marginTop: 24, fontWeight: 600 }}>
          {lang === 'de' ? 'Daten & Performance' : 'Data & Performance'}
        </div>
        <div style={section}>
          {/* Refresh Rate */}
          <div style={row}>
            <div>
              <div style={label}>{t('settings.refresh')}</div>
              <div style={desc}>{lang === 'de' ? 'Wie oft werden Live-Daten aktualisiert' : 'How often live data is refreshed'}</div>
            </div>
            <select
              style={{ ...selectStyle, minWidth: 100 }}
              value={refreshRate}
              onChange={(e) => setRefreshRate(e.target.value)}
            >
              {['10','15','30','60','120'].map((v) => (
                <option key={v} value={v}>{v}s</option>
              ))}
            </select>
          </div>

          {/* Page Size */}
          <div style={rowLast}>
            <div>
              <div style={label}>{t('settings.pagesize')}</div>
              <div style={desc}>{lang === 'de' ? 'Anzahl der Einträge in Tabellen' : 'Number of entries shown in tables'}</div>
            </div>
            <select
              style={{ ...selectStyle, minWidth: 100 }}
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value)}
            >
              {['25','50','100','200'].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Connection Info ── */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, marginTop: 24, fontWeight: 600 }}>
          {lang === 'de' ? 'Verbindung' : 'Connection'}
        </div>
        <div style={section}>
          <div style={row}>
            <div>
              <div style={label}>Supabase</div>
              <div style={{ ...desc, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                {process.env.NEXT_PUBLIC_SUPABASE_URL || 'gxztrhvhcxhmunhhkfjd.supabase.co'}
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--green)', background: 'var(--green-dim)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--green-dim)' }}>
              ● {lang === 'de' ? 'Verbunden' : 'Connected'}
            </span>
          </div>
          <div style={rowLast}>
            <div>
              <div style={label}>Service Role</div>
              <div style={desc}>{lang === 'de' ? 'Server-seitige Admin-Schreibrechte' : 'Server-side admin write access'}</div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--green)', background: 'var(--green-dim)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--green-dim)' }}>
              ● {lang === 'de' ? 'Aktiv' : 'Active'}
            </span>
          </div>
        </div>

        {/* ── Preview ── */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10, marginTop: 24, fontWeight: 600 }}>
          {lang === 'de' ? 'Vorschau' : 'Preview'}
        </div>
        <div style={{
          ...section,
          padding: 20,
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        }}>
          {(() => {
            const isDE = lang === 'de';
            const isDark = theme === 'dark';
            return (
              <>
                <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: 12 }}>Accent</div>
                <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12 }}>{isDE ? 'Hintergrund' : 'Background'}</div>
                <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--green-dim)', border: '1px solid var(--green)', color: 'var(--green)', fontSize: 12 }}>{isDE ? 'Aktiv' : 'Active'}</div>
                <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 12 }}>{isDE ? 'Fehler' : 'Error'}</div>
                <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--gold-dim)', border: '1px solid var(--gold)', color: 'var(--gold)', fontSize: 12 }}>{isDE ? 'Warnung' : 'Warning'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  Theme: {isDark ? (isDE ? '🌙 Dunkel' : '🌙 Dark') : (isDE ? '☀️ Hell' : '☀️ Light')} · {isDE ? 'Sprache' : 'Language'}: {isDE ? '🇩🇪 Deutsch' : '🇬🇧 English'}
                </div>
              </>
            );
          })()}
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Button variant="primary" onClick={handleSave}>
            💾 {t('common.save')}
          </Button>
          <Button variant="ghost" onClick={handleReset}>
            {t('common.reset')}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
