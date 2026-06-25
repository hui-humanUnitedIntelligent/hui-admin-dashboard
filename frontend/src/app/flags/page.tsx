// frontend/src/app/flags/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageHeader from '@/components/layout/PageHeader';
import { showToast } from '@/components/ui/Toast';

interface Flag {
  label: string;
  description: string;
  enabled: boolean;
  target: string;
  category: string;
}
type Flags = Record<string, Flag>;

const TARGET_OPTIONS = ['all', 'wirker', 'members', 'admins', 'basisuser'];
const CATEGORY_OPTIONS = ['Features', 'Zahlung', 'Impact', 'Content', 'System', 'UX', 'KI', 'Custom'];

const TARGET_LABELS: Record<string, string> = {
  all: '🌍 Alle', wirker: '⭐ Wirker', members: '🏅 Members', admins: '🛡️ Admins', basisuser: '◎ Basisuser',
};

// ── Mock-Screens pro Flag ─────────────────────────────────────
const FLAG_PREVIEW: Record<string, {
  screenTitle: string;
  affectedArea: string;
  onScreen: { title: string; description: string; elements: string[] };
  offScreen: { title: string; description: string; elements: string[] };
  impact: 'low' | 'medium' | 'high';
}> = {
  new_payment_page: {
    screenTitle: 'Checkout / Zahlungsseite',
    affectedArea: 'Kaufprozess',
    impact: 'high',
    onScreen: {
      title: '✅ Neue Zahlungsseite aktiv',
      description: 'Nutzer sehen das überarbeitete Checkout-UI mit verbesserter UX und neuer Zahlungslogik.',
      elements: ['💳 Neues Kreditkarten-Widget', '🔒 Sicherheitssiegel sichtbar', '⚡ Schnellkauf-Button', '📦 Bestellübersicht inline'],
    },
    offScreen: {
      title: '○ Alte Zahlungsseite aktiv',
      description: 'Das bestehende Checkout bleibt unverändert für alle Nutzer.',
      elements: ['💳 Altes Zahlungsformular', '📄 Separate Bestellseite', '🔁 Weiterleitung zu Stripe'],
    },
  },
  wirker_marketplace: {
    screenTitle: 'Wirker-Marktplatz',
    affectedArea: 'Navigation / Entdecken',
    impact: 'medium',
    onScreen: {
      title: '✅ Marktplatz sichtbar (nur Wirker)',
      description: 'Wirker sehen in der Navigation einen neuen "Marktplatz"-Tab mit allen angebotenen Leistungen.',
      elements: ['🛍️ Marktplatz-Tab in Navigation', '🔍 Suchfilter für Angebote', '⭐ Wirker-Kacheln', '💬 Direktkontakt-Button'],
    },
    offScreen: {
      title: '○ Marktplatz ausgeblendet',
      description: 'Kein Marktplatz-Tab — Wirker sehen die normale Navigation.',
      elements: ['📱 Standard-Navigation', '🏠 Feed wie bisher'],
    },
  },
  impact_voting_v2: {
    screenTitle: 'Impact-Voting',
    affectedArea: 'Impact-Bereich',
    impact: 'medium',
    onScreen: {
      title: '✅ Neues Voting-System (Members)',
      description: 'Members sehen das neue gewichtete Abstimmungssystem mit visuellen Slidern.',
      elements: ['🗳️ Gewichtungs-Slider', '📊 Live-Ergebnisbalken', '🏅 Member-Badge bei Stimme', '📈 Verlaufsdiagramm'],
    },
    offScreen: {
      title: '○ Altes Voting oder deaktiviert',
      description: 'Members sehen das bisherige Abstimmungsinterface oder keine Voting-Option.',
      elements: ['☑️ Einfacher Ja/Nein-Toggle', '📄 Statische Ergebnisanzeige'],
    },
  },
  stories_feature: {
    screenTitle: 'Stories',
    affectedArea: 'Feed / Home',
    impact: 'medium',
    onScreen: {
      title: '✅ Stories aktiv (alle User)',
      description: 'Oben im Feed erscheint die Stories-Leiste. Nutzer können Stories erstellen und ansehen.',
      elements: ['🟠 Stories-Leiste oben im Feed', '➕ "Story erstellen" Button', '👁️ Story-Viewer', '⏱️ 24h Ablauf-Timer'],
    },
    offScreen: {
      title: '○ Stories ausgeblendet',
      description: 'Keine Stories-Leiste — Feed startet direkt mit Beiträgen.',
      elements: ['📱 Feed ohne Stories', '🔧 Story-Erstellung nicht verfügbar'],
    },
  },
  maintenance_mode: {
    screenTitle: '⚠️ Wartungsseite',
    affectedArea: 'GESAMTE APP',
    impact: 'high',
    onScreen: {
      title: '⚠️ WARTUNGSMODUS — App gesperrt',
      description: 'ALLE Nutzer (außer Admins) sehen sofort die Wartungsseite. Kein Zugriff auf die App.',
      elements: ['🚧 Wartungs-Splash-Screen', '⏰ Geschätzte Wartezeit', '📧 Kontakt-Link', '🔒 Login-Button deaktiviert'],
    },
    offScreen: {
      title: '✅ App läuft normal',
      description: 'Alle Nutzer haben vollen Zugriff auf alle Funktionen.',
      elements: ['✅ Normaler Login', '✅ Voller App-Zugriff', '✅ Alle Features verfügbar'],
    },
  },
  new_onboarding: {
    screenTitle: 'Registrierung / Onboarding',
    affectedArea: 'Registrierungs-Flow',
    impact: 'low',
    onScreen: {
      title: '✅ Neuer Onboarding-Flow',
      description: 'Neue Nutzer durchlaufen den überarbeiteten 5-Schritt-Registrierungsflow.',
      elements: ['👋 Willkommens-Animation', '📸 Profilbild-Upload im Flow', '🎯 Interessen-Auswahl', '🤝 Empfohlene Wirker'],
    },
    offScreen: {
      title: '○ Alter Registrierungsflow',
      description: 'Neue Nutzer sehen den bestehenden Registrierungsprozess.',
      elements: ['📝 Standard-Formular', '✉️ E-Mail-Bestätigung', '🏠 Weiterleitung zum Feed'],
    },
  },
  realtime_chat: {
    screenTitle: 'Echtzeit-Chat',
    affectedArea: 'Nachrichten',
    impact: 'medium',
    onScreen: {
      title: '✅ Echtzeit-Chat aktiv',
      description: 'Nutzer können live über WebSocket chatten — Nachrichten erscheinen sofort.',
      elements: ['💬 Live-Tipp-Indikator ("schreibt…")', '⚡ Sofortige Nachrichtenzustellung', '🟢 Online-Status', '🔔 Push-Benachrichtigung'],
    },
    offScreen: {
      title: '○ Chat deaktiviert',
      description: 'Der Chat-Bereich ist nicht zugänglich. Nachrichten können nicht gesendet werden.',
      elements: ['🔒 Chat-Icon ausgegraut', '📵 "Chat nicht verfügbar" Hinweis'],
    },
  },
  ai_recommendations: {
    screenTitle: 'KI-Empfehlungen',
    affectedArea: 'Feed / Entdecken',
    impact: 'low',
    onScreen: {
      title: '✅ KI-Empfehlungen aktiv',
      description: 'ML-basierte Wirker-Vorschläge erscheinen personalisiert im Feed.',
      elements: ['🤖 "Für dich empfohlen" Sektion', '⭐ Personalisierte Wirker-Kacheln', '📊 Relevanz-Score', '👍 Feedback-Buttons'],
    },
    offScreen: {
      title: '○ Keine KI-Empfehlungen',
      description: 'Feed zeigt Standard-Sortierung ohne personalisierte Vorschläge.',
      elements: ['📱 Chronologischer Feed', '🔍 Standard-Entdecken-Seite'],
    },
  },
};

