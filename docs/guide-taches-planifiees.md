# ⏰ Guide pas-à-pas — Configurer les tâches planifiées des automatisations

> Dernière mise à jour : 2026.10.12
> Objectif : faire tourner **tout seuls** les envois automatiques d'ArtiFlow-pro.

---

## 1. Comprendre le principe

Toutes les automatisations d'envoi (récaps, alertes, relances, journal comptable…) sont déjà
**codées** dans des **fonctions Backend**. Mais une fonction ne s'exécute que si **quelqu'un
l'appelle**. Les **tâches planifiées** (cron) sont ce « quelqu'un » : elles appellent chaque
fonction à intervalle régulier.

Chaque fonction vérifie ensuite **elle-même** la date / l'heure et ses réglages (jour, heure,
anti-doublon) avant d'envoyer pour de vrai. C'est pour ça qu'on peut sans problème appeler une
fonction « toutes les heures » : elle n'expédiera qu'au bon moment.

> ⚠️ Aucune donnée ni réglage n'est à recopier : le déclenchement se fait **côté plateforme**.

---

## 2. Où ça se configure (à lire d'abord)

**Readdy ne propose pas d'écran natif de tâches planifiées.** Il n'y a donc pas de menu
« Agents → Tâches planifiées » à chercher : le déclenchement se fait par un **service de cron
externe** qui appelle les URLs de tes fonctions à intervalle régulier.

Les 25 fonctions concernées ont `verify_jwt = false` : elles sont appelables **sans
authentification**, donc par n'importe quel service de cron. Trois méthodes possibles :

| Méthode | Idéal si… | Section |
|---------|-----------|---------|
| **Script cron serveur (.sh) / NAS** | tu as un serveur, un NAS, une crontab | §7.2 |
| **cron-job.org** | tu veux du 100 % déporté, gratuit, sans serveur | §7.3 |
| **GitHub Actions** | tu as déjà un dépôt GitHub du projet | §7.4 |

> Une seule méthode suffit — n'en fais **pas** deux en parallèle, sinon les fonctions seraient
> appelées deux fois (sans casser, l'anti-doublon protège, mais c'est inutile).

---

## 3. Comprendre une tâche cron

Pour chaque fonction : on enregistre un appel avec

- **Méthode** : `POST`
- **URL** : `https://<domaine-backend>/functions/v1/<nom-fonction>`
  - Domaine réel : **`vbje6pqzh6ug1flwt901.helloreaddy.com`**
  - Exemple : `https://vbje6pqzh6ug1flwt901.helloreaddy.com/functions/v1/recap-quotidien`
- **En-tête (Header)** : `Content-Type: application/json`
- **Corps (Body)** : vide
- **Cadence (cron)** : voir le tableau du §4

---

## 4. Les tâches à créer (25)

