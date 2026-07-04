// frontend/src/app/employees/page.tsx
// SADB — Employee-Verwaltung: Accounts anlegen, Passwort ändern, löschen
'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { showToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/hooks/useAuth';

interface Employee {
  id:              string;
  email:           string | null;
  display_name:    string | null;
  username:        string | null;
  avatar_url:      string | null;
  role:            string;
  created_at:      string;
  last_sign_in_at: string | null;
  last_seen_at:    string | null;
}

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)   return 'gerade eben';
  if (mins < 60)  return `vor ${mins} Min`;
  const h = Math.floor(mins / 60);
  if (h < 24)     return `vor ${h} Std`;
  const d = Math.floor(h / 24);
  if (d < 30)     return `vor ${d}d`;
  return new Date(iso).toLocaleDateString('de-DE');
}

function roleColor(role: string) {
  if (role === 'superadmin' || role === 'super_admin') return '#B197FC';
  if (role === 'admin')    return '#74C0FC';
  if (role === 'employee') return '#4ECDC4';
  return '#8892A4';
}
function roleLabel(role: string) {
  if (role === 'superadmin' || role === 'super_admin') return 'Superadmin';
  if (role === 'admin')    return 'Admin';
  if (role === 'employee') return 'Employee';
  return role;
}

function initials(e: Employee) {
  const name = e.display_name || e.username || e.email || '?';
  return name.charAt(0).toUpperCase();
}

const card: React.CSSProperties = {
  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
  borderRadius: 12, padding: 20,
};
const input: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  background: 'var(--bg-primary)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text-primary)', outline: 'none',
  boxSizing: 'border-box',
};
const btnPrimary: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: '#4ECDC4', color: '#fff', fontWeight: 600, fontSize: 13,
};
const btnDanger: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
  background: 'rgba(255,107,107,0.15)', color: '#FF6B6B', fontSize: 12,
};
const btnEdit: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
  background: 'rgba(78,205,196,0.12)', color: '#4ECDC4', fontSize: 12,
};