const IMPACT_COLORS = {
  low:    { color: 'var(--green)',  bg: 'rgba(81,207,102,0.12)', label: 'Geringer Einfluss' },
  medium: { color: 'var(--gold)',   bg: 'rgba(255,184,0,0.12)',  label: 'Mittlerer Einfluss' },
  high:   { color: 'var(--red)',    bg: 'rgba(255,99,99,0.12)',  label: 'Hoher Einfluss' },
};

// ── Info-Texte pro Flag-Key ───────────────────────────────────
const FLAG_INFO: Record<string, { on: string; off: string; hint?: string }> = {
  new_payment_page:  { on: 'Nutzer sehen das überarbeitete Checkout-UI mit neuer Zahlungslogik.', off: 'Das alte Checkout bleibt aktiv — keine Änderung für Nutzer.', hint: '💡 Betrifft alle Käufe auf der Plattform.' },
  wirker_marketplace:{ on: 'Wirker sehen den neuen Marktplatz-Bereich in der App.', off: 'Der Marktplatz ist versteckt — Wirker sehen ihn nicht.', hint: '💡 Nur sichtbar für Nutzer mit Wirker-Status.' },
  impact_voting_v2:  { on: 'Members können mit dem neuen gewichteten Abstimmungssystem abstimmen.', off: 'Das alte Abstimmungssystem oder keine Abstimmung ist aktiv.', hint: '💡 Beeinflusst wie Impact-Punkte vergeben werden.' },
  stories_feature:   { on: 'Alle User sehen den Stories-Bereich — Beiträge können als Story gepostet werden.', off: 'Stories sind komplett ausgeblendet.' },
  maintenance_mode:  { on: '⚠️ ALLE Nutzer landen sofort auf der Wartungsseite!', off: 'Die App läuft normal.', hint: '⚠️ Vorsicht: Sperrt sofort die gesamte Plattform.' },
  new_onboarding:    { on: 'Neue Nutzer sehen den überarbeiteten Onboarding-Flow.', off: 'Der alte Registrierungsflow bleibt aktiv.', hint: '💡 Betrifft nur neue Registrierungen.' },
  realtime_chat:     { on: 'WebSocket-Chat ist aktiv. Nutzer können live chatten.', off: 'Chat-Feature deaktiviert.', hint: '💡 Stabile WebSocket-Verbindung erforderlich.' },
  ai_recommendations:{ on: 'ML-basierte Wirker-Vorschläge werden personalisiert angezeigt.', off: 'Keine KI-Empfehlungen — Standard-Sortierung.', },
};

