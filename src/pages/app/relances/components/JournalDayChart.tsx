import { useMemo, useState } from "react";

export interface JournalDayBucket {
  day: string;
  label: string;
  passages: number;
  envois: number;
  echoue: number;
}

interface Props {
  days: JournalDayBucket[];
  selectedDay: string;
  onSelect: (day: string) => void;
}

// Fenêtres proposées pour zoomer sur l'activité récente.
const PERIODES = [
  { value: 7, label: "7 j" },
  { value: 30, label: "30 j" },
  { value: 90, label: "90 j" },
] as const;
const PERIODE_DEFAUT = 30;

/** Clé locale « AAAA-MM-JJ » d'une date (évite les décalages UTC). */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Mini-graphe « envois par jour » du journal d'escalade serveur.
 * Chaque barre représente une journée ; la portion rouge signale les échecs d'envoi.
 * Un clic filtre le journal sur ce jour (re-clic pour revenir à la vue globale).
 * Un sélecteur de période (7 / 30 / 90 j) permet de zoomer sur l'activité récente.
 */
export default function JournalDayChart({ days, selectedDay, onSelect }: Props) {
  const [periode, setPeriode] = useState<number>(PERIODE_DEFAUT);

  // Du plus ancien au plus récent pour une lecture naturelle de gauche à droite.
  const ordered = useMemo(() => [...days].sort((a, b) => a.day.localeCompare(b.day)), [days]);

  // Début de la fenêtre sélectionnée (aujourd'hui - (période - 1) jours).
  const cutoff = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (periode - 1));
    return dayKey(d);
  }, [periode]);

  const windowed = useMemo(() => ordered.filter((d) => d.day >= cutoff), [ordered, cutoff]);

  const max = Math.max(...windowed.map((d) => d.envois + d.echoue), 1);
  const total = windowed.reduce((sum, d) => sum + d.envois, 0);
  const totalEchoue = windowed.reduce((sum, d) => sum + d.echoue, 0);
  const busiest = windowed.reduce(
    (best, d) => (d.envois + d.echoue > best.envois + best.echoue ? d : best),
    windowed[0] ?? { day: "", label: "", passages: 0, envois: 0, echoue: 0 },
  );
  // Moyenne d'envois par jour sur la journée active de la fenêtre.
  const moyenne = windowed.length > 0 ? total / windowed.length : 0;

  // Total cumulé du mois en cours (calculé sur l'ensemble des passages, hors fenêtre).
  const moisPrefixe = useMemo(() => dayKey(new Date()).slice(0, 7), []);
  const totalMois = useMemo(
    () => ordered.filter((d) => d.day.slice(0, 7) === moisPrefixe).reduce((sum, d) => sum + d.envois, 0),
    [ordered, moisPrefixe],
  );

  // Échelle du mini-graphe de tendance (plus grand nombre d'échecs sur un jour de la fenêtre).
  const maxEchoue = useMemo(() => Math.max(...windowed.map((d) => d.echoue), 1), [windowed]);

  // Verdict de tendance : compare la moitié récente de la fenêtre à la moitié précédente
  // pour dire si les échecs s'aggravent ou se résorbent.
  const tendance = useMemo<"up" | "down" | "stable" | null>(() => {
    if (windowed.length < 2 || totalEchoue === 0) return null;
    const half = Math.floor(windowed.length / 2);
    const ancienne = windowed.slice(0, half).reduce((sum, d) => sum + d.echoue, 0);
    const recente = windowed.slice(windowed.length - half).reduce((sum, d) => sum + d.echoue, 0);
    if (recente > ancienne) return "up";
    if (recente < ancienne) return "down";
    return "stable";
  }, [windowed, totalEchoue]);

  return (
    <div className="mt-3 p-3 rounded-md bg-background-50 border border-background-200">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-semibold text-foreground-700 inline-flex items-center gap-1.5">
          <i className="ri-bar-chart-2-line"></i>
          Envois par jour
        </p>
        <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
          {PERIODES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriode(p.value)}
              title={`Afficher l'activité des ${p.value} derniers jours`}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                periode === p.value
                  ? "bg-secondary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
          <i className="ri-line-chart-line text-secondary-600"></i>
          Moyenne : <strong className="text-foreground-800">{moyenne.toFixed(1)}</strong> envoi/jour
        </span>
        <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
          <i className="ri-calendar-todo-line text-secondary-600"></i>
          Total du mois : <strong className="text-foreground-800">{totalMois}</strong>
        </span>
        {total > 0 && (
          <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
            <i className="ri-medal-line text-accent-600"></i>
            Pic : {busiest.envois + busiest.echoue} le {busiest.day.slice(8, 10)}
          </span>
        )}
        {totalEchoue > 0 && (
          <span className="text-[11px] text-red-600 inline-flex items-center gap-1">
            <i className="ri-error-warning-line"></i>
            {totalEchoue} échec{totalEchoue > 1 ? "s" : ""}
          </span>
        )}
        <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
          {total} envoi{total > 1 ? "s" : ""} sur {windowed.length} jour{windowed.length > 1 ? "s" : ""}
        </span>
      </div>

      {windowed.length === 0 ? (
        <p className="text-[11px] text-foreground-500 py-6 text-center">
          Aucun passage automatique sur les {periode} derniers jours.
        </p>
      ) : (
        <div className="flex items-end gap-1.5 h-24">
          {windowed.map((d) => {
            const active = selectedDay === d.day;
            const cumul = d.envois + d.echoue;
            const heightPct = Math.max((cumul / max) * 100, cumul > 0 ? 8 : 3);
            const failPct = cumul > 0 ? (d.echoue / cumul) * 100 : 0;
            const sendPct = cumul > 0 ? (d.envois / cumul) * 100 : 0;
            return (
              <button
                key={d.day}
                type="button"
                onClick={() => onSelect(active ? "Tous" : d.day)}
                title={`${d.label} · ${d.passages} passage${d.passages > 1 ? "s" : ""} · ${d.envois} envoi${
                  d.envois > 1 ? "s" : ""
                }${d.echoue > 0 ? ` · ${d.echoue} échec${d.echoue > 1 ? "s" : ""}` : ""}`}
                aria-pressed={active}
                aria-label={`Filtrer le journal sur le ${d.label}`}
                className="flex-1 min-w-0 flex flex-col items-center gap-1 cursor-pointer group"
              >
                <span className={`text-[10px] font-semibold ${active ? "text-foreground-950" : "text-foreground-500"}`}>
                  {d.envois > 0 ? d.envois : ""}
                </span>
                <div
                  className={`w-full rounded-t-sm overflow-hidden ${active ? "ring-2 ring-accent-400" : ""}`}
                  style={{ height: `${heightPct}%` }}
                >
                  {d.echoue > 0 && <div className="w-full bg-red-500" style={{ height: `${failPct}%` }}></div>}
                  {d.envois > 0 && (
                    <div
                      className="w-full bg-accent-400 group-hover:bg-accent-500 transition-colors"
                      style={{ height: `${sendPct}%` }}
                    ></div>
                  )}
                  {cumul === 0 && <div className="w-full h-full bg-background-300"></div>}
                </div>
                <span
                  className={`text-[9px] whitespace-nowrap tabular-nums ${
                    active ? "text-foreground-950 font-semibold" : "text-foreground-400"
                  }`}
                >
                  {d.day.slice(8, 10)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Petite courbe de tendance des échecs : chaque segment représente les échecs d'un jour
          de la fenêtre, avec un verdict « en hausse / en baisse / stable ». */}
      {totalEchoue > 0 && tendance && (
        <div className="mt-3 pt-2.5 border-t border-background-200">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-500 inline-flex items-center gap-1">
              <i className="ri-line-chart-line"></i>
              Tendance des échecs ({periode} j)
            </p>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                tendance === "up"
                  ? "bg-red-100 text-red-700"
                  : tendance === "down"
                    ? "bg-accent-100 text-accent-800"
                    : "bg-background-200 text-foreground-600"
              }`}
            >
              <i
                className={
                  tendance === "up"
                    ? "ri-arrow-up-line"
                    : tendance === "down"
                      ? "ri-arrow-down-line"
                      : "ri-subtract-line"
                }
              ></i>
              {tendance === "up" ? "En hausse" : tendance === "down" ? "En baisse" : "Stable"}
            </span>
          </div>
          <div className="flex items-end gap-0.5 h-8">
            {windowed.map((d) => (
              <div
                key={d.day}
                className="flex-1 min-w-0 flex items-end h-full"
                title={`${d.label} · ${d.echoue} échec${d.echoue > 1 ? "s" : ""}`}
              >
                <div
                  className={`w-full rounded-sm ${d.echoue > 0 ? "bg-red-400" : "bg-background-200"}`}
                  style={{ height: d.echoue > 0 ? `${Math.max((d.echoue / maxEchoue) * 100, 12)}%` : "8%" }}
                ></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}