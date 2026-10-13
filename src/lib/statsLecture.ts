import { articles, readingMinutes } from "@/mocks/ressources";
import { getActivite, getLuAt, getStatut, jourKey } from "@/lib/lecture";

export type StatsLecture = {
  lus: number;
  enCours: number;
  aLire: number;
  total: number;
  pct: number;
  lusCeMois: number;
  minutesInvesties: number;
  minutesRestantes: number;
  serieJours: number;
  joursActifs: number;
};

/** Série de jours consécutifs d'activité, en partant d'aujourd'hui (ou d'hier). */
function calculerSerie(jours: string[]): number {
  const set = new Set(jours);
  const date = new Date();
  if (!set.has(jourKey(date))) {
    date.setDate(date.getDate() - 1);
    if (!set.has(jourKey(date))) return 0;
  }
  let serie = 0;
  while (set.has(jourKey(date))) {
    serie += 1;
    date.setDate(date.getDate() - 1);
  }
  return serie;
}

/** Calcule les statistiques de lecture à partir du suivi local. */
export function calculerStatsLecture(): StatsLecture {
  const maintenant = new Date();
  const moisCourant = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;

  let lus = 0;
  let enCours = 0;
  let lusCeMois = 0;
  let minutesInvesties = 0;
  let minutesRestantes = 0;

  articles.forEach((article) => {
    const statut = getStatut(article.slug);
    const minutes = readingMinutes(article);
    if (statut === "lu") {
      lus += 1;
      minutesInvesties += minutes;
      const luAt = getLuAt(article.slug);
      if (luAt && luAt.startsWith(moisCourant)) lusCeMois += 1;
    } else if (statut === "en-cours") {
      enCours += 1;
      const part = Math.max(1, Math.round(minutes / 2));
      minutesInvesties += part;
      minutesRestantes += minutes - part;
    } else {
      minutesRestantes += minutes;
    }
  });

  const total = articles.length;
  const pct = total > 0 ? Math.round((lus / total) * 100) : 0;
  const jours = getActivite();

  return {
    lus,
    enCours,
    aLire: total - lus - enCours,
    total,
    pct,
    lusCeMois,
    minutesInvesties,
    minutesRestantes,
    serieJours: calculerSerie(jours),
    joursActifs: jours.length,
  };
}