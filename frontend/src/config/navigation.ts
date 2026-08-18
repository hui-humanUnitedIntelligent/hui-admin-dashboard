// frontend/src/config/navigation.ts
// ── HUI Admin Dashboard — Zentrale Navigations-Konfiguration ─────────────────
// Einzige Source of Truth für alle Nav-Items, Labels und Zugriffsrechte.
// Wird von Sidebar.tsx, EmployeeSidebar.tsx und AdminNavigation.tsx verwendet.

export type NavRole = 'superadmin' | 'employee';

export interface NavItem {
  href:         string;
  label_de:     string;
  label_en:     string;
  icon:         string;
  /** Rollen die diesen Eintrag sehen dürfen */
  roles:        NavRole[];
  /** @deprecated — nutze roles stattdessen */
  superadminOnly?: boolean;
}

export interface NavGroup {
  id:       string;
  label_de: string;
  label_en: string;
  icon:     string;
  items:    NavItem[];
}

// ── Admin-Dashboard Navigation ────────────────────────────────────────────────
export const ADMIN_NAV: NavGroup[] = [
  {
    id: 'management',
    label_de: 'Management',
    label_en: 'Management',
    icon: '◎',
    items: [
      { href: '/users',        label_de: 'User-Management',  label_en: 'User Management',  icon: '👥', roles: ['superadmin'] },
      { href: '/employees', label_de: 'Employees', label_en: 'Employees', icon: '👤', roles: ['superadmin'] },
  { href: '/admins',       label_de: 'Admin-Verwaltung', label_en: 'Admin Management', icon: '🛡️', roles: ['superadmin'], superadminOnly: true },
      { href: '/ambassadors',  label_de: 'Ambassadors',      label_en: 'Ambassadors',      icon: '🤝', roles: ['superadmin'], superadminOnly: true },
      { href: '/talents',      label_de: 'Talent-Pool',      label_en: 'Talent Pool',      icon: '⭐', roles: ['superadmin'] },
      { href: '/transactions', label_de: 'Transaktionen',    label_en: 'Transactions',     icon: '⇄',  roles: ['superadmin'] },
      { href: '/bookings',     label_de: 'Buchungen',        label_en: 'Bookings',         icon: '📅', roles: ['superadmin'] },
      { href: '/escrow',       label_de: 'Treuhand',         label_en: 'Escrow',           icon: '🔒', roles: ['superadmin'] },
      { href: '/impact',       label_de: 'Impact Pool',      label_en: 'Impact Pool',      icon: '🌱', roles: ['superadmin'], superadminOnly: true },
      { href: '/finance',      label_de: 'Finanzen',         label_en: 'Finance',          icon: '💶', roles: ['superadmin'], superadminOnly: true },
      { href: '/stripe', label_de: 'Stripe', label_en: 'Stripe', icon: '💳', roles: ['superadmin'], superadminOnly: true },
      // ARCHIVIERT (2026-07-04, Michael): 'App Review' (/reviews) wird nicht mehr benoetigt --
      // aus der Navigation entfernt, Route/Daten bewusst NICHT geloescht. Nur bei einer spaeteren
      // Bereinigungsrunde nach Rueckfrage entfernen, nicht jetzt.
      // { href: '/reviews', label_de: 'App Review', label_en: 'App Review', icon: '💬', roles: ['superadmin'] },
      { href: '/website-reviews', label_de: 'Webseite Review',   label_en: 'Website Review',    icon: '🌐', roles: ['superadmin'] },
    ],
  },
  {
    id: 'content',
    label_de: 'Content',
    label_en: 'Content',
    icon: '🎨',
    items: [
      { href: '/works',           label_de: 'Werke',                     label_en: 'Works',                  icon: '🖼️', roles: ['superadmin'] },
      { href: '/talent-offers',    label_de: 'Talente',                   label_en: 'Talents',                icon: '💼', roles: ['superadmin'] },
      { href: '/experiences',     label_de: 'Erlebnisse & Projekte',     label_en: 'Experiences & Projects', icon: '🌿', roles: ['superadmin'] },
      { href: '/momente',         label_de: 'Momente',                   label_en: 'Moments',                icon: '💬', roles: ['superadmin'] },
      { href: '/impact-projekte', label_de: 'Impact Projekte',           label_en: 'Impact Projects',        icon: '💚', roles: ['superadmin'], superadminOnly: true },
      { href: '/score-failures',  label_de: 'Ablehnungsgründe',          label_en: 'Rejection Reasons',      icon: '🔍', roles: ['superadmin'], superadminOnly: true },
      { href: '/memberships',     label_de: 'Mitgliedschaften',          label_en: 'Memberships',            icon: '🏅', roles: ['superadmin'] },
    ],
  },
  {
    id: 'tools',
    label_de: 'Tools',
    label_en: 'Tools',
    icon: '🛠️',
    items: [
      { href: '/analytics', label_de: 'Analytics',       label_en: 'Analytics',       icon: '📈', roles: ['superadmin'], superadminOnly: true },
      { href: '/broadcast', label_de: 'Broadcast',       label_en: 'Broadcast',       icon: '📨', roles: ['superadmin'], superadminOnly: true },
      { href: '/tickets',   label_de: 'Support-Tickets', label_en: 'Support Tickets', icon: '🎫', roles: ['superadmin'] },
      { href: '/reports',   label_de: 'Reports',         label_en: 'Reports',         icon: '📊', roles: ['superadmin'] },
      { href: '/recommendation-reports', label_de: 'Meldungen', label_en: 'Recommendation Reports', icon: '⚠️', roles: ['superadmin'] },
      { href: '/flags',     label_de: 'Funktionsschalter',   label_en: 'Feature Flags',   icon: '🚩', roles: ['superadmin'], superadminOnly: true },
      { href: '/churns',    label_de: 'Kündigungen',label_en: 'Churns',          icon: '📉', roles: ['superadmin'] },
    ],
  },
  {
    id: 'system',
    label_de: 'System',
    label_en: 'System',
    icon: '🔧',
    items: [
      { href: '/audit',    label_de: 'Audit Logs',    label_en: 'Audit Logs',    icon: '📋', roles: ['superadmin'], superadminOnly: true },
      { href: '/system',   label_de: 'System Status', label_en: 'System Status', icon: '🔧', roles: ['superadmin'], superadminOnly: true },
      { href: '/exports',  label_de: 'Daten-Export',  label_en: 'Data Export',   icon: '📥', roles: ['superadmin'], superadminOnly: true },
      { href: '/settings', label_de: 'Einstellungen', label_en: 'Settings',      icon: '⚙️', roles: ['superadmin'] },
    ],
  },
];