| Fonction | Rôle | Cadence conseillée (cron) |
|----------|------|---------------------------|
| `recap-quotidien` | Récap quotidien à l'artisan | Toutes les heures — `0 * * * *` |
| `envoi-journal-mensuel` | Journal comptable + récap de régularité au comptable (jour du mois réglé) | Toutes les heures — `0 * * * *` |
| `relance-envoi-manquant` | Alerte artisan si un mois attendu reste sans envoi | Une fois par jour — `0 8 * * *` |
| `relancer-factures-retard` | Relances groupées des factures en retard | Une fois par jour — `0 9 * * *` |
| `escalade-relances` | Escalade des relances clients sans réponse | Une fois par jour — `0 9 * * *` |
| `rappel-prelevement-abonnement` | Rappel J-3 avant prélèvement Stripe | Une fois par jour — `0 10 * * *` |
| `rappel-echeance-paiement-unique` | Rappel J-7 avant la fin d'une période payée en paiement unique | Une fois par jour — `0 10 * * *` |
| `recap-recontact-volatils` | Récap hebdo des comptes à recontacter | Toutes les heures — `0 * * * *` |
| `recap-hebdo-envois-auto` | Synthèse hebdo des envois automatiques | Toutes les heures — `0 * * * *` |
| `recap-hebdo-alertes-taux` | Synthèse hebdo des alertes de taux de réussite | Toutes les heures — `0 * * * *` |
| `recap-hebdo-echecs-blanc` | Récap hebdo des échecs des rejeux à blanc (CSV) | Toutes les heures — `0 * * * *` |
| `recap-hebdo-echecs-paiement` | Synthèse hebdo des échecs de paiement Stripe aux gestionnaires | Toutes les heures — `0 * * * *` |
| `recap-hebdo-alertes-stripe-non-traitees` | Récap hebdo des alertes de configuration Stripe encore à traiter — joint automatiquement l'archive PDF des suppressions en attente | Toutes les heures — `0 * * * *` |
| `recap-invitations-intervenants` | Récap hebdo des fiches « invitées sans compte » à relancer | Toutes les heures — `0 * * * *` |
| `envoi-bilan-annuel` | Bilan d'archivage annuel | Une fois par jour — `0 7 * * *` |
| `alerte-mot-de-passe-ancien` | Alerte « mot de passe ancien » à l'artisan | Une fois par jour — `0 8 * * *` |
| `recap-mensuel-mot-de-passe` | Récap mensuel des alertes mot de passe | Toutes les heures — `0 * * * *` |
| `recap-trimestriel-mot-de-passe` | Listing trimestriel des récaps mot de passe au comptable | Toutes les heures — `0 * * * *` |
| `envoi-recap-mensuel-annuel` | Historique annuel des récaps mot de passe (PDF) | Une fois par jour — `0 7 * * *` |
| `envoi-comparatif-cadence-annuel` | Comparatif de cadence annuel (PDF) | Une fois par jour — `0 7 * * *` |
| `envoi-recap-echecs-annuel` | Régularité annuelle d'archivage des échecs (PDF, date réglable) | Toutes les heures — `0 * * * *` |
| `export-csv-mensuel` | Export CSV mensuel par email (réessais + escalade) | Toutes les heures — `0 * * * *` |
| `envoi-bienvenue-nouveaux-pros` | Email de bienvenue automatique aux nouvelles inscriptions | Toutes les heures — `0 * * * *` |
| `rappeler-suppressions-prochaines` | Rappels email à J-7 puis J-1 avant la suppression réelle d'un compte | Toutes les heures — `0 * * * *` |
| `purger-comptes-supprimes` | Efface réellement les comptes arrivés au terme des 30 jours de grâce | Toutes les heures — `0 * * * *` |

> **Pourquoi « toutes les heures » pour certaines ?** Ces fonctions contiennent un réglage
> interne *jour + heure* (ex. « récap hebdo le lundi à 8 h »). Les appeler chaque heure garantit
> qu'elles se déclenchent au bon créneau, sans jamais envoyer deux fois (anti-doublon intégré).
>
> **Astuce** : comme toutes les fonctions revérifient l'heure elles-mêmes, une seule cadence
> horaire (« `0 * * * *` ») appliquée aux 25 fonctions fonctionne parfaitement. Les cadences
> « une fois par jour » ci-dessus sont juste une optimisation pour économiser des appels.

---

## 5. Vérifier que tout tourne

1. Ouvrir l'espace artisan → **Envois automatiques**
2. Chaque automatisation doit afficher :
   - **Dernier passage** : la date du dernier déclenchement réel
   - **État** : 🟢 À jour / 🟠 À vérifier / ⚪ Inactive
   - **Prochaine exécution** : calculée depuis vos réglages
3. Utiliser le bouton **« Tester maintenant »** d'une carte pour expédier un vrai email de test
   à l'artisan lui-même (sans toucher aux vrais destinataires)
4. L'**historique des tests** en bas de page journalise chaque test (succès / échec + message)

---

## 6. Dépannage

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| Automatisation « Inactive » | Aucun passage enregistré | Vérifier que la tâche est **activée** et que l'URL est correcte |
| Automatisation « À vérifier » | Passage trop ancien / en erreur | Cliquer **« Tester maintenant »**, lire le message d'erreur |
| Test échoue avec « Resend non configuré » | Domaine d'envoi non vérifié | Finir la **checklist avant lancement** (étapes 2 et 3) |
| Aucun email reçu malgré « succès » | Adresse / spam | Vérifier les spams, puis l'adresse du profil artisan |
| L'email part deux fois | Anti-doublon contourné (réglage modifié) | Vérifier les colonnes de repère du profil (jour/heure/dernier envoi) |
| HTTP 401/403 | URL incorrecte ou fonction protégée | Le slug doit exister et la fonction avoir `verify_jwt = false` |

