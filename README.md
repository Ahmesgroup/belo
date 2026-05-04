# Belo — Documentation technique v0.2.0

> SaaS beauté multi-tenant · Mise à jour : Mai 2026  
> **21 modèles Prisma · 305 pages SSG/ISR · Next.js 16 App Router**

---

## Table des matières

1. [Stack technique](#1-stack-technique)
2. [Architecture générale](#2-architecture-générale)
3. [Modèles Prisma (21)](#3-modèles-prisma-21)
4. [Pages & routes (305)](#4-pages--routes-305)
5. [Système d'authentification](#5-système-dauthentification)
6. [Système de téléphone (240+ pays)](#6-système-de-téléphone-240-pays)
7. [Ranking & géolocalisation](#7-ranking--géolocalisation)
8. [Système d'événements](#8-système-dévénements)
9. [Détection de fraude](#9-détection-de-fraude)
10. [i18n (fr / en)](#10-i18n-fr--en)
11. [SEO — 224 pages SSG](#11-seo--224-pages-ssg)
12. [Admin Panel (7 vues)](#12-admin-panel-7-vues)
13. [Onboarding gérant](#13-onboarding-gérant)
14. [Paiements Stripe Connect](#14-paiements-stripe-connect)
15. [Installation locale](#15-installation-locale)
16. [Variables d'environnement](#16-variables-denvironnement)
17. [Structure des dossiers](#17-structure-des-dossiers)
18. [Plans tarifaires](#18-plans-tarifaires)
19. [Déploiement Vercel](#19-déploiement-vercel)
20. [Bugs corrigés (historique)](#20-bugs-corrigés-historique)

---

## 1. Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | **Next.js 16** App Router (Turbopack) |
| Base de données | **PostgreSQL Neon** (serverless, scale-to-zero) |
| ORM | **Prisma 5.22** |
| Auth | OTP WhatsApp + **JWT HS256** (jose, edge-compatible) |
| Paiements | **Stripe Connect** (marketplace) · Wave · Orange Money |
| Notifications | WhatsApp Cloud API (Meta) |
| Stockage | Cloudflare R2 |
| Hosting | **Vercel** (cron jobs intégrés) |
| CSS | **Tailwind CSS v4** + CSS variables (dark/light) |
| TypeScript | Strict mode — aucun `any` non justifié |

---

## 2. Architecture générale

```
                        ┌─────────────────────────────────┐
                        │         proxy.ts (Edge)         │
                        │  auth guard · i18n redirect     │
                        │  role check · JWT verify        │
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

Le fichier `src/proxy.ts` est détecté automatiquement par Next.js 16 comme proxy middleware. Il gère :

- **Redirection langue** : `/` → `/fr` ou `/en` (cookie `belo_lang` → Accept-Language → défaut `fr`)
- **Guard admin** : `/admin/*` → rôles ADMIN, SUPER_ADMIN uniquement
- **Guard dashboard** : `/dashboard/*` → rôles OWNER, STAFF, ADMIN, SUPER_ADMIN
- **Guard profil** : `/profil` → utilisateur connecté requis

> ⚠️ Ne pas créer de `middleware.ts` : Next.js 16 détecte `proxy.ts` nativement et les deux fichiers entrent en conflit.

---

## 3. Modèles Prisma (21)

| Modèle | Description |
|--------|-------------|
| `User` | Utilisateur (CLIENT · STAFF · OWNER · ADMIN · SUPER_ADMIN) |
| `Tenant` | Salon — slug unique, lat/lng, plan, statut |
| `Service` | Prestation d'un salon (catégorie, prix, durée, photos) |
| `Slot` | Créneau horaire généré par cron |
| `Booking` | Réservation (statut, acompte, paiement) |
| `Review` | Avis lié à une réservation (1:1) |
| `NotificationLog` | Log WhatsApp/SMS envoyés |
| `FraudAlert` | Alertes fraude (6 signaux, score 0-100) |
| `AuditLog` | Journal d'audit exhaustif |
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
@@index([status])           // Tenant — filtrer actifs
@@index([plan, status])     // Tenant — listing par plan
@@index([lat, lng])         // Tenant — requêtes géospatiales Haversine
@@index([tenantId, startsAt]) // Slot — disponibilités
@@index([userId, status])   // Booking — historique client
@@index([status, processedAt]) // EventLog — queue SKIP LOCKED
```

---

## 4. Pages & routes (305)

### Pages statiques (SSG)

| Route | Type | Revalidate |
|-------|------|------------|
| `/fr`, `/en` | SSG | 2 min |
| `/fr/for-salons`, `/en/for-salons` | SSG | 1h |
| `/fr/plans`, `/en/plans` | SSG | 5 min |
| `/fr/salons/[city]/[category]` × 224 | SSG | 10 min |

### Pages dynamiques (SSR)

| Route | Description |
|-------|-------------|
| `/[lang]/salons` | Listing avec filtres geo |
| `/[lang]/salons/[city]` | Salons par ville |
| `/booking/[slug]` | Flow réservation salon |
| `/api/tenants/search` | Recherche géolocalisée + ranking |

### API Routes

```
GET  /api/tenants          → listing (public, cache 2min)
POST /api/tenants          → créer salon + upgrade OWNER
GET  /api/tenants/[slug]   → profil salon (cache 5min)
PATCH /api/tenants/[id]    → modifier profil (gérant/admin)

POST /api/auth?action=send-otp    → envoi OTP WhatsApp
POST /api/auth?action=verify-otp  → vérification + JWT

GET  /api/bookings         → liste réservations
POST /api/bookings         → créer réservation

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
getToken()         // JWT depuis localStorage
getUser()          // BeloUser depuis localStorage
setAuth(token, user) // persiste token + user
clearAuth()        // logout
isOwner()          // OWNER ou STAFF
isAdmin()          // SUPER_ADMIN ou ADMIN
authHeaders()      // { Authorization: "Bearer ..." }
```

### Guard côté serveur (`src/lib/route-auth.ts`)

```typescript
withAuth(req)                     // parse JWT (cookie ou header)
withRole(auth, ["OWNER", ...])    // vérifie le rôle
withTenant(auth, tenantId)        // vérifie l'accès cross-tenant
withActiveTenant(auth, tenantId)  // vérifie ACTIVE + ownership
signJWT({ sub, role, tenantId })  // signe un nouveau JWT
```

### Upgrade CLIENT → OWNER

Lors de la création d'un salon (`POST /api/tenants`), la transaction Prisma :
1. Crée le `Tenant`
2. Met à jour `User.role = "OWNER"` et `User.tenantId`
3. Retourne un **nouveau JWT** avec `role: "OWNER"` dans la réponse
4. Le client appelle `setAuth(newToken, updatedUser)` → localStorage mis à jour immédiatement
5. Redirect vers `/dashboard` sans re-login

---

## 6. Système de téléphone (240+ pays)

### `src/lib/phone.ts`

**240+ pays** organisés : Afrique en premier (marché primaire), puis Europe, Amériques, Moyen-Orient, Asie, Océanie.

```typescript
interface Country {
  iso:      string;   // "SN", "LU", "FR"...
  dial:     string;   // "221", "352", "33" (sans +)
  flag:     string;   // emoji drapeau
  name:     string;   // nom anglais
  nameFr:   string;   // nom français
  pattern?: RegExp;   // validation locale optionnelle
  example?: string;   // placeholder
}
```

**Fonctions clés :**

```typescript
toE164(dial, local)
// Protège contre le double indicatif :
// toE164("221", "+221 77 123 456") → "+22177123456" ✓
// toE164("221", "77 123 456")      → "+22177123456" ✓

normalizePhone(raw, dialDefault)
// Normalise n'importe quel format en E.164

isValidLocalNumber(local, country)
// Valide par regex si country.pattern existe, sinon par longueur

splitE164(e164)
// → { country: Country, local: string }

detectDefaultCountry()
// navigator.language → ISO region → fallback Sénégal

findCountryByISO("LU")  // → Luxembourg
findCountryByDial("352") // → Luxembourg
```

**Exemples pays clés :**

```typescript
{ iso:"SN", dial:"221", flag:"🇸🇳", pattern:/^[5-9]\d{7,8}$/ }
{ iso:"LU", dial:"352", flag:"🇱🇺", pattern:/^\d{6,9}$/ }
{ iso:"FR", dial:"33",  flag:"🇫🇷", pattern:/^[67]\d{8}$/ }
{ iso:"BE", dial:"32",  flag:"🇧🇪", pattern:/^[4-9]\d{7,8}$/ }
```

### `src/components/ui/PhoneInput.tsx`

- Dropdown avec recherche (nom FR, nom EN, code ISO, indicatif)
- Recherche `+352` → strip `+` → compare `"352"` → trouve Luxembourg
- Validation live ✓ / ✗ avec indicateur visuel
- Placeholder dynamique (`country.example`)
- ARIA-compliant (aria-invalid, aria-selected, role="listbox", role="option")
- Aucune possibilité de double indicatif (input filtre les digits bruts)

---

## 7. Ranking & géolocalisation

### Geocoding (`src/services/geocode.ts`)

À chaque création de salon :

```
1. Requête Nominatim (OpenStreetMap) — timeout 4s
2. Fallback coordonnées ville (table CITY_COORDS locale)
3. Fallback partial match (slug)
4. Défaut absolu : Dakar (14.7167, -17.4677)
```

`lat` et `lng` sont **toujours renseignés** — jamais `null`. Cela garantit que les requêtes SQL Haversine ne retournent pas d'erreur.

### Formule de ranking (6 facteurs)

```
score = relevance×0.25 + distance×0.20 + performance×0.20
      + personalization×0.20 + business×0.10 + freshness×0.05
```

| Facteur | Calcul |
|---------|--------|
| `relevance` | Fulltext match nom/adresse |
| `distance` | Haversine SQL depuis lat/lng utilisateur |
| `performance` | ratingAvg · bookingCount · conversionRate |
| `personalization` | Historique + favoris de l'utilisateur |
| `business` | Plan (PREMIUM > PRO > FREE) · AdCampaign boost |
| `freshness` | Activité des 30 derniers jours |

```typescript
// src/services/ranking.service.ts
searchRanked(params: {
  lat?: number; lng?: number;
  city?: string; query?: string;
  category?: string; userId?: string;
  page?: number; pageSize?: number;
}) → Promise<RankedTenant[]>
```

---

## 8. Système d'événements

Architecture event-driven synchrone (sans Redis).

### `src/lib/events.ts`

```typescript
emitEvent(type, payload)   // fire-and-forget, persiste dans EventLog
onEvent(type, handler)     // enregistre un handler
```

### Types d'événements

```typescript
"booking.created"    → AdminNotification + WhatsApp confirmation
"booking.confirmed"  → WhatsApp au client + mise à jour trending
"booking.cancelled"  → WhatsApp client + libère le slot
"tenant.created"     → AdminNotification validation requise
"tenant.viewed"      → incrément TenantTrending.views
"favorite.created"   → incrément TenantTrending.score
"settings.updated"   → invalidation cache settings
"fraud.detected"     → AdminNotification urgente
```

### Queue de retry (`src/lib/event-queue.ts`)

`GET /api/cron/events` — exécuté toutes les minutes sur Vercel :

```sql
SELECT * FROM EventLog
WHERE status = 'PENDING' AND processedAt IS NULL
ORDER BY createdAt ASC
LIMIT 50
FOR UPDATE SKIP LOCKED
```

Retry exponentiel : 3 tentatives max, délai ×2 à chaque échec.

---

## 9. Détection de fraude

### `src/services/fraud.service.ts`

6 signaux analysés à chaque réservation :

| Signal | Seuil | Score |
|--------|-------|-------|
| Réservations rapides (< 10min) | > 5 | +20 |
| Multi-numéros même IP | > 3 | +25 |
| Taux no-show | > 40% | +20 |
| Réservations cross-tenant | > 10 | +30 |
| Fréquence IP anormale | > 20/h | +15 |
| Comportement suspect (montant) | > 100k FCFA | +10 |

- Score ≥ 80 → **blocage automatique** + AdminNotification
- Score 50-79 → alerte `UNDER_REVIEW`
- Score < 50 → log uniquement

---

## 10. i18n (fr / en)

### Routing URL

```
/fr           → landing page français
/en           → landing page anglais
/fr/salons    → listing FR
/fr/for-salons → page B2B FR
/fr/plans     → tarifs FR
```

### `src/lib/i18n.ts`

Fichier unique de traductions (fr + en) pour 5 namespaces :
`common`, `booking`, `dashboard`, `for_salons`, `plans`

### Côté serveur (`src/lib/i18n-server.ts`)

```typescript
const t = getTranslations("fr");
t("hero_title")           // flat key
t("booking.how_title")    // namespaced key
```

### Côté client (`src/lib/lang-context.tsx`)

```tsx
<LangProvider initialLang="fr">
  <App />
</LangProvider>

// Dans les composants :
const { t, lang } = useLang();
```

### Détection de langue (`src/proxy.ts`)

```
1. Cookie belo_lang (préférence persistée)
2. En-tête Accept-Language
3. Défaut : "fr" (marché primaire Sénégal)
```

---

## 11. SEO — 224 pages SSG

Générées avec `generateStaticParams()` :

```
/[lang]/salons/[city]/[category]
= 2 langues × 14 villes × 8 catégories = 224 pages
```

**Villes** : Dakar, Thiès, Ziguinchor, Saint-Louis, Kaolack, Touba, Mbour, Rufisque, Kolda, Tambacounda, Abidjan, Douala, Paris, Lyon

**Catégories** : hair, nails, massage, spa, beauty, barber, makeup, waxing

Chaque page a :
- `<title>` et `<meta description>` générés dynamiquement
- `canonical` + `hreflang` (fr ↔ en)
- Données Prisma en direct (SSG avec `revalidate: 600`)
- **OpenGraph** et **Twitter Card**

---

## 12. Admin Panel (7 vues)

Route : `/admin` — accès ADMIN et SUPER_ADMIN uniquement.

| Vue | Données affichées |
|-----|-------------------|
| Mission Control | Stats temps réel : salons, bookings, revenus, fraudes |
| Tenants | Liste tous les salons, filtre par statut/plan, actions approve/block |
| Plans | Gestion des plans tarifaires, sync quotas |
| Fraude | Alertes fraude avec score et signaux détaillés |
| Équipe | Membres de l'équipe plateforme |
| Logs | Journal d'audit complet (filtrable) |
| Réglages | Config plateforme (maintenance mode, fees, limits) |

Toutes les données sont **réelles** (Prisma direct, pas de mock).

---

## 13. Onboarding gérant

### Flow complet

```
CLIENT se connecte (/login)
    ↓
Profil (/profil) → CTA "Ouvrir mon salon" (visible si role=CLIENT)
    ↓
Onboarding (/onboarding) — 4 étapes :
  1. Nom du salon + description
  2. Adresse + ville + pays
  3. Téléphone + WhatsApp + email
  4. Catégorie principale
    ↓
POST /api/tenants
  → normalise phone en E.164
  → géocode l'adresse (Nominatim + fallback)
  → transaction : crée Tenant + upgrade User OWNER
  → retourne JWT frais avec role=OWNER + tenantId
    ↓
Client : setAuth(newToken, { ...user, role: "OWNER", tenantId })
    ↓
router.replace("/dashboard") → accès immédiat
```

### Guards dans `/profil`

- `role === "OWNER"` ou `"STAFF"` → redirect `/dashboard` au mount
- `role === "CLIENT"` → affiche CTA "Ouvrir mon salon → /onboarding"

---

## 14. Paiements Stripe Connect

### Architecture marketplace

```
Client → paiement acompte → Belo collecte
Belo → virement automatique → Compte gérant (Stripe Express)
```

### Flow

```typescript
// 1. Onboarding gérant
POST /api/stripe/connect
→ crée compte Stripe Express
→ retourne onboarding URL

// 2. Paiement client
POST /api/stripe/payment { bookingId, amount }
→ crée PaymentIntent sur compte plateforme
→ commission Belo (configurable via Settings)

// 3. Webhook Stripe
POST /api/webhooks
→ payment_intent.succeeded → confirme booking
→ account.updated → active stripeOnboardingComplete
```

---

## 15. Installation locale

### Windows

```cmd
cd "C:\Users\papan\Downloads\belo-complete (2)\belo"
npm install
copy .env.example .env.local
```

Remplir `.env.local` (voir section 16), puis :

```cmd
npx prisma generate
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
npm run dev
```

Ouvrir http://localhost:3000

### URLs de développement

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Redirect → `/fr` |
| `http://localhost:3000/fr` | Landing page |
| `http://localhost:3000/login` | Connexion OTP |
| `http://localhost:3000/onboarding` | Créer un salon |
| `http://localhost:3000/profil` | Profil client |
| `http://localhost:3000/dashboard` | Dashboard gérant |
| `http://localhost:3000/dashboard/bookings` | Réservations |
| `http://localhost:3000/dashboard/services` | Services |
| `http://localhost:3000/dashboard/horaires` | Horaires |
| `http://localhost:3000/dashboard/profil` | Profil salon |
| `http://localhost:3000/admin` | Super Admin |
| `http://localhost:3000/fr/salons/dakar/hair` | Page SEO exemple |
| `http://localhost:3000/booking/studio-elegance-dakar` | Flow réservation |
| `http://localhost:3000/fr/plans` | Tarifs |
| `http://localhost:3000/fr/for-salons` | Page B2B |

---

## 16. Variables d'environnement

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
# OTP_DEV_BYPASS=123456   # décommente pour bypass WhatsApp en dev
```

> ⚠️ `NEXT_PUBLIC_APP_URL` ne doit pas avoir de commentaire inline sur la même ligne — cela cause `ERR_INVALID_CHAR`.

---

## 17. Structure des dossiers

```
belo/
├── prisma/
│   ├── schema.prisma          ← 21 modèles (source of truth)
│   ├── seed.ts                ← Données de test réalistes
│   └── migrations/            ← 9 migrations versionnées
│
├── src/
│   ├── proxy.ts               ← Middleware Next.js 16 (auth + i18n)
│   │
│   ├── app/
│   │   ├── layout.tsx         ← Root layout (ThemeInit, globals.css)
│   │   ├── globals.css        ← Design tokens CSS (dark/light)
│   │   │
│   │   ├── (public)/          ← Pages sans layout dashboard
│   │   │   ├── page.tsx       ← redirect("/fr")
│   │   │   ├── login/         ← Connexion OTP
│   │   │   ├── profil/        ← Profil client (tabs)
│   │   │   ├── booking/[slug] ← Flow réservation
│   │   │   ├── salons/        ← Listing public
│   │   │   ├── plans/         ← Tarifs (redirect /fr/plans)
│   │   │   └── pour-les-salons/ ← B2B (redirect /fr/for-salons)
│   │   │
│   │   ├── [lang]/            ← Pages i18n SSG/ISR
│   │   │   ├── layout.tsx     ← Meta hreflang + LangSync
│   │   │   ├── page.tsx       ← Landing Wolt-level
│   │   │   ├── salons/        ← Listing + [city] + [city]/[category]
│   │   │   ├── for-salons/    ← Page B2B (8 sections conversion)
│   │   │   └── plans/         ← Pricing (toggle mensuel/annuel)
│   │   │
│   │   ├── onboarding/        ← Création salon 4 étapes
│   │   ├── dashboard/         ← Espace gérant (OWNER/STAFF)
│   │   │   ├── layout.tsx     ← Auth guard + compteur notifs
│   │   │   ├── page.tsx       ← Vue d'ensemble
│   │   │   ├── bookings/      ← Accept/Refuse réservations
│   │   │   ├── services/      ← CRUD prestations
│   │   │   ├── horaires/      ← Horaires d'ouverture
│   │   │   ├── equipe/        ← Membres STAFF
│   │   │   └── profil/        ← Profil salon
│   │   │
│   │   ├── admin/             ← Panel admin (7 vues)
│   │   └── api/               ← Route handlers
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Nav.tsx        ← Navigation (PublicNav + DashNav)
│   │   │   ├── PhoneInput.tsx ← Input téléphone 240+ pays
│   │   │   ├── SalonCard.tsx  ← Card premium avec badges
│   │   │   └── SectionRow.tsx ← Scroll horizontal snap
│   │   ├── SearchBar.tsx      ← Autocomplete ville + catégorie
│   │   ├── CookieBanner.tsx   ← RGPD (3 catégories)
│   │   ├── ThemeInit.tsx      ← Dark/light mode (SSR-safe)
│   │   └── LangSync.tsx       ← Sync URL lang ↔ LangContext
│   │
│   ├── lib/
│   │   ├── phone.ts           ← 240+ pays, E.164, validation
│   │   ├── auth-client.ts     ← getToken, getUser, setAuth, clearAuth
│   │   ├── route-auth.ts      ← withAuth, withRole, signJWT
│   │   ├── i18n.ts            ← Traductions fr/en (5 namespaces)
│   │   ├── i18n-server.ts     ← getTranslations() pour Server Components
│   │   ├── i18n-localize.ts   ← getLocalized() pour champs bilingues JSON
│   │   ├── events.ts          ← emitEvent / onEvent + EventLog
│   │   ├── event-handlers.ts  ← Enregistrement des handlers
│   │   ├── event-queue.ts     ← processEventQueue() SKIP LOCKED
│   │   ├── cors.ts            ← getCorsHeaders() (allowlist, pas de wildcard)
│   │   ├── rate-limit.ts      ← Rate limiter en mémoire (edge-safe)
│   │   ├── settings.ts        ← getAllSettings() avec cache 30s
│   │   └── zod-formatter.ts   ← zodErrorResponse()
│   │
│   ├── services/
│   │   ├── booking.service.ts ← createBooking, confirmBooking, cancel
│   │   ├── ranking.service.ts ← searchRanked() formule 6 facteurs
│   │   ├── trending.service.ts← onBooking/View/Favorite pour trending
│   │   ├── fraud.service.ts   ← 6 signaux, auto-block score ≥ 80
│   │   ├── plan.service.ts    ← syncPlanToTenants, resetTenantQuota
│   │   └── geocode.ts         ← Nominatim + fallback ville/pays
│   │
│   ├── shared/
│   │   └── errors.ts          ← AppError, AppErrors, handleRouteError
│   │
│   └── infrastructure/
│       └── db/prisma.ts       ← PrismaClient singleton
│
├── next.config.js             ← Headers sécurité, images CDN
├── tailwind.config.ts         ← Classes CSS variables
├── vercel.json                ← Cron jobs (cron-secret)
└── .env.example               ← Toutes les variables
```

---

## 18. Plans tarifaires

| Plan | FCFA/mois | EUR/mois | Bookings/mois | Services |
|------|-----------|----------|---------------|---------|
| **Free** | 0 | 0 | 20 | 1 |
| **Pro** | 15 000 | ~23 € | 500 | 20 |
| **Premium** | 35 000 | ~53 € | Illimités | Illimités |

### Avantages Pro+

- WhatsApp automatique (−58% no-shows constatés)
- Acompte configurable (10–100%)
- Réseaux sociaux sur profil
- Analytics

### Avantages Premium

- Tout Pro +
- WhatsApp + SMS + Email
- Analytics avancés + IA
- Multi-staff
- API Webhook
- Position boostée dans le ranking

---

## 19. Déploiement Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Build command (package.json)

```json
"build": "prisma generate && prisma migrate deploy && next build"
```

La migration Prisma s'exécute automatiquement à chaque déploiement.

### Variables Vercel à configurer

Dans **Settings → Environment Variables** (Production + Preview) :

```
DATABASE_URL, DIRECT_URL, JWT_SECRET, NEXT_PUBLIC_APP_URL,
CRON_SECRET, WHATSAPP_PHONE_ID, WHATSAPP_TOKEN,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

### Cron jobs (vercel.json)

```json
{
  "crons": [
    { "path": "/api/cron/generate-slots",  "schedule": "0 2 * * *"  },
    { "path": "/api/cron/notifications",   "schedule": "0 * * * *"  },
    { "path": "/api/cron/metrics",         "schedule": "*/30 * * * *"},
    { "path": "/api/cron/events",          "schedule": "* * * * *"  },
    { "path": "/api/cron/purge-logs",      "schedule": "0 3 * * 0"  }
  ]
}
```

---

## 20. Bugs corrigés (historique)

### Mai 2026 — v0.2.0

| Bug | Cause | Fix |
|-----|-------|-----|
| `POST /api/tenants → 500` | `description` et `category` (champs Zod) spreadés dans `prisma.tenant.create()` — ces colonnes **n'existent pas** sur le modèle Tenant → `PrismaClientValidationError` non catchée → 500 silencieux | Mapping explicite des colonnes Tenant uniquement |
| Double indicatif `+221+221...` | `toE164("221", "+221 77...")` → digits `"22177..."` → résultat `"+22122177..."` | `toE164()` vérifie si `digits.startsWith(dial)` avant de le préfixer |
| Recherche `+352` ne trouve pas Luxembourg | `c.dial.includes("+352")` → `"352".includes("+352")` = `false` | Strip `+` avant la comparaison : `c.dial.includes(search.replace(/^\+/, ""))` |
| `lat`/`lng` null → ranking cassé | Tenant créé sans appel à `geocodeAddress()` | Ajout de `geocodeAddress(address, city)` dans `POST /api/tenants` |
| `aria-invalid="{expression}"` | Booléen JSX non accepté par le validateur ARIA | `aria-invalid={showErr ? "true" : "false"}` |
| Role reste CLIENT après onboarding | Conséquence directe du 500 API (JWT jamais retourné) | Résolu par le fix API + `setAuth(newToken, updatedUser)` client-side |
| Conflit `middleware.ts` + `proxy.ts` | Next.js 16 détecte `proxy.ts` comme middleware natif ; créer `middleware.ts` en plus cause un build error | Supprimer `middleware.ts`, utiliser uniquement `proxy.ts` |

### Avril 2026 — v0.1.5

| Bug | Cause | Fix |
|-----|-------|-----|
| CORS `ERR_INVALID_CHAR` | Commentaire inline dans `.env.local` sur `NEXT_PUBLIC_APP_URL` | Supprimer commentaires sur les lignes de valeur |
| PhoneInput API cassée | Login + booking utilisaient ancienne API (`setCountryCode: Dispatch`) | Wrapper `onCountryChange={c => setCountryCode(c.dial)}` |
| Build TS : `Record<string, string>` not assignable | `getLocalized()` trop strict | Relaxer `LocalizedField` pour accepter `Record<string, string>` |
| SSG 0 résultats featured salons | `getFeaturedSalons()` faisait `fetch(NEXT_PUBLIC_APP_URL/api/...)` undefined côté serveur | Remplacer par requête Prisma directe dans Server Components |
| `NEXT_PUBLIC_APP_URL` undefined Vercel | Variable non settée côté Edge | Self-HTTP → Prisma direct dans Server Components |
| Paramètres async Next.js 16 | `params.slug` nécessite `use(params)` en App Router 16 | Ajout `use()` partout où `params` est asynchrone |

### Mars 2026 — v0.1.0

| Bug | Cause | Fix |
|-----|-------|-----|
| Conflit `middleware.ts` + `proxy.ts` | Next.js 16 détecte les deux | Suppression de `middleware.ts`, helpers déplacés dans `route-auth.ts` |
| Plans nested keys TypeScript | `t("plans.free.name")` — clé nested pas dans le union type | Aplatir en `t("plans.free_name")` |
| Ranking SQL type mismatch | `$queryRaw` template avec types Prisma stricts | Annotations TypeScript explicites |
| Seed.ts — `FraudStatus.REVIEWING` | Enum incorrect dans le schéma | Corriger en `UNDER_REVIEW` |
| `Service.category` enum vs String | Schéma Prisma : `category String` (pas enum) | Adapter seed.ts et queries |

---

*Dernière mise à jour : Mai 2026 — commit `26f218a`*
