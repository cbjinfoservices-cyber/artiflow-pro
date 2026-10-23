import { useMemo } from "react";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import { iconeMotif, poidsPeriode, suffixePeriode, type Indisponibilite, type PeriodeAbsence } from "@/lib/indisponibilites";
import { addDays, formatShortDate, toISODate } from "@/lib/dates";

/** Période d'absence fusionnée (jours consécutifs d'un même motif pour une personne). */
export interface PeriodeAbsenceGroupee {
  cle: string;
  intervenantId: number | null;
  motif: string;
  note: string | null;
  debut: string;
  fin: string;
  /** Jours décomptés (0,5 pour une demi-journée). */
  jours: number;
  /** Portion de journée (journée entière, matin ou après-midi). */
  periode: PeriodeAbsence;
  /** Identifiants des jours, pour retirer ou déplacer l'absence entière. */
  ids: number[];
}

/** Fusionne les jours consécutifs d'une même absence en une seule ligne lisible. */
function regrouper(liste: Indisponibilite[]): PeriodeAbsenceGroupee[] {
  const tri = [...liste].sort((a, b) => a.date.localeCompare(b.date));
  const periodes: PeriodeAbsenceGroupee[] = [];
  tri.forEach((item) => {
    const derniere = periodes.find(
      (p) =>
        p.intervenantId === item.intervenant_id &&
        p.motif === item.motif &&
        p.periode === item.periode &&
        addDays(new Date(`${p.fin}T00:00:00`), 1).getTime() === new Date(`${item.date}T00:00:00`).getTime(),
    );
    if (derniere) {
      derniere.fin = item.date;
      derniere.jours = Math.round((derniere.jours + poidsPeriode(item.periode)) * 10) / 10;
      derniere.ids.push(item.id);
      return;
    }
    periodes.push({
      cle: `${item.intervenant_id ?? "equipe"}-${item.motif}-${item.periode}-${item.date}`,
      intervenantId: item.intervenant_id,
      motif: item.motif,
      note: item.note,
      debut: item.date,
      fin: item.date,
      jours: poidsPeriode(item.periode),
      periode: item.periode,
      ids: [item.id],
    });
  });
  return periodes;
}

/**
 * Récapitulatif des absences du mois affiché : une ligne par période (congé du 12 au 18,
 * formation le 3…), avec la personne, la durée et un bouton pour lever l'absence.
 */
export default function AbsencesMoisCard({
  indisponibilites,
  intervenants,
  onAjouter,
  onSupprimer,
  onModifier,
}: {
  indisponibilites: Indisponibilite[];
  intervenants: Intervenant[];
  onAjouter: () => void;
  /** Retire l'absence (toutes les journées de la période). */
  onSupprimer: (ids: number[]) => void;
  /** Ouvre la modification de l'absence (motif, période, demi-journée). */
  onModifier?: (periode: PeriodeAbsenceGroupee) => void;
}) {
  const intervenantParId = useMemo(() => {
    const map = new Map<number, Intervenant>();
    intervenants.forEach((i) => map.set(i.id, i));
    return map;
  }, [intervenants]);

  const periodes = useMemo(() => regrouper(indisponibilites), [indisponibilites]);
  const totalJours = Math.round(
    indisponibilites.reduce((acc, i) => acc + poidsPeriode(i.periode), 0) * 10,
  ) / 10;
  const aujourdHui = toISODate(new Date());

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <i className="ri-suitcase-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">Congés et indisponibilités</p>
            <p className="text-[11px] text-foreground-500">
              {totalJours === 0
                ? "Aucune absence posée sur ce mois."
                : `${totalJours} jour${totalJours > 1 ? "s" : ""} d'absence sur la période affichée`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAjouter}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-700 transition-colors"
        >
          <i className="ri-calendar-close-line"></i>
          Poser un congé
        </button>
      </div>

      {periodes.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {periodes.map((p) => {
            const interv = p.intervenantId !== null ? intervenantParId.get(p.intervenantId) : undefined;
            const enCours = aujourdHui >= p.debut && aujourdHui <= p.fin;
            return (
              <div
                key={p.cle}
                title={p.note ?? undefined}
                className={`inline-flex items-center gap-2 pl-2.5 pr-1.5 h-9 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
                  enCours ? "bg-accent-100 border-accent-300 text-accent-900" : "bg-background-50 border-background-200 text-foreground-700"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: interv ? couleurIntervenant(interv.couleur) : "#a8a29e" }}
                />
                <i className={`${iconeMotif(p.motif)} text-foreground-400`}></i>
                <span className="font-bold">{interv?.nom ?? "Équipe"}</span>
                <span className="text-foreground-500">· {p.motif}{suffixePeriode(p.periode)}</span>
                <span className="text-foreground-500">
                  {p.debut === p.fin
                    ? formatShortDate(p.debut)
                    : `${formatShortDate(p.debut)} → ${formatShortDate(p.fin)}`}
                </span>
                {enCours && <span className="text-accent-700">en cours</span>}
                {onModifier && p.intervenantId !== null && (
                  <button
                    type="button"
                    onClick={() => onModifier(p)}
                    title="Modifier cette absence (motif, période, demi-journée)"
                    aria-label={`Modifier l'absence de ${interv?.nom ?? "l'équipe"}`}
                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-background-200 hover:text-primary-700 cursor-pointer transition-colors"
                  >
                    <i className="ri-pencil-line text-[12px]"></i>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSupprimer(p.ids)}
                  title="Lever cette absence"
                  aria-label={`Lever l'absence de ${interv?.nom ?? "l'équipe"}`}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-background-200 hover:text-red-600 cursor-pointer transition-colors"
                >
                  <i className="ri-close-line text-[13px]"></i>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}