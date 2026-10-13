/**
 * Rappel mensuel « Pensez à exporter vos données ».
 *
 * Petit garde-fou d'affichage propre au poste et au navigateur : il invite l'artisan à faire sa
 * sauvegarde une fois par mois, sans jamais devenir envahissant. On retient le **mois** pour
 * lequel le rappel a déjà été vu (masqué ou export effectué) : le rappel réapparaît donc au
 * changement de mois, et disparaît dès qu'un export est fait depuis l'espace.
 *
 * Purement un réglage d'affichage, sans aucune donnée métier. Passe par le module central
 * `stockageLocal` (jamais d'accès direct à `localStorage`).
 */

import { cleArtiflow, ecrireJson, lireJson, v } from "@/lib/stockageLocal";

const CLE = cleArtiflow("dashboard", "rappel-export");

/** État mémorisé du rappel (mois déjà traité + date du dernier export). */
interface EtatRappelExport {
  /** Mois « AAAA-MM » pour lequel le rappel a déjà été vu (masqué ou export fait). Vide = jamais. */
  moisVu: string;
  /** Date ISO du dernier export de données effectué depuis l'espace. Vide = jamais. */
  dernierExport: string;
}

const DEFAUT: EtatRappelExport = { moisVu: "", dernierExport: "" };

const valider = v.objetPartiel<EtatRappelExport>(
  {
    moisVu: v.chaine("", { videOk: true }),
    dernierExport: v.chaine("", { videOk: true }),
  },
  DEFAUT,
);

/** Mois courant au format « AAAA-MM » (heure locale). */
export function moisCourant(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Lit l'état mémorisé du rappel. */
function lireEtat(): EtatRappelExport {
  return lireJson(CLE, valider);
}

/** Le rappel du mois doit-il être affiché ? (Oui tant qu'aucun export ni masquage pour ce mois.) */
export function rappelExportVisible(): boolean {
  return lireEtat().moisVu !== moisCourant();
}

/** Masque le rappel pour le mois en cours (il reviendra le mois prochain). */
export function masquerRappelExport(): void {
  ecrireJson(CLE, { ...lireEtat(), moisVu: moisCourant() });
}

/** Enregistre qu'un export vient d'être effectué (repousse aussi le rappel au mois suivant). */
export function noterExportEffectue(): void {
  ecrireJson(CLE, { moisVu: moisCourant(), dernierExport: new Date().toISOString() });
}

/** Date ISO du dernier export connu, ou `null` s'il n'y en a jamais eu. */
export function dernierExportDonnees(): string | null {
  const { dernierExport } = lireEtat();
  return dernierExport || null;
}

/** Nombre de jours écoulés depuis le dernier export, ou `null` s'il n'y en a jamais eu. */
export function joursDepuisDernierExport(): number | null {
  const iso = dernierExportDonnees();
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000)));
}

/** Oublie tout état du rappel : il se réaffichera à la prochaine visite. */
export function reinitialiserRappelExport(): void {
  ecrireJson(CLE, DEFAUT);
}