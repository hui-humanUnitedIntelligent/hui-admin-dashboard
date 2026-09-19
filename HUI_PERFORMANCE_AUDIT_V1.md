# HUI Performance Audit V1 — Phase P1

**Datum:** 2026-07-14  
**Auditor:** Cursor Cloud Agent (Performance Engineering P1)  
**Repository:** `hui-humanUnitedIntelligent/hui-admin-dashboard`  
**Branch:** `cursor/performance-audit-d21e`  
**Methode:** Statische Codepfad-Analyse + `next build` Bundle-Messung + Lighthouse (Headless Chrome) + HTTP-Payload-Messung  
**Keine Codeänderungen. Keine Optimierungen. Nur Analyse.**

---

## Executive Summary

### Kritischer Scope-Hinweis

**Dieses Repository enthält die HUI Admin-Dashboard-Webapp (Next.js 14, SADB/EDB) — nicht die Consumer-HUI-App.**

| Geprüft | Status |
|---------|--------|
| Admin-Dashboard (`frontend/`, Next.js 14) | ✅ Vollständig analysiert und gemessen |
| Consumer-App (Home, Entdecken, Mein HUI, Meine Resonance, Studio, Chat-Feed, Stories) | ❌ **Nicht im Workspace vorhanden** |

**Beweis:**
- `README.md` beschreibt ausschließlich „HUI Admin Dashboard v2.0"
- `package.json`: `"name": "hui-admin-frontend"`, Dependencies: `next`, `react` — kein `react-native`, `expo`, `flash-list`
- `grep` über `/workspace`: keine Treffer für `Entdecken`, `Mein HUI`, `FlashList`, `react-native`
- Consumer-Features existieren nur als Feature-Flags in `frontend/src/data/flags.json` (z.B. `ki_empfehlungen` → „Entdecken-Bereich", `stories_feature` → „Feed")
- `frontend/src/app/system/page.tsx` referenziert Consumer-App als externe Node „🎨 App / Studio-Bereich" im Stripe-Datenfluss-Diagramm

**Konsequenz:** Aufgaben 1–9 für die **Consumer-Hauptseiten** (Home, Entdecken, Mein HUI, Meine Resonance, Impact-App, Profil, Studio, Chat) können in diesem Repo **nicht gemessen** werden. Abschnitte zu diesen Screens sind als **BLOCKIERT** markiert. Alle messbaren Befunde beziehen sich auf das Admin-Dashboard und die geteilte Supabase-Backend-Schicht.

### Kernerkenntnisse (messbar)

| Metrik | Login | Dashboard | Works |
|--------|-------|-----------|-------|
| FCP (Lighthouse) | **1,5 s** | **2,3 s** | **1,5 s** |
| LCP (Lighthouse) | **1,9 s** | **3,3 s** | **3,0 s** |
| TTI (Lighthouse) | **2,0 s** | **3,6 s** | **3,0 s** |
| TBT | 10 ms | 20 ms | 10 ms |
| Transfer (Lighthouse) | 149 KiB | 307 KiB | 250 KiB |
| JS-Payload (curl, alle Chunks) | ~387 KiB | **~717 KiB** | (nicht separat gemessen) |

**Größte identifizierte Probleme (Admin-Dashboard):**

1. **Fetch-All + Client-Filter:** Bis zu 1.000 Profile / 500 Werke werden vollständig geladen und clientseitig gefiltert/paginiert
2. **Kein Layout-Sharing:** Jede Seite mountet `DashboardLayout` neu → Sidebar, Polling-Hooks und Realtime-Subscriptions starten bei jedem Seitenwechsel neu
3. **Doppelter Mount-Block:** `ThemeProvider` und `DashboardLayout` rendern `null` bis `mounted` → zusätzliche leere Frames vor First Paint
4. **2.769 Inline-Style-Objekte**, **0× `React.memo`** → hohes Re-Render-Potenzial in großen Views (bis 1.593 Zeilen)
5. **Drei parallele Realtime-Implementierungen** (Supabase JS Channels, Raw WebSocket in `useSupabaseRealtime.ts`, Raw WebSocket in `useUserRealtime.ts`)
6. **Hintergrund-Polling auf jeder Seite:** Sidebar Health (60 s) + Navigation Pending-Counts (30 s) + seiten-spezifisches Polling/Realtime
7. **Keine Bildoptimierung:** 32× native `<img>`, 0× `loading="lazy"`, 0× `next/image` trotz konfigurierter `remotePatterns`
8. **Schwere API-Routen:** `/api/dashboard` feuert 20 parallele DB-Queries; `/api/works` 6 Count-Queries pro GET

### Priorität für Performance Sprint

| Prio | Bereich | Warum |
|------|---------|-------|
| P0 | Consumer-App-Repo bereitstellen | Ohne Codebasis keine Messung der Nutzer-sichtbaren App |
| P0 | Daten-Fetch-Architektur (Admin) | Skaliert nicht mit tausenden Nutzern/Records |
| P1 | Navigation/Layout-Persistenz | Jeder Klick = Full Remount + Re-Fetch |
| P1 | Bilder & Listen (Admin Content-Views) | Kein Lazy Loading, keine Virtualisierung |
| P2 | Bundle-Deduplizierung Realtime | Drei WebSocket-Stacks, Supabase-Chunk 195 KiB global |
| P2 | React-Rendering-Hygiene | Inline Styles, fehlendes Memo in Monolith-Views |

---

## Messmethodik

| Methode | Befehl / Tool | Umgebung |
|---------|---------------|----------|
| Production Build | `npm run build` (Next.js 14.2.3) | Dummy Supabase Env-Vars |
| Bundle-Größen | `du` auf `.next/static/chunks/*.js` | Post-Build |
| Lighthouse | `npx lighthouse` Headless Chrome | `localhost:3000`, Auth-Cookie für geschützte Seiten |
| HTTP-Timing | `curl -w "%{time_starttransfer}"` | Production Server (`npm run start`) |
| Code-Analyse | `rg`, Dateiinspektion | Vollständiger `frontend/src/` Tree |

**Limitationen:**
- Lighthouse läuft auf Cloud-Agent-Hardware (kein echtes Mid-Range-Smartphone)
- API-Calls schlagen fehl (Dummy-Supabase) → LCP/TTI messen primär JS-Parsing/Hydration, nicht echte Datenlatenz
- Consumer-App-Metriken nicht reproduzierbar ohne separates Repo

