import { useState } from "react";
import { usePauseVacances } from "@/hooks/usePauseVacances";
import { PAUSE_DEFAUT, PAUSE_OPTIONS, formatPauseFin } from "@/lib/relances";

/**
 * Panneau « Pause vacances » du tableau de bord : coupe le récapitulatif quotidien ET
 * les relances automatiques pendant un nombre de jours choisi, sans toucher aux autres
 * fonctions. Le réglage est enregistré dans le profil et respecté par les tâches
 * planifiées côté serveur.
 */
export default function PauseVacancesPanel() {
  const { dateFin, actif, joursRestants, activer, lever } = usePauseVacances();
  const [jours, setJours] = useState<number>(PAUSE_DEFAUT);

  return (
    <div
      className={`p-4 rounded-lg border ${
        actif ? "bg-accent-50 border-accent-200" : "bg-background-100 border-background-200"
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-lg ${
              actif ? "bg-accent-100 text-accent-700" : "bg-secondary-100 text-secondary-700"
            }`}
          >
            <i className="ri-flight-takeoff-line"></i>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground-950">Pause vacances</p>
              {actif ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-semibold">
                  <i className="ri-pause-circle-line"></i>
                  Pause active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background-50 text-foreground-500 border border-background-200 text-[10px] font-semibold">
                  <i className="ri-play-circle-line"></i>
                  Reprise normale
                </span>
              )}
            </div>
            <p className="text-xs text-foreground-600 mt-0.5">
              Met en pause le <strong>récap quotidien</strong> et les <strong>relances automatiques</strong> pendant
              votre absence. Vos données restent intactes ; tout reprend tout seul à la fin.
            </p>

            {actif ? (
              <p className="text-xs text-accent-800 mt-2 inline-flex items-center gap-1.5">
                <i className="ri-calendar-check-line"></i>
                En pause jusqu'au <strong>{formatPauseFin(dateFin)}</strong>
                {joursRestants > 0 ? ` · ${joursRestants} jour${joursRestants > 1 ? "s" : ""} restant${joursRestants > 1 ? "s" : ""}` : ""}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[11px] text-foreground-500">Durée de la pause</span>
                <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
                  {PAUSE_OPTIONS.map((j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => setJours(j)}
                      title={`Mettre en pause pendant ${j} jours`}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        jours === j ? "bg-secondary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                      }`}
                    >
                      {j} j
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 w-full lg:w-auto">
          {actif ? (
            <button
              type="button"
              onClick={lever}
              title="Reprendre immédiatement le récap et les relances automatiques"
              className="inline-flex items-center justify-center gap-2 h-10 w-full lg:w-auto px-5 rounded-md bg-background-50 border border-background-200 text-foreground-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
            >
              <i className="ri-play-circle-line"></i>
              Reprendre maintenant
            </button>
          ) : (
            <button
              type="button"
              onClick={() => activer(jours)}
              title={`Mettre en pause le récap et les relances automatiques pendant ${jours} jours`}
              className="inline-flex items-center justify-center gap-2 h-10 w-full lg:w-auto px-5 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
            >
              <i className="ri-flight-takeoff-line"></i>
              Démarrer la pause
            </button>
          )}
        </div>
      </div>
    </div>
  );
}