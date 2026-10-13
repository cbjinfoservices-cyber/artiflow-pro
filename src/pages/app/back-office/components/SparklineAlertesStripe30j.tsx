import type { PointJourAlerte } from "@/lib/alertesConfigStripeStats";

/**
 * Mini-graphe de fréquence des alertes de configuration Stripe sur les 30 derniers jours.
 * Rendu 100 % CSS (une barre par jour), sans dépendance graphique : chaque barre est
 * colorée selon qu'une alerte a été détectée ce jour-là ou non.
 */
export default function SparklineAlertesStripe30j({ points }: { points: PointJourAlerte[] }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const total = points.reduce((s, p) => s + p.count, 0);
  const joursActifs = points.filter((p) => p.count > 0).length;
  const premier = points[0]?.label ?? "";
  const dernier = points[points.length - 1]?.label ?? "";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
          Fréquence des alertes · 30 jours
        </span>
        <span className="text-[11px] text-foreground-500">
          <span className="font-bold tabular-nums text-foreground-950">{total}</span> alerte
          {total > 1 ? "s" : ""} sur {joursActifs} jour{joursActifs > 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex items-end gap-[2px] h-14" role="img" aria-label="Fréquence quotidienne des alertes Stripe sur 30 jours">
        {points.map((p) => {
          const h = p.count <= 0 ? 3 : Math.max(5, Math.round((p.count / max) * 50));
          return (
            <span
              key={p.cle}
              className={`flex-1 rounded-sm transition-colors ${
                p.count > 0 ? "bg-accent-500" : "bg-background-200"
              }`}
              style={{ height: `${h}px` }}
              title={`${p.label} : ${p.count} alerte${p.count > 1 ? "s" : ""}`}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-1 text-[10px] text-foreground-400">
        <span>{premier}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-accent-500 inline-block"></span>
          Alerte détectée
        </span>
        <span>{dernier}</span>
      </div>
    </div>
  );
}