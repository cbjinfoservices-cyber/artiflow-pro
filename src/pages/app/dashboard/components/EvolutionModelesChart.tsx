import { useMemo, useState } from "react";
import type { ModeleUsageEvent } from "@/lib/artisanApi";

interface Serie {
  key: string;
  label: string;
}

interface EvolutionModelesChartProps {
  events: ModeleUsageEvent[];
  series: Serie[];
  loading?: boolean;
}

interface Mois {
  key: string;
  label: string;
  longLabel: string;
  utilisations: number;
  montant: number;
}

/** Clé stable d'un mois (YYYY-MM). */
function cleMois(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Graphique d'évolution mensuelle des usages de modèles de devis. Affiche, sur les
 * 6 derniers mois, le nombre d'utilisations mois par mois — pour un modèle précis
 * ou tous les modèles confondus — afin de repérer les tendances dans le temps.
 */
export default function EvolutionModelesChart({ events, series, loading = false }: EvolutionModelesChartProps) {
  const [selection, setSelection] = useState<string>("all");

  const mois: Mois[] = useMemo(() => {
    const now = new Date();
    const raw: Mois[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      raw.push({
        key: cleMois(d),
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        longLabel: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        utilisations: 0,
        montant: 0,
      });
    }
    const byKey = new Map(raw.map((m) => [m.key, m]));
    events.forEach((e) => {
      if (selection !== "all" && e.cle !== selection) return;
      const d = new Date(e.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const bucket = byKey.get(cleMois(d));
      if (!bucket) return;
      bucket.utilisations += 1;
      bucket.montant += Number(e.montant) || 0;
    });
    return raw;
  }, [events, selection]);

  // Les modèles proposés au choix : ceux ayant au moins un usage, puis tous les autres.
  const choixSeries = useMemo<Serie[]>(() => {
    const used = new Set(events.map((e) => e.cle));
    return [...series].sort((a, b) => {
      const ua = used.has(a.key) ? 0 : 1;
      const ub = used.has(b.key) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      return a.label.localeCompare(b.label, "fr");
    });
  }, [series, events]);

  const maxUtil = Math.max(...mois.map((m) => m.utilisations), 1);
  const total = mois.reduce((s, m) => s + m.utilisations, 0);
  const totalMontant = mois.reduce((s, m) => s + m.montant, 0);
  const courant = mois[mois.length - 1]?.utilisations ?? 0;
  const precedent = mois[mois.length - 2]?.utilisations ?? 0;
  const delta = courant - precedent;
  const libelleSelection =
    selection === "all" ? "Tous les modèles" : series.find((s) => s.key === selection)?.label ?? "Modèle";

  return (
    <div className="mb-4 p-3 rounded-md bg-background-50 border border-background-200">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-700 inline-flex items-center gap-1.5">
          <i className="ri-line-chart-line"></i>
          Évolution mensuelle des usages
        </h3>
        <select
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          className="h-8 max-w-[190px] px-2 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-700 outline-none focus:border-primary-400 cursor-pointer"
          title="Choisir le modèle à suivre"
        >
          <option value="all">Tous les modèles</option>
          {choixSeries.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap">
          <i className="ri-repeat-line"></i>
          {total} utilisation{total > 1 ? "s" : ""} · 6 mois
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary-100 text-primary-800 text-[10px] font-semibold whitespace-nowrap">
          <i className="ri-money-euro-circle-line"></i>
          {Math.round(totalMontant).toLocaleString("fr-FR")} € générés
        </span>
        {total > 0 && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
              delta > 0
                ? "bg-accent-100 text-accent-800"
                : delta < 0
                  ? "bg-background-200 text-foreground-600"
                  : "bg-background-200 text-foreground-500"
            }`}
          >
            <i className={delta > 0 ? "ri-arrow-up-line" : delta < 0 ? "ri-arrow-down-line" : "ri-subtract-line"}></i>
            {delta > 0 ? `+${delta}` : delta} vs mois dernier
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-foreground-400 py-8 text-center flex items-center justify-center gap-1.5">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement de l'évolution…
        </p>
      ) : total === 0 ? (
        <p className="text-xs text-foreground-400 py-8 text-center">
          Aucun usage sur les 6 derniers mois pour « {libelleSelection} ».
        </p>
      ) : (
        <div className="flex items-end gap-2 h-32">
          {mois.map((m, i) => {
            const heightPct = Math.max((m.utilisations / maxUtil) * 100, m.utilisations > 0 ? 6 : 1);
            const actif = m.utilisations > 0;
            const dernier = i === mois.length - 1;
            return (
              <div
                key={m.key}
                className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
                title={`${m.longLabel} · ${m.utilisations} utilisation(s)`}
              >
                <span className={`text-[10px] font-semibold ${actif ? "text-foreground-700" : "text-foreground-300"}`}>
                  {m.utilisations > 0 ? m.utilisations : ""}
                </span>
                <div
                  className={`w-full flex items-end rounded-t-md overflow-hidden ${
                    actif ? "bg-background-200/60" : "bg-background-200/30"
                  }`}
                  style={{ height: `${heightPct}%` }}
                >
                  <div
                    className={`w-full rounded-t-md ${dernier ? "bg-accent-500" : actif ? "bg-primary-500" : "bg-background-300"}`}
                    style={{ height: "100%" }}
                  ></div>
                </div>
                <span className={`text-[10px] whitespace-nowrap ${dernier ? "text-foreground-700 font-semibold" : "text-foreground-400"}`}>
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}