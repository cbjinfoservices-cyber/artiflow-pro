import { useChangementsOffreParMois } from "@/hooks/useChangementsOffreParMois";

/**
 * Résumé du nombre de changements d'offre par mois (6 derniers mois),
 * tous abonnements confondus. Aide à repérer les mois de forte activité tarifaire.
 */
export default function ChangementsOffreParMoisCard() {
  const { data, loading, error, reload } = useChangementsOffreParMois(6);

  const total = data.reduce((s, m) => s + m.count, 0);
  const moisActifs = data.filter((m) => m.count > 0).length;
  const moyenne = moisActifs > 0 ? Math.round((total / moisActifs) * 10) / 10 : 0;
  const max = Math.max(...data.map((m) => m.count), 1);
  const moisRecord = data.reduce<{ label: string; count: number } | null>(
    (best, m) => (m.count > 0 && (!best || m.count > best.count) ? { label: m.label, count: m.count } : best),
    null,
  );

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
          <i className="ri-swap-box-line text-accent-600"></i>
          Changements d'offre par mois
        </p>
        {!loading && !error && (
          <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-bold whitespace-nowrap">
            {total} au total
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-foreground-500">
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
          <div className="flex items-end gap-2 h-28 mt-1">
            {data.map((m, i) => {
              const heightPct = Math.max((m.count / max) * 100, m.count > 0 ? 8 : 3);
              const isCurrent = i === data.length - 1;
              const isRecord = m.count > 0 && moisRecord?.label === m.label && m.count === moisRecord.count;
              return (
                <div
                  key={m.key}
                  className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
                  title={`${m.label} · ${m.count} changement${m.count > 1 ? "s" : ""} d'offre`}
                >
                  <span
                    className={`text-[10px] font-semibold tabular-nums ${
                      isRecord ? "text-accent-700" : isCurrent ? "text-primary-700" : "text-foreground-400"
                    }`}
                  >
                    {m.count > 0 ? m.count : ""}
                  </span>
                  <div className="w-full flex items-end rounded-t-md bg-background-200/50" style={{ height: `${heightPct}%` }}>
                    <div
                      className={`w-full rounded-t-md ${
                        isRecord ? "bg-accent-500" : isCurrent ? "bg-primary-600" : "bg-primary-400"
                      }`}
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-background-200">
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
              <i className="ri-bar-chart-2-line text-primary-600"></i>
              Moyenne <strong className="text-foreground-900">{moyenne}</strong> /mois actif
            </span>
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
              <i className="ri-award-line text-accent-600"></i>
              {moisRecord ? (
                <>
                  Pic en <strong className="text-foreground-900 capitalize">{moisRecord.label}</strong> ({moisRecord.count})
                </>
              ) : (
                "Aucun changement ce semestre"
              )}
            </span>
          </div>

          <p className="text-[11px] text-foreground-400">
            Nombre de passages d'une offre à une autre (hors activation de compte), sur les 6 derniers mois.
          </p>
        </>
      )}
    </div>
  );
}