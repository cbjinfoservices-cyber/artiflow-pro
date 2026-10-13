import { useMemo } from "react";
import type { FactureItem } from "@/hooks/useArtisanData";
import { formatCompactEuros, formatEuros } from "@/lib/format";
import BoutonPartager from "@/pages/app/components/BoutonPartager";

interface EncaissementBucket {
  key: string;
  label: string;
  longLabel: string;
  total: number;
  count: number;
  delta: number | null;
}

/**
 * Graphique de l'évolution des encaissements mois par mois (6 derniers mois).
 * Chaque barre correspond au total réellement encaissé sur le mois, calculé à partir
 * de la date de règlement de chaque facture payée (repli sur la date d'émission).
 */
export default function EncaissementsChart({ factures }: { factures: FactureItem[] }) {
  const buckets: EncaissementBucket[] = useMemo(() => {
    const now = new Date();
    const raw: { key: string; label: string; longLabel: string; total: number; count: number; delta: number | null }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      raw.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        longLabel: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        total: 0,
        count: 0,
        delta: null,
      });
    }
    const byKey = new Map(raw.map((b) => [b.key, b]));
    factures
      .filter((f) => f.statut === "Payée")
      .forEach((f) => {
        const date = f.date_paiement ?? f.date_emission ?? f.created_at;
        if (!date) return;
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const bucket = byKey.get(key);
        if (!bucket) return;
        bucket.total += Number(f.total_ttc || 0);
        bucket.count += 1;
      });
    return raw.map((b, idx) => {
      const prev = idx > 0 ? raw[idx - 1].total : null;
      const delta = prev === null || prev === 0 ? null : Math.round(((b.total - prev) / prev) * 100);
      return { ...b, delta };
    });
  }, [factures]);

  const max = Math.max(...buckets.map((b) => b.total), 1);
  const totalPeriode = buckets.reduce((s, b) => s + b.total, 0);
  const nbReglements = buckets.reduce((s, b) => s + b.count, 0);
  const current = buckets[buckets.length - 1];
  const currentDelta = current?.delta ?? null;

  return (
    <div className="p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
            <i className="ri-line-chart-line"></i>
          </span>
          <div>
            <h2 className="font-heading font-semibold text-base text-foreground-950">Évolution des encaissements</h2>
            <p className="text-xs text-foreground-500 mt-0.5">
              {nbReglements > 0
                ? `${nbReglements} règlement${nbReglements > 1 ? "s" : ""} encaissé${nbReglements > 1 ? "s" : ""} sur les 6 derniers mois`
                : "6 derniers mois · aucun règlement encaissé pour l'instant"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <BoutonPartager label="Encaissements" chemin="/app/comptabilite" />
          <div className="text-right">
            <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Total encaissé</p>
            <p className="font-heading font-bold text-lg text-accent-700">{formatEuros(totalPeriode)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-end gap-3 h-44">
        {buckets.map((b, i) => {
          const isCurrent = i === buckets.length - 1;
          const hasDelta = b.delta !== null;
          const up = hasDelta && (b.delta as number) > 0;
          const down = hasDelta && (b.delta as number) < 0;
          return (
            <div
              key={b.key}
              className="flex-1 flex flex-col items-center gap-2 min-w-0"
              title={`${b.longLabel} : ${formatEuros(b.total)} encaissé${b.count > 0 ? ` · ${b.count} règlement${b.count > 1 ? "s" : ""}` : ""}`}
            >
              <span
                className={`text-[10px] font-semibold whitespace-nowrap ${isCurrent ? "text-foreground-950" : "text-foreground-500"}`}
              >
                {formatCompactEuros(b.total)}
              </span>
              <div className="w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-t-md transition-all ${
                    isCurrent ? "bg-accent-600" : "bg-accent-300 hover:bg-accent-400"
                  }`}
                  style={{ height: `${Math.max((b.total / max) * 100, b.total > 0 ? 4 : 0)}%` }}
                ></div>
              </div>
              <span className={`text-[10px] ${isCurrent ? "text-foreground-950 font-semibold" : "text-foreground-400"}`}>
                {b.label}
              </span>
              <span
                className={`text-[10px] font-semibold inline-flex items-center gap-0.5 whitespace-nowrap ${
                  !hasDelta
                    ? "text-foreground-300"
                    : up
                      ? "text-accent-700"
                      : down
                        ? "text-red-600"
                        : "text-foreground-500"
                }`}
                title="Évolution par rapport au mois précédent"
              >
                {!hasDelta ? (
                  <>
                    <i className="ri-subtract-line"></i>—
                  </>
                ) : (
                  <>
                    <i className={up ? "ri-arrow-up-line" : down ? "ri-arrow-down-line" : "ri-subtract-line"}></i>
                    {up ? "+" : ""}
                    {b.delta}%
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {current && current.count > 0 && (
        <p className="mt-4 pt-4 border-t border-background-200 text-xs text-foreground-500">
          Ce mois-ci : <strong className="text-foreground-800">{formatEuros(current.total)}</strong> encaissés
          {currentDelta !== null ? (
            <>
              {" "}
              ·{" "}
              <span
                className={`font-semibold ${
                  currentDelta > 0 ? "text-accent-700" : currentDelta < 0 ? "text-red-600" : "text-foreground-500"
                }`}
              >
                {currentDelta > 0 ? "+" : ""}
                {currentDelta} % vs mois dernier
              </span>
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}