// frontend/src/components/ui/EditProfileModal.tsx
'use client';

import { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import { HuiProfile } from '@/lib/hooks/useSupabase';
import { editProfile, ProfileEditData } from '@/lib/actions/userActions';
import { showToast } from './Toast';

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  profile: HuiProfile | null;
  adminId?: string | null;
  onSaved: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-body)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  display: 'block',
  marginBottom: 5,
};

const fieldStyle: React.CSSProperties = {
  marginBottom: 14,
};

export default function EditProfileModal({
  open, onClose, profile, adminId = null, onSaved,
}: EditProfileModalProps) {
  const [form, setForm] = useState<ProfileEditData>({
    display_name: '',
    bio: '',
    location: '',
    talent: '',
    is_available: false,
    skills: [],
  });
  const [skillsInput, setSkillsInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        bio:          profile.bio || '',
        location:     profile.location || '',
        talent:       profile.talent || '',
        is_available: profile.is_available ?? false,
        skills:       (profile as unknown as { skills?: string[] }).skills || [],
      });
      setSkillsInput(
        ((profile as unknown as { skills?: string[] }).skills || []).join(', ')
      );
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const skillsArray = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const ok = await editProfile(profile.id, { ...form, skills: skillsArray }, adminId);
    setSaving(false);
    if (ok) {
      showToast('Profil gespeichert ✅', 'success');
      onSaved();
      onClose();
    } else {
      showToast('Fehler beim Speichern', 'error');
    }
  };

  const set = (key: keyof ProfileEditData, val: unknown) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`✏️ Profil bearbeiten — @${profile?.username || '?'}`}
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Abbrechen</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Speichern…' : '💾 Speichern'}
          </Button>
        </>
      }
    >
      <div style={fieldStyle}>
        <label style={labelStyle}>Anzeigename</label>
        <input
          style={inputStyle}
          value={form.display_name || ''}
          onChange={(e) => set('display_name', e.target.value)}
          placeholder="Vor- und Nachname"
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Bio</label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
          value={form.bio || ''}
          onChange={(e) => set('bio', e.target.value)}
          placeholder="Kurze Beschreibung"
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Standort</label>
        <input
          style={inputStyle}
          value={form.location || ''}
          onChange={(e) => set('location', e.target.value)}
          placeholder="Stadt, Land"
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Talent / Haupttätigkeit</label>
        <input
          style={inputStyle}
          value={form.talent || ''}
          onChange={(e) => set('talent', e.target.value)}
          placeholder="z.B. Fotografie, Webentwicklung"
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Skills (kommagetrennt)</label>
        <input
          style={inputStyle}
          value={skillsInput}
          onChange={(e) => setSkillsInput(e.target.value)}
          placeholder="React, Design, Marketing, …"
        />
        {skillsInput && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {skillsInput.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (
              <span key={s} style={{ padding: '2px 8px', borderRadius: 20, background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11 }}>
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="checkbox"
          id="is_available"
          checked={form.is_available || false}
          onChange={(e) => set('is_available', e.target.checked)}
          style={{ width: 14, height: 14, cursor: 'pointer' }}
        />
        <label htmlFor="is_available" style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          Als verfügbar markieren (für Buchungen)
        </label>
      </div>
    </Modal>
  );
}
