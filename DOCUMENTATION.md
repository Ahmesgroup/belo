# Belo — Documentation Technique

> Plateforme SaaS multi-tenant de réservation de salons de beauté.
> Conçue pour le marché Sénégalais et francophone, déployée sur Vercel, base de données Neon PostgreSQL.

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
10. [Flux de navigation](#10-flux-de-navigation)
11. [API Routes — référence complète](#11-api-routes--référence-complète)
12. [Contrôle d'accès par rôle (RBAC)](#12-contrôle-daccès-par-rôle-rbac)
13. [i18n — Internationalisation](#13-i18n--internationalisation)
14. [PWA — Bouton d'installation](#14-pwa--bouton-dinstallation)
15. [Variables d'environnement](#15-variables-denvironnement)
16. [Installation & Développement](#16-installation--développement)
17. [Déploiement Vercel](#17-déploiement-vercel)
18. [Maintenance DB](#18-maintenance-db)
19. [Annexe — Décisions d'architecture](#19-annexe--décisions-darchitecture)

---

## 1. Vue d'ensemble

**Belo** est une application SaaS de réservation en ligne pour les salons de coiffure, beauté et bien-être.

| Aspect | Détail |
|---|---|
| Modèle | Multi-tenant (1 salon = 1 tenant) |
| Marché cible | Sénégal, Afrique francophone |
| Paiements | Wave · Orange Money · Stripe · Paystack · MTN Money |
| Notifications | WhatsApp (pattern outbox) |
| Langues | Français · Anglais |
| Plans | FREE · PRO · PREMIUM |
| Admin | Control Panel 7 vues · Fraud Engine · Event System |

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
| CSS | Tailwind CSS + CSS variables | 3.4 |
| Déploiement | Vercel | — |
| Stockage médias | Cloudflare R2 (compatible S3) | — |

> **Pas de NextAuth.** L'authentification est gérée en interne via OTP WhatsApp + JWT signé (HS256).
> **Pas de Redis.** La file d'événements et les notifications WhatsApp reposent sur PostgreSQL (outbox pattern).

---

## 3. Architecture globale

```mermaid
graph TB
    subgraph Client["Navigateur / PWA"]
        UI[React App<br/>Next.js 16 App Router]
        LS[(localStorage<br/>belo_token · belo_user)]
    end

    subgraph Edge["Edge – Vercel / proxy.ts"]
        PX[proxy.ts<br/>JWT verify · RBAC<br/>/admin /dashboard /profil]
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
        EB[events.ts<br/>emitEvent / onEvent]
        EL[(EventLog<br/>persistence + retry)]
        EH[event-handlers.ts<br/>audit · fraud · notif]
    end

    subgraph Services["Business Logic"]
        AS[auth.service.ts]
        BS[booking.service.ts]
        FS[fraud.service.ts]
        PS[plan.service.ts]
    end

    subgraph DB["Neon PostgreSQL"]
        PRI[(Prisma ORM<br/>12 modèles)]
    end

    subgraph External["Externes"]
        WA[WhatsApp API]
        WV[Wave API]
        OM[Orange Money]
        ST[Stripe API]
        R2[Cloudflare R2]
    end

    UI -->|httpOnly cookie + Bearer| Edge
    Edge -->|passe ou redirige| API
    API --> Services
    API --> EB
    EB --> EL
    EB --> EH
    EH --> FS
    EH --> PRI
    Services --> PRI
    Services --> EB
    PAY --> WV & OM & ST
    AUTH --> AS
    BOOK --> BS
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
    emitEvent-->>EventLog: INSERT status=pending (non-bloquant)
    emitEvent->>Handlers: dispatch synchrone
    Handlers->>AuditLog: createAuditLog()
    Handlers->>FraudEngine: runFraudCheck() si booking.cancelled
    Handlers->>AdminNotif: INSERT si tenant.created ou fraud≥60
    Note over EventLog: Cron /api/cron/events retente<br/>les entrées pending toutes les 2 min
```

### Couches de l'application

```mermaid
graph LR
    A[Pages React] --> B[API Routes]
    B --> C[Services<br/>auth · booking · fraud · plan]
    C --> D[Domain Rules<br/>booking.rules.ts]
    C --> E[Infrastructure<br/>Prisma · Providers · Queue]
    C --> F[Event System<br/>events.ts · event-handlers.ts]
    E & F --> G[(PostgreSQL Neon)]
```

---

## 4. Arborescence du projet

```
belo/
├── src/
│   ├── proxy.ts                     # Edge proxy (RBAC, JWT) – Next.js 16
│   │
│   ├── app/
│   │   ├── layout.tsx               # Root layout + ThemeInit + LangProvider
│   │   ├── error.tsx                # Erreur globale
│   │   ├── globals.css              # Design tokens (CSS variables light/dark)
│   │   ├── sitemap.ts               # Sitemap dynamique
│   │   │
│   │   ├── (public)/                # Routes publiques (pas d'auth requise)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx             # Landing page
│   │   │   ├── login/page.tsx       # Login OTP + sélecteur pays
│   │   │   ├── booking/[slug]/      # Réservation d'un salon (4 étapes)
│   │   │   │   ├── page.tsx         # use(params) pour Next.js 16
│   │   │   │   └── loading.tsx
│   │   │   ├── salons/              # Listing des salons
│   │   │   ├── profil/page.tsx      # Profil client + historique réservations
│   │   │   ├── plans/page.tsx       # Tarifs
│   │   │   ├── pour-les-salons/     # Page commerciale gérants
│   │   │   └── confidentialite/
│   │   │
│   │   ├── dashboard/               # Espace gérant (auth: OWNER · STAFF · ADMIN)
│   │   │   ├── layout.tsx           # Auth guard + notif badge + redirect /login
│   │   │   ├── page.tsx             # Vue d'ensemble + KPIs + quota
│   │   │   ├── bookings/page.tsx    # Accept/Refuse · toast · pulseSoft animation
│   │   │   ├── services/page.tsx    # CRUD services
│   │   │   ├── horaires/page.tsx    # Génération créneaux
│   │   │   ├── profil/page.tsx      # Paramètres salon
│   │   │   └── equipe/page.tsx      # Staff (plan PREMIUM)
│   │   │
│   │   ├── admin/                   # Control Panel (auth: SUPER_ADMIN via proxy)
│   │   │   └── page.tsx             # 7 vues : Mission Control · Tenants · Plans
│   │   │                            #          Fraude · Équipe · Logs · Réglages
│   │   └── api/
│   │       ├── auth/route.ts        # POST send-otp · verify-otp · refresh · logout
│   │       ├── bookings/route.ts    # GET · POST (maintenance check) · PATCH (tx)
│   │       ├── tenants/
│   │       │   ├── route.ts         # GET · POST → emitEvent("tenant.created")
│   │       │   └── [slug]/route.ts  # GET · PATCH
│   │       ├── services/
│   │       │   ├── route.ts         # GET · POST
│   │       │   └── [id]/route.ts    # GET · PATCH · DELETE
│   │       ├── slots/route.ts       # GET · POST · DELETE
│   │       ├── payments/route.ts    # POST init/refund · GET verify
│   │       ├── plans/route.ts       # GET · PATCH → syncPlanToTenants()
│   │       ├── staff/route.ts       # GET · POST · PATCH · DELETE
│   │       ├── upload/route.ts      # POST (Cloudflare R2)
│   │       ├── webhooks/route.ts    # Wave · Orange · Stripe (HMAC verify)
│   │       ├── admin/
│   │       │   ├── tenants/route.ts # GET · POST (validate/block/change_plan…)
│   │       │   ├── fraud/route.ts   # GET · PATCH (review/close)
│   │       │   ├── logs/route.ts    # GET (audit log paginé)
│   │       │   ├── team/route.ts    # GET · PATCH (rôles admin)
│   │       │   ├── settings/route.ts# GET · PATCH → emitEvent("settings.updated")
│   │       │   ├── notifications/   # GET (unread count + list) · PATCH (mark read)
│   │       │   └── stream/route.ts  # GET (EventLog feed – polling 5s)
│   │       └── cron/
│   │           ├── generate-slots/  # Génération auto créneaux J+14
│   │           ├── notifications/   # Worker outbox WhatsApp
│   │           ├── purge-logs/      # Archivage NotificationLog
│   │           └── events/route.ts  # Retry EventLog (toutes les 2 min)
│   │
│   ├── components/
│   │   ├── ThemeInit.tsx            # Dark/light mode (client-only)
│   │   └── ui/
│   │       ├── Nav.tsx              # PublicNav (i18n) + DashboardNav (notif badge)
│   │       └── PhoneInput.tsx       # Sélecteur pays + indicatif international
│   │
│   ├── lib/
│   │   ├── auth-client.ts           # getToken · getUser · setAuth · clearAuth
│   │   ├── auth-guard.ts            # resolveRedirect() · DASHBOARD_ROLES · ADMIN_ROLES
│   │   ├── route-auth.ts            # withAuth · withRole · withTenant
│   │   │                            # withActiveTenant() — vérifie status ACTIVE
│   │   ├── events.ts                # emitEvent() · onEvent() + EventLog persistence
│   │   ├── event-handlers.ts        # Registre centralisé de tous les handlers
│   │   ├── event-queue.ts           # processEventQueue() · getQueueHealth()
│   │   ├── domain-events.ts         # DomainEvents factory (DDD) + emitDomainEvent()
│   │   ├── audit.ts                 # createAuditLog() centralisé
│   │   ├── settings.ts              # getAllSettings() · cache 30s · requireNotMaintenance()
│   │   ├── api-fetch.ts             # apiFetch() avec credentials:include
│   │   ├── cors.ts                  # getCorsHeaders() — allowlist origins
│   │   ├── payment.ts               # canUsePayment() — FREE plan = pas de paiement
│   │   ├── i18n.ts                  # Traductions FR/EN + type TranslationKey
│   │   ├── lang-context.tsx         # LangProvider (Context React)
│   │   ├── rate-limit.ts            # rateLimitByPhone() via AuditLog
│   │   ├── money.ts                 # Formatage monétaire FCFA/EUR/USD
│   │   ├── fetch-with-retry.ts      # Retry sur 503
│   │   └── zod-formatter.ts         # Formatage erreurs Zod → JSON API
│   │
│   ├── services/
│   │   ├── auth.service.ts          # sendOtp · verifyOtp · refreshAccessToken
│   │   ├── booking.service.ts       # createBooking · cancelBooking · getTenantBookings
│   │   │                            # → emitEvent("booking.created/cancelled")
│   │   ├── fraud.service.ts         # runFraudCheck() · 6 signaux · auto-block ≥ 80
│   │   └── plan.service.ts          # syncPlanToTenants() · resetTenantQuota()
│   │
│   ├── domain/
│   │   └── booking/booking.rules.ts # Règles pures (testables sans DB)
│   │
│   ├── infrastructure/
│   │   ├── db/prisma.ts             # Client Prisma singleton
│   │   ├── providers/payment.ts     # Wave · Orange · Stripe adapters
│   │   └── queue/worker.ts          # Worker outbox WhatsApp
│   │
│   ├── hooks/
│   │   ├── useLang.ts               # Re-export depuis lang-context
│   │   └── useBooking.ts            # State machine réservation
│   │
│   ├── config/
│   │   ├── env.ts                   # Validation Zod des variables d'env
│   │   └── plans.config.ts          # Limites par plan (bookings, services, etc.)
│   │
│   ├── shared/
│   │   └── errors.ts                # AppError · AppErrors factory · handleRouteError
│   │
│   └── messages/
│       ├── fr.json                  # Traductions françaises
│       └── en.json                  # Traductions anglaises
│
├── prisma/
│   ├── schema.prisma                # 12 modèles + enums
│   ├── seed.ts                      # Données de test complètes
│   └── migrations/
│       ├── 20260501133736_init/
│       ├── 20260502051121_add_auditlog_ratelimit_index/
│       ├── 20260502060000_add_tenant_horaires/
│       ├── 20260502070000_add_plan_config/
│       ├── 20260504000000_admin_enhancements/   # PlanConfig limits/features + SystemSetting
│       └── 20260504120000_event_log_and_notifications/ # EventLog + AdminNotification
│
├── scripts/
│   ├── fix-db.mjs                   # Fix +352→+221, purge OTP, upsert SUPER_ADMIN
│   ├── fix-admin.mjs                # Correction compte admin
│   ├── reset-dev-state.mjs          # Reset environnement dev
│   ├── seed-plans.mjs               # Seeding PlanConfig
│   └── seed-photos.mjs              # Seeding photos via URL
│
├── public/
│   ├── manifest.json                # PWA manifest
│   ├── favicon.svg
│   └── robots.txt
│
├── next.config.js                   # Headers sécurité + images CDN
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.seed.json
└── DOCUMENTATION.md
```

---

## 5. Modèle de données

### Schéma complet (12 modèles)

```mermaid
erDiagram
    Tenant {
        string id PK
        string name
        string slug UK
        enum   plan
        enum   status
        int    bookingsUsedMonth
        bool   depositEnabled
        int    depositPercent
    }
    User {
        string id PK
        string phone UK
        enum   role
        string tenantId FK
    }
    Service {
        string id PK
        string tenantId FK
        string name
        int    priceCents
        int    durationMin
    }
    Slot {
        string   id PK
        string   tenantId FK
        datetime startsAt
        bool     isAvailable
    }
    Booking {
        string id PK
        string tenantId FK
        string userId FK
        string slotId FK
        enum   status
        int    priceCents
        string idempotencyKey UK
    }
    NotificationLog {
        string id PK
        string tenantId FK
        enum   type
        enum   status
        string channel
        string idempotencyKey UK
    }
    FraudAlert {
        string id PK
        string tenantId FK
        int    riskScore
        json   signals
        enum   status
    }
    AuditLog {
        string id PK
        string tenantId FK
        string actorId FK
        string action
        json   newValue
    }
    PlanConfig {
        string id PK
        string plan UK
        int    priceFcfa
        int    priceEur
        json   limits
        json   features
    }
    SystemSetting {
        string key PK
        json   value
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
        string tenantId FK
        bool   read
    }

    Tenant ||--o{ User : "emploie"
    Tenant ||--o{ Service : "offre"
    Tenant ||--o{ Slot : "possède"
    Tenant ||--o{ Booking : "reçoit"
    Tenant ||--o{ FraudAlert : "surveille"
    Tenant ||--o{ AuditLog : "trace"
    User   ||--o{ Booking : "crée"
    Service||--o{ Booking : "concerne"
    Slot   ||--o{ Booking : "occupe"
    Booking||--o{ NotificationLog : "génère"
```

### Enums

| Enum | Valeurs |
|---|---|
| `Plan` | `FREE` · `PRO` · `PREMIUM` |
| `UserRole` | `CLIENT` · `OWNER` · `STAFF` · `ADMIN` · `SUPER_ADMIN` |
| `TenantStatus` | `PENDING` · `ACTIVE` · `SUSPENDED` · `BLOCKED` · `FRAUD` |
| `BookingStatus` | `PENDING` · `CONFIRMED` · `COMPLETED` · `CANCELLED` · `NO_SHOW` |
| `PaymentStatus` | `PENDING` · `PAID` · `REFUNDED` · `FAILED` |
| `PaymentProvider` | `WAVE` · `ORANGE_MONEY` · `STRIPE` · `PAYSTACK` · `MTN_MONEY` · `CASH` |
| `FraudStatus` | `NEW` · `UNDER_REVIEW` · `ACTION_TAKEN` · `CLOSED` |
| `NotifType` | `BOOKING_CONFIRMED` · `BOOKING_REMINDER` · `BOOKING_CANCELLED` · `BOOKING_COMPLETED` · `PAYMENT_RECEIVED` · `WELCOME` · `PROMO` |

### PlanConfig — limites dynamiques

```json
{
  "limits":   { "bookingsPerMonth": 20, "services": 3, "staff": 0, "photosPerService": 3 },
  "features": { "deposit": false, "whatsapp": false, "analytics": false, "prioritySupport": false, "customDomain": false }
}
```

Ces valeurs sont modifiables depuis le panneau admin → Plans sans migration SQL.

### EventLog — file d'événements persistante

| Champ | Type | Description |
|---|---|---|
| `type` | string | `"tenant.blocked"`, `"booking.created"`, etc. |
| `status` | string | `pending` · `processing` · `processed` · `failed` |
| `retries` | int | Nombre de tentatives de retraitement |
| `maxRetries` | int | Maximum (défaut 3) |
| `error` | string? | Dernière erreur catchée |

---

## 6. Authentification & Sécurité

### Flux OTP complet

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant L as Login Page
    participant A as /api/auth
    participant S as auth.service.ts
    participant DB as PostgreSQL
    participant WA as WhatsApp API

    U->>L: Saisit numéro (sélecteur pays + local)
    L->>L: normalizePhone() → E.164 (+221771234567)
    L->>A: POST /api/auth?action=send-otp
    A->>A: rateLimitByPhone (max 3 / 2 min)
    A->>S: sendOtp(phone)
    S->>S: Génère OTP 6 chiffres + hash SHA-256 + JWT_SECRET
    S->>DB: INSERT AuditLog {action:"otp.sent", hashedOtp, expiresAt}
    S->>WA: Envoie message WhatsApp direct
    A-->>L: { sent: true, phoneMask }

    U->>L: Saisit le code OTP
    L->>A: POST /api/auth?action=verify-otp
    A->>A: rateLimitByPhone (max 5 / 15 min)
    A->>S: verifyOtp(phone, otp)
    S->>DB: SELECT dernier AuditLog otp.sent
    S->>S: Vérifie hash + expiration (10 min)
    S->>DB: UPSERT User (crée CLIENT si premier login)
    S->>S: Signe JWT HS256 (sub, role, tenantId)
    A->>A: Set httpOnly cookie belo_token (7j)
    A-->>L: { accessToken, user }
    L->>L: localStorage.setItem(token, user)
    L->>L: router.replace(resolveRedirect(user))
```

### JWT & stockage

- **Algorithme** : HS256 (via `jose`) — signature vérifiée à chaque requête
- **Payload** : `{ sub: userId, role, tenantId? }`
- **Durée** : 7 jours (access) · 30 jours (refresh)
- **Stockage** : httpOnly cookie `belo_token` (SameSite=Lax, Secure en prod) + `localStorage` pour les headers API fetch

### proxy.ts — Interception Edge (Next.js 16)

```typescript
// Règles appliquées AVANT le rendu de chaque page

/admin      → JWT cookie requis · rôle: ADMIN ou SUPER_ADMIN (sinon → /)
/dashboard  → JWT cookie requis · rôle: OWNER/STAFF/ADMIN/SUPER_ADMIN (sinon → /login)
/profil     → JWT cookie requis · tout rôle authentifié (sinon → /login)
/api/admin  → JWT Bearer/cookie · ADMIN/SUPER_ADMIN · injection x-user-id/role
```

### `withActiveTenant()` — enforcement global

```typescript
// Vérifie existence + statut ACTIVE du tenant avant toute opération métier
const check = await withActiveTenant(auth, tenantId);
if (!check.ok) return check.response; // 404 TENANT_NOT_FOUND ou 403 TENANT_INACTIVE
```

### `requireNotMaintenance()` — mode maintenance

```typescript
// Appelé en tête de POST /api/bookings
await requireNotMaintenance(); // → 503 si maintenance_mode = true en DB
```

---

## 7. Système d'événements

### Architecture event-driven

Le système d'événements de Belo est **synchrone en mémoire** (effets immédiats dans la même requête) avec **persistance asynchrone** dans EventLog (pour le retry et l'audit trail).

```
emitEvent("tenant.blocked", payload)
    │
    ├── 1. INSERT EventLog (status=pending) — fire-and-forget
    │
    └── 2. Dispatch synchrone des handlers
              │
              ├── createAuditLog()
              ├── runFraudCheck()  (sur booking.cancelled / payment.failed)
              ├── AdminNotification.create()  (sur tenant.created / fraud≥60)
              └── invalidateSettingsCache()  (sur settings.updated / plan.updated)
```

### Types d'événements

| Event | Payload | Déclenché par |
|---|---|---|
| `tenant.blocked` | `{ tenantId, tenantName?, adminId?, reason? }` | Admin action / fraud engine |
| `tenant.activated` | `{ tenantId, tenantName?, adminId? }` | Admin validate/reactivate |
| `tenant.suspended` | `{ tenantId, tenantName?, adminId?, reason? }` | Admin action |
| `tenant.created` | `{ tenantId, tenantName, ownerId, plan? }` | POST /api/tenants |
| `plan.updated` | `{ plan, changes, adminId?, tenantCount? }` | PATCH /api/plans |
| `payment.failed` | `{ bookingId, tenantId, reason? }` | Webhook / route |
| `booking.created` | `{ bookingId, tenantId, userId, priceCents }` | createBooking() |
| `booking.cancelled` | `{ bookingId, tenantId, cancelledBy?, reason? }` | cancelBooking() |
| `fraud.detected` | `{ tenantId, tenantName?, riskScore, signals[] }` | fraud.service |
| `settings.updated` | `{ keys[], adminId? }` | PATCH /api/admin/settings |

### Domain Events (DDD)

```typescript
import { DomainEvents, emitDomainEvent } from "@/lib/domain-events";

// Utilisation avec envelope typée (eventId + occurredAt + schemaVersion)
await emitDomainEvent(
  DomainEvents.tenantBlocked({ tenantId, adminId, reason })
);
```

### EventLog — retry queue

Le cron `/api/cron/events` (toutes les 2 min) retraite les entrées `pending` :

```typescript
// event-queue.ts — SELECT FOR UPDATE SKIP LOCKED (concurrent-safe)
const stats = await processEventQueue(100);
// → { processed: N, failed: M, skipped: 0 }
```

Lifecycle d'une entrée EventLog :
```
pending → processing → processed ✓
                    └→ pending (retry si retries < maxRetries)
                    └→ failed ✗ (après maxRetries = 3 tentatives)
```

### Enregistrement des handlers

```typescript
// Importé en side-effect dans chaque service/route qui appelle emitEvent()
import "@/lib/event-handlers";

// Enregistrement (module cache → 1 seule fois par instance warm)
onEvent("tenant.created", async ({ tenantId, tenantName, ownerId }) => {
  await prisma.adminNotification.create({ ... });
});
```

---

## 8. Fraud Engine

### Vue d'ensemble

Le fraud engine analyse les comportements des tenants après chaque annulation ou échec de paiement. Il maintient un score de 0 à 100 et crée automatiquement des alertes.

```
score 0–29   → clean (aucune action)
score 30–59  → watch (NEW FraudAlert créée)
score 60–79  → risky (AdminNotification envoyée)
score ≥ 80   → critique (tenant.status = FRAUD, auto-bloqué)
```

### 6 signaux détectés

| Signal | Condition | Poids |
|---|---|---|
| `high_cancellations_24h` | > 5 annulations en 24h | +8 par excès (max 40) |
| `high_cancellation_rate_30d` | Taux annulation > 40% sur 30j | Jusqu'à +30 |
| `quota_gaming_suspected` | Quota élevé mais très peu de vrais bookings | +20 |
| `booking_velocity_spike` | > 20 créations en 1h (comportement bot) | +3 par excès (max 35) |
| `existing_fraud_alert` | Alerte active avec score > 50 | +30% du score existant |
| `cross_tenant_canceller` | Utilisateur annulant dans ≥ 2 autres tenants (24h) | +5 par utilisateur (max 25) |

### Appel automatique

```typescript
// booking.service.ts — après cancelBooking()
emitEvent("booking.cancelled", { bookingId, tenantId }).catch(() => {});
// → event-handlers.ts → runFraudCheck(tenantId)

// event-handlers.ts — sur payment.failed
onEvent("payment.failed", async ({ tenantId }) => {
  await runFraudCheck(tenantId);
});
```

### Alerte admin

Quand `riskScore ≥ 60`, une `AdminNotification` est automatiquement créée :
```
type:  "fraud_alert"
title: "⚠️ Alerte fraude : Studio Elégance"
body:  "Score de risque : 72/100. Signaux : high_cancellations_24h, cross_tenant_canceller."
```

---

## 9. Admin Control Panel

### 7 vues fonctionnelles

| Vue | Données | Actions |
|---|---|---|
| **Mission Control** | KPIs live · queue validation PENDING · logs récents | Valider tenants en 1 clic |
| **Tenants** | Tableau filtrable · statut coloré · bookings | validate · block · suspend · change_plan |
| **Plans** | Prix FCFA/EUR + limites + features | Éditer prix · limites · features toggles |
| **Fraude** | FraudAlert avec risk score et signaux | Enquêter · Action · Clore |
| **Équipe** | Admins SUPER_ADMIN/ADMIN · lastLogin | Voir rôles |
| **Logs** | AuditLog paginé · actor · tenant | Filtrer · Paginer |
| **Réglages** | Maintenance · commission slider · providers actifs · OTP bypass | Sauvegarder |

### `apiFetch()` — sécurité cookie

Tous les appels admin utilisent `credentials: "include"` :

```typescript
// lib/api-fetch.ts
const res = await apiFetch("/api/admin/tenants", {
  method: "POST",
  body: JSON.stringify({ action: "block" }),
});
// → Le cookie httpOnly belo_token est envoyé automatiquement
// → Aucun token ne transite en JS
```

### Live Feed — `/api/admin/stream`

Le Mission Control poll toutes les 5 secondes :

```typescript
GET /api/admin/stream?since=2026-05-04T10:00:00Z&limit=30
→ { events: EventLog[], cursor: ISO8601, health: QueueHealth }
```

### Notifications admin — `/api/admin/notifications`

```typescript
GET  /api/admin/notifications         → { notifications[], unreadCount }
PATCH /api/admin/notifications?id=X   → mark as read
PATCH /api/admin/notifications?all=1  → mark all as read
```

Types de notifications automatiques :
- `tenant_validation_required` — nouveau salon inscrit
- `fraud_alert` — score fraude ≥ 60

---

## 10. Flux de navigation

### Parcours Client (réservation)

```mermaid
flowchart TD
    A([Visiteur]) --> B[Landing /]
    B --> C[Listing /salons]
    C --> D[Fiche salon /booking/:slug]
    D --> E{Token ?}
    E -- Non --> F[Login OTP /login]
    F --> G{Rôle ?}
    G -- CLIENT --> D
    E -- Oui --> H[Étape 1 — Choisir service]
    H --> I[Étape 2 — Choisir créneau]
    I --> J[Étape 3 — Confirmer + WhatsApp]
    J --> K{Plan PRO+ + dépôt ?}
    K -- Non --> L[POST /api/bookings<br/>→ emitEvent booking.created]
    K -- Oui --> M[POST /api/payments/init]
    M --> N[Wave / OM / Stripe]
    N --> O[POST /api/webhooks]
    L --> P[Étape 4 ✅ Confirmation]
    O --> P
    P --> Q[/profil historique]
```

### Parcours Gérant (dashboard)

```mermaid
flowchart TD
    A([Gérant]) --> B[Login OTP]
    B --> C[Dashboard /dashboard]
    C --> D[KPIs + quota]
    C --> E[Réservations]
    E --> F{PENDING}
    F -- Accepter --> G[PATCH CONFIRMED → pulseSoft animation]
    F -- Refuser --> H[PATCH CANCELLED → runFraudCheck]
    C --> I[Services · Horaires · Profil · Équipe]
```

### Parcours Super-Admin

```mermaid
flowchart TD
    A([Super Admin]) --> B[Login 661000001]
    B --> C[Admin /admin]
    C --> D[Mission Control<br/>KPIs + stream live]
    C --> E[Tenants<br/>validate/block/change_plan]
    E --> F[→ emitEvent tenant.blocked/activated<br/>→ resetTenantQuota si change_plan]
    C --> G[Plans<br/>prix + limites + features]
    G --> H[→ syncPlanToTenants<br/>→ emitEvent plan.updated]
    C --> I[Fraude<br/>Alerts V2 · 6 signaux]
    C --> J[Logs · Équipe · Réglages]
    J --> K[maintenance_mode → blocage /api/bookings<br/>→ emitEvent settings.updated]
```

---

## 11. API Routes — référence complète

### Authentification

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth?action=send-otp` | — | Envoie OTP WhatsApp · rate limit 3/2min |
| `POST` | `/api/auth?action=verify-otp` | — | Vérifie OTP → JWT + cookies httpOnly |
| `POST` | `/api/auth?action=refresh` | cookie | Rafraîchit l'access token |
| `POST` | `/api/auth?action=logout` | — | Efface cookies belo_token + belo_refresh |

### Salons (Tenants)

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/tenants` | — | Liste salons ACTIVE · filtres · Cache-Control 2min |
| `POST` | `/api/tenants` | CLIENT | Inscription → **emitEvent("tenant.created")** |
| `GET` | `/api/tenants/:slug` | — | Profil public + services · Cache 60s |
| `PATCH` | `/api/tenants/:slug` | OWNER · ADMIN | Màj profil · horaires · socials |

### Services

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/services?tenantId=` | — | Liste · Cache 2min |
| `POST` | `/api/services` | OWNER | Crée · vérifie limite plan |
| `PATCH` | `/api/services/:id` | OWNER | Modifie |
| `DELETE` | `/api/services/:id` | OWNER | Soft-delete (isActive=false si bookings passés) |

### Créneaux

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/slots?tenantId=&serviceId=&date=` | — | Disponibles · Cache 60s |
| `POST` | `/api/slots` | OWNER | Génération en masse (max 90j) |
| `DELETE` | `/api/slots?slotId=` | OWNER | Supprime si libre |

### Réservations

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/bookings` | CLIENT | Crée · idempotent · **requireNotMaintenance()** · **emitEvent("booking.created")** |
| `GET` | `/api/bookings?tenantId=` | OWNER | Liste salon · filtre statut/date |
| `GET` | `/api/bookings?userId=` | CLIENT | Historique client |
| `PATCH` | `/api/bookings` | OWNER | CONFIRMED/CANCELLED · transaction atomique · **emitEvent("booking.cancelled")** si CANCELLED |

### Paiements

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/payments?action=init` | CLIENT | Initie Wave/OM/Stripe |
| `GET` | `/api/payments?bookingId=` | CLIENT | Vérifie statut |
| `POST` | `/api/payments?action=refund` | OWNER (PREMIUM) | Remboursement |
| `POST` | `/api/webhooks` | HMAC | Callback Wave · Orange · Stripe (idempotent) |

### Admin — Tenants

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/tenants` | ADMIN | Liste + stats + filtres + tri |
| `POST` | `/api/admin/tenants?action=do-action&id=` | ADMIN | validate · block · suspend · reactivate · change_plan · send_message |
| `POST` | `/api/admin/tenants?action=bulk` | ADMIN | Actions en masse (max 50) |

### Admin — Autres modules

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/fraud` | ADMIN | Liste FraudAlerts + tenant |
| `PATCH` | `/api/admin/fraud?id=` | ADMIN | UNDER_REVIEW · ACTION_TAKEN · CLOSED |
| `GET` | `/api/admin/logs` | ADMIN | AuditLog paginé · filtres action/entity |
| `GET` | `/api/admin/team` | ADMIN | Utilisateurs ADMIN/SUPER_ADMIN |
| `PATCH` | `/api/admin/team?id=` | SUPER_ADMIN | Change rôle (tracé en audit) |
| `GET` | `/api/admin/settings` | ADMIN | Config système (cache 30s) |
| `PATCH` | `/api/admin/settings` | SUPER_ADMIN | Màj + **emitEvent("settings.updated")** + invalidation cache |
| `GET` | `/api/admin/notifications` | ADMIN | Inbox + unreadCount |
| `PATCH` | `/api/admin/notifications` | ADMIN | Mark read / mark all read |
| `GET` | `/api/admin/stream` | ADMIN | EventLog feed (polling 5s) + queue health |

### Plans

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/plans` | — | Tarifs + limits + features · Cache 5min |
| `PATCH` | `/api/plans` | ADMIN | Màj prix/limites/features → **syncPlanToTenants()** |

### Cron jobs

| Endpoint | Fréquence | Description |
|---|---|---|
| `/api/cron/generate-slots` | quotidien 02h00 | Génère créneaux J+14 |
| `/api/cron/notifications` | toutes les minutes | Worker outbox WhatsApp |
| `/api/cron/purge-logs` | hebdomadaire dim 03h00 | Archive NotificationLog |
| `/api/cron/events` | toutes les 2 minutes | Retry EventLog (SELECT FOR UPDATE SKIP LOCKED) |

---

## 12. Contrôle d'accès par rôle (RBAC)

```mermaid
graph TD
    subgraph Rôles
        SA[SUPER_ADMIN]
        AD[ADMIN]
        OW[OWNER]
        ST[STAFF]
        CL[CLIENT]
        GU[Anonyme]
    end

    subgraph Pages
        ADM[/admin]
        DASH[/dashboard/*]
        PROF[/profil]
        PUB[/ · /salons · /booking/*]
    end

    subgraph API
        APIAD[/api/admin/*]
        APIBOOK_W[/api/bookings PATCH]
        APIBOOK_R[/api/bookings GET]
        APIPUB[/api/tenants GET<br/>/api/slots GET]
    end

    SA & AD --> ADM & DASH & APIAD
    OW & ST --> DASH & APIBOOK_W & APIBOOK_R
    CL --> PROF & PUB & APIPUB
    GU --> PUB & APIPUB
```

### `resolveRedirect()` — destination post-login

```typescript
// src/lib/auth-guard.ts
SUPER_ADMIN  → /admin
ADMIN        → /dashboard
OWNER        → /dashboard
STAFF        → /dashboard
CLIENT       → /profil
null         → /login
```

### Limites par plan

| Fonctionnalité | FREE | PRO | PREMIUM |
|---|---|---|---|
| Bookings / mois | 20 | 500 | Illimités |
| Services | 3 | 20 | Illimités |
| Staff max | 0 | 5 | Illimités |
| Photos / service | 3 | 10 | 50 |
| WhatsApp auto | ✗ | ✓ | ✓ |
| Dépôt / acompte | ✗ | ✓ | ✓ |
| Analytics | ✗ | ✗ | ✓ |
| Remboursement auto | ✗ | ✗ | ✓ |
| Domaine custom | ✗ | ✗ | ✓ |

> Ces limites sont stockées en JSON dans `PlanConfig.limits` et `PlanConfig.features`, modifiables depuis l'admin sans migration.

---

## 13. i18n — Internationalisation

```typescript
// Utilisation dans un composant
import { useLang } from "@/hooks/useLang";

const { t, lang, setLang } = useLang();
// t("hero_title")   → "La beauté réservée" (fr) | "Beauty, booked" (en)
// setLang("en")     → persiste en localStorage + dispatch event
```

| Namespace | Clés disponibles |
|---|---|
| `common` | `nav_discover` · `hero_title` · `hero_title2` · `hero_sub` · `hero_desc` · `featured_salons` · `see_all` · `cta_find` · ... |
| `booking` | `choose_service` · `choose_slot` · `confirm_booking` · `no_slots` · `how_title` · `step1_title` · ... |
| `dashboard` | `login_title` · `send_code` · `connect` · `resend` · `back_home` · ... |

---

## 14. PWA — Bouton d'installation

Le fichier `public/manifest.json` est présent. Pour afficher un bouton d'installation sur mobile :

```tsx
// src/components/InstallPWA.tsx — affiche uniquement sur mobile si PWA installable
"use client";
import { useEffect, useState } from "react";

export default function InstallPWA() {
  const [prompt, setPrompt] = useState<any>(null);

  useEffect(() => {
    if (window.innerWidth > 768) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setPrompt(e);
    });
  }, []);

  if (!prompt) return null;

  return (
    <button onClick={() => prompt.prompt()}>
      Installer l'app Belo
    </button>
  );
}
```

> **iOS Safari** : `beforeinstallprompt` non supporté → afficher un message manuel "Partager → Ajouter à l'écran d'accueil".

---

## 15. Variables d'environnement

### Obligatoires

```bash
# Base de données (Neon PostgreSQL)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"  # migrations directes

# JWT
JWT_SECRET="minimum-32-caracteres-aleatoires"
JWT_EXPIRES_IN="7d"
REFRESH_TOKEN_EXPIRES_IN="30d"

# App
NEXT_PUBLIC_APP_URL="https://belo-khaki.vercel.app"
CRON_SECRET="secret-pour-proteger-les-crons"
```

### Paiements

```bash
WAVE_API_KEY=""
WAVE_WEBHOOK_SECRET=""
ORANGE_API_KEY=""
ORANGE_MERCHANT_ID=""
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

### WhatsApp

```bash
WHATSAPP_PHONE_ID=""
WHATSAPP_TOKEN=""
# OTP_BYPASS=true   # Dev : affiche OTP dans les logs serveur
```

### Stockage médias

```bash
R2_ACCOUNT_ID=""
R2_ACCESS_KEY=""
R2_SECRET_KEY=""
R2_BUCKET="belo-media"
NEXT_PUBLIC_CDN_URL="https://cdn.belo.sn"
```

---

## 16. Installation & Développement

### Prérequis

- Node.js ≥ 20
- npm ≥ 10
- Compte Neon PostgreSQL

### Démarrage rapide

```bash
git clone https://github.com/Ahmesgroup/belo.git
cd belo
npm install

# Configurer l'environnement
cp .env.example .env.local
# Éditer .env.local avec DATABASE_URL, DIRECT_URL, JWT_SECRET, etc.

# Initialiser la DB (toutes les migrations)
npx prisma migrate deploy

# Seeder les données de test
npm run db:seed

# Lancer en développement
npm run dev  # → http://localhost:3000
```

### Scripts npm

```bash
npm run dev          # Développement
npm run build        # prisma generate + migrate deploy + next build
npm run db:generate  # Régénère le client Prisma
npm run db:migrate   # Crée une nouvelle migration (dev)
npm run db:seed      # Seede les données de test
npm run db:studio    # Prisma Studio → http://localhost:5555
npm run db:reset     # ⚠️ Reset complet (destructif)
```

### Scripts de maintenance

```bash
node scripts/fix-db.mjs      # Corrige les comptes admin en prod
node scripts/seed-plans.mjs  # Seede les PlanConfig
node scripts/seed-photos.mjs # Seede les photos via URL
```

### Dev sans WhatsApp

```bash
# .env.local
OTP_BYPASS=true
# → Les OTP sont affichés dans les logs console (pas envoyés par WhatsApp)
```

---

## 17. Déploiement Vercel

### Déploiement

```bash
npm run build          # Vérifier 0 erreurs TypeScript en local
git add . && git commit -m "feat: ..."
git push
npx vercel --prod
```

Le build Vercel exécute automatiquement `prisma generate && prisma migrate deploy && next build`.

### Cron Jobs — `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/generate-slots",  "schedule": "0 2 * * *"    },
    { "path": "/api/cron/notifications",   "schedule": "*/1 * * * *"  },
    { "path": "/api/cron/purge-logs",      "schedule": "0 3 * * 0"    },
    { "path": "/api/cron/events",          "schedule": "*/2 * * * *"  }
  ]
}
```

Chaque endpoint cron valide `Authorization: Bearer CRON_SECRET`.

### URL de production

```
https://belo-khaki.vercel.app
```

---

## 18. Maintenance DB

### Fix compte SUPER_ADMIN

```bash
node scripts/fix-db.mjs
# → Migre +352 → +221, upsert SUPER_ADMIN, purge OTP, crée staff démo
```

### Prisma Studio

```bash
npm run db:studio  # → http://localhost:5555
```

### Nouvelle migration

```bash
npx prisma migrate dev --name "nom_migration"
npx prisma migrate deploy  # En prod (ou automatique via npm run build)
```

### Migrations existantes

| Migration | Contenu |
|---|---|
| `20260501_init` | Schéma complet initial |
| `20260502_add_auditlog_ratelimit_index` | Index performance AuditLog |
| `20260502_add_tenant_horaires` | Champ horaires JSON |
| `20260502_add_plan_config` | Modèle PlanConfig |
| `20260504_admin_enhancements` | PlanConfig +limits/features · SystemSetting |
| `20260504_event_log_and_notifications` | EventLog · AdminNotification |

---

## 19. Annexe — Décisions d'architecture

| Décision | Choix | Raison |
|---|---|---|
| Auth | OTP WhatsApp + JWT maison | Marché africain — pas de Google/GitHub ; contrôle total |
| DB | Neon serverless PostgreSQL | Scale-to-zero, coût minimal phase 1 |
| Queue notifs | Outbox pattern (NotificationLog) | Pas de Redis phase 1 — PostgreSQL fait la queue |
| Event queue | EventLog table | Durabilité + retry sans Redis ; SELECT FOR UPDATE SKIP LOCKED |
| Event bus | Synchrone in-process | Vercel serverless = pas de mémoire partagée entre requêtes |
| Fraud engine | 6 signaux + auto-block | Actif sans intervention manuelle ; seuil ≥ 80 |
| Paiement | Multi-provider | Wave dominant au Sénégal, Orange Money, Stripe diaspora |
| Anti-double-booking | `SELECT FOR UPDATE` + contrainte DB | Atomicité garantie au niveau base |
| JWT stockage | httpOnly cookie + localStorage | Cookie pour proxy edge, localStorage pour headers API |
| Plans | JSON limits/features en DB | Modificables sans migration SQL depuis l'admin |
| Settings | SystemSetting table + cache 30s | Config plateforme dynamique, cache évite une requête/req |
| Admin stream | Polling 5s sur EventLog | SSE timeout sur Vercel free tier |
| Proxy (edge) | `proxy.ts` (Next.js 16) | Remplace `middleware.ts` — interception avant rendu |
| CORS | getCorsHeaders() allowlist | Pas de wildcard `*` en production |
| i18n | Context React + JSON statique | Léger, pas de lib externe, FR/EN |

---

*Documentation générée pour Belo v0.1.0 — Mise à jour : Mai 2026*
