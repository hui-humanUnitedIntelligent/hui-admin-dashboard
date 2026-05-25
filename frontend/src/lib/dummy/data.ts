// ── Types ──────────────────────────────────────────────────────────────────
export type UserRole = 'Talent' | 'User' | 'Moderator';
export type UserStatus = 'active' | 'suspended';
export type TxStatus = 'completed' | 'pending' | 'failed';
export type TxType = 'Buchung' | 'Auszahlung' | 'Einzahlung' | 'Impact-Beitrag';

export interface DummyUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  city: string;
  createdAt: string;
  bookings: number;
  revenue: number;
}

export interface DummyTransaction {
  id: string;
  userId: number;
  userName: string;
  amount: number;
  type: TxType;
  status: TxStatus;
  date: string;
}

export interface DummyProject {
  id: number;
  name: string;
  icon: string;
  color: string;
  progress: number;
  amount: number;
  description: string;
}

// ── Users ──────────────────────────────────────────────────────────────────
export const DUMMY_USERS: DummyUser[] = [
  { id: 1,  name: 'Sara Müller',    email: 'sara@example.de',    role: 'Talent',    status: 'active',    city: 'Berlin',     createdAt: '2025-01-12', bookings: 24, revenue: 1840 },
  { id: 2,  name: 'Luca Bianchi',   email: 'luca@example.it',    role: 'User',      status: 'active',    city: 'Wien',       createdAt: '2025-02-03', bookings: 8,  revenue: 420  },
  { id: 3,  name: 'Aisha Kofi',     email: 'aisha@example.com',  role: 'Talent',    status: 'active',    city: 'Köln',       createdAt: '2025-02-19', bookings: 31, revenue: 2760 },
  { id: 4,  name: 'Felix Schmid',   email: 'felix@example.de',   role: 'User',      status: 'suspended', city: 'München',    createdAt: '2025-03-05', bookings: 2,  revenue: 80   },
  { id: 5,  name: 'Elena Rossi',    email: 'elena@example.it',   role: 'Talent',    status: 'active',    city: 'Hamburg',    createdAt: '2025-03-22', bookings: 17, revenue: 1340 },
  { id: 6,  name: 'Jonas Weber',    email: 'jonas@example.de',   role: 'Moderator', status: 'active',    city: 'Frankfurt',  createdAt: '2025-04-01', bookings: 0,  revenue: 0    },
  { id: 7,  name: 'Priya Nair',     email: 'priya@example.in',   role: 'Talent',    status: 'active',    city: 'Stuttgart',  createdAt: '2025-04-08', bookings: 42, revenue: 3980 },
  { id: 8,  name: 'Tom Hansen',     email: 'tom@example.dk',     role: 'User',      status: 'suspended', city: 'Düsseldorf', createdAt: '2025-04-14', bookings: 5,  revenue: 210  },
  { id: 9,  name: 'Mia Vogel',      email: 'mia@example.de',     role: 'Talent',    status: 'active',    city: 'Leipzig',    createdAt: '2025-04-20', bookings: 19, revenue: 1620 },
  { id: 10, name: 'Carlos Vega',    email: 'carlos@example.es',  role: 'User',      status: 'active',    city: 'Nürnberg',   createdAt: '2025-04-29', bookings: 11, revenue: 590  },
  { id: 11, name: 'Anna Kruse',     email: 'anna@example.de',    role: 'Talent',    status: 'active',    city: 'Dresden',    createdAt: '2025-05-02', bookings: 28, revenue: 2200 },
  { id: 12, name: 'David Park',     email: 'david@example.kr',   role: 'User',      status: 'active',    city: 'Bremen',     createdAt: '2025-05-10', bookings: 6,  revenue: 310  },
];

// ── Transactions ───────────────────────────────────────────────────────────
const TYPES: TxType[]   = ['Buchung', 'Auszahlung', 'Einzahlung', 'Impact-Beitrag'];
const STATUSES: TxStatus[] = ['completed', 'completed', 'completed', 'pending', 'failed'];

