import { useMemo, useState } from "react";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import {
  DROIT_ANNUEL_CONGES_JOURS,
  formatJoursConges,
  recapAnnuelConges,
  type Indisponibilite,
} from "@/lib/indisponibilites";

/**
 * Carte « Mon solde de congés » du planning personnel de l'intervenant.
 * Elle reprend le décompte annuel (jours posés / jours restants) déjà utilisé par le
 * responsable, mais à l'échelle d'une seule personne : chacun voit où il en est sans
 * avoir à demander. Les demi-journées comptent pour 0,5 jour.
 */
export default function SoldeCongesCard({
  indisponibilites,
  intervenant,
}: {
  indisponibilites: Indisponibilite[];
  intervenant: Intervenant;
}) {
  const [annee, setAnnee] = useState(() => new Date().getFullYear());

  const ligne = useMemo(() => {
    const [calcul] = recapAnnuelConges(indisponibilites, [intervenant], annee);
    return (
      calcul ?? {
        intervenantId: intervenant.id,
        nom: intervenant.nom,
        couleur: intervenant.couleur,
        congesPoses: 0,
        autresAbsences: 0,
        droit: DROIT_ANNUEL_CONGES_JOURS,
        restants: DROIT_ANNUEL_CONGES_JOURS,
        depassement: false,
      }
    );
  }, [indisponibilites, intervenant, annee]);

  // Nombre de demi-journées de congé posées sur l'année affichée (pour la précision du décompte).
  const demiJournees = useMemo(
    () =>
      indisponibilites.filter(
        (i) =>
          i.intervenant_id === intervenant.id &&
          i.date.startsWith(`${annee}-`) &&
          i.periode !== "journee" &&
          i.motif.trim().toLowerCase().startsWith("cong"),
      ).length,
    [indisponibilites, intervenant.id, annee],
  );

  const pct = Math.min(100, Math.round((ligne.congesPoses / Math.max(1, ligne.droit)) * 100));
  const jauge = ligne.depassement ? "bg-accent-500" : pct >= 80 ? "bg-secondary-500" : "bg-primary-500";

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800">
            <i className="ri-plane-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">Mon solde de congés</p>
            <p className="text-[11px] text-foreground-500 truncate">
              {intervenant.nom} · {annee}
              {demiJournees > 0 ? ` · ${demiJournees} demi-journée${demiJournees > 1 ? "s" : ""}` : ""}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-50 border border-background-200 self-start">
          <button
            type="button"
            onClick={() => setAnnee((a) => a - 1)}
            aria-label="Année précédente"
            className="w-7 h-7 flex items-center justify-center rounded-full text-foreground-600 hover:bg-background-200 cursor-pointer transition-colors"
          >
            <i className="ri-arrow-left-s-line"></i>
          </button>
          <span className="min-w-[52px] text-center text-xs font-bold text-foreground-900 tabular-nums">{annee}</span>
          <button
            type="button"
            onClick={() => setAnnee((a) => a + 1)}
            aria-label="Année suivante"
            className="w-7 h-7 flex items-center justify-center rounded-full text-foreground-600 hover:bg-background-200 cursor-pointer transition-colors"
          >
            <i className="ri-arrow-right-s-line"></i>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
        <div className="rounded-md bg-background-50 border border-background-200 p-3 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-foreground-500">Posés</p>
          <p className="mt-1 text-lg font-bold text-foreground-950 tabular-nums">
            {formatJoursConges(ligne.congesPoses)}
          </p>
        </div>
        <div className="rounded-md bg-background-50 border border-background-200 p-3 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-foreground-500">Restants</p>
          <p
            className={`mt-1 text-lg font-bold tabular-nums ${
              ligne.restants === 0 ? "text-accent-700" : "text-primary-700"
            }`}
          >
            {formatJoursConges(ligne.restants)}
          </p>
        </div>
        <div className="col-span-2 lg:col-span-1 rounded-md bg-background-50 border border-background-200 p-3 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-foreground-500">Droit annuel</p>
          <p className="mt-1 text-lg font-bold text-foreground-950 tabular-nums">{formatJoursConges(ligne.droit)}</p>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-2 rounded-full bg-background-200 overflow-hidden">
          <div className={`h-full rounded-full ${jauge}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5 gap-2 flex-wrap">
          <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: couleurIntervenant(intervenant.couleur) }} />
            {ligne.congesPoses} / {ligne.droit} jours ouvrés consommés
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {ligne.autresAbsences > 0 && (
              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap">
                <i className="ri-graduation-cap-line"></i>
                + {formatJoursConges(ligne.autresAbsences)} (formation, arrêt…)
              </span>
            )}
            {ligne.depassement && (
              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap">
                <i className="ri-alert-line"></i>
                Droit dépassé
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2.5 text-[11px] text-foreground-500 inline-flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5"></i>
        Le droit de référence est de {DROIT_ANNUEL_CONGES_JOURS} jours ouvrés par an. Seuls les congés sont décomptés
        ici ; une demi-journée compte 0,5 jour et les week-ends ne sont jamais décomptés.
      </p>
    </div>
  );
}