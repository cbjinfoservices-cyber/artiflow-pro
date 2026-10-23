import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import { iconeMotif, suffixePeriode, type Indisponibilite } from "@/lib/indisponibilites";

/**
 * Bandeau « Absences ce jour » : rappelle qui est en congé (ou en formation, en arrêt…)
 * à la date affichée. Utilisé par la vue Jour du planning d'équipe et par le planning
 * personnel de l'intervenant, pour que les absences ne soient jamais oubliées.
 */
export default function AbsencesJourCard({
  absences,
  intervenants,
  titre = "Absences ce jour",
  onSupprimer,
  onAjouter,
  onModifier,
}: {
  absences: Indisponibilite[];
  intervenants: Intervenant[];
  titre?: string;
  /** Retire une absence (réservé au responsable). */
  onSupprimer?: (id: number) => void;
  /** Ouvre « Poser un congé » (réservé au responsable). */
  onAjouter?: () => void;
  /** Ouvre la modification de cette absence (motif, période, demi-journée). */
  onModifier?: (absence: Indisponibilite) => void;
}) {
  if (absences.length === 0) return null;

  const nomDe = (id: number | null): string => {
    if (id === null) return "Toute l'équipe";
    return intervenants.find((i) => i.id === id)?.nom ?? "Intervenant";
  };
  const couleurDe = (id: number | null): string => {
    if (id === null) return "#a8a29e";
    return couleurIntervenant(intervenants.find((i) => i.id === id)?.couleur ?? null);
  };

  return (
    <div className="rounded-lg bg-accent-100/70 border border-accent-200 p-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
            <i className="ri-suitcase-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">{titre}</p>
            <p className="text-[11px] text-foreground-600">
              {absences.length} personne{absences.length > 1 ? "s" : ""} à ne pas affecter ce jour.
            </p>
          </div>
        </div>
        {onAjouter && (
          <button
            type="button"
            onClick={onAjouter}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-accent-300 text-accent-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-50 transition-colors"
          >
            <i className="ri-calendar-close-line"></i>
            Poser un congé
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-2.5">
        {absences.map((abs) => (
          <div
            key={abs.id}
            title={abs.note ?? `${abs.motif} — ne pas affecter cette personne`}
            className="inline-flex items-center gap-2 pl-2.5 pr-2 h-9 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-800 whitespace-nowrap"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: couleurDe(abs.intervenant_id) }}
            />
            <i className={`${iconeMotif(abs.motif)} text-accent-700`}></i>
            <span className="font-bold">{nomDe(abs.intervenant_id)}</span>
            <span className="text-foreground-500">· {abs.motif}{suffixePeriode(abs.periode)}</span>
            {abs.note && <span className="text-foreground-400 max-w-[160px] truncate">· {abs.note}</span>}
            {onModifier && abs.intervenant_id !== null && (
              <button
                type="button"
                onClick={() => onModifier(abs)}
                title="Modifier cette absence"
                aria-label={`Modifier l'absence de ${nomDe(abs.intervenant_id)}`}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-background-200 hover:text-primary-700 cursor-pointer transition-colors"
              >
                <i className="ri-pencil-line text-[12px]"></i>
              </button>
            )}
            {onSupprimer && (
              <button
                type="button"
                onClick={() => onSupprimer(abs.id)}
                title="Lever cette absence"
                aria-label={`Lever l'absence de ${nomDe(abs.intervenant_id)}`}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-background-200 hover:text-red-600 cursor-pointer transition-colors"
              >
                <i className="ri-close-line text-[13px]"></i>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}