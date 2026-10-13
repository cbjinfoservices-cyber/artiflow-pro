/**
 * Historique des exports de données (sauvegardes) réalisés par l'artisan.
 *
 * À chaque export effectué (depuis le menu du compte, le tableau de bord ou les préférences),
 * on ajoute une entrée : date, format, nombre de catégories, nombre de lignes et taille de
 * l'archive. Ce journal permet de savoir quand on a sauvegardé, sous quel format, et à quoi
 * cela ressemblait — bien plus utile qu'un simple « dernier export ».
 *
 * Purement un réglage d'affichage local (aucune donnée métier), passé par le module central
 * `stockageLocal`. On conserve les 24 dernières entrées.
 */

import { cleArtiflow, ecrireJson, lireJson, v } from "@/lib/stockageLocal";
import type { FormatExportDonnees } from "@/lib/exportDonneesPersonnelles";

/** Une entrée du journal des exports. */
export interface EntreeHistoriqueExport {
  /** Date ISO de l'export. */
  date: string;
  /** Format produit (« csv », « json » ou « complet »). */
  format: FormatExportDonnees;
  /** Nombre de catégories (tables non vides) exportées. */
  tables: number;
  /** Nombre total de lignes exportées. */
  lignes: number;
  /** Taille de l'archive en octets. */
  taille: number;
  /** Nom du fichier téléchargé. */
  nom: string;
}

const CLE = cleArtiflow("export", "historique");
/** Nombre maximal d'entrées conservées (les plus récentes d'abord). */
const MAX = 24;

const FORMATS: readonly FormatExportDonnees[] = ["csv", "json", "complet"];

/** Valide une entrée lue (retombe sur des valeurs sûres si la donnée est abîmée). */
const entreeValider = v.objetPartiel<EntreeHistoriqueExport>(
  {
    date: v.chaine("", { videOk: true }),
    format: v.enumeration(FORMATS, "csv"),
    tables: v.nombre(0, { min: 0, entier: true, ramener: true }),
    lignes: v.nombre(0, { min: 0, entier: true, ramener: true }),
    taille: v.nombre(0, { min: 0, entier: true, ramener: true }),
    nom: v.chaine("", { videOk: true }),
  },
  { date: "", format: "csv", tables: 0, lignes: 0, taille: 0, nom: "" },
);

/** Valide la liste complète et écarte les entrées vides / corrompues. */
function listeValider(brut: unknown): EntreeHistoriqueExport[] {
  if (!Array.isArray(brut)) return [];
  return brut.map((entree) => entreeValider(entree)).filter((entree) => entree.date !== "");
}

/** Lit l'historique des exports, du plus récent au plus ancien. */
export function lireHistoriqueExports(): EntreeHistoriqueExport[] {
  return lireJson(CLE, listeValider).sort((a, b) => b.date.localeCompare(a.date));
}

/** Ajoute un export à l'historique (et ne garde que les plus récents). */
export function ajouterExportHistorique(entree: EntreeHistoriqueExport): void {
  const liste = [entree, ...lireHistoriqueExports()].slice(0, MAX);
  ecrireJson(CLE, liste);
}

/** Vide complètement l'historique des exports. */
export function viderHistoriqueExports(): void {
  ecrireJson(CLE, []);
}

/** Date ISO du dernier export enregistré dans l'historique, ou `null`. */
export function dateDernierExportHistorique(): string | null {
  const [premier] = lireHistoriqueExports();
  return premier ? premier.date : null;
}

/** Formate une taille en octets en texte lisible (o / Ko / Mo). */
export function tailleLisible(octets: number): string {
  if (!Number.isFinite(octets) || octets <= 0) return "0 o";
  if (octets < 1024) return `${Math.round(octets)} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}