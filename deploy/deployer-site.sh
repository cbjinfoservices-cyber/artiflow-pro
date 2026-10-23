#!/usr/bin/env bash
# Met en ligne le site ArtiFlow-pro (site vitrine + espace artisan) sur le VPS.
# Usage, depuis la racine du projet (Git Bash) : bash deploy/deployer-site.sh
# Prérequis : clé SSH ~/.ssh/artiflow_vps_ed25519 (accès root par clé uniquement).
set -euo pipefail

VPS="root@217.160.163.217"
CLE="$HOME/.ssh/artiflow_vps_ed25519"
SSH=(ssh -i "$CLE" -o BatchMode=yes "$VPS")

npx vite build

# Envoi dans un dossier temporaire puis bascule : le site en ligne n'est jamais à moitié copié.
tar -C out -czf - . | "${SSH[@]}" '
  set -e
  rm -rf /opt/artiflow/site.nouveau && mkdir -p /opt/artiflow/site.nouveau
  tar -C /opt/artiflow/site.nouveau -xzf -
  rm -rf /opt/artiflow/site.ancien
  mv /opt/artiflow/site /opt/artiflow/site.ancien
  mv /opt/artiflow/site.nouveau /opt/artiflow/site
  cd /opt/artiflow && docker compose up -d --force-recreate caddy >/dev/null 2>&1
'
echo "Site en ligne : https://artiflow-pro.com (version précédente gardée dans /opt/artiflow/site.ancien)"
