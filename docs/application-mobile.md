# 📱 Application mobile (Android / iOS) — ArtiFlow-pro

> Dernière mise à jour : 2026.10.16
> L'application mobile **réutilise le code du site** : c'est la même application React, emballée
> par [Capacitor](https://capacitorjs.com) dans une application Android et iOS.

---

## 1. Comment ça marche

| Élément | Où |
|---------|-----|
| Configuration Capacitor (identifiant `com.artiflow.pro`, nom, dossier `out/`) | `capacitor.config.ts` |
| Projet Android (à ouvrir avec Android Studio) | `android/` |
| Projet iOS (à ouvrir avec Xcode, sur Mac) | `ios/` |
| Bouton retour Android + ouverture des liens du site dans l'app | `src/components/feature/IntegrationNative.tsx` |
| Téléchargements (PDF, CSV, ZIP, PNG) → feuille de partage du téléphone | `src/lib/telechargement.ts` |
| Domaine public utilisé dans les liens envoyés (signature, emails, paiement) | `originePublique()` dans `src/lib/site.ts` |

Dans l'application :

- l'écran d'accueil est **directement l'espace artisan** (`/app`), sans le site vitrine ;
- l'application a ses propres raccourcis mobiles : le responsable d'entreprise accède à l'accueil,
  au planning d'équipe, aux clients et aux devis ; un intervenant connecté accède uniquement à son
  planning personnel et à ses préférences, dans une interface distincte ;
- le site web conserve sa navigation mobile existante ; cette navigation par rôle est spécifique à
  l'application Android/iOS ;
- le branchement des événements natifs est monté par `src/App.tsx` ; l'ouverture de l'application à `/`
  redirige vers `/app`, tandis que les liens profonds gardent leur destination ;
- les liens copiés ou envoyés aux clients pointent vers **https://artiflow.pro** (ou `VITE_SITE_URL`),
  jamais vers l'adresse interne `https://localhost` de l'application ;
- un PDF, un CSV ou un export ouvre la **feuille de partage** (Enregistrer dans Fichiers, Drive, Gmail, WhatsApp…).

À chaque modification du code web, il faut **reconstruire** et **resynchroniser** les projets natifs
(voir § 3). Il n'y a pas de mise à jour « à chaud » : une nouvelle version passe par les stores.

---

## 2. Installer les outils (une seule fois)

### Android (fonctionne sous Windows)

1. Installer **Android Studio** : https://developer.android.com/studio
   (il installe aussi Java et le SDK Android).
2. Au premier lancement, accepter l'installation du SDK proposé.
3. Sur le téléphone : activer les **options développeur** puis le **débogage USB**,
   brancher le téléphone en USB.

### iOS (Mac obligatoire)

1. Un **Mac** avec **Xcode** (App Store).
2. Un compte **Apple Developer** (99 $/an) pour installer sur iPhone et publier.
3. Récupérer le projet sur le Mac, puis `npm install`.

---

## 3. Lancer l'application

```bash
# Android : construit le site, copie dans android/, ouvre Android Studio
npm run mobile:android

# iOS (sur Mac) : idem avec Xcode
npm run mobile:ios

# Seulement resynchroniser les deux plateformes après une modification
npm run mobile:sync
```

Ces commandes et les dépendances Capacitor sont déclarées dans `package.json` et `package-lock.json`.
`mobile:sync` reconstruit les ressources web puis synchronise les deux projets ; les commandes par
plateforme synchronisent le projet demandé et l'ouvrent dans Android Studio ou Xcode.

Dans Android Studio : choisir le téléphone en haut, puis ▶ **Run**.

> ⚠️ Le build utilise le fichier `.env` local (`VITE_PUBLIC_SUPABASE_URL`, `VITE_PUBLIC_SUPABASE_ANON_KEY`).
> Pour une version publiée, construire avec les valeurs de **production**. Ne pas définir `BASE_PATH`
> (l'application doit être construite pour la racine `/`).

---

## 4. Liens d'email qui ouvrent l'application (Android App Links)

Les liens `https://artiflow.pro/app/...` (connexion par lien magique, réinitialisation du mot de
passe, retour de paiement) sont déclarés dans `android/app/src/main/AndroidManifest.xml`. Pour
qu'Android les ouvre **dans l'application** plutôt que dans le navigateur, le site doit prouver
qu'il appartient à l'application :

1. Récupérer l'empreinte **SHA-256** de la clé de signature :
   - Play Console → *Configuration* → *Intégrité de l'application* → *Certificat de la clé de signature* ;
   - ou, en local : `keytool -list -v -keystore <votre-cle>.jks`.
2. Créer `public/.well-known/assetlinks.json` puis redéployer le site :

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.artiflow.pro",
      "sha256_cert_fingerprints": ["AA:BB:...:FF"]
    }
  }
]
```

Tant que ce fichier n'est pas en ligne, l'application fonctionne normalement ; seuls ces liens
s'ouvrent dans le navigateur au lieu de l'application.

Équivalent iOS (*Universal Links*) : il faut configurer la capacité **Associated Domains**
(`applinks:artiflow.pro`) dans Xcode et publier `/.well-known/apple-app-site-association` avec
l'identifiant d'équipe Apple associé à l'application. Sans ces deux réglages, les liens s'ouvrent
dans le navigateur ; leur traitement dans l'application est déjà branché par `IntegrationNative`.

---

## 5. Abonnement : client léger

L'application mobile **ne vend pas l'abonnement** (Google Play et l'App Store imposeraient leur propre
paiement et une commission). L'artisan s'abonne **sur le site**, puis se connecte dans l'application.

Dans l'application (`ACHAT_ABONNEMENT_DISPONIBLE = false`, `src/lib/abonnementPaiement.ts`) :

- `/tarifs` renvoie vers l'onglet Abonnement du profil ;
- l'onglet Abonnement est en **lecture seule** (offre, statut, échéance, historique), sans lien vers le site ;
- les alertes du tableau de bord (essai, impayé, résiliation) n'affichent pas de bouton d'achat ;
- les appels Stripe (paiement, portail client) sont bloqués par sécurité.

> ⚠️ Ne pas ajouter dans l'application de lien ou de texte invitant à payer sur le site : Google
> l'interdit en dehors de programmes spécifiques (*anti-steering*).

---

## 6. Publier sur Google Play

### Clé d'envoi (déjà créée)

| Fichier | Rôle |
|---------|------|
| `android/artiflow-upload.jks` | Clé d'envoi (*upload key*) |
| `android/keystore.properties` | Mots de passe de la clé |

Ces deux fichiers sont **hors Git**. **Sauvegardez-les** (clé USB + coffre-fort de mots de passe) :
sans eux, impossible d'envoyer une mise à jour (Google peut réinitialiser la clé, mais c'est long).

### Construire le fichier à envoyer

```bash
npm run mobile:sync
cd android && ./gradlew bundleRelease
```

Fichier produit : `android/app/build/outputs/bundle/release/app-release.aab`.
Pour chaque nouvelle version, **augmenter `versionCode`** (et `versionName`) dans `android/app/build.gradle`.

> Compiler avec le Java 21 d'Android Studio (`JAVA_HOME=%USERPROFILE%\.jdks\jbr-21.0.11`) :
> Gradle 8.14 ne prend pas en charge Java 25. Depuis Android Studio : *Build › Generate Signed App Bundle*.

### Dans la Play Console (https://play.google.com/console)

1. **Compte développeur** (25 $ une fois). Recommandé : compte **Organisation** (entreprise, numéro
   D-U-N-S gratuit à demander, quelques jours). Un compte **personnel** oblige à faire un **test fermé
   avec au moins 12 testeurs pendant 14 jours** avant la publication publique.
2. **Créer l'application** : nom « ArtiFlow-pro », langue français, application gratuite.
3. **Fiche du Store** : description courte (80 car.) et longue, icône 512×512, image de présentation
   1024×500, au moins 2 captures d'écran de téléphone.
4. **Contenu de l'application** : URL de la politique de confidentialité
   (`https://artiflow.pro/rgpd`), questionnaire de classification, public cible (adultes),
   **Sécurité des données** (email, nom, données clients/factures stockées chez Supabase, chiffrées en transit),
   **accès pour les examinateurs** : un compte de démonstration (email + mot de passe) avec des données.
5. **Envoyer `app-release.aab`** dans *Tests › Test interne* (essai immédiat sur vos appareils), puis
   *Test fermé* et enfin *Production*.
6. Activer la **signature d'application par Google Play** (proposée au premier envoi).

### Après le premier envoi : liens d'email vers l'application

Play Console › *Intégrité de l'application* › *Signature d'application* : copier l'empreinte
**SHA-256 de la clé de signature de l'application** et la mettre dans `assetlinks.json` (voir § 4).

---

## 7. iOS (plus tard)

- [ ] Un Mac avec Xcode et un compte Apple Developer (99 $/an).
- [ ] Mêmes règles que Google pour l'abonnement : rien à changer, l'achat est déjà masqué.
