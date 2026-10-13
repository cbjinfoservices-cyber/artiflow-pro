/**
 * Format d'archive de sauvegarde préféré par l'artisan.
 *
 * Objectif : mémoriser le dernier format choisi (CSV, JSON ou « les deux ») pour le
 * **pré-sélectionner** à chaque ouverture d'un sélecteur d'export (menu du compte, page
 * Préférences…). On évite ainsi de rechoisir systématiquement son format favori.
 *
 * Purement un réglage d'affichage local (aucune donnée métier), passé par le module central
 * `stockageLocal` : une valeur corrompue retombe proprement sur « csv ».
 */

import { cleArtiflow, ecrireJson, lireJson, v } from "@/lib/stockageLocal";
import type { FormatExportDonnees } from "@/lib/exportDonneesPersonnelles";

const CLE = cleArtiflow("export", "formatPrefere");
const FORMATS: readonly FormatExportDonnees[] = ["csv", "json", "complet"];
const DEFAUT: FormatExportDonnees = "csv";

/** Lit le format d'archive préféré (retombe sur « csv » si absent ou abîmé). */
export function lireFormatExportPrefere(): FormatExportDonnees {
  return lireJson(CLE, v.enumeration(FORMATS, DEFAUT));
}

/** Mémorise le format d'archive préféré pour les prochaines ouvertures. */
export function enregistrerFormatExportPrefere(format: FormatExportDonnees): void {
  ecrireJson(CLE, format);
}