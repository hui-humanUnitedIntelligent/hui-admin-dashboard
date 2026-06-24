// frontend/src/components/ui/Button.tsx
'use client';

import { ButtonVariant, ButtonSize, buttonVariantStyles, buttonSizeStyles } from './system';

export type { ButtonVariant, ButtonSize };

interface ButtonProps {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  children:   React.ReactNode;
  onClick?:   () => void;
  disabled?:  boolean;
  icon?:      string;
  iconRight?: string;
  type?:      'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  loading?:   boolean;
  /** ARIA-Label für Icon-Only-Buttons */
  'aria-label'?: string;
  title?: string;
}

export default function Button({
  variant    = 'ghost',
  size       = 'md',
  children,
  onClick,
  disabled,
  icon,
  iconRight,
  type       = 'button',
  fullWidth,
  loading,
  'aria-label': ariaLabel,
  title,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading ? 'true' : undefined}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        transition: 'all 0.15s',
        width: fullWidth ? '100%' : undefined,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        ...buttonVariantStyles[variant],
        ...buttonSizeStyles[size],
      }}
    >
      {loading
        ? <span style={{ fontSize: 13, opacity: 0.8 }}>⟳</span>
        : icon && <span style={{ fontSize: size === 'sm' ? 12 : 14, lineHeight: 1 }}>{icon}</span>
      }
      {children}
      {!loading && iconRight && (
        <span style={{ fontSize: size === 'sm' ? 12 : 14, lineHeight: 1 }}>{iconRight}</span>
      )}
    </button>
  );
}