---

## Aufgabe 1 — Startup Performance

### Messwerte

#### Login (`/login`) — öffentliche Route

| Metrik | Wert | Quelle |
|--------|------|--------|
| First Contentful Paint | **1,5 s** | Lighthouse |
| Largest Contentful Paint | **1,9 s** | Lighthouse |
| Time to Interactive | **2,0 s** | Lighthouse |
| Total Blocking Time | 10 ms | Lighthouse |
| CLS | 0,003 | Lighthouse |
| TTFB (curl) | 119 ms | `curl /login` |
| HTML-Größe | 6.152 bytes | curl |
| Initial JS (alle Chunks) | **~387 KiB** | curl Summe |
| Initial CSS | **7,0 KiB** | `.next/static/css/88b6adf5b0ed58c1.css` |
| Shared First Load JS (Build) | **87,2 KiB** | `next build` Output |

**Login JS-Chunks (größte):**
| Größe | Chunk |
|-------|-------|
| 169 KiB | `fd9d1056-*.js` (React/Next Runtime) |
| 120 KiB | `7023-*.js` (Next App Router) |
| 89 KiB | `polyfills-*.js` |
| 6,4 KiB | `app/login/page-*.js` |

#### Dashboard (`/dashboard`) — authentifiziert

| Metrik | Wert | Quelle |
|--------|------|--------|
| FCP | **2,3 s** | Lighthouse + Auth-Cookie |
| LCP | **3,3 s** | Lighthouse |
| TTI | **3,6 s** | Lighthouse |
| First Load JS (Build) | **175 KiB** (Seite) + 87,2 KiB shared = **262 KiB** | `next build` |
| JS-Payload (curl, alle Chunks) | **~717 KiB** | curl Summe |
| Zusätzlicher Chunk | 195 KiB `8092-*.js` (**@supabase/supabase-js**) | Chunk-Analyse |

### Critical Rendering Path

```
Request
  → middleware.ts (27,9 KiB, Cookie-Check auf jeder Route)
  → layout.tsx
      → globals.css (@import Google Fonts — render-blocking)
      → inline <script> (localStorage Theme)
      → ThemeProvider → return null bis mounted ❌
  → page.tsx
      → DashboardLayout → return null bis mounted ❌
      → useDashboard(30000) → fetch /api/dashboard
      → dynamic import chart.js (gut: lazy)
```

### Komponenten, die den App-Start blockieren

| Blocker | Datei | Mechanismus | Messbarer Impact |
|---------|-------|-------------|------------------|
| **ThemeProvider Mount-Gate** | `components/providers/ThemeProvider.tsx:64` | `if (!mounted) return null` | Verzögert First Render bis `useEffect` + localStorage |
| **DashboardLayout Mount-Gate** | `components/layout/DashboardLayout.tsx:26` | `if (!mounted) return null` | Zweiter leerer Frame nach ThemeProvider |
| **Google Fonts @import** | `styles/globals.css:2` | `@import url('https://fonts.googleapis.com/...')` | Render-blocking, externe DNS+Download |
| **Supabase Client Chunk** | `lib/supabase.ts` → Chunk `8092-*.js` (195 KiB) | Eager import in Hooks | Auf Dashboard geladen, nicht auf Login |
| **Middleware** | `middleware.ts` | Läuft auf allen nicht-statischen Routes | 27,9 KiB Edge-Code pro Request |

### Daten, die unnötig sofort geladen werden

| Daten | Wann | Datei | Problem |
|-------|------|-------|---------|
| `/api/pending-counts` | Sofort bei Sidebar-Render | `AdminNavigation.tsx:39` | 3 parallele COUNT-Queries alle 30 s, auf **jeder** Seite |
| `useSystemHealth(60000)` | Sofort bei Sidebar-Render | `Sidebar.tsx:20` | Health-Check alle 60 s |
| `/api/dashboard` (20 Queries) | Dashboard-Mount | `useDashboard.ts:84` | Schwere Aggregations-Route sofort |
| `translations` (10,1 KiB) | ThemeProvider-Import | `i18n/translations.ts` | Komplettes i18n-Objekt im Root-Bundle |
| `SENSITIVE_KEYWORDS` (79 Einträge) | WorksView-Modul-Load | `WorksView.tsx:36-79` | Im Page-Chunk `works/page` (53 KiB) |

### Provider beim ersten Render

| Provider | Datei | Initialisiert |
|----------|-------|---------------|
| `ThemeProvider` | `layout.tsx` → `ThemeProvider.tsx` | `theme`, `lang`, `t()` — Context mit 5 Werten |
| Kein React Query / SWR / Redux | — | — |
| Kein Supabase Auth Provider | — | Session via Cookies + `useAuth()` |

**Root Context Cascade:** `ThemeProvider` → alle `useSettings()`-Consumer (Sidebar, Navigation, alle lokalisierten Labels). Bei `setLang`/`setTheme` re-rendern alle Consumer.

### Consumer-App Startup — BLOCKIERT

Home, Entdecken, Mein HUI etc. sind nicht messbar. Referenz aus `flags.json`:
- `stories_feature`: Kurzvideos & Stories im Feed
- `ki_empfehlungen`: KI-Empfehlungen im Entdecken-Bereich
- `dark_mode_v2`: enabled (UX)

---

## Aufgabe 2 — React Rendering

### Globale Statistik (messbar, `rg` über `frontend/src`)

| Pattern | Anzahl | Bewertung |
|---------|--------|-----------|
| `style={{...}}` (Inline-Style-Objekte) | **2.769** | Jedes Render erzeugt neue Objekt-Referenzen |
| `React.memo` / `memo(` | **0** | Kein Komponenten-Memoization |
| `useMemo(` | **12** | Nur in wenigen Hooks/Views |
| `useCallback(` | **95** | Primär in Hooks, nicht in View-Child-Komponenten |
| `useSettings()` Consumer | 10+ Dateien | Breiter Context |

### Große Re-Render-Oberflächen

