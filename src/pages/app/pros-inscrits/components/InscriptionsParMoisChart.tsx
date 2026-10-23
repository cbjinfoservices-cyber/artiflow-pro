import { useMemo } from "react";
import type { AbonnementItem } from "@/lib/abonnementsApi";

interface InscriptionsParMoisChartProps {
  items: AbonnementItem[];
  /** Nombre de mois affichés (mois courant inclus). */
  mois?: number;
}

/** Un mois du graphique : clé « AAAA-M », libellé court, libellé long et compte d'inscriptions. */
interface MoisInscriptions {
  key: string;
  label: string;
  full: string;
  count: number;
}

/**
 * Mini-graphe « inscriptions par mois » : reconstitue le rythme des nouvelles arrivées de pros
 * inscrits à partir de leur date d'inscription. Le mois courant est mis en avant (accent) pour
 * visualiser d'un coup d'œil la dynamique des dernières semaines.
 */
export default function InscriptionsParMoisChart({ items, mois = 6 }: InscriptionsParMoisChartProps) {
  const buckets = useMemo<MoisInscriptions[]>(() => {
    const now = new Date();
    const liste: MoisInscriptions[] = [];
    for (let i = mois - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      liste.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        full: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        count: 0,
      });
    }
    items.forEach((a) => {
      const d = new Date(a.created_at);
      if (Number.isNaN(d.getTime())) return;
      const bucket = liste.find((b) => b.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (bucket) bucket.count += 1;
    });
    return liste;
  }, [items, mois]);

  const totalPeriode = buckets.reduce((s, b) => s + b.count, 0);
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const moisCourant = buckets[buckets.length - 1]?.count ?? 0;
  const moisPrecedent = buckets[buckets.length - 2]?.count ?? 0;
  const delta = moisCourant - moisPrecedent;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            <i className="ri-user-add-line text-primary-600"></i>
            Inscriptions par mois
          </p>
          <p className="text-[11px] text-foreground-400 mt-1">
            Nouvelles arrivées de pros inscrits sur les {buckets.length} derniers mois.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-heading font-bold text-lg text-foreground-950">{totalPeriode}</span>
          <span className="text-[11px] text-foreground-500">sur la période</span>
          {totalPeriode > 0 && (
            <span
              className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap ${
                delta > 0
                  ? "bg-accent-100 text-accent-800"
                  : delta < 0
                    ? "bg-red-100 text-red-700"
                    : "bg-background-200 text-foreground-600"
              }`}
              title={`${moisCourant} ce mois-ci contre ${moisPrecedent} le mois précédent`}
            >
              <i className={delta > 0 ? "ri-arrow-up-line" : delta < 0 ? "ri-arrow-down-line" : "ri-subtract-line"}></i>
              {delta > 0 ? "+" : ""}
              {delta} vs mois-1
            </span>
          )}
        </div>
      </div>

      {totalPeriode === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-8 text-center">
          <span className="w-11 h-11 flex items-center justify-center rounded-full bg-background-200 text-foreground-500">
            <i className="ri-bar-chart-2-line text-xl"></i>
          </span>
          <p className="text-sm text-foreground-600">Aucune inscription enregistrée sur les 6 derniers mois.</p>
          <p className="text-[11px] text-foreground-400">La tendance s'affichera dès la première inscription.</p>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-1.5 h-32 mt-1">
            {buckets.map((b, i) => {
              const hauteurPct = Math.max((b.count / max) * 100, b.count > 0 ? 6 : 2);
              const isCurrent = i === buckets.length - 1;
              return (
                <div
                  key={b.key}
                  className="flex-1 flex flex-col items-center gap-1.5 min-w-0"
                  title={`${b.full} · ${b.count} inscription${b.count > 1 ? "s" : ""}`}
                >
                  <span
                    className={`text-[10px] font-bold tabular-nums leading-none ${
                      b.count > 0 ? (isCurrent ? "text-accent-700" : "text-foreground-700") : "text-foreground-300"
                    }`}
                  >
                    {b.count}
                  </span>
                  <div
                    className="w-full flex items-end rounded-t-md bg-background-200/50"
                    style={{ height: `${hauteurPct}%` }}
                  >
                    <div
                      className={`w-full rounded-t-md ${
                        b.count === 0 ? "bg-background-200" : isCurrent ? "bg-accent-500" : "bg-primary-400"
                      }`}
                      style={{ height: "100%" }}
                    ></div>
                  </div>
                  <span
                    className={`text-[10px] capitalize whitespace-nowrap ${
                      isCurrent ? "text-foreground-800 font-semibold" : "text-foreground-400"
                    }`}
                  >
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-background-200">
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-accent-500"></span>
              Mois en cours
            </span>
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary-400"></span>
              Mois précédents
            </span>
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1.5">
              <i className="ri-calendar-line text-primary-600"></i>
              <strong className="text-foreground-900">{moisCourant}</strong> inscription{moisCourant > 1 ? "s" : ""} ce mois-ci
            </span>
          </div>
        </>
      )}
    </div>
  );
}