# Belo — SaaS Beauté Multi-Tenant

## Stack
- **Frontend + API** : Next.js 14 App Router
- **DB** : PostgreSQL Neon (serverless, scale-to-zero)
- **ORM** : Prisma 5.x
- **Auth** : OTP WhatsApp + JWT (jose, edge-compatible)
- **Paiements** : Wave · Orange Money · Stripe
- **Notifications** : WhatsApp Cloud API (Meta)
- **Stockage** : Cloudflare R2
- **Hosting** : Vercel (2 cron jobs gratuits)

---

## Installation — Windows CMD

### 1. Ouvrir le dossier du projet
```cmd
cd "C:\Users\papan\Downloads\belo-complete (2)\belo"
```

### 2. Installer les dépendances
```cmd
npm install
```

### 3. Créer le fichier d'environnement
```cmd
copy .env.example .env.local
```
Ouvrir `.env.local` dans Notepad++ ou VS Code et remplir les variables.

### 4. Configurer Neon PostgreSQL (gratuit)
1. Aller sur https://neon.tech → créer un compte gratuit
2. Créer un nouveau projet "belo"
3. Copier les deux URLs dans `.env.local` :
   - `DATABASE_URL` → URL avec `?pgbouncer=true`
   - `DIRECT_URL` → URL directe sans pgbouncer

### 5. Générer un JWT_SECRET
```cmd
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copier le résultat dans `JWT_SECRET=` dans `.env.local`

### 6. Générer le client Prisma
```cmd
npx prisma generate
```

### 7. Créer les tables dans la DB
```cmd
npx prisma migrate dev --name init
```

### 8. Insérer les données de test
```cmd
npx ts-node prisma/seed.ts
```

### 9. Lancer le serveur de développement
```cmd
npm run dev
```

Ouvrir http://localhost:3000

---

## URLs importantes en développement

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Landing page |
| http://localhost:3000/login | Connexion OTP WhatsApp |
| http://localhost:3000/salons | Liste des salons |
| http://localhost:3000/booking/studio-elegance-dakar | Flow réservation |
| http://localhost:3000/plans | Plans & Tarifs |
| http://localhost:3000/dashboard | Dashboard gérant |
| http://localhost:3000/dashboard/bookings | Réservations |
| http://localhost:3000/dashboard/services | Services |
| http://localhost:3000/dashboard/horaires | Horaires d'ouverture |
| http://localhost:3000/dashboard/profil | Profil salon |
| http://localhost:3000/admin | Super Admin |

---

## Variables d'environnement minimales pour démarrer

```env
# Obligatoires pour démarrer
DATABASE_URL=postgresql://...?pgbouncer=true
DIRECT_URL=postgresql://...
JWT_SECRET=votre-secret-64-chars
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
CRON_SECRET=n-importe-quoi-pour-dev

# Paiements (optionnels en dev — mode simulation)
WAVE_API_KEY=
STRIPE_SECRET_KEY=

# WhatsApp (optionnel — les OTP s'affichent dans la console en dev)
WHATSAPP_PHONE_ID=
WHATSAPP_TOKEN=
```

---

## Structure des dossiers

```
belo/
├── prisma/
│   ├── schema.prisma     ← Schéma DB (source of truth)
│   └── seed.ts           ← Données de test
│
├── src/
│   ├── app/
│   │   ├── (public)/     ← Pages clients (Landing, Salons, Booking, Login, Profil)
│   │   ├── dashboard/    ← Dashboard gérant (layout + page + bookings, services, horaires, profil)
│   │   ├── admin/        ← Super Admin
│   │   └── api/          ← Routes API (auth, bookings, slots, services, tenants, payments)
│   │
│   ├── domain/           ← Logique métier pure (0 DB imports)
│   ├── services/         ← Orchestration (booking, auth)
│   ├── infrastructure/   ← DB, Queue, Providers (Wave, Stripe)
│   ├── components/ui/    ← Composants UI (Button, Badge, Nav)
│   ├── hooks/            ← React hooks
│   ├── lib/              ← Utilitaires (rate-limit, money, zod)
│   ├── config/           ← env.ts (validation Zod) + plans.config.ts
│   ├── shared/errors.ts  ← AppError + handleRouteError
│   └── middleware.ts     ← Garde JWT sur toutes les routes
│
├── package.json
├── next.config.ts
├── vercel.json           ← 2 cron jobs (notifications + purge logs)
└── .env.example          ← Toutes les variables à configurer
```

---

## Plans tarifaires

| Plan | FCFA/mois | EUR/mois | Bookings/mois |
|------|-----------|----------|---------------|
| Free | 0 | 0 | 20 |
| Pro | 15 000 | 23 € | 500 |
| Premium | 35 000 | 53 € | Illimités |

---

## Déploiement sur Vercel

```cmd
npm install -g vercel
vercel login
vercel
```

Configurer les variables d'environnement dans le dashboard Vercel (Settings → Environment Variables).

Le build inclut automatiquement la migration DB :
```json
"build": "prisma migrate deploy && next build"
```

---

## Corrections apportées vs version précédente

1. **seed.ts** — Corrigé pour correspondre au vrai schema Prisma :
   - `Review` nécessite `bookingId` (1 booking = 1 avis max)
   - `FraudStatus.UNDER_REVIEW` (pas `REVIEWING`)
   - `Service.category` est un `String` (pas un enum `ServiceCategory`)

2. **next.config.ts** — Suppression de `@ducanh2912/next-pwa` qui n'est pas installé

3. **README.md** — Commandes Windows CMD (plus `cp`, `unzip`, `#` comme commentaires)