| Datei | Zeilen | Inline Styles | useMemo | Risiko |
|-------|--------|---------------|---------|--------|
| `ImpactApplicationsView.tsx` | 1.593 | 249 | 1 | Sehr hoch |
| `WorksView.tsx` | 1.238 | 141 | 9 | Hoch |
| `ExperiencesView.tsx` | 892 | 109 | 1 | Hoch |
| `users/page.tsx` | 814 | 100 | 0 | Hoch |
| `ambassadors/AmbassadorDrawer.tsx` | 526 | 113 | 1 | Mittel-Hoch |

### Context-Analyse

**`ThemeProvider` / `SettingsContext`** (`ThemeProvider.tsx:19-23`):
```typescript
{ theme, lang, setTheme, setLang, t }
```
- `t` ist `useCallback` mit `[lang]`-Dependency — gut
- `setTheme`/`setLang` stabil via `useCallback`
- **Problem:** Jeder `useSettings()`-Consumer re-rendert bei `lang`-Wechsel; kein Selector-Pattern

**Kein weiterer globaler State-Provider.** Daten-Hooks (`useWorks`, `useProfiles`) triggern Re-Renders in Parent-Views, die gesamte Tabellen neu rendern.

### Object/Array Recreation — nachweisbare Hotspots

| Hotspot | Datei | Codepfad |
|---------|-------|----------|
| `detectSensitive()` auf allen Works | `WorksView.tsx:448-451` | `annotate()` map über alle Works bei jedem `allWorksRaw`-Update |
| 8 gefilterte `useMemo`-Arrays | `WorksView.tsx:454-471` | `annotatedAll.filter(...)` × 8 bei Datenänderung |
| `usePaginatedList` Sort-Kopie | `usePaginatedList.ts:41` | `[...items].sort(...)` — volle Array-Kopie pro `items`-Änderung |
| Inline `style={{}}` in Table-Rows | Alle Views | Neue Objekte pro Row pro Render |
| `openGroups` State-Update | `AdminNavigation.tsx:61` | `{ ...prev, [group.id]: !prev[group.id] }` — gesamte Nav re-rendert |

### React.memo / useMemo / useCallback Potential

| Komponente | memo? | Empfehlung (nur Analyse) | Begründung |
|------------|-------|--------------------------|------------|
| `DataTable` Rows | Nein | Hoch | Rendert alle Zeilen der aktuellen Seite |
| `KPICard` | Nein | Mittel | 6+ Cards auf Dashboard, Props stabil möglich |
| `PaginationControls` | Nein | Niedrig | Kleine Komponente |
| `AdminNavigation` Items | Nein | Mittel | Re-rendert bei `pending`-Polling alle 30 s |
| `ImageLightbox` | Nein | Mittel | Schwere DOM-Struktur |
| Tabellenzeilen in `WorksView` | Nein | **Sehr hoch** | 20 Rows × 141 Inline Styles |

### Hauptseiten-Mapping

#### Consumer-App — BLOCKIERT (kein Code)

| Seite | Status | Referenz im Admin-Repo |
|-------|--------|------------------------|
| Home | ❌ Nicht analysierbar | — |
| Entdecken | ❌ Nicht analysierbar | Flag `ki_empfehlungen` in `flags.json` |
| Mein HUI | ❌ Nicht analysierbar | — |
| Meine Resonance | ❌ Nicht analysierbar | DB-Tabelle `resonance` in `api/ambassador/route.ts` |
| Impact (Consumer) | ❌ Nicht analysierbar | Flag `impact_pool_live`, `impact_voting_v2` |
| Profil (Consumer) | ❌ Nicht analysierbar | Flag `new_profile_v2` |
| Studio | ❌ Nicht analysierbar | `system/page.tsx` Node „Studio-Bereich" |
| Chat (Consumer) | ❌ Nicht analysierbar | `api/messages/route.ts` (Backend only) |

#### Admin-Äquivalente (messbar)

| Admin-Seite | First Load JS | Größte View | Hauptrisiko |
|-------------|---------------|-------------|-------------|
| `/dashboard` | 175 KiB | inline in `dashboard/page.tsx` | Chart.js lazy ✅, aber `useDashboard` + Realtime |
| `/works` | **183 KiB** | `WorksView.tsx` (1.238 Z.) | `detectSensitive` auf 500 Works, keine Virtualisierung |
| `/users` | 178 KiB | `users/page.tsx` (814 Z.) | Fetch ALL profiles, 100 Inline Styles |
| `/impact-projekte` | 180 KiB | `ImpactApplicationsView.tsx` (1.593 Z.) | Videos ohne Lazy Init, 249 Inline Styles |
| `/experiences` | 181 KiB | `ExperiencesView.tsx` (892 Z.) | limit=500, Bilder ohne lazy |
| `/employee/dashboard` | 170 KiB | `employee/dashboard/page.tsx` | Duplikat-Logik zu Superadmin-Dashboard |

---

## Aufgabe 3 — Navigation

### Architektur (messbar)

- **Kein Tab-Navigation** — Sidebar-Link-Navigation via Next.js `<Link>`
- **Nur ein Root-Layout:** `app/layout.tsx` — kein `app/(dashboard)/layout.tsx`
- **Jede Seite importiert `DashboardLayout` individuell** (40+ Seiten)

### Tab-/Seitenwechsel-Verhalten

| Prüfpunkt | Ergebnis | Beweis |
|-----------|----------|--------|
| Seiten komplett neu aufgebaut? | **Ja** | Kein Shared Layout; `DashboardLayout` pro Page |
| `DashboardLayout` Mount-Gate | **Ja, jedes Mal** | `DashboardLayout.tsx:24-26` |
| Sidebar neu gemountet? | **Ja** | `Sidebar.tsx` innerhalb `DashboardLayout` |
| Daten erneut geladen? | **Ja** | Page-Level Hooks (`useWorks`, etc.) in `useEffect` |
| Komponenten im Speicher? | **Nein** (Standard) | Next.js App Router unmountet vorherige Page |
| Realtime-Subscriptions | **Neu pro Seite** | `useWorks.ts:66-78`, `useProfiles.ts:102-112` etc. |

### Overlay / Drawer / Modal / BottomSheet

