# EMMAPP — Zero installation locale

> **Tout se fait dans le navigateur + GitHub Actions.**  
> Aucun Node, Docker, Flutter ou Android Studio sur votre PC.

---

## Architecture 100% cloud

```
GitHub (code) ──► GitHub Actions ──► AAB Google Play
       │
       ├──► Render Blueprint ──► API + PostgreSQL + Back-office
       │
       └──► GitHub Pages ──► Back-office (secours)
```

---

## ETAPES (2 clics + 1 paiement optionnel)

### Clic 1 — Render (API + BDD + Web) — GRATUIT

1. Ouvrez : **https://dashboard.render.com/select-repo?type=blueprint**
2. Connectez GitHub → sélectionnez **`jeremiepangu/emmapp`**
3. Cliquez **Apply** — Render déploie automatiquement :
   - PostgreSQL (base de données)
   - API NestJS (`emmapp-api.onrender.com`)
   - Back-office statique (`emmapp-web.onrender.com`)
   - Seed des données démo inclus dans le build

⏱ Attendez ~5 min. URLs visibles dans le dashboard Render.

### Clic 2 — GitHub Actions (Android AAB) — GRATUIT

1. Ouvrez : **https://github.com/jeremiepangu/emmapp/actions**
2. Workflow **Deploiement cloud complet** → **Run workflow**
3. Téléchargez l'artifact **`emmapp-release-aab`**

### Optionnel — Google Play (25 USD)

1. **https://play.google.com/console/signup**
2. Uploadez le `.aab` → fiche store dans `store-listing/`
3. Guide détaillé : `GOOGLE_PLAY.md`

---

## URLs finales (après Render)

| Service | URL |
|---------|-----|
| API + Swagger | `https://emmapp-api.onrender.com/api/docs` |
| Back-office admin | `https://emmapp-web.onrender.com` |
| Mobile livreur web | `https://emmapp-web.onrender.com/mobile` |
| GitHub Pages (secours) | `https://jeremiepangu.github.io/emmapp/` |

## Comptes démo

| Email | Mot de passe |
|-------|--------------|
| admin@emmapp.cd | password123 |
| livreur@emmapp.cd | password123 |

---

## Mettre a jour l'URL API dans GitHub Actions

Quand Render vous donne l'URL finale de l'API :

1. **https://github.com/jeremiepangu/emmapp/settings/variables/actions**
2. New variable : `API_URL` = `https://emmapp-api.onrender.com/api/v1`
3. Relancez le workflow Actions

---

## Ce qui N'est PAS necessaire

| Outil | Raison |
|-------|--------|
| Node.js local | Build sur Render + GitHub Actions |
| Docker | PostgreSQL géré par Render |
| Flutter / Android Studio | Build AAB sur GitHub Actions |
| Neon / Vercel | Tout inclus dans Render Blueprint |
| Installation admin (UAC) | Rien a installer sur Windows |

---

## Depannage

| Probleme | Solution |
|----------|----------|
| API 502 au reveil | Render free : attendre 30 s (cold start) |
| Render Blueprint echoue | Verifier les logs → onglet Events |
| GitHub Pages 404 | Attendre 2 min apres le workflow |
| App mobile ne connecte pas | Verifier `API_URL` dans GitHub Variables |
