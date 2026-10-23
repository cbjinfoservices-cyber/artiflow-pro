import { useMemo } from "react";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import {
  DROIT_ANNUEL_CONGES_JOURS,
  formatJoursConges,
  recapAnnuelConges,
  type Indisponibilite,
  type LigneRecapConges,
} from "@/lib/indisponibilites";
import { telechargerCongesCsv } from "@/lib/congesCsv";

/**
 * Récapitulatif annuel des congés : une ligne par intervenant avec les jours posés,
 * les jours restants et une jauge par rapport au droit annuel de référence.
 * Sert au responsable pour savoir où en est chaque personne dans l'année, sans calcul.
 */
export default function CongesAnnuelsCard({
  indisponibilites,
  intervenants,
  annee,
  onChangerAnnee,
}: {
  indisponibilites: Indisponibilite[];
  intervenants: Intervenant[];
  annee: number;
  onChangerAnnee: (annee: number) => void;
}) {
  const lignes: LigneRecapConges[] = useMemo(
    () => recapAnnuelConges(indisponibilites, intervenants, annee),
    [indisponibilites, intervenants, annee],
  );

  const totalConges = lignes.reduce((acc, l) => acc + l.congesPoses, 0);
  const totalRestants = lignes.reduce((acc, l) => acc + l.restants, 0);
  const nbDepassement = lignes.filter((l) => l.depassement).length;

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 p-4 md:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800">
            <i className="ri-calendar-todo-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">Récapitulatif annuel des congés</p>
            <p className="text-[11px] text-foreground-500">
              Année {annee} · {formatJoursConges(totalConges)} de congé posé{totalConges > 1 ? "s" : ""} ·{" "}
              {formatJoursConges(totalRestants)} restant{totalRestants > 1 ? "s" : ""} au total
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start flex-wrap">
          <button
            type="button"
            onClick={() => telechargerCongesCsv(lignes, annee)}
            disabled={lignes.length === 0}
            title={`Télécharger le récapitulatif des congés ${annee} au format CSV (Excel)`}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 hover:text-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-file-download-line"></i>
            Export CSV
          </button>

          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-50 border border-background-200">
            <button
              type="button"
              onClick={() => onChangerAnnee(annee - 1)}
              aria-label="Année précédente"
              className="w-7 h-7 flex items-center justify-center rounded-full text-foreground-600 hover:bg-background-200 cursor-pointer transition-colors"
            >
              <i className="ri-arrow-left-s-line"></i>
            </button>
            <span className="min-w-[52px] text-center text-xs font-bold text-foreground-900 tabular-nums">{annee}</span>
            <button
              type="button"
              onClick={() => onChangerAnnee(annee + 1)}
              aria-label="Année suivante"
              className="w-7 h-7 flex items-center justify-center rounded-full text-foreground-600 hover:bg-background-200 cursor-pointer transition-colors"
            >
              <i className="ri-arrow-right-s-line"></i>
            </button>
          </div>
        </div>
      </div>

      {lignes.length === 0 ? (
        <p className="mt-4 text-sm text-foreground-500">
          Ajoutez des intervenants à votre équipe pour suivre leurs congés sur l'année.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {lignes.map((l) => {
            const hex = couleurIntervenant(l.couleur);
            const pct = Math.min(100, Math.round((l.congesPoses / Math.max(1, l.droit)) * 100));
            const jaugeTone = l.depassement
              ? "bg-accent-500"
              : pct >= 80
                ? "bg-secondary-500"
                : "bg-primary-500";
            return (
              <div
                key={l.intervenantId}
                className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4 p-3 rounded-md bg-background-50 border border-background-200"
              >
                <div className="flex items-center gap-2 min-w-0 lg:w-[200px]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                  <span className="text-sm font-semibold text-foreground-900 truncate">{l.nom}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="h-2 rounded-full bg-background-200 overflow-hidden">
                    <div className={`h-full rounded-full ${jaugeTone}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-foreground-500 mt-1">
                    <span>
                      {l.congesPoses} / {l.droit} jours ouvrés
                    </span>
                    {l.autresAbsences > 0 && <span>+ {l.autresAbsences} j autre absence</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-primary-100 text-primary-800 text-[11px] font-semibold whitespace-nowrap">
                    <i className="ri-plane-line"></i>
                    {formatJoursConges(l.congesPoses)} posé{l.congesPoses > 1 ? "s" : ""}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                      l.restants === 0
                        ? "bg-accent-100 text-accent-800"
                        : "bg-secondary-100 text-secondary-900"
                    }`}
                  >
                    <i className={l.restants === 0 ? "ri-error-warning-line" : "ri-checkbox-circle-line"}></i>
                    {formatJoursConges(l.restants)} restant{l.restants > 1 ? "s" : ""}
                  </span>
                  {l.depassement && (
                    <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-accent-500 text-background-50 text-[11px] font-bold whitespace-nowrap">
                      <i className="ri-alert-line"></i>
                      Dépassement
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] text-foreground-500 inline-flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5"></i>
        Le droit annuel de référence est de {DROIT_ANNUEL_CONGES_JOURS} jours ouvrés par personne. Seuls les jours de
        congé sont décomptés ; les formations, arrêts et récupérations sont comptés à part. Les jours tombant un
        week-end ne sont jamais décomptés. L'export CSV reprend ces mêmes chiffres, prêt pour Excel ou pour votre
        comptable.
        {nbDepassement > 0 && (
          <span className="text-accent-700 font-semibold">
            {nbDepassement} personne{nbDepassement > 1 ? "s dépassent" : " dépasse"} son droit.
          </span>
        )}
      </p>
    </div>
  );
}