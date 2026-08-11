# EMMAPP — État du déploiement automatique

> Mis à jour automatiquement le 11 août 2026

## ✅ Fait automatiquement

| Action | Statut | Lien |
|--------|--------|------|
| Code commité Git | ✅ | — |
| Dépôt GitHub créé | ✅ | https://github.com/jeremiepangu/emmapp |
| Code poussé sur `main` | ✅ | 132 fichiers |
| Workflow Android AAB | ✅ | GitHub Actions |
| Politique confidentialité | ✅ | Incluse dans backoffice |

## ⏳ À faire (5 min chacun — votre compte requis)

Ces étapes nécessitent **votre connexion** (paiement ou OAuth) — impossible à automatiser :

### 1. API Backend — Render (gratuit)
1. https://dashboard.render.com → **Sign up with GitHub**
2. **New → Blueprint** → repo `jeremiepangu/emmapp`
3. Variable `DATABASE_URL` → URL Neon (étape 2)
4. Shell Render : `cd backend && npm run prisma:seed`

### 2. Base de données — Neon (gratuit)
1. https://console.neon.tech → **Sign up**
2. Créer projet → copier l'URL PostgreSQL
3. Coller dans Render

### 3. Interface web — Vercel (gratuit)
1. https://vercel.com/new → Import `jeremiepangu/emmapp`
2. Root Directory : **`backoffice`**
3. Variable : `VITE_API_URL` = `https://VOTRE-API.onrender.com/api/v1`

### 4. Google Play (25 USD)
1. https://play.google.com/console/signup
2. GitHub Actions → artifact **emmapp-release-aab**
3. Suivre `GOOGLE_PLAY.md`

## 🔗 Liens directs

- **Repo GitHub** : https://github.com/jeremiepangu/emmapp
- **Actions (build AAB)** : https://github.com/jeremiepangu/emmapp/actions
- **Render Blueprint** : https://dashboard.render.com/select-repo?type=blueprint
- **Vercel Import** : https://vercel.com/new

## 🔐 Sécurité

Si un token GitHub a été exposé dans un terminal, révoquez-le :
**GitHub → Settings → Developer settings → Personal access tokens**

## Comptes démo (après seed Render)

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| admin@emmapp.cd | password123 | Admin |
| livreur@emmapp.cd | password123 | Livreur |
