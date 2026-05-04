# Belo — Documentation Technique

> Marketplace SaaS multi-tenant de réservation de salons de beauté.
> Marché : Afrique + Europe. Déployée sur Vercel, base de données Neon PostgreSQL.
> Production URL : **https://belo-khaki.vercel.app**

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Stack technique](#2-stack-technique)
3. [Architecture globale](#3-architecture-globale)
4. [Arborescence du projet](#4-arborescence-du-projet)
5. [Modèle de données](#5-modèle-de-données)
6. [Authentification & Sécurité](#6-authentification--sécurité)
7. [Système d'événements](#7-système-dévénements)
8. [Fraud Engine](#8-fraud-engine)
9. [Admin Control Panel](#9-admin-control-panel)
10. [i18n — Routing multilingue & SEO](#10-i18n--routing-multilingue--seo)
11. [Géolocalisation & Dataset pays/villes](#11-géolocalisation--dataset-paysvilles)
12. [RGPD & Cookie Consent](#12-rgpd--cookie-consent)
13. [Flux de navigation](#13-flux-de-navigation)
14. [API Routes — référence complète](#14-api-routes--référence-complète)
15. [Contrôle d'accès par rôle (RBAC)](#15-contrôle-daccès-par-rôle-rbac)
16. [PWA — Bouton d'installation](#16-pwa--bouton-dinstallation)
17. [Variables d'environnement](#17-variables-denvironnement)
18. [Installation & Développement](#18-installation--développement)
19. [Déploiement Vercel](#19-déploiement-vercel)
20. [Maintenance DB](#20-maintenance-db)
21. [Annexe — Décisions d'architecture](#21-annexe--décisions-darchitecture)

---

## 1. Vue d'ensemble

**Belo** est une marketplace SaaS de réservation en ligne pour les salons de coiffure, beauté et bien-être. Objectif : niveau Fresha / Treatwell pour l'Afrique et la diaspora européenne.

| Aspect | Détail |
|---|---|
| Modèle | Marketplace multi-tenant (1 salon = 1 tenant) |
| Marchés | Sénégal · Côte d'Ivoire · Maroc · France · Belgique · Luxembourg |
| Paiements | Wave · Orange Money · Stripe · Paystack · MTN Money |
| Notifications | WhatsApp (outbox pattern) |
| Langues | Français · Anglais (routing `/fr` / `/en`) |
| Plans | FREE · PRO · PREMIUM |
| Admin | Control Panel 7 vues · Fraud Engine · Event System |
| SEO | Pages serveur par ville : `/fr/salons/dakar`, `/en/salons/paris` |

---

## 2. Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.4 |
| Runtime | React | 18 |
| Langage | TypeScript | 5 |
| ORM | Prisma | 5.13 |
| Base de données | PostgreSQL (Neon serverless) | — |
| Auth JWT | jose | 5.2 |
| Validation | Zod | 3.23 |
| CSS | Tailwind CSS + CSS variables (light/dark) | 3.4 |
| Déploiement | Vercel | — |
| Stockage médias | Cloudflare R2 (compatible S3) | — |

> **Pas de NextAuth, pas de Redis.** JWT maison (OTP WhatsApp), file d'événements via PostgreSQL (outbox pattern).

---

## 3. Architecture globale

```mermaid
graph TB
    subgraph Client["Navigateur / PWA"]
        UI[React App<br/>Next.js 16 App Router]
        LS[(localStorage<br/>belo_token · belo_user · belo_lang)]
    end

    subgraph Edge["Edge – Vercel / proxy.ts"]
        PX[proxy.ts<br/>JWT verify · RBAC<br/>Language detection<br/>/admin /dashboard /profil]
    end

    subgraph LangRoutes["Routes localisées SSG/ISR"]
        FR[/fr — Landing FR]
        EN[/en — Landing EN]
        FRS[/fr/salons]
        FRC[/fr/salons/dakar]
    end

    subgraph API["API Routes – Vercel Functions"]
        AUTH[/api/auth]
        BOOK[/api/bookings]
        TEN[/api/tenants]
        ADMIN[/api/admin/*]
        PAY[/api/payments]
        CRON[/api/cron/*]
    end

    subgraph EventSystem["Event System"]
        EB[events.ts<br/>emitEvent + EventLog]
        EH[event-handlers.ts]
    end

    subgraph Services["Business Logic"]
        AS[auth.service]
        BS[booking.service]
        FS[fraud.service]
        PS[plan.service]
    end

    subgraph DB["Neon PostgreSQL — 16 modèles"]
        PRI[(Prisma ORM)]
    end

    UI -->|httpOnly cookie + Bearer| Edge
    Edge --> LangRoutes
    Edge --> API
    API --> Services
    API --> EB
    EB --> EH --> PRI
    Services --> PRI
    LangRoutes -->|direct Prisma| PRI
```

### Flux d'un événement

```mermaid
sequenceDiagram
    participant Caller
    participant emitEvent
    participant EventLog
    participant Handlers
    participant AuditLog
    participant FraudEngine
    participant AdminNotif

    Caller->>emitEvent: emitEvent("tenant.blocked", payload)
    emitEvent-->>EventLog: INSERT pending (non-bloquant)
    emitEvent->>Handlers: dispatch synchrone
    Handlers->>AuditLog: createAuditLog()
    Handlers->>FraudEngine: runFraudCheck() si booking.cancelled
    Handlers->>AdminNotif: INSERT si tenant.created / fraud≥60
```

---

## 4. Arborescence du projet

```
belo/
├── src/
│   ├── proxy.ts                       # Edge proxy – RBAC + lang detection (Next.js 16)
│   │
│   ├── app/
│   │   ├── layout.tsx                 # Root layout + ThemeInit + LangProvider + CookieBanner
│   │   ├── globals.css                # Design tokens CSS (light=:root, dark=[data-theme=dark])
│   │   ├── sitemap.ts                 # Sitemap multilingue /fr/* + /en/*
│   │   │
│   │   ├── [lang]/                    # Routes publiques SEO (SSG/ISR)
│   │   │   ├── layout.tsx             # generateMetadata hreflang + LangSync + validation
│   │   │   ├── page.tsx               # Landing /fr /en — direct Prisma (ISR 2min)
│   │   │   └── salons/
│   │   │       ├── page.tsx           # /fr/salons — listing (ISR 60s)
│   │   │       └── [city]/
│   │   │           └── page.tsx       # /fr/salons/dakar — SEO ville (ISR 5min)
│   │   │
│   │   ├── (public)/                  # Routes publiques legacy (backward compat)
│   │   │   ├── page.tsx               # redirect → /fr
│   │   │   ├── login/page.tsx         # Login OTP + sélecteur pays
│   │   │   ├── booking/[slug]/page.tsx# Réservation 4 étapes (use() params Next.js 16)
│   │   │   ├── salons/page.tsx        # /salons (garde pour compat)
│   │   │   ├── profil/page.tsx        # Profil client
│   │   │   ├── plans/page.tsx         # Tarifs
│   │   │   └── pour-les-salons/       # Page commerciale gérants
│   │   │
│   │   ├── dashboard/                 # Espace gérant (OWNER · STAFF · ADMIN)
│   │   │   ├── layout.tsx             # Auth guard + notif badge PENDING
│   │   │   ├── page.tsx               # KPIs + quota
│   │   │   ├── bookings/page.tsx      # Accept/Refuse · toast · pulseSoft
│   │   │   ├── services/page.tsx
│   │   │   ├── horaires/page.tsx
│   │   │   ├── profil/page.tsx
│   │   │   └── equipe/page.tsx        # Staff (PREMIUM)
│   │   │
│   │   ├── admin/page.tsx             # Control Panel (SUPER_ADMIN)
│   │   │   # 7 vues : Mission Control · Tenants · Plans · Fraude · Équipe · Logs · Réglages
│   │   │
│   │   └── api/
│   │       ├── auth/route.ts          # OTP · JWT · refresh · logout
│   │       ├── bookings/route.ts      # POST (maintenance check) · GET · PATCH (tx)
│   │       ├── tenants/
│   │       │   ├── route.ts           # GET · POST → emitEvent("tenant.created")
│   │       │   └── [slug]/route.ts    # GET · PATCH
│   │       ├── services/[id]/route.ts
│   │       ├── slots/route.ts
│   │       ├── payments/route.ts      # Wave · OM · Stripe · refund
│   │       ├── plans/route.ts         # GET · PATCH → syncPlanToTenants
│   │       ├── webhooks/route.ts      # HMAC verify
│   │       ├── admin/
│   │       │   ├── tenants/route.ts   # validate · block · change_plan …
│   │       │   ├── fraud/route.ts
│   │       │   ├── logs/route.ts
│   │       │   ├── team/route.ts
│   │       │   ├── settings/route.ts  # → emitEvent("settings.updated")
│   │       │   ├── notifications/     # GET + PATCH (read)
│   │       │   └── stream/route.ts    # EventLog feed polling 5s
│   │       └── cron/
│   │           ├── events/route.ts    # Retry EventLog (2 min)
│   │           ├── notifications/     # Worker outbox WhatsApp
│   │           ├── generate-slots/
│   │           └── purge-logs/
│   │
│   ├── components/
│   │   ├── ThemeInit.tsx              # Dark/light mode (client-only)
│   │   ├── CookieBanner.tsx           # RGPD : Essential · Analytics · Marketing
│   │   ├── LangSync.tsx               # Syncs URL [lang] → LangContext au mount
│   │   └── ui/
│   │       ├── Nav.tsx                # PublicNav (i18n) + DashboardNav (notif badge)
│   │       ├── PhoneInput.tsx         # Sélecteur pays + indicatif international
│   │       └── LangSwitcher.tsx       # Switch /fr ↔ /en dans le pathname courant
│   │
│   ├── lib/
│   │   ├── auth-client.ts             # getToken · getUser · setAuth · clearAuth
│   │   ├── auth-guard.ts              # resolveRedirect() · DASHBOARD_ROLES · ADMIN_ROLES
│   │   ├── route-auth.ts              # withAuth · withRole · withTenant · withActiveTenant
│   │   ├── events.ts                  # emitEvent() · onEvent() + EventLog persistence
│   │   ├── event-handlers.ts          # Registre centralisé handlers
│   │   ├── event-queue.ts             # processEventQueue() · getQueueHealth()
│   │   ├── domain-events.ts           # DomainEvents factory (DDD) + emitDomainEvent()
│   │   ├── audit.ts                   # createAuditLog() centralisé
│   │   ├── settings.ts                # getAllSettings() · cache 30s · requireNotMaintenance()
│   │   ├── api-fetch.ts               # apiFetch() avec credentials:include
│   │   ├── i18n.ts                    # Traductions FR/EN + type TranslationKey
│   │   ├── i18n-server.ts             # getTranslations(lang) · SUPPORTED_LANGS · SEO_META
│   │   ├── i18n-localize.ts           # getLocalized(field, lang) — champs Json bilingues
│   │   ├── lang-context.tsx           # LangProvider (Context React, initialLang prop)
│   │   ├── payment.ts                 # canUsePayment() — FREE = pas de paiement
│   │   ├── cors.ts                    # getCorsHeaders() — allowlist origins
│   │   └── rate-limit.ts              # rateLimitByPhone() via AuditLog
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── booking.service.ts         # createBooking · cancelBooking · emitEvent
│   │   ├── fraud.service.ts           # 6 signaux · auto-block ≥ 80
│   │   └── plan.service.ts            # syncPlanToTenants · resetTenantQuota
│   │
│   ├── domain/
│   │   └── booking/booking.rules.ts   # Règles pures testables sans DB
│   │
│   └── infrastructure/
│       ├── db/prisma.ts               # Prisma singleton
│       ├── providers/payment.ts       # Wave · Orange · Stripe adapters
│       └── queue/worker.ts            # Worker outbox WhatsApp
│
├── prisma/
│   ├── schema.prisma                  # 16 modèles
│   ├── seed.ts                        # Salons + services + créneaux + admins
│   └── migrations/
│       ├── 20260501_init/
│       ├── 20260502_add_auditlog_ratelimit_index/
│       ├── 20260502_add_tenant_horaires/
│       ├── 20260502_add_plan_config/
│       ├── 20260504_admin_enhancements/      # PlanConfig limits/features + SystemSetting
│       ├── 20260504_event_log_and_notifications/ # EventLog + AdminNotification
│       └── 20260505_geo_payments/            # Country + City + PaymentAccount + TenantPayout
│
├── scripts/
│   ├── fix-db.mjs        # Fix +352→+221, purge OTP, upsert SUPER_ADMIN
│   └── seed-plans.mjs
│
└── public/
    ├── manifest.json     # PWA manifest
    └── robots.txt
```

---

## 5. Modèle de données

### 16 modèles Prisma

```mermaid
erDiagram
    Country {
        string code PK
        json   name
        string phoneCode
        string currency
    }
    City {
        string id PK
        json   name
        string slug UK
        string countryCode FK
    }
    Tenant {
        string id PK
        string slug UK
        enum   plan
        enum   status
        string country
        string city
    }
    User {
        string id PK
        string phone UK
        enum   role
        string tenantId FK
    }
    Booking {
        string id PK
        string tenantId FK
        string userId FK
        enum   status
        int    priceCents
        string idempotencyKey UK
    }
    EventLog {
        string id PK
        string type
        json   payload
        string status
        int    retries
    }
    AdminNotification {
        string id PK
        string type
        string title
        bool   read
    }
    PaymentAccount {
        string id PK
        string provider
        string accountId
        bool   isPlatform
    }
    TenantPayout {
        string id PK
        string tenantId FK
        string provider
        string accountNumber
        bool   isVerified
    }
    SystemSetting {
        string key PK
        json   value
    }
    PlanConfig {
        string plan UK
        int    priceFcfa
        json   limits
        json   features
    }

    Country ||--o{ City : "a"
    Tenant  ||--o{ Booking : "reçoit"
    Tenant  ||--o{ TenantPayout : "configure"
    User    ||--o{ Booking : "crée"
```

### Dataset géographique intégré

| Pays | Code | Indicatif | Devise | Villes |
|---|---|---|---|---|
| Sénégal | SN | +221 | XOF | Dakar, Thiès |
| Côte d'Ivoire | CI | +225 | XOF | Abidjan |
| Mali | ML | +223 | XOF | Bamako |
| Guinée | GN | +224 | GNF | Conakry |
| Maroc | MA | +212 | MAD | Casablanca, Rabat |
| Tunisie | TN | +216 | TND | Tunis |
| France | FR | +33 | EUR | Paris, Lyon |
| Belgique | BE | +32 | EUR | Bruxelles |
| Luxembourg | LU | +352 | EUR | Luxembourg |
| USA | US | +1 | USD | New York |
| UK | GB | +44 | GBP | London |

### Modèle paiement — stratégie marketplace

```
Phase 1 (actuel) :
  Client → paie Belo (PaymentAccount.isPlatform=true)
  Belo conserve les fonds
  TenantPayout enregistré mais pas utilisé

Phase 2 (payout manuel) :
  Admin déclenche payout vers TenantPayout.accountNumber

Phase 3 (payout auto) :
  Cron calcule commission, vire automatiquement
```

### Enums

| Enum | Valeurs |
|---|---|
| `Plan` | `FREE` · `PRO` · `PREMIUM` |
| `UserRole` | `CLIENT` · `OWNER` · `STAFF` · `ADMIN` · `SUPER_ADMIN` |
| `TenantStatus` | `PENDING` · `ACTIVE` · `SUSPENDED` · `BLOCKED` · `FRAUD` |
| `BookingStatus` | `PENDING` · `CONFIRMED` · `COMPLETED` · `CANCELLED` · `NO_SHOW` |
| `PaymentStatus` | `PENDING` · `PAID` · `REFUNDED` · `FAILED` |
| `EventLog.status` | `pending` · `processing` · `processed` · `failed` |

---

## 6. Authentification & Sécurité

### Flux OTP

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant L as Login Page
    participant A as /api/auth
    participant S as auth.service.ts
    participant DB as PostgreSQL

    U->>L: Saisit numéro (PhoneInput — sélecteur pays)
    L->>L: normalizePhone() → E.164 (+221771234567)
    L->>A: POST send-otp → rateLimitByPhone(3/2min)
    A->>S: sendOtp → hash OTP + INSERT AuditLog
    S-->>U: WhatsApp OTP
    U->>A: POST verify-otp → rateLimitByPhone(5/15min)
    A->>S: verifyOtp → check hash + UPSERT User(role:CLIENT)
    S->>S: signJWT(sub, role, tenantId)
    A->>A: Set httpOnly cookie belo_token (7j)
    A-->>L: { accessToken, user }
    L->>L: localStorage + router.replace(resolveRedirect(user))
```

### proxy.ts — Interception Edge

```typescript
// Détection langue → redirect / → /fr ou /en
if (pathname === "/") redirect(`/${detectLang(req)}`);  // Accept-Language + cookie

// RBAC pages
/admin      → ADMIN | SUPER_ADMIN
/dashboard  → OWNER | STAFF | ADMIN | SUPER_ADMIN
/profil     → tout utilisateur authentifié
/api/admin  → ADMIN | SUPER_ADMIN + injection x-user-id/role
```

### `withActiveTenant()` — enforcement

```typescript
// Vérifie existence + status ACTIVE avant toute opération métier
const check = await withActiveTenant(auth, tenantId);
if (!check.ok) return check.response; // 404 ou 403 TENANT_INACTIVE
```

---

## 7. Système d'événements

### Architecture

```
emitEvent("tenant.blocked", payload)
    │
    ├── 1. INSERT EventLog (pending) — fire-and-forget
    └── 2. Dispatch synchrone des handlers
              ├── createAuditLog()
              ├── runFraudCheck()        (booking.cancelled / payment.failed)
              ├── AdminNotification      (tenant.created / fraud≥60)
              └── invalidateSettingsCache (settings.updated / plan.updated)
```

### Types d'événements

| Event | Déclenché par |
|---|---|
| `tenant.blocked` | Admin / fraud engine auto-block |
| `tenant.activated` | Admin validate/reactivate |
| `tenant.created` | POST /api/tenants |
| `plan.updated` | PATCH /api/plans |
| `payment.failed` | Webhook / route |
| `booking.created` | createBooking() |
| `booking.cancelled` | cancelBooking() |
| `fraud.detected` | fraud.service |
| `settings.updated` | PATCH /api/admin/settings |

### Domain Events (DDD)

```typescript
await emitDomainEvent(
  DomainEvents.tenantBlocked({ tenantId, adminId, reason })
  // → { eventId, type, payload, occurredAt, schemaVersion }
);
```

### EventLog retry (cron toutes les 2 min)

```
pending → processing → processed ✓
                    └→ pending  (retry si retries < maxRetries=3)
                    └→ failed ✗ (après 3 tentatives)
```

---

## 8. Fraud Engine

### Score 0–100, 6 signaux

| Signal | Condition | Poids |
|---|---|---|
| `high_cancellations_24h` | > 5 annulations/24h | +8 par excès (max 40) |
| `high_cancellation_rate_30d` | Taux > 40%/30j | jusqu'à +30 |
| `quota_gaming_suspected` | Quota élevé + peu de vrais bookings | +20 |
| `booking_velocity_spike` | > 20 créations/1h (bot) | +3/excès (max 35) |
| `existing_fraud_alert` | Alerte active score > 50 | +30% du score existant |
| `cross_tenant_canceller` | Utilisateur annulant ≥ 2 autres tenants/24h | +5/user (max 25) |

```
score 0–29  → clean
score 30–59 → NEW FraudAlert
score 60–79 → AdminNotification ⚠️
score ≥ 80  → auto-block → tenant.status = FRAUD
```

---

## 9. Admin Control Panel

### 7 vues fonctionnelles

| Vue | Données réelles | Actions |
|---|---|---|
| Mission Control | KPIs DB · queue PENDING · EventLog feed 5s | Valider en 1 clic |
| Tenants | Tableau filtrable · statut coloré | validate · block · suspend · change_plan |
| Plans | Prix FCFA/EUR + limits JSON + features | Éditer tout |
| Fraude | FraudAlert · risk scores · 6 signaux | Enquêter · Clore |
| Équipe | Admins · lastLogin | Voir rôles |
| Logs | AuditLog paginé · actor + tenant | Filtrer |
| Réglages | Maintenance · commission · providers · OTP bypass | Sauvegarder |

### Live Feed — EventLog polling

```typescript
GET /api/admin/stream?since=ISO&limit=30
→ { events: EventLog[], cursor, health: { pending, processed, failed } }
// Admin panel poll toutes les 5s
```

### Notifications admin

```typescript
// Auto-créées pour :
"tenant_validation_required" → nouveau salon inscrit
"fraud_alert"                → score fraude ≥ 60

GET  /api/admin/notifications     → { notifications[], unreadCount }
PATCH /api/admin/notifications?all=1 → mark all read
```

---

## 10. i18n — Routing multilingue & SEO

### Architecture URL

```
/             → redirect → /fr ou /en  (proxy Edge + Accept-Language)
/fr           → Landing FR  ● SSG (ISR 2min)
/en           → Landing EN  ● SSG (ISR 2min)
/fr/salons    → Listing FR  ƒ Server (ISR 60s)
/en/salons    → Listing EN  ƒ Server (ISR 60s)
/fr/salons/dakar    → Ville Dakar FR  ● SSG (ISR 5min)
/fr/salons/paris    → Ville Paris FR  ● SSG (ISR 5min)
/fr/salons/bruxelles → …
```

### Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/lib/i18n.ts` | `translations` objet FR/EN + `TranslationKey` type |
| `src/lib/i18n-server.ts` | `getTranslations(lang)` — t() synchrone pour Server Components · `SEO_META` · `isValidLang()` |
| `src/lib/i18n-localize.ts` | `getLocalized({fr, en}, lang)` — résout les champs Json bilingues (Country.name, City.name) |
| `src/lib/lang-context.tsx` | `LangProvider` (Context React) · accepte `initialLang` prop |
| `src/hooks/useLang.ts` | Re-export depuis `lang-context` (backward compat) |
| `src/components/LangSync.tsx` | Client — `setLang(lang)` au mount depuis URL segment |
| `src/components/ui/LangSwitcher.tsx` | Remplace `/fr/` ↔ `/en/` dans le pathname courant |

### SEO généré par `[lang]/layout.tsx`

```html
<!-- Sur /fr/salons/dakar -->
<html lang="fr">
<link rel="canonical"  href="https://belo-khaki.vercel.app/fr/salons/dakar" />
<link rel="alternate"  href="https://belo-khaki.vercel.app/fr/salons/dakar" hreflang="fr" />
<link rel="alternate"  href="https://belo-khaki.vercel.app/en/salons/dakar" hreflang="en" />
<link rel="alternate"  href="https://belo-khaki.vercel.app/fr/salons/dakar" hreflang="x-default" />
<title>Salons de beauté à Dakar | Belo</title>
<meta name="description" content="Réservez les meilleurs salons…" />
<script type="application/ld+json">{"@type":"ItemList","name":"Salons à Dakar"}</script>
```

### Pages serveur — bug corrigé

> **Bug critique corrigé** : les pages `[lang]/page.tsx` et `[lang]/salons/page.tsx` faisaient
> `fetch(process.env.NEXT_PUBLIC_APP_URL + "/api/tenants")`. Cette variable est `undefined`
> côté serveur Vercel → 0 résultats silencieusement.
> **Fix** : requête Prisma directe dans les Server Components — aucun HTTP, aucune dépendance env.

```typescript
// Avant (bugué) :
const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/tenants?pageSize=4`);

// Après (correct) :
const [tenants, total] = await Promise.all([
  prisma.tenant.findMany({ where: { status: "ACTIVE", deletedAt: null }, take: 4 }),
  prisma.tenant.count({ where: { status: "ACTIVE", deletedAt: null } }),
]);
```

### Utilisation dans un composant client

```tsx
import { useLang } from "@/hooks/useLang";
const { t, lang, setLang } = useLang();
t("hero_title")  // → "La beauté réservée" (fr) | "Beauty, booked" (en)
```

### Utilisation dans un Server Component

```tsx
import { getTranslations } from "@/lib/i18n-server";
const t = getTranslations(lang);  // synchrone, pas de hook
t("hero_title")  // → "La beauté réservée"
```

---

## 11. Géolocalisation & Dataset pays/villes

### Modèles

```typescript
// Country — 11 pays actifs
{ code: "SN", name: {fr:"Sénégal", en:"Senegal"}, phoneCode:"+221", currency:"XOF" }

// City — 14 villes actives
{ slug: "dakar", name: {fr:"Dakar", en:"Dakar"}, countryCode: "SN" }
```

### Helper multilingue

```typescript
import { getLocalized } from "@/lib/i18n-localize";

const cityName = getLocalized(city.name, "en");  // → "Dakar"
const cityName = getLocalized(city.name, "fr");  // → "Dakar"
const country  = getLocalized(country.name, "en"); // → "Senegal"
```

### Sélecteur pays dans PhoneInput

Le composant `PhoneInput` utilise la même liste de pays pour l'indicatif téléphonique. Les pays du dataset géo et les indicatifs du `PhoneInput` sont alignés.

---

## 12. RGPD & Cookie Consent

### Bannière `CookieBanner.tsx`

- Affichée au premier accès (pas de consent stocké)
- Consent sauvegardé dans `localStorage("belo_cookie_consent")`
- 3 catégories :

| Catégorie | Par défaut | Modifiable |
|---|---|---|
| `essential` | `true` | ❌ toujours actif |
| `analytics` | `false` | ✓ |
| `marketing` | `false` | ✓ |

```typescript
// Structure du consentement
{
  essential:  true,     // toujours vrai
  analytics:  boolean,
  marketing:  boolean,
}
```

### Cookies auth (conformité RGPD)

| Cookie | Attributs | Durée |
|---|---|---|
| `belo_token` | `HttpOnly; Secure; SameSite=Lax` | 7 jours |
| `belo_refresh` | `HttpOnly; Secure; SameSite=Lax; Path=/api/auth` | 30 jours |
| `belo_lang` | `SameSite=Lax` | Session |

> Les cookies d'authentification sont **HttpOnly** — inaccessibles en JavaScript, protégés contre le XSS.

---

## 13. Flux de navigation

### Client → Réservation

```mermaid
flowchart TD
    A([Visiteur]) --> B[/ → redirect /fr]
    B --> C[/fr Landing SSG]
    C --> D[/fr/salons]
    D --> E[/booking/:slug]
    E --> F{Token ?}
    F -- Non --> G[/login OTP]
    G --> H{Rôle ?}
    H -- CLIENT --> E
    F -- Oui --> I[Étape 1 Service]
    I --> J[Étape 2 Créneau]
    J --> K[Étape 3 Confirmer]
    K --> L{Dépôt PRO+ ?}
    L -- Non --> M[POST /api/bookings → emitEvent booking.created]
    L -- Oui --> N[POST /api/payments/init → Wave/OM/Stripe]
    M --> O[Étape 4 ✅]
    N --> P[POST /api/webhooks] --> O
```

### Super-Admin

```mermaid
flowchart TD
    A[Login 661000001] --> B[/admin]
    B --> C[Mission Control<br/>EventLog stream 5s]
    B --> D[Tenants → actions + events]
    B --> E[Plans → syncPlanToTenants]
    B --> F[Fraude → 6 signaux auto]
    B --> G[Réglages → maintenance + providers]
    G --> H[→ emitEvent settings.updated<br/>→ invalidateCache]
```

---

## 14. API Routes — référence complète

### Authentification

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth?action=send-otp` | OTP WhatsApp · rate 3/2min |
| `POST` | `/api/auth?action=verify-otp` | Vérifie → JWT + cookies httpOnly |
| `POST` | `/api/auth?action=refresh` | Rafraîchit access token |
| `POST` | `/api/auth?action=logout` | Efface cookies |

### Salons & Services

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/tenants` | — | Liste ACTIVE · Cache 2min · CORS |
| `POST` | `/api/tenants` | CLIENT | Inscription → `emitEvent("tenant.created")` |
| `GET` | `/api/tenants/:slug` | — | Profil + services · Cache 60s |
| `PATCH` | `/api/tenants/:slug` | OWNER | Màj profil · horaires |
| `GET` | `/api/services?tenantId=` | — | Liste |
| `POST/PATCH/DELETE` | `/api/services[/:id]` | OWNER | CRUD |
| `GET/POST/DELETE` | `/api/slots` | —/OWNER | Créneaux |

### Réservations & Paiements

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/bookings` | CLIENT | Crée · idempotent · **requireNotMaintenance()** |
| `GET` | `/api/bookings?tenantId=` | OWNER | Liste salon |
| `PATCH` | `/api/bookings` | OWNER | CONFIRMED/CANCELLED · transaction atomique |
| `POST` | `/api/payments?action=init` | CLIENT | Initie Wave/OM/Stripe vers compte Belo |
| `GET` | `/api/payments?bookingId=` | CLIENT | Vérifie statut |
| `POST` | `/api/payments?action=refund` | OWNER PREMIUM | Remboursement |
| `POST` | `/api/webhooks` | HMAC | Wave · Orange · Stripe (idempotent) |

### Admin

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/tenants` | ADMIN | Liste + stats |
| `POST` | `/api/admin/tenants?action=do-action` | ADMIN | validate · block · change_plan · … |
| `GET/PATCH` | `/api/admin/fraud` | ADMIN | Alertes fraude |
| `GET` | `/api/admin/logs` | ADMIN | AuditLog paginé |
| `GET/PATCH` | `/api/admin/team` | ADMIN/SUPER | Équipe admin |
| `GET/PATCH` | `/api/admin/settings` | SUPER | Config + `emitEvent("settings.updated")` |
| `GET/PATCH` | `/api/admin/notifications` | ADMIN | Inbox + mark read |
| `GET` | `/api/admin/stream` | ADMIN | EventLog feed (polling 5s) |
| `GET/PATCH` | `/api/plans` | —/ADMIN | Tarifs + limits/features |

### Cron jobs

| Endpoint | Fréquence | Description |
|---|---|---|
| `/api/cron/events` | toutes les 2 min | Retry EventLog (SKIP LOCKED) |
| `/api/cron/notifications` | toutes les minutes | Worker outbox WhatsApp |
| `/api/cron/generate-slots` | quotidien 02h00 | Créneaux J+14 |
| `/api/cron/purge-logs` | hebdo dimanche 03h00 | Archive NotificationLog |

---

## 15. Contrôle d'accès par rôle (RBAC)

### `resolveRedirect()` post-login

```
SUPER_ADMIN → /admin
ADMIN       → /dashboard
OWNER       → /dashboard
STAFF       → /dashboard
CLIENT      → /profil
null        → /login
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
| Remboursement auto | ✗ | ✗ | ✓ |
| Domaine custom | ✗ | ✗ | ✓ |

> Limites stockées en JSON dans `PlanConfig.limits` + `PlanConfig.features` — modifiables depuis l'admin sans migration.

---

## 16. PWA — Bouton d'installation

```tsx
// src/components/InstallPWA.tsx
// Affiché uniquement sur mobile (≤768px) si prompt disponible
// iOS Safari : non supporté → message manuel "Partager → Ajouter à l'écran"
```

---

## 17. Variables d'environnement

### Obligatoires

```bash
DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"
JWT_SECRET="minimum-32-chars"
JWT_EXPIRES_IN="7d"
REFRESH_TOKEN_EXPIRES_IN="30d"
NEXT_PUBLIC_APP_URL="https://belo-khaki.vercel.app"
CRON_SECRET="secret-crons"
```

### Paiements

```bash
WAVE_API_KEY=""         WAVE_WEBHOOK_SECRET=""
ORANGE_API_KEY=""       ORANGE_MERCHANT_ID=""
STRIPE_SECRET_KEY=""    STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
```

### WhatsApp & Médias

```bash
WHATSAPP_PHONE_ID=""    WHATSAPP_TOKEN=""
# OTP_BYPASS=true  → Dev : OTP dans les logs, pas envoyé
R2_ACCOUNT_ID=""  R2_ACCESS_KEY=""  R2_SECRET_KEY=""
R2_BUCKET="belo-media"  NEXT_PUBLIC_CDN_URL="https://cdn.belo.sn"
```

---

## 18. Installation & Développement

```bash
git clone https://github.com/Ahmesgroup/belo.git
cd belo && npm install

# Configurer l'environnement
cp .env.example .env.local   # remplir DATABASE_URL, JWT_SECRET, etc.

# Initialiser la DB
npx prisma migrate deploy    # applique toutes les migrations
npm run db:seed              # salons + services + admins + pays + villes

# Lancer
npm run dev  # → http://localhost:3000
```

### Scripts utiles

```bash
npm run build        # prisma generate + migrate deploy + next build
npm run db:studio    # Prisma Studio → http://localhost:5555
npm run db:seed      # Reseed
node scripts/fix-db.mjs  # Fix admin prod (+352→+221, purge OTP)
```

### OTP bypass dev

```bash
# .env.local
OTP_BYPASS=true   # OTP affiché dans la console, pas envoyé sur WhatsApp
```

---

## 19. Déploiement Vercel

```bash
npm run build          # vérifier 0 erreurs TS en local
git add . && git commit -m "feat: ..."
git push
npx vercel --prod
```

### `vercel.json` — Cron Jobs

```json
{
  "crons": [
    { "path": "/api/cron/events",          "schedule": "*/2 * * * *" },
    { "path": "/api/cron/notifications",   "schedule": "*/1 * * * *" },
    { "path": "/api/cron/generate-slots",  "schedule": "0 2 * * *"   },
    { "path": "/api/cron/purge-logs",      "schedule": "0 3 * * 0"   }
  ]
}
```

---

## 20. Maintenance DB

### Migrations appliquées

| Migration | Contenu |
|---|---|
| `20260501_init` | Schéma complet initial (12 modèles) |
| `20260502_add_auditlog_ratelimit_index` | Index performance |
| `20260502_add_tenant_horaires` | Champ horaires JSON |
| `20260502_add_plan_config` | Modèle PlanConfig |
| `20260504_admin_enhancements` | PlanConfig +limits/features · SystemSetting |
| `20260504_event_log_and_notifications` | EventLog · AdminNotification |
| `20260505_geo_payments` | Country · City · PaymentAccount · TenantPayout + seed 11 pays 14 villes |

### Fix compte SUPER_ADMIN

```bash
node scripts/fix-db.mjs
# → +352661000001 → +221661000001
# → SUPER_ADMIN upsert
# → purge OTP/rate-limit logs
```

### Créer une nouvelle migration

```bash
npx prisma migrate dev --name "nom_feature"
npx prisma migrate deploy  # prod (automatique via npm run build)
```

---

## 21. Annexe — Décisions d'architecture

| Décision | Choix | Raison |
|---|---|---|
| Auth | OTP WhatsApp + JWT maison | Marché africain, pas de Google/GitHub |
| DB | Neon serverless PostgreSQL | Scale-to-zero, coût minimal phase 1 |
| Event queue | EventLog table (PostgreSQL) | Durabilité + retry sans Redis |
| Event bus | Synchrone in-process | Vercel serverless = pas de mémoire partagée |
| Pages localisées | Server Components + Prisma direct | Auto-HTTP fetch = URL undefined sur Vercel |
| SEO ville | SSG `/[lang]/salons/[city]` | Pages pré-rendues, crawlables, hreflang |
| Paiement | Belo encaisse (Phase 1) | Marketplace standard : plateforme collecte, payout manuel |
| Fraud engine | 6 signaux + auto-block ≥ 80 | Actif sans intervention manuelle |
| Plans | JSON limits/features en DB | Modifiables sans migration depuis l'admin |
| Settings | SystemSetting + cache 30s | Config dynamique, invalidée par event |
| Cookies RGPD | Bannière + localStorage | Pas de cookie analytics sans consentement |
| Lang routing | `/[lang]/` SSG + LangSync client | SEO correct + contexte React synchronisé |
| Proxy (edge) | `proxy.ts` (Next.js 16) | Remplace `middleware.ts` — interception + lang detection |
| CORS | getCorsHeaders() allowlist | Pas de wildcard `*` en production |

---

*Documentation Belo v0.1.0 — Mise à jour : Mai 2026*