---

## 7. Les méthodes de branchement

### 7.1 Récupérer les URLs

Les URLs exactes se construisent toutes de la même façon, à partir du nom de la fonction
(voir le tableau du §4). Des fichiers déjà remplis (`.sh`, `.yml`, `.txt`) sont fournis
dans `docs/cron/`.

Format : `https://vbje6pqzh6ug1flwt901.helloreaddy.com/functions/v1/<nom-fonction>`

### 7.2 Option A — script cron serveur (.sh) / NAS

Un script prêt à l'emploi est fourni : **`docs/cron/automatisations-artiflow.sh`**.

1. Copier le script sur ton serveur/NAS, ex. `/opt/artiflow/automatisations-artiflow.sh`
2. Le rendre exécutable : `chmod +x /opt/artiflow/automatisations-artiflow.sh`
3. Ouvrir la crontab : `crontab -e`
4. Ajouter **une seule ligne** (appel toutes les heures) :
   ```
   0 * * * * /opt/artiflow/automatisations-artiflow.sh >> /var/log/artiflow.log 2>&1
   ```
5. Enregistrer. Le script appelle **les 25 fonctions** ; chacune n'expédie qu'au bon moment.

Le script utilise par défaut le domaine réel du Backend et permet de le surcharger via la
variable d'environnement `BACKEND_HOST` si besoin.

> Sur un **NAS** (Synology/QNAP), équivalent : crée une **tâche planifiée** « définie par
> l'utilisateur », exécution toutes les heures, commande = le chemin du script.

### 7.3 Option B — cron-job.org (100 % déporté, gratuit)

1. Créer un compte gratuit sur **cron-job.org**
2. Pour chaque fonction du tableau du §4 : **Create cronjob**
   - **Title** : le nom de la fonction
   - **URL** : l'URL de la fonction (voir §7.1)
   - **Schedule** : saisir l'expression cron (ex. `0 * * * *`)
   - **Request method** : `POST`
   - Onglet **Advanced → Headers** : ajouter `Content-Type: application/json`
   - Enregistrer
3. Cliquer **Test run** sur une tâche : la réponse doit être `200`

> Le fichier **`.txt`** fourni dans `docs/cron/` contient déjà la liste complète des
> valeurs à saisir, tâche par tâche.

### 7.4 Option C — GitHub Actions

Un modèle prêt à l'emploi est fourni : **`docs/cron/github-actions-automatisations.yml`**.

1. Copier ce fichier dans ton dépôt sous `.github/workflows/automatisations.yml`
2. Remplacer `BACKEND_HOST` par le domaine du Backend :
   `vbje6pqzh6ug1flwt901.helloreaddy.com`
3. Pousser : GitHub déclenchera automatiquement les appels aux heures prévues

> GitHub Actions peut parfois décaler les crons de quelques minutes en période de forte charge :
> sans conséquence ici, les fonctions revérifient l'heure avant d'envoyer.

### 7.5 Vérifier

Retourner dans **Espace artisan → Envois automatiques** : les cartes doivent passer au vert au fil des premiers passages (voir §5).

---

## 8. À retenir

- Les tâches planifiées ne **créent** rien : elles **appellent** des fonctions déjà prêtes.
- Sans elles : le produit reste une super app **manuelle**.
- Avec elles : **tout s'allume** — relances, récaps, alertes, journal comptable partent seuls.
- Il y a **25** fonctions à brancher (dont `rappeler-suppressions-prochaines` pour les rappels J-7 / J-1, et `purger-comptes-supprimes`, indispensable pour que la suppression de compte programmée à J+30 soit réellement exécutée).

👉 Une fois ces tâches créées et au vert, la Phase « automatisations » est **terminée à 100 %**.