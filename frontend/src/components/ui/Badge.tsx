// frontend/src/components/ui/Badge.tsx
'use client';

import { BadgeVariant, badgeVariantStyles } from './system';

export type { BadgeVariant };

interface BadgeProps {
  variant:    BadgeVariant;
  children:   React.ReactNode;
  dot?:       boolean;
}

export default function Badge({ variant, children, dot }: BadgeProps) {
  const style = badgeVariantStyles[variant];
  return (
    <span
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 500,
        background: style.bg,
        color: style.color,
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-body)',
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{
            width: 5, height: 5,
            borderRadius: '50%',
            background: style.color,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

/** Status → Badge: Labels jetzt i18n-fähig via optionalem `lang`-Parameter */
export function statusToBadge(status: string, lang: string = 'de'): React.ReactElement {
  const l = (de: string, en: string) => lang === 'en' ? en : de;
  switch (status) {
    case 'active':    return <Badge variant="success" dot>{l('Aktiv','Active')}</Badge>;
    case 'suspended': return <Badge variant="danger"  dot>{l('Gesperrt','Blocked')}</Badge>;
    case 'completed': return <Badge variant="success">{l('Abgeschlossen','Completed')}</Badge>;
    case 'pending':   return <Badge variant="warning">{l('Ausstehend','Pending')}</Badge>;
    case 'failed':    return <Badge variant="danger">{l('Fehlgeschlagen','Failed')}</Badge>;
    case 'Talent':    return <Badge variant="purple">Talent</Badge>;
    case 'Moderator': return <Badge variant="info">Moderator</Badge>;
    default:          return <Badge variant="neutral">{status}</Badge>;
  }
}
