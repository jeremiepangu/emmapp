# EMMAPP — Déploiement 100 % cloud (sans installation locale)

Aucun Node.js, Docker ou Flutter sur votre PC. Tout se fait dans le navigateur ou via des services gratuits.

---

## Option A — Utiliser l'app en ligne (recommandé)

Services gratuits : **Neon** (base de données) + **Render** (API) + **Vercel** (interface web).

### Étape 1 : Base de données PostgreSQL (Neon)

1. Créez un compte sur [neon.tech](https://neon.tech)
2. Créez un projet → copiez l'URL de connexion (`postgresql://...?sslmode=require`)
3. Conservez cette URL pour l'étape 2

### Étape 2 : API Backend (Render)

1. Poussez le projet sur **GitHub** (repo public ou privé)
2. Créez un compte sur [render.com](https://render.com)
3. **New → Blueprint** → connectez le repo GitHub
4. Render détecte `render.yaml` et crée le service `emmapp-api`
5. Variables d'environnement à renseigner :
   - `DATABASE_URL` = URL Neon (étape 1)
   - `JWT_SECRET` = une clé longue aléatoire
6. Déployez → notez l'URL : `https://emmapp-api.onrender.com`

### Étape 3 : Initialiser les données de démo

Dans Render → votre service → **Shell** :

```bash
cd backend
npm run prisma:seed
```

### Étape 4 : Interface web (Vercel)

1. Compte sur [vercel.com](https://vercel.com)
2. **Import Project** → repo GitHub → dossier `backoffice`
3. Variable d'environnement :
   - `VITE_API_URL` = `https://emmapp-api.onrender.com/api/v1`
4. Déployez

### Étape 5 : Accéder à l'application

| Interface | URL | Compte |
|-----------|-----|--------|
| **Back-office admin** | `https://votre-app.vercel.app` | admin@emmapp.cd / password123 |
| **Mobile livreur (web)** | `https://votre-app.vercel.app/mobile` | livreur@emmapp.cd / password123 |
| **API + Swagger** | `https://emmapp-api.onrender.com/api/docs` | — |

> **Flutter natif non requis** : l'interface `/mobile` remplace l'app Android/iOS pour les livreurs.

---

## Option B — Développer dans le navigateur (GitHub Codespaces)

Sans rien installer sur votre PC, y compris derrière un proxy d'entreprise.

### Prérequis

- Compte **GitHub** (gratuit)
- Projet poussé sur GitHub

### Lancement

1. Ouvrez le repo sur GitHub
2. Bouton **Code** → **Codespaces** → **Create codespace**
3. Attendez 2–3 min (installation auto via `.devcontainer/`)
4. Deux terminaux :

```bash
# Terminal 1 — API
cd backend && npm run start:dev

# Terminal 2 — Back-office
cd backoffice && npm run dev -- --host
```

5. Codespaces ouvre automatiquement le port **5173** (back-office)

Comptes démo identiques. Interface mobile : `/mobile`

---

## Option C — Stack alternative

| Composant | Alternative |
|-----------|-------------|
| Base de données | [Supabase](https://supabase.com) PostgreSQL gratuit |
| API | [Railway.app](https://railway.app) — import repo, dossier `backend` |
| Front | [Netlify](https://netlify.com) — dossier `backoffice`, build `npm run build`, publish `dist` |
| Mobile | Interface web `/mobile` (inclus) |

---

## Architecture cloud

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Vercel    │────▶│    Render    │────▶│    Neon     │
│ Back-office │     │  NestJS API  │     │ PostgreSQL  │
│  + /mobile  │     │              │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
     Navigateur           HTTPS               Base cloud
```

---

## Coûts

| Service | Tier gratuit |
|---------|--------------|
| Neon | 0,5 Go, suffisant pour pilote |
| Render | 750 h/mois (API s'endort après 15 min d'inactivité) |
| Vercel | Illimité pour sites statiques |
| Codespaces | 60 h/mois (compte GitHub gratuit) |

---

## Limitations du mode cloud

- Render free : l'API met ~30 s à redémarrer après inactivité
- Pas de mode offline natif (nécessite l'app Flutter + sync)
- Impression Bluetooth : non disponible en web

Pour la production industrielle, prévoir un hébergement payant (Render Pro, Azure, AWS).

---

## Fichiers ajoutés pour le cloud

| Fichier | Rôle |
|---------|------|
| `render.yaml` | Déploiement API Render |
| `backoffice/vercel.json` | Config Vercel |
| `.devcontainer/` | GitHub Codespaces |
| `backoffice/src/pages/MobilePage.tsx` | Interface livreur web |