function CategoryBadge({ cat }: { cat: string }) {
  const colors: Record<string, string> = {
    Features: 'var(--accent)', Zahlung: 'var(--green)', Impact: 'var(--purple)',
    Content: 'var(--gold)', System: 'var(--red)', UX: 'var(--blue)', KI: '#FF6EFF', Custom: 'var(--text-muted)',
  };
  const c = colors[cat] || 'var(--text-muted)';
  return (
    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: `${c}22`, color: c, fontWeight: 700, border: `1px solid ${c}44` }}>{cat}</span>
  );
}

// ── Info Dropdown ─────────────────────────────────────────────
function InfoDropdown({ flagKey, enabled }: { flagKey: string; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const info = FLAG_INFO[flagKey];
  if (!info) return null;
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(p => !p); }}
        title="Was macht dieses Flag?"
        style={{ width: 20, height: 20, borderRadius: '50%', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`, background: open ? 'var(--accent-dim)' : 'var(--bg-tertiary)', color: open ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0, lineHeight: 1, fontFamily: 'var(--font-body)' }}
        onMouseEnter={e => { if (!open) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}}
        onMouseLeave={e => { if (!open) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}}
      >ℹ</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{ position: 'absolute', top: 26, left: '50%', transform: 'translateX(-50%)', width: 260, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', zIndex: 100, padding: 14 }}>
            <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderBottom: 'none', borderRight: 'none', rotate: '45deg' }} />
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'rgba(81,207,102,0.15)', color: 'var(--green)', border: '1px solid rgba(81,207,102,0.3)' }}>● AN</span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.55 }}>{info.on}</p>
            </div>
            <div style={{ marginBottom: info.hint ? 10 : 0, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>○ AUS</span>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{info.off}</p>
            </div>
            {info.hint && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.5, borderLeft: '2px solid var(--accent)' }}>{info.hint}</div>
            )}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Aktuell:</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: enabled ? 'var(--green)' : 'var(--text-muted)' }}>{enabled ? '● Aktiv' : '○ Inaktiv'}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Preview Modal ─────────────────────────────────────────────
function PreviewModal({ flagKey, flag, onClose }: { flagKey: string; flag: Flag; onClose: () => void }) {
  const [simEnabled, setSimEnabled] = useState(flag.enabled);
  const preview = FLAG_PREVIEW[flagKey];
  const screen = simEnabled ? preview?.onScreen : preview?.offScreen;
  const impact = preview ? IMPACT_COLORS[preview.impact] : null;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 620, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.4)', overflow: 'hidden' }}
      >
        {/* Modal Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>👁️ Vorschau — {flag.label}</span>
              <CategoryBadge cat={flag.category} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Betrifft: <strong style={{ color: 'var(--text-secondary)' }}>{preview?.affectedArea || 'App'}</strong>
              {' · '}Zielgruppe: <strong style={{ color: 'var(--text-secondary)' }}>{TARGET_LABELS[flag.target] || flag.target}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Toggle Simulator */}
        <div style={{ padding: '14px 20px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Simuliere wie die App für <strong>{TARGET_LABELS[flag.target] || flag.target}</strong> aussieht:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: simEnabled ? 'var(--green)' : 'var(--text-muted)', fontWeight: 700 }}>
              {simEnabled ? '● AN' : '○ AUS'}
            </span>
            <button
              onClick={() => setSimEnabled(p => !p)}
              style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: simEnabled ? 'var(--green)' : 'var(--bg-secondary)', position: 'relative', transition: 'background 0.2s', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)', flexShrink: 0 }}
            >
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: simEnabled ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
            </button>
            {flag.enabled !== simEnabled && (
              <span style={{ fontSize: 10, color: 'var(--gold)', background: 'rgba(255,184,0,0.12)', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(255,184,0,0.3)', fontWeight: 600 }}>
                ≠ Live-Status
              </span>
            )}
          </div>
        </div>

        {/* Impact Badge */}
        {impact && (
          <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: impact.bg, color: impact.color, border: `1px solid ${impact.color}44` }}>
              ⚡ {impact.label}
            </span>
            {preview && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Bereich: <strong>{preview.screenTitle}</strong></span>
            )}
          </div>
        )}

        {/* Preview Content */}
        <div style={{ padding: 20 }}>
          {preview && screen ? (
            <>
              {/* Phone Mockup */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* Phone frame */}
                <div style={{ flexShrink: 0, width: 180, background: '#0F1117', borderRadius: 24, padding: '10px 8px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', border: '2px solid #2A2A3A' }}>
                  {/* Notch */}
                  <div style={{ width: 60, height: 8, background: '#2A2A3A', borderRadius: 4, margin: '0 auto 8px' }} />
                  {/* Screen */}
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, overflow: 'hidden', minHeight: 220 }}>
                    {/* App Header */}
                    <div style={{ padding: '8px 10px', background: simEnabled && preview.impact === 'high' && flagKey === 'maintenance_mode' ? '#FF6B6B22' : 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#0F1117' }}>H</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>HUI</div>
                      {flagKey === 'maintenance_mode' && simEnabled && (
                        <span style={{ marginLeft: 'auto', fontSize: 8, color: 'var(--red)', fontWeight: 700 }}>⚠ Wartung</span>
                      )}
                    </div>
                    {/* Screen Content */}
                    <div style={{ padding: 10 }}>
                      {flagKey === 'maintenance_mode' && simEnabled ? (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                          <div style={{ fontSize: 24, marginBottom: 6 }}>🚧</div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>Wartungsmodus</div>
                          <div style={{ fontSize: 8, color: 'var(--text-muted)', lineHeight: 1.4 }}>Die App wird gerade gewartet. Bitte später versuchen.</div>
                        </div>
                      ) : (
                        <>
                          {/* Mock elements based on flag */}
                          {flagKey === 'stories_feature' && simEnabled && (
                            <div style={{ display: 'flex', gap: 5, marginBottom: 8, overflowX: 'hidden' }}>
                              {['😊','👤','⭐','🌟'].map((e,i) => (
                                <div key={i} style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: `var(--accent)${i===0?'':'44'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, border: `2px solid ${i===0?'var(--accent)':'transparent'}` }}>{e}</div>
                              ))}
                            </div>
                          )}
                          {/* Generic feed items */}
                          {[1,2,3].map(i => (
                            <div key={i} style={{ padding: '6px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bg-tertiary)', flexShrink: 0 }} />
                              <div>
                                <div style={{ height: 6, width: 60+i*15, background: 'var(--bg-tertiary)', borderRadius: 3, marginBottom: 4 }} />
                                <div style={{ height: 5, width: 40+i*10, background: 'var(--border)', borderRadius: 3 }} />
                              </div>
                              {flagKey === 'ai_recommendations' && simEnabled && i === 1 && (
                                <div style={{ marginLeft: 'auto', fontSize: 7, color: '#FF6EFF', fontWeight: 700 }}>✨ KI</div>
                              )}
                            </div>
                          ))}
                          {/* Chat indicator */}
                          {flagKey === 'realtime_chat' && (
                            <div style={{ marginTop: 8, padding: '5px 8px', background: simEnabled ? 'rgba(78,205,196,0.1)' : 'var(--bg-tertiary)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: 10 }}>💬</span>
                              <div style={{ height: 5, width: 50, background: simEnabled ? 'var(--accent)' : 'var(--border)', borderRadius: 3 }} />
                              {simEnabled && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', marginLeft: 'auto' }} />}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {/* Home indicator */}
                  <div style={{ width: 40, height: 3, background: '#2A2A3A', borderRadius: 2, margin: '8px auto 0' }} />
                </div>

                {/* Details */}
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: simEnabled ? 'var(--green)' : 'var(--text-muted)', marginBottom: 6 }}>{screen.title}</div>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{screen.description}</p>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>UI-Elemente</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {screen.elements.map((el, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)' }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: simEnabled ? 'var(--green)' : 'var(--text-muted)', flexShrink: 0 }} />
                          {el}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* No preview available notice */}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔧</div>
              <div style={{ fontSize: 12 }}>Für dieses Flag ist noch keine Vorschau hinterlegt.</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Beschreibung: {flag.description}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            🔑 Key: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{flagKey}</code>
            {' · '}Live-Status: <strong style={{ color: flag.enabled ? 'var(--green)' : 'var(--text-muted)' }}>{flag.enabled ? 'AN' : 'AUS'}</strong>
          </div>
          <button onClick={onClose} style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)' }}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function FlagsPage() {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role;
  const [flags, setFlags]             = useState<Flags>({});
  const [loading, setLoading]         = useState(true);
  const [toggling, setToggling]       = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate]   = useState(false);
  const [filterCat, setFilterCat]     = useState('all');
  const [previewFlag, setPreviewFlag] = useState<string | null>(null);
  const [newFlag, setNewFlag]         = useState({ key: '', label: '', description: '', target: 'all', category: 'Custom' });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/flags').then(r => r.json()).catch(() => ({}));
    setFlags(res || {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (key: string, val: boolean) => {
    setToggling(p => ({ ...p, [key]: true }));
    setFlags(p => ({ ...p, [key]: { ...p[key], enabled: val } }));
    const res = await fetch('/api/flags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', flagKey: key, value: val }),
    });
    if (!res.ok) {
      setFlags(p => ({ ...p, [key]: { ...p[key], enabled: !val } }));
      showToast('Fehler beim Speichern', 'error');
    } else {
      showToast(val ? `✅ "${flags[key]?.label}" aktiviert` : `🔴 "${flags[key]?.label}" deaktiviert`, 'info');
    }
    setToggling(p => ({ ...p, [key]: false }));
  };

  const deleteFlag = async (key: string) => {
    if (!confirm(`Flag "${flags[key]?.label}" wirklich löschen?`)) return;
    const res = await fetch('/api/flags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', flagKey: key }),
    });
    if (res.ok) { showToast('Flag gelöscht', 'info'); load(); }
    else showToast('Fehler', 'error');
  };

  const createFlag = async () => {
    if (!newFlag.key || !newFlag.label) { showToast('Key und Label erforderlich', 'error'); return; }
    const res = await fetch('/api/flags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', newFlag }),
    });
    if (res.ok) {
      showToast('Flag erstellt', 'success');
      setNewFlag({ key: '', label: '', description: '', target: 'all', category: 'Custom' });
      setShowCreate(false);
      load();
    } else showToast('Fehler', 'error');
  };

  const resetDefaults = async () => {
    if (!confirm('Alle Flags auf Standard zurücksetzen?')) return;
    const res = await fetch('/api/flags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    });
    if (res.ok) { showToast('Zurückgesetzt', 'info'); load(); }
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '8px 11px', background: 'var(--bg-primary)',
    border: '1px solid var(--border)', borderRadius: 8, fontSize: 12,
    color: 'var(--text-primary)', fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
  };

  const entries = Object.entries(flags);
  const categories = ['all', ...Array.from(new Set(entries.map(([, f]) => f.category)))];
  const filtered = filterCat === 'all' ? entries : entries.filter(([, f]) => f.category === filterCat);
  const enabledCount  = entries.filter(([, f]) => f.enabled).length;
  const disabledCount = entries.length - enabledCount;

  const Switch = ({ on, disabled: dis, onChange }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => !dis && onChange(!on)}
      disabled={dis}
      style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: dis ? 'default' : 'pointer', background: on ? 'var(--green)' : 'var(--bg-tertiary)', position: 'relative', flexShrink: 0, transition: 'background 0.2s', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)' }}
      aria-checked={on} role="switch"
    >
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </button>
  );

  return (
    <DashboardLayout
      title="Feature-Flags"
      headerActions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          
      <PageHeader
        title="Feature-Flags"
        subtitle="Plattform-Features steuern"
        actionsRole="superadmin"
        userRole={userRole}
      />

<span style={{ fontSize: 11, color: 'var(--green)', background: 'var(--green-dim)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--green)', fontWeight: 600 }}>✅ {enabledCount} aktiv</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)' }}>🔴 {disabledCount} inaktiv</span>
          <button onClick={() => setShowCreate(p => !p)} style={{ padding: '5px 12px', background: 'var(--accent)', border: 'none', borderRadius: 8, fontSize: 11, color: '#0F1117', cursor: 'pointer', fontWeight: 700, fontFamily: 'var(--font-body)' }}>+ Flag</button>
          <button onClick={resetDefaults} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↺ Reset</button>
          <button onClick={load} style={{ padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>↻</button>
        </div>
      }
    >
      <div style={{ padding: '10px 16px', background: 'rgba(78,205,196,0.06)', border: '1px solid rgba(78,205,196,0.2)', borderRadius: 10, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--accent)' }}>ℹ️ Feature-Flags</strong> — Schalte App-Funktionen ohne Code-Deploy ein/aus. Klicke auf <strong>👁️</strong> für eine Vorschau, auf <strong>ℹ</strong> für Details.
      </div>

      {showCreate && (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>➕ Neues Feature-Flag</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>Key (snake_case)</label>
              <input value={newFlag.key} onChange={e => setNewFlag(p => ({ ...p, key: e.target.value.replace(/\s/g,'_').toLowerCase() }))} placeholder="z.B. new_feature_xyz" style={input} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>Label</label>
              <input value={newFlag.label} onChange={e => setNewFlag(p => ({ ...p, label: e.target.value }))} placeholder="z.B. Neue Feature XYZ" style={input} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>Zielgruppe</label>
              <select value={newFlag.target} onChange={e => setNewFlag(p => ({ ...p, target: e.target.value }))} style={input}>
                {TARGET_OPTIONS.map(t => <option key={t} value={t}>{TARGET_LABELS[t] || t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>Kategorie</label>
              <select value={newFlag.category} onChange={e => setNewFlag(p => ({ ...p, category: e.target.value }))} style={input}>
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: 4 }}>Beschreibung</label>
            <input value={newFlag.description} onChange={e => setNewFlag(p => ({ ...p, description: e.target.value }))} placeholder="Was macht dieses Flag?" style={input} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowCreate(false)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)' }}>Abbrechen</button>
            <button onClick={createFlag} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0F1117', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-body)' }}>Flag erstellen</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {categories.map(c => (
          <button key={c} onClick={() => setFilterCat(c)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid', borderColor: filterCat === c ? 'var(--accent)' : 'var(--border)', background: filterCat === c ? 'var(--accent-dim)' : 'transparent', color: filterCat === c ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
            {c === 'all' ? `Alle (${entries.length})` : c}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Lade Flags…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {filtered.map(([key, flag]) => (
            <div key={key} style={{ background: 'var(--bg-secondary)', border: `1px solid ${flag.enabled ? 'rgba(81,207,102,0.25)' : 'var(--border)'}`, borderLeft: `3px solid ${flag.enabled ? 'var(--green)' : 'var(--border-strong)'}`, borderRadius: 12, padding: 16, transition: 'all 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{flag.label}</span>
                    <CategoryBadge cat={flag.category} />
                    <InfoDropdown flagKey={key} enabled={flag.enabled} />
                  </div>
                  {flag.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{flag.description}</div>
                  )}
                </div>
                <Switch on={flag.enabled} disabled={toggling[key]} onChange={v => toggle(key, v)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>{key}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>{TARGET_LABELS[flag.target] || flag.target}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: flag.enabled ? 'var(--green)' : 'var(--text-muted)' }}>{flag.enabled ? '● AN' : '○ AUS'}</span>
                  {/* Preview Button */}
                  <button
                    onClick={() => setPreviewFlag(key)}
                    title="Vorschau anzeigen"
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: '1px 6px', lineHeight: 1.5, fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                  >👁️</button>
                  <button
                    onClick={() => deleteFlag(key)}
                    title="Flag löschen"
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
                    onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--red)')}
                    onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
                  >🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewFlag && flags[previewFlag] && (
        <PreviewModal
          flagKey={previewFlag}
          flag={flags[previewFlag]}
          onClose={() => setPreviewFlag(null)}
        />
      )}
    </DashboardLayout>
  );
}
