# EMMAPP Mobile — Résultat final

> Généré automatiquement — août 2026

---

## Ce qui est en ligne MAINTENANT

| Livrable | URL / accès | Statut |
|----------|-------------|--------|
| **Code source** | https://github.com/jeremiepangu/emmapp | Public |
| **Back-office admin** | https://jeremiepangu.github.io/emmapp/ | En ligne |
| **Interface livreur (web)** | https://jeremiepangu.github.io/emmapp/mobile | En ligne |
| **Politique confidentialité** | https://jeremiepangu.github.io/emmapp/privacy-policy.html | En ligne |
| **Release v1.0.0 (AAB Android)** | https://github.com/jeremiepangu/emmapp/releases/tag/v1.0.0 | Prêt |
| **CI/CD GitHub Actions** | https://github.com/jeremiepangu/emmapp/actions | Automatique |
| **API backend** | https://emmapp-api.onrender.com/api/v1 | En attente Render |

---

## Comptes démo (après activation Render)

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| admin@emmapp.cd | password123 | Administrateur |
| livreur@emmapp.cd | password123 | Livreur |
| magasinier@emmapp.cd | password123 | Magasinier |

---

## Dernière étape obligatoire : API Render (2 minutes)

L'interface web est en ligne, mais la **connexion échouera** tant que l'API n'est pas déployée.

**Lien direct (1 clic) :** https://render.com/deploy?repo=https://github.com/jeremiepangu/emmapp

1. Connectez-vous avec GitHub
2. Cliquez **Apply Blueprint**
3. Attendez 5–8 minutes
4. Testez : https://emmapp-api.onrender.com/api/v1/health

Render crée automatiquement PostgreSQL + API + site web alternatif (`emmapp-web.onrender.com`).

> Impossible à automatiser sans votre compte Render (OAuth obligatoire).

---

## Google Play (optionnel, 25 USD)

1. Téléchargez `emmapp-release.aab` depuis la [Release v1.0.0](https://github.com/jeremiepangu/emmapp/releases/tag/v1.0.0)
2. Ou depuis GitHub Actions → artifact `emmapp-release-aab`
3. Uploadez sur [Google Play Console](https://play.google.com/console)
4. Textes store dans `store-listing/`

**Keystore (première build auto) :** artifact `emmapp-keystore-BACKUP` — mot de passe : `emmapp_keystore_2026`

---

## Architecture déployée

```
GitHub (jeremiepangu/emmapp)
├── GitHub Pages ──────► Back-office + /mobile (EN LIGNE)
├── GitHub Actions ────► Build AAB Android (EN LIGNE)
├── GitHub Release ────► emmapp-release.aab v1.0.0 (EN LIGNE)
└── Render Blueprint ──► API + PostgreSQL (1 CLIC RESTANT)
```

---

## Fichiers importants

| Fichier | Description |
|---------|-------------|
| `render.yaml` | Blueprint Render (API + DB + web) |
| `DEPLOY_NOW.md` | Guide déploiement 1 clic |
| `GOOGLE_PLAY.md` | Publication Play Store |
| `GUIDE_DEPLOIEMENT_RAPIDE.md` | Guide pas à pas complet |

---

## Sécurité

- Révoquez tout token GitHub exposé dans un terminal (Settings → Developer settings → PAT)
- Changez `JWT_SECRET` en production sur Render
- Changez les mots de passe démo avant mise en production réelle