| UI-Pattern | Implementierung | Performance-Aspekt |
|------------|-----------------|-------------------|
| Mobile Sidebar Drawer | `DashboardLayout.tsx:49-57` | Conditional Overlay-Div, kein CSS-Transform-Animation |
| Modal | `components/ui/Modal.tsx` | `scale(0.96)` CSS-Animation, `position: fixed` |
| ConfirmModal | `components/ui/ConfirmModal.tsx` | Portal-ähnlich, kein Lazy Mount |
| AmbassadorDrawer | `ambassadors/AmbassadorDrawer.tsx` (526 Z.) | Schwere Inline-Style-Komponente |
| BottomSheet | **Nicht vorhanden** | — |
| ImageLightbox | `ImageLightbox.tsx` | Fixed Overlay, Keyboard-Listener, Touch-Swipe |

### Deep Links

| Route | Middleware | Verhalten |
|-------|------------|-----------|
| `/employee/*` | `middleware.ts:48-52` | Role-Check, Redirect bei fehlender Berechtigung |
| Superadmin-Pfade | `middleware.ts:56-61` | Employee → Redirect `/employee/dashboard` |
| `/login` | Public | Kein Auth |
| `.vercel.app` Host | `middleware.ts:20-25` | 308 Redirect zu `www.hui-admin.com` |

### Consumer-Navigation — BLOCKIERT

Tab-Wechsel, BottomSheet, Deep Links der Consumer-App sind nicht analysierbar.

---

## Aufgabe 4 — Listen

### Virtualisierung

| Technologie | Gefunden | Dateien |
|-------------|----------|---------|
| FlatList / FlashList | **0** | — |
| react-window / tanstack-virtual | **0** | — |
| Native `<table>` / `<tr>` | **Ja, überall** | `DataTable.tsx`, alle Views |

**Fazit:** Keine Virtualisierung. Pagination zeigt 20 Items (`usePaginatedList.ts:10`), aber **vollständiger Datensatz wird vorher geladen**.

### Listen-Mapping

| Liste (Aufgabe) | Admin-Äquivalent | Virtualisierung | Fetch-Pattern | Infinite Scroll |
|-----------------|------------------|-----------------|---------------|-----------------|
| Feed | — | ❌ BLOCKIERT | — | — |
| Stories | — | ❌ BLOCKIERT | Flag `stories_feature` | — |
| Discover | — | ❌ BLOCKIERT | Flag `ki_empfehlungen` | — |
| Profile | `/users` | ❌ | ALL profiles → client filter | ❌ (Page 1,2,3) |
| Kommentare | — | ❌ BLOCKIERT | — | — |
| Chats | `api/messages` (API only) | ❌ | limit 50-200 | ❌ |
| Bookmarks | — | ❌ BLOCKIERT | — | — |
| Favorites | — | ❌ BLOCKIERT | — | — |
| Works (Admin) | `/works` | ❌ | limit 1000 (API cap 500) | ❌ |
| Experiences | `/experiences` | ❌ | limit 500 | ❌ |
| Tickets | `/tickets` | ❌ | Page-level fetch | ❌ |

### Pagination-Implementierung

`usePaginatedList.ts`:
- `PAGE_SIZE = 20` (fest)
- Sortierung: `[...items].sort()` — **O(n log n)** auf vollem Array
- Kein Server-seitiges Offset nach erstem Fetch

### Image Rendering in Listen

- Thumbnails in `WorksView`, `ExperiencesView`, `TalentsView`: native `<img src={url}>`
- **0× `loading="lazy"`** (grep bestätigt)
- `onError` → `display: none` Pattern in einigen Views

---

## Aufgabe 5 — Bilder & Videos

### Bilder

| Aspekt | Status | Beweis |
|--------|--------|--------|
| `<img>` Tags | **32** | `rg "<img" src/` |
| `next/image` | **0** | grep |
| `loading="lazy"` | **0** | grep |
| `remotePatterns` konfiguriert | Ja | `next.config.js:5-9` |
| `remotePatterns` genutzt | **Nein** | Kein `next/image` Import |
| Responsive Images (srcset) | **Nein** | — |
| Image Cache-Strategie | Browser-Default | Keine explizite Cache-Control auf Client |
| Lightbox | `ImageLightbox.tsx` | Lädt Full-Resolution-URL direkt |

**Speicher-Risiko:** Auf `/works` mit 20 sichtbaren Rows können mehrere Thumbnails + Lightbox-Fullsize gleichzeitig im DOM sein. Bei 500 geladenen Works im State: alle Bild-URLs im Memory (String-Referenzen auf JSON-Payload).

### Videos

| Aspekt | Status | Beweis |
|--------|--------|--------|
| `<video>` Tags | **1 Datei** | `ImpactApplicationsView.tsx:941` |
| `preload` | `"metadata"` | Zeile 943 |
| `autoplay` | **Nein** | — |
| Thumbnail-Strategie | **Keine** | Direktes `<video>` mit `<source src={url}>` |
| Lazy Init | **Nein** | Videos rendern wenn Detail-Panel offen |
| Consumer Stories | BLOCKIERT | Flag `stories_feature` |

---

## Aufgabe 6 — Netzwerk

### Supabase Client-Konfiguration

`lib/supabase.ts`:
```typescript
auth: { persistSession: false }
realtime: { params: { eventsPerSecond: 10 } }
```

### Realtime-Implementierungen (3×)

| Implementierung | Datei | Tabellen | Reconnect |
|-----------------|-------|----------|-----------|
| Supabase JS Channels | `useWorks.ts`, `useProfiles.ts`, `useImpact.ts`, `useExperiences.ts`, `useBookings.ts`, `useNotifications.ts` | Je 1 Tabelle | SDK-managed |
| Raw WebSocket (Multi) | `useSupabaseRealtime.ts` | 7 Tabellen parallel | 3 s fixed |
| Raw WebSocket (Single) | `useUserRealtime.ts` | 1 Tabelle | 3 s fixed |

**Namenskollision:** `useSupabaseRealtime` existiert in **zwei Dateien** mit unterschiedlicher Signatur:
- `lib/hooks/useSupabaseRealtime.ts` — `onRefresh` Callback
- `lib/hooks/useUserRealtime.ts:25` — `table` + `onEvent`

### Polling-Intervalle (messbar)

