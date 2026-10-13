import { useMemo } from "react";
import type { RegulariteComptableStats, RegulariteMois } from "@/hooks/useRegulariteComptable";
import { useEvolutionMrrHistorique } from "@/hooks/useEvolutionMrrHistorique";
import { formatEuros } from "@/lib/format";

/** Libellé court d'un mois « AAAA-MM » (« sept. »). */
function moisCourt(cle: string): string {
  const [y, m] = cle.split("-").map(Number);
  if (!y || !m) return cle;
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short" });
}

/** Montant compact pour l'étiquette au-dessus des barres (« 1,2k€ »). */
function compactEuros(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".", ",")}k€`;
  return `${Math.round(n)}€`;
}

/**
 * Graphique d'évolution du MRR et de la régularité comptable sur 6 mois pour la
 * vue d'ensemble Back-office. Le MRR provient de l'historique des changements
 * d'offre ; la régularité (part des artisans suivis ayant envoyé automatiquement
 * leur journal) vient de la fonction Backend réservée aux gestionnaires.
 */
export default function BackOfficeEvolutionCard({
  stats,
  loading,
  error,
  onRetry,
}: {
  stats: RegulariteComptableStats | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const { data: mrrData, loading: mrrLoading, error: mrrError, reload: reloadMrr } = useEvolutionMrrHistorique(6);

  const serie: RegulariteMois[] = useMemo(() => {
    const arr = stats?.serie6mois ?? [];
    return Array.isArray(arr) ? arr : [];
  }, [stats]);

  const reguByMois = useMemo(() => {
    const map: Record<string, RegulariteMois> = {};
    serie.forEach((s) => {
      map[s.mois] = s;
    });
    return map;
  }, [serie]);

  // On s'aligne sur les mois du MRR ; à défaut, sur la série de régularité.
  const cles = useMemo(() => {
    if (mrrData.length) return mrrData.map((m) => m.key);
    return serie.map((s) => s.mois);
  }, [mrrData, serie]);

  const maxMrr = Math.max(...mrrData.map((m) => m.mrr), 1);
  const mrrActuel = mrrData.length ? mrrData[mrrData.length - 1].mrr : 0;
  const mrrPrecedent = mrrData.length >= 2 ? mrrData[mrrData.length - 2].mrr : 0;
  const variation = mrrActuel - mrrPrecedent;
  const variationPct = mrrPrecedent > 0 ? Math.round((variation / mrrPrecedent) * 100) : null;

  const dernierRegu = serie.length ? serie[serie.length - 1] : null;
  const tauxActuel =
    dernierRegu && dernierRegu.attendus > 0 ? Math.round((dernierRegu.artisans / dernierRegu.attendus) * 100) : 0;

  const enChargement = loading || mrrLoading;
  const uneErreur = error || mrrError;
  const vide = !enChargement && !uneErreur && cles.length === 0;

  const recharger = () => {
    onRetry();
    reloadMrr();
  };

  return (
    <div className="flex flex-col rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <i className="ri-line-chart-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">Évolution sur 6 mois</h3>
            <p className="text-[11px] text-foreground-500">MRR et régularité comptable des artisans</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-primary-500"></span>
            MRR
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent-500"></span>
            Régularité (%)
          </span>
        </div>
      </div>

      {enChargement ? (
        <div className="flex items-center justify-center py-16">
          <i className="ri-loader-4-line animate-spin text-xl text-primary-600"></i>
        </div>
      ) : uneErreur ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
          <span className="inline-flex items-center gap-2 text-sm text-foreground-600">
            <i className="ri-error-warning-line text-red-500"></i>
            {uneErreur}
          </span>
          <button
            type="button"
            onClick={recharger}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : vide ? (
        <div className="px-5 py-8 text-center">
          <span className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-background-200 text-foreground-400 text-xl">
            <i className="ri-line-chart-line"></i>
          </span>
          <p className="mt-3 text-sm font-medium text-foreground-700">Pas encore d'historique sur 6 mois</p>
          <p className="mt-1 text-xs text-foreground-500">
            Les courbes apparaîtront dès que des changements d'offre et des envois comptables automatiques seront enregistrés.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-end gap-2 h-44">
            {cles.map((cle) => {
              const mrrPoint = mrrData.find((m) => m.key === cle);
              const mrr = mrrPoint?.mrr ?? 0;
              const delta = mrrPoint?.delta ?? 0;
              const regu = reguByMois[cle];
              const taux = regu && regu.attendus > 0 ? Math.round((regu.artisans / regu.attendus) * 100) : 0;

              const mrrH = Math.max((mrr / maxMrr) * 100, mrr > 0 ? 6 : 2);
              const reguH = Math.max(taux, taux > 0 ? 6 : 2);

              return (
                <div key={cle} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-semibold tabular-nums text-foreground-500">{taux > 0 ? `${taux}%` : ""}</span>
                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    <div
                      className="w-1/2 max-w-5 flex items-end rounded-t-md bg-background-200/50"
                      style={{ height: `${mrrH}%` }}
                      title={`${moisCourt(cle)} · MRR ${formatEuros(mrr)}${delta ? ` (${delta >= 0 ? "+" : "−"}${formatEuros(Math.abs(delta))})` : ""}`}
                    >
                      <div className="w-full rounded-t-md bg-primary-500" style={{ height: "100%" }}></div>
                    </div>
                    <div
                      className="w-1/3 max-w-3 flex items-end rounded-t-md bg-background-200/50"
                      style={{ height: `${reguH}%` }}
                      title={`${moisCourt(cle)} · Régularité ${taux}% · ${regu?.artisans ?? 0} artisan${(regu?.artisans ?? 0) > 1 ? "s" : ""} sur ${regu?.attendus ?? 0} attendu${(regu?.attendus ?? 0) > 1 ? "s" : ""}`}
                    >
                      <div className="w-full rounded-t-md bg-accent-500" style={{ height: "100%" }}></div>
                    </div>
                  </div>
                  <span className="text-[10px] capitalize whitespace-nowrap text-foreground-500">{moisCourt(cle)}</span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-3 border-t border-background-200">
            <span className="text-xs text-foreground-600 inline-flex items-center gap-1.5">
              <i className="ri-line-chart-line text-primary-600"></i>
              MRR : <strong className="text-foreground-950">{formatEuros(mrrActuel)}</strong>
              {variationPct !== null && (
                <span
                  className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap ${
                    variation >= 0 ? "bg-accent-100 text-accent-800" : "bg-red-100 text-red-700"
                  }`}
                >
                  <i className={variation >= 0 ? "ri-arrow-up-line" : "ri-arrow-down-line"}></i>
                  {variation >= 0 ? "+" : ""}
                  {variationPct}%
                </span>
              )}
            </span>
            <span className="text-xs text-foreground-600 inline-flex items-center gap-1.5">
              <i className="ri-file-chart-line text-accent-600"></i>
              Régularité : <strong className="text-foreground-950">{tauxActuel} %</strong>
              {dernierRegu && (
                <span className="text-foreground-400">
                  ({dernierRegu.artisans}/{dernierRegu.attendus} sur {moisCourt(dernierRegu.mois)})
                </span>
              )}
            </span>
          </div>

          <p className="text-[11px] text-foreground-400">
            MRR reconstitué depuis l'historique des changements d'offre ; régularité = part des artisans suivis ayant envoyé
            automatiquement leur journal comptable ce mois-là.
          </p>
        </div>
      )}
    </div>
  );
}