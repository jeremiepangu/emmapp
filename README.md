# EMMAPP v3.1.0

ERP/CRM pour la production et la distribution d'eau potable (portail client, POS, SIRH, tournées, finance).

**Version GitHub actuelle :** tag `v3.1.0` — commit `9bdb589` — branche **`main`**

```bash
git clone https://github.com/jeremiepangu/emmapp.git
cd emmapp
git checkout main
git pull origin main
git log -1 --oneline
```

Le dernier commit doit afficher `9bdb589 feat(portal): panier, suivi et refus hors stock`.

> Si Cursor ouvre une branche `cursor/...` ou `feat/...`, ce n’est **pas** la version à jour. Revenir sur `main`.

## Architecture

```
EMMAPP/
├── backend/          # API REST NestJS + PostgreSQL + Prisma
├── backoffice/       # Application Web React (site + admin ERP + portail + PWA)
├── mobile/           # Application Flutter native Android
└── scripts/          # Démarrage local sans Docker
```

## Prérequis

- [Node.js](https://nodejs.org/) 20+
- [Flutter SDK](https://flutter.dev/) 3.2+ (uniquement pour l'app mobile)

> **Sans installation locale ?** Voir **[DEPLOIEMENT_CLOUD.md](./DEPLOIEMENT_CLOUD.md)**.
> **Google Play ?** Voir **[GOOGLE_PLAY.md](./GOOGLE_PLAY.md)**.

## Démarrage rapide (sans Docker)

```powershell
.\scripts\start-all.ps1
```

Ouvre **http://localhost:5173/**

Détails : **[DEMARRAGE.md](./DEMARRAGE.md)**

### Alternative Docker

```bash
docker compose up -d
cd backend && cp .env.example .env && npm install && npx prisma migrate dev --name init && npm run prisma:seed && npm run start:dev
cd ../backoffice && npm install && npm run dev
```

## Comptes de démonstration

| Email | Rôle | Mot de passe |
|-------|------|--------------|
| admin@emmapp.cd | Administrateur | password123 |
| livreur@emmapp.cd | Livreur | password123 |
| magasinier@emmapp.cd | Magasinier | password123 |

## Fonctionnalités

- **Portail client** : catalogue, panier, suivi de livraison, paiement
- **POS / caisse** : ventes, avances, acomptes
- **Clients** : fiches, zones, consignes, recouvrement
- **Stocks** : produits finis, refus de commande hors stock
- **Commandes et livraisons** : validation, tournées, bordereau de chargement
- **SIRH** : pointage, heures de prestation, contrats
- **Finance** : paiements, écarts, fidélité
- **Mobile** : mode offline SQLite + synchronisation

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
