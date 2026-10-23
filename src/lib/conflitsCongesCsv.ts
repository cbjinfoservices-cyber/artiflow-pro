import { downloadCsv, toCsv } from "@/lib/csv";
import { cleAlerteConflit, type AlerteConflitHistorique } from "@/lib/conflitsCongesApi";
import type { ConflitConge } from "@/lib/conflitsConges";
import { libellePeriode } from "@/lib/indisponibilites";
import { toISODate } from "@/lib/dates";

/** Formate une date ISO en « 21/10/2026 à 14:02 », ou une chaîne vide. */
function dateHeureFr(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Construit le CSV de la liste des conflits de congé, prêt pour la réunion d'équipe :
 * une ligne par intervention à réaffecter, avec la personne absente, le motif, le statut
 * de traitement et le rappel de l'alerte email envoyée au responsable.
 */
export function buildConflitsCongesCsv(
  conflits: ConflitConge[],
  alertes: Map<string, AlerteConflitHistorique>,
  traites: Map<string, string>,
): string {
  const rows = conflits.map((conflit) => {
    const cle = cleAlerteConflit(conflit.creneau.id, conflit.creneau.intervenant_id);
    const alerte = alertes.get(cle);
    const traiteLe = traites.get(cle);
    return [
      conflit.creneau.date,
      conflit.creneau.heure.slice(0, 5),
      conflit.creneau.libelle,
      conflit.creneau.ville || "Lieu à définir",
      conflit.intervenant?.nom ?? "Intervenant supprimé",
      conflit.absence.motif,
      libellePeriode(conflit.absence.periode),
      traiteLe ? "Traitée" : "À réaffecter",
      dateHeureFr(traiteLe),
      alerte ? "Oui" : "Non",
      alerte?.destinataire ?? "",
      dateHeureFr(alerte?.createdAt),
      alerte && alerte.statut.toLowerCase() !== "envoye" ? "Échec" : alerte ? "Envoyée" : "",
    ];
  });

  const restants = conflits.filter(
    (c) => !traites.get(cleAlerteConflit(c.creneau.id, c.creneau.intervenant_id)),
  ).length;

  rows.push([
    "Total",
    "",
    `${conflits.length} conflit${conflits.length > 1 ? "s" : ""}`,
    "",
    "",
    "",
    "",
    `${restants} à réaffecter`,
    "",
    "",
    "",
    "",
    "",
  ]);

  return toCsv(
    [
      "Date",
      "Heure",
      "Intervention",
      "Lieu",
      "Personne absente",
      "Motif de l'absence",
      "Période",
      "Statut",
      "Traitée le",
      "Alerte responsable",
      "Destinataire",
      "Alerte envoyée le",
      "État de l'alerte",
    ],
    rows,
  );
}

/** Télécharge la liste des conflits de congé au format CSV (Excel FR, séparateur point-virgule). */
export function telechargerConflitsCongesCsv(
  conflits: ConflitConge[],
  alertes: Map<string, AlerteConflitHistorique>,
  traites: Map<string, string>,
): void {
  const contenu = buildConflitsCongesCsv(conflits, alertes, traites);
  downloadCsv(`conflits-conges-${toISODate(new Date())}.csv`, contenu);
}