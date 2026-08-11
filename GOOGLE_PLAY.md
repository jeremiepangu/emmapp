# Publication sur Google Play — EMMAPP Mobile

> Google Play exige un **compte développeur** (25 USD, paiement unique) que **seul vous** pouvez créer avec votre compte Google.

---

## Vue d'ensemble

```
GitHub Actions (cloud)  →  AAB signé  →  Google Play Console  →  Google Play Store
        ↑
   Aucun Flutter/Android local requis
```

| Élément | Valeur |
|---------|--------|
| Package ID | `com.emmapp.mobile` |
| Format | Android App Bundle (`.aab`) |
| Version | 1.0.0 (code 1) |
| API production | `https://emmapp-api.onrender.com/api/v1` |

---

## Étape 1 — Compte Google Play Developer (obligatoire)

1. **[play.google.com/console/signup](https://play.google.com/console/signup)**
2. Payez les **25 USD** (carte bancaire internationale)
3. Complétez le profil développeur (nom, email, téléphone)
4. Attendez la validation (24–48 h)

---

## Étape 2 — Pousser le code sur GitHub

Suivez `GUIDE_DEPLOIEMENT_RAPIDE.md` si ce n'est pas déjà fait.

---

## Étape 3 — Générer la clé de signature

La clé signe votre app. **Ne la perdez jamais.**

### Option A — PowerShell (Windows)

```powershell
cd scripts
.\generate-keystore.ps1
```

### Option B — Ligne de commande (Java keytool)

```bash
keytool -genkey -v -keystore upload-keystore.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass VOTRE_MOT_DE_PASSE -keypass VOTRE_MOT_DE_PASSE \
  -dname "CN=EMMAPP, OU=Mobile, O=EMMAPP, L=Kinshasa, C=CD"
```

### Ajouter les secrets GitHub

Repo → **Settings → Secrets and variables → Actions** :

| Secret | Valeur |
|--------|--------|
| `ANDROID_KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `ANDROID_KEY_PASSWORD` | Mot de passe de la clé |
| `ANDROID_KEYSTORE_BASE64` | Keystore encodé en base64 |

Encoder en base64 (PowerShell) :
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("mobile\android\app\upload-keystore.jks"))
```

---

## Étape 4 — Builder l'AAB dans le cloud (GitHub Actions)

1. GitHub → repo → **Actions**
2. Workflow **Build Android AAB for Google Play**
3. **Run workflow** → API URL : `https://VOTRE-API.onrender.com/api/v1`
4. Attendez ~10 min
5. Téléchargez l'artifact **`emmapp-release-aab`** → fichier `app-release.aab`

> Assurez-vous que l'API Render est déployée et seedée avant de tester l'app.

---

## Étape 5 — Créer l'application sur Play Console

1. **[play.google.com/console](https://play.google.com/console)** → **Create app**
2. Renseignez :
   - **Nom** : EMMAPP Mobile
   - **Langue** : Français
   - **App ou jeu** : Application
   - **Gratuit ou payant** : Gratuit
3. Acceptez les déclarations (politiques, US export laws, etc.)

---

## Étape 6 — Fiche Play Store

### Textes (dossier `store-listing/`)

| Champ | Fichier |
|-------|---------|
| Description courte | `short-description.txt` |
| Description complète | `full-description.txt` |

### Graphiques requis

| Asset | Taille | Action |
|-------|--------|--------|
| Icône | 512×512 PNG | Exporter depuis le logo EMMAPP |
| Feature graphic | 1024×500 PNG | Bannière promotionnelle |
| Captures d'écran | min. 2, 1080×1920 | Screenshots de l'app sur téléphone |

> Astuce : installez l'AAB en test interne, prenez des screenshots sur votre téléphone.

### Politique de confidentialité (obligatoire)

1. Hébergez `store-listing/privacy-policy.html` sur Vercel/GitHub Pages
2. URL exemple : `https://votre-app.vercel.app/privacy-policy.html`
3. Copiez l'URL dans Play Console → **Politique de confidentialité**

---

## Étape 7 — Classification du contenu

Play Console → **Contenu de l'application** :

1. **Classification du contenu** → questionnaire (application professionnelle, pas de contenu sensible)
2. **Public cible** → 18+ (application professionnelle)
3. **Sécurité des données** → déclarez : email, localisation, données professionnelles
4. **Annonces** → Non (pas de publicité)

---

## Étape 8 — Publier en test interne (recommandé)

1. **Testing → Internal testing** → **Create new release**
2. **Upload** → glissez `app-release.aab`
3. Notes de version : `Version initiale — MVP distribution`
4. **Review release** → **Start rollout**

Ajoutez votre email comme testeur → recevez le lien d'installation.

---

## Étape 9 — Production

Après validation en test interne (1–7 jours pour première review Google) :

1. **Production** → **Create new release**
2. Uploadez le même AAB (ou une version supérieure)
3. **Send for review**

Délai de review Google : **1 à 7 jours** (parfois plus pour nouveaux comptes).

---

## Mises à jour futures

1. Incrémentez dans `mobile/pubspec.yaml` : `version: 1.0.1+2` (+2 = versionCode)
2. Commit + tag : `git tag v1.0.1 && git push origin v1.0.1`
3. Le workflow GitHub Actions se lance automatiquement sur les tags `v*`
4. Uploadez le nouvel AAB sur Play Console

---

## Dépannage

| Problème | Solution |
|----------|----------|
| `ANDROID_KEYSTORE_BASE64 manquant` | Ajoutez les 3 secrets GitHub |
| Build Flutter échoue | Vérifiez les logs Actions, mettez à jour `flutter-version` |
| Play Console rejette l'AAB | Vérifiez targetSdk ≥ 34, politique de confidentialité |
| App ne se connecte pas | Vérifiez l'URL API dans le workflow + API Render active |
| Keystore perdu | Impossible de mettre à jour l'app — créez une nouvelle avec nouveau package ID |

---

## Checklist finale

- [ ] Compte Google Play Developer actif (25 USD)
- [ ] API Render déployée et seedée
- [ ] Secrets GitHub configurés (keystore)
- [ ] AAB généré via GitHub Actions
- [ ] Fiche store complète (textes, icône, screenshots)
- [ ] Politique de confidentialité en ligne
- [ ] Test interne validé sur téléphone
- [ ] Soumission production