// ── Employee Portal Navigation ────────────────────────────────────────────────
export const EMPLOYEE_NAV: NavGroup[] = [
  {
    id: 'management',
    label_de: 'Management',
    label_en: 'Management',
    icon: '◎',
    items: [
      { href: '/employee/users',        label_de: 'User-Management',       label_en: 'User Management',       icon: '👥', roles: ['superadmin', 'employee'] },
      { href: '/employee/tickets',      label_de: 'Support-Tickets',       label_en: 'Support Tickets',       icon: '🎫', roles: ['superadmin', 'employee'] },
      { href: '/employee/recommendation-reports', label_de: 'Meldungen', label_en: 'Recommendation Reports', icon: '⚠️', roles: ['superadmin', 'employee'] },
      { href: '/employee/payouts',    label_de: 'Auszahlungen',   label_en: 'Payouts',      icon: '💸', roles: ['superadmin','employee'] },
    { href: '/employee/ambassadors',  label_de: 'Ambassadors',           label_en: 'Ambassadors',           icon: '🤝', roles: ['superadmin'] },
      { href: '/employee/talents',      label_de: 'Talent-Pool',           label_en: 'Talent Pool',           icon: '⭐', roles: ['superadmin'] },
      { href: '/employee/transactions', label_de: 'Transaktionen',         label_en: 'Transactions',          icon: '⇄',  roles: ['superadmin'] },
      { href: '/employee/bookings',     label_de: 'Buchungen',             label_en: 'Bookings',              icon: '📅', roles: ['superadmin'] },
    ],
  },
  {
    id: 'content',
    label_de: 'Content',
    label_en: 'Content',
    icon: '🎨',
    items: [
      { href: '/employee/works',        label_de: 'Werke',                 label_en: 'Works',                  icon: '🖼️', roles: ['superadmin', 'employee'] },
      { href: '/employee/talent-offers', label_de: 'Talente',               label_en: 'Talents',                 icon: '💼', roles: ['superadmin', 'employee'] },
      { href: '/employee/experiences',  label_de: 'Erlebnisse & Projekte', label_en: 'Experiences & Projects', icon: '🌿', roles: ['superadmin', 'employee'] },
      { href: '/employee/memberships',  label_de: 'Mitgliedschaften',      label_en: 'Memberships',            icon: '🏅', roles: ['superadmin', 'employee'] },
      { href: '/employee/impact',        label_de: 'Impact Projekte',       label_en: 'Impact Projects',        icon: '🌿', roles: ['superadmin', 'employee'] },
      { href: '/employee/impact-voting', label_de: 'Impact Voting',         label_en: 'Impact Voting',          icon: '🗳️', roles: ['superadmin', 'employee'] },
      { href: '/employee/reasons',      label_de: 'Ablehnungsgründe',      label_en: 'Rejection Reasons',      icon: '📋', roles: ['superadmin', 'employee'] },
    ],
  },
  {
    id: 'tools',
    label_de: 'Tools',
    label_en: 'Tools',
    icon: '🛠️',
    items: [
      { href: '/employee/reports', label_de: 'Reports',          label_en: 'Reports', icon: '📊', roles: ['superadmin'] },
      { href: '/employee/churns',  label_de: 'Kündigungen', label_en: 'Churns',  icon: '📉', roles: ['superadmin'] },
    ],
  },
  {
    id: 'system',
    label_de: 'System',
    label_en: 'System',
    icon: '🔧',
    items: [
      { href: '/employee/settings', label_de: 'Einstellungen', label_en: 'Settings', icon: '⚙️', roles: ['superadmin'] },
    ],
  },
];

/** Gibt das Label in der gewünschten Sprache zurück */
export function navLabel(item: { label_de: string; label_en: string }, lang: string): string {
  return lang === 'en' ? item.label_en : item.label_de;
}

/** Gibt das Group-Label in der gewünschten Sprache zurück */
export function groupLabel(group: NavGroup, lang: string): string {
  return lang === 'en' ? group.label_en : group.label_de;
}

/** Filtert Items basierend auf der Nutzerrolle */
export function filterItems(items: NavItem[], role: string | undefined): NavItem[] {
  const isSuperAdmin = role === 'super_admin' || role === 'superadmin' || role === 'admin';
  const navRole: NavRole = isSuperAdmin ? 'superadmin' : 'employee';
  return items.filter(item => item.roles.includes(navRole));
}

/** Filtert Gruppen — entfernt Gruppen ohne sichtbare Items */
export function filterGroups(groups: NavGroup[], role: string | undefined): NavGroup[] {
  return groups
    .map(g => ({ ...g, items: filterItems(g.items, role) }))
    .filter(g => g.items.length > 0);
}
