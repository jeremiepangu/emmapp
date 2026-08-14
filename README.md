# EMMAPP Mobile

ERP/CRM pour la production et la distribution d'eau potable — Phase 1 MVP (Distribution).

## Architecture

```
EMMAPP/
├── backend/          # API REST NestJS + PostgreSQL + Prisma
├── backoffice/       # Application Web React (admin + livreur PWA)
├── mobile/           # Application Flutter native Android (optionnel)
└── docker-compose.yml
```

## Prérequis

- [Node.js](https://nodejs.org/) 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Flutter SDK](https://flutter.dev/) 3.2+ (pour l'app mobile)

> **Sans installation locale ?** Voir **[DEPLOIEMENT_CLOUD.md](./DEPLOIEMENT_CLOUD.md)** — Neon + Render + Vercel, ou GitHub Codespaces dans le navigateur.

> **Google Play ?** Voir **[GOOGLE_PLAY.md](./GOOGLE_PLAY.md)** — build AAB automatique via GitHub Actions, sans Flutter local.

## Démarrage rapide

### 1. Base de données

```bash
docker compose up -d
```

### 2. API Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

L'API démarre sur **http://localhost:3000**  
Documentation Swagger : **http://localhost:3000/api/docs**

### 3. Back-Office Web

```bash
cd backoffice
npm install
npm run dev
```

Interface admin : **http://localhost:5173**

### 4. Application Mobile

```bash
cd mobile
flutter pub get
flutter run
```

> Pour l'émulateur Android, l'API est accessible via `http://10.0.2.2:3000`.  
> Pour un appareil physique, lancer avec :  
> `flutter run --dart-define=API_URL=http://VOTRE_IP:3000/api/v1`

## Comptes de démonstration

| Email | Rôle | Mot de passe |
|-------|------|--------------|
| admin@emmapp.cd | Administrateur | password123 |
| livreur@emmapp.cd | Livreur | password123 |
| magasinier@emmapp.cd | Magasinier | password123 |

## Fonctionnalités Phase 1 (MVP)

- **Clients** : fiches, zones, segments, gestion des consignes
- **Produits** : sachets, bouteilles, bidons 5L, bonbonnes 19L
- **Stocks** : produits finis, stock embarqué véhicule
- **Commandes** : prise de commande et validation
- **Tournées** : planification, bordereau de chargement
- **Livraisons** : saisie terrain, retours consignes, géolocalisation
- **Paiements** : espèces, Mobile Money, chèque, crédit
- **Consignes** : calcul automatique du solde bidons/bonbonnes
- **Mode offline** : file locale SQLite + synchronisation différée
- **Dashboard** : KPI du jour (commandes, livraisons, encaissements)

## Phases futures

| Phase | Contenu |
|-------|---------|
| Phase 2 | Production, lots, SOP nettoyage 5L/19L, contrôle qualité |
| Phase 3 | Caisse, RH, commissions, fidélité, flotte, reporting avancé |

## API principale

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/login` | Authentification |
| `GET /api/v1/clients` | Liste clients |
| `GET /api/v1/products` | Catalogue produits |
| `GET /api/v1/tours` | Tournées |
| `POST /api/v1/deliveries` | Enregistrer livraison |
| `POST /api/v1/payments` | Enregistrer paiement |
| `POST /api/v1/sync/push` | Synchronisation offline → serveur |
| `GET /api/v1/sync/pull` | Mises à jour serveur → mobile |
| `GET /api/v1/dashboard/overview` | Tableau de bord |

## Sécurité

- Authentification JWT avec rôles (ADMIN, LIVREUR, MAGASINIER, etc.)
- Journal d'audit des opérations sensibles
- Déduplication des sync offline via `localId`
- Chiffrement recommandé en production (HTTPS, variables d'environnement)

## Licence

Projet privé — EMMAPP © 2026
