// frontend/src/components/ui/LanguageSwitcher.tsx
'use client';

import { useSettings } from '@/components/providers/ThemeProvider';
import { SUPPORTED_LANGS, LANG_LABELS, Lang } from '@/i18n/config';

interface LanguageSwitcherProps {
  /** 'dropdown' = Dropdown-Menü (Standard) | 'inline' = nebeneinander stehende Buttons */
  variant?: 'dropdown' | 'inline';
  /** Zusätzliche Styles für das Wrapper-Element */
  style?: React.CSSProperties;
}

export default function LanguageSwitcher({ variant = 'inline', style }: LanguageSwitcherProps) {
  const { lang, setLang } = useSettings();

  if (variant === 'inline') {
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', ...style }}>
        {SUPPORTED_LANGS.map((l: Lang) => {
          const active = lang === l;
          return (
            <button
              key={l}
              onClick={() => setLang(l)}
              title={LANG_LABELS[l].label}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                cursor: active ? 'default' : 'pointer',
                fontSize: 11.5, fontWeight: active ? 600 : 400,
                transition: 'all 0.12s',
                fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
            >
              <span>{LANG_LABELS[l].flag}</span>
              <span>{l.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Dropdown-Variante
  return (
    <select
      value={lang}
      onChange={e => setLang(e.target.value as Lang)}
      style={{
        padding: '4px 8px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        outline: 'none',
        ...style,
      }}
    >
      {SUPPORTED_LANGS.map((l: Lang) => (
        <option key={l} value={l}>
          {LANG_LABELS[l].flag} {LANG_LABELS[l].label}
        </option>
      ))}
    </select>
  );
}
