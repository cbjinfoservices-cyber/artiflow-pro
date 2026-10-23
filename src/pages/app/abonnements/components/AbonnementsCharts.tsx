import { useMemo } from "react";
import { OFFRES, type AbonnementItem } from "@/lib/abonnementsApi";
import { formatEuros } from "@/lib/format";

interface Props {
  abos: AbonnementItem[];
  /** Clic sur une ligne d'offre : permet d'exporter cette offre en PDF. */
  onOffreClick?: (offre: string) => void;
}

/** Couleur de barre par offre (familles accent / primary / secondary du thème). */
function offreBar(offre: string): string {
  if (offre === "Entreprise") return "bg-accent-500";
  if (offre === "Pro") return "bg-primary-500";
  return "bg-secondary-500";
}

export interface OffreRepartition {
  offre: string;
  count: number;
  pct: number;
  mrr: number;
}

/** Répartition du parc par offre (nombre, part en %, MRR des actifs). */
export function repartitionOffres(abos: AbonnementItem[]): OffreRepartition[] {
  const total = abos.length || 1;
  return OFFRES.map((offre) => {
    const count = abos.filter((a) => a.offre === offre).length;
    const mrr = abos
      .filter((a) => a.offre === offre && a.statut === "Actif")
      .reduce((s, a) => s + a.montant_mensuel, 0);
    return { offre, count, pct: Math.round((count / total) * 100), mrr };
  });
}

export interface MrrPoint {
  key: string;
  label: string;
  mrr: number;
  actifs: number;
}

/** Évolution du MRR cumulé sur les 6 derniers mois, à partir des dates de début. */
export function evolutionMrr(abos: AbonnementItem[]): MrrPoint[] {
  const point = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const now = new Date();
  const mois: MrrPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    mois.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("fr-FR", { month: "short" }),
      mrr: 0,
      actifs: 0,
    });
  }
  abos
    .filter((a) => a.statut === "Actif")
    .forEach((a) => {
      const debut = a.date_debut ? new Date(a.date_debut) : null;
      const debutPoint = debut && !Number.isNaN(debut.getTime()) ? point(debut) : -Infinity;
      mois.forEach((m) => {
        const d = new Date(Number(m.key.split("-")[0]), Number(m.key.split("-")[1]), 1);
        const finMoisPoint = point(new Date(d.getFullYear(), d.getMonth() + 1, 0));
        if (debutPoint <= finMoisPoint) {
          m.mrr += a.montant_mensuel;
          m.actifs += 1;
        }
      });
    });
  return mois;
}

/**
 * Deux mini-visuels de synthèse pour le back-office des abonnements :
 * 1) la répartition du parc par offre (Essentiel / Pro / Entreprise) ;
 * 2) l'évolution du MRR cumulé, reconstituée mois par mois à partir des
 *    dates de début des abonnements actuellement actifs.
 */
