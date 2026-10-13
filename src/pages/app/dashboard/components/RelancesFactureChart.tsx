import { useMemo } from "react";
import type { RelanceFactureEnvoi } from "@/lib/artisanApi";
import { formatEuros } from "@/lib/format";

interface RelancesFactureChartProps {
  envois: RelanceFactureEnvoi[];
}

interface Semaine {
  key: string;
  label: string;
  longLabel: string;
  montant: number;
  count: number;
}

/** Lundi (00:00) de la semaine contenant la date fournie. */
function debutSemaine(d: Date): Date {
  const jour = (d.getDay() + 6) % 7; // lundi = 0
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - jour);
  s.setHours(0, 0, 0, 0);
  return s;
}

/** Clé stable d'une semaine (YYYY-MM-DD du lundi). */
function cleSemaine(d: Date): string {
  const s = debutSemaine(d);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
}

/**
 * Mini-graphe du montant total relancé par semaine (8 dernières semaines), construit à
 * partir de l'historique des relances de factures. Sert d'indicateur visuel dans
 * l'onglet « Historique ».
 */
export default function RelancesFactureChart({ envois }: RelancesFactureChartProps) {
  const semaines: Semaine[] = useMemo(() => {
    const now = new Date();
    const base = debutSemaine(now);
    const raw: Semaine[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i * 7);
      const fin = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6);
      raw.push({
        key: cleSemaine(d),
        label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        longLabel: `semaine du ${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })} au ${fin.toLocaleDateString(
          "fr-FR",
          { day: "2-digit", month: "long" },
        )}`,
        montant: 0,
        count: 0,
      });
    }
    const byKey = new Map(raw.map((s) => [s.key, s]));
    envois.forEach((e) => {
      const d = new Date(e.envoye_le);
      if (Number.isNaN(d.getTime())) return;
      const bucket = byKey.get(cleSemaine(d));
      if (!bucket) return;
      bucket.montant += Number(e.montant) || 0;
      bucket.count += 1;
    });
    return raw;
  }, [envois]);

  const maxMontant = Math.max(...semaines.map((s) => s.montant), 1);
  const total = semaines.reduce((sum, s) => sum + s.montant, 0);
  const totalCount = semaines.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="rounded-md bg-background-50 border border-background-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
          <i className="ri-bar-chart-2-line"></i>
          Montant relancé par semaine
        </p>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold whitespace-nowrap">
          <i className="ri-money-euro-circle-line"></i>
          {formatEuros(total)} · {totalCount} envoi{totalCount > 1 ? "s" : ""}
        </span>
      </div>

      {totalCount === 0 ? (
        <p className="text-xs text-foreground-400 py-6 text-center">
          Aucune relance sur les 8 dernières semaines.
        </p>
      ) : (
        <div className="flex items-end gap-2 h-32">
          {semaines.map((s) => {
            const heightPct = Math.max((s.montant / maxMontant) * 100, s.montant > 0 ? 4 : 1);
            const actif = s.montant > 0;
            return (
              <div
                key={s.key}
                className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
                title={`${s.longLabel} · ${formatEuros(s.montant)} (${s.count} envoi${s.count > 1 ? "s" : ""})`}
              >
                <span className={`text-[10px] font-semibold ${actif ? "text-foreground-700" : "text-foreground-300"}`}>
                  {s.montant > 0 ? formatEuros(s.montant) : ""}
                </span>
                <div
                  className={`w-full flex items-end rounded-t-md overflow-hidden ${
                    actif ? "bg-background-200/60" : "bg-background-200/30"
                  }`}
                  style={{ height: `${heightPct}%` }}
                >
                  <div
                    className={`w-full rounded-t-md ${actif ? "bg-accent-500" : "bg-background-300"}`}
                    style={{ height: "100%" }}
                  ></div>
                </div>
                <span className="text-[10px] text-foreground-400 whitespace-nowrap">{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}