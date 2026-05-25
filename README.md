# HUI Admin Dashboard

> Vollständig isoliertes Admin-Dashboard für die HUI-Plattform.
> Kein Verweis auf öffentliche Webseiten. Einstiegspunkt: `admin.html`.

---

## Inhaltsverzeichnis

1. [Architektur-Übersicht](#architektur)
2. [Lokale Entwicklung](#lokal)
3. [Deployment — Frontend (Vercel)](#vercel)
4. [Deployment — Backend (Render)](#render)
5. [Datenbank (PostgreSQL + Prisma)](#datenbank)
6. [Sicherheit](#sicherheit)
7. [GitHub Actions Secrets](#secrets)
8. [API-Dokumentation](#api)
9. [Live-Integration](#live)

---

## Architektur {#architektur}

```
Frontend  →  Next.js 14 (Vercel)       admin.hui-platform.io
Backend   →  Node.js + Express (Render) api.hui-backend.io
Datenbank →  PostgreSQL (Render)
CI/CD     →  GitHub Actions
Auth      →  JWT (8h Gültigkeit)
```

**Sicherheitsprinzipien:**
- CORS nur für `admin.hui-platform.io`
- Alle API-Routen hinter JWT-Middleware
- Rate Limiting: 200 req/15min global, 10 req/15min für Login
- `noindex, nofollow` auf allen Seiten
- Kein Verweis auf externe öffentliche Seiten

---

## Lokale Entwicklung {#lokal}

### Voraussetzungen
- Node.js >= 20
- PostgreSQL (lokal oder via Docker)
- Git

### 1. Repository klonen

```bash
git clone https://github.com/dein-org/hui-admin.git
cd hui-admin
```

### 2. Backend starten

```bash
cd backend
cp .env.example .env
# .env anpassen: DATABASE_URL, JWT_SECRET setzen

npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
# → läuft auf http://localhost:4000
```

### 3. Frontend starten

```bash
cd frontend
cp .env.example .env.local
# .env.local: NEXT_PUBLIC_API_URL=http://localhost:4000/api

npm install
npm run dev
# → läuft auf http://localhost:3000
```

### 4. Admin-Dashboard öffnen

```
http://localhost:3000/login

Demo-Login:
  E-Mail:   admin@hui-platform.io
  Passwort: admin123
```

---

## Deployment — Frontend (Vercel) {#vercel}

### Schritt 1: Vercel-Projekt erstellen

```bash
# Vercel CLI
npm install -g vercel
cd frontend
vercel
```

Oder über das Vercel-Dashboard:
1. "New Project" → GitHub-Repo verbinden
2. Root Directory: `frontend`
3. Framework Preset: Next.js

### Schritt 2: Build-Konfiguration

| Einstellung       | Wert                                    |
|-------------------|-----------------------------------------|
| Build Command     | `cd frontend && npm install && npm run build` |
| Output Directory  | `.next`                                 |
| Install Command   | `npm install`                           |

### Schritt 3: Environment Variables in Vercel

```
NEXT_PUBLIC_API_URL        = https://api.hui-backend.io/api
NEXT_PUBLIC_ENV            = production
NEXT_PUBLIC_ADMIN_DOMAIN   = admin.hui-platform.io
```

### Schritt 4: Custom Domain

1. Vercel Dashboard → Settings → Domains
2. `admin.hui-platform.io` hinzufügen
3. DNS beim Provider:
   ```
   CNAME  admin  →  cname.vercel-dns.com
   ```

---

## Deployment — Backend (Render) {#render}

### Schritt 1: Web Service erstellen

1. Render Dashboard → "New Web Service"
2. GitHub-Repo verbinden
3. Root Directory: `backend`

### Schritt 2: Build & Start Commands

| Einstellung     | Wert                                          |
|-----------------|-----------------------------------------------|
| Build Command   | `npm install && npx prisma generate && npm run build` |
| Start Command   | `npm run start`                               |
| Environment     | Node                                          |

### Schritt 3: Environment Variables in Render

```
DATABASE_URL    = postgresql://user:password@host:5432/hui_admin
JWT_SECRET      = <openssl rand -base64 48>
JWT_EXPIRES_IN  = 8h
ADMIN_DOMAIN    = https://admin.hui-platform.io
CORS_ORIGIN     = https://admin.hui-platform.io
NODE_ENV        = production
PORT            = 4000
```

### Schritt 4: Health Check

- Health Check Path: `/health`
- Render überwacht automatisch den Endpoint

### Schritt 5: Custom Domain

```
api.hui-backend.io → Render-Subdomain
```

---

## Datenbank (PostgreSQL + Prisma) {#datenbank}

### PostgreSQL via Render

1. Render Dashboard → "New PostgreSQL"
2. Verbindungs-URL kopieren → `DATABASE_URL` setzen

### Migrations ausführen

```bash
# Entwicklung: neue Migration erstellen
npx prisma migrate dev --name beschreibung

# Produktion: Migrations anwenden
npx prisma migrate deploy

# Prisma Studio (Daten-Browser)
npx prisma studio
```

### Seed ausführen

```bash
# Legt Admin-User, Beispiel-User und Transaktionen an
npx prisma db seed

# Oder mit eigenem Passwort:
ADMIN_PASSWORD="sicheresPasswort123!" npx prisma db seed
```

### Schema-Übersicht

| Modell              | Beschreibung                        |
|---------------------|-------------------------------------|
| `Admin`             | Dashboard-Administratoren           |
| `User`              | HUI-Plattform-User                  |
| `Transaction`       | Buchungen, Ein-/Auszahlungen        |
| `ImpactPool`        | Aktueller Pool-Stand                |
| `ImpactTransaction` | Pool-Transaktionshistorie           |

### Backup-Strategie

```bash
# Manuelles Backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Wiederherstellen
psql $DATABASE_URL < backup_20250525.sql
```

Render bietet automatische tägliche Backups (kostenpflichtige Pläne).

---

## Sicherheit {#sicherheit}

### JWT-Secret generieren

```bash
openssl rand -base64 48
# Beispiel-Output: xK9mP2nQ8rT5vW1yA4bC7eF0hJ3lN6oR...
```

### Rate Limiting

```
Global:     200 Anfragen / 15 Minuten
Auth-Route: 10 Anfragen  / 15 Minuten  (Login-Schutz)
```

### CORS

Nur erlaubte Origins:
```
https://admin.hui-platform.io
http://localhost:3000  (nur Entwicklung)
```

### Sicherheits-Header (next.config.js)

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Robots-Tag: noindex, nofollow
Content-Security-Policy: default-src 'self' ...
```

### Admin-User Passwort ändern

```bash
# In der Datenbank direkt (einmalig bei Setup):
cd backend
npx ts-node -e "
  const bcrypt = require('bcrypt');
  bcrypt.hash('NEUES_PASSWORT', 10).then(h => console.log(h));
"
# Hash in DB einfügen via Prisma Studio oder SQL
```

---

## GitHub Actions Secrets {#secrets}

Unter: Repository → Settings → Secrets and variables → Actions

### Frontend (Vercel)

| Secret                     | Beschreibung                     |
|----------------------------|----------------------------------|
| `VERCEL_TOKEN`             | Vercel API Token                 |
| `VERCEL_ORG_ID`            | Vercel Organization ID           |
| `VERCEL_PROJECT_ID`        | Vercel Project ID                |
| `NEXT_PUBLIC_API_URL`      | Backend API URL                  |
| `NEXT_PUBLIC_ADMIN_DOMAIN` | Admin-Domain                     |

### Backend (Render)

| Secret                | Beschreibung                          |
|-----------------------|---------------------------------------|
| `RENDER_DEPLOY_HOOK`  | Render Deploy Hook URL                |
| `BACKEND_URL`         | Backend URL für Health Check          |
| `DATABASE_URL`        | PostgreSQL Connection String          |
| `ADMIN_PASSWORD`      | Initial Admin-Passwort für Seed       |

### Vercel IDs ermitteln

```bash
cd frontend
vercel link
cat .vercel/project.json
# { "orgId": "...", "projectId": "..." }
```

---

## API-Dokumentation {#api}

**Base URL:** `https://api.hui-backend.io/api`
**Auth:** `Authorization: Bearer <JWT-Token>`

### Auth

```
POST /auth/login    → { email, password } → { token, admin }
POST /auth/logout   → (JWT) → { message }
GET  /auth/me       → (JWT) → { admin }
```

### Dashboard

```
GET /dashboard/kpis                  → KPI-Daten
GET /dashboard/charts                → Chart-Daten
GET /dashboard/latest-transactions   → Letzte 10 Transaktionen
```

### Users

```
GET    /users                        → Liste (filter: status, role, search)
GET    /users/:id                    → User-Details
PATCH  /users/:id/status             → { status: "active"|"suspended" }
DELETE /users/:id                    → 204 No Content
```

### Transaktionen

```
GET /transactions           → Liste (filter: status, period)
GET /transactions/:id       → Detail
```

### Impact Pool

```
GET /impact-pool/balance    → { balance, lastUpdate }
GET /impact-pool/history    → Transaktionshistorie
```

### Einstellungen

```
PATCH /settings/profile     → { name?, email? }
PATCH /settings/password    → { currentPassword, newPassword }
```

### Health Check (öffentlich)

```
GET /health → { status: "ok", service, timestamp, environment }
```

---

## Live-Integration (Schritt für Schritt) {#live}

Wenn Backend und Datenbank verbunden sind, folgende Schritte in dieser Reihenfolge:

### 1. Datenbank migrieren

```bash
cd backend
npx prisma migrate deploy
```

### 2. Seed ausführen

```bash
ADMIN_PASSWORD="sicheresPasswort!" npx prisma db seed
```

### 3. Frontend auf Live-API umstellen

In Vercel → Environment Variables:
```
NEXT_PUBLIC_ENV = production
NEXT_PUBLIC_API_URL = https://api.hui-backend.io/api
```

### 4. Dummy-Daten in Frontend deaktivieren

In allen Hooks (z.B. `useUsers.ts`):
```typescript
// Vorher:
const IS_DUMMY = process.env.NEXT_PUBLIC_ENV !== 'production';

// Wenn NEXT_PUBLIC_ENV=production gesetzt ist → automatisch Live-API
```

### 5. Monitoring aktivieren

```bash
# Sentry (Frontend)
cd frontend
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs

# Sentry (Backend)
cd backend
npm install @sentry/node
```

---

## Dateistruktur

```
hui-admin/
├── .github/
│   └── workflows/
│       ├── frontend.yml      ← Vercel Deploy
│       ├── backend.yml       ← Render Deploy
│       └── migrate.yml       ← Prisma Migrations
├── frontend/
│   ├── public/
│   │   └── admin.html        ← Einziger Einstiegspunkt
│   ├── src/
│   │   ├── app/              ← Next.js App Router Seiten
│   │   ├── components/       ← UI-Komponenten
│   │   └── lib/              ← Hooks, API-Client, Dummy-Daten
│   ├── .env.example
│   └── package.json
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     ← Datenbank-Schema
│   │   └── seed.ts           ← Initiale Daten
│   ├── src/
│   │   ├── controllers/      ← Business Logic
│   │   ├── routes/           ← API-Endpunkte
│   │   ├── middleware/        ← JWT, CORS, Error
│   │   └── db/               ← Prisma Client
│   ├── .env.example
│   └── package.json
├── .gitignore
└── README.md
```

---

*HUI Admin Dashboard · v1.0.0 · Sicher, isoliert, produktionsreif*