| Hook / Komponente | Intervall | Zusätzlich Realtime |
|-------------------|-----------|---------------------|
| `useDashboard` | 30 s | Ja (800 ms debounce) |
| `useUsers` | 30 s | Ja (800 ms debounce) |
| `usePendingCounts` (Navigation) | 30 s | Nein |
| `useSystemHealth` (Sidebar) | 60 s | Nein |
| `useKPIs` (default) | 60 s | Nein |
| `useAmbassadorStats` | 60 s | Nein |

### API-Route-Analyse

#### `/api/dashboard` — 20 parallele Queries

`api/dashboard/route.ts:37-58`: `Promise.all` mit u.a.:
- `profiles` **limit 5000** (volle Profil-Metadaten)
- 3× separate `profiles`-Queries (Zeilen 63, 87, 92, 98)
- `works`, `stripe_payments`, `bookings`, `impact_projects` etc.

**Impact:** Jeder Dashboard-Load = 20 DB-Roundtrips. Mit 30 s Polling + Realtime-Refresh: hohe DB-Last bei mehreren Admin-Sessions.

#### `/api/profiles` — Fetch-All Anti-Pattern

`api/profiles/route.ts:13`: `limit` default **1000**, max **500**
`useProfiles.ts:50-52`: Ruft `/api/profiles` **ohne** `limit`/`offset`/`search` auf → lädt alles
`useProfiles.ts:58-93`: Filter, Suche, Pagination **clientseitig**

Zusätzlich: `rpc_get_user_impact_totals` RPC pro Request (Zeile 44)

#### `/api/works` — N+1 Count Queries

`api/works/route.ts:55-60`: Nach Hauptquery **5 parallele COUNT-Queries** für Tab-Badges
`useWorks.ts:28`: Default `limit = 1000`, API cap bei 500

#### `/api/pending-counts` — Background auf jeder Seite

3 COUNT-Queries alle 30 s via `AdminNavigation.tsx:39`

#### `/api/messages` — Chat (Backend)

- Chat-Liste: `limit` default 50, max 200
- Participant-Profile: Batch-Load via `.in('id', allIds)` — **kein N+1** ✅
- Kein Realtime-Subscription im Admin-Frontend für Chats

### Mehrfachabfragen / Redundanz

| Redundanz | Details |
|-----------|---------|
| Dashboard pollt + Realtime | `useDashboard.ts:114-121` |
| Profiles 4× im Dashboard-API | Separate Queries statt einer |
| Realtime → Full Refetch | Kein inkrementelles Update; debounced kompletter Re-Fetch |
| Pending-Counts + Works-Realtime | Beide triggern bei Work-Änderung (Nav-Badge + Page-Data) |

---

## Aufgabe 7 — Bundle

### Build-Ergebnis (`next build`)

**Shared First Load JS:** 87,2 KiB
- `chunks/7023-*.js`: 31,5 KiB
- `chunks/fd9d1056-*.js`: 53,6 KiB
- other: 2,08 KiB

**Middleware:** 27,9 KiB

### Größte Page Chunks (First Load JS)

| Route | First Load JS | Page Chunk (disk) |
|-------|---------------|-------------------|
| `/works` | **183 KiB** | 53,1 KiB |
| `/experiences` | 181 KiB | 41,7 KiB |
| `/impact-projekte` | 180 KiB | 55,0 KiB |
| `/users` | 178 KiB | 41,9 KiB |
| `/dashboard` | 175 KiB | 27,8 KiB |
| `/login` | **89,6 KiB** | — |

### Größte Raw Chunks

| Größe | Chunk | Inhalt (nachweisbar) |
|-------|-------|----------------------|
| **404 KiB** | `2170a4aa-*.js` | **xlsx / SheetJS** |
| 195 KiB | `8092-*.js` | **@supabase/supabase-js** |
| 169 KiB | `fd9d1056-*.js` | React DOM Runtime |
| 162 KiB | `ca377847-*.js` | **chart.js** |
| 138 KiB | `framework-*.js` | React Framework |
| 120 KiB | `7023-*.js` | Next.js App Router |

### Code Splitting (positiv)

| Library | Split? | Beweis |
|---------|--------|--------|
| chart.js | ✅ Dynamic | `dashboard/page.tsx:47` `await import('chart.js')` |
| xlsx | ✅ Dynamic | `exports/page.tsx:214` `await import('xlsx')` |
| @supabase/supabase-js | ❌ Eager | Import in `lib/supabase.ts`, geladen auf Dashboard |

`react-loadable-manifest.json` bestätigt Lazy-Loading für chart.js und xlsx.

### Tree Shaking / Dead Code

| Befund | Details |
|--------|---------|
| Tailwind CSS konfiguriert | `tailwind.config.js` — kaum genutzt (Inline Styles dominant) |
| `dummy/data.ts` | Demo-Daten — möglicherweise ungenutzt (nicht in Production-Pfad verifiziert) |
| `*.bak` Dateien | 8 Backup-Dateien im `src/` — nicht im Build, aber Repo-Ballast |
| `useSupabase.ts` (802 Z.) | Legacy + neue Hooks parallel; Duplikat-Exports |

### Doppelte Libraries

Keine doppelten npm-Packages. **Aber:** 3 Realtime-Implementierungen im selben Bundle-Ökosystem.

---

## Aufgabe 8 — Animation

### CSS-Animationen (`globals.css`)

| Animation | Property | GPU-freundlich? |
|-----------|----------|-----------------|
| `spin` | `transform: rotate` | ✅ |
| `fadeIn` | `opacity` + `translateY` | ✅ |
| `slideInLeft` | `translateX` | ✅ |
| `slideUp` | `translateY` | ✅ |
| `pulse` / `blink` | `opacity` | ✅ |
| `html` transition | `background`, `color` | ⚠️ Global auf `<html>` |
| `*` transition (Zeile 93) | `background-color`, `border-color`, `color` | ⚠️ **Universal Selector** |

### Inline-Transitions (häufig)

- `transition: 'all 0.15s'` in Buttons, Table-Rows — **`all` triggert breite Property-Updates**
- `onMouseEnter`/`onMouseLeave` direkte Style-Mutation (`Sidebar.tsx:72-73`) — **umgeht React, verursacht Reflow pro Hover**

### Layout Thrashing / Reflow-Risiken

