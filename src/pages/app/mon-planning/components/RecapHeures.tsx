import { useEffect, useState } from "react";
import { formatDuree, recapParJour, totalMinutes, type Pointage } from "@/lib/pointage";
import { formatDayName } from "@/lib/dates";

/**
 * Récapitulatif des heures pointées sur la semaine affichée : total par jour, total de la
 * semaine et repère des interventions encore en cours. Les heures d'une intervention en
 * cours avancent toutes seules (rafraîchissement chaque minute).
 */
export default function RecapHeures({
  pointages,
  jours,
  isoList,
  labelSemaine,
}: {
  /** Pointages de la personne (toutes semaines confondues). */
  pointages: Pointage[];
  /** Les 7 jours de la semaine affichée. */
  jours: Date[];
  /** Les mêmes jours, en ISO (AAAA-MM-JJ). */
  isoList: string[];
  labelSemaine: string;
}) {
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setMaintenant(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const parJour = recapParJour(pointages, isoList, maintenant);
  const totalSemaine = parJour.reduce((somme, j) => somme + j.minutes, 0);
  const nbPointes = parJour.reduce((somme, j) => somme + j.nbPointages, 0);
  const enCours = parJour.some((j) => j.enCours);
  const maxJour = Math.max(1, ...parJour.map((j) => j.minutes));
  const dejaPointe = totalMinutes(pointages.filter((p) => isoList.includes(p.date)), maintenant) > 0;

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <i className="ri-timer-line text-lg"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">Heures pointées</p>
            <p className="text-[11px] text-foreground-500 truncate">{labelSemaine}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {enCours && (
            <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-accent-500 text-background-50 text-[11px] font-bold whitespace-nowrap">
              <i className="ri-timer-flash-line"></i>
              Pointage en cours
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary-100 text-primary-800 text-xs font-semibold whitespace-nowrap">
            <i className="ri-calendar-check-line"></i>
            {totalSemaine > 0 ? `${formatDuree(totalSemaine)} cette semaine` : "Aucune heure pointée"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {parJour.map((jour, i) => (
          <div
            key={jour.date}
            className={`rounded-md border p-2.5 ${
              jour.enCours
                ? "bg-accent-100 border-accent-200"
                : jour.minutes > 0
                  ? "bg-background-50 border-background-200"
                  : "bg-background-50/60 border-background-200"
            }`}
          >
            <p className="text-[10px] uppercase tracking-wide font-semibold text-foreground-400">
              {formatDayName(jours[i]).slice(0, 3)} {jours[i].getDate()}
            </p>
            <p
              className={`text-sm font-bold tabular-nums ${
                jour.minutes > 0 ? "text-foreground-950" : "text-foreground-400"
              }`}
            >
              {jour.minutes > 0 ? formatDuree(jour.minutes) : "—"}
            </p>
            <div className="mt-1.5 h-1.5 rounded-full bg-background-200 overflow-hidden">
              <div
                className={`h-full rounded-full ${jour.enCours ? "bg-accent-500" : "bg-primary-500"}`}
                style={{ width: `${Math.round((jour.minutes / maxJour) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-foreground-500">
              {jour.nbPointages === 0
                ? "non pointé"
                : `${jour.nbPointages} intervention${jour.nbPointages > 1 ? "s" : ""}`}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-foreground-500 inline-flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5"></i>
        <span>
          {dejaPointe
            ? `${nbPointes} intervention${nbPointes > 1 ? "s pointées" : " pointée"} cette semaine. Le total du jour se met à jour automatiquement à chaque pointage, pause déduite.`
            : "Pointez votre arrivée et votre départ sur chaque intervention : le total du jour se calcule automatiquement, pause déduite."}
        </span>
      </p>
    </div>
  );
}