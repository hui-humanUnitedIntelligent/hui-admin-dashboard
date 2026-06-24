// frontend/src/components/providers/ThemeProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { translations } from '@/i18n/translations';
import { Lang, DEFAULT_LANG, STORAGE_LANG_KEY, SUPPORTED_LANGS } from '@/i18n/config';

export type { Lang };
export type Theme = 'dark' | 'light';

interface SettingsContextValue {
  theme:    Theme;
  lang:     Lang;
  setTheme: (t: Theme) => void;
  setLang:  (l: Lang)  => void;
  t:        (key: string) => string;
}

const SettingsContext = createContext<SettingsContextValue>({
  theme: 'dark', lang: DEFAULT_LANG,
  setTheme: () => {}, setLang: () => {},
  t: (k) => k,
});

const STORAGE_THEME = 'hui_admin_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme,   setThemeState] = useState<Theme>('dark');
  const [lang,    setLangState]  = useState<Lang>(DEFAULT_LANG);
  const [mounted, setMounted]    = useState(false);

  // ── Aus localStorage laden ────────────────────────────────────────────────
  useEffect(() => {
    const savedTheme = (localStorage.getItem(STORAGE_THEME) as Theme) || 'dark';
    const savedLang  = (localStorage.getItem(STORAGE_LANG_KEY) as Lang);
    const validLang  = savedLang && (SUPPORTED_LANGS as string[]).includes(savedLang)
      ? savedLang
      : DEFAULT_LANG;
    setThemeState(savedTheme);
    setLangState(validLang);
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
    localStorage.setItem(STORAGE_LANG_KEY, l);
  }, []);

  // ── Übersetzungs-Lookup: Lang → DE-Fallback → Key ─────────────────────────
  const t = useCallback((key: string): string => {
    return translations[lang]?.[key]
        ?? translations[DEFAULT_LANG]?.[key]
        ?? key;
  }, [lang]);

  // Verhindert Flash des falschen Themes beim ersten Render
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
