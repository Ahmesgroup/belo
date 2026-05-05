# Belo — Documentation technique v0.3.0

> SaaS beauté multi-tenant · Mise à jour : Mai 2026  
> **21 modèles Prisma · 306 pages SSG/ISR · Next.js 16 App Router**

---

## Table des matières

1. [Stack technique](#1-stack-technique)
2. [Architecture générale](#2-architecture-générale)
3. [Modèles Prisma (21)](#3-modèles-prisma-21)
4. [Pages & routes (306)](#4-pages--routes-306)
5. [Système d'authentification](#5-système-dauthentification)
6. [Booking Engine (production-ready)](#6-booking-engine-production-ready)
7. [Cache Engine (L1/L2/L3)](#7-cache-engine-l1l2l3)
8. [Circuit Breaker & Retry](#8-circuit-breaker--retry)
9. [Rate Limiting (Redis + DB)](#9-rate-limiting-redis--db)
10. [Design System](#10-design-system)
11. [Motion System (Framer Motion)](#11-motion-system-framer-motion)
12. [Composants UI](#12-composants-ui)
13. [Hooks Async UX](#13-hooks-async-ux)
14. [Système de téléphone (240+ pays)](#14-système-de-téléphone-240-pays)
15. [Ranking & géolocalisation](#15-ranking--géolocalisation)
16. [Système d'événements](#16-système-dévénements)
17. [Détection de fraude](#17-détection-de-fraude)
18. [i18n (fr / en)](#18-i18n-fr--en)
19. [SEO — pages locales + schema JSON-LD](#19-seo--pages-locales--schema-json-ld)
20. [Analytics & funnel tracking](#20-analytics--funnel-tracking)
21. [Admin Panel (7 vues)](#21-admin-panel-7-vues)
22. [Onboarding gérant](#22-onboarding-gérant)
23. [Paiements Stripe Connect](#23-paiements-stripe-connect)
24. [Installation locale](#24-installation-locale)
25. [Variables d'environnement](#25-variables-denvironnement)
26. [Structure des dossiers](#26-structure-des-dossiers)
27. [Plans tarifaires](#27-plans-tarifaires)
28. [Déploiement Vercel](#28-déploiement-vercel)
29. [Bugs corrigés (historique)](#29-bugs-corrigés-historique)

---

## 1. Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | **Next.js 16** App Router (Turbopack) |
| Base de données | **PostgreSQL Neon** (serverless, scale-to-zero) |
| ORM | **Prisma 5.22** |
| Cache | **LRU in-memory** (L1) + **Upstash Redis** (L2) + DB fallback (L3) |
| Auth | OTP WhatsApp + **JWT HS256** (jose, edge-compatible) |
| Paiements | **Stripe Connect** (marketplace) · Wave · Orange Money |
| Notifications | WhatsApp Cloud API (Meta) |
| Stockage | Cloudflare R2 |
| Hosting | **Vercel** (cron jobs intégrés) |
| CSS | **Tailwind CSS v3** + CSS variables (dark/light) |
| Animations | **Framer Motion 12** — système MOTION figé |
| TypeScript | Strict mode — aucun `any` non justifié |

---

## 2. Architecture générale

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
     │  /[lang]/*    │      │  /api/*         │      │               │
     └──────────┬────┘      └──────────┬──────┘      └───────────────┘
                │                      │
     ┌──────────▼────────────────────────────────────────────┐
     │                Cache Engine (L1 → L2 → L3)             │
     │   LRU in-memory (5s) · Upstash Redis (60s) · DB fetch  │
     └──────────────────────────┬────────────────────────────┘
                                │
     ┌──────────────────────────▼────────────────────────────┐
     │                    Services Layer                      │
     │  booking.service · ranking.service · trending.service  │
     │  fraud.service · plan.service · geocode               │
     └──────────────────────────┬────────────────────────────┘
                                │
     ┌──────────────────────────▼────────────────────────────┐
     │              Prisma Client → Neon PostgreSQL           │
     │                  21 modèles, indexes ciblés            │
     └───────────────────────────────────────────────────────┘
```

### Proxy (middleware Next.js 16)

`src/proxy.ts` est détecté automatiquement par Next.js 16 comme proxy middleware. Il gère :

- **Redirection langue** : `/` → `/fr` ou `/en`
- **Guard admin** : `/admin/*` → rôles ADMIN, SUPER_ADMIN
- **Guard dashboard** : `/dashboard/*` → rôles OWNER, STAFF, ADMIN, SUPER_ADMIN
- **Guard profil** : `/profil` → utilisateur connecté requis
- **Rate limit global** : `/api/*` → 100 req/min par identité (userId > cookie > IP)
- **Rate limit bookings** : `POST /api/bookings` → 5 créations / 10 s

> ⚠️ Ne pas créer de `middleware.ts` : conflit avec `proxy.ts` en Next.js 16.

---

## 3. Modèles Prisma (21)

| Modèle | Description |
|--------|-------------|
| `User` | Utilisateur (CLIENT · STAFF · OWNER · ADMIN · SUPER_ADMIN) |
| `Tenant` | Salon — slug unique, lat/lng, plan, statut |
| `Service` | Prestation d'un salon (catégorie, prix, durée, photos) |
| `Slot` | Créneau horaire généré par cron |
| `Booking` | Réservation (statut, acompte, paiement, idempotencyKey unique) |
| `Review` | Avis lié à une réservation (1:1) |
| `NotificationLog` | Log WhatsApp/SMS envoyés (outbox pattern) |
| `FraudAlert` | Alertes fraude (6 signaux, score 0-100) |
| `AuditLog` | Journal d'audit exhaustif + Dead Letter Queue |
| `EventLog` | Queue d'événements asynchrones (SKIP LOCKED) |
| `AdminNotification` | Inbox admin (nouveaux salons, fraudes) |
| `TenantMetrics` | Métriques dénormalisées (rating, conversion, rétention) |
| `TenantTrending` | Score tendance (bookings×3 + views + favorites×2) |
| `AdCampaign` | Campagnes publicitaires CPC |
| `GeoBid` | Enchères géographiques par ville |
| `UserPreference` | Préférences utilisateur (personnalisation ranking) |
| `Favorite` | Salons favoris par utilisateur |
| `Country` | Table des pays (ISO, nom, devise) |
| `City` | Villes avec slug SEO |
| `PaymentAccount` | Comptes paiement plateforme (Stripe, Wave) |
| `TenantPayout` | Historique des virements aux gérants |

### Indexes clés

```prisma
@@index([status])              // Tenant — filtrer actifs
@@index([plan, status])        // Tenant — listing par plan
@@index([lat, lng])            // Tenant — requêtes géospatiales Haversine
@@index([tenantId, startsAt])  // Slot — disponibilités
@@index([userId, status])      // Booking — historique client
@@index([status, processedAt]) // EventLog — queue SKIP LOCKED
```

### Index partiel anti double-booking (migration `20260508000000`)

```sql
-- Garantie DB : au plus 1 booking actif par slot
CREATE UNIQUE INDEX "unique_active_booking_per_slot"
    ON "Booking" ("slotId")
    WHERE status IN ('PENDING', 'CONFIRMED');
```

> L'ancien `@@unique([slotId, status])` permettait PENDING + CONFIRMED de coexister. L'index partiel est la seule garantie correcte.

---

## 4. Pages & routes (306)

### Pages statiques (SSG)

| Route | Type | Revalidate |
|-------|------|------------|
| `/fr`, `/en` | SSG | 2 min |
| `/fr/for-salons`, `/en/for-salons` | SSG | 1h |
| `/fr/plans`, `/en/plans` | SSG | 5 min |
| `/fr/salons/[city]/[category]` × 224 | SSG | 10 min |
| `/[city]/[category]` (Phase 1 : Dakar) | SSG | ISR |

### Pages dynamiques (SSR)

| Route | Description |
|-------|-------------|
| `/[lang]/salons` | Listing avec filtres geo |
| `/[lang]/salons/[city]` | Salons par ville |
| `/booking/[slug]` | Flow réservation salon |
| `/api/tenants/search` | Recherche géolocalisée + ranking |

### API Routes

```
GET  /api/tenants          → listing (cache L1+L2, TTL 60s)
POST /api/tenants          → créer salon + upgrade OWNER
GET  /api/tenants/[slug]   → profil salon (cache 5min)
PATCH /api/tenants/[id]    → modifier profil (gérant/admin)

POST /api/auth?action=send-otp    → envoi OTP WhatsApp
POST /api/auth?action=verify-otp  → vérification + JWT

GET  /api/bookings         → liste réservations
POST /api/bookings         → créer réservation (idempotent)
PATCH /api/bookings        → accept/refuse (gérant)

GET  /api/slots            → créneaux disponibles
POST /api/slots            → créer créneaux (gérant)

POST /api/services         → ajouter service
PATCH /api/services/[id]   → modifier service
DELETE /api/services/[id]  → désactiver service

POST /api/stripe/connect   → onboarding Stripe Connect
POST /api/stripe/payment   → paiement acompte
POST /api/webhooks         → events Stripe

GET  /api/admin/tenants    → liste tous les salons (admin)
GET  /api/admin/fraud      → alertes fraude
GET  /api/admin/logs       → audit log
GET  /api/admin/notifications → inbox admin
PATCH /api/admin/settings  → config plateforme

/api/cron/generate-slots   → génère les créneaux (cron)
/api/cron/notifications    → rappels WhatsApp (cron)
/api/cron/metrics          → recalcul métriques (cron)
/api/cron/events           → traite queue EventLog
/api/cron/purge-logs       → purge logs > 90 jours
```

---

## 5. Système d'authentification

### Flow OTP

```
1. Client → POST /api/auth?action=send-otp { phone: "+221771234567" }
2. Serveur génère code 6 chiffres, l'envoie via WhatsApp Cloud API
3. Client → POST /api/auth?action=verify-otp { phone, otp }
4. Serveur vérifie, crée/trouve le User, signe JWT HS256 (7j)
5. Réponse → { accessToken, refreshToken, user }
6. Client stocke dans localStorage (belo_token + belo_user)
```

### JWT payload

```typescript
{
  sub:      string,   // userId
  role:     string,   // CLIENT | OWNER | STAFF | ADMIN | SUPER_ADMIN
  tenantId: string?,  // null pour CLIENT
  iat:      number,
  exp:      number    // 7 jours
}
```

### Guard côté client (`src/lib/auth-client.ts`)

```typescript
getToken()           // JWT depuis localStorage
getUser()            // BeloUser depuis localStorage
setAuth(token, user) // persiste token + user
clearAuth()          // logout
isOwner()            // OWNER ou STAFF
isAdmin()            // SUPER_ADMIN ou ADMIN
authHeaders()        // { Authorization: "Bearer ..." }
```

### Guard côté serveur (`src/lib/route-auth.ts`)

```typescript
withAuth(req)                     // parse JWT (cookie ou header)
withRole(auth, ["OWNER", ...])    // vérifie le rôle
withTenant(auth, tenantId)        // vérifie l'accès cross-tenant
withActiveTenant(auth, tenantId)  // vérifie ACTIVE + ownership
signJWT({ sub, role, tenantId })  // signe un nouveau JWT
```

---

## 6. Booking Engine (production-ready)

### Défense en profondeur — 4 couches anti double-booking

```
Couche 1 : Domain rules    — validateBookingCreation() pure, fail fast
Couche 2 : SELECT FOR UPDATE — Tenant lock PUIS Slot lock (ordre constant)
Couche 3 : Double-check    — findFirst après lock dans la transaction
Couche 4 : Index partiel DB — UNIQUE (slotId) WHERE status IN ('PENDING','CONFIRMED')
```

### Ordre des locks (deadlock-free)

```
Toujours : Tenant (lock 1) → Slot (lock 2)
Jamais inverser cet ordre.
```

### Timeouts de lock

```typescript
// Dans la transaction — empêche de tenir des locks indéfiniment
await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
```

### Idempotency

```typescript
// 1. Fast-path avant la transaction (optimiste)
const existing = await prisma.booking.findUnique({ where: { idempotencyKey } });
if (existing) return existing;

// 2. P2002 après transaction → distingue les deux cas
} catch (err) {
  if (isPrismaP2002(err)) {
    const idempotent = await prisma.booking.findUnique({ where: { idempotencyKey } });
    if (idempotent) return idempotent;  // clé en collision → réponse idempotente
    throw new AppError("SLOT_TAKEN", "...");  // index slot → créneau pris
  }
}
```

### Plan limit race condition (fix)

Sans le lock tenant, deux requêtes concurrentes à `bookingsUsedMonth = 499` (limite 500) peuvent toutes les deux passer la vérification et dépasser le plan. Le `FOR UPDATE` sur le Tenant serialise les accès.

---

## 7. Cache Engine (L1/L2/L3)

### Architecture triple couche

```
L1 : LRU in-memory    TTL ~5 s    (par instance, 0 ms de latence)
L2 : Upstash Redis    TTL 30–120s (distribué entre instances)
L3 : DB fetcher       Fallback toujours disponible
```

### `src/lib/cache-engine.ts`

```typescript
CacheEngine.get(key, fetcher, { ttl: 60 })
// L1 hit → ~0ms | L2 hit → ~5ms | L3 → DB + write-through

CacheEngine.invalidate(key)
// Supprime L1 + L2

CacheEngine.invalidatePattern("belo:tenants:*")
// Clear L1 + DEL Redis par pattern (SCAN O(N) — OK phase 1)
```

### Patterns implémentés

| Pattern | Détail |
|---------|--------|
| **Stale-While-Revalidate** | Retourne stale immédiatement + revalide en background |
| **Anti-thundering herd** | `SET NX` lock + jitter 50–150 ms avant fetch L3 |
| **Versioning** | `minVersion` pour read-after-write consistency |
| **safeParse** | Désérialisation explicite avec logging — `get<string>` + `JSON.parse` |

### `src/lib/lru-cache.ts`

LRU 500 entrées max, TTL par entrée, singleton `globalThis` (survit aux hot-reloads).

### `src/lib/redis.ts`

Client Upstash REST. Si `UPSTASH_REDIS_REST_URL` / `TOKEN` vides → `redis = null` → mode DB-only sans erreur. Ping de vérification en développement.

### Cache sur `GET /api/tenants`

Clé = `belo:tenants:{city}:{plan}:{category}:{search}:{page}:{pageSize}` — chaque combinaison unique est cachée. Invalidé automatiquement après `POST /api/tenants`.

---

## 8. Circuit Breaker & Retry

### `src/lib/circuit-breaker.ts`

```
CLOSED  → < 5 failures → exécution normale
OPEN    → ≥ 5 failures → fallback immédiat (30s cooldown)
HALF-OPEN → 1 requête test → succès = CLOSED | échec = OPEN
```

Les erreurs métier (`SLOT_TAKEN`, `UNAUTHORIZED`, `NOT_FOUND`, etc.) **ne déclenchent pas** le breaker — seules les pannes infrastructure comptent.

```typescript
const { data, degraded } = await withCircuitBreaker(
  "neon-db",
  () => fetchData(),
  fallbackData,
);
```

### `src/lib/retry-engine.ts`

Stratégie **Full Jitter** (AWS 2015) — `delay = random(0, min(maxDelay, base × 2^attempt))`.

```typescript
// Retry simple
await withRetry(fn, { maxAttempts: 3, baseDelayMs: 100 });

// Retry + Dead Letter Queue automatique
await withRetryAndDLQ("job.type", payload, fn, { maxAttempts: 3 });
```

### Dead Letter Queue

Les jobs échoués après tous les retries sont persistés dans `AuditLog` avec `action = "dlq:*"`. Consultables via le panel admin (vue Logs, filtre `dlq`).

---

## 9. Rate Limiting (Redis + DB)

### `src/lib/rate-limit.ts`

**Identité multi-critères** (par ordre de priorité) :
```
userId authentifié > session cookie (hash 8 octets) > IP > "unknown"
```

**Backend Redis** : sliding window via `ZADD + ZCARD` — pas de burst au reset de fenêtre.

**Backend DB** : fixed window via `AuditLog` — fallback si Redis absent.

```typescript
rateLimit(req, { max: 100, windowMs: 60_000 })
// Utilisé par proxy.ts sur /api/*

rateLimitByKey("booking:user:123", { max: 5, windowMs: 10_000 })
// Clé arbitraire pour POST /api/bookings

rateLimitByPhone("+221771234567", { max: 3, windowMs: 120_000 })
// OTP : clé = numéro de téléphone (anti-DoS par IP partagée)
```

### Quotas configurés

| Endpoint | Limite | Fenêtre |
|----------|--------|---------|
| `/api/*` global | 100 req | 1 min |
| `POST /api/bookings` | 5 req | 10 s |
| OTP send | 3 req | 2 min |
| OTP verify | 5 req | 15 min |
| `POST /api/tenants` | 5 req | 1 h |

---

## 10. Design System

### Intent System — `src/lib/design/intent.ts`

**RÈGLE ABSOLUE : Le vert `#1DB954` n'existe que sous ces intentions. Jamais en décoration.**

```typescript
type Intent = "cta" | "success" | "confirm" | "neutral" | "muted" | "error";

getIntentColor(intent)  // → "#1DB954" | "#0A0A0A" | "#6B7280" | "#DC2626"
getIntentBg(intent)     // → tinte à 10% d'opacité pour les surfaces
```

### Tokens Tailwind — `tailwind.config.ts`

```typescript
colors: {
  intent: {
    cta:     "#1DB954",
    success: "#1DB954",
    confirm: "#1DB954",
    error:   "#DC2626",
    neutral: "#0A0A0A",
    muted:   "#6B7280",
  }
}
// Usage : bg-intent-cta, text-intent-error, border-intent-muted
```

### ESLint Guards — `.eslintrc.js`

```javascript
// Interdit dans le code produit :
// 1. Hex colors directes dans les styles inline
// 2. Durées d'animation hardcodées (utiliser MOTION.duration.*)
// 3. Courbes easing inline (utiliser MOTION.easing)
```

Exemption automatique pour `src/lib/motion/*.ts` et `src/lib/design/*.ts`.

---

## 11. Motion System (Framer Motion)

### `src/lib/motion/motion.ts`

**@frozen — Ne pas modifier sans validation équipe.**

```typescript
export const MOTION = {
  easing:   [0.22, 1, 0.36, 1],  // Seule courbe dans tout le projet
  duration: {
    micro:  0.15,  // tap feedback — imperceptible
    ui:     0.22,  // transitions UI
    layout: 0.3,   // shared elements
  },
  scale: {
    tap:   0.96,
    press: 0.98,
  },
  translate: {
    enterY: 12,
    exitY:  -8,
  },
} as const;
```

### `src/lib/motion/presets.ts`

Variants Framer Motion prêts à l'emploi. **Importer ces presets — jamais définir de Variants inline.**

| Preset | Usage |
|--------|-------|
| `tap` | `whileTap` sur tout élément cliquable |
| `press` | État "maintenu pressé" |
| `fadeIn` | Entrée par opacité |
| `slideUp` | Entrée depuis le bas (cards, modals) |
| `staggerContainer` | Parent d'une liste animée |
| `staggerItem` | Enfant du staggerContainer |
| `ctaFeedback` | Bouton CTA avec micro spring |

### Règle motion

> **Si l'utilisateur remarque l'effet → trop fort.**  
> Motion = feedback invisible, jamais décoration.

---

## 12. Composants UI

### `src/components/motion/MotionTap.tsx`

Wrapper universel pour tout élément tappable. Garantit tap feedback < 100ms.

```tsx
<MotionTap onClick={handler} className="..." style={...}>
  {children}
</MotionTap>
```

### `src/components/ui/Button.tsx`

```tsx
<Button intent="cta" size="md" variant="filled" onClick={...}>
  Réserver
</Button>
// intent: "cta" | "confirm"
// size: "sm" | "md" | "lg"
// variant: "filled" | "ghost"
```

Aucune couleur hardcodée — tout passe par `getIntentColor(intent)`.

### `src/components/ui/StatusBadge.tsx`

```tsx
<StatusBadge status="confirmed" size="sm" />
// confirmed → intent success (vert)
// pending   → intent muted (gris)
// cancelled → intent error (rouge)
// 1 seul signal couleur par badge
```

### `src/components/home/SalonHero.tsx`

- Scroll horizontal snap-x mandatory
- Cards `85vw × 400px`, `borderRadius: 24px`
- Gradient overlay dark pour lisibilité texte
- Badge rating glass effect (backdrop-blur)
- **Micro-parallax** `y: [0, -20]` via `useScroll + useTransform`
- Images Next.js avec `priority` et `placeholder="blur"` (hero uniquement)
- Stagger à l'entrée

### `src/components/home/SalonList.tsx`

- `staggerContainer` + `staggerItem` sur chaque card
- Layout `"horizontal"` (snap scroll) ou `"vertical"`
- 1 seul signal couleur par card : la disponibilité

### `src/components/bookings/BookingCard.tsx`

Hiérarchie visuelle stricte :
```
titre     → noir (text)
prix      → noir bold (text)
statut    → couleur (1 seul signal via StatusBadge)
meta      → gris (text3)
```

3 actions : Détails | Message | Annuler (selon disponibilité).

### `src/components/checkout/Receipt.tsx`

- Background `#0A0A0A` (dark card)
- Check circle vert — **sans glow effect**
- Séparateur `border-dashed`
- Total en `getIntentColor("success")`
- 2 CTA : "Contacter salon" + "Rebook"

### `src/components/ui/BottomNav.tsx`

- 4 tabs : Accueil, Recherche, Réservations, Profil
- Dot actif vert avec `layoutId` (animation fluide entre tabs)
- `paddingBottom: env(safe-area-inset-bottom)` — **critique iPhone**
- `backdrop-blur-xl` sur fond blanc semi-transparent

---

## 13. Hooks Async UX

### `src/hooks/useAsyncAction.ts`

Socle de tout état async dans Belo. 7 protections obligatoires :

```typescript
const { execute, status, error, isLoading, isSuccess, isError } =
  useAsyncAction(fn, { timeoutMs: 10_000, softSuccessMs: 1_200 });
```

| Protection | Implémentation |
|-----------|----------------|
| Double-click bloqué | `if (status === "loading") return null` |
| Timeout 10 s auto-error | `Promise.race([fn(), timeoutPromise])` |
| Pas de setState unmount | `mounted.current` ref |
| Cleanup timers | `safeTimeout` avec Set de timers + cleanup useEffect |
| Soft success | Reset idle après `softSuccessMs` (1 200 ms) |

### `src/hooks/useBookingAction.ts`

Étend useAsyncAction avec :

```typescript
const { execute, status, error } = useBookingAction();
await execute({ tenantId, serviceId, slotId, phone });
```

**AbortController** — annule la requête précédente à chaque `execute()`. Les `AbortError` sont ignorés silencieusement.

**Idempotency Key** — règle critique :
```
La clé NE SE RESET PAS sur erreur.
Un retry doit envoyer la MÊME clé.
Reset UNIQUEMENT après succès confirmé.
Violer = double booking possible.
```

**SLOT_TAKEN** → message actionnable "Ce créneau vient d'être pris. Choisissez un autre horaire." (conversion préservée).

### `src/components/booking/BookingButton.tsx`

```tsx
<BookingButton status={status} onClick={execute} fullWidth />
```

États visuels :
```
idle    → "Réserver"           (vert #1DB954)
loading → "Réservation..." + spinner (gris)
success → "Confirmé ✓"         (vert, 1 200ms puis reset)
error   → "Réessayer"          (rouge)
```

**Jamais de succès visuel avant réponse DB confirmée.**

---

## 14. Système de téléphone (240+ pays)

### `src/lib/phone.ts`

240+ pays : Afrique en premier (marché primaire), Europe, Amériques, Moyen-Orient, Asie, Océanie.

```typescript
toE164(dial, local)
// Anti double-indicatif : si local commence déjà par le dial code, ne pas le réajouter
// toE164("221", "+221 77...") → "+22177..." ✓
// toE164("221", "77 123 456") → "+22177123456" ✓

normalizePhone(raw, dialDefault)
isValidLocalNumber(local, country)
splitE164(e164) → { country, local }
detectDefaultCountry() → navigator.language → fallback SN
findCountryByISO("LU") → Luxembourg
findCountryByDial("352") → Luxembourg
```

### `src/components/ui/PhoneInput.tsx`

- Dropdown recherchable (nom FR, EN, ISO, indicatif)
- Recherche `"+352"` → strip `+` → `"352"` → Luxembourg ✓
- Validation live avec indicateur visuel
- ARIA-compliant (aria-invalid = `"true"/"false"` en string)

---

## 15. Ranking & géolocalisation

### Geocoding (`src/services/geocode.ts`)

```
1. Nominatim (OpenStreetMap) — timeout 4s
2. Fallback CITY_COORDS locale (table de 15 villes)
3. Partial match sur le slug
4. Défaut absolu : Dakar (14.7167, -17.4677)
```

`lat` et `lng` toujours renseignés — garantit que les requêtes Haversine fonctionnent.

### Formule ranking (6 facteurs)

```
score = relevance×0.25 + distance×0.20 + performance×0.20
      + personalization×0.20 + business×0.10 + freshness×0.05
```

```typescript
searchRanked({ lat, lng, city, query, category, userId, page, pageSize })
→ Promise<RankedTenant[]>
```

---

## 16. Système d'événements

Architecture event-driven synchrone (sans Redis).

```typescript
emitEvent(type, payload)   // fire-and-forget + persistance EventLog
onEvent(type, handler)     // enregistre un handler
```

Types : `booking.created`, `booking.confirmed`, `booking.cancelled`, `tenant.created`, `tenant.viewed`, `favorite.created`, `settings.updated`, `fraud.detected`

Queue de retry via `SELECT FOR UPDATE SKIP LOCKED` — 3 tentatives max, délai ×2.

---

## 17. Détection de fraude

### `src/services/fraud.service.ts`

| Signal | Seuil | Score |
|--------|-------|-------|
| Réservations rapides (< 10min) | > 5 | +20 |
| Multi-numéros même IP | > 3 | +25 |
| Taux no-show | > 40% | +20 |
| Cross-tenant | > 10 | +30 |
| Fréquence IP | > 20/h | +15 |
| Montant suspect | > 100k FCFA | +10 |

Score ≥ 80 → blocage auto. Score 50-79 → `UNDER_REVIEW`. Score < 50 → log.

---

## 18. i18n (fr / en)

```
/fr           → landing page français
/en           → landing page anglais
/fr/salons    → listing FR
/fr/for-salons → page B2B FR
/fr/plans     → tarifs FR
```

`getTranslations("fr")` côté serveur. `useLang()` côté client. 5 namespaces : `common`, `booking`, `dashboard`, `for_salons`, `plans`.

Détection langue dans `proxy.ts` : cookie `belo_lang` → Accept-Language → défaut `fr`.

---

## 19. SEO — pages locales + schema JSON-LD

### Pages `[lang]/salons/[city]/[category]` — 224 pages

```
2 langues × 14 villes × 8 catégories = 224 pages SSG (revalidate: 10min)
```

### Pages `/[city]/[category]` — SEO local (phase 1)

Route group `(city-seo)` pour éviter le conflit avec `[lang]`. URLs : `/dakar/coiffeur`, `/dakar/barber`, etc.

```typescript
// Générées uniquement si salons >= 3 actifs (évite les pages fines)
export async function generateStaticParams() {
  // Phase 1 : Dakar uniquement
  // Phase 2 : expansion autres villes
}
```

Guard : si `city` est un code langue (`fr`, `en`, `ar`, `wo`) → `notFound()`.

### Schema JSON-LD — règle absolue

```typescript
/**
 * RÈGLE ABSOLUE SEO
 * Aucune donnée fictive dans le schema.
 * Pas de fallback. Pas de valeur par défaut.
 * Absence > mensonge.
 * Google croise avec Maps et autres sources.
 */

function buildRatingSchema(salon) {
  // Minimum 5 bookings pour afficher un rating
  if (!salon.rating || salon.reviewCount < 5) return undefined;
  return { "@type": "AggregateRating", ratingValue, reviewCount };
}
```

Schema par salon : `BeautySalon` + `PostalAddress` + `AggregateRating` (si ≥5) + `hasOfferCatalog` avec prix réels en XOF.

### Slots dynamiques

```tsx
<Suspense fallback={<SlotsSkeleton />}>
  <SalonListSeoClient city={city} category={category} />
</Suspense>
// Slots = dynamiques (temps réel, non bloquants)
// Page = statique (SSG + ISR)
```

---

## 20. Analytics & funnel tracking

### `src/lib/analytics.ts`

```typescript
track("seo_page_view",      { city, category })  // arrivée sur page SEO
track("seo_salon_click",    { salonId })          // clic sur un salon
track("seo_booking_start")                        // début de réservation
track("seo_booking_success")                      // booking confirmé
track("seo_drop",           { step })             // abandon de funnel
track("seo_zero_results",   { city, category })   // page sans salons
```

En développement : `console.info("[BELO:track]", event, props)`.

En production : brancher ici PostHog / GA4 / Segment dans `sendEvent()`.

---

## 21. Admin Panel (7 vues)

Route : `/admin` — ADMIN et SUPER_ADMIN uniquement.

| Vue | Données |
|-----|---------|
| Mission Control | Stats temps réel : salons, bookings, revenus, fraudes |
| Tenants | Liste tous les salons, approve/block |
| Plans | Gestion plans, sync quotas |
| Fraude | Alertes avec score et signaux |
| Équipe | Membres plateforme |
| Logs | Journal d'audit + DLQ (filtre `dlq:*`) |
| Réglages | Maintenance mode, fees, limits |

---

## 22. Onboarding gérant

```
CLIENT → /profil → CTA "Ouvrir mon salon"
  ↓
/onboarding (4 étapes)
  1. Nom + description
  2. Adresse + ville + pays
  3. Téléphone + WhatsApp + email
  4. Catégorie
  ↓
POST /api/tenants
  → normalise phone E.164
  → geocodeAddress (Nominatim + fallback)
  → transaction atomique : Tenant + User.role = OWNER
  → retourne JWT frais (role=OWNER, tenantId)
  ↓
setAuth(newToken, { ...user, role: "OWNER", tenantId })
router.replace("/dashboard")
```

---

## 23. Paiements Stripe Connect

```
Client → acompte → Belo collecte
Belo → virement → Compte gérant (Express)
```

`POST /api/stripe/connect` → onboarding URL · `POST /api/stripe/payment` → PaymentIntent · `POST /api/webhooks` → confirm booking

---

## 24. Installation locale

```cmd
cd "C:\Users\papan\Downloads\belo-complete (2)\belo"
npm install
copy .env.example .env.local
```

Remplir `.env.local` (section 25), puis :

```cmd
npx prisma generate
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
npm run dev
```

### URLs clés

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | → redirect `/fr` |
| `http://localhost:3000/fr` | Landing page |
| `http://localhost:3000/login` | Connexion OTP |
| `http://localhost:3000/onboarding` | Créer salon |
| `http://localhost:3000/profil` | Profil client |
| `http://localhost:3000/dashboard` | Dashboard gérant |
| `http://localhost:3000/admin` | Super Admin |
| `http://localhost:3000/dakar/coiffeur` | Page SEO locale |
| `http://localhost:3000/fr/salons/dakar/hair` | Page SEO i18n |
| `http://localhost:3000/booking/studio-elegance-dakar` | Flow réservation |

---

## 25. Variables d'environnement

```env
# ── Base de données (Neon PostgreSQL) ──────────────────────────
DATABASE_URL=postgresql://user:pass@host/db?pgbouncer=true&sslmode=require
DIRECT_URL=postgresql://user:pass@host/db?sslmode=require

# ── Auth ───────────────────────────────────────────────────────
JWT_SECRET=64-chars-minimum-hex-string
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d

# ── App ────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://votre-domaine.vercel.app
NODE_ENV=production
CRON_SECRET=votre-secret-cron-vercel

# ── Cache Redis (Upstash) — laisser vide = mode dégradé DB-only
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# ── WhatsApp Cloud API (OTP + confirmations) ───────────────────
WHATSAPP_PHONE_ID=
WHATSAPP_TOKEN=
WHATSAPP_TEMPLATE_OTP=otp_code
WHATSAPP_TEMPLATE_CONFIRM=booking_confirm

# ── Stripe Connect (marketplace) ──────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# ── Paiements mobiles (optionnels) ────────────────────────────
WAVE_API_KEY=
ORANGE_MONEY_KEY=

# ── Cloudflare R2 (photos salons) ─────────────────────────────
R2_ACCOUNT_ID=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=belo-media
R2_PUBLIC_URL=https://cdn.belo.sn

# ── Dev uniquement ────────────────────────────────────────────
# OTP_DEV_BYPASS=123456
```

> ⚠️ Pas de commentaire inline sur les valeurs `.env` — cause `ERR_INVALID_CHAR`.

---

## 26. Structure des dossiers

```
belo/
├── prisma/
│   ├── schema.prisma                  ← 21 modèles
│   ├── seed.ts                        ← Données de test
│   └── migrations/                    ← 11 migrations versionnées
│       └── 20260508000000_partial_unique_slot_booking/
│
├── src/
│   ├── proxy.ts                       ← Middleware Next.js 16 (auth + i18n + rate limit)
│   │
│   ├── lib/
│   │   ├── design/
│   │   │   └── intent.ts              ← Intent system (@frozen)
│   │   ├── motion/
│   │   │   ├── motion.ts              ← MOTION constants (@frozen)
│   │   │   └── presets.ts             ← Framer Motion Variants prêts à l'emploi
│   │   ├── cache-engine.ts            ← L1+L2+L3, SWR, anti-stampede, safeParse
│   │   ├── lru-cache.ts               ← LRU 500 entrées, TTL, globalThis singleton
│   │   ├── redis.ts                   ← Upstash client, mode dégradé si unconfigured
│   │   ├── circuit-breaker.ts         ← CLOSED/OPEN/HALF-OPEN via Redis
│   │   ├── retry-engine.ts            ← Full Jitter + DLQ via AuditLog
│   │   ├── rate-limit.ts              ← Sliding window Redis + DB fallback
│   │   ├── analytics.ts               ← track() — 6 events funnel SEO
│   │   ├── phone.ts                   ← 240+ pays, E.164, validation
│   │   ├── auth-client.ts             ← getToken, getUser, setAuth, clearAuth
│   │   ├── route-auth.ts              ← withAuth, withRole, signJWT
│   │   ├── i18n.ts                    ← Traductions fr/en (5 namespaces)
│   │   ├── i18n-server.ts             ← getTranslations() Server Components
│   │   ├── events.ts                  ← emitEvent / onEvent + EventLog
│   │   ├── cors.ts                    ← getCorsHeaders() allowlist
│   │   ├── settings.ts                ← getAllSettings() cache 30s
│   │   └── index.ts                   ← Exports centralisés
│   │
│   ├── hooks/
│   │   ├── useAsyncAction.ts          ← Socle async (7 protections)
│   │   ├── useBookingAction.ts        ← AbortController + idempotency key
│   │   ├── useBooking.ts              ← State machine réservation
│   │   └── useLang.ts                 ← Langue courante côté client
│   │
│   ├── app/
│   │   ├── globals.css                ← Design tokens CSS + spacing scale + motion
│   │   │
│   │   ├── (public)/                  ← Pages clients
│   │   │   ├── page.tsx               ← redirect("/fr")
│   │   │   ├── login/                 ← Connexion OTP
│   │   │   ├── profil/                ← Profil client + CTA salon
│   │   │   ├── booking/[slug]/        ← Flow réservation
│   │   │   ├── salons/                ← Listing public
│   │   │   ├── plans/
│   │   │   └── pour-les-salons/
│   │   │
│   │   ├── (city-seo)/                ← Route group SEO local
│   │   │   └── [city]/[category]/
│   │   │       ├── page.tsx           ← SSG SEO, JSON-LD, ≥3 salons guard
│   │   │       └── SalonListSeoClient.tsx ← Slots dynamiques (Suspense)
│   │   │
│   │   ├── [lang]/                    ← Pages i18n SSG/ISR
│   │   │   ├── page.tsx               ← Landing Wolt-level
│   │   │   ├── salons/[city]/[category]/  ← 224 pages SSG
│   │   │   ├── for-salons/
│   │   │   └── plans/
│   │   │
│   │   ├── onboarding/                ← Création salon 4 étapes
│   │   ├── dashboard/                 ← Espace gérant
│   │   ├── admin/                     ← Panel admin (7 vues)
│   │   └── api/                       ← Route handlers
│   │
│   ├── components/
│   │   ├── motion/
│   │   │   └── MotionTap.tsx          ← Wrapper universel tappable
│   │   ├── ui/
│   │   │   ├── Button.tsx             ← Intent-driven, ctaFeedback motion
│   │   │   ├── StatusBadge.tsx        ← Status → intent mapping
│   │   │   ├── BottomNav.tsx          ← 4 tabs, dot actif, safe-area iPhone
│   │   │   ├── Nav.tsx                ← Navigation desktop/mobile
│   │   │   ├── PhoneInput.tsx         ← 240+ pays, recherche, validation
│   │   │   ├── SalonCard.tsx          ← Card premium avec badges
│   │   │   └── SectionRow.tsx         ← Scroll horizontal snap
│   │   ├── home/
│   │   │   ├── SalonHero.tsx          ← Horizontal snap, parallax, stagger
│   │   │   └── SalonList.tsx          ← Stagger vertical/horizontal
│   │   ├── bookings/
│   │   │   └── BookingCard.tsx        ← Hiérarchie stricte, 3 actions
│   │   ├── checkout/
│   │   │   └── Receipt.tsx            ← Dark card, check circle, total vert
│   │   ├── booking/
│   │   │   └── BookingButton.tsx      ← 4 états visuels, spinner, AnimatePresence
│   │   ├── SearchBar.tsx
│   │   ├── CookieBanner.tsx
│   │   ├── ThemeInit.tsx
│   │   └── LangSync.tsx
│   │
│   ├── services/
│   │   ├── booking.service.ts         ← createBooking (4 couches anti double-booking)
│   │   ├── ranking.service.ts         ← searchRanked() 6 facteurs
│   │   ├── trending.service.ts
│   │   ├── fraud.service.ts
│   │   ├── plan.service.ts
│   │   └── geocode.ts
│   │
│   ├── shared/
│   │   └── errors.ts                  ← AppError, AppErrors, handleRouteError
│   │
│   └── infrastructure/
│       └── db/prisma.ts               ← PrismaClient singleton
│
├── .eslintrc.js                       ← Guards design system
├── tailwind.config.ts                 ← intent.* tokens + CSS variables
├── next.config.js                     ← Headers sécurité, images CDN
├── vercel.json                        ← Cron jobs
└── .env.example                       ← Toutes les variables
```

---

## 27. Plans tarifaires

| Plan | FCFA/mois | EUR/mois | Bookings/mois | Services |
|------|-----------|----------|---------------|---------|
| **Free** | 0 | 0 | 20 | 1 |
| **Pro** | 15 000 | ~23 € | 500 | 20 |
| **Premium** | 35 000 | ~53 € | Illimités | Illimités |

---

## 28. Déploiement Vercel

```bash
vercel --prod
```

Build : `prisma generate && prisma migrate deploy && next build`

Variables supplémentaires à ajouter dans Vercel pour activer le cache Redis :
```
UPSTASH_REDIS_REST_URL   = https://...upstash.io
UPSTASH_REDIS_REST_TOKEN = ...
```

Sans ces variables, l'app fonctionne en mode DB-only (aucune erreur).

### Cron jobs (vercel.json)

```json
{ "path": "/api/cron/generate-slots",  "schedule": "0 2 * * *"   },
{ "path": "/api/cron/notifications",   "schedule": "0 * * * *"   },
{ "path": "/api/cron/metrics",         "schedule": "*/30 * * * *" },
{ "path": "/api/cron/events",          "schedule": "* * * * *"   },
{ "path": "/api/cron/purge-logs",      "schedule": "0 3 * * 0"   }
```

---

## 29. Bugs corrigés (historique)

### Mai 2026 — v0.3.0

| Bug | Cause | Fix |
|-----|-------|-----|
| Cache L2 toujours null | `setex(key, str)` → `get<T>()` retourne la string brute, `cached.timestamp` = `undefined` → toutes comparaisons NaN → fallback L3 systématique | `get<string>` + `safeParse<T>` avec logging + stockage `JSON.stringify` explicite |
| Pipeline count casting fragile | `results?.[2] as number` — Upstash peut retourner autre chose | `Number(results?.[2] ?? 0)` coerce proprement |
| Double-decrement `bookingsUsedMonth` | Deux annulations concurrentes lisaient `PENDING`, passaient `canCancelBooking`, décrémentaient toutes les deux | Re-lecture du status **dans la transaction**, return si déjà `CANCELLED` |
| Plan limit TOCTOU | `bookingsUsedMonth` lu hors transaction → 2 requêtes concurrentes à limit-1 passaient toutes les deux | `SELECT ... FOR UPDATE` sur Tenant dans la transaction |
| Idempotency race → mauvais code 409 | `findUnique` hors transaction → deux requêtes avec même clé → P2002 mappé en `SLOT_TAKEN` | Catch P2002 → re-fetch par `idempotencyKey` pour distinguer les cas |
| Contrainte DB incorrecte | `@@unique([slotId, status])` permettait PENDING + CONFIRMED sur le même slot | Migration `20260508000000` : partial unique index `WHERE status IN ('PENDING','CONFIRMED')` |
| Framer Motion absent | Package non installé → import error | `npm install framer-motion@^12` |

### Mai 2026 — v0.2.0

| Bug | Cause | Fix |
|-----|-------|-----|
| `POST /api/tenants → 500` | `description`/`category` Zod spreadés dans `prisma.create()` — pas de colonnes Tenant | Mapping explicite des colonnes uniquement |
| Double indicatif `+221+221...` | `toE164` ne vérifiait pas le préfixe | Guard `digits.startsWith(dial)` |
| Recherche `+352` → 0 résultats | `"352".includes("+352") = false` | Strip `+` avant comparaison |
| `lat`/`lng` null | Aucun appel à `geocodeAddress` | Ajout geocoding dans `POST /api/tenants` |
| `aria-invalid` ARIA invalide | Booléen JSX non accepté | `"true" \| "false"` en string |
| Role CLIENT après onboarding | Conséquence du 500 API | Résolu par le fix API + `setAuth(newToken)` |

### Mars–Avril 2026 — v0.1.x

| Bug | Fix |
|-----|-----|
| Conflit `middleware.ts` + `proxy.ts` | Supprimer `middleware.ts`, `proxy.ts` suffit en Next.js 16 |
| CORS `ERR_INVALID_CHAR` | Supprimer commentaires inline dans `.env.local` |
| `NEXT_PUBLIC_APP_URL` undefined Vercel | Remplacer `fetch(URL/api/...)` par requêtes Prisma directes en Server Components |
| Plans nested keys TypeScript | Aplatir en `t("plans.free_name")` |

---

*Dernière mise à jour : Mai 2026 — commit `20cffca`*
