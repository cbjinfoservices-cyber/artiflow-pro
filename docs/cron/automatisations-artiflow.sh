#!/usr/bin/env bash
# ⏰ Script d'automatisations ArtiFlow-pro — déclencheur cron serveur / NAS
#
# Comment l'utiliser :
#   1. Copie ce fichier sur ton serveur (ex. /opt/artiflow/automatisations-artiflow.sh)
#   2. Rends-le exécutable :  chmod +x /opt/artiflow/automatisations-artiflow.sh
#   3. Ajoute UNE seule ligne à la crontab (crontab -e) :
#        0 * * * * /opt/artiflow/automatisations-artiflow.sh >> /var/log/artiflow.log 2>&1
#
# Pourquoi « toutes les heures » ? Chaque fonction revérifie elle-même le jour/l'heure
# de ses réglages (et son anti-doublon) avant d'envoyer : elle n'expédie qu'au bon moment.
# Les fonctions sont publiques (verify_jwt = false) : aucun secret n'est nécessaire.
#
# Sur un NAS (Synology/QNAP) : crée une « tâche planifiée » définie par l'utilisateur,
# exécution toutes les heures, commande = le chemin de ce script.
#
# Note : les 28 fonctions ci-dessous peuvent toutes être appelées à l'heure (0 * * * *) :
# elles se bloquent elles-mêmes si ce n'est pas le bon moment.

set -u
BACKEND_HOST="${BACKEND_HOST:-vbje6pqzh6ug1flwt901.helloreaddy.com}"

appeler() {
  local slug="$1"
  echo "→ $slug"
  local code
  code=$(curl -s -o /tmp/artiflow-out.json -w "%{http_code}" \
    -X POST "https://${BACKEND_HOST}/functions/v1/${slug}" \
    -H "Content-Type: application/json" -d '')
  echo "  HTTP $code"
  cat /tmp/artiflow-out.json 2>/dev/null || true
  echo
}

echo "=== $(date '+%Y-%m-%d %H:%M:%S') — automatisations ArtiFlow-pro ==="

# Récap quotidien — Récapitulatif quotidien à l'artisan
appeler "recap-quotidien"   # cadence conseillée : 0 * * * *

# Journal comptable mensuel — Journal du mois + régularité au comptable
appeler "envoi-journal-mensuel"   # cadence conseillée : 0 * * * *

# Alerte mois sans envoi — Prévient si un mois attendu reste sans envoi
appeler "relance-envoi-manquant"   # cadence conseillée : 0 8 * * *

# Relances factures en retard — Relance groupée des factures en retard
appeler "relancer-factures-retard"   # cadence conseillée : 0 9 * * *

# Escalade des relances — Escalade des relances clients sans réponse
appeler "escalade-relances"   # cadence conseillée : 0 9 * * *

# Rappel de prélèvement (J-3) — Rappel J-3 avant prélèvement Stripe
appeler "rappel-prelevement-abonnement"   # cadence conseillée : 0 10 * * *

# Rappel fin de période (paiement unique) — Rappel J-7 avant la fin d'une période payée en paiement unique
appeler "rappel-echeance-paiement-unique"   # cadence conseillée : 0 10 * * *

# Récap hebdo des recontacts — Récap des comptes à recontacter
appeler "recap-recontact-volatils"   # cadence conseillée : 0 * * * *

# Récap hebdo des envois auto — Synthèse hebdo des envois automatiques
appeler "recap-hebdo-envois-auto"   # cadence conseillée : 0 * * * *

# Récap hebdo des alertes de taux — Synthèse hebdo des alertes de taux de réussite
appeler "recap-hebdo-alertes-taux"   # cadence conseillée : 0 * * * *

# Récap hebdo des échecs test à blanc — Envoi hebdo du récap d'échecs des rejeux (CSV)
appeler "recap-hebdo-echecs-blanc"   # cadence conseillée : 0 * * * *

# Récap hebdo des échecs de paiement — Synthèse hebdo des échecs de paiement Stripe aux gestionnaires
appeler "recap-hebdo-echecs-paiement"   # cadence conseillée : 0 * * * *

# Récap hebdo des alertes Stripe non traitées — Rappel des alertes de config Stripe encore à traiter
appeler "recap-hebdo-alertes-stripe-non-traitees"   # cadence conseillée : 0 * * * *

# Récap invitations intervenants — Récap hebdo des fiches invitées sans compte à relancer
appeler "recap-invitations-intervenants"   # cadence conseillée : 0 * * * *

# Bilan d'archivage annuel — Bilan annuel d'archivage au comptable
appeler "envoi-bilan-annuel"   # cadence conseillée : 0 7 * * *

# Alerte mot de passe ancien — Prévient l'artisan quand son mot de passe dépasse 6 mois
appeler "alerte-mot-de-passe-ancien"   # cadence conseillée : 0 8 * * *

# Récap mensuel alertes mot de passe — Récap mensuel du nombre d'alertes envoyées
appeler "recap-mensuel-mot-de-passe"   # cadence conseillée : 0 * * * *

# Récap trimestriel alertes mot de passe — Listing trimestriel des récaps au comptable
appeler "recap-trimestriel-mot-de-passe"   # cadence conseillée : 0 * * * *

# Historique annuel des récaps mot de passe — PDF d'historique au comptable
appeler "envoi-recap-mensuel-annuel"   # cadence conseillée : 0 7 * * *

# Comparatif de cadence annuel — Comparatif de cadence des récaps au comptable
appeler "envoi-comparatif-cadence-annuel"   # cadence conseillée : 0 7 * * *

# Régularité annuelle d'archivage des échecs — PDF de régularité d'archivage des récaps d'échecs
appeler "envoi-recap-echecs-annuel"   # cadence conseillée : 0 * * * *

# Export CSV mensuel par email — Réessais + journal d'escalade
appeler "export-csv-mensuel"   # cadence conseillée : 0 * * * *

# Email de bienvenue aux nouveaux pros — Accueille chaque nouvelle inscription (une seule fois)
appeler "envoi-bienvenue-nouveaux-pros"   # cadence conseillée : 0 * * * *

# Rappels avant suppression — Prévient l'artisan à J-7 puis à J-1 avant l'effacement
appeler "rappeler-suppressions-prochaines"   # cadence conseillée : 0 * * * *

# Purge des comptes — Efface réellement les comptes arrivés au terme des 30 jours de grâce
appeler "purger-comptes-supprimes"   # cadence conseillée : 0 * * * *

# Récap hebdo des chantiers — Avancement des chantiers à l'artisan, jour et heure au choix
appeler "recap-hebdo-chantiers"   # cadence conseillée : 0 * * * *

# Nouvelles groupées automatiques — Email groupé aux clients silencieux, fréquence au choix
appeler "envoi-auto-nouvelles-groupees"   # cadence conseillée : 0 * * * *

# Récap mensuel des envois groupés — PDF du mois écoulé au comptable (mode « envoi »)
appeler "recap-envois-groupees-mensuel"   # cadence conseillée : 0 * * * *

echo "=== terminé ==="