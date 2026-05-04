# Belo — Documentation Technique

> Marketplace SaaS multi-tenant de réservation de salons de beauté.
> Marchés : Afrique + Europe. Déployée sur Vercel, base de données Neon PostgreSQL.
> Production : **https://belo-khaki.vercel.app**

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Stack technique](#2-stack-technique)
3. [Architecture globale](#3-architecture-globale)
4. [Arborescence du projet](#4-arborescence-du-projet)
5. [Modèle de données — 21 modèles](#5-modèle-de-données--21-modèles)
6. [Authentification & Sécurité](#6-authentification--sécurité)
7. [Système d'événements](#7-système-dévénements)
8. [Ranking Engine](#8-ranking-engine)
9. [Trending Engine](#9-trending-engine)
10. [Ads Engine](#10-ads-engine)
11. [Fraud Engine](#11-fraud-engine)
12. [Admin Control Panel](#12-admin-control-panel)
13. [i18n — Routing multilingue & SEO](#13-i18n--routing-multilingue--seo)
14. [Géolocalisation & Dataset pays/villes](#14-géolocalisation--dataset-paysvilles)
15. [RGPD & Cookie Consent](#15-rgpd--cookie-consent)
16. [Stripe Connect — Marketplace Payments](#16-stripe-connect--marketplace-payments)
17. [Flux de navigation](#17-flux-de-navigation)
18. [API Routes — référence complète](#18-api-routes--référence-complète)
19. [Contrôle d'accès par rôle (RBAC)](#19-contrôle-daccès-par-rôle-rbac)
20. [PWA — Bouton d'installation](#20-pwa--bouton-dinstallation)
21. [Variables d'environnement](#21-variables-denvironnement)
22. [Installation & Développement](#22-installation--développement)
23. [Déploiement Vercel](#23-déploiement-vercel)
24. [Maintenance DB](#24-maintenance-db)
25. [Annexe — Décisions d'architecture](#25-annexe--décisions-darchitecture)

---

## 1. Vue d'ensemble

**Belo** est une marketplace SaaS de réservation de salons de beauté. Positionnement : Google + Wolt + Fresha dans un seul produit.

| Aspect | Détail |
|---|---|
| Modèle | Marketplace multi-tenant (1 salon = 1 tenant) |
| Marchés | Sénégal · Côte d'Ivoire · Maroc · France · Belgique · Luxembourg |
| Paiements | Wave · Orange Money · Stripe Connect (marketplace) |
| Notifications | WhatsApp (outbox pattern) |
| Langues | Français · Anglais (`/fr/*` · `/en/*`) |
| Plans | FREE · PRO · PREMIUM |
| Ranking | Geo + quality metrics + trending + ad boost |
| SEO | SSG par ville/catégorie : `/fr/salons/dakar/coiffure` |

---

## 2. Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Framework | Next.js App Router | 16.2.4 |
| Runtime | React | 18 |
| Langage | TypeScript strict | 5 |
| ORM | Prisma | 5.13 |
| Base de données | PostgreSQL Neon serverless | — |
| Auth JWT | jose | 5.2 |
| Validation | Zod | 3.23 |
| CSS | Tailwind CSS + CSS variables (light/dark) | 3.4 |
| Déploiement | Vercel | — |
| Stockage médias | Cloudflare R2 | — |

> **Pas de NextAuth, pas de Redis.** JWT maison (OTP WhatsApp), event queue via PostgreSQL EventLog.

---

## 3. Architecture globale

```mermaid
graph TB
    subgraph Client["Navigateur / PWA"]
        UI[React App · Next.js 16]
        LS[(localStorage<br/>token · user · lang · consent)]
    end

    subgraph Edge["Edge — proxy.ts"]
        PX[JWT verify · RBAC<br/>Lang detection → /fr /en]
    end

    subgraph SSG["SSG / ISR Pages"]
        LP[/fr /en — Landing 2min]
        FS[/fr/for-salons — B2B 1h]
        PL[/fr/plans — Tarifs 5min]
        SC[/fr/salons/dakar/coiffure — 10min]
    end

    subgraph API["API Routes"]
        SEARCH[/api/tenants/search<br/>Geo + Ranking SQL]
        BOOK[/api/bookings]
        PAY[/api/payments + /api/stripe/*]
        FAV[/api/favorites]
        ADMIN[/api/admin/*]
        CRON[/api/cron/*]
    end

    subgraph EventSystem["Event System"]
        EB[events.ts · emitEvent]
        EL[(EventLog DB — retry)]
        EH[event-handlers.ts]
    end

    subgraph Services["Business Logic"]
        RS[ranking.service.ts]
        TS[trending.service.ts]
        FS2[fraud.service.ts]
        BS[booking.service.ts]
    end

    subgraph DB["Neon PostgreSQL — 21 modèles"]
        PRI[(Prisma ORM)]
    end

    UI --> Edge --> API
    UI --> SSG --> PRI
    API --> Services --> PRI
    API --> EB --> EL
    EB --> EH --> TS --> PRI
    EH --> FS2 --> PRI
```

---

## 4. Arborescence du projet

```
belo/
├── src/
│   ├── proxy.ts                     # Edge RBAC + lang detection (Next.js 16)
│   ├── app/
│   │   ├── layout.tsx               # Root + ThemeInit + LangProvider + CookieBanner
│   │   ├── globals.css              # CSS variables light/dark
│   │   ├── sitemap.ts               # Sitemap multilingue /fr/* /en/*
│   │   │
│   │   ├── [lang]/                  # Routes publiques SEO (SSG/ISR)
│   │   │   ├── layout.tsx           # generateMetadata hreflang + canonical + LangSync
│   │   │   ├── page.tsx             # Landing — Prisma direct, ISR 2min, Tailwind
│   │   │   ├── for-salons/page.tsx  # B2B sales — 8 sections, ISR 1h
│   │   │   ├── plans/
│   │   │   │   ├── page.tsx         # Server wrapper + generateMetadata
│   │   │   │   └── PlansClient.tsx  # Toggle FR/EN + prix live
│   │   │   └── salons/
│   │   │       ├── page.tsx         # /[lang]/salons — listing Prisma direct
│   │   │       ├── [city]/
│   │   │       │   ├── page.tsx     # /[lang]/salons/dakar — ISR 5min
│   │   │       │   └── [category]/
│   │   │       │       └── page.tsx # /fr/salons/dakar/coiffure — ISR 10min
│   │   │
│   │   ├── (public)/               # Routes legacy (redirects → [lang])
│   │   │   ├── page.tsx            # redirect → /fr
│   │   │   ├── login/page.tsx      # OTP + PhoneInput sélecteur pays
│   │   │   ├── booking/[slug]/     # Réservation 4 étapes (use() params)
│   │   │   ├── plans/page.tsx      # redirect → /fr/plans
│   │   │   ├── pour-les-salons/    # redirect → /fr/for-salons
│   │   │   └── profil/page.tsx     # Profil client
│   │   │
│   │   ├── dashboard/              # Espace gérant (OWNER · STAFF · ADMIN)
│   │   │   ├── layout.tsx          # Auth guard + notif badge PENDING
│   │   │   ├── page.tsx            # KPIs + quota
│   │   │   ├── bookings/page.tsx   # Accept/Refuse · toast · pulseSoft
│   │   │   ├── services/ horaires/ profil/ equipe/
│   │   │   └── stripe/             # Onboarding Stripe Connect
│   │   │
│   │   ├── admin/page.tsx          # Control Panel 7 vues
│   │   │
│   │   └── api/
│   │       ├── auth/route.ts
│   │       ├── bookings/route.ts
│   │       ├── tenants/
│   │       │   ├── route.ts        # GET · POST → tenant.created event
│   │       │   ├── [slug]/route.ts
│   │       │   └── search/route.ts # Geo + ranking SQL (ISR 30s)
│   │       ├── favorites/route.ts  # GET · POST · DELETE → trending
│   │       ├── payments/route.ts
│   │       ├── plans/route.ts
│   │       ├── slots/ services/ staff/ upload/ webhooks/
│   │       ├── stripe/
│   │       │   ├── connect/route.ts  # Express account + onboarding URL
│   │       │   └── payment/route.ts  # PaymentIntent + platform fee
│   │       ├── admin/
│   │       │   ├── tenants/ fraud/ logs/ team/ settings/
│   │       │   ├── notifications/
│   │       │   └── stream/route.ts   # EventLog polling 5s
│   │       └── cron/
│   │           ├── events/           # Retry EventLog (2min)
│   │           ├── metrics/route.ts  # Recalcule TenantMetrics (daily)
│   │           ├── notifications/    # Worker outbox WhatsApp
│   │           ├── generate-slots/
│   │           └── purge-logs/
│   │
│   ├── components/
│   │   ├── ThemeInit.tsx
│   │   ├── CookieBanner.tsx         # RGPD — Tailwind, consent cookie 13 mois
│   │   ├── LangSync.tsx             # Syncs [lang] → LangContext
│   │   ├── SearchBar.tsx            # City autocomplete + useTransition
│   │   └── ui/
│   │       ├── Nav.tsx              # PublicNav (i18n) + DashboardNav (badge)
│   │       ├── PhoneInput.tsx       # Sélecteur pays
│   │       └── LangSwitcher.tsx     # Switch /fr ↔ /en
│   │
│   ├── lib/
│   │   ├── auth-client.ts           # getToken · getUser · setAuth · clearAuth
│   │   ├── auth-guard.ts            # resolveRedirect() · DASHBOARD_ROLES
│   │   ├── route-auth.ts            # withAuth · withRole · withTenant · withActiveTenant
│   │   ├── events.ts                # emitEvent() · onEvent() + EventLog write
│   │   ├── event-handlers.ts        # Registre centralisé handlers
│   │   ├── event-queue.ts           # processEventQueue() · getQueueHealth()
│   │   ├── domain-events.ts         # DomainEvents factory (DDD)
│   │   ├── audit.ts                 # createAuditLog() centralisé
│   │   ├── settings.ts              # getAllSettings() · cache 30s · requireNotMaintenance()
│   │   ├── api-fetch.ts             # apiFetch() credentials:include
│   │   ├── i18n.ts                  # Traductions FR/EN (5 namespaces)
│   │   ├── i18n-server.ts           # getTranslations(lang) · SEO_META
│   │   ├── i18n-localize.ts         # getLocalized({fr,en}, lang)
│   │   ├── lang-context.tsx         # LangProvider (initialLang prop)
│   │   ├── payment.ts               # canUsePayment()
│   │   └── cors.ts                  # getCorsHeaders() allowlist
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── booking.service.ts       # + emitEvent booking.created/cancelled
│   │   ├── fraud.service.ts         # 6 signaux · auto-block ≥80
│   │   ├── plan.service.ts          # syncPlanToTenants · resetTenantQuota
│   │   ├── ranking.service.ts       # searchRanked() — Haversine SQL + score
│   │   └── trending.service.ts      # onBooking/View/FavoriteForTrending()
│   │
│   └── infrastructure/
│       ├── db/prisma.ts
│       ├── providers/payment.ts
│       └── queue/worker.ts
│
├── prisma/
│   ├── schema.prisma                # 21 modèles
│   ├── seed.ts
│   └── migrations/
│       ├── 20260501_init/
│       ├── 20260502_add_auditlog_ratelimit_index/
│       ├── 20260502_add_tenant_horaires/
│       ├── 20260502_add_plan_config/
│       ├── 20260504_admin_enhancements/
│       ├── 20260504_event_log_and_notifications/
│       ├── 20260505_geo_payments/
│       ├── 20260506_stripe_favorites/
│       └── 20260507_ranking_ads/    # TenantMetrics · TenantTrending · AdCampaign · GeoBid
│
└── tailwind.config.ts               # CSS-variable tokens (bg, text, g1, g2…)
```

---

## 5. Modèle de données — 21 modèles

### Vue d'ensemble

| Modèle | Rôle |
|---|---|
| `Tenant` | Salon — lat/lng geo · stripeAccountId · plan · status |
| `User` | Client / Owner / Staff / Admin — UserPreference |
| `Service` | Prestation d'un salon |
| `Slot` | Créneau horaire |
| `Booking` | Réservation — idempotency · stripePaymentIntentId |
| `NotificationLog` | Outbox WhatsApp/SMS (SKIP LOCKED) |
| `Review` | Avis client 1–5 ★ |
| `Favorite` | Wishlist client (userId × tenantId unique) |
| `FraudAlert` | Alerte fraude — riskScore · signals JSON |
| `AuditLog` | Immuable — toutes les actions |
| `EventLog` | Persistence + retry des événements (pending→processed) |
| `AdminNotification` | Inbox admins (tenant.created · fraud≥60) |
| `PlanConfig` | Prix FCFA/EUR/USD + limits JSON + features JSON |
| `SystemSetting` | Config plateforme (maintenance · commission · providers) |
| `Country` | 11 pays — name Json · phoneCode · currency |
| `City` | 14 villes — name Json · slug unique · countryCode FK |
| `PaymentAccount` | Comptes Belo (Wave/Stripe/OM) — isPlatform=true |
| `TenantPayout` | Infos payout salon (Phase 2+) |
| `TenantMetrics` | ratingAvg · conversionRate · retentionRate · noShowRate |
| `TenantTrending` | bookings24h · views24h · favorites24h · score |
| `AdCampaign` | bidCents · budgetCents · spentCents · GeoBid[] |
| `UserPreference` | favoriteCategories[] · favoriteCities[] |
| `GeoBid` | bidModifier par ville par campagne |

### Champs Tenant — principaux

```prisma
model Tenant {
  // Geo (ranking)
  lat  Float?
  lng  Float?

  // Stripe Connect
  stripeAccountId          String?
  stripeOnboardingComplete Boolean @default(false)

  // Relations ranking
  metrics     TenantMetrics?
  trending    TenantTrending?
  adCampaigns AdCampaign[]
}
```

### Modèles ranking

```prisma
model TenantMetrics {
  tenantId       String @unique
  ratingAvg      Float  @default(5.0)
  conversionRate Float  @default(0.0)   // bookings / views
  retentionRate  Float  @default(0.0)   // returning / total
  noShowRate     Float  @default(0.0)   // no-shows / confirmed
}

model TenantTrending {
  tenantId     String @unique
  bookings24h  Int    @default(0)
  views24h     Int    @default(0)
  favorites24h Int    @default(0)
  score        Float  @default(0.0)   // bookings×3 + views×1 + favorites×2
}

model AdCampaign {
  bidCents     Int @default(0)
  budgetCents  Int @default(0)
  spentCents   Int @default(0)
  targetCPA    Int?
  isActive     Boolean @default(true)
  geoBids      GeoBid[]
}
```

---

## 6. Authentification & Sécurité

### Flux OTP

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant L as Login
    participant A as /api/auth
    participant DB as PostgreSQL

    U->>L: Numéro (PhoneInput sélecteur pays)
    L->>L: normalizePhone() → E.164
    L->>A: send-otp → rateLimitByPhone(3/2min) → hash + AuditLog
    A-->>U: WhatsApp OTP (10 min)
    U->>A: verify-otp → UPSERT User(CLIENT) → signJWT
    A->>A: Set httpOnly cookie belo_token (7j)
    A-->>L: { accessToken, user }
    L->>L: localStorage + router.replace(resolveRedirect(user))
```

### proxy.ts — Interception Edge

```
/           → detectLang(Accept-Language + cookie) → redirect /fr ou /en
/admin      → ADMIN | SUPER_ADMIN (cookie JWT)
/dashboard  → OWNER | STAFF | ADMIN | SUPER_ADMIN
/profil     → authentifié
/api/admin  → ADMIN | SUPER_ADMIN + header injection
```

---

## 7. Système d'événements

### Architecture — synchrone + persistant

```
emitEvent("booking.created", payload)
    │
    ├── 1. INSERT EventLog (pending) — fire-and-forget
    └── 2. Handlers synchrones
              ├── createAuditLog()
              ├── onBookingForTrending()    ← NEW
              ├── runFraudCheck()           (booking.cancelled / payment.failed)
              ├── AdminNotification         (tenant.created / fraud≥60)
              └── invalidateSettingsCache   (settings.updated)
```

### Tous les événements

| Event | Payload | Déclenché par |
|---|---|---|
| `tenant.blocked` | tenantId · adminId · reason | Admin / fraud engine |
| `tenant.activated` | tenantId · adminId | Admin |
| `tenant.created` | tenantId · tenantName · ownerId | POST /api/tenants |
| `plan.updated` | plan · changes · adminId | PATCH /api/plans |
| `payment.failed` | bookingId · tenantId | Webhook |
| `booking.created` | bookingId · tenantId · userId · priceCents | createBooking() |
| `booking.cancelled` | bookingId · tenantId · reason | cancelBooking() |
| `fraud.detected` | tenantId · riskScore · signals | fraud.service |
| `settings.updated` | keys · adminId | PATCH /api/admin/settings |
| `favorite.created` | tenantId · userId | POST /api/favorites |
| `tenant.viewed` | tenantId · userId? | GET /api/tenants/:slug |

### EventLog — retry (cron 2 min)

```
pending → processing → processed ✓
                    └→ pending  (retry < maxRetries=3)
                    └→ failed ✗
```

---

## 8. Ranking Engine

### Formule de score (SQL, single round-trip)

```sql
score =
  (1.0 / (haversine_distance_km + 0.01)) × 0.30   -- proximité géo
  + (ratingAvg / 5.0)                             × 0.20   -- qualité
  + conversionRate                                × 0.20   -- conversion
  + retentionRate                                 × 0.20   -- rétention
  - noShowRate                                    × 0.10   -- pénalité
  + LEAST(0.1, bidCents / 10000.0)                × 0.10   -- boost pub
  + planBoost (PREMIUM +0.05, PRO +0.02)
```

### Distance Haversine (PostgreSQL)

```sql
6371.0 * acos(
  LEAST(1.0,
    cos(radians($lat)) * cos(radians(t.lat))
    * cos(radians(t.lng) - radians($lng))
    + sin(radians($lat)) * sin(radians(t.lat))
  )
) AS distance_km
```

`LEAST(1.0, …)` — protection contre les erreurs de domaine `acos()` dues à l'arrondi float.

### Optimisation des index

```sql
-- Pré-filtre bounding-box (utilise l'index)
WHERE lat BETWEEN $lat-delta AND $lat+delta
  AND lng BETWEEN $lng-delta AND $lng+delta

-- Puis Haversine sur le sous-ensemble filtré
```

### Utilisation

```typescript
import { searchRanked } from "@/services/ranking.service";

const { tenants, total } = await searchRanked({
  lat:      14.7167,
  lng:      -17.4677,
  city:     "dakar",
  category: "hair",
  radius:   10,       // km
  pageSize: 20,
});
// → tenants triés par score décroissant
// → chaque tenant a: distance, ratingAvg, score
```

---

## 9. Trending Engine

### Score temps réel

```
trending_score = bookings24h × 3 + views24h × 1 + favorites24h × 2
```

### Mise à jour via événements

| Événement | Action |
|---|---|
| `booking.created` | `bookings24h++` puis recalcul score |
| `favorite.created` | `favorites24h++` puis recalcul score |
| `tenant.viewed` | `views24h++` puis recalcul score |

### Reset quotidien

Le cron `/api/cron/metrics` (daily 03h00) remet tous les compteurs à zéro.

---

## 10. Ads Engine

### Modèles

```prisma
AdCampaign { bidCents, budgetCents, spentCents, targetCPA, isActive }
GeoBid     { campaignId, citySlug, bidModifier }
```

### Ad boost dans le ranking

```sql
+ LEAST(0.1, MAX(ac.bidCents)::FLOAT / 10000.0) * 0.1
```

Le boost est **plafonné à 0.1** dans le score total — un bon salon sans pub aura toujours un meilleur score qu'un mauvais salon avec une forte enchère.

### Roadmap Ads

| Phase | Fonctionnalité |
|---|---|
| Phase 1 ✅ | Boost dans le ranking SQL |
| Phase 2 | Budget pacing (expected = heure/24 × budget) |
| Phase 3 | Smart bidding : `newBid = currentBid × (targetCPA / currentCPA)` |
| Phase 4 | Time-of-day optimization (HourlyPerformance) |

---

## 11. Fraud Engine

### Score 0–100, 6 signaux

| Signal | Condition | Poids |
|---|---|---|
| `high_cancellations_24h` | > 5 annulations/24h | +8 par excès |
| `high_cancellation_rate_30d` | Taux > 40% | jusqu'à +30 |
| `quota_gaming_suspected` | Quota élevé + peu de bookings | +20 |
| `booking_velocity_spike` | > 20 créations/1h | +3/excès |
| `existing_fraud_alert` | Alerte active > 50 | +30% du score existant |
| `cross_tenant_canceller` | User annule ≥ 2 autres tenants/24h | +5/user |

```
score 0–29  → clean
score 30–59 → NEW FraudAlert
score 60–79 → AdminNotification ⚠️
score ≥ 80  → auto-block → status = FRAUD
```

---

## 12. Admin Control Panel

### 7 vues

| Vue | Données | Actions |
|---|---|---|
| Mission Control | KPIs · EventLog stream 5s | Valider PENDING |
| Tenants | Filtrable · statut coloré | validate · block · change_plan |
| Plans | Prix + limits + features | Éditer · syncPlanToTenants |
| Fraude | FraudAlert · 6 signaux | Enquêter · Clore |
| Équipe | Admins · lastLogin | Voir rôles |
| Logs | AuditLog paginé | Filtrer |
| Réglages | Maintenance · commission · providers | Sauvegarder |

---

## 13. i18n — Routing multilingue & SEO

### Architecture URL

```
/                    → redirect /fr ou /en (proxy Edge)
/fr                  → Landing FR  ● SSG 2min
/en                  → Landing EN  ● SSG 2min
/fr/for-salons       → B2B FR      ● SSG 1h
/en/for-salons       → B2B EN      ● SSG 1h
/fr/plans            → Tarifs FR   ● SSG 5min
/en/plans            → Tarifs EN   ● SSG 5min
/fr/salons           → Listing FR  ƒ Server
/fr/salons/dakar     → Ville FR    ● SSG 5min
/fr/salons/dakar/coiffure → Ville+Catégorie ● SSG 10min
```

### Namespaces i18n (i18n.ts)

| Namespace | Clés |
|---|---|
| `common` | nav · hero · search · categories · cta |
| `booking` | how_title · steps · slots · confirmation |
| `dashboard` | login · plans labels |
| `for_salons` | badge · hero · social_proof · features · FAQ · CTA |
| `plans` | toggle · plan names · features |

### Helpers

```typescript
// Server Component
const t = getTranslations("en");
t("for_salons.hero_title")  // → "Join Belo —"

// Client Component
const { t } = useLang();
t("hero_title")  // → "Beauty, booked"

// Champs bilingues DB
getLocalized(city.name, "en")  // { fr:"Dakar", en:"Dakar" } → "Dakar"
```

---

## 14. Géolocalisation & Dataset

### 11 pays · 14 villes intégrés

| Pays | Code | Villes |
|---|---|---|
| Sénégal | SN +221 XOF | Dakar, Thiès |
| Côte d'Ivoire | CI +225 XOF | Abidjan |
| Maroc | MA +212 MAD | Casablanca, Rabat |
| France | FR +33 EUR | Paris, Lyon |
| Belgique | BE +32 EUR | Bruxelles |
| Luxembourg | LU +352 EUR | Luxembourg |

### Coordonnées Tenant

```prisma
model Tenant {
  lat Float?  // décimal degrés
  lng Float?
  // index: WHERE lat IS NOT NULL AND lng IS NOT NULL
}
```

---

## 15. RGPD & Cookie Consent

### CookieBanner

- Consent stocké dans `localStorage(belo_cookie_consent)` + cookie `belo_consent`
- Expiration 13 mois (conformité GDPR §7)
- 3 catégories : `essential` · `analytics` · `marketing`

### Cookies auth

| Cookie | Attributs | Durée |
|---|---|---|
| `belo_token` | `HttpOnly; Secure; SameSite=Lax` | 7 jours |
| `belo_refresh` | `HttpOnly; Secure; SameSite=Lax; Path=/api/auth` | 30 jours |
| `belo_consent` | `SameSite=Lax` | 13 mois |

---

## 16. Stripe Connect — Marketplace Payments

### Flux paiement

```
Phase 1 (actuel) :  Client → Belo encaisse tout (aucun transfer)
Phase 2 :           Admin déclenche payout manuel → TenantPayout.accountNumber
Phase 3 :           Cron calcule commission → virement automatique
```

### API Stripe

```typescript
// Créer compte Express + onboarding URL
POST /api/stripe/connect
→ { url: "https://connect.stripe.com/...", accountId: "acct_xxx" }

// Vérifier statut
GET /api/stripe/connect
→ { connected, onboardingComplete, chargesEnabled, payoutsEnabled }

// PaymentIntent avec platform fee
POST /api/stripe/payment
body: { bookingId, returnUrl }
→ { clientSecret, paymentIntentId, amountCents, platformFeeCents }
```

### Commission

Commission lue depuis `SystemSetting("commission_percent")` (défaut : 3%).
Conversion XOF → EUR : `1 EUR ≈ 655.957 XOF`.

---

## 17. Flux de navigation

### Client → Réservation

```mermaid
flowchart TD
    A([Visiteur]) --> B[/ → /fr Landing SSG]
    B --> C[SearchBar → /fr/salons?city=dakar]
    C --> D[/fr/salons/dakar/coiffure SSG]
    D --> E[/booking/:slug]
    E --> F{Token ?}
    F -- Non --> G[/login OTP]
    G --> H[POST /api/bookings → emitEvent booking.created]
    H --> I[trending++ · audit · fraud check]
    H --> J[Étape 4 ✅]
```

### Gérant → Onboarding

```mermaid
flowchart TD
    A[Login OWNER] --> B[/dashboard]
    B --> C[Profil + Services + Horaires]
    B --> D[/dashboard/stripe → POST /api/stripe/connect]
    D --> E[Stripe Express Onboarding]
    E --> F[GET /api/stripe/connect → onboardingComplete=true]
```

---

## 18. API Routes — référence complète

### Recherche & Tenants

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/tenants` | — | Liste ACTIVE · Cache 2min |
| `POST` | `/api/tenants` | CLIENT | Inscription → `tenant.created` |
| `GET` | `/api/tenants/:slug` | — | Profil + services |
| `PATCH` | `/api/tenants/:slug` | OWNER | Màj profil |
| `GET` | `/api/tenants/search` | — | **Geo + ranking SQL** · params: `lat lng city category radius` |

### Réservations & Paiements

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/bookings` | CLIENT | Crée · idempotent · requireNotMaintenance |
| `GET` | `/api/bookings?tenantId=` | OWNER | Liste salon |
| `PATCH` | `/api/bookings` | OWNER | CONFIRMED / CANCELLED · tx atomique |
| `POST` | `/api/payments?action=init` | CLIENT | Wave / OM / Stripe |
| `POST` | `/api/stripe/connect` | OWNER | Crée Express account |
| `GET` | `/api/stripe/connect` | OWNER | Statut onboarding |
| `POST` | `/api/stripe/payment` | CLIENT | PaymentIntent + platform fee |
| `POST` | `/api/webhooks` | HMAC | Wave · Orange · Stripe |

### Favoris & Social

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/favorites` | CLIENT | Liste favoris ou `?tenantId=` check |
| `POST` | `/api/favorites` | CLIENT | Ajoute · `favorite.created` → trending |
| `DELETE` | `/api/favorites?tenantId=` | CLIENT | Supprime |

### Admin

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/tenants` | ADMIN | Liste + stats |
| `POST` | `/api/admin/tenants?action=do-action` | ADMIN | validate · block · change_plan · … |
| `GET/PATCH` | `/api/admin/fraud` | ADMIN | Alertes fraude |
| `GET` | `/api/admin/logs` | ADMIN | AuditLog paginé |
| `GET/PATCH` | `/api/admin/settings` | SUPER | Config + `settings.updated` |
| `GET/PATCH` | `/api/admin/notifications` | ADMIN | Inbox + mark read |
| `GET` | `/api/admin/stream` | ADMIN | EventLog feed polling 5s |
| `GET/PATCH` | `/api/plans` | —/ADMIN | Tarifs + limits/features |

### Cron jobs

| Endpoint | Fréquence | Description |
|---|---|---|
| `/api/cron/events` | `*/2 * * * *` | Retry EventLog (SKIP LOCKED) |
| `/api/cron/metrics` | `0 3 * * *` | Recalcule TenantMetrics + reset trending |
| `/api/cron/notifications` | `*/1 * * * *` | Worker outbox WhatsApp |
| `/api/cron/generate-slots` | `0 2 * * *` | Créneaux J+14 |
| `/api/cron/purge-logs` | `0 3 * * 0` | Archive NotificationLog |

---

## 19. Contrôle d'accès par rôle (RBAC)

### `resolveRedirect()` post-login

```
SUPER_ADMIN → /admin
ADMIN       → /dashboard
OWNER       → /dashboard
STAFF       → /dashboard
CLIENT      → /profil
```

### Limites par plan

| Fonctionnalité | FREE | PRO | PREMIUM |
|---|---|---|---|
| Bookings/mois | 20 | 500 | Illimités |
| Services | 3 | 20 | Illimités |
| Staff | 0 | 5 | Illimités |
| Photos/service | 3 | 10 | 50 |
| Dépôt / acompte | ✗ | ✓ | ✓ |
| WhatsApp auto | ✗ | ✓ | ✓ |
| Analytics | ✗ | ✗ | ✓ |
| Stripe Connect | ✗ | ✓ | ✓ |
| API Webhook | ✗ | ✗ | ✓ |

---

## 20. PWA — Bouton d'installation

```tsx
// InstallPWA.tsx — mobile uniquement, masqué si déjà installé
// iOS Safari : message manuel "Partager → Ajouter à l'écran d'accueil"
```

---

## 21. Variables d'environnement

```bash
# Base de données
DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"

# Auth
JWT_SECRET="min-32-chars"
JWT_EXPIRES_IN="7d"
REFRESH_TOKEN_EXPIRES_IN="30d"

# App
NEXT_PUBLIC_APP_URL="https://belo-khaki.vercel.app"
CRON_SECRET="secret"

# Paiements
WAVE_API_KEY=""            WAVE_WEBHOOK_SECRET=""
ORANGE_API_KEY=""          ORANGE_MERCHANT_ID=""
STRIPE_SECRET_KEY=""       STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""

# WhatsApp
WHATSAPP_PHONE_ID=""       WHATSAPP_TOKEN=""
# OTP_BYPASS=true  → Dev : OTP dans les logs

# Stockage
R2_ACCOUNT_ID=""  R2_ACCESS_KEY=""  R2_SECRET_KEY=""
R2_BUCKET="belo-media"
NEXT_PUBLIC_CDN_URL="https://cdn.belo.sn"
```

---

## 22. Installation & Développement

```bash
git clone https://github.com/Ahmesgroup/belo.git
cd belo && npm install

cp .env.example .env.local    # remplir DATABASE_URL, JWT_SECRET…

npx prisma migrate deploy     # toutes les migrations
npm run db:seed               # salons + admins + pays + villes

npm run dev                   # → http://localhost:3000
```

### Scripts utiles

```bash
npm run build           # prisma generate + migrate deploy + next build
npm run db:studio       # Prisma Studio → http://localhost:5555
node scripts/fix-db.mjs # Fix admin prod (+352→+221, purge OTP)
```

---

## 23. Déploiement Vercel

```bash
npm run build && git push && npx vercel --prod
```

### `vercel.json` — Cron Jobs complet

```json
{
  "crons": [
    { "path": "/api/cron/events",          "schedule": "*/2 * * * *" },
    { "path": "/api/cron/notifications",   "schedule": "*/1 * * * *" },
    { "path": "/api/cron/metrics",         "schedule": "0 3 * * *"   },
    { "path": "/api/cron/generate-slots",  "schedule": "0 2 * * *"   },
    { "path": "/api/cron/purge-logs",      "schedule": "0 3 * * 0"   }
  ]
}
```

---

## 24. Maintenance DB

### Migrations appliquées

| Migration | Contenu |
|---|---|
| `20260501_init` | 12 modèles initiaux |
| `20260502_add_auditlog_ratelimit_index` | Index performance |
| `20260502_add_tenant_horaires` | horaires JSON |
| `20260502_add_plan_config` | PlanConfig |
| `20260504_admin_enhancements` | PlanConfig limits/features · SystemSetting |
| `20260504_event_log_and_notifications` | EventLog · AdminNotification |
| `20260505_geo_payments` | Country · City · PaymentAccount · TenantPayout + seed |
| `20260506_stripe_favorites` | Tenant.stripeAccountId · Booking.platformFeeCents · Favorite |
| `20260507_ranking_ads` | Tenant.lat/lng · TenantMetrics · TenantTrending · AdCampaign · GeoBid · UserPreference |

### Fix SUPER_ADMIN prod

```bash
node scripts/fix-db.mjs
# → +352 → +221, upsert SUPER_ADMIN, purge OTP/rate-limit
```

---

## 25. Annexe — Décisions d'architecture

| Décision | Choix | Raison |
|---|---|---|
| Auth | OTP WhatsApp + JWT maison | Marché africain, pas de Google/GitHub |
| DB | Neon serverless PostgreSQL | Scale-to-zero, coût minimal |
| Event queue | EventLog table | Durabilité + retry sans Redis |
| Event bus | Synchrone in-process | Vercel serverless = pas de mémoire partagée |
| Ranking | $queryRaw SQL unique | Score multi-signal en un seul round-trip |
| Geo index | Bounding-box + Haversine | Index utilisé, LEAST() pour sécurité float |
| Trending | Event-driven (pas de polling) | Mise à jour immédiate, O(1) par événement |
| Pages localisées | Server Components + Prisma direct | HTTP self-fetch = URL undefined sur Vercel |
| SEO ville+catégorie | SSG `/[lang]/salons/[city]/[category]` | 224+ pages pré-rendues, hreflang |
| Paiement | Belo encaisse (Phase 1) | Marketplace standard — payout manuel d'abord |
| Stripe Connect | Express accounts | Plus simple que Custom, onboarding hébergé |
| Ads boost | Plafonné à 0.1 dans score | Qualité prime sur budget |
| Cookies RGPD | localStorage + cookie 13 mois | Pas d'analytics sans consentement |
| Tailwind config | CSS-variable tokens | `bg-bg`, `text-g2` → répondent à `[data-theme=dark]` |
| Proxy (edge) | `proxy.ts` (Next.js 16) | RBAC + lang detection avant rendu |

---

*Documentation Belo v0.1.0 — Mise à jour : Mai 2026 — 21 modèles · 304 pages SSG/ISR*
