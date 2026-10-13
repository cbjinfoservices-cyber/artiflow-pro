import { useEvolutionMrrHistorique } from "@/hooks/useEvolutionMrrHistorique";
import { formatEuros } from "@/lib/format";

/**
 * Évolution du MRR estimé sur 12 mois, reconstituée à partir de l'historique
 * des changements d'offre. Les mois en progression (montées en gamme) ressortent
 * en accent, les mois en recul (descente d'offre) en rouge.
 */
export default function EvolutionMrrHistoriqueCard() {
  const { data, loading, error, reload } = useEvolutionMrrHistorique(12);

  const mrrActuel = data.length ? data[data.length - 1].mrr : 0;
  const mrrDebut = data.length ? data[0].mrr : 0;
  const variation = mrrActuel - mrrDebut;
  const variationPct = mrrDebut > 0 ? Math.round((variation / mrrDebut) * 100) : null;
  const max = Math.max(...data.map((m) => m.mrr), 1);
  const plusHaut = data.reduce<{ label: string; mrr: number } | null>(
    (best, m) => (m.mrr > 0 && (!best || m.mrr > best.mrr) ? { label: m.label, mrr: m.mrr } : best),
    null,
  );
  const abonnesActuels = data.length ? data[data.length - 1].abonnes : 0;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            <i className="ri-line-chart-line text-primary-600"></i>
            Évolution du MRR estimé (12 mois)
          </p>
          <p className="text-[11px] text-foreground-400 mt-1">
            Reconstituée à partir de l'historique des changements d'offre, tous abonnements confondus.
          </p>
        </div>
        {!loading && !error && (
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-lg text-foreground-950">{formatEuros(mrrActuel)}</span>
            {variationPct !== null && (
              <span
                className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap ${
                  variation >= 0 ? "bg-accent-100 text-accent-800" : "bg-red-100 text-red-700"
                }`}
              >
                <i className={variation >= 0 ? "ri-arrow-up-line" : "ri-arrow-down-line"}></i>
                {variation >= 0 ? "+" : ""}
                {variationPct}% / 12 mois
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-foreground-500">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement…
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center gap-3 py-3">
          <span className="text-sm text-foreground-600 flex-1 min-w-[160px]">{error}</span>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-1.5 h-36 mt-1">
            {data.map((m, i) => {
              const heightPct = Math.max((m.mrr / max) * 100, m.mrr > 0 ? 6 : 2);
              const isCurrent = i === data.length - 1;
              const trend = m.delta > 0 ? "up" : m.delta < 0 ? "down" : "flat";
              const barColor =
                trend === "up" ? "bg-accent-500" : trend === "down" ? "bg-red-400" : "bg-primary-400";
              return (
                <div
                  key={m.key}
                  className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
                  title={`${m.label} · ${formatEuros(m.mrr)} · ${m.abonnes} abonné${m.abonnes > 1 ? "s" : ""} actif${m.abonnes > 1 ? "s" : ""} · ${
                    m.delta >= 0 ? "+" : ""
                  }${formatEuros(m.delta)}`}
                >
                  {m.delta !== 0 && m.mrr > 0 && (
                    <span
                      className={`text-[9px] font-bold tabular-nums leading-none ${
                        m.delta > 0 ? "text-accent-700" : "text-red-600"
                      }`}
                    >
                      {m.delta > 0 ? "+" : "-"}
                      {Math.abs(Math.round(m.delta))}
                    </span>
                  )}
                  <div className="w-full flex items-end rounded-t-md bg-background-200/50" style={{ height: `${heightPct}%` }}>
                    <div
                      className={`w-full rounded-t-md ${barColor} ${isCurrent ? "ring-1 ring-primary-600 ring-offset-1 ring-offset-background-100" : ""}`}
                      style={{ height: "100%" }}
                    ></div>
                  </div>
                  <span
                    className={`text-[10px] capitalize whitespace-nowrap ${
                      isCurrent ? "text-foreground-800 font-semibold" : "text-foreground-400"
                    }`}
                  >
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-background-200">
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-accent-500"></span>
              Mois en hausse
            </span>
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-400"></span>
              Mois en baisse
            </span>
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
              <i className="ri-group-line text-primary-600"></i>
              <strong className="text-foreground-900">{abonnesActuels}</strong> abonnements comptés ce mois-ci
            </span>
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
              <i className="ri-award-line text-accent-600"></i>
              {plusHaut ? (
                <>
                  Plus haut : <strong className="text-foreground-900">{formatEuros(plusHaut.mrr)}</strong>
                  <span className="capitalize">({plusHaut.label})</span>
                </>
              ) : (
                "Pas encore d'historique"
              )}
            </span>
          </div>

          <p className="text-[11px] text-foreground-400">
            Estimation indicative : elle s'appuie uniquement sur les passages d'offre enregistrés et ne tient pas compte
            des statuts (impayés, résiliations).
          </p>
        </>
      )}
    </div>
  );
}