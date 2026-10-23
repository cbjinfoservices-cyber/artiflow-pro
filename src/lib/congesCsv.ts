import { downloadCsv, toCsv } from "@/lib/csv";
import type { LigneRecapConges } from "@/lib/indisponibilites";

/** Écrit un nombre de jours au format français (« 12,5 ») pour un tableau Excel FR. */
function nombreFr(valeur: number): string {
  const arrondi = Math.round(valeur * 10) / 10;
  return arrondi.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

/**
 * Construit le CSV du récapitulatif annuel des congés : une ligne par intervenant, avec
 * les jours posés, le droit annuel, les jours restants, les autres absences et le
 * dépassement éventuel. Une ligne de totaux ferme le fichier.
 */
export function buildCongesCsv(lignes: LigneRecapConges[], annee: number): string {
  const totalPoses = Math.round(lignes.reduce((acc, l) => acc + l.congesPoses, 0) * 10) / 10;
  const totalRestants = Math.round(lignes.reduce((acc, l) => acc + l.restants, 0) * 10) / 10;
  const totalAutres = Math.round(lignes.reduce((acc, l) => acc + l.autresAbsences, 0) * 10) / 10;
  const nbDepassements = lignes.filter((l) => l.depassement).length;

  const rows: (string | number)[][] = lignes.map((l) => [
    l.nom,
    annee,
    nombreFr(l.congesPoses),
    nombreFr(l.droit),
    nombreFr(l.restants),
    nombreFr(l.autresAbsences),
    l.depassement ? "Oui" : "Non",
  ]);

  rows.push([
    "Total équipe",
    annee,
    nombreFr(totalPoses),
    "",
    nombreFr(totalRestants),
    nombreFr(totalAutres),
    nbDepassements > 0 ? `${nbDepassements} dépassement${nbDepassements > 1 ? "s" : ""}` : "Non",
  ]);

  return toCsv(
    [
      "Intervenant",
      "Année",
      "Jours de congé posés",
      "Droit annuel (jours ouvrés)",
      "Jours restants",
      "Autres absences (jours)",
      "Dépassement",
    ],
    rows,
  );
}

/** Télécharge le récapitulatif annuel des congés au format CSV (Excel FR). */
export function telechargerCongesCsv(lignes: LigneRecapConges[], annee: number): void {
  downloadCsv(`recap-conges-${annee}.csv`, buildCongesCsv(lignes, annee));
}