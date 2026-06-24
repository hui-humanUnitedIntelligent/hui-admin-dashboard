// frontend/src/components/ui/Input.tsx
// ── HUI Admin Dashboard — Einheitliche Input-Komponente ──────────────────────
'use client';

import React, { useId } from 'react';

interface InputProps {
  label?:       string;
  error?:       string;
  helperText?:  string;
  placeholder?: string;
  value?:       string;
  defaultValue?: string;
  onChange?:    (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?:      (e: React.FocusEvent<HTMLInputElement>) => void;
  type?:        'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url';
  disabled?:    boolean;
  required?:    boolean;
  readOnly?:    boolean;
  autoFocus?:   boolean;
  maxLength?:   number;
  name?:        string;
  style?:       React.CSSProperties;
  /** Icon links */
  iconLeft?:    string;
  /** Icon rechts */
  iconRight?:   string;
}

export default function Input({
  label, error, helperText,
  type = 'text',
  disabled, required, readOnly,
  iconLeft, iconRight,
  style,
  ...props
}: InputProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helperText ? `${id}-helper` : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: 12, fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          {label}
          {required && (
            <span aria-hidden="true" style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>
          )}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {iconLeft && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', left: 10, fontSize: 14,
              color: 'var(--text-muted)', pointerEvents: 'none',
            }}
          >
            {iconLeft}
          </span>
        )}
        <input
          id={id}
          type={type}
          disabled={disabled}
          required={required}
          readOnly={readOnly}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
          style={{
            width: '100%',
            padding: `8px ${iconRight ? 34 : 10}px 8px ${iconLeft ? 34 : 10}px`,
            background: 'var(--bg-tertiary)',
            border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
            borderRadius: 8,
            color: 'var(--text-primary)',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'text',
            opacity: disabled ? 0.6 : 1,
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { if (!error) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
          onBlur={e => { if (!error) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
          {...props}
        />
        {iconRight && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', right: 10, fontSize: 14,
              color: 'var(--text-muted)', pointerEvents: 'none',
            }}
          >
            {iconRight}
          </span>
        )}
      </div>

      {error && (
        <span id={errorId} role="alert" style={{ fontSize: 11, color: 'var(--red)' }}>
          {error}
        </span>
      )}
      {helperText && !error && (
        <span id={helperId} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {helperText}
        </span>
      )}
    </div>
  );
}
