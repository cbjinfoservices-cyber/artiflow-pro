import { useMemo } from "react";
import type { EscaladeJournalItem } from "@/hooks/useArtisanData";

interface Props {
  /** Passages d'escalade du compte (servent au mini-graphe). */
  journal: EscaladeJournalItem[];
}

/** Clé locale « AAAA-MM-JJ » d'une date (évite les décalages UTC). */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Récap visuel compact des passages de la tâche planifiée sur les 30 derniers jours :
 * une barre par jour (nombre de passages), avec le total, le nombre de jours actifs et
 * le pic. Placé au-dessus du journal pour donner un coup d'œil immédiat à la cadence serveur.
 */
export default function JournalPassagesSpark({ journal }: Props) {
  // 30 derniers jours (aujourd'hui inclus), du plus ancien au plus récent.
  const buckets = useMemo(() => {
    const comptes = new Map<string, number>();
    journal.forEach((run) => {
      const t = Date.parse(run.run_at);
      if (Number.isNaN(t)) return;
      const key = dayKey(new Date(t));
      comptes.set(key, (comptes.get(key) ?? 0) + 1);
    });
    const jours: { day: string; label: string; passages: number }[] = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      jours.push({
        day: key,
        label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        passages: comptes.get(key) ?? 0,
      });
    }
    return jours;
  }, [journal]);

  const total = buckets.reduce((sum, b) => sum + b.passages, 0);
  const joursActifs = buckets.filter((b) => b.passages > 0).length;
  const max = Math.max(...buckets.map((b) => b.passages), 1);
  const pic = buckets.reduce(
    (best, b) => (b.passages > best.passages ? b : best),
    buckets[0] ?? { day: "", label: "", passages: 0 },
  );

  return (
    <div className="mt-3 p-3 rounded-md bg-background-50 border border-background-200">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-semibold text-foreground-700 inline-flex items-center gap-1.5">
          <i className="ri-pulse-line"></i>
          Passages des 30 derniers jours
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
            <i className="ri-stack-line text-secondary-600"></i>
            <strong className="text-foreground-800">{total}</strong> passage{total > 1 ? "s" : ""}
          </span>
          <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
            <i className="ri-calendar-check-line text-secondary-600"></i>
            <strong className="text-foreground-800">{joursActifs}</strong> jour{joursActifs > 1 ? "s" : ""} actif
            {joursActifs > 1 ? "s" : ""}
          </span>
          {total > 0 && (
            <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
              <i className="ri-medal-line text-accent-600"></i>
              Pic : {pic.passages} le {pic.day.slice(8, 10)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-end gap-1 h-14">
        {buckets.map((b) => {
          const heightPct = Math.max((b.passages / max) * 100, b.passages > 0 ? 12 : 5);
          return (
            <div
              key={b.day}
              className="flex-1 min-w-0 flex flex-col items-center justify-end h-full"
              title={`${b.label} · ${b.passages} passage${b.passages > 1 ? "s" : ""}`}
            >
              <div
                className={`w-full rounded-t-sm ${b.passages > 0 ? "bg-secondary-500" : "bg-background-300"}`}
                style={{ height: `${heightPct}%` }}
              ></div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] text-foreground-400">{buckets[0]?.day.slice(8, 10)}/{buckets[0]?.day.slice(5, 7)}</span>
        <span className="text-[9px] text-foreground-400">aujourd'hui</span>
      </div>
    </div>
  );
}