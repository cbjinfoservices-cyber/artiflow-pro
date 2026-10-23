import { useEffect, useState } from "react";

/** Heure d'ouverture de l'équipe (heure de Paris). */
const OUVRE_HEURES = 9;
/** Heure de fermeture de l'équipe (heure de Paris). */
const FERME_HEURES = 18;

export type StatutOuverture = {
  /** Vrai si l'équipe est joignable à l'instant présent. */
  ouvert: boolean;
  /** Libellé court du statut : « Ouvert maintenant » ou « Fermé ». */
  libelle: string;
  /** Précision utile : « Fermeture à 18 h », « Réouvre lundi à 9 h »… */
  detail: string;
};

type HeureParis = { jour: number; minutes: number };

/**
 * Récupère l'heure courante telle qu'elle est vécue à Paris (l'entreprise est française),
 * quel que soit le fuseau du visiteur.
 */
function heureDeParis(date: Date): HeureParis {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const lire = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };

  const annee = lire("year");
  const mois = lire("month");
  const jourDuMois = lire("day");
  let heures = lire("hour");
  if (heures === 24) heures = 0;

  // Jour de la semaine (0 = dimanche … 6 = samedi), calculé à partir de la date locale de Paris.
  const jour = new Date(Date.UTC(annee, mois - 1, jourDuMois)).getUTCDay();

  return { jour, minutes: heures * 60 + lire("minute") };
}

function calculer(date: Date): StatutOuverture {
  const { jour, minutes } = heureDeParis(date);
  const ouvre = OUVRE_HEURES * 60;
  const ferme = FERME_HEURES * 60;
  const jourOuvre = jour >= 1 && jour <= 5; // lundi → vendredi

  if (jourOuvre && minutes >= ouvre && minutes < ferme) {
    return { ouvert: true, libelle: "Ouvert maintenant", detail: `Fermeture à ${FERME_HEURES} h` };
  }

  if (jourOuvre && minutes < ouvre) {
    return { ouvert: false, libelle: "Fermé", detail: `Ouvre aujourd'hui à ${OUVRE_HEURES} h` };
  }

  // En dehors des heures ouvrées : on indique quand l'équipe réouvre.
  if (jour === 6) {
    return { ouvert: false, libelle: "Fermé", detail: `Réouvre lundi à ${OUVRE_HEURES} h` };
  }
  if (jour === 5) {
    return { ouvert: false, libelle: "Fermé", detail: `Réouvre lundi à ${OUVRE_HEURES} h` };
  }
  if (jour === 0) {
    return { ouvert: false, libelle: "Fermé", detail: `Réouvre demain à ${OUVRE_HEURES} h` };
  }
  return { ouvert: false, libelle: "Fermé", detail: `Réouvre demain à ${OUVRE_HEURES} h` };
}

/**
 * Statut d'ouverture de l'équipe support, recalculé régulièrement (toutes les minutes)
 * pour offrir un repère immédiat au visiteur : « Ouvert maintenant » ou « Fermé ».
 */
export function useStatutOuverture(): StatutOuverture {
  const [statut, setStatut] = useState<StatutOuverture>(() => calculer(new Date()));

  useEffect(() => {
    const rafraichir = () => setStatut(calculer(new Date()));
    rafraichir();
    const id = window.setInterval(rafraichir, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return statut;
}

export default useStatutOuverture;