| Pattern | Datei | Risiko |
|---------|-------|--------|
| `onMouseEnter → e.currentTarget.style.background = ...` | `Sidebar.tsx`, `AdminNavigation.tsx` | Layout-Recalc bei jedem Hover |
| Chart.js Canvas Resize | `dashboard/page.tsx:78` | `responsive: true` → ResizeObserver |
| `overflow: hidden` auf Layout | `DashboardLayout.tsx:39` | Scroll-Container nesting |
| Modal `scale(0.96)` | `Modal.tsx:142` | Transform — OK |

### Framerate

**Nicht gemessen** (kein Chrome Performance Profile auf Mobile). TBT-Werte (7-21 ms) deuten auf geringe Main-Thread-Blockierung im Lighthouse-Szenario — **nicht repräsentativ für 500-Item-Listen mit Sensitive-Detection**.

### Consumer-Animationen — BLOCKIERT

Feed-Scroll, Story-Transitions, Tab-Animationen nicht messbar.

---

## Aufgabe 9 — Memory

### Potenzielle Memory Leaks

| Risiko | Datei | Mechanismus | Cleanup vorhanden? |
|--------|-------|-------------|-------------------|
| WebSocket Reconnect-Loop | `useSupabaseRealtime.ts:75-78` | `setTimeout(connect, 3000)` bei `onclose` | ✅ Cleanup in return (Zeile 86-91) |
| WebSocket Reconnect-Loop | `useUserRealtime.ts` | Gleiches Pattern | ✅ |
| Supabase Channel | `useWorks.ts:77-78` | `removeChannel` on unmount | ✅ |
| `setInterval` Polling | `useDashboard.ts:115` | `clearInterval` on unmount | ✅ |
| Chart.js Instanzen | `dashboard/page.tsx:50` | `destroy()` vor Neuaufbau | ✅ |
| Keyboard Listener | `ImageLightbox.tsx:30-31` | `removeEventListener` | ✅ |
| Toast Timer | `Toast.tsx` | Nicht vollständig auditiert | Teilweise |

### Unmount-Probleme

| Problem | Impact |
|---------|--------|
| **Kein Shared Layout** | Jeder Navigationswechsel: voller Teardown aller Hooks, Channels, Intervalle → dann Neuaufbau |
| **Realtime während Fetch** | Debounced Refetch kann nach Unmount feuern (kein AbortController in `useWorks`/`useProfiles`) |
| **500 Works im React State** | Bleibt im Memory bis Unmount; große JSON-Objekte mit Bild-URL-Arrays |

### Listener / Subscriptions / Timer (pro typischer Session)

Auf `/works` gleichzeitig aktiv:
1. `useWorks` → Supabase Channel `admin:works:realtime`
2. `usePendingCounts` → `setInterval` 30 s
3. `useSystemHealth` → `setInterval` 60 s
4. `ThemeProvider` → Context

Bei Navigation zu `/users`:
- Works-Channel **zerstört**, neue Subscriptions für Profiles-Channel
- Pending-Counts + Health **neu gestartet** (neuer Interval)

### Observer

Keine `IntersectionObserver`, `ResizeObserver` (außer implizit via Chart.js), `MutationObserver` im Code gefunden.

---

## Top-50 Performance-Probleme

Priorisiert nach geschätztem Einfluss auf **Flüssigkeit, Reaktionsgeschwindigkeit, Scroll, Navigation, Speicher** — für eine produktive Umgebung mit tausenden Nutzern.

