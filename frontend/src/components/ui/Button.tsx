'use client';

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'warning';
type ButtonSize = 'sm' | 'md';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: string;
  type?: 'button' | 'submit';
  fullWidth?: boolean;
}

const STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: '#0F1117',
    border: 'none',
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

const SIZES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '5px 10px', fontSize: 11 },
  md: { padding: '8px 14px', fontSize: 12 },
};

export default function Button({
  variant = 'ghost',
  size = 'md',
  children,
  onClick,
  disabled,
  icon,
  type = 'button',
  fullWidth,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 8,
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        width: fullWidth ? '100%' : undefined,
        ...STYLES[variant],
        ...SIZES[size],
      }}
    >
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {children}
    </button>
  );
}
