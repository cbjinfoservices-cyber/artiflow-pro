import { iconeMotif, libellePeriode, type AbsenceJourResume } from "@/lib/indisponibilites";
import { toISODate } from "@/lib/dates";

/**
 * Badge affiché sur une intervention dont l'intervenant affecté est absent ce jour-là.
 * Il prévient d'un conflit de planning (« congé à venir ») avant que la personne concernée
 * ne se retrouve avec une mission impossible à assurer.
 */
export default function BadgeAbsenceIntervention({
  absence,
  nom,
  dateISO,
  compact = false,
  onProposerRemplacant,
  onReaffecterLot,
}: {
  /** Absence résumée de l'intervenant sur la journée de l'intervention. */
  absence: AbsenceJourResume | null;
  /** Nom de la personne absente, pour l'infobulle. */
  nom?: string | null;
  /** Jour de l'intervention (AAAA-MM-JJ). */
  dateISO: string;
  /** Version compacte (pastille icône seule), pour les cases très étroites du calendrier. */
  compact?: boolean;
  /**
   * Ouvre la fenêtre « proposer un remplaçant » : depuis le badge, on réaffecte
   * l'intervention en un clic sans quitter la vue en cours.
   */
  onProposerRemplacant?: () => void;
  /**
   * Ouvre la réaffectation en lot de toutes les interventions du jour de la personne absente,
   * directement depuis le badge, sans passer par le filtre « Conflits congé ».
   */
  onReaffecterLot?: () => void;
}) {
  if (!absence) return null;

  const aujourdHui = toISODate(new Date());
  const aVenir = dateISO >= aujourdHui;
  const estConge = absence.motif.trim().toLowerCase().startsWith("cong");
  const label = estConge
    ? aVenir
      ? "Congé à venir"
      : "Congé ce jour"
    : `${absence.motif}${aVenir ? " à venir" : ""}`;
  const titre = `${nom ?? "L'intervenant"} · ${absence.motif} (${libellePeriode(absence.periode)})${
    absence.note ? ` — ${absence.note}` : ""
  }. Pensez à réaffecter cette intervention.`;

  if (compact) {
    return (
      <span
        title={titre}
        aria-label={titre}
        className="inline-flex items-center justify-center w-4 h-4 shrink-0 rounded-full bg-accent-500 text-background-50"
      >
        <i className={`${iconeMotif(absence.motif)} text-[9px]`}></i>
      </span>
    );
  }

  return (
    <span
      title={titre}
      className="inline-flex items-center gap-1 h-5 pl-2 pr-1 rounded-full bg-accent-100 border border-accent-200 text-accent-900 text-[10px] font-bold whitespace-nowrap"
    >
      <i className={`${iconeMotif(absence.motif)} text-[10px]`}></i>
      {label}
      {onProposerRemplacant && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onProposerRemplacant();
          }}
          title="Proposer un remplaçant et réaffecter en un clic"
          aria-label="Proposer un remplaçant pour cette intervention"
          className="w-4 h-4 flex items-center justify-center rounded-full bg-accent-500 text-background-50 hover:bg-accent-600 cursor-pointer transition-colors"
        >
          <i className="ri-user-shared-line text-[9px]"></i>
        </button>
      )}
      {onReaffecterLot && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReaffecterLot();
          }}
          title="Réaffecter en lot toutes ses interventions de la journée"
          aria-label="Réaffecter en lot toutes les interventions du jour de cette personne"
          className="w-4 h-4 flex items-center justify-center rounded-full bg-accent-600 text-background-50 hover:bg-accent-700 cursor-pointer transition-colors"
        >
          <i className="ri-stack-line text-[9px]"></i>
        </button>
      )}
    </span>
  );
}