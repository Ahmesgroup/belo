# Belo — Documentation technique v0.4.0

> SaaS beauté multi-tenant · Mise à jour : Mai 2026  
> **21 modèles Prisma · 305 pages SSG/ISR · Next.js 16 App Router**

---

## Table des matières

1. [Stack technique](#1-stack-technique)
2. [Philosophie du système](#2-philosophie-du-système)
3. [Architecture générale](#3-architecture-générale)
4. [Types centralisés](#4-types-centralisés)
5. [Modèles Prisma (21)](#5-modèles-prisma-21)
6. [Pages & routes (305)](#6-pages--routes-305)
7. [Système d'authentification](#7-système-dauthentification)
8. [Booking Engine (production-ready)](#8-booking-engine-production-ready)
9. [Cache Engine (L1/L2/L3)](#9-cache-engine-l1l2l3)
10. [Slot Cache (client-side)](#10-slot-cache-client-side)
11. [Circuit Breaker & Retry](#11-circuit-breaker--retry)
12. [Rate Limiting (Redis + DB)](#12-rate-limiting-redis--db)
13. [Design System](#13-design-system)
14. [Motion System (Framer Motion)](#14-motion-system-framer-motion)
15. [Composants UI Primitives](#15-composants-ui-primitives)
16. [Composants Home](#16-composants-home)
17. [Composants Booking](#17-composants-booking)
18. [Hooks Async UX](#18-hooks-async-ux)
19. [Services client-side](#19-services-client-side)
20. [Scroll Lock](#20-scroll-lock)
21. [Typographie (Fonts)](#21-typographie-fonts)
22. [Système de téléphone (240+ pays)](#22-système-de-téléphone-240-pays)
23. [Ranking & géolocalisation](#23-ranking--géolocalisation)
24. [Système d'événements](#24-système-dévénements)
25. [Détection de fraude](#25-détection-de-fraude)
26. [i18n (fr / en)](#26-i18n-fr--en)
27. [SEO — pages locales + schema JSON-LD](#27-seo--pages-locales--schema-json-ld)
28. [Analytics & funnel tracking](#28-analytics--funnel-tracking)
29. [Admin Panel (7 vues)](#29-admin-panel-7-vues)
30. [Onboarding gérant](#30-onboarding-gérant)
31. [Paiements Stripe Connect](#31-paiements-stripe-connect)
32. [Installation locale](#32-installation-locale)
33. [Variables d'environnement](#33-variables-denvironnement)
34. [Structure des dossiers](#34-structure-des-dossiers)
35. [Plans tarifaires](#35-plans-tarifaires)
36. [Déploiement Vercel](#36-déploiement-vercel)
37. [Bugs corrigés (historique)](#37-bugs-corrigés-historique)

---

## 1. Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | **Next.js 16** App Router (Turbopack) |
| Base de données | **PostgreSQL Neon** (serverless, scale-to-zero) |
| ORM | **Prisma 5.22** |
| Cache serveur | **LRU in-memory** (L1) + **Upstash Redis** (L2) + DB fallback (L3) |
| Cache client | **slotCache** (Map in-memory, SWR, anti-stampede) |
| Auth | OTP WhatsApp + **JWT HS256** (jose, edge-compatible) |
| Paiements | **Stripe Connect** (marketplace) · Wave · Orange Money |
| Notifications | WhatsApp Cloud API (Meta) |
| Stockage | Cloudflare R2 |
| Hosting | **Vercel** (cron jobs intégrés) |
| CSS | **Tailwind CSS v3** + CSS variables (dark/light) |
| Animations | **Framer Motion 12** — système MOTION figé |
| Typographie | **Fraunces** (headings) + **DM Sans** (body) via `next/font` |
| TypeScript | Strict mode — zéro `any`, zéro `as unknown as` |

---

## 2. Philosophie du système

> Ce projet n'est pas une collection de composants.  
> C'est un **système fermé de décisions irréversibles**.

Chaque règle évite une classe de bugs précise :

| Règle | Bug évité |
|-------|-----------|
| `intent.ts` | Incohérence visuelle |
| `motion.ts` | Incohérence animation |
| `types/index.ts` | Bugs silencieux de typage |
| hooks async | États cassés |
| cache system | Latence + données stale |
| idempotency key | Double booking |
| schema SEO | Pénalité Google |
| error system | UX cassée |
| state rules | Incohérence données |

### Règles non-négociables

**DESIGN**
1. Vert `#1DB954` = action positive uniquement
2. 1 signal couleur par card
3. Tap feedback < 100ms
4. Jamais succès avant confirmation DB
5. 1 priorité visuelle par écran

**MOTION**
1. Si visible → trop fort
2. 1 seule courbe easing dans tout le projet
3. Motion = feedback, jamais décoration
4. Tout passe par `MOTION` system

**ASYNC**
1. Tout état async a timeout 10s
2. Double click impossible pendant loading
3. Retry garde même idempotency key
4. Cleanup sur chaque unmount

**CACHE SLOTS**
1. `undefined` = jamais fetch
2. `null` = erreur réseau ≠ zéro disponibilité
3. `SlotsData` = succès
4. `retryCount` isolé par salon

**SEO**
1. Zéro donnée fictive dans schema
2. Page générée si salons >= 3
3. Page utile sans login
4. Slots dynamiques, page statique

**ERROR HANDLING**
1. Aucune erreur brute affichée à l'utilisateur
2. Toute erreur a un état UX défini (réseau → retry, métier → actionnable, inconnu → fallback)
3. Zéro `console.error` en prod UI — logs côté infra uniquement

**DATA FETCHING**
1. Aucun fetch direct dans les composants
2. Tout fetch passe par `services/` (server) ou `hooks/` (client)

**TYPE SAFETY**
1. Zéro `any`
2. Zéro `as unknown as`
3. Types métier centralisés dans `src/types/`
4. API responses typées explicitement

**STATE MANAGEMENT**
1. Zéro state dupliqué
2. Une seule source de vérité par donnée
3. `remainingSlots` = backend uniquement, jamais recalculé UI
4. Backend dit 2 slots → UI affiche 2 slots

---

## 3. Architecture générale

```
                        ┌─────────────────────────────────┐
                        │         proxy.ts (Edge)         │
                        │  auth guard · i18n redirect     │
                        │  rate limit · JWT verify        │
                        └──────────────┬──────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
     ┌────────▼──────┐      ┌──────────▼──────┐      ┌────────▼──────┐
     │   App Router  │      │   API Routes    │      │  Cron Jobs    │
     │  SSG / ISR    │      │  Route Handlers │      │  /api/cron/*  │
     └──────────┬────┘      └──────────┬──────┘      └───────────────┘
                │                      │
     ┌──────────▼────────────────────────────────────────────┐
     │            Cache Engine L1+L2+L3 (serveur)             │
     │   LRU in-memory (5s) · Upstash Redis (60s) · DB fetch  │
     └──────────────────────────┬────────────────────────────┘
                                │
     ┌──────────────────────────▼────────────────────────────┐
     │                    Services Layer                      │
     │  booking.service · ranking.service · geocode           │
     └──────────────────────────┬────────────────────────────┘
                                │
     ┌──────────────────────────▼────────────────────────────┐
     │              Prisma Client → Neon PostgreSQL           │
     └───────────────────────────────────────────────────────┘

     ┌───────────────────────────────────────────────────────┐
     │           slotCache (client-side Map)                  │
     │  preload on hover → dedup → SWR → retry isolé         │
     └───────────────────────────────────────────────────────┘
```

---

## 4. Types centralisés

**`src/types/index.ts`** — `@frozen` — source de vérité unique.

```typescript
// Re-export depuis intent.ts (pas de duplication)
export type { Intent, PositiveIntent, NeutralIntent, DangerIntent };

// Domain types
export type BookingStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type AsyncStatus   = "idle" | "loading" | "success" | "error";
export type ErrorType     = "network" | "business" | "unknown";

export interface Slot    { id; startsAt; endsAt; isAvailable }
export interface SlotsData { slots; total; expectedCount? }
export interface Service { id; name; category; priceCents; durationMin; photos? }

export interface Salon {
  id; name; slug; city; coverUrl; blurDataURL?;
  rating; reviewCount;
  remainingSlots: number;  // backend UNIQUEMENT — jamais recalculé UI
  distanceKm; weeklyBookings; category;
  phone?; whatsapp?; services?;
}

export interface Booking { id; salonName; serviceName; date; time; status; priceCents; ... }

export interface BookingError {
  code; message; type: ErrorType;
  nextAvailableSlot?: Slot;  // fourni si code === "SLOT_TAKEN"
}

export interface CacheEntry {
  data?:        SlotsData | null;  // undefined=jamais, null=erreur, SlotsData=ok
  timestamp?:   number;
  promise?:     Promise<SlotsData>;  // dedup requêtes concurrentes
  retryCount?:  number;              // isolé par salonId
  lastErrorAt?: number;
}
```

---

## 5. Modèles Prisma (21)

| Modèle | Description |
|--------|-------------|
| `User` | Utilisateur (CLIENT · STAFF · OWNER · ADMIN · SUPER_ADMIN) |
| `Tenant` | Salon — slug unique, lat/lng, plan, statut |
| `Service` | Prestation d'un salon (catégorie, prix, durée, photos) |
| `Slot` | Créneau horaire généré par cron |
| `Booking` | Réservation (statut, acompte, paiement, idempotencyKey `@unique`) |
| `Review` | Avis lié à une réservation (1:1) |
| `NotificationLog` | Log WhatsApp/SMS (outbox pattern) |
| `FraudAlert` | Alertes fraude (6 signaux, score 0-100) |
| `AuditLog` | Journal d'audit + Dead Letter Queue (`dlq:*`) |
| `EventLog` | Queue d'événements asynchrones (SKIP LOCKED) |
| `AdminNotification` | Inbox admin |
| `TenantMetrics` | Métriques dénormalisées (rating, conversion, rétention) |
| `TenantTrending` | Score tendance |
| `AdCampaign` | Campagnes publicitaires CPC |
| `GeoBid` | Enchères géographiques |
| `UserPreference` | Préférences utilisateur |
| `Favorite` | Salons favoris |
| `Country` | Pays (ISO, nom, devise) |
| `City` | Villes avec slug SEO |
| `PaymentAccount` | Comptes paiement plateforme |
| `TenantPayout` | Historique virements gérants |

### Index partiel anti double-booking

```sql
CREATE UNIQUE INDEX "unique_active_booking_per_slot"
    ON "Booking" ("slotId")
    WHERE status IN ('PENDING', 'CONFIRMED');
```

---

## 6. Pages & routes (305)

| Route | Type | Revalidate |
|-------|------|------------|
| `/fr`, `/en` | SSG | 2 min |
| `/fr/for-salons`, `/en/for-salons` | SSG | 1h |
| `/fr/plans`, `/en/plans` | SSG | 5 min |
| `/fr/salons/[city]/[category]` × 224 | SSG | 10 min |
| `/[city]/[category]` — Dakar phase 1 | SSG | ISR |

---

## 7. Système d'authentification

### Flow OTP

```
1. POST /api/auth?action=send-otp { phone }
2. Code 6 chiffres → WhatsApp Cloud API
3. POST /api/auth?action=verify-otp { phone, otp }
4. JWT HS256 signé (7j) → localStorage
```

### JWT payload

```typescript
{ sub: userId, role, tenantId?, iat, exp }
```

### Helpers client (`src/lib/auth-client.ts`)

```typescript
getToken() · getUser() · setAuth(token, user) · clearAuth()
isOwner() · isAdmin() · authHeaders()
```

### Helpers serveur (`src/lib/route-auth.ts`)

```typescript
withAuth(req) · withRole(auth, roles) · withTenant(auth, tenantId)
withActiveTenant(auth, tenantId) · signJWT({ sub, role, tenantId })
```

---

## 8. Booking Engine (production-ready)

### 4 couches anti double-booking

```
1. Domain rules    — validateBookingCreation() pure, fail fast
2. FOR UPDATE      — Tenant lock → Slot lock (ordre constant, deadlock-free)
3. Double-check    — findFirst après lock
4. Index partiel   — UNIQUE (slotId) WHERE PENDING|CONFIRMED
```

### Timeouts de lock DB

```typescript
await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
```

### Idempotency (règle critique)

```typescript
// La clé NE SE RESET PAS sur erreur.
// Reset UNIQUEMENT après succès DB confirmé.
// Violer = double booking possible.
```

P2002 → re-fetch par `idempotencyKey` → distingue clé en collision de slot pris.

### Plan limit (TOCTOU fix)

`SELECT ... FOR UPDATE` sur Tenant — sérialise les accès concurrents au compteur mensuel.

---

## 9. Cache Engine (L1/L2/L3)

```
L1 : LRU in-memory    TTL 5s    — zéro latence, par instance
L2 : Upstash Redis    TTL 60s   — distribué entre instances
L3 : DB fetcher       Fallback  — toujours disponible
```

### Patterns

| Pattern | Implémentation |
|---------|----------------|
| SWR | Retourne stale + revalide en background |
| Anti-stampede | `SET NX` lock + jitter 50–150ms |
| safeParse | `get<string>` + `JSON.parse` explicite + logging |
| Versioning | `minVersion` pour read-after-write |

```typescript
CacheEngine.get(key, fetcher, { ttl: 60 })
CacheEngine.invalidate(key)
CacheEngine.invalidatePattern("belo:tenants:*")
```

Cache activé via `UPSTASH_REDIS_REST_URL` + `TOKEN` dans Vercel. Sans ces vars → mode DB-only transparent.

---

## 10. Slot Cache (client-side)

**`src/lib/cache/slotCache.ts`**

### Sémantique des états

```
undefined  → jamais fetch (pas de requête lancée)
null       → erreur réseau (≠ zéro disponibilité — ne pas confondre)
SlotsData  → succès (peut contenir zéro slots si aucun dispo)
```

### API publique

```typescript
getSlots(salonId)       // lecture synchrone — undefined | null | SlotsData
preloadSlots(salonId)   // déclenche le fetch, retourne Promise<SlotsData>
                        // idempotent : partage la promise si déjà en cours
invalidateSlots(salonId) // après réservation confirmée
```

### Comportements clés

| Situation | Comportement |
|-----------|-------------|
| Cache valide | Retourne immédiatement + revalide en background (SWR) |
| Promise active | Retourne la même promise (anti-stampede) |
| Retry en pause | Rejette avec `RETRY_PAUSED` si < 30s depuis dernier échec |
| Erreur réseau | `retryCount++`, `lastErrorAt = now`, `data = null` |
| `retryCount >= 3` | Pause 30s avant de réessayer |
| Erreur background | `.catch(() => {})` — silencieuse, conserve le stale cache |

### Préchauffage du cache

```typescript
// Dans SalonCard — onHoverStart + onTapStart
preloadSlots(salon.id).catch(() => {});
// → Au moment où l'utilisateur ouvre le drawer, les slots sont déjà chargés
```

---

## 11. Circuit Breaker & Retry

### Circuit Breaker (`src/lib/circuit-breaker.ts`)

```
CLOSED   → < 5 failures → exécution normale
OPEN     → ≥ 5 failures → fallback immédiat (30s cooldown)
HALF-OPEN → 1 requête test → succès=CLOSED | échec=OPEN
```

Erreurs métier (`SLOT_TAKEN`, `UNAUTHORIZED`, etc.) **exemptées** — seules les pannes infra comptent.

### Retry + DLQ (`src/lib/retry-engine.ts`)

Full Jitter backoff. Jobs échoués → `AuditLog` (`action = "dlq:*"`).

---

## 12. Rate Limiting (Redis + DB)

Identité : `userId > cookie hash > IP`

| Endpoint | Limite | Fenêtre |
|----------|--------|---------|
| `/api/*` global | 100 req | 1 min |
| `POST /api/bookings` | 5 req | 10 s |
| OTP send | 3 req | 2 min |
| OTP verify | 5 req | 15 min |
| `POST /api/tenants` | 5 req | 1 h |

---

## 13. Design System

### Intent System — `src/lib/design/intent.ts` (`@frozen`)

```typescript
type Intent = "cta" | "success" | "confirm" | "neutral" | "muted" | "error";

// Vert #1DB954 UNIQUEMENT sous ces intentions
getIntentColor(intent) → "#1DB954" | "#0A0A0A" | "#6B7280" | "#DC2626"
getIntentBg(intent)    → tinte à 10% opacité
```

### Tokens Tailwind

```typescript
colors: {
  intent: { cta: "#1DB954", success: "#1DB954", confirm: "#1DB954",
            error: "#DC2626", neutral: "#0A0A0A", muted: "#6B7280" }
}
fontFamily: {
  heading: ["var(--font-fraunces)"],  // Fraunces 600/700
  body:    ["var(--font-dm)"],        // DM Sans 400/500/600
  sans:    ["DM Sans"],               // existant
  serif:   ["Sora"],                  // existant
}
```

### ESLint Guards (`.eslintrc.js`)

Interdits : hex colors directes, durées animation hardcodées, easings inline, `fetch()` dans les composants, `any` explicite.

---

## 14. Motion System (Framer Motion)

### `src/lib/motion/motion.ts` (`@frozen`)

```typescript
export const MOTION = {
  easing:   [0.22, 1, 0.36, 1],  // seule courbe dans tout le projet
  duration: { micro: 0.15, ui: 0.22, layout: 0.3 },
  scale:    { tap: 0.96, press: 0.98 },
  translate: { enterY: 12, exitY: -8 },
} as const;
```

### `src/lib/motion/presets.ts`

| Preset | Usage |
|--------|-------|
| `tap` | `whileTap` sur tout élément interactif |
| `fadeIn` | Entrée par opacité |
| `slideUp` | Entrée depuis le bas |
| `staggerContainer` | Parent d'une liste animée |
| `staggerItem` | Enfant du staggerContainer |
| `ctaFeedback` | Bouton CTA avec micro spring |

> **Règle** : Si l'utilisateur remarque l'effet → trop fort.

---

## 15. Composants UI Primitives

### `MotionTap.tsx`

Wrapper universel pour tout élément tappable. Props : `children`, `onClick`, `className`, `style`, `disabled`, `role`, `ariaLabel`.

### `Button.tsx`

```tsx
<Button intent="cta" size="md" variant="filled|ghost" onClick={...} disabled={...}>
  Réserver
</Button>
```

Zéro couleur hardcodée — tout via `getIntentColor(intent)`.

### `StatusBadge.tsx`

```tsx
<StatusBadge status="confirmed" size="sm" />
// confirmed → success (vert) | pending → muted (gris) | cancelled → error (rouge)
// 1 seul signal couleur
```

### `SlotsSkeleton.tsx`

```tsx
<SlotsSkeleton count={6} />
// grid grid-cols-3, animate-pulse
// count = expectedSlotCount depuis l'API → zéro CLS
```

### `ErrorState.tsx`

```tsx
<ErrorState type="network|business|unknown" onRetry={fn} />
// Jamais d'erreur brute. Message actionnable. Retry toujours présent.
// Logs côté infra uniquement.
```

Messages :
- `network` → "Connexion interrompue. Vérifiez votre connexion et réessayez."
- `business` → "Créneau non disponible. Choisissez un autre horaire."
- `unknown` → "Une erreur s'est produite. Réessayez dans quelques secondes."

### `BottomNav.tsx`

4 tabs, dot actif `layoutId`, `safe-area-inset-bottom` iPhone, backdrop-blur.

---

## 16. Composants Home

### `SalonHero.tsx`

Scroll horizontal snap-x, parallax `y:[0,-20]`, stagger entrée, images `priority + placeholder="blur"` (hero uniquement).

### `SalonList.tsx`

`staggerContainer + staggerItem`, layout horizontal/vertical.

### `SalonCard.tsx` (mis à jour v0.4.0)

```typescript
interface SalonCardData {
  // ...existants...
  remainingSlots?: number;   // backend UNIQUEMENT — jamais recalculé
  weeklyBookings?: number;   // pour preuve sociale (>= 20)
}

interface SalonCardProps {
  salon:     SalonCardData;
  highlight?: boolean;  // calculé par getBestSalonId() dans le parent
  onBook?:   (salon) => void;  // ouvre le drawer
}
```

Nouveaux comportements :
- `onHoverStart + onTapStart → preloadSlots(salon.id)` — préchauffage cache
- `highlight: true` → ring vert via `getIntentColor("cta")` (calculé en dehors)
- `weeklyBookings >= 20` → "🔥 20+ réservations cette semaine"
- `remainingSlots` → "{n} créneau(x) restant(s)" ou "Complet"

---

## 17. Composants Booking

### `BookingButton.tsx`

```
idle    → "Réserver"           vert
loading → "Réservation..." + spinner   gris
success → "Confirmé ✓"         vert (1 200ms → reset)
error   → "Réessayer"          rouge
```

Jamais de succès visuel avant réponse DB.

### `BookingDrawer.tsx` (nouveau v0.4.0)

Bottom sheet de réservation complète.

```
[ Header salon + fermeture ]
[ Service picker ]
[ Date picker 7 jours ]
[ Slots grid 3 colonnes ]
[ BookingButton 4 états ]
[ Résumé 2e ligne ]
```

Règles :
- `lockScroll/unlockScroll` sur mount/unmount (via useEffect + cleanup)
- `data null → <ErrorState type="network" />` — null ≠ zéro dispo
- Slots disabled : `opacity-40 + line-through + cursor-not-allowed`
- Auto-select si `slots.length === 1` + signal visuel "✓ sélectionné automatiquement"
- `SLOT_TAKEN → error.nextAvailableSlot → setSelectedDate(next) + setSelectedSlot(next)` synchrone
- `invalidateSlots(salon.id)` après succès confirmé
- Slots filtrés par date = filtre d'affichage (non recalcul)

**Interface complète du composant :**

```tsx
interface BookingDrawerProps {
  salon:     Salon;
  isOpen:    boolean;
  onClose:   () => void;
  onSuccess?: () => void;
}
```

### `BookingCard.tsx`

Hiérarchie : titre/prix = noir · statut = couleur (1 seul) · meta = gris. 3 actions : Détails | Message | Annuler.

### `Receipt.tsx`

Dark `#0A0A0A`, check circle (sans glow), séparateur dashed, total `getIntentColor("success")`. 2 CTA : "Contacter salon" + "Rebook".

---

## 18. Hooks Async UX

### `useAsyncAction.ts`

```typescript
const { execute, status, error, isLoading, isSuccess, isError } =
  useAsyncAction(fn, { timeoutMs: 10_000, softSuccessMs: 1_200 });
```

7 protections : double-click, timeout 10s, `mounted.current`, `safeTimeout` + cleanup, soft success, try/finally, useEffect cleanup.

### `useBookingAction.ts`

```typescript
const { execute, status, error } = useBookingAction();
await execute({ tenantId, serviceId, slotId, phone });
```

Protections supplémentaires :
- `AbortController` — annule la requête précédente, `AbortError` ignoré silencieusement
- **Idempotency key** : nulle → UUID au premier `execute`, survit aux retries, reset après succès uniquement
- `BookingError` typé depuis `@/types` : `code`, `message`, `type`, `nextAvailableSlot?`
- Erreurs : `SLOT_TAKEN → type:"business"` | `TIMEOUT → type:"network"` | autres → `type:"unknown"`

---

## 19. Services client-side

### `src/services/ranking.ts`

```typescript
// Perception distance non-linéaire
distanceScore(km) = 1 / (1 + km)
// 0km→1.0 | 1km→0.5 | 5km→0.17

buildScore(salon) = salon.rating × 0.6 + distanceScore(salon.distanceKm) × 0.4

getBestSalonId(salons): string | null
// Filtre remainingSlots > 0, trie par score, retourne le meilleur id
// Retourne null si aucun salon disponible
// Règle : 0 ou 1 highlight. Jamais 2+.
```

---

## 20. Scroll Lock

**`src/lib/scroll/scrollLock.ts`**

```typescript
lockScroll()    // overflow:hidden si lockCount === 0
unlockScroll()  // overflow:"" si lockCount === 0
```

Compteur de références : 2 drawers ouverts → scroll reste bloqué jusqu'aux 2 `unlockScroll`. Compense la largeur de scrollbar (`paddingRight`) pour éviter le layout shift. Restaure `scrollY` à l'unlock.

---

## 21. Typographie (Fonts)

**`src/app/fonts.ts`**

```typescript
export const fraunces = Fraunces({
  weight: ["600", "700"],  // heading uniquement — pas de 400
  display: "swap",         // critique LCP + SEO
  variable: "--font-fraunces",
});

export const dmSans = DM_Sans({
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-dm",
});
```

Variables CSS injectées dans `<html className={`${fraunces.variable} ${dmSans.variable}`}>`.

Usage Tailwind : `font-heading` (Fraunces) | `font-body` (DM Sans) | `font-sans` (DM Sans @import) | `font-serif` (Sora @import).

---

## 22. Système de téléphone (240+ pays)

```typescript
toE164(dial, local)      // anti double-indicatif
normalizePhone(raw, dial)
isValidLocalNumber(local, country)
splitE164(e164)
detectDefaultCountry()   // navigator.language → fallback SN
findCountryByISO / findCountryByDial
```

`PhoneInput` : recherche `+352` → strip `+` → Luxembourg. ARIA-compliant.

---

## 23. Ranking & géolocalisation

### Geocoding (`src/services/geocode.ts`)

Nominatim → fallback ville → fallback absolu Dakar. `lat`/`lng` toujours renseignés.

### Formule ranking serveur (6 facteurs)

```
relevance×0.25 + distance×0.20 + performance×0.20
+ personalization×0.20 + business×0.10 + freshness×0.05
```

### Ranking client (`src/services/ranking.ts`)

Scoring simplifié pour highlight côté client : `rating×0.6 + distanceScore×0.4`.

---

## 24. Système d'événements

```typescript
emitEvent(type, payload)  // fire-and-forget + EventLog
onEvent(type, handler)
```

Types : `booking.created/confirmed/cancelled`, `tenant.created/viewed`, `favorite.created`, `settings.updated`, `fraud.detected`.

Queue retry via `SELECT FOR UPDATE SKIP LOCKED`.

---

## 25. Détection de fraude

6 signaux. Score ≥ 80 → blocage auto. 50-79 → `UNDER_REVIEW`. < 50 → log.

---

## 26. i18n (fr / en)

URL : `/fr/*`, `/en/*`. Détection : cookie → Accept-Language → défaut `fr`.

```typescript
getTranslations("fr")  // Server Components
const { t, lang } = useLang()  // Client Components
```

---

## 27. SEO — pages locales + schema JSON-LD

### Pages `/[city]/[category]`

Route group `(city-seo)`. Phase 1 : Dakar uniquement. Guard `notFound()` si < 3 salons ou city = code langue.

```typescript
// Règle absolue : aucune donnée fictive dans le schema
buildRatingSchema(salon)
// → undefined si reviewCount < 5
// → { AggregateRating, ratingValue, reviewCount } si ≥ 5
```

Schema : `BeautySalon + PostalAddress + AggregateRating? + hasOfferCatalog (prix XOF réels)`.

Slots dynamiques via `<Suspense fallback={<SlotsSkeleton />}>`.

### Pages `/[lang]/salons/[city]/[category]` — 224 pages

2 langues × 14 villes × 8 catégories. Revalidate 10min.

---

## 28. Analytics & funnel tracking

```typescript
track("seo_page_view", { city, category })
track("seo_salon_click", { salonId })
track("seo_booking_start")
track("seo_booking_success")
track("seo_drop", { step })
track("seo_zero_results", { city, category })
```

Dev : `console.info`. Prod : brancher PostHog/GA4/Segment dans `sendEvent()`.

---

## 29. Admin Panel (7 vues)

| Vue | Données |
|-----|---------|
| Mission Control | Stats temps réel |
| Tenants | approve/block |
| Plans | sync quotas |
| Fraude | score + signaux |
| Équipe | membres plateforme |
| Logs | audit + DLQ (`dlq:*`) |
| Réglages | maintenance mode, fees |

---

## 30. Onboarding gérant

```
/profil → CTA "Ouvrir mon salon" (role=CLIENT)
  → /onboarding (4 étapes)
  → POST /api/tenants (atomic: Tenant + OWNER upgrade)
  → JWT frais → setAuth → /dashboard
```

---

## 31. Paiements Stripe Connect

`POST /api/stripe/connect` → onboarding · `POST /api/stripe/payment` → PaymentIntent · `POST /api/webhooks` → confirme booking.

---

## 32. Installation locale

```cmd
cd "C:\Users\papan\Downloads\belo-complete (2)\belo"
npm install
copy .env.example .env.local
npx prisma generate && npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
npm run dev
```

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | → `/fr` |
| `http://localhost:3000/login` | Connexion OTP |
| `http://localhost:3000/dakar/coiffeur` | Page SEO locale |
| `http://localhost:3000/fr/salons/dakar/hair` | Page SEO i18n |
| `http://localhost:3000/booking/[slug]` | Flow réservation + drawer |
| `http://localhost:3000/dashboard` | Dashboard gérant |
| `http://localhost:3000/admin` | Super Admin |

---

## 33. Variables d'environnement

```env
DATABASE_URL=postgresql://...?pgbouncer=true
DIRECT_URL=postgresql://...
JWT_SECRET=64-chars-hex
NEXT_PUBLIC_APP_URL=https://...vercel.app
CRON_SECRET=...

# Cache Redis (optionnel — mode dégradé si absent)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

WHATSAPP_PHONE_ID= · WHATSAPP_TOKEN=
STRIPE_SECRET_KEY= · STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
R2_ACCOUNT_ID= · R2_ACCESS_KEY= · R2_SECRET_KEY=
R2_BUCKET=belo-media · R2_PUBLIC_URL=https://cdn.belo.sn
```

---

## 34. Structure des dossiers

```
belo/
├── prisma/
│   ├── schema.prisma                   ← 21 modèles
│   └── migrations/                     ← 11 migrations (partial index inclus)
│
├── src/
│   ├── types/
│   │   └── index.ts                    ← @frozen — tous les types métier
│   │
│   ├── proxy.ts                        ← Middleware Next.js 16 (auth+i18n+rate)
│   │
│   ├── app/
│   │   ├── fonts.ts                    ← Fraunces + DM Sans (next/font)
│   │   ├── layout.tsx                  ← inject font variables CSS
│   │   ├── globals.css                 ← design tokens + spacing
│   │   ├── (public)/                   ← pages clients
│   │   ├── (city-seo)/[city]/[category]/ ← SEO local (≥3 salons)
│   │   ├── [lang]/                     ← pages i18n SSG
│   │   ├── onboarding/
│   │   ├── dashboard/
│   │   ├── admin/
│   │   └── api/
│   │
│   ├── lib/
│   │   ├── design/
│   │   │   └── intent.ts               ← @frozen — intent system
│   │   ├── motion/
│   │   │   ├── motion.ts               ← @frozen — MOTION constants
│   │   │   └── presets.ts              ← Framer Motion Variants
│   │   ├── cache/
│   │   │   └── slotCache.ts            ← client-side Map cache (SWR, dedup, retry)
│   │   ├── scroll/
│   │   │   └── scrollLock.ts           ← ref-counted, scrollbar compensation
│   │   ├── cache-engine.ts             ← L1+L2+L3 (serveur)
│   │   ├── lru-cache.ts
│   │   ├── redis.ts                    ← Upstash client, graceful null
│   │   ├── circuit-breaker.ts
│   │   ├── retry-engine.ts             ← Full Jitter + DLQ
│   │   ├── rate-limit.ts               ← sliding window Redis + DB fallback
│   │   ├── analytics.ts                ← track() 6 events funnel
│   │   ├── phone.ts                    ← 240+ pays E.164
│   │   ├── auth-client.ts
│   │   ├── route-auth.ts
│   │   ├── i18n.ts · i18n-server.ts
│   │   ├── events.ts · event-handlers.ts · event-queue.ts
│   │   ├── cors.ts · settings.ts
│   │   └── index.ts                    ← exports centralisés
│   │
│   ├── hooks/
│   │   ├── useAsyncAction.ts           ← 7 protections async
│   │   ├── useBookingAction.ts         ← AbortController + idempotency key
│   │   ├── useBooking.ts               ← state machine réservation
│   │   └── useLang.ts
│   │
│   ├── services/
│   │   ├── ranking.ts                  ← NEW — scoring client (distanceScore)
│   │   ├── booking.service.ts          ← 4 couches anti double-booking
│   │   ├── ranking.service.ts          ← 6 facteurs serveur
│   │   ├── trending.service.ts
│   │   ├── fraud.service.ts
│   │   ├── plan.service.ts
│   │   └── geocode.ts
│   │
│   ├── components/
│   │   ├── motion/
│   │   │   └── MotionTap.tsx           ← wrapper universel tappable
│   │   ├── ui/
│   │   │   ├── Button.tsx              ← intent-driven, ctaFeedback
│   │   │   ├── StatusBadge.tsx         ← status → intent
│   │   │   ├── SlotsSkeleton.tsx       ← grid-cols-3, count anti-CLS
│   │   │   ├── ErrorState.tsx          ← network|business|unknown + retry
│   │   │   ├── BottomNav.tsx           ← safe-area iPhone
│   │   │   ├── SalonCard.tsx           ← preload hover/tap, highlight, remainingSlots
│   │   │   ├── PhoneInput.tsx          ← 240+ pays
│   │   │   └── ...
│   │   ├── home/
│   │   │   ├── SalonHero.tsx           ← parallax, stagger, priority image
│   │   │   └── SalonList.tsx           ← stagger H/V
│   │   ├── bookings/
│   │   │   └── BookingCard.tsx         ← hiérarchie stricte
│   │   ├── checkout/
│   │   │   └── Receipt.tsx             ← dark card, no glow
│   │   └── booking/
│   │       ├── BookingButton.tsx       ← 4 états visuels
│   │       └── BookingDrawer.tsx       ← bottom sheet complet
│   │
│   ├── shared/
│   │   └── errors.ts                   ← AppError, handleRouteError
│   └── infrastructure/
│       └── db/prisma.ts
│
├── .eslintrc.js                        ← guards design system
├── tailwind.config.ts                  ← intent.* + heading/body fonts
├── next.config.js
├── vercel.json                         ← 5 cron jobs
└── .env.example
```

---

## 35. Plans tarifaires

| Plan | FCFA/mois | Bookings/mois | Services |
|------|-----------|---------------|---------|
| **Free** | 0 | 20 | 1 |
| **Pro** | 15 000 | 500 | 20 |
| **Premium** | 35 000 | Illimités | Illimités |

---

## 36. Déploiement Vercel

```bash
vercel --prod
```

Build : `prisma generate && prisma migrate deploy && next build`

Variables Vercel à configurer : `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `STRIPE_*`, `WHATSAPP_*`.

### Cron jobs

```json
{ "/api/cron/generate-slots": "0 2 * * *" },
{ "/api/cron/notifications":  "0 * * * *" },
{ "/api/cron/metrics":        "*/30 * * * *" },
{ "/api/cron/events":         "* * * * *" },
{ "/api/cron/purge-logs":     "0 3 * * 0" }
```

---

## 37. Bugs corrigés (historique)

### Mai 2026 — v0.4.0

| Bug | Cause | Fix |
|-----|-------|-----|
| TypeScript : `Property 'expectedCount' does not exist on type 'never'` | `slotsState?.expectedCount` dans un bloc `=== undefined` → TypeScript narrowe à `never` | `count={6}` constant, hors narrowing |
| `ringColor` not in `MotionStyle` | Framer Motion ne reconnaît pas `ringColor` comme CSS valide | Supprimer `ringColor`, garder uniquement `borderColor` |
| Double indicatif téléphone | `toE164` ne vérifie pas si `digits.startsWith(dial)` | Guard ajouté dans `toE164` |

### Mai 2026 — v0.3.0

| Bug | Cause | Fix |
|-----|-------|-----|
| Cache L2 toujours null | `get<CachePayload<T>>()` retourne string brute → `timestamp = undefined` → NaN comparisons → fallback L3 | `get<string>` + `safeParse<T>` explicite |
| Double-decrement `bookingsUsedMonth` | 2 annulations concurrentes | Re-lecture status dans transaction |
| Plan limit TOCTOU | Lu hors transaction | `SELECT FOR UPDATE` sur Tenant |
| Idempotency P2002 → SLOT_TAKEN | Mauvais mapping d'erreur | Re-fetch par `idempotencyKey` |
| Index DB incorrect | `@@unique([slotId, status])` permettait PENDING+CONFIRMED | Migration partial unique index |

### Mai 2026 — v0.2.0

| Bug | Fix |
|-----|-----|
| `POST /api/tenants → 500` | Mapping explicite colonnes Tenant (description/category absents du schéma) |
| Double indicatif `+221+221` | Guard `digits.startsWith(dial)` dans `toE164` |
| Recherche `+352` → 0 résultats | Strip `+` avant comparaison dial |
| `lat/lng` null | `geocodeAddress()` dans `POST /api/tenants` |

### Mars–Avril 2026 — v0.1.x

| Bug | Fix |
|-----|-----|
| Conflit `middleware.ts + proxy.ts` | Supprimer `middleware.ts` — `proxy.ts` suffit en Next.js 16 |
| CORS `ERR_INVALID_CHAR` | Supprimer commentaires inline dans `.env.local` |
| `NEXT_PUBLIC_APP_URL` undefined | Remplacer fetch par Prisma direct en Server Components |

---

*Dernière mise à jour : Mai 2026 — commit `2590ac2`*
