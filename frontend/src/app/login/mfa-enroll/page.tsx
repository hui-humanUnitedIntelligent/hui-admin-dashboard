// frontend/src/app/login/mfa-enroll/page.tsx
// Erst-Einrichtung der Zwei-Faktor-Authentifizierung (TOTP) — Pflicht für jeden
// Superadmin/Employee-Login ohne bereits verifizierten Faktor.
'use client';

import { useState, useEffect } from 'react';

export default function MfaEnrollPage() {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [factorId, setFactorId] = useState('');
  const [qrSvg, setQrSvg]       = useState('');
  const [secret, setSecret]     = useState('');
  const [code, setCode]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/mfa/enroll')
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setError(d.error || 'Einrichtung fehlgeschlagen.'); setLoading(false); return; }
        setFactorId(d.factorId);
        setQrSvg(d.qr_svg);
        setSecret(d.secret);
        setLoading(false);
      })
      .catch(() => { setError('Verbindungsfehler.'); setLoading(false); });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factorId, code }),
      });
      const d = await res.json();
      if (!d.ok) { setError(d.error || 'Ungültiger Code.'); setSubmitting(false); return; }
      window.location.replace(d.redirect || '/dashboard');
    } catch {
      setError('Verbindungsfehler.');
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    borderRadius: 8, fontSize: 16, letterSpacing: 4, textAlign: 'center',
    color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
            🔐 Zwei-Faktor-Einrichtung
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            Pflicht für den Admin-Zugang. Scanne den QR-Code mit Google Authenticator, Authy o.ä.
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Wird geladen…</div>
        )}

        {!loading && qrSvg && (
          <>
            <div style={{
              background: '#fff', borderRadius: 12, padding: 16,
              display: 'flex', justifyContent: 'center', marginBottom: 16,
            }}>
              <img
                src={qrSvg}
                alt="QR-Code für Authenticator-App"
                width={200} height={200}
              />
            </div>

            <div style={{
              fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20,
              wordBreak: 'break-all', padding: '8px 12px',
              background: 'var(--bg-secondary)', borderRadius: 8,
            }}>
              Kein Scanner? Manuell eingeben: <strong style={{ color: 'var(--text-primary)' }}>{secret}</strong>
            </div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                6-stelliger Code aus der App
              </label>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                style={inputStyle} placeholder="000000" autoFocus
              />

              {error && (
                <div style={{
                  padding: '10px 14px', background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
                  fontSize: 13, color: '#f87171',
                }}>⚠️ {error}</div>
              )}

              <button
                type="submit" disabled={submitting || code.length !== 6}
                style={{
                  padding: '12px', background: 'var(--accent)', color: '#0F1117',
                  border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
                  cursor: submitting || code.length !== 6 ? 'not-allowed' : 'pointer',
                  opacity: submitting || code.length !== 6 ? 0.6 : 1,
                }}
              >
                {submitting ? 'Wird geprüft…' : 'Bestätigen & Aktivieren'}
              </button>
            </form>
          </>
        )}

        {!loading && !qrSvg && error && (
          <div style={{
            padding: '10px 14px', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
            fontSize: 13, color: '#f87171', textAlign: 'center',
          }}>
            ⚠️ {error}
            <div style={{ marginTop: 10 }}>
              <a href="/login" style={{ color: 'var(--accent)' }}>Zurück zum Login</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
