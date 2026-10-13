/**
 * Suivi de l'ancienneté et de l'historique des changements de mot de passe d'un compte.
 *
 * On combine plusieurs sources pour estimer la date du dernier changement :
 * - l'historique des changements enregistré dans le profil (côté Backend) ;
 * - un historique mémorisé localement, écrit à chaque changement fait depuis l'espace ;
 * - la date `updated_at` de l'utilisateur côté Backend (mise à jour lors d'un changement
 *   de mot de passe, y compris via le lien de réinitialisation par email).
 *
 * On retient toujours la plus récente des dates, pour rester juste quel que soit le chemin
 * emprunté par le changement.
 */

import { downloadCsv, toCsv } from "@/lib/csv";

/** Seuil (en jours) au-delà duquel on considère le mot de passe comme ancien. */
export const SEUIL_ANCIENNETE_MOT_DE_PASSE_JOURS = 180;

/** Nombre maximal de dates conservées dans l'historique. */
export const MAX_HISTORIQUE_MOT_DE_PASSE = 20;

const CLE_PREFIXE = "artiflow_mdp_change_le";

function cle(userId: string): string {
  return `${CLE_PREFIXE}:${userId}`;
}

/**
 * Lit l'historique local brut pour un utilisateur. Gère l'ancien format (une seule date
 * stockée comme chaîne) et le nouveau (un tableau JSON de dates).
 */
function lireBrutLocal(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(cle(userId));
    if (!raw) return [];
    if (raw.trim().startsWith("[")) {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
    }
    return [raw];
  } catch {
    return [];
  }
}

/** Mémorise le changement de mot de passe (maintenant) dans l'historique local de l'utilisateur. */
export function marquerMotDePasseChange(userId: string): void {
  const liste = [new Date().toISOString(), ...lireBrutLocal(userId)].slice(0, MAX_HISTORIQUE_MOT_DE_PASSE);
  try {
    window.localStorage.setItem(cle(userId), JSON.stringify(liste));
  } catch {
    /* stockage indisponible : on ignore, la date Backend prendra le relais */
  }
}

/** Date (ISO) du dernier changement mémorisé localement, ou null. */
export function lireDerniereMajMotDePasse(userId: string): string | null {
  return lireBrutLocal(userId)[0] ?? null;
}

/** Historique local complet des changements (du plus récent au plus ancien). */
export function lireHistoriqueLocal(userId: string): string[] {
  return lireBrutLocal(userId);
}

/**
 * Fusionne plusieurs historiques de dates (déduplique, ignore les valeurs invalides)
 * et renvoie le résultat trié du plus récent au plus ancien.
 */
export function fusionnerHistorique(...listes: (string[] | null | undefined)[]): string[] {
  const vues = new Set<string>();
  listes.forEach((liste) => {
    (liste ?? []).forEach((d) => {
      if (d && !Number.isNaN(new Date(d).getTime())) vues.add(d);
    });
  });
  return Array.from(vues).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
}

/** Nombre de jours entiers écoulés depuis une date ISO, ou null si la date est invalide. */
export function joursDepuis(dateISO: string | null | undefined): number | null {
  if (!dateISO) return null;
  const t = new Date(dateISO).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

/** Retourne la date la plus récente parmi celles fournies (ignore les valeurs invalides). */
export function dateLaPlusRecente(...dates: (string | null | undefined)[]): string | null {
  let meilleur: string | null = null;
  let meilleurT = -Infinity;
  dates.forEach((d) => {
    if (!d) return;
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) return;
    if (t > meilleurT) {
      meilleurT = t;
      meilleur = d;
    }
  });
  return meilleur;
}

/** Formule l'ancienneté en clair à partir d'un nombre de jours (« environ 6 mois », « plus d'un an »). */
export function libelleAnciennete(jours: number): string {
  if (jours >= 365) return "plus d'un an";
  const mois = Math.max(1, Math.round(jours / 30));
  return mois <= 1 ? "environ un mois" : `environ ${mois} mois`;
}

/**
 * Exporte l'historique des changements de mot de passe au format CSV (une ligne par
 * changement : date, heure et ancienneté en jours). Compatible Excel (séparateur « ; »).
 */
export function exporterHistoriqueMotDePasse(historique: string[]): void {
  const rows = historique.map((iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return [iso, "", ""];
    return [
      d.toLocaleDateString("fr-FR"),
      d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      String(joursDepuis(iso) ?? ""),
    ];
  });
  const csv = toCsv(["Date du changement", "Heure", "Ancienneté (jours)"], rows);
  downloadCsv(`historique-mot-de-passe-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}