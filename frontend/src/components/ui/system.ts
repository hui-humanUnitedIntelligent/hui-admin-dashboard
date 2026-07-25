// frontend/src/components/ui/system.ts
// ── HUI Admin Dashboard — Design-System-Token ────────────────────────────────
// Zentrale CSS-Variablen-Referenzen und Stil-Konstanten.
// Wird von allen UI-Komponenten importiert.

/** CSS-Variablen-Referenzen — entsprechen globals.css */
export const tokens = {
  // Hintergründe
  bgPrimary:   'var(--bg-primary)',
  bgSecondary: 'var(--bg-secondary)',
  bgTertiary:  'var(--bg-tertiary)',
  bgHover:     'var(--bg-hover)',
  // Text
  textPrimary:   'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted:     'var(--text-muted)',
  // Farben
  accent:    'var(--accent)',
  accentDim: 'var(--accent-dim)',
  red:       'var(--red)',
  redDim:    'var(--red-dim)',
  gold:      'var(--gold)',
  goldDim:   'var(--gold-dim)',
  green:     'var(--green)',
  greenDim:  'var(--green-dim)',
  blue:      'var(--blue)',
  blueDim:   'var(--blue-dim)',
  purple:    'var(--purple)',
  purpleDim: 'var(--purple-dim)',
  // Rahmen
  border:      'var(--border)',
  borderHover: 'var(--border-hover)',
  // Sonstiges
  fontBody:  'var(--font-body)',
  fontMono:  'var(--font-mono)',
  shadowLg:  'var(--shadow-lg)',
} as const;

/** Border-Radius-Werte */
export const radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/** Z-Index-Ebenen */
export const zIndex = {
  sidebar:  50,
  header:   100,
  modal:    500,
  toast:    600,
  tooltip:  700,
} as const;

/** Transitions */
export const transition = {
  fast:   'all 0.1s ease',
  normal: 'all 0.15s ease',
  slow:   'all 0.25s ease',
} as const;

// ── Button ───────────────────────────────────────────────────────────────────
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning';
export type ButtonSize    = 'sm' | 'md' | 'lg';

export const buttonVariantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: '#0F1117',
    border: 'none',
  },
  secondary: {
    background: 'var(--bg-tertiary)',
    color: 'var(--accent)',
    border: '1px solid var(--accent)',
  },
  ghost: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  },
  danger: {
    background: 'var(--red-dim)',
    color: 'var(--red)',
    border: '1px solid rgba(255,107,107,0.3)',
  },
  warning: {
    background: 'var(--gold-dim)',
    color: 'var(--gold)',
    border: '1px solid rgba(247,183,49,0.3)',
  },
};

export const buttonSizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '6px 10px',  fontSize: 11.5, borderRadius: radii.sm, minHeight: 32 },
  md: { padding: '8px 14px',  fontSize: 12.5, borderRadius: radii.md, minHeight: 36 },
  lg: { padding: '11px 20px', fontSize: 13.5, borderRadius: radii.md, minHeight: 42 },
};

// ── Badge ─────────────────────────────────────────────────────────────────────
export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';

export const badgeVariantStyles: Record<BadgeVariant, { bg: string; color: string }> = {
  success: { bg: 'var(--green-dim)',    color: 'var(--green)'  },
  warning: { bg: 'var(--gold-dim)',     color: 'var(--gold)'   },
  danger:  { bg: 'var(--red-dim)',      color: 'var(--red)'    },
  info:    { bg: 'var(--blue-dim)',     color: 'var(--blue)'   },
  purple:  { bg: 'var(--purple-dim)',   color: 'var(--purple)' },
  neutral: { bg: 'rgba(77,86,104,0.2)', color: 'var(--text-secondary)' },
};

// ── KPICard ───────────────────────────────────────────────────────────────────
export type KPIVariant = 'teal' | 'green' | 'blue' | 'gold' | 'purple' | 'red';

export const kpiVariantColors: Record<KPIVariant, { color: string; dim: string }> = {
  teal:   { color: 'var(--accent)',  dim: 'var(--accent-dim)' },
  green:  { color: 'var(--green)',   dim: 'var(--green-dim)'  },
  blue:   { color: 'var(--blue)',    dim: 'var(--blue-dim)'   },
  gold:   { color: 'var(--gold)',    dim: 'var(--gold-dim)'   },
  purple: { color: 'var(--purple)',  dim: 'var(--purple-dim)' },
  red:    { color: 'var(--red)',     dim: 'var(--red-dim)'    },
};