| # | Problem | Ursache | Betroffene Dateien | Einfluss | Schwierigkeit | Prio | Empfohlene Lösung |
|---|---------|---------|-------------------|----------|---------------|------|-------------------|
| 1 | **Consumer-App nicht auditierbar** | Separates Repo | Gesamter Workspace | **Blocker** | N/A | P0 | Consumer-Repo (`hui-app` o.ä.) für P1-Sprint bereitstellen |
| 2 | **Fetch-All Profiles** | API lädt bis 1000, Client filtert | `useProfiles.ts`, `api/profiles/route.ts`, `users/page.tsx` | Sehr hoch (Netzwerk + Memory + CPU) | Mittel | P0 | Server-seitige Filter/Pagination durchreichen |
| 3 | **Fetch-All Works (500)** | `useWorks({ limit: 1000 })`, API cap 500 | `useWorks.ts`, `WorksView.tsx:445`, `api/works/route.ts` | Sehr hoch | Mittel | P0 | Server-Pagination + Status-Filter |
| 4 | **Kein Shared Dashboard-Layout** | Jede Page mountet Layout neu | 40+ `app/**/page.tsx`, `DashboardLayout.tsx` | Sehr hoch (Navigation) | Mittel | P0 | `app/(admin)/layout.tsx` mit persistentem Sidebar |
| 5 | **Doppelter Mount-Block** | `return null` bis mounted | `ThemeProvider.tsx:64`, `DashboardLayout.tsx:26` | Hoch (FCP/LCP) | Niedrig | P0 | CSS-only Theme Flash Prevention |
| 6 | **Dashboard API: 20 Queries** | Monolithische Aggregation | `api/dashboard/route.ts` | Hoch (DB + Latenz) | Hoch | P0 | Materialized Views / RPC / Caching |
| 7 | **Profiles limit 5000 in Dashboard** | Überfetch | `api/dashboard/route.ts:63-65` | Hoch | Mittel | P0 | COUNT + Sample statt Full Scan |
| 8 | **detectSensitive auf alle Works** | O(n × keywords) pro Fetch | `WorksView.tsx:116-150, 448-451` | Hoch (CPU) | Mittel | P1 | Server-seitig oder lazy per Row |
| 9 | **0× React.memo** | Fehlende Komponentenisolation | Gesamtes `src/components/` | Hoch (Re-Render) | Mittel | P1 | memo auf Table-Rows, KPICard, Nav-Items |
| 10 | **2.769 Inline Style Objects** | `style={{}}` everywhere | 78 Dateien | Hoch (GC + Reconcile) | Hoch | P1 | CSS Modules / Tailwind (bereits konfiguriert) |
| 11 | **Kein Lazy Loading für Bilder** | Native `<img>` ohne Attribute | 15 Dateien, 32 Tags | Hoch (LCP, Bandbreite) | Niedrig | P1 | `loading="lazy"` + `next/image` |
| 12 | **Keine Listen-Virtualisierung** | HTML Tables | `DataTable.tsx`, alle Views | Hoch (Scroll) | Mittel | P1 | `@tanstack/react-virtual` o.ä. |
| 13 | **3 Realtime-Implementierungen** | Parallele WebSocket-Stacks | `useSupabaseRealtime.ts`, `useUserRealtime.ts`, diverse Channels | Hoch (Memory + Netz) | Hoch | P1 | Ein zentraler Realtime-Provider |
| 14 | **Realtime → Full Refetch** | Kein Delta-Update | Alle `use*Realtime` Hooks | Hoch | Mittel | P1 | Inkrementelle State-Updates |
| 15 | **Pending-Counts Polling global** | 30 s auf jeder Seite | `AdminNavigation.tsx:39`, `api/pending-counts/route.ts` | Mittel-Hoch | Niedrig | P1 | Nur auf Content-Seiten oder Realtime-Badge |
| 16 | **Sidebar Health Polling** | 60 s auf jeder Seite | `Sidebar.tsx:20` | Mittel | Niedrig | P1 | Shared Layout + längeres Intervall |
| 17 | **Google Fonts @import** | Render-blocking CSS | `globals.css:2` | Mittel (FCP) | Niedrig | P1 | `next/font` self-hosted |
| 18 | **Supabase Chunk 195 KiB eager** | Import in Client-Hooks | `lib/supabase.ts` | Mittel (TTI) | Mittel | P1 | Dynamic import für Realtime-only Pages |
| 19 | **Works API: 5 Count Queries** | Tab-Badges serverseitig | `api/works/route.ts:55-60` | Mittel | Niedrig | P1 | Ein RPC für alle Counts |
| 20 | **usePaginatedList full sort** | `[...items].sort()` | `usePaginatedList.ts:41` | Mittel (CPU) | Niedrig | P2 | Server-sort oder index-basiert |
| 21 | **ImpactApplicationsView 1593 Z.** | Monolith | `ImpactApplicationsView.tsx` | Mittel-Hoch | Hoch | P1 | Aufteilen in Subkomponenten |
| 22 | **Videos ohne Lazy Mount** | `<video preload="metadata">` | `ImpactApplicationsView.tsx:941` | Mittel | Niedrig | P2 | IntersectionObserver + click-to-play |
| 23 | **Universal CSS transition *** | Alle Elemente | `globals.css:93` | Mittel | Niedrig | P2 | Spezifische Selektoren |
| 24 | **transition: all** | Breite Property-Updates | Button, Modal, Views | Mittel | Niedrig | P2 | `transition: background-color 0.15s` |
| 25 | **Direct DOM style on hover** | Reflow | `Sidebar.tsx:72`, `AdminNavigation.tsx:78` | Mittel | Niedrig | P2 | CSS `:hover` Klassen |
| 26 | **Dashboard 30s Poll + Realtime** | Redundante Fetches | `useDashboard.ts:114-121` | Mittel | Niedrig | P2 | Entweder Poll ODER Realtime |
| 27 | **useProfiles ignoriert API-Params** | Hardcoded `/api/profiles` | `useProfiles.ts:50` | Hoch | Niedrig | P0 | Query-Params durchreichen |
| 28 | **Experiences limit 500** | Großer Payload | `useExperiences.ts:28` | Mittel | Mittel | P1 | Pagination |
| 29 | **xlsx Chunk 404 KiB** | Schwere Library | `exports/page.tsx` | Niedrig (nur Export) | — | P3 | Bereits lazy ✅ |
| 30 | **chart.js 162 KiB** | Canvas Charts | `dashboard/page.tsx` | Niedrig-Mittel | — | P2 | Bereits lazy ✅; Tree-shake registerables |
| 31 | **Kein AbortController in Fetches** | Race nach schnellem Nav-Wechsel | `useWorks.ts:45`, `useProfiles.ts:50` | Mittel | Niedrig | P2 | `AbortSignal` in fetch |
| 32 | **ThemeProvider Context breit** | 5 Values, viele Consumer | `ThemeProvider.tsx:67` | Mittel | Mittel | P2 | Context Splitting (theme/lang) |
| 33 | **SENSITIVE_KEYWORDS im Bundle** | 79 Keywords + DB-Fetch | `WorksView.tsx:36-100` | Niedrig-Mittel | Niedrig | P2 | Server-seitige Moderation API |
| 34 | **Middleware auf allen Routes** | Cookie-Parsing | `middleware.ts` | Niedrig | — | P3 | Bereits lean (27,9 KiB) |
| 35 | **Tailwind ungenutzt** | Bundle/CSS Dead Weight | `tailwind.config.js` | Niedrig | Mittel | P3 | Entscheidung: Tailwind ODER Inline |
| 36 | **8 `.bak` Dateien im src/** | Repo-Noise | diverse `*.bak` | Keiner (Build) | Niedrig | P3 | Löschen im Cleanup-Sprint |
| 37 | **useSupabase.ts 802 Zeilen Legacy** | Doppelte Hook-Logik | `lib/hooks/useSupabase.ts` | Mittel (Wartung) | Hoch | P2 | Konsolidierung |
| 38 | **Namenskollision useSupabaseRealtime** | Zwei verschiedene Hooks | `useSupabaseRealtime.ts`, `useUserRealtime.ts` | Mittel (Dev-Bugs) | Mittel | P2 | Umbenennen + vereinheitlichen |
| 39 | **RPC bei jedem Profile-Load** | `rpc_get_user_impact_totals` | `api/profiles/route.ts:44` | Mittel | Mittel | P2 | Cache / Denormalize |
| 40 | **select('*') auf works** | Überfetch Spalten | `api/works/route.ts:20` | Mittel | Niedrig | P2 | Explizite Column-Liste |
| 41 | **translations 10 KiB eager** | Root Import | `i18n/translations.ts` | Niedrig | Mittel | P3 | Namespace-Splitting |
| 42 | **Kein SWR/React Query** | Keine Request-Dedup | Alle Hooks | Mittel | Mittel | P2 | TanStack Query einführen |
| 43 | **ImageLightbox rendert alle Thumbnails** | DOM-Größe | `ImageLightbox.tsx:130+` | Niedrig-Mittel | Niedrig | P2 | Nur aktives Bild + Nachbarn |
| 44 | **WebSocket eventsPerSecond: 10** | Rate Limit | `lib/supabase.ts:15` | Niedrig | — | P3 | Tuning nach Lasttest |
| 45 | **Reconnect ohne Backoff** | Fixed 3 s | `useSupabaseRealtime.ts:78` | Niedrig (Server) | Niedrig | P3 | Exponential Backoff |
| 46 | **Strict Mode Double Render** | Dev-only | `next.config.js:3` | Dev-Only | — | P3 | Erwartetes Verhalten |
| 47 | **LCP 3,3 s Dashboard** | JS + Mount Gates | Gemessen Lighthouse | Hoch (UX) | Mittel | P0 | Kombination #4, #5, #17 |
| 48 | **717 KiB JS Dashboard** | Viele Chunks | Gemessen curl | Hoch (TTI Mobile) | Mittel | P1 | Layout-Shared Chunks, Supabase lazy |
| 49 | **Consumer Feed/Stories/Chat** | Nicht im Repo | `flags.json` | Unbekannt | — | P0 | Separates Audit |
| 50 | **Kein Mobile-First Perf Budget** | Keine CI-Gates | — | Mittel (Prozess) | Niedrig | P2 | Lighthouse CI + Bundle Size Limit |

---

## Performance Roadmap

### Phase P1-Sprint (nach diesem Audit)

#### Woche 1 — Messbarkeit & Scope
- [ ] Consumer-HUI-App Repository identifizieren und gleichen Audit-Prozess anwenden
- [ ] Performance-Budgets definieren (FCP < 1,8 s, LCP < 2,5 s, TTI < 3,5 s auf Moto G4 / Slow 4G)
- [ ] Lighthouse CI + Bundle-Size-Check in Pipeline
- [ ] Supabase-Staging mit realistischen Datenmengen (1k/5k/10k Profiles, 2k Works)

#### Woche 2 — Quick Wins (Admin-Dashboard)
- [ ] `loading="lazy"` auf alle `<img>` (32 Stellen)
- [ ] Mount-Gates in `ThemeProvider` + `DashboardLayout` entfernen (CSS-only)
- [ ] `useProfiles` → API-Params (`limit`, `offset`, `search`) durchreichen
- [ ] Pending-Counts nur auf Content-Routes laden
- [ ] `next/font` statt Google `@import`

#### Woche 3 — Architektur (Admin-Dashboard)
- [ ] Shared Layout `app/(dashboard)/layout.tsx`
- [ ] Zentraler Realtime-Provider (1 WebSocket, Multiplex)
- [ ] Server-Pagination für Works, Users, Experiences
- [ ] `/api/dashboard` → RPC oder gecachte Materialized View

#### Woche 4 — Rendering (Admin-Dashboard)
- [ ] `React.memo` auf Table-Rows und KPI-Cards
- [ ] `WorksView` / `ImpactApplicationsView` in Subkomponenten
- [ ] CSS-Klassen statt Inline Styles (priorisiert: Top 5 Views)
- [ ] List Virtualization für Tabellen > 20 Rows

### Phase P2 — Consumer-App (nach Repo-Zugang)

Basierend auf Feature-Flags und System-Diagramm — **Hypothesen für Sprint-Planung, nicht gemessen:**

| Bereich | Erwartete Hotspots | Messmethode |
|---------|-------------------|-------------|
| Home Feed | Scroll-Perf, Image-Heavy | FlashList Profiler, Systrace |
| Entdecken | KI-Empfehlungen (`ki_empfehlungen`) | Network Waterfall |
| Stories | Video Autoplay, Memory | Android Memory Profiler |
| Chat | Realtime Subscriptions | WebSocket Frame-Analyse |
| Studio | Upload + Preview | Transfer-Size + Main Thread |
| Navigation | Tab-Persistenz | React DevTools Profiler |

### Erfolgskriterien

| Metrik | Admin (Ziel) | Consumer (Ziel, nach Repo) |
|--------|--------------|---------------------------|
| FCP | < 1,8 s (Slow 4G) | < 1,5 s |
| LCP | < 2,5 s | < 2,0 s |
| TTI | < 3,0 s | < 2,5 s |
| JS Initial | < 200 KiB (gzipped) | < 150 KiB |
| List Scroll | 60 fps | 60 fps |
| Memory (10 min Session) | < 150 MB | < 120 MB |

---

## Anhang A — Vollständige Lighthouse-Rohdaten

### Login `/login`
```
FCP: 1524 ms | LCP: 1911 ms | TTI: 1993 ms | TBT: 7 ms | CLS: 0.003
Total Transfer: 149 KiB | Main Thread: 410 ms | Bootup JS: 139 ms
```

### Dashboard `/dashboard` (auth cookie)
```
FCP: 2282 ms | LCP: 3298 ms | TTI: 3639 ms | TBT: 22 ms | CLS: 0.0004
Total Transfer: 307 KiB | Main Thread: nicht extrahiert | Bootup JS: 388 ms
Unused JS (est.): 70 KiB
```

### Works `/works` (auth cookie)
```
FCP: 1524 ms | LCP: 2977 ms | TTI: 2977 ms | TBT: 7 ms | CLS: 0.0005
Total Transfer: 250 KiB | Bootup JS: 244 ms
Unused JS (est.): 40 KiB
```

## Anhang B — Build-Modus Kommandos

```bash
cd frontend
npm ci
NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy_key \
SUPABASE_URL=https://dummy.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=dummy_service \
npm run build
```

## Anhang C — Consumer-Feature-Flag-Referenz

| Flag | Consumer-Bereich | Enabled |
|------|------------------|---------|
| `ki_empfehlungen` | Entdecken (KI-Feed) | false |
| `stories_feature` | Feed (Kurzvideos) | false |
| `new_profile_v2` | Profil | false |
| `impact_pool_live` | Impact (Members) | **true** |
| `impact_voting_v2` | Impact Voting | false |
| `dark_mode_v2` | Global UX | **true** |
| `ambassador_program` | Ambassador-Bereich | false |
| `notifications_push` | Push | false |

---

*Ende HUI Performance Audit V1 — Keine Codeänderungen vorgenommen.*