export default function EmployeesPage() {
  const { currentUser } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [showPw,     setShowPw]     = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [form, setForm] = useState({ email: '', password: '', display_name: '', username: '' });
  const [formErr, setFormErr] = useState('');

  // Edit modal
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [editName,   setEditName]   = useState('');
  const [editPw,     setEditPw]     = useState('');
  const [showEditPw, setShowEditPw] = useState(false);
  const [editing,    setEditing]    = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // 2FA-Reset confirm
  const [mfaResetTarget, setMfaResetTarget] = useState<Employee | null>(null);
  const [mfaResetting,   setMfaResetting]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees', { credentials: 'include' });
      const j   = await res.json();
      setEmployees(j.employees ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = employees.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (e.email        ?? '').toLowerCase().includes(q) ||
      (e.display_name ?? '').toLowerCase().includes(q) ||
      (e.username     ?? '').toLowerCase().includes(q)
    );
  });

  // ── Erstellen ──────────────────────────────────────────────────────────────
  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    setFormErr('');
    if (!form.email || !form.password) { setFormErr('E-Mail und Passwort erforderlich'); return; }
    if (form.password.length < 8)      { setFormErr('Passwort mind. 8 Zeichen'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/employees', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (j.ok) {
        showToast(`✅ Employee ${form.email} erstellt`, 'success');
        setForm({ email: '', password: '', display_name: '', username: '' });
        setShowCreate(false);
        load();
      } else {
        setFormErr(j.error ?? 'Fehler');
      }
    } finally { setCreating(false); }
  }

  // ── Bearbeiten ─────────────────────────────────────────────────────────────
  function openEdit(e: Employee) {
    setEditTarget(e);
    setEditName(e.display_name ?? '');
    setEditPw('');
    setShowEditPw(false);
  }
  async function handleEdit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!editTarget) return;
    if (editPw && editPw.length < 8) { showToast('Passwort mind. 8 Zeichen', 'error'); return; }
    setEditing(true);
    try {
      const res = await fetch('/api/employees', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editTarget.id, password: editPw || undefined, display_name: editName || undefined }),
      });
      const j = await res.json();
      if (j.ok) {
        showToast('✅ Gespeichert', 'success');
        setEditTarget(null);
        load();
      } else { showToast(j.error ?? 'Fehler', 'error'); }
    } finally { setEditing(false); }
  }

  // ── Löschen ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/employees', {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const j = await res.json();
      if (j.ok) {
        showToast(`🗑️ ${deleteTarget.email} gelöscht`, 'success');
        setDeleteTarget(null);
        load();
      } else { showToast(j.error ?? 'Fehler', 'error'); }
    } finally { setDeleting(false); }
  }

  // ── 2FA zurücksetzen ─────────────────────────────────────────────────────
  async function handleMfaReset() {
    if (!mfaResetTarget) return;
    setMfaResetting(true);
    try {
      const res = await fetch('/api/auth/mfa/admin-reset', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: mfaResetTarget.id }),
      });
      const j = await res.json();
      if (j.ok) {
        showToast(`🔐 2FA für ${mfaResetTarget.email} zurückgesetzt — muss sich neu einrichten`, 'success');
        setMfaResetTarget(null);
      } else { showToast(j.error ?? 'Fehler', 'error'); }
    } finally { setMfaResetting(false); }
  }

  return (
    <DashboardLayout title="Employee-Verwaltung">
      <PageHeader
        title="Employee-Verwaltung"
        subtitle={`${employees.length} Accounts · Portal-Zugänge verwalten`}
        actionsRole="superadmin"
        userRole={currentUser?.role}
      />

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="Name, E-Mail oder Username suchen…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...input, maxWidth: 320 }}
        />
        <button style={btnPrimary} onClick={() => setShowCreate(v => !v)}>
          {showCreate ? '✕ Abbrechen' : '+ Neuer Employee'}
        </button>
      </div>

      {/* ── Create Form ──────────────────────────────────────────────── */}
      {showCreate && (
        <div style={{ ...card, marginBottom: 16, border: '1px solid rgba(78,205,196,0.3)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
            Neuen Employee-Account erstellen
          </div>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  E-Mail *
                </label>
                <input
                  type="email" required placeholder="mitarbeiter@firma.de"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={input}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Passwort * (min. 8 Zeichen)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'} required minLength={8} placeholder="••••••••"
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    style={{ ...input, paddingRight: 36 }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 15,
                    color: 'var(--text-secondary)', padding: 2,
                  }}>{showPw ? '🙈' : '👁️'}</button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Anzeigename
                </label>
                <input
                  type="text" placeholder="Max Mustermann"
                  value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                  style={input}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Username
                </label>
                <input
                  type="text" placeholder="max_mustermann"
                  value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  style={input}
                />
              </div>
            </div>
            {formErr && (
              <div style={{ fontSize: 12, color: '#FF6B6B', marginBottom: 10, padding: '6px 10px',
                background: 'rgba(255,107,107,0.08)', borderRadius: 6 }}>
                {formErr}
              </div>
            )}
            <button type="submit" style={{ ...btnPrimary, opacity: creating ? 0.6 : 1 }} disabled={creating}>
              {creating ? 'Erstelle…' : '✅ Account erstellen'}
            </button>
          </form>
        </div>
      )}

      {/* ── Employee-Liste ───────────────────────────────────────────── */}
      <div style={card}>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Lade…</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {search ? 'Keine Treffer' : 'Noch keine Employee-Accounts. Erstelle den ersten mit dem Button oben.'}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '0 0 10px', fontWeight: 500 }}>Account</th>
                <th style={{ textAlign: 'left', padding: '0 0 10px', fontWeight: 500 }}>Rolle</th>
                <th style={{ textAlign: 'left', padding: '0 0 10px', fontWeight: 500 }}>Erstellt</th>
                <th style={{ textAlign: 'left', padding: '0 0 10px', fontWeight: 500 }}>Letzter Login</th>
                <th style={{ textAlign: 'right', padding: '0 0 10px', fontWeight: 500 }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: roleColor(e.role), display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 14,
                        overflow: 'hidden',
                      }}>
                        {e.avatar_url
                          ? <img src={e.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : initials(e)
                        }
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {e.display_name || e.username || '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{e.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 0' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                      background: `${roleColor(e.role)}20`, color: roleColor(e.role),
                    }}>
                      {roleLabel(e.role)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 0', color: 'var(--text-secondary)', fontSize: 12 }}>
                    {new Date(e.created_at).toLocaleDateString('de-DE')}
                  </td>
                  <td style={{ padding: '10px 0', color: 'var(--text-secondary)', fontSize: 12 }}>
                    {timeAgo(e.last_sign_in_at ?? e.last_seen_at)}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button style={btnEdit} onClick={() => openEdit(e)}>✏️ Bearbeiten</button>
                      <button style={btnEdit} onClick={() => setMfaResetTarget(e)}>🔐 2FA zurücksetzen</button>
                      <button style={btnDanger} onClick={() => setDeleteTarget(e)}>🗑️ Löschen</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Edit Modal ───────────────────────────────────────────────── */}
      {editTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{ ...card, width: 420, maxWidth: '90vw' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
              ✏️ Bearbeiten: {editTarget.email}
            </div>
            <form onSubmit={handleEdit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Anzeigename
                </label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                  style={input} placeholder="Anzeigename" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Neues Passwort (leer lassen = unverändert)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showEditPw ? 'text' : 'password'}
                    value={editPw} onChange={e => setEditPw(e.target.value)}
                    style={{ ...input, paddingRight: 36 }} placeholder="••••••••" minLength={8}
                  />
                  <button type="button" onClick={() => setShowEditPw(v => !v)} style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 15,
                    color: 'var(--text-secondary)', padding: 2,
                  }}>{showEditPw ? '🙈' : '👁️'}</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" style={{ ...btnPrimary, opacity: editing ? 0.6 : 1 }} disabled={editing}>
                  {editing ? 'Speichere…' : '💾 Speichern'}
                </button>
                <button type="button" onClick={() => setEditTarget(null)}
                  style={{ ...btnPrimary, background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────── */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{ ...card, width: 380, maxWidth: '90vw' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
              Account löschen?
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              <strong>{deleteTarget.email}</strong> wird dauerhaft aus dem Portal entfernt.
              Der Mitarbeiter kann sich nicht mehr einloggen.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ ...btnDanger, padding: '8px 18px', fontSize: 13, fontWeight: 600, opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Lösche…' : '🗑️ Ja, löschen'}
              </button>
              <button onClick={() => setDeleteTarget(null)}
                style={{ ...btnPrimary, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2FA-Reset Confirm ────────────────────────────────────────── */}
      {mfaResetTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{ ...card, width: 420, maxWidth: '90vw' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
              🔐 2FA zurücksetzen?
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Der bestehende Authenticator-Faktor von <strong>{mfaResetTarget.email}</strong> wird gelöscht.
              Beim nächsten Login muss die Person die Zwei-Faktor-Authentifizierung per QR-Code neu einrichten
              (2FA bleibt Pflicht — nur der alte, evtl. verlorene Faktor wird entfernt).
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleMfaReset}
                disabled={mfaResetting}
                style={{ ...btnPrimary, opacity: mfaResetting ? 0.6 : 1 }}>
                {mfaResetting ? 'Setze zurück…' : '🔐 Ja, zurücksetzen'}
              </button>
              <button onClick={() => setMfaResetTarget(null)}
                style={{ ...btnPrimary, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
