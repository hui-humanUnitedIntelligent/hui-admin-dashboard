// frontend/src/app/login/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { SUPABASE_URL } from '@/lib/api';

type DashboardMode = 'super' | 'employee';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [mode, setMode]         = useState<DashboardMode>('super');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          dashboard: mode === 'super' ? 'admin' : 'employee',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const dest = mode === 'employee' ? '/employee/works' : '/works';
        // Einfacher Hard-Redirect — Cookies sind vom AJAX-Response bereits gesetzt
        window.location.replace(dest);
      } else {
        setError(data.error || 'Anmeldung fehlgeschlagen');
      }
    } catch {
      setError('Netzwerkfehler — bitte erneut versuchen');
    } finally {
      setLoading(false);
    }
  };

  const isLive = !!SUPABASE_URL;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: 8, fontSize: 13,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg, var(--accent), #2BC5BB)',
            borderRadius: 12, margin: '0 auto 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#0F1117',
            boxShadow: '0 0 24px rgba(78,205,196,0.3)',
          }}>
            HUI
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            HUI Control Center
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {isLive ? '🟢 Live-Modus · Supabase verbunden' : '⚠️ Demo-Modus · Keine Verbindung konfiguriert'}
          </div>
        </div>

        {/* Dashboard-Auswahl */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {([
            { key: 'super',    label: 'Admin Dashboard',    icon: '🛡️', desc: 'Vollzugriff' },
            { key: 'employee', label: 'Employee Dashboard', icon: '👤', desc: 'Eingeschränkt' },
          ] as { key: DashboardMode; label: string; icon: string; desc: string }[]).map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setMode(opt.key)}
              style={{
                padding: '14px 12px',
                background: mode === opt.key ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                border: `2px solid ${mode === opt.key ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 22 }}>{opt.icon}</span>
              <span style={{
                fontSize: 11.5, fontWeight: 700,
                color: mode === opt.key ? 'var(--accent)' : 'var(--text-primary)',
                letterSpacing: '-0.2px', lineHeight: 1.3, textAlign: 'center',
              }}>{opt.label}</span>
              <span style={{
                fontSize: 10, color: 'var(--text-muted)',
                background: mode === opt.key ? 'rgba(78,205,196,0.15)' : 'var(--bg-tertiary)',
                padding: '2px 7px', borderRadius: 4,
              }}>{opt.desc}</span>
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 14, padding: 28,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', marginBottom: 20,
            background: mode === 'super' ? 'rgba(78,205,196,0.08)' : 'rgba(116,192,252,0.08)',
            border: `1px solid ${mode === 'super' ? 'rgba(78,205,196,0.25)' : 'rgba(116,192,252,0.25)'}`,
            borderRadius: 8, fontSize: 12,
          }}>
            <span>{mode === 'super' ? '🛡️' : '👤'}</span>
            <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
              Login als <strong style={{ color: mode === 'super' ? 'var(--accent)' : '#74C0FC' }}>
                {mode === 'super' ? 'Super Admin' : 'Mitarbeiter'}
              </strong>
            </span>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', marginBottom: 16,
              background: 'var(--red-dim)', border: '1px solid rgba(255,107,107,0.3)',
              borderRadius: 8, fontSize: 12, color: 'var(--red)',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>
              E-Mail
            </label>
            <input
              type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@hui-platform.io"
              required autoFocus style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e)  => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 6 }}>
              Passwort
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ ...inputStyle, paddingRight: 40 }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e)  => (e.target.style.borderColor = 'var(--border)')}
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '11px 0',
              background: loading ? 'var(--bg-tertiary)' : 'var(--accent)',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              color: loading ? 'var(--text-muted)' : '#0F1117',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-body)',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Anmelden…
              </>
            ) : `Anmelden → ${mode === 'super' ? 'Admin Dashboard' : 'Employee Dashboard'}`}
          </button>
        </form>

      </div>
    </div>
  );
}
