# Déployer EMMAPP — 1 clic

Tout le code est sur GitHub. **Il ne reste qu'une action manuelle** (connexion Render, impossible à automatiser sans votre compte).

## Étape unique : Render Blueprint

1. Ouvrez ce lien : **[Déployer sur Render](https://render.com/deploy?repo=https://github.com/jeremiepangu/emmapp)**
2. Connectez-vous avec **GitHub**
3. Autorisez l'accès au repo `jeremiepangu/emmapp`
4. Cliquez **Apply Blueprint**

Render crée automatiquement :
- PostgreSQL (`emmapp-db`)
- API NestJS (`emmapp-api`) — avec seed des comptes démo
- Back-office web (`emmapp-web`)

Attendez ~5–8 minutes. URLs finales :
- API : `https://emmapp-api.onrender.com/api/v1/health`
- Web : `https://emmapp-web.onrender.com`
- Livreur (navigateur) : `https://emmapp-web.onrender.com/mobile`

## Comptes démo (après déploiement)

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| admin@emmapp.cd | password123 | Admin |
| livreur@emmapp.cd | password123 | Livreur |
| magasinier@emmapp.cd | password123 | Magasinier |

## Android (Google Play)

Le build AAB se fait **automatiquement** via GitHub Actions à chaque push sur `main`.

1. Allez sur [Actions](https://github.com/jeremiepangu/emmapp/actions)
2. Téléchargez l'artifact **emmapp-release-aab**
3. Uploadez-le sur [Google Play Console](https://play.google.com/console) (voir `GOOGLE_PLAY.md`)

## État actuel

- Repo GitHub : https://github.com/jeremiepangu/emmapp
- Render : **à activer** via le lien ci-dessus
- GitHub Pages : non disponible (repo privé) — Render Web suffit
