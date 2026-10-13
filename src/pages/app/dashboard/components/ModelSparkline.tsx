import { useMemo } from "react";

interface ModelSparklineProps {
  /** Valeurs mensuelles, du plus ancien au plus récent (ex. 12 mois). */
  values: number[];
  /** Libellés des mois alignés sur values (ex. ["août", "septembre", …]) pour l'infobulle. */
  labels?: string[];
  tone?: "primary" | "accent";
  title?: string;
  className?: string;
  /** Taille des barres : "sm" pour la liste, "lg" pour la vue comparaison. */
  size?: "sm" | "lg";
  /** Index du mois à mettre en avant (meilleur mois). */
  peakIndex?: number;
  /** Si fourni, chaque barre devient cliquable pour filtrer les devis de ce mois précis. */
  onBarClick?: (index: number) => void;
}

/**
 * Mini-courbe (sparkline) de l'évolution mensuelle, rendue avec de petites barres CSS.
 * Aucune dépendance graphique : des éléments proportionnels à la valeur de chaque mois.
 * Au survol, une infobulle détaille le nombre de devis mois par mois. Si `onBarClick`
 * est fourni, chaque mois devient cliquable pour ouvrir les devis de ce mois précis.
 */
export default function ModelSparkline({
  values,
  labels = [],
  tone = "primary",
  title,
  className = "",
  size = "sm",
  peakIndex,
  onBarClick,
}: ModelSparklineProps) {
  const max = Math.max(1, ...values);
  const peak = peakIndex ?? values.reduce((best, v, i) => (v > values[best] ? i : best), 0);
  const total = values.reduce((a, b) => a + b, 0);
  const large = size === "lg";
  const barHeightPx = large ? 40 : 20;
  const barClass = tone === "accent" ? "bg-accent-400" : "bg-primary-400";
  const peakClass = tone === "accent" ? "bg-accent-600" : "bg-primary-600";

  const ariaLabel = useMemo(() => {
    if (!labels.length) return title ?? "Évolution mensuelle des devis";
    return values.map((v, i) => `${labels[i] ?? i + 1} : ${v} devis`).join(", ");
  }, [values, labels, title]);

  return (
    <span className={`group/spark relative inline-flex shrink-0 ${className}`}>
      <span
        className={`inline-flex items-end ${large ? "gap-[3px] h-10" : "gap-[2px] h-5"}`}
        role={onBarClick ? undefined : "img"}
        aria-label={ariaLabel}
        title={!onBarClick && !labels.length ? title : undefined}
      >
        {values.map((v, i) => {
          const height = v <= 0 ? 2 : Math.max(large ? 6 : 4, Math.round((v / max) * barHeightPx));
          const isPeak = i === peak && v > 0;
          const fillClass = v > 0 ? (isPeak ? peakClass : barClass) : "bg-background-300";
          const monthLabel = labels[i] ?? `mois ${i + 1}`;
          // Barre cliquable : ouvre les devis du mois précis (filtre la page Devis sur ce mois).
          if (onBarClick) {
            return (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBarClick(i);
                }}
                className={`${large ? "w-2" : "w-1"} h-full flex items-end justify-center p-0 border-0 bg-transparent cursor-pointer`}
                title={`Voir les devis de ${monthLabel} (${v} devis)`}
                aria-label={`Filtrer les devis sur ${monthLabel}`}
              >
                <span className={`w-full rounded-sm ${fillClass}`} style={{ height: `${height}px` }} />
              </button>
            );
          }
          return (
            <span
              key={i}
              className={`${large ? "w-2" : "w-1"} rounded-sm ${fillClass}`}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </span>

      {labels.length > 0 && (
        <span
          className={`${
            onBarClick ? "pointer-events-auto" : "pointer-events-none"
          } absolute bottom-full right-0 mb-2 z-40 opacity-0 translate-y-1 transition-all duration-150 group-hover/spark:opacity-100 group-hover/spark:translate-y-0`}
        >
          <span className="block rounded-md bg-foreground-950 text-background-50 px-3 py-2 min-w-[176px]">
            <span className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-background-50/70">Devis par mois</span>
              <span className="text-[10px] text-background-50/50">12 mois</span>
            </span>
            <span className="flex flex-col gap-1">
              {values.map((v, i) => (
                <span key={i} className="flex items-center justify-between gap-3 text-[11px]">
                  <span
                    className={`capitalize ${i === peak && v > 0 ? "font-semibold text-accent-300" : "text-background-50/80"}`}
                  >
                    {labels[i]}
                    {i === peak && v > 0 ? " · pic" : ""}
                  </span>
                  <span className={`shrink-0 font-semibold whitespace-nowrap ${v > 0 ? "" : "text-background-50/40"}`}>
                    {v} devis
                  </span>
                </span>
              ))}
            </span>
            <span className="mt-1.5 pt-1.5 border-t border-background-50/15 flex items-center justify-between text-[10px] text-background-50/60">
              <span>{total} devis sur 12 mois</span>
              <span>moy. {(total / 12).toFixed(1)}/mois</span>
            </span>
            {onBarClick && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBarClick(values.length - 1);
                }}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 h-7 rounded-md bg-background-50 text-foreground-950 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
                title="Ouvrir la page Devis filtrée sur le mois en cours"
              >
                <i className="ri-file-text-line"></i>
                Voir les devis de ce mois
              </button>
            )}
          </span>
        </span>
      )}
    </span>
  );
}