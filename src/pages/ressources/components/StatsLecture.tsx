import { useMemo } from "react";
import { calculerStatsLecture } from "@/lib/statsLecture";
import { useLectureVersion } from "@/hooks/useLectureStatut";

type Carte = { icon: string; value: string; label: string; hint: string; accent: string; icone: string };

/**
 * Bandeau de statistiques de lecture : guides lus au total, lus ce mois-ci,
 * temps de lecture cumulé et jours consécutifs d'activité.
 */
export default function StatsLecture() {
  const version = useLectureVersion();
  const stats = useMemo(() => calculerStatsLecture(), [version]);

  const cartes: Carte[] = [
    {
      icon: "ri-check-double-line",
      value: `${stats.lus}/${stats.total}`,
      label: "Guides lus",
      hint: `${stats.pct}% du catalogue`,
      icone: "ri-book-open-line",
      accent: "bg-primary-100 text-primary-700",
    },
    {
      icon: "ri-calendar-check-line",
      value: `${stats.lusCeMois}`,
      label: "Lus ce mois-ci",
      hint: stats.lusCeMois > 1 ? "guides terminés" : "guide terminé",
      icone: "ri-calendar-line",
      accent: "bg-accent-100 text-accent-700",
    },
    {
      icon: "ri-timer-line",
      value: `${stats.minutesInvesties} min`,
      label: "Temps de lecture",
      hint: `${stats.minutesRestantes} min restantes`,
      icone: "ri-hourglass-line",
      accent: "bg-secondary-100 text-secondary-700",
    },
    {
      icon: "ri-fire-line",
      value: `${stats.serieJours}`,
      label: stats.serieJours > 1 ? "Jours d'affilée" : "Jour d'affilée",
      hint: `${stats.joursActifs} jours actifs au total`,
      icone: "ri-calendar-check-line",
      accent: "bg-accent-100 text-accent-800",
    },
  ];

  return (
    <section className="w-full bg-background-100 border-b border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-8 md:py-10">
        <div className="mb-5">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
            <i className="ri-bar-chart-box-line"></i>
            Votre lecture en chiffres
          </span>
          <h2 className="mt-2 font-heading font-bold text-xl md:text-2xl text-foreground-950 tracking-tight">
            Statistiques de lecture
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cartes.map((carte) => (
            <div
              key={carte.label}
              className="p-5 rounded-lg bg-background-50 border border-background-200"
            >
              <span className={`w-10 h-10 flex items-center justify-center rounded-lg text-lg ${carte.accent}`}>
                <i className={carte.icon}></i>
              </span>
              <p className="mt-3 font-heading font-bold text-2xl text-foreground-950 tabular-nums">
                {carte.value}
              </p>
              <p className="text-sm font-semibold text-foreground-800">{carte.label}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-foreground-500">
                <i className={carte.icone}></i>
                {carte.hint}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}