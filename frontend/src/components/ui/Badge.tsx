'use client';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; color: string }> = {
  success: { bg: 'var(--green-dim)',   color: 'var(--green)'  },
  warning: { bg: 'var(--gold-dim)',    color: 'var(--gold)'   },
  danger:  { bg: 'var(--red-dim)',     color: 'var(--red)'    },
  info:    { bg: 'var(--blue-dim)',    color: 'var(--blue)'   },
  purple:  { bg: 'var(--purple-dim)', color: 'var(--purple)' },
  neutral: { bg: 'rgba(77,86,104,0.2)', color: 'var(--text-secondary)' },
};

export default function Badge({ variant, children, dot }: BadgeProps) {
  const style = VARIANT_STYLES[variant];
  return (
    <span
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
      }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
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

export function statusToBadge(status: string): React.ReactElement {
  switch (status) {
    case 'active':
      return <Badge variant="success" dot>Aktiv</Badge>;
    case 'suspended':
      return <Badge variant="danger" dot>Gesperrt</Badge>;
    case 'completed':
      return <Badge variant="success">Abgeschlossen</Badge>;
    case 'pending':
      return <Badge variant="warning">Ausstehend</Badge>;
    case 'failed':
      return <Badge variant="danger">Fehlgeschlagen</Badge>;
    case 'Talent':
      return <Badge variant="purple">Talent</Badge>;
    case 'Moderator':
      return <Badge variant="info">Moderator</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}
