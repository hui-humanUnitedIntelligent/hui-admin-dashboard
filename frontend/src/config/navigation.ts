// frontend/src/config/navigation.ts
// ── HUI Admin Dashboard — Zentrale Navigations-Konfiguration ─────────────────
// Einzige Source of Truth für alle Nav-Items, Labels und Zugriffsrechte.
// Wird von Sidebar.tsx und EmployeeSidebar.tsx verwendet.

export interface NavItem {
  href: string;
  label_de: string;
  label_en: string;
  icon: string;
  /** Nur sichtbar für Nutzer mit Rolle super_admin / superadmin */
  superadminOnly?: boolean;
}

export interface NavGroup {
  id: string;
  label_de: string;
  label_en: string;
  icon: string;
  items: NavItem[];
}

// ── Admin-Dashboard Navigation ────────────────────────────────────────────────
export const ADMIN_NAV: NavGroup[] = [
  {
    id: 'management',
    label_de: 'Management',
    label_en: 'Management',
    icon: '◎',
    items: [
      { href: '/users',        label_de: 'User-Management',  label_en: 'User Management',  icon: '👥' },
      { href: '/admins',       label_de: 'Admin-Verwaltung', label_en: 'Admin Management', icon: '🛡️', superadminOnly: true },
      { href: '/ambassadors',  label_de: 'Ambassadors',      label_en: 'Ambassadors',      icon: '🤝' },
      { href: '/talents',      label_de: 'Talent-Pool',      label_en: 'Talent Pool',      icon: '⭐' },
      { href: '/transactions', label_de: 'Transaktionen',    label_en: 'Transactions',     icon: '⇄'  },
      { href: '/bookings',     label_de: 'Buchungen',        label_en: 'Bookings',         icon: '📅' },
      { href: '/impact',       label_de: 'Impact Pool',      label_en: 'Impact Pool',      icon: '🌱', superadminOnly: true },
      { href: '/reviews',      label_de: 'Reviews',          label_en: 'Reviews',          icon: '💬' },
    ],
  },
  {
    id: 'content',
    label_de: 'Content',
    label_en: 'Content',
    icon: '🎨',
    items: [
      { href: '/works',           label_de: 'Werke & Content',              label_en: 'Works & Content',           icon: '🖼️' },
      { href: '/experiences',     label_de: 'Erlebnisse & Projekte',        label_en: 'Experiences & Projects',    icon: '🌿' },
      { href: '/impact-projekte', label_de: 'Impact Projekte',              label_en: 'Impact Projects',           icon: '💚', superadminOnly: true },
      { href: '/score-failures',  label_de: 'Vordef. Ablehnungsgründe',     label_en: 'Predefined Rejection Reasons', icon: '🔍', superadminOnly: true },
      { href: '/memberships',     label_de: 'Mitgliedschaften',             label_en: 'Memberships',               icon: '🏅' },
    ],
  },
  {
    id: 'tools',
    label_de: 'Tools',
    label_en: 'Tools',
    icon: '🛠️',
    items: [
      { href: '/analytics', label_de: 'Analytics',        label_en: 'Analytics',        icon: '📈', superadminOnly: true },
      { href: '/broadcast', label_de: 'Broadcast',        label_en: 'Broadcast',        icon: '📨', superadminOnly: true },
      { href: '/tickets',   label_de: 'Support-Tickets',  label_en: 'Support Tickets',  icon: '🎫' },
      { href: '/reports',   label_de: 'Reports',          label_en: 'Reports',          icon: '📊' },
      { href: '/flags',     label_de: 'Feature-Flags',    label_en: 'Feature Flags',    icon: '🚩', superadminOnly: true },
      { href: '/churns',    label_de: 'Churns & Kündig.', label_en: 'Churns',           icon: '📉' },
    ],
  },
  {
    id: 'system',
    label_de: 'System',
    label_en: 'System',
    icon: '🔧',
    items: [
      { href: '/audit',    label_de: 'Audit Logs',    label_en: 'Audit Logs',    icon: '📋', superadminOnly: true },
      { href: '/system',   label_de: 'System Status', label_en: 'System Status', icon: '🔧' },
      { href: '/exports',  label_de: 'Daten-Export',  label_en: 'Data Export',   icon: '📥', superadminOnly: true },
      { href: '/settings', label_de: 'Einstellungen', label_en: 'Settings',      icon: '⚙️' },
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
      { href: '/employee/users',        label_de: 'User-Management',       label_en: 'User Management',       icon: '👥' },
      { href: '/employee/ambassadors',  label_de: 'Ambassadors',           label_en: 'Ambassadors',           icon: '🤝' },
      { href: '/employee/talents',      label_de: 'Talent-Pool',           label_en: 'Talent Pool',           icon: '⭐' },
      { href: '/employee/transactions', label_de: 'Transaktionen',         label_en: 'Transactions',          icon: '⇄'  },
      { href: '/employee/bookings',     label_de: 'Buchungen',             label_en: 'Bookings',              icon: '📅' },
    ],
  },
  {
    id: 'content',
    label_de: 'Content',
    label_en: 'Content',
    icon: '🎨',
    items: [
      { href: '/employee/works',        label_de: 'Werke & Content',       label_en: 'Works & Content',       icon: '🖼️' },
      { href: '/employee/experiences',  label_de: 'Erlebnisse & Projekte', label_en: 'Experiences & Projects',icon: '🌿' },
      { href: '/employee/memberships',  label_de: 'Mitgliedschaften',      label_en: 'Memberships',           icon: '🏅' },
    ],
  },
  {
    id: 'tools',
    label_de: 'Tools',
    label_en: 'Tools',
    icon: '🛠️',
    items: [
      { href: '/employee/reports', label_de: 'Reports',          label_en: 'Reports', icon: '📊' },
      { href: '/employee/churns',  label_de: 'Churns & Kündig.', label_en: 'Churns',  icon: '📉' },
    ],
  },
  {
    id: 'system',
    label_de: 'System',
    label_en: 'System',
    icon: '🔧',
    items: [
      { href: '/employee/settings', label_de: 'Einstellungen', label_en: 'Settings', icon: '⚙️' },
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
  const isSuperAdmin = role === 'super_admin' || role === 'superadmin';
  return items.filter(item => !item.superadminOnly || isSuperAdmin);
}
