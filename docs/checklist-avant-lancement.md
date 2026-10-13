# ✅ Checklist finale avant lancement — ArtiFlow-pro

> Dernière mise à jour : 2026.10.12
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

## 🚦 Feu vert

Le produit est **lançable** quand :

1. ✅ Domaine acheté et vérifié
2. ✅ Domaine d'envoi **Verified** dans Resend
3. ✅ Clé Resend synchronisée vers les Secrets du Backend
4. ⬜ Les **17 tâches planifiées** sont créées et passent au vert dans « Envois automatiques »
5. ⬜ Le **test « bout en bout »** des automatisations est concluant (fonctions au vert + email de test reçu)

Les étapes 6 et 7 (Twilio, OpenAI) sont **optionnelles** et peuvent suivre après le lancement.

> **Il ne reste qu'une action bloquante avant le lancement : créer les 18 tâches planifiées (étape 4), puis faire le test « bout en bout » (étape 5).**