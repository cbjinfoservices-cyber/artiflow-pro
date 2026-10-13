import { useEffect, useRef, useState } from "react";
import { formatEuros } from "@/lib/format";
import type { PointActiviteOffres } from "@/hooks/useActiviteOffresAbonnement";

/**
 * Mini-graphe de volatilité d'un abonnement : des barres pour le nombre de changements
 * d'offre par mois et une courbe pour le montant mensuel en vigueur. Rendu 100 % CSS
 * (barres + segments positionnés au pixel mesuré), sans dépendance graphique.
 */
export default function SparklineActiviteOffres({
  points,
  className = "",
}: {
  points: PointActiviteOffres[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const n = Math.max(points.length, 1);
  const height = 76;
  const padTop = 12;
  const padBottom = 6;
  const usableH = height - padTop - padBottom;

  const maxCh = Math.max(1, ...points.map((p) => p.changements));
  const montantsValides = points
    .map((p) => p.montant)
    .filter((m): m is number => m !== null && m > 0);
  const minM = montantsValides.length ? Math.min(...montantsValides) : 0;
  const maxM = montantsValides.length ? Math.max(...montantsValides) : 1;
  const span = maxM - minM || 1;

  const colW = w / n;
  const xOf = (i: number) => i * colW + colW / 2;
  const yOf = (m: number) => padTop + (1 - (m - minM) / span) * usableH;

  const segments: Array<{ left: number; top: number; len: number; ang: number }> = [];
  if (w > 0) {
    for (let i = 0; i < points.length - 1; i += 1) {
      const m1 = points[i].montant;
      const m2 = points[i + 1].montant;
      if (m1 === null || m2 === null || m1 <= 0 || m2 <= 0) continue;
      const x1 = xOf(i);
      const y1 = yOf(m1);
      const x2 = xOf(i + 1);
      const y2 = yOf(m2);
      const dx = x2 - x1;
      const dy = y2 - y1;
      segments.push({ left: x1, top: y1, len: Math.hypot(dx, dy), ang: (Math.atan2(dy, dx) * 180) / Math.PI });
    }
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-4 text-[10px] text-foreground-500 mb-1.5">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-primary-300 inline-block"></span>
          Changements d'offre
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full bg-accent-500 inline-block"></span>
          Montant mensuel
        </span>
      </div>

      <div ref={ref} className="relative" style={{ height: `${height}px` }}>
        {points.map((p, i) => {
          const h = p.changements <= 0 ? 2 : Math.max(5, Math.round((p.changements / maxCh) * usableH));
          return (
            <span
              key={`b${i}`}
              className="absolute bottom-0 flex justify-center"
              style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
            >
              <span
                className={`rounded-sm ${p.changements > 0 ? "bg-primary-300" : "bg-background-300"}`}
                style={{ width: "54%", height: `${h}px` }}
              />
            </span>
          );
        })}

        {segments.map((s, i) => (
          <span
            key={`s${i}`}
            className="absolute bg-accent-500"
            style={{
              left: `${s.left}px`,
              top: `${s.top - 1}px`,
              width: `${s.len}px`,
              height: "2px",
              transformOrigin: "left center",
              transform: `rotate(${s.ang}deg)`,
            }}
          />
        ))}

        {w > 0 &&
          points.map((p, i) =>
            p.montant && p.montant > 0 ? (
              <span
                key={`d${i}`}
                className="absolute w-2 h-2 rounded-full bg-accent-600 border-2 border-background-50"
                style={{ left: `${xOf(i) - 4}px`, top: `${yOf(p.montant) - 4}px` }}
              />
            ) : null,
          )}

        {points.map((p, i) => {
          const montantTxt =
            p.montant && p.montant > 0 ? `${formatEuros(p.montant)}/mois` : "aucun montant";
          return (
            <span
              key={`h${i}`}
              className="absolute top-0 bottom-0 z-10"
              style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
              title={`${p.label} : ${p.changements} changement(s) · ${montantTxt}`}
            />
          );
        })}
      </div>

      <div className="relative mt-1" style={{ height: "14px" }}>
        {points.map((p, i) => (
          <span
            key={`l${i}`}
            className="absolute text-[9px] text-foreground-400 capitalize text-center"
            style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}