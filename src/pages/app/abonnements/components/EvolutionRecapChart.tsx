import { useMemo } from "react";
import { formatShortDate } from "@/lib/dates";
import type { RecapRecontactEnvoi } from "@/lib/recontactSeuil";

interface Props {
  /** Envois du plus récent au plus ancien (ordre de l'historique). */
  items: RecapRecontactEnvoi[];
}

/**
 * Mini-graphe de l'évolution du nombre de comptes concernés par les récaps hebdomadaires,
 * semaine après semaine. Rendu 100 % CSS (barres proportionnelles), sans dépendance graphique.
 */
export default function EvolutionRecapChart({ items }: Props) {
  // Chronologique (du plus ancien au plus récent) pour lire une progression de gauche à droite.
  const chrono = useMemo(() => [...items].slice().reverse(), [items]);

  if (chrono.length === 0) return null;

  const max = Math.max(1, ...chrono.map((e) => e.nbComptes));
  const total = chrono.reduce((s, e) => s + e.nbComptes, 0);
  const moyenne = total / chrono.length;
  const dernier = chrono[chrono.length - 1].nbComptes;
  const precedent = chrono.length > 1 ? chrono[chrono.length - 2].nbComptes : null;
  const delta = precedent === null ? null : dernier - precedent;

  const tone =
    delta === null || delta === 0
      ? "text-foreground-500"
      : delta > 0
        ? "text-red-600"
        : "text-accent-700";

  return (
    <div className="px-5 py-4 border-b border-background-200 bg-background-50">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
          <i className="ri-line-chart-line text-accent-600"></i>
          Évolution semaine après semaine
        </span>
        <span className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="text-foreground-500">
            Moyenne <strong className="text-foreground-900">{moyenne.toFixed(1)}</strong> comptes / envoi
          </span>
          {delta !== null && (
            <span className={`inline-flex items-center gap-1 font-semibold ${tone}`}>
              <i className={delta > 0 ? "ri-arrow-up-line" : delta < 0 ? "ri-arrow-down-line" : "ri-subtract-line"}></i>
              {delta > 0 ? `+${delta}` : delta} vs envoi précédent
            </span>
          )}
        </span>
      </div>

      <div className="flex items-end gap-1.5 h-20" role="img" aria-label="Évolution du nombre de comptes concernés par envoi">
        {chrono.map((e) => {
          const hauteur = e.nbComptes <= 0 ? 3 : Math.max(8, Math.round((e.nbComptes / max) * 72));
          return (
            <span
              key={e.id}
              className="group/bar relative flex-1 min-w-0 flex flex-col items-center justify-end h-full"
              title={`${formatShortDate(e.envoyeLe)} · ${e.nbComptes} compte${e.nbComptes > 1 ? "s" : ""} concerné${
                e.nbComptes > 1 ? "s" : ""
              }${e.origine === "test" ? " (test manuel)" : ""}`}
            >
              <span className="text-[9px] font-bold text-foreground-500 mb-1 tabular-nums">{e.nbComptes}</span>
              <span
                className={`w-full max-w-[26px] rounded-t-sm rounded-b-sm transition-colors ${
                  e.origine === "test"
                    ? "bg-secondary-400 group-hover/bar:bg-secondary-500"
                    : "bg-accent-400 group-hover/bar:bg-accent-600"
                }`}
                style={{ height: `${hauteur}px` }}
              />
            </span>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-1.5 text-[10px] text-foreground-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-accent-400 inline-block"></span>
          Envoi planifié
          <span className="w-2.5 h-2.5 rounded-sm bg-secondary-400 inline-block ml-1"></span>
          Test manuel
        </span>
        <span className="whitespace-nowrap">
          {formatShortDate(chrono[0].envoyeLe)} → {formatShortDate(chrono[chrono.length - 1].envoyeLe)}
        </span>
      </div>
    </div>
  );
}