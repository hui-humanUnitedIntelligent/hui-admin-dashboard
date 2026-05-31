// frontend/src/components/providers/ThemeProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

export type Theme = 'dark' | 'light';
export type Lang  = 'de' | 'en';

interface SettingsContextValue {
  theme:     Theme;
  lang:      Lang;
  setTheme:  (t: Theme) => void;
  setLang:   (l: Lang)  => void;
  t:         (key: string) => string;
}

const SettingsContext = createContext<SettingsContextValue>({
  theme: 'dark', lang: 'de',
  setTheme: () => {}, setLang: () => {},
  t: (k) => k,
});

// ── Translations ──────────────────────────────────────────────────────────
const translations: Record<Lang, Record<string, string>> = {
  de: {
    // Nav
    'nav.dashboard':     'Dashboard',
    'nav.users':         'User-Management',
    'nav.transactions':  'Transaktionen',
    'nav.impact':        'Impact-Pool',
    'nav.talents':       'Talents',
    'nav.bookings':      'Buchungen',
    'nav.works':         'Works',
    'nav.memberships':   'Memberships',
    'nav.audit':         'Audit-Logs',
    'nav.system':        'Systemstatus',
    'nav.settings':      'Einstellungen',
    // Common
    'common.save':       'Speichern',
    'common.reset':      'Zurücksetzen',
    'common.close':      'Schließen',
    'common.loading':    'Laden…',
    'common.search':     'Suchen…',
    'common.actions':    'Aktionen',
    'common.status':     'Status',
    'common.active':     'Aktiv',
    'common.blocked':    'Blockiert',
    'common.deleted':    'Gelöscht',
    'common.all':        'Alle',
    'common.back':       '← Zurück',
    'common.next':       'Weiter →',
    'common.live':       'Live',
    'common.edit':       'Bearbeiten',
    'common.delete':     'Löschen',
    'common.cancel':     'Abbrechen',
    'common.confirm':    'Bestätigen',
    // Settings
    'settings.title':        'Einstellungen',
    'settings.theme':        'Theme',
    'settings.theme.desc':   'Erscheinungsbild des Dashboards',
    'settings.theme.dark':   'Dunkel',
    'settings.theme.light':  'Hell',
    'settings.lang':         'Sprache',
    'settings.lang.desc':    'Dashboard-Sprache',
    'settings.saved':        '✅ Einstellungen gespeichert',
    'settings.resetDone':    'Zurückgesetzt',
    'settings.refresh':      'Auto-Refresh (Sekunden)',
    'settings.pagesize':     'Einträge pro Seite',
  },
  en: {
    // Nav
    'nav.dashboard':     'Dashboard',
    'nav.users':         'User Management',
    'nav.transactions':  'Transactions',
    'nav.impact':        'Impact Pool',
    'nav.talents':       'Talents',
    'nav.bookings':      'Bookings',
    'nav.works':         'Works',
    'nav.memberships':   'Memberships',
    'nav.audit':         'Audit Logs',
    'nav.system':        'System Status',
    'nav.settings':      'Settings',
    // Common
    'common.save':       'Save',
    'common.reset':      'Reset',
    'common.close':      'Close',
    'common.loading':    'Loading…',
    'common.search':     'Search…',
    'common.actions':    'Actions',
    'common.status':     'Status',
    'common.active':     'Active',
    'common.blocked':    'Blocked',
    'common.deleted':    'Deleted',
    'common.all':        'All',
    'common.back':       '← Back',
    'common.next':       'Next →',
    'common.live':       'Live',
    'common.edit':       'Edit',
    'common.delete':     'Delete',
    'common.cancel':     'Cancel',
    'common.confirm':    'Confirm',
    // Settings
    'settings.title':        'Settings',
    'settings.theme':        'Theme',
    'settings.theme.desc':   'Dashboard appearance',
    'settings.theme.dark':   'Dark',
    'settings.theme.light':  'Light',
    'settings.lang':         'Language',
    'settings.lang.desc':    'Dashboard language',
    'settings.saved':        '✅ Settings saved',
    'settings.resetDone':    'Reset to defaults',
    'settings.refresh':      'Auto-refresh (seconds)',
    'settings.pagesize':     'Entries per page',
  },
};

const STORAGE_THEME = 'hui_admin_theme';
const STORAGE_LANG  = 'hui_admin_lang';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [lang,  setLangState]  = useState<Lang>('de');
  const [mounted, setMounted]  = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem(STORAGE_THEME) as Theme) || 'dark';
    const savedLang  = (localStorage.getItem(STORAGE_LANG)  as Lang)  || 'de';
    setThemeState(savedTheme);
    setLangState(savedLang);
    document.documentElement.setAttribute('data-theme', savedTheme);
    setMounted(true);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_THEME, t);
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_LANG, l);
  }, []);

  const t = useCallback((key: string): string => {
    return translations[lang][key] ?? translations['de'][key] ?? key;
  }, [lang]);

  // Prevent flash of wrong theme
  if (!mounted) return null;

  return (
    <SettingsContext.Provider value={{ theme, lang, setTheme, setLang, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