export default function AbonnementsCharts({ abos, onOffreClick }: Props) {
  // --- Répartition des offres ---
  const repartition = useMemo(() => repartitionOffres(abos), [abos]);

  // --- Évolution du MRR (6 derniers mois, cumul basé sur les dates de début) ---
  const evolution = useMemo(() => evolutionMrr(abos), [abos]);

  const maxMrr = Math.max(...evolution.map((m) => m.mrr), 1);
  const mrrActuel = evolution[evolution.length - 1]?.mrr ?? 0;
  const mrrPrecedent = evolution.length >= 2 ? evolution[evolution.length - 2].mrr : 0;
  const delta = mrrActuel - mrrPrecedent;
  const deltaPct = mrrPrecedent > 0 ? Math.round((delta / mrrPrecedent) * 100) : null;

  // Parc totalement vide : on affiche deux cartes avec un message clair plutôt que
  // des barres à zéro, pour que la page reste lisible sans aucun abonnement.
  if (abos.length === 0) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="flex flex-col gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            <i className="ri-donut-chart-line text-accent-600"></i>
            Répartition des offres
          </p>
          <div className="flex flex-col items-center justify-center text-center gap-2 py-10">
            <span className="w-11 h-11 flex items-center justify-center rounded-full bg-background-200 text-foreground-500 text-xl">
              <i className="ri-pie-chart-2-line"></i>
            </span>
            <p className="text-sm text-foreground-500">Aucune offre à répartir pour l'instant.</p>
            <p className="text-[11px] text-foreground-400">La répartition apparaîtra dès le premier abonnement enregistré.</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            <i className="ri-line-chart-line text-primary-600"></i>
            Évolution du MRR
          </p>
          <div className="flex flex-col items-center justify-center text-center gap-2 py-10">
            <span className="w-11 h-11 flex items-center justify-center rounded-full bg-background-200 text-foreground-500 text-xl">
              <i className="ri-line-chart-line"></i>
            </span>
            <p className="text-sm text-foreground-500">Pas encore de revenu récurrent à tracer.</p>
            <p className="text-[11px] text-foreground-400">La courbe du MRR se construira au fil des abonnements actifs.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Répartition des offres */}
      <div className="flex flex-col gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            <i className="ri-donut-chart-line text-accent-600"></i>
            Répartition des offres
          </p>
          <span className="text-[11px] text-foreground-500">
            <strong className="text-foreground-900">{abos.length}</strong> abonnements
          </span>
        </div>

        <div className="flex h-3 w-full rounded-full overflow-hidden bg-background-200">
          {repartition.map((r) =>
            r.count > 0 ? <div key={r.offre} className={offreBar(r.offre)} style={{ width: `${r.pct}%` }}></div> : null,
          )}
        </div>

        <div className="flex flex-col gap-2.5 mt-1">
          {repartition.map((r) => {
            const row = (
              <>
                <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${offreBar(r.offre)}`}></span>
                <span className="text-sm font-medium text-foreground-800 w-24 shrink-0">{r.offre}</span>
                <div className="flex-1 h-1.5 rounded-full bg-background-200 overflow-hidden">
                  <div className={`h-full rounded-full ${offreBar(r.offre)}`} style={{ width: `${r.pct}%` }}></div>
                </div>
                <span className="text-xs text-foreground-500 whitespace-nowrap w-24 text-right">
                  <strong className="text-foreground-900">{r.count}</strong> · {r.pct}%
                </span>
                {onOffreClick && <i className="ri-file-pdf-2-line text-foreground-400 text-sm shrink-0"></i>}
              </>
            );
            return onOffreClick ? (
              <button
                key={r.offre}
                type="button"
                onClick={() => onOffreClick(r.offre)}
                title={`Exporter uniquement l'offre ${r.offre} en PDF`}
                className="flex items-center gap-3 text-left rounded-md -mx-1.5 px-1.5 py-1 hover:bg-background-200/60 cursor-pointer transition-colors"
              >
                {row}
              </button>
            ) : (
              <div key={r.offre} className="flex items-center gap-3">
                {row}
              </div>
            );
          })}
        </div>
      </div>

      {/* Évolution du MRR */}
      <div className="flex flex-col gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            <i className="ri-line-chart-line text-primary-600"></i>
            Évolution du MRR
          </p>
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-base text-foreground-950">{formatEuros(mrrActuel)}</span>
            {deltaPct !== null && (
              <span
                className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap ${
                  delta >= 0 ? "bg-accent-100 text-accent-800" : "bg-red-100 text-red-700"
                }`}
              >
                <i className={delta >= 0 ? "ri-arrow-up-line" : "ri-arrow-down-line"}></i>
                {delta >= 0 ? "+" : ""}
                {deltaPct}%
              </span>
            )}
          </div>
        </div>

        <div className="flex items-end gap-2 h-28 mt-1">
          {evolution.map((m, i) => {
            const heightPct = Math.max((m.mrr / maxMrr) * 100, m.mrr > 0 ? 6 : 2);
            const isCurrent = i === evolution.length - 1;
            return (
              <div
                key={m.key}
                className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
                title={`${m.label} · ${formatEuros(m.mrr)} · ${m.actifs} abonné${m.actifs > 1 ? "s" : ""} actif${m.actifs > 1 ? "s" : ""}`}
              >
                <span className={`text-[10px] font-semibold tabular-nums ${isCurrent ? "text-primary-700" : "text-foreground-400"}`}>
                  {m.mrr > 0 ? formatEuros(m.mrr) : ""}
                </span>
                <div className="w-full flex items-end rounded-t-md bg-background-200/50" style={{ height: `${heightPct}%` }}>
                  <div className={`w-full rounded-t-md ${isCurrent ? "bg-primary-600" : "bg-primary-400"}`} style={{ height: "100%" }}></div>
                </div>
                <span className={`text-[10px] capitalize whitespace-nowrap ${isCurrent ? "text-foreground-800 font-semibold" : "text-foreground-400"}`}>
                  {m.label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-foreground-400">
          MRR cumulé des abonnements actifs, reconstitué sur les 6 derniers mois à partir des dates de début.
        </p>
      </div>
    </div>
  );
}