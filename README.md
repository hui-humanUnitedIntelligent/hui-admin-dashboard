# HUI Admin Dashboard v2.0 — Live

> Vollständiges, live-aktualisiertes Admin-Dashboard für die HUI-Plattform.  
> Alle Daten direkt aus Supabase — kein Demo-Modus.

---

## 🚀 Setup

### 1. Environment Variables setzen

Erstelle `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Oder in Vercel → **Settings → Environment Variables**.

### 2. Frontend starten

```bash
cd frontend
npm install
npm run dev
```

→ http://localhost:3000

---

## 📋 Module

| Seite | Route | Datenquelle |
|-------|-------|-------------|
| Dashboard | `/dashboard` | profiles, payments, works |
| User-Management | `/users` | profiles |
| Talent-Pool | `/talents` | profiles (is_wirker=true) |
| Transaktionen | `/transactions` | payments |
| Buchungen | `/bookings` | bookings |
| Impact Pool | `/impact` | impact_projects, payments |
| Works & Content | `/works` | works |
| Mitgliedschaften | `/memberships` | memberships |
| Audit Logs | `/audit` | notifications / auth_events |
| System Status | `/system` | Live health checks |
| Einstellungen | `/settings` | Config |

---

## ⚡ Live-Daten

- Auto-Refresh alle **30 Sekunden** (konfigurierbar)
- Direkte **Supabase REST API** Abfragen
- Kein Demo-Modus — echte Produktionsdaten
- Pagination für große Datensätze

---

## 🔐 Auth

Login mit dem **Supabase-Account** der HUI-App.  
Oder mit dem Legacy-Backend (falls `NEXT_PUBLIC_API_URL` gesetzt).

---

## 🏗 Architektur

```
frontend/src/
├── app/                    # Next.js App Router Pages
│   ├── dashboard/          # KPI Overview
│   ├── users/              # User Management
│   ├── talents/            # Wirker / Talent Pool
│   ├── transactions/       # Payments
│   ├── bookings/           # Buchungen
│   ├── impact/             # Impact Pool
│   ├── works/              # Content
│   ├── memberships/        # Mitgliedschaften
│   ├── audit/              # Audit Logs
│   ├── system/             # System Health
│   └── settings/           # Config
├── components/
│   ├── layout/             # Sidebar, Header, DashboardLayout
│   └── ui/                 # Badge, Button, KPICard, Modal, Toast
└── lib/
    ├── api.ts              # Supabase REST + legacy axios client
    └── hooks/
        ├── useSupabase.ts  # All live data hooks
        └── useAuth.ts      # Authentication
```
