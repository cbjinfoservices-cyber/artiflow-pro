# ✅ Checklist finale avant lancement — ArtiFlow-pro

> Dernière mise à jour : 2026.10.19
> Ce document récapitule **tout ce qu'il faut vérifier avant de publier en production réelle**.
> Le code est essentiellement terminé (~97 %) ; ce qui reste relève surtout de la **configuration** (pas du développement).

---

## 🩺 Vérification globale des automatisations — 2026.10.12

Vérification faite directement côté Backend (fonctions déployées + tables et colonnes de trace).

| Point vérifié | Résultat |
|---------------|----------|
| Fonctions planifiées déclarées dans le code | **18** |
| Fonctions déployées et **actives** côté Backend | ✅ **18 / 18** |
| Tables de trace des automatisations | ✅ présentes (`recap_recontact_envois`, `recap_alertes_artisan`, `escalade_journal`, `recap_envois`, `envois_email`, `envois_auto_tests`, `relances`, `relances_client`, `abonnements`, `profiles`) |
| Colonnes de réglage des automatisations sur `profiles` | ✅ présentes (comptable auto + bilan annuel, récap hebdo envois, rappel relance, alertes mot de passe + récaps, comparatif annuel, dernier envoi hebdo) |
| Clé Resend + domaine d'envoi vérifié | ✅ fait (`artiflow-pro.fr` vérifié) |
| Stripe connecté (abonnements) | ✅ fait |

> ➡️ **Conclusion** : le câblage des automatisations est **confirmé branché**. Il reste à créer les **tâches planifiées** (étape 4) pour que tout parte **tout seul**, et à faire un dernier test « bout en bout » depuis l'écran **Envois automatiques**.

---

## Vue d'ensemble

| # | Étape | Type | Bloquant ? | État |
|---|-------|------|-----------|------|
| 1 | Domaine personnalisé vérifié | Config | 🔴 Oui | ✅ Vérifié |
| 2 | Domaine d'envoi vérifié dans Resend | Config | 🔴 Oui (bloque tous les emails) | ✅ Vérifié |
| 3 | Clé Resend synchronisée vers le Backend | Config | 🔴 Oui | ✅ Fait |
| 4 | Créer les tâches planifiées (18) | Config | 🔴 Oui (rien ne tourne tout seul) | ⬜ À faire |
| 5 | Test « bout en bout » des automatisations | Config | 🔴 Oui (confirme le câblage) | ⬜ À faire |
| 6 | Connecter Twilio (SMS / WhatsApp) | Config | 🟠 Non (optionnel au lancement) | ⬜ À faire |
| 7 | Activer la clé OpenAI (devis IA) | Config | 🟠 Non (dégrade une fonction) | ⬜ À faire |
| 8 | Application mobile iOS / Android | Dev | ⚪ Non (non supporté) | ❌ Hors périmètre |
| 9 | Contrôles éditoriaux avant publication (titres, descriptions, visuels de partage, sitemap) | Édito / SEO | 🟠 Non (mais à faire à chaque publication) | ✅ Procédure ci-dessous |

---

## 1. Domaine personnalisé  ✅

**Pourquoi** : donner une adresse pro au site (`artiflow-pro.fr`) plutôt que l'URL technique.

