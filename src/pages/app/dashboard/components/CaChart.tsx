import { useMemo, useState } from "react";
import { formatCompactEuros, formatEuros } from "@/lib/format";
import { formatShortDate, todayISO } from "@/lib/dates";
import { devisStatusTone } from "@/lib/statuts";
import { toCsv, downloadCsv } from "@/lib/csv";
import type { DevisItem } from "@/hooks/useArtisanData";
import StatutBadge from "@/pages/app/components/StatutBadge";

export interface CaPoint {
  key: string;
  label: string;
  longLabel: string;
  total: number;
  prevTotal?: number;
  delta?: number | null;
}

export default function CaChart({ data, devis }: { data: CaPoint[]; devis: DevisItem[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.total), 1);

  const selectedPoint = selectedIndex !== null ? data[selectedIndex] : null;

  const monthDevis = useMemo(() => {
    if (!selectedPoint) return [];
    return devis
      .filter((d) => {
        if (d.statut === "Brouillon") return false;
        const c = new Date(d.created_at);
        if (Number.isNaN(c.getTime())) return false;
        return `${c.getFullYear()}-${c.getMonth()}` === selectedPoint.key;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [devis, selectedPoint]);

  const handleBarClick = (index: number) => {
    setSelectedIndex((prev) => (prev === index ? null : index));
  };

  const handleExport = () => {
    if (!selectedPoint || monthDevis.length === 0) return;
    const rows = monthDevis.map((d) => [
      d.numero,
      d.clientNom ?? "",
      d.objet ?? "",
      Number(d.total_ht || 0).toFixed(2).replace(".", ","),
      Number(d.total_ttc || 0).toFixed(2).replace(".", ","),
      d.statut,
      formatShortDate(d.created_at),
    ]);
    const csv = toCsv(["Numéro", "Client", "Objet", "Montant HT", "Montant TTC", "Statut", "Date"], rows);
    downloadCsv(`devis-${selectedPoint.key}-${todayISO()}.csv`, csv);
  };

  return (
    <div className="lg:col-span-2 p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-heading font-semibold text-base text-foreground-950">Chiffre d'affaires</h2>
        <span className="text-xs text-foreground-500">6 derniers mois · cliquez un mois pour le détail</span>
      </div>
      <div className="flex items-end gap-3 h-44">
        {data.map((point, i) => {
          const isActive = selectedIndex === i;
          const hasDelta = point.delta !== null && point.delta !== undefined;
          const up = hasDelta && (point.delta as number) > 0;
          const down = hasDelta && (point.delta as number) < 0;
          return (
            <button
              key={`${point.label}-${i}`}
              type="button"
              onClick={() => handleBarClick(i)}
              className="flex-1 flex flex-col items-center gap-2 cursor-pointer group min-w-0"
              title={`Voir les devis de ${point.longLabel}`}
              aria-pressed={isActive}
            >
              <span className={`text-[10px] font-semibold ${isActive ? "text-foreground-950" : "text-foreground-500"}`}>
                {formatCompactEuros(point.total)}
              </span>
              <div
                className={`w-full rounded-t-md transition-all ${
                  isActive
                    ? "bg-primary-600 ring-2 ring-primary-600"
                    : i === data.length - 1
                      ? "bg-primary-500"
                      : "bg-primary-200 group-hover:bg-primary-300"
                }`}
                style={{ height: `${Math.max((point.total / max) * 100, 4)}%` }}
              ></div>
              <span className={`text-[10px] ${isActive ? "text-foreground-950 font-semibold" : "text-foreground-400"}`}>
                {point.label}
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
                    {point.delta}%
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selectedPoint && (
        <div className="mt-4 pt-4 border-t border-background-200 animate-fade-in">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold text-foreground-950 capitalize">
                Devis du mois · {selectedPoint.longLabel}
              </p>
              <p className="text-xs text-foreground-500 mt-0.5">
                {monthDevis.length} devis · {formatEuros(monthDevis.reduce((sum, d) => sum + Number(d.total_ht || 0), 0))} HT
              </p>
              <p className="mt-1 text-[11px] inline-flex items-center gap-1.5 flex-wrap">
                {selectedPoint.delta === null || selectedPoint.delta === undefined ? (
                  <span className="text-foreground-300">— vs mois précédent</span>
                ) : (
                  <>
                    <span
                      className={`inline-flex items-center gap-0.5 font-semibold ${
                        selectedPoint.delta > 0
                          ? "text-accent-700"
                          : selectedPoint.delta < 0
                            ? "text-red-600"
                            : "text-foreground-500"
                      }`}
                    >
                      <i
                        className={
                          selectedPoint.delta > 0
                            ? "ri-arrow-up-line"
                            : selectedPoint.delta < 0
                              ? "ri-arrow-down-line"
                              : "ri-subtract-line"
                        }
                      ></i>
                      {selectedPoint.delta > 0 ? "+" : ""}
                      {selectedPoint.delta} %
                    </span>
                    <span className="text-foreground-400">vs mois préc.</span>
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExport}
                disabled={monthDevis.length === 0}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Exporter la liste des devis de ce mois au format CSV"
              >
                <i className="ri-file-excel-2-line"></i>
                Exporter CSV
              </button>
              <button
                type="button"
                onClick={() => setSelectedIndex(null)}
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-foreground-700 cursor-pointer"
                aria-label="Fermer le détail du mois"
                title="Fermer"
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          </div>

          {monthDevis.length === 0 ? (
            <p className="p-6 text-center text-sm text-foreground-500 rounded-lg bg-background-50 border border-background-200">
              Aucun devis validé sur ce mois.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {monthDevis.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200"
                >
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-background-200 text-foreground-600">
                    <i className="ri-file-text-line text-sm"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground-900">{d.numero}</span>
                      <StatutBadge label={d.statut} tone={devisStatusTone(d.statut)} />
                    </div>
                    <p className="text-[11px] text-foreground-500 mt-0.5 truncate">
                      {d.clientNom ?? "Sans client"}
                      {d.objet ? ` · ${d.objet}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground-950">{formatEuros(d.total_ht)}</p>
                    <p className="text-[11px] text-foreground-400">{formatShortDate(d.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}