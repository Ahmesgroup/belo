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
7. [Flux de navigation](#7-flux-de-navigation)
8. [API Routes — référence](#8-api-routes--référence)
9. [Contrôle d'accès par rôle (RBAC)](#9-contrôle-daccès-par-rôle-rbac)
10. [i18n — Internationalisation](#10-i18n--internationalisation)
11. [PWA — Bouton d'installation](#11-pwa--bouton-dinstallation)
12. [Variables d'environnement](#12-variables-denvironnement)
13. [Installation & Développement](#13-installation--développement)
14. [Déploiement Vercel](#14-déploiement-vercel)
15. [Maintenance DB](#15-maintenance-db)

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

---

## 3. Architecture globale

```mermaid
graph TB
    subgraph Client["Navigateur / PWA"]
        UI[React App<br/>Next.js 16 App Router]
        LS[(localStorage<br/>belo_token · belo_user)]
    end

    subgraph Edge["Edge – Vercel / proxy.ts"]
        PX[proxy.ts<br/>JWT verify · RBAC]
    end

    subgraph API["API Routes – Vercel Functions"]
        AUTH[/api/auth<br/>OTP · JWT]
        BOOK[/api/bookings]
        TEN[/api/tenants]
        ADMIN[/api/admin/tenants]
        PAY[/api/payments]
        SLOT[/api/slots]
        CRON[/api/cron/*]
    end

    subgraph Services["Business Logic"]
        AS[auth.service.ts]
        BS[booking.service.ts]
    end

    subgraph DB["Neon PostgreSQL"]
        PRI[(Prisma ORM)]
    end

    subgraph External["Externes"]
        WA[WhatsApp API<br/>Meta Cloud]
        WV[Wave API]
        OM[Orange Money API]
        ST[Stripe API]
        R2[Cloudflare R2]
    end

    UI -->|JWT cookie / Bearer| Edge
    Edge -->|passe ou redirige| API
    API --> Services
    Services --> PRI
    Services -->|outbox pattern| WA
    PAY --> WV
    PAY --> OM
    PAY --> ST
    AUTH --> AS
    BOOK --> BS
```

### Couches de l'application

```mermaid
graph LR
    A[Pages / Composants React] --> B[API Route Handlers]
    B --> C[Services<br/>auth · booking]
    C --> D[Domain Rules<br/>booking.rules.ts]
    C --> E[Infrastructure<br/>Prisma · Providers · Queue]
    E --> F[(PostgreSQL Neon)]
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
│   │   ├── globals.css              # Design tokens (CSS variables)
│   │   ├── sitemap.ts               # Sitemap dynamique
│   │   │
│   │   ├── (public)/                # Routes publiques (pas d'auth requise)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx             # Landing page
│   │   │   ├── login/page.tsx       # Login OTP
│   │   │   ├── booking/[slug]/      # Réservation d'un salon
│   │   │   │   ├── page.tsx
│   │   │   │   └── loading.tsx
│   │   │   ├── salons/              # Listing des salons
│   │   │   │   ├── page.tsx
│   │   │   │   └── loading.tsx
│   │   │   ├── profil/page.tsx      # Profil client
│   │   │   ├── plans/page.tsx       # Tarifs
│   │   │   ├── pour-les-salons/     # Page commerciale gérants
│   │   │   └── confidentialite/     # Politique confidentialité
│   │   │
│   │   ├── dashboard/               # Espace gérant (auth: OWNER · STAFF · ADMIN)
│   │   │   ├── layout.tsx           # Sidebar + auth guard + notif badge
│   │   │   ├── loading.tsx
│   │   │   ├── page.tsx             # Vue d'ensemble + KPIs
│   │   │   ├── bookings/page.tsx    # Gestion réservations (accept/refuse)
│   │   │   ├── services/page.tsx    # Gestion prestations
│   │   │   ├── horaires/page.tsx    # Gestion créneaux
│   │   │   ├── profil/page.tsx      # Paramètres salon
│   │   │   └── equipe/page.tsx      # Gestion staff (plan PREMIUM)
│   │   │
│   │   ├── admin/                   # Super-admin panel (auth: SUPER_ADMIN)
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx             # Mission Control + Tenants + Plans
│   │   │
│   │   └── api/
│   │       ├── auth/route.ts        # POST send-otp · verify-otp · refresh · logout
│   │       ├── bookings/route.ts    # GET · POST · PATCH
│   │       ├── tenants/
│   │       │   ├── route.ts         # GET (listing) · POST (inscription salon)
│   │       │   └── [slug]/route.ts  # GET (profil) · PATCH (màj)
│   │       ├── services/
│   │       │   ├── route.ts         # GET · POST
│   │       │   └── [id]/route.ts    # GET · PATCH · DELETE
│   │       ├── slots/route.ts       # GET (dispo) · POST (génération) · DELETE
│   │       ├── payments/route.ts    # POST init · POST refund · GET verify
│   │       ├── plans/route.ts       # GET · PATCH (admin)
│   │       ├── staff/route.ts       # GET · POST · PATCH · DELETE
│   │       ├── upload/route.ts      # POST (photos R2)
│   │       ├── webhooks/route.ts    # POST Wave · Orange · Stripe
│   │       ├── admin/
│   │       │   └── tenants/route.ts # GET · POST actions (validate · block · …)
│   │       └── cron/
│   │           ├── generate-slots/  # Génération auto créneaux
│   │           ├── notifications/   # Worker outbox WhatsApp
│   │           └── purge-logs/      # Archivage NotificationLog
│   │
│   ├── components/
│   │   ├── ThemeInit.tsx            # Dark/light mode (client-only, no hydration mismatch)
│   │   └── ui/
│   │       ├── Nav.tsx              # PublicNav + DashboardNav
│   │       └── PhoneInput.tsx       # Sélecteur pays + indicatif international
│   │
│   ├── lib/
│   │   ├── auth-client.ts           # getToken · getUser · setAuth · clearAuth · authHeaders
│   │   ├── auth-guard.ts            # resolveRedirect() · DASHBOARD_ROLES · ADMIN_ROLES
│   │   ├── route-auth.ts            # withAuth · withRole · withTenant · signJWT
│   │   ├── cors.ts                  # getCorsHeaders() — allowlist origins
│   │   ├── i18n.ts                  # Traductions FR/EN + type TranslationKey
│   │   ├── lang-context.tsx         # LangProvider (Context React)
│   │   ├── payment.ts               # canUsePayment() — règles plan
│   │   ├── rate-limit.ts            # rateLimitByPhone() via AuditLog
│   │   ├── money.ts                 # Formatage monétaire FCFA/EUR/USD
│   │   ├── fetch-with-retry.ts      # Retry sur 503
│   │   └── zod-formatter.ts         # Formatage erreurs Zod
│   │
│   ├── services/
│   │   ├── auth.service.ts          # sendOtp · verifyOtp · refreshAccessToken
│   │   └── booking.service.ts       # createBooking · cancelBooking · getTenantBookings
│   │
│   ├── domain/
│   │   └── booking/booking.rules.ts # Règles pures (testables sans DB)
│   │
│   ├── infrastructure/
│   │   ├── db/prisma.ts             # Client Prisma singleton
│   │   ├── providers/payment.ts     # Wave · Orange · Stripe adapters
│   │   └── queue/worker.ts          # Cron worker outbox
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
│   ├── schema.prisma                # Schéma Prisma + enums + modèles
│   ├── seed.ts                      # Données de test (salons, services, créneaux)
│   └── migrations/                  # Migrations SQL versionnées
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
├── tsconfig.seed.json               # TS config pour scripts Node
└── DOCUMENTATION.md
```

---

## 5. Modèle de données

### Diagramme entité-relation (simplifié)

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
        string category
        int    priceCents
        int    durationMin
    }

    Slot {
        string   id PK
        string   tenantId FK
        string   serviceId FK
        datetime startsAt
        datetime endsAt
        bool     isAvailable
    }

    Booking {
        string id PK
        string tenantId FK
        string userId FK
        string serviceId FK
        string slotId FK
        enum   status
        enum   paymentStatus
        int    priceCents
        string idempotencyKey UK
    }

    NotificationLog {
        string id PK
        string tenantId FK
        string bookingId FK
        enum   type
        enum   status
        string channel
        string recipient
        string idempotencyKey UK
    }

    PlanConfig {
        string id PK
        string plan UK
        int    priceFcfa
        int    priceEur
        int    priceUsd
    }

    Tenant ||--o{ User : "emploie"
    Tenant ||--o{ Service : "offre"
    Tenant ||--o{ Slot : "possède"
    Tenant ||--o{ Booking : "reçoit"
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
| `NotifType` | `BOOKING_CONFIRMED` · `BOOKING_REMINDER` · `BOOKING_CANCELLED` · `BOOKING_COMPLETED` · `PAYMENT_RECEIVED` · `WELCOME` · `PROMO` |

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
    participant WA as WhatsApp API

    U->>L: Saisit numéro (pays + local)
    L->>L: normalizePhone() → E.164
    L->>A: POST /api/auth?action=send-otp
    A->>A: rateLimitByPhone (max 3 / 2min)
    A->>S: sendOtp(phone)
    S->>S: Génère OTP 6 chiffres + hash SHA-256
    S->>DB: INSERT auditLog {action:"otp.sent", hashedOtp, expiresAt}
    S->>WA: Envoie message WhatsApp direct
    A-->>L: { sent: true, phoneMask }

    U->>L: Saisit le code OTP
    L->>A: POST /api/auth?action=verify-otp
    A->>A: rateLimitByPhone (max 5 / 15min)
    A->>S: verifyOtp(phone, otp)
    S->>DB: SELECT dernier auditLog otp.sent pour ce numéro
    S->>S: Vérifie hash + expiration (10 min)
    S->>DB: UPSERT User (crée CLIENT si inconnu)
    S->>S: Signe JWT HS256 (sub, role, tenantId)
    A->>A: Set httpOnly cookie belo_token (7j)
    A-->>L: { accessToken, user: {id, name, phone, role, tenantId} }
    L->>L: localStorage.setItem(token, user)
    L->>L: router.replace(resolveRedirect(user))
```

### JWT & Proxy

- **Algorithme** : HS256 (via `jose`)
- **Payload** : `{ sub: userId, role, tenantId? }`
- **Durée** : 7 jours (access) · 30 jours (refresh)
- **Stockage** : httpOnly cookie `belo_token` (SameSite=Lax) + `localStorage` (pour les headers API)

### proxy.ts — Interception Edge

```typescript
// Règles d'accès appliquées à chaque requête avant le rendu
/admin      → rôles : ADMIN · SUPER_ADMIN          (sinon → /)
/dashboard  → rôles : OWNER · STAFF · ADMIN · SUPER_ADMIN  (sinon → /)
/profil     → utilisateur authentifié              (sinon → /login)
/api/admin  → ADMIN · SUPER_ADMIN + injection x-user-id/role (sinon 401/403)
```

---

## 7. Flux de navigation

### Parcours Client (réservation)

```mermaid
flowchart TD
    A([Visiteur]) --> B[Landing page /]
    B --> C[Listing /salons]
    C --> D[Fiche salon /booking/:slug]
    D --> E{Connecté ?}
    E -- Non --> F[Login OTP /login]
    F --> G{Rôle ?}
    G -- CLIENT --> D
    E -- Oui --> H[Étape 1 — Choisir service]
    H --> I[Étape 2 — Choisir créneau]
    I --> J[Étape 3 — Confirmer + WhatsApp]
    J --> K{Dépôt activé ?}
    K -- Non --> L[POST /api/bookings]
    K -- Oui --> M[POST /api/payments/init]
    M --> N[Redirection Wave / OM / Stripe]
    N --> O[POST /api/webhooks]
    L --> P[Étape 4 — Confirmation ✅]
    O --> P
    P --> Q[Voir mes réservations /profil]
```

### Parcours Gérant (dashboard)

```mermaid
flowchart TD
    A([Gérant]) --> B[Login OTP]
    B --> C{Rôle ?}
    C -- OWNER / STAFF --> D[Dashboard /dashboard]
    D --> E[Vue d'ensemble KPIs]
    D --> F[Réservations /dashboard/bookings]
    F --> G{Action sur PENDING}
    G -- Accepter --> H[PATCH /api/bookings CONFIRMED]
    G -- Refuser --> I[PATCH /api/bookings CANCELLED]
    D --> J[Services /dashboard/services]
    J --> K[POST /api/services]
    D --> L[Horaires /dashboard/horaires]
    L --> M[POST /api/slots]
    D --> N[Profil salon /dashboard/profil]
    N --> O[PATCH /api/tenants/:slug]
    D --> P[Équipe /dashboard/equipe]
    P --> Q[POST /api/staff]
```

### Parcours Super-Admin

```mermaid
flowchart TD
    A([Super Admin]) --> B[Login 661000001]
    B --> C[Admin Panel /admin]
    C --> D[Mission Control]
    C --> E[Tenants]
    E --> F{Action}
    F --> G[Valider salon]
    F --> H[Bloquer / Suspendre]
    F --> I[Changer plan]
    F --> J[Envoyer message]
    G --> K[POST /api/admin/tenants?action=do-action]
    H --> K
    I --> K
    C --> L[Plans & Tarifs]
    L --> M[PATCH /api/plans]
    C --> N[Fraude / Logs]
```

---

## 8. API Routes — référence

### Authentification

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth?action=send-otp` | — | Envoie OTP WhatsApp |
| `POST` | `/api/auth?action=verify-otp` | — | Vérifie OTP → retourne JWT |
| `POST` | `/api/auth?action=refresh` | cookie | Rafraîchit l'access token |
| `POST` | `/api/auth?action=logout` | — | Efface cookies |

### Salons (Tenants)

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/tenants` | — | Liste salons actifs (filtres, pagination) |
| `POST` | `/api/tenants` | CLIENT | Inscription nouveau salon |
| `GET` | `/api/tenants/:slug` | — | Profil public du salon + services |
| `PATCH` | `/api/tenants/:slug` | OWNER · ADMIN | Mise à jour profil salon |

### Services

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/services?tenantId=` | — | Liste services d'un salon |
| `POST` | `/api/services` | OWNER | Créer un service |
| `PATCH` | `/api/services/:id` | OWNER | Modifier un service |
| `DELETE` | `/api/services/:id` | OWNER | Désactiver un service |

### Créneaux

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/slots?tenantId=&serviceId=&date=` | — | Créneaux disponibles |
| `POST` | `/api/slots` | OWNER | Génère des créneaux en masse |
| `DELETE` | `/api/slots?slotId=` | OWNER | Supprime un créneau libre |

### Réservations

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/bookings` | CLIENT | Créer une réservation (idempotent) |
| `GET` | `/api/bookings?tenantId=` | OWNER | Liste réservations du salon |
| `GET` | `/api/bookings?userId=` | CLIENT | Historique client |
| `PATCH` | `/api/bookings` | OWNER | Accepter / Refuser (CONFIRMED / CANCELLED) |

### Paiements

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/payments?action=init` | CLIENT | Initie session paiement (Wave / OM / Stripe) |
| `GET` | `/api/payments?bookingId=` | CLIENT | Vérifie statut paiement |
| `POST` | `/api/payments?action=refund` | OWNER (PREMIUM) | Remboursement |
| `POST` | `/api/webhooks` | HMAC | Callback Wave · Orange · Stripe |

### Admin

| Méthode | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/admin/tenants` | ADMIN | Liste tous les salons + stats |
| `POST` | `/api/admin/tenants?action=do-action&id=` | ADMIN | validate · block · suspend · change_plan |
| `POST` | `/api/admin/tenants?action=bulk` | ADMIN | Actions en masse |
| `GET` | `/api/plans` | — | Tarifs des plans |
| `PATCH` | `/api/plans` | ADMIN | Modifier les tarifs |

### Cron jobs

| Endpoint | Déclencheur | Description |
|---|---|---|
| `/api/cron/generate-slots` | Vercel Cron (quotidien) | Génère les créneaux J+14 |
| `/api/cron/notifications` | Vercel Cron (toutes les 30s) | Worker outbox WhatsApp |
| `/api/cron/purge-logs` | Vercel Cron (hebdomadaire) | Archive NotificationLog ancien |

---

## 9. Contrôle d'accès par rôle (RBAC)

```mermaid
graph TD
    subgraph Rôles
        SA[SUPER_ADMIN]
        AD[ADMIN]
        OW[OWNER]
        ST[STAFF]
        CL[CLIENT]
        GU[Visiteur anonyme]
    end

    subgraph Accès
        ADM[/admin]
        DASH[/dashboard/*]
        PROF[/profil]
        PUB[/ · /salons · /booking/*]
        APIAD[/api/admin/*]
        APIPRIV[/api/bookings PATCH]
    end

    SA --> ADM
    SA --> DASH
    AD --> ADM
    AD --> DASH
    OW --> DASH
    ST --> DASH
    CL --> PROF
    CL --> PUB
    GU --> PUB

    SA --> APIAD
    AD --> APIAD
    OW --> APIPRIV
    ST --> APIPRIV
```

### `resolveRedirect()` — destination post-login

```typescript
// src/lib/auth-guard.ts
SUPER_ADMIN  → /admin
ADMIN        → /dashboard
OWNER        → /dashboard
STAFF        → /dashboard
CLIENT       → /profil
```

### Limites par plan

| Fonctionnalité | FREE | PRO | PREMIUM |
|---|---|---|---|
| Bookings / mois | 20 | 500 | Illimités |
| Services | 3 | 20 | Illimités |
| WhatsApp auto | ✗ | ✓ | ✓ |
| Dépôt / acompte | ✗ | ✓ | ✓ |
| Remboursement auto | ✗ | ✗ | ✓ |
| Équipe | ✗ | ✗ | ✓ |
| Photos / service | 3 | 10 | 50 |

---

## 10. i18n — Internationalisation

Le système utilise un **Context React** (`LangProvider`) comme source unique pour la langue.

```
src/
├── lib/
│   ├── i18n.ts          # Objet translations { fr: {...}, en: {...} } + type TranslationKey
│   └── lang-context.tsx  # LangProvider + useLang() hook
├── hooks/
│   └── useLang.ts        # Re-export depuis lang-context (backward compat)
└── messages/
    ├── fr.json           # Traductions supplémentaires FR
    └── en.json           # Traductions supplémentaires EN
```

### Utilisation dans un composant

```tsx
import { useLang } from "@/hooks/useLang";

export function MonComposant() {
  const { t, lang, setLang } = useLang();

  return (
    <>
      <h1>{t("hero_title")}</h1>
      <button onClick={() => setLang(lang === "fr" ? "en" : "fr")}>
        {lang === "fr" ? "EN" : "FR"}
      </button>
    </>
  );
}
```

### Clés de traduction disponibles (espaces de noms)

| Namespace | Exemples de clés |
|---|---|
| `common` | `nav_discover` · `hero_title` · `hero_sub` · `search_btn` |
| `booking` | `choose_service` · `choose_slot` · `confirm_booking` · `no_slots` |
| `dashboard` | `login_title` · `send_code` · `connect` · `resend` |

---

## 11. PWA — Bouton d'installation

### Configuration existante

Le fichier `public/manifest.json` est déjà présent et déclaré dans la balise `<head>` via les métadonnées Next.js.

```json
// public/manifest.json (structure)
{
  "name": "Belo",
  "short_name": "Belo",
  "description": "Réservation salons de beauté",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#07080d",
  "theme_color": "#22d38a",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Composant `InstallPWA`

Créer `src/components/InstallPWA.tsx` :

```tsx
"use client";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPWA() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // N'afficher que sur mobile (largeur ≤ 768px) et si PWA installable
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    // Masquer si déjà en mode standalone (app installée)
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", bottom: 80, left: 16, right: 16, zIndex: 999,
      background: "var(--card)", border: "1px solid var(--border2)",
      borderRadius: 16, padding: "16px 20px",
      display: "flex", alignItems: "center", gap: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,.35)",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: "linear-gradient(135deg, var(--g1), var(--g2))",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
      }}>✦</div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
          Installer l'app Belo
        </div>
        <div style={{ fontSize: 11, color: "var(--text3)", lineHeight: 1.4 }}>
          Accès rapide · Fonctionne hors-ligne
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setVisible(false)}
          style={{
            padding: "7px 12px", borderRadius: 9,
            border: "1px solid var(--border2)", background: "transparent",
            color: "var(--text3)", fontSize: 12, cursor: "pointer",
          }}
        >
          Plus tard
        </button>
        <button
          type="button"
          onClick={handleInstall}
          style={{
            padding: "7px 14px", borderRadius: 9, border: "none",
            background: "var(--g)", color: "#fff",
            fontWeight: 700, fontSize: 12, cursor: "pointer",
          }}
        >
          Installer
        </button>
      </div>
    </div>
  );
}
```

### Intégration dans le layout public

```tsx
// src/app/(public)/layout.tsx
import InstallPWA from "@/components/InstallPWA";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <InstallPWA />
    </>
  );
}
```

### Conditions d'affichage du bouton

| Condition | Comportement |
|---|---|
| Navigateur mobile (largeur ≤ 768px) | Affiché si prompt disponible |
| App déjà installée (standalone mode) | Masqué |
| Desktop | Masqué |
| Safari iOS | Le bouton ne s'affiche pas (API non supportée) — utiliser une bannière manuelle |
| Chrome Android | Affiché automatiquement (API `beforeinstallprompt`) |

> **Note iOS Safari** : `beforeinstallprompt` n'est pas supporté. Pour iOS, afficher un message
> manuel "Appuyer sur le bouton Partager → Ajouter à l'écran d'accueil".

### Service Worker (optionnel — offline support)

Pour activer le cache offline, ajouter dans `next.config.js` avec `next-pwa` :

```bash
npm install next-pwa
```

```js
// next.config.js
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

module.exports = withPWA({ /* ...nextConfig */ });
```

---

## 12. Variables d'environnement

### Obligatoires

```bash
# Base de données (Neon PostgreSQL)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"   # migrations

# JWT
JWT_SECRET="minimum-32-caracteres-secret-aleatoire"
JWT_EXPIRES_IN="7d"
REFRESH_TOKEN_EXPIRES_IN="30d"

# App
NEXT_PUBLIC_APP_URL="https://belo-khaki.vercel.app"
CRON_SECRET="secret-pour-proteger-les-crons"
```

### Paiements (selon les providers activés)

```bash
WAVE_API_KEY="..."
WAVE_WEBHOOK_SECRET="..."
ORANGE_API_KEY="..."
ORANGE_MERCHANT_ID="..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

### WhatsApp

```bash
WHATSAPP_PHONE_ID="..."
WHATSAPP_TOKEN="..."
# OTP_BYPASS=true  # Dev uniquement — affiche OTP dans les logs
```

### Stockage médias

```bash
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY="..."
R2_SECRET_KEY="..."
R2_BUCKET="belo-media"
NEXT_PUBLIC_CDN_URL="https://cdn.belo.sn"
```

---

## 13. Installation & Développement

### Prérequis

- Node.js ≥ 20
- npm ≥ 10
- Compte Neon PostgreSQL
- (Optionnel) Compte Cloudflare R2 pour les médias

### Démarrage rapide

```bash
# 1. Cloner et installer
git clone https://github.com/Ahmesgroup/belo.git
cd belo
npm install

# 2. Configurer l'environnement
cp .env.example .env.local
# Éditer .env.local avec vos valeurs

# 3. Pousser le schéma en DB
npx prisma db push

# 4. Seeder les données de test
npm run db:seed

# 5. Lancer en développement
npm run dev
# → http://localhost:3000
```

### Scripts npm utiles

```bash
npm run dev          # Serveur de développement
npm run build        # prisma generate + migrate deploy + next build
npm run db:generate  # Régénère le client Prisma
npm run db:migrate   # Nouvelle migration (dev)
npm run db:seed      # Seeder données de test
npm run db:studio    # Interface graphique Prisma Studio
npm run db:reset     # Reset complet de la DB (ATTENTION: destructif)
```

### Scripts de maintenance

```bash
# Corriger un compte admin en production
node scripts/fix-db.mjs

# Seeder les tarifs des plans
node scripts/seed-plans.mjs

# Ajouter des photos de démonstration
node scripts/seed-photos.mjs
```

### Bypass OTP en développement

```bash
# Dans .env.local
OTP_BYPASS=true
```

Avec ce flag, le code OTP est loggé dans la console au lieu d'être envoyé par WhatsApp.

---

## 14. Déploiement Vercel

### Déploiement standard

```bash
# Build + deploy production
npm run build         # vérifier 0 erreurs TypeScript en local
git add .
git commit -m "feat: description"
git push
npx vercel --prod
```

### Variables d'environnement Vercel

Toutes les variables de la section 12 doivent être configurées dans
**Vercel Dashboard → Project → Settings → Environment Variables**.

> ⚠️ Le fichier `.env.local` n'est **pas** déployé sur Vercel.

### Cron Jobs Vercel

Configurer dans `vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/cron/generate-slots",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/notifications",
      "schedule": "*/1 * * * *"
    },
    {
      "path": "/api/cron/purge-logs",
      "schedule": "0 3 * * 0"
    }
  ]
}
```

Chaque cron protégé par l'en-tête `Authorization: Bearer CRON_SECRET`.

### URL de production

```
https://belo-khaki.vercel.app
```

---

## 15. Maintenance DB

### Connexion directe (bypass pgBouncer)

```bash
# Pour les migrations et scripts, utiliser DIRECT_URL
node scripts/fix-db.mjs
# Le script charge automatiquement .env.local et utilise DIRECT_URL
```

### Fix compte SUPER_ADMIN en production

```bash
node scripts/fix-db.mjs
```

Ce script :
1. Migre le préfixe `+352661000001` (Luxembourg) → `+221661000001` (Sénégal)
2. Upsert `661000001` en tant que `SUPER_ADMIN`
3. Purge les logs OTP et rate-limits (débloque tous les numéros)
4. Crée les comptes staff de démonstration

### Prisma Studio

```bash
npm run db:studio
# → http://localhost:5555
```

### Migrations

```bash
# Créer une nouvelle migration
npx prisma migrate dev --name "description_migration"

# Appliquer les migrations en production (fait automatiquement par `npm run build`)
npx prisma migrate deploy
```

---

## Annexe — Décisions d'architecture

| Décision | Choix | Raison |
|---|---|---|
| Auth | OTP WhatsApp + JWT maison | Pas de NextAuth — contrôle total, adapté au marché africain (pas Google/GitHub) |
| DB | Neon serverless | Scale-to-zero, coût minimal en phase 1 |
| Queue notifs | Outbox pattern (PostgreSQL) | Pas de Redis en phase 1 — NotificationLog + cron worker |
| Paiement | Multi-provider | Wave dominant au Sénégal, Orange Money, Stripe pour diaspora |
| Anti-double-booking | `SELECT FOR UPDATE` + contrainte DB | Garantie d'atomicité au niveau base de données |
| JWT stockage | httpOnly cookie + localStorage | Cookie pour proxy edge, localStorage pour headers API fetch |
| i18n | Context React + JSON statique | Léger, pas de lib externe, supporte FR/EN |
| Proxy (edge) | `proxy.ts` (Next.js 16) | Remplace `middleware.ts` — interception avant rendu |

---

*Documentation générée pour Belo v0.1.0 — Mise à jour : 2026*
