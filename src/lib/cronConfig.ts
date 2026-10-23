import { TACHES_PLANIFIEES, urlFonction } from "@/lib/tachesPlanifiees";
import { telechargerBlob } from "@/lib/telechargement";

/**
 * Génération des fichiers de configuration « prêts à coller » pour brancher les
 * automatisations (les 16 fonctions) sur un service de cron externe.
 *
 * Deux services sont couverts :
 *   - GitHub Actions  → un fichier YAML à déposer dans .github/workflows/
 *   - cron-job.org    → une liste de tâches à recréer (titre, URL, méthode, cadence)
 * Et un script shell (curl) pour un cron classique (crontab serveur, NAS, etc.).
 *
 * Toutes les valeurs (URLs, hôte, cadences) sont calculées à partir du vrai Backend,
 * il n'y a donc rien à recopier à la main.
 */

/** Nom de fichier du workflow GitHub Actions généré. */
export const CRON_FICHIER_YAML = "automatisations-artiflow.yml";

/** Nom de fichier du script shell généré. */
export const CRON_FICHIER_SH = "automatisations-artiflow.sh";

/** Nom de fichier de la liste cron-job.org générée. */
export const CRON_FICHIER_TXT = "automatisations-cron-job-org.txt";

/** Hôte du Backend, extrait d'une URL de fonction (retombe sur un gabarit si indisponible). */
export function hoteBackend(): string {
  try {
    const host = new URL(urlFonction("recap-quotidien")).host;
    if (host && host !== "undefined" && host !== "null") return host;
  } catch {
    /* URL invalide : on retombe sur le gabarit */
  }
  return "VOTRE-DOMAINE-BACKEND";
}

/** Vrai si l'hôte réel du Backend est connu (sinon le fichier contient un gabarit à remplacer). */
export function hoteBackendConnu(): boolean {
  return hoteBackend() !== "VOTRE-DOMAINE-BACKEND";
}

/**
 * Génère le workflow GitHub Actions appelant les 16 fonctions chaque heure.
 * Chaque fonction revérifie elle-même le jour/l'heure et son anti-doublon avant d'envoyer.
 */
export function genererGithubActions(): string {
  const host = hoteBackend();
  return `# ⏰ Automatisations ArtiFlow-pro — déclencheur GitHub Actions
#
# Comment l'utiliser :
#   1. Dépose ce fichier dans ton dépôt sous : .github/workflows/automatisations-artiflow.yml
#   2. Pousse le fichier : GitHub appellera automatiquement les fonctions.
#
# Pourquoi « toutes les heures » ? Chaque fonction revérifie elle-même le jour/l'heure
# de ses réglages (et son anti-doublon) avant d'envoyer : elle n'expédie qu'au bon moment.
# Les fonctions sont publiques (verify_jwt = false) : aucun secret n'est nécessaire.

name: Automatisations ArtiFlow-pro

on:
  schedule:
    # Toutes les heures, à la minute 0 (UTC).
    - cron: "0 * * * *"
  # Permet aussi de lancer le workflow à la main depuis l'onglet « Actions ».
  workflow_dispatch:

env:
  BACKEND_HOST: "${host}"

jobs:
  declencher:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        fonction:
${TACHES_PLANIFIEES.map((t) => `          - ${t.slug}`).join("\n")}
    steps:
      - name: Appeler \${{ matrix.fonction }}
        run: |
          echo "→ \${{ matrix.fonction }}"
          code=$(curl -s -o /tmp/out.json -w "%{http_code}" \\
            -X POST "https://\${BACKEND_HOST}/functions/v1/\${{ matrix.fonction }}" \\
            -H "Content-Type: application/json" -d '')
          echo "HTTP $code"
          cat /tmp/out.json || true
          if [ "$code" -ge 400 ]; then
            echo "::warning::La fonction \${{ matrix.fonction }} a répondu $code"
          fi
`;
}

/**
 * Génère un script shell (curl) prêt à coller dans un cron serveur, un NAS, etc.
 * Un appel par fonction, tous les heures (« à la minute 0 »).
 */
export function genererScriptShell(): string {
  const lignes = TACHES_PLANIFIEES.map(
    (t) =>
      `# ${t.nom} — ${t.role}\nappeler "${t.slug}"   # cadence conseillée : ${t.cron}`,
  ).join("\n\n");
  return `#!/usr/bin/env bash
# ⏰ Script d'automatisations ArtiFlow-pro
#
# À placer dans la crontab de ton serveur (cron classique), par ex. :
#   0 * * * * /chemin/vers/automatisations-artiflow.sh >> /var/log/artiflow.log 2>&1
#
# Toutes les fonctions revérifient l'heure avant d'envoyer : un appel horaire suffit.

set -u
BACKEND_HOST="\${BACKEND_HOST:-${hoteBackend()}}"

appeler() {
  local slug="$1"
  echo "→ $slug"
  local code
  code=$(curl -s -o /tmp/artiflow-out.json -w "%{http_code}" \\
    -X POST "https://\${BACKEND_HOST}/functions/v1/\${slug}" \\
    -H "Content-Type: application/json" -d '')
  echo "  HTTP $code"
  cat /tmp/artiflow-out.json 2>/dev/null || true
  echo
}

echo "=== $(date '+%Y-%m-%d %H:%M:%S') — automatisations ArtiFlow-pro ==="

${lignes}

echo "=== terminé ==="
`;
}

/**
 * Génère la liste des tâches à créer sur cron-job.org (le plus simple) : pour chaque
 * fonction, le titre, l'URL, la méthode et la cadence à saisir.
 */
export function genererCronJobOrg(): string {
  const host = hoteBackend();
  const blocs = TACHES_PLANIFIEES.map(
    (t, i) => `${i + 1}. ${t.nom}
   Titre       : ${t.nom}
   URL         : https://${host}/functions/v1/${t.slug}
   Méthode     : POST
   Header      : Content-Type: application/json
   Corps       : (vide)
   Cadence     : ${t.cron}   ${t.role}`,
  ).join("\n\n");
  return `⏰ Automatisations ArtiFlow-pro — à créer sur cron-job.org
====================================================================

Mode d'emploi (gratuit) :
  1. Créer un compte sur https://cron-job.org
  2. Pour chaque tâche ci-dessous : « Create cronjob » puis saisir les valeurs indiquées.
  3. Onglet « Advanced » → Headers : ajouter  Content-Type: application/json
  4. Enregistrer, puis « Test run » : la réponse doit être 200.

Astuce : crée d'abord la première, teste-la, puis duplique la méthode pour les autres.
Toutes les fonctions revérifient l'heure avant d'envoyer : une cadence horaire suffit.

--------------------------------------------------------------------
Les ${TACHES_PLANIFIEES.length} tâches à créer
--------------------------------------------------------------------

${blocs}

--------------------------------------------------------------------
Une fois les ${TACHES_PLANIFIEES.length} tâches au vert, les automatisations sont actives.
`;
}

/** Déclenche le téléchargement d'un fichier texte (avec BOM pour un affichage correct). */
export function telechargerTexte(nomFichier: string, contenu: string, typeMime = "text/plain"): void {
  const blob = new Blob([contenu], { type: `${typeMime};charset=utf-8` });
  telechargerBlob(nomFichier, blob);
}