export const DUMMY_TRANSACTIONS: DummyTransaction[] = Array.from(
  { length: 40 },
  (_, i) => {
    const user = DUMMY_USERS[i % DUMMY_USERS.length];
    const daysAgo = Math.floor(i * 1.8);
    const d = new Date(2025, 4, 25 - daysAgo);
    return {
      id: `TX-${1000 + i}`,
      userId: user.id,
      userName: user.name,
      amount: parseFloat((Math.random() * 280 + 15).toFixed(2)),
      type: TYPES[i % TYPES.length],
      status: STATUSES[i % STATUSES.length],
      date: d.toLocaleDateString('de-DE'),
    };
  }
);

// ── Dashboard KPIs ─────────────────────────────────────────────────────────
export const DUMMY_KPIS = {
  totalUsers:      4812,
  userDelta:       '+12.4%',
  monthlyRevenue:  28640,
  revenueDelta:    '+8.1%',
  impactPool:      9247,
  impactDelta:     '+23.7%',
  activeTalents:   1347,
  talentDelta:     '-3.2%',
};

export const DUMMY_GROWTH = {
  labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai'],
  newUsers: [180, 210, 255, 290, 340, 370, 420, 460, 510, 560, 610, 648],
  activeUsers: [320, 380, 430, 480, 530, 570, 620, 670, 720, 770, 810, 850],
};

export const DUMMY_TX_CHART = {
  labels: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  values: [48, 72, 61, 89, 94, 43, 55],
};

// ── Impact Pool ────────────────────────────────────────────────────────────
export const DUMMY_IMPACT = {
  balance: 9247,
  monthlyDeposits: 2840,
  monthlyWithdrawals: 1120,
  projectsSupported: 14,
  history: {
    labels: ['Dez', 'Jan', 'Feb', 'Mär', 'Apr', 'Mai'],
    deposits:    [1200, 1540, 1820, 2100, 2480, 2840],
    withdrawals: [600,  740,  880,  960,  1050, 1120],
  },
};

export const DUMMY_PROJECTS: DummyProject[] = [
  { id: 1, name: 'Bildung für alle',     icon: '🎓', color: '#4ECDC4', progress: 72, amount: 2100, description: 'Bildungszugang für benachteiligte Gruppen' },
  { id: 2, name: 'Klimaschutz Lokal',    icon: '🌿', color: '#51CF66', progress: 45, amount: 1540, description: 'Lokale Klimaschutzprojekte in der Gemeinschaft' },
  { id: 3, name: 'Kunst & Gemeinschaft', icon: '🎨', color: '#B197FC', progress: 88, amount: 3200, description: 'Kulturprojekte und kreative Gemeinschaftsräume' },
  { id: 4, name: 'Mentoring-Netzwerk',   icon: '🤝', color: '#F7B731', progress: 33, amount: 980,  description: 'Peer-Mentoring für junge Talente' },
  { id: 5, name: 'Digitale Teilhabe',    icon: '💻', color: '#74C0FC', progress: 60, amount: 1427, description: 'Digitale Kompetenzen für alle Altersgruppen' },
];

// ── Activity Feed ──────────────────────────────────────────────────────────
export const DUMMY_FEED = [
  { color: '#4ECDC4', text: 'Aisha Kofi hat ein neues Talent-Profil veröffentlicht', time: 'vor 3 min',  type: 'user' },
  { color: '#F7B731', text: 'Neue Transaktion TX-1028 · €89.50 ausstehend',          time: 'vor 11 min', type: 'transaction' },
  { color: '#51CF66', text: 'Impact Pool: Einzahlung von €140 verbucht',              time: 'vor 28 min', type: 'impact' },
  { color: '#B197FC', text: 'Jonas Weber als Moderator bestätigt',                    time: 'vor 1 Std',  type: 'user' },
  { color: '#FF6B6B', text: 'Login-Fehler für felix@example.de (3×)',                 time: 'vor 2 Std',  type: 'security' },
  { color: '#74C0FC', text: 'Priya Nair: Buchung #847 abgeschlossen',                 time: 'vor 3 Std',  type: 'booking' },
];
