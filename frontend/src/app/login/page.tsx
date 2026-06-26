// frontend/src/app/login/page.tsx
'use client';

import { useState, FormEvent, useRef } from 'react';
import { SUPABASE_URL } from '@/lib/api';

type DashboardMode = 'super' | 'employee';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [mode, setMode]         = useState<DashboardMode>('super');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Versuche AJAX-Login
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
        // Cookie wurde via AJAX gesetzt — hard redirect
        const dest = mode === 'employee' ? '/employee/works' : '/works';
        window.location.replace(dest);
        return;
      }

      // AJAX fehlgeschlagen — native Form POST als Fallback
      if (res.status === 401 || res.status === 403) {
        setError(data.error || 'Anmeldung fehlgeschlagen');
        setLoading(false);
        return;
      }

      // Bei anderen Fehlern: nativer Form POST (setzt Cookies zuverlässig)
      if (formRef.current) {
        formRef.current.submit();
        return;
      }

      setError(data.error || 'Anmeldung fehlgeschlagen');
    } catch {
      // Netzwerkfehler: nativer Form POST Fallback
      if (formRef.current) {
        formRef.current.submit();
        return;
      }
      setError('Netzwerkfehler — bitte erneut versuchen');
    } finally {
      setLoading(false);
    }
  };

  const isLive = !!SUPABASE_URL;
  const dashboardValue = mode === 'super' ? 'admin' : 'employee';

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
          }}>HUI</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            HUI Control Center
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {isLive ? '🟢 Live-Modus · Supabase verbunden' : '⚠️ Demo-Modus'}
          </div>
        </div>

        {/* Mode selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {([
            { key: 'super', label: 'Admin Dashboard', icon: '🛡️', desc: 'Vollzugriff' },
            { key: 'employee', label: 'Employee Dashboard', icon: '👤', desc: 'Eingeschränkt' },
          ] as { key: DashboardMode; label: string; icon: string; desc: string }[]).map(opt => (
            <button key={opt.key} type="button" onClick={() => setMode(opt.key)} style={{
              padding: '14px 12px',
              background: mode === opt.key ? 'var(--accent-dim)' : 'var(--bg-secondary)',
              border: `2px solid ${mode === opt.key ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 12, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 20 }}>{opt.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: mode === opt.key ? 'var(--accent)' : 'var(--text-primary)' }}>{opt.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{opt.desc}</span>
            </button>
          ))}
        </div>

        {/* Form — action für nativen POST Fallback */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          action="/api/auth/admin-login"
          method="POST"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {/* Hidden field für dashboard mode */}
          <input type="hidden" name="dashboard" value={dashboardValue} />

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              E-Mail
            </label>
            <input
              type="email" name="email" autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              style={{ ...inputStyle, marginTop: 6 }}
              placeholder="deine@email.de" required
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Passwort
            </label>
            <div style={{ position: 'relative', marginTop: 6 }}>
              <input
                type={showPw ? 'text' : 'password'}
                name="password" autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: 40 }}
                placeholder="••••••••" required
              />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 14,
              }}>{showPw ? '🙈' : '👁️'}</button>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
              fontSize: 13, color: '#f87171',
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            padding: '12px', background: loading ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: loading ? 'var(--text-muted)' : '#0F1117',
            border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
            cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4,
            transition: 'all 0.15s',
          }}>
            {loading ? 'Anmelden…' : `${mode === 'super' ? '🛡️ Admin' : '👤 Employee'} Login`}
          </button>
        </form>
      </div>
    </div>
  );
}
