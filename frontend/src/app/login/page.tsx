'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('admin@hui-platform.io');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await login(email, password);
    if (ok) router.replace('/dashboard');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 36,
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              background: 'var(--accent)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Space Mono, monospace',
              fontSize: 14,
              fontWeight: 700,
              color: '#0F1117',
            }}
          >
            HUI
          </div>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              HUI Admin
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              Control Center
            </div>
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '28px 28px',
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: 'var(--text-primary)',
              marginBottom: 6,
            }}
          >
            Anmelden
          </h2>
          <p
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginBottom: 24,
            }}
          >
            Nur für autorisierte Administratoren
          </p>

          <form onSubmit={handleSubmit}>
            {/* E-Mail */}
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: 5,
                }}
              >
                E-Mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  fontFamily: 'DM Sans, sans-serif',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Passwort */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: 5,
                }}
              >
                Passwort
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 36px 9px 12px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    fontFamily: 'DM Sans, sans-serif',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: 14,
                  }}
                >
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Demo-Hinweis */}
            <div
              style={{
                background: 'var(--accent-dim)',
                border: '1px solid rgba(78,205,196,0.2)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 11,
                color: 'var(--accent)',
                marginBottom: 16,
              }}
            >
              Demo: admin@hui-platform.io / admin123
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  background: 'var(--red-dim)',
                  border: '1px solid rgba(255,107,107,0.3)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  color: 'var(--red)',
                  marginBottom: 14,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                background: loading ? 'var(--accent-dim)' : 'var(--accent)',
                color: '#0F1117',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                transition: 'all 0.15s',
              }}
            >
              {loading ? 'Anmelden…' : 'Anmelden'}
            </button>
          </form>
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 20,
          }}
        >
          Zugang nur für autorisierte Administratoren
        </p>
      </div>
    </div>
  );
}
