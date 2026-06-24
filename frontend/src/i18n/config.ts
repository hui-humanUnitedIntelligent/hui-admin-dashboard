// frontend/src/i18n/config.ts
// ── HUI Admin Dashboard — Zentrale i18n-Konfiguration ────────────────────────
// Single source of truth für Sprach-Setup.

export type Lang = 'de' | 'en';

export const SUPPORTED_LANGS: Lang[] = ['de', 'en'];
export const DEFAULT_LANG: Lang = 'de';

export const LANG_LABELS: Record<Lang, { label: string; flag: string }> = {
  de: { label: 'Deutsch', flag: '🇩🇪' },
  en: { label: 'English', flag: '🇬🇧' },
};

/** localStorage-Key für persistente Sprachspeicherung */
export const STORAGE_LANG_KEY = 'hui_admin_lang';

/** Gibt die Browser-Standardsprache zurück, falls unterstützt — sonst DEFAULT_LANG */
export function detectBrowserLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  const browserLang = navigator.language.slice(0, 2).toLowerCase();
  return (SUPPORTED_LANGS as string[]).includes(browserLang)
    ? (browserLang as Lang)
    : DEFAULT_LANG;
}