- [x] Domaine `artiflow-pro.fr` acheté et vérifié
- [x] Le site répond bien sur le domaine (page d'accueil + `/app`)

---

## 2. Domaine d'envoi vérifié dans Resend  ✅

**Pourquoi** : sans domaine vérifié, **aucun email réel ne part** (devis, factures, relances, récaps).

- [x] Domaine d'envoi `artiflow-pro.fr` ajouté dans le panneau Resend
- [x] Enregistrements DNS (SPF / DKIM) configurés chez le registrar
- [x] Statut **Verified** confirmé dans Resend

> Dans **Préférences d'affichage**, la carte « Envoi des emails » doit afficher **« Prêt à envoyer »**.

---

## 3. Synchroniser la clé Resend vers le Backend  ✅

**Pourquoi** : le code des fonctions Backend lit `RESEND_API_KEY` et `RESEND_FROM_DOMAIN`
dans les **Secrets du Backend**.

- [x] Clé API Resend présente et valide
- [x] Clé produit copiée dans les Secrets du Backend sous `RESEND_API_KEY`
- [x] Domaine vérifié enregistré sous `RESEND_FROM_DOMAIN`

> ⚠️ Ne jamais coller la clé dans le chat : elle se dépose via la synchro sécurisée.

---

## 4. Créer les tâches planifiées (le moteur des automatisations)  🔴 SEUL POINT BLOQUANT

**Pourquoi** : tout le code des envois automatiques est prêt, mais **rien ne se déclenche
tout seul** tant que les tâches planifiées ne sont pas créées côté plateforme.

> Les **18 fonctions** ont `verify_jwt = false` : elles sont appelables sans authentification,
> donc par n'importe quel service de cron. Elles revérifient **elles-mêmes** l'heure avant
> d'envoyer, donc un appel « toutes les heures » est sans risque de doublon.

Voir le guide dédié : **`docs/guide-taches-planifiees.md`**

Deux méthodes possibles :
1. **Cron serveur / NAS** — script fourni : `docs/cron/automatisations-artiflow.sh`
2. **Cron externe déporté** — **cron-job.org** (gratuit) ou **GitHub Actions**
   (modèle fourni : `docs/cron/github-actions-automatisations.yml`)

Les URLs exactes de chaque fonction sont listées dans le guide dédié : **`docs/guide-taches-planifiees.md`**.

### Les 18 tâches à créer

| Fonction | Rôle | Cadence conseillée |
|----------|------|--------------------|
| `recap-quotidien` | Récap quotidien à l'artisan | Toutes les heures — `0 * * * *` |
| `envoi-journal-mensuel` | Journal comptable + régularité au comptable | Toutes les heures — `0 * * * *` |
| `relance-envoi-manquant` | Alerte si un mois attendu reste sans envoi | Une fois par jour — `0 8 * * *` |
| `relancer-factures-retard` | Relances groupées des factures en retard | Une fois par jour — `0 9 * * *` |
| `escalade-relances` | Escalade des relances clients sans réponse | Une fois par jour — `0 9 * * *` |
| `rappel-prelevement-abonnement` | Rappel J-3 avant prélèvement Stripe | Une fois par jour — `0 10 * * *` |
| `recap-recontact-volatils` | Récap hebdo des comptes à recontacter | Toutes les heures — `0 * * * *` |
| `recap-hebdo-envois-auto` | Synthèse hebdo des envois automatiques | Toutes les heures — `0 * * * *` |
| `recap-hebdo-alertes-taux` | Synthèse hebdo des alertes de taux | Toutes les heures — `0 * * * *` |
| `recap-hebdo-echecs-blanc` | Envoi hebdo du récap d'échecs des rejeux (CSV) | Toutes les heures — `0 * * * *` |
| `envoi-bilan-annuel` | Bilan d'archivage annuel au comptable | Une fois par jour — `0 7 * * *` |
| `alerte-mot-de-passe-ancien` | Alerte « mot de passe ancien » à l'artisan | Une fois par jour — `0 8 * * *` |
| `recap-mensuel-mot-de-passe` | Récap mensuel des alertes mot de passe | Toutes les heures — `0 * * * *` |
| `recap-trimestriel-mot-de-passe` | Listing trimestriel des récaps au comptable | Toutes les heures — `0 * * * *` |
| `envoi-recap-mensuel-annuel` | Historique annuel des récaps (PDF) | Une fois par jour — `0 7 * * *` |
| `envoi-comparatif-cadence-annuel` | Comparatif de cadence annuel (PDF) | Une fois par jour — `0 7 * * *` |
| `envoi-recap-echecs-annuel` | Régularité annuelle d'archivage des échecs (PDF, date réglable) | Toutes les heures — `0 * * * *` |
| `export-csv-mensuel` | Export CSV mensuel par email | Toutes les heures — `0 * * * *` |

> **Astuce** : comme toutes les fonctions revérifient l'heure elles-mêmes, une seule cadence
> horaire (`0 * * * *`) appliquée aux 18 fonctions fonctionne parfaitement.

- [ ] Créer les **18 tâches planifiées** (voir le guide)
- [ ] Vérifier dans **Espace artisan → Envois automatiques** que chaque automatisation passe
      au vert (« À jour »)

> 💡 Cochez chaque tâche au fur et à mesure, puis vérifiez dans **Espace artisan → Envois
> automatiques** que chaque automatisation passe au vert (« À jour »).

---

## 5. Test « bout en bout » des automatisations  🔴 À FAIRE EN DERNIER

**Pourquoi** : confirmer que le câblage répond réellement (et pas seulement que les fonctions
existent).

**Espace artisan → Envois automatiques**

1. Déclencher un premier passage des tâches planifiées (méthode choisie à l'étape 4 ; voir
   `docs/guide-taches-planifiees.md`).
2. Chaque automatisation qui répond passe au vert (« À jour ») au fil des premiers passages,
   avec la date du dernier déclenchement réel.
3. Pour une carte « À vérifier » ou « Inactive » : utiliser son bouton **« Tester maintenant »**
   et lire le message d'erreur éventuel.

> ⚠️ Si l'heure et le jour correspondent à un envoi prévu, l'email peut partir **pour de vrai**
> (client, comptable ou artisan selon la fonction). Les autres répondent simplement sans rien
> envoyer. C'est normal et sans risque de doublon.

- [ ] Déclencher un premier passage et vérifier que les automatisations passent au vert
- [ ] Toutes les automatisations « À jour »
- [ ] Faire un **email de test** réel et confirmer sa réception (penser à vérifier les spams)

---

## 6. Twilio — Relances SMS / WhatsApp (optionnel)

**Pourquoi** : le canal SMS / WhatsApp est codé, mais nécessite des identifiants Twilio.

> 📄 Procédure détaillée pas-à-pas : **`docs/activer-sms-whatsapp-twilio.md`**

- [ ] Créer un compte Twilio
- [ ] Récupérer **Account SID** + **Auth Token**
- [ ] Acheter / configurer un numéro expéditeur (et un numéro WhatsApp Business)
- [ ] Ajouter ces identifiants comme Secrets du Backend (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM`)
- [ ] Tester un envoi SMS depuis l'espace Relances (« Test SMS »)

> Non bloquant pour un lancement « email-only ». L'offre Pro le mentionne.

---

## 7. Clé OpenAI — génération de devis par IA (optionnel)

**Pourquoi** : la fonction `generer-devis-lignes` rédige les lignes d'un devis à partir d'une
description. Sans clé, la fonction est coupée (le reste marche normalement).

> 📄 Procédure détaillée pas-à-pas : **`docs/activer-devis-ia-openai.md`**

- [ ] Récupérer une clé API OpenAI (`sk-…`)
- [ ] La déposer comme secret Backend `OPENAI_API_KEY`
- [ ] Fixer un plafond de dépense côté OpenAI
- [ ] Tester une génération de devis IA

---

## 8. Application mobile iOS / Android

- ❌ **Non supportée** par la plateforme actuelle (SPA web uniquement).
- Alternative possible : proposer l'app web en « ajouter à l'écran d'accueil » (PWA non garanti).
- À garder pour un futur lot (nécessite un développement natif hors périmètre).

---

## 9. Contrôles éditoriaux avant publication  🟠

**Pourquoi** : les contrôles techniques ci-dessus garantissent que le site tourne ;
ces quatre contrôles-là garantissent qu'il **se partage bien**. Ils prennent deux
minutes et se font juste avant de cliquer sur « Publier ».

Ils se lisent dans cet ordre : le garde-fou des visuels vient **juste après** le
contrôle des titres et des descriptions, parce que c'est le même sujet — l'aperçu
d'un lien partagé.

### 9.1 Titres

- [ ] Un seul `<h1>` visible par page, et il reprend l'intention de la page
- [ ] Le `<title>` fait **60 caractères ou moins** (au-delà, Google tronque)
- [ ] Deux pages ne partagent pas le même titre (les pages villes et métiers sont
      les premières concernées : le copier-coller d'une fiche à l'autre se voit tout de suite)
- [ ] Le titre d'une page est bien celui de **la page**, pas celui de l'accueil

> Le compteur affiché sous chaque titre dans l'audit donne directement `X/60` :
> vert dans la plage, ambre au-delà. Plus besoin de copier le titre ailleurs.

### 9.2 Descriptions

- [ ] Chaque description fait **120 à 160 caractères**
- [ ] Elle résume vraiment la page, sans être une recopie du titre
- [ ] Aucune description ne se répète d'une page à l'autre
- [ ] Elle contient la ville ou le métier quand c'est une page locale ou métier

> Même principe : le compteur sous chaque description affiche `X/160` et
> signale les valeurs trop courtes comme les trop longues.

> Pour relire titres et descriptions d'un coup d'œil : Espace connecté → **Audit SEO**.
> La liste affiche, page par page, le titre réellement appliqué, sa longueur, la
> description, la sienne, et l'aperçu du lien tel qu'il apparaîtrait sur LinkedIn.
> Le filtre **« Afficher uniquement les métadonnées hors plage »** ne laisse que
> les champs à corriger.

### 9.3 Garde-fou des titres et des descriptions

Espace connecté → **Audit SEO** → bloc **« Garde-fou des titres et descriptions »**.

- [ ] Le badge indique **« Aucun écart »**
- [ ] Aucun titre partagé entre deux pages (doublon bloquant : les pages se
      concurrencent dans les résultats)
- [ ] Aucune description partagée entre deux pages (signe d'un copier-coller)
- [ ] Aucun champ hors plage : titre ≤ 60, description 120–160

Un écart de longueur se corrige en réécrivant le champ. Un doublon se corrige en
réécrivant l'un des deux : jamais en supprimant la page au profit de l'autre.

### 9.4 Garde-fou des visuels de partage

Espace connecté → **Audit SEO** → bloc **« Garde-fou des visuels de partage »**.

- [ ] Le badge indique **« Aucun écart »**
- [ ] Les trois déclarations sont vertes : balises du HTML servi, image de repli du
      routeur, image de l'accueil dans le sitemap
- [ ] L'image affichée est bien celle choisie dans les Réglages SEO du projet
- [ ] Une page qui a son visuel dédié ne réutilise pas l'image de marque
      (et deux pages ne partagent pas le même visuel dédié)

**Si un écart apparaît** : il nomme le fichier fautif. On réaligne les trois
déclarations, on republie, puis on relance le contrôle. Ne pas publier en laissant
un écart « bloquant » : l'aperçu du lien est cassé pour tout le monde.

> Limite assumée : ce garde-fou compare ce que le code **déclare** à ce que le site
> **sert**. Il n'interroge pas LinkedIn. Le contrôle du visuel réellement téléchargé
> par les plateformes se fait après publication, à l'étape 1 de
> [`docs/controle-post-publication.md`](controle-post-publication.md).

### 9.5 Sitemap

Le sitemap n'est plus saisi à la main : `src/lib/sitemap.ts` le reconstruit à partir
mêmes données qui alimentent les pages (métiers, villes, guides, parcours, auteurs).
Une nouvelle fiche ajoutée dans ces données apparaît donc dans la liste attendue
sans qu'on ait à y penser.

- [ ] Le bloc **« Garde-fou du sitemap »** de l'audit indique **« Aucun écart »**
- [ ] Le nombre d'URL du fichier servi égale le nombre d'URL attendues
- [ ] Aucune URL n'apparaît deux fois
- [ ] Aucune entrée orpheline (page supprimée dont la ligne est restée)
- [ ] Une page ne porte un `<lastmod>` que si son contenu a réellement changé —
      jamais la date du jour de publication
- [ ] Les pages d'espace connecté (`/app/...`) n'y figurent pas

**Si un écart apparaît** : le bloc nomme l'URL fautive et la raison (page absente,
doublon, entrée orpheline, page non générée). Le bouton **« Copier le sitemap
généré »** fournit le XML complet à déposer dans `public/sitemap.xml`, puis on
republie et on relance le contrôle.

> Limite assumée : le fichier `public/sitemap.xml` reste un artefact statique. Le
générateur vit dans le code du site et le garde-fou compare le fichier **servi** à
la liste attendue — il détecte donc tout oubli, mais c'est la copie du XML qui
met le fichier à jour. Le détail est dans
[`docs/controle-post-publication.md`](controle-post-publication.md).

---

## 🚦 Feu vert

Le produit est **lançable** quand :

1. ✅ Domaine acheté et vérifié
2. ✅ Domaine d'envoi **Verified** dans Resend
3. ✅ Clé Resend synchronisée vers les Secrets du Backend
4. ⬜ Les **18 tâches planifiées** sont créées et passent au vert dans « Envois automatiques »
5. ⬜ Le **test « bout en bout »** des automatisations est concluant (fonctions au vert + email de test reçu)
6. ⬜ Les **contrôles éditoriaux** de l'étape 9 sont passés : titres et descriptions dans leur plage, aucun doublon, garde-fous visuels et sitemap au vert

Les étapes 6 et 7 (Twilio, OpenAI) sont **optionnelles** et peuvent suivre après le lancement.

> **Il ne reste qu'une action bloquante avant le lancement : créer les 18 tâches planifiées (étape 4), puis faire le test « bout en bout » (étape 5).**