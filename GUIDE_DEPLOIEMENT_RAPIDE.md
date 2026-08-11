# Guide pas à pas — GitHub + Render + Vercel

> **Durée estimée : 20 minutes** — tout depuis le navigateur, sans admin.

---

## Étape 1 — Créer le dépôt GitHub (5 min)

1. Allez sur **[github.com/new](https://github.com/new)**
2. Nom du repo : `emmapp` (ou `EMMAPP`)
3. Visibilité : **Private** (recommandé) ou Public
4. **Ne cochez pas** « Add README » (le projet existe déjà)
5. Cliquez **Create repository**

### Envoyer le code (sans Git installé)

**Option A — Upload web (le plus simple)**

1. Sur la page du repo vide, cliquez **uploading an existing file**
2. Glissez-déposez le contenu du dossier projet **sauf** :
   - `backend/node_modules/`
   - `backoffice/node_modules/`
   - `mobile/.dart_tool/`
3. Message de commit : `Initial commit EMMAPP MVP`
4. **Commit changes**

**Option B — Archive ZIP**

1. Utilisez l’archive `emmapp-cloud.zip` générée dans le dossier projet
2. Décompressez-la localement, puis uploadez les fichiers comme en option A

**Option C — GitHub Codespaces (si upload trop lourd)**

1. Créez le repo avec un README minimal
2. **Code → Codespaces → Create codespace**
3. Uploadez les fichiers via l’explorateur VS Code dans le codespace
4. Commit & push depuis le terminal intégré (Git déjà installé)

---

## Étape 2 — Base de données Neon (3 min)

1. **[console.neon.tech](https://console.neon.tech)** → Sign up (GitHub login possible)
2. **New Project** → nom `emmapp`
3. Copiez la **Connection string** :
   ```
   postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

---

## Étape 3 — API sur Render (7 min)

1. **[dashboard.render.com](https://dashboard.render.com)** → Sign up (GitHub login)
2. **New +** → **Blueprint**
3. Connectez le repo `emmapp`
4. Render lit `render.yaml` automatiquement
5. Quand demandé, renseignez :
   | Variable | Valeur |
   |----------|--------|
   | `DATABASE_URL` | URL Neon (étape 2) |
   | `JWT_SECRET` | Chaîne aléatoire longue (ex. `emmapp-jwt-2026-secret-xyz`) |
6. **Apply** → attendez le déploiement (~5 min)
7. Notez l’URL : `https://emmapp-api.onrender.com`

### Initialiser les données démo

1. Render → service `emmapp-api` → onglet **Shell**
2. Exécutez :
   ```bash
   cd backend && npm run prisma:seed
   ```
3. Vérifiez : [https://emmapp-api.onrender.com/api/v1/health](https://emmapp-api.onrender.com/api/v1/health)

---

## Étape 4 — Interface web sur Vercel (5 min)

1. **[vercel.com/new](https://vercel.com/new)** → Import Git Repository
2. Sélectionnez le repo `emmapp`
3. **Root Directory** : cliquez **Edit** → sélectionnez `backoffice`
4. Framework : **Vite** (détecté auto)
5. **Environment Variables** :
   | Name | Value |
   |------|-------|
   | `VITE_API_URL` | `https://emmapp-api.onrender.com/api/v1` |
6. **Deploy**

---

## Étape 5 — Tester l’application

| URL | Compte | Mot de passe |
|-----|--------|--------------|
| `https://VOTRE-APP.vercel.app` | admin@emmapp.cd | password123 |
| `https://VOTRE-APP.vercel.app/mobile` | livreur@emmapp.cd | password123 |
| `https://emmapp-api.onrender.com/api/docs` | — | Swagger API |

---

## Dépannage

| Problème | Solution |
|----------|----------|
| API 502 au réveil | Render free tier : attendre 30 s (cold start) |
| Erreur CORS | L’API accepte toutes les origines (`origin: true`) |
| Login échoue | Relancer `npm run prisma:seed` dans le shell Render |
| Vercel ne voit pas l’API | Vérifier `VITE_API_URL` avec `/api/v1` à la fin |

---

## Coût total : 0 €/mois (tiers gratuits)
