/**
 * Mémorisation de la dernière semaine consultée depuis le mini-graphe de tendance de « Santé du
 * compte ». Quand l'artisan clique une barre puis choisit d'ouvrir les relances ou la comptabilité
 * de cette semaine, on retient la semaine et la vue choisie : à la prochaine visite du tableau de
 * bord, un raccourci « Reprendre la semaine du X » permet de la rouvrir en un clic.
 *
 * La semaine est un lundi au format « AAAA-MM-JJ » ; la cible est la vue ouverte (relances ou
 * comptabilité). Préférence purement locale (aucune donnée métier).
 */

import { ecrireBrut, lireBrut } from "@/lib/stockageLocal";

/** Vue ouverte pour une semaine : la liste des relances, ou l'espace comptabilité. */
export type SanteSemaineCible = "relances" | "comptabilite";

/** Dernière semaine consultée : le lundi concerné et la vue choisie. */
export interface DerniereSemaineConsultee {
  /** Lundi de la semaine concernée (« AAAA-MM-JJ »). */
  semaine: string;
  /** Vue ouverte pour cette semaine. */
  cible: SanteSemaineCible;
}

/** Clé de mémorisation locale de la dernière semaine consultée. */
const SANTE_SEMAINE_STORAGE_KEY = "artiflow.sante.derniereSemaine";

/** Événement émis quand la dernière semaine consultée change, pour synchroniser les composants. */
export const SANTE_SEMAINE_EVENT = "artiflow:sante-semaine";

/** Relit la dernière semaine consultée (null si absente ou invalide). */
export function lireDerniereSemaineConsultee(): DerniereSemaineConsultee | null {
  try {
    const raw = lireBrut(SANTE_SEMAINE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DerniereSemaineConsultee> | null;
    if (!parsed || typeof parsed.semaine !== "string") return null;
    if (parsed.cible !== "relances" && parsed.cible !== "comptabilite") return null;
    return { semaine: parsed.semaine, cible: parsed.cible };
  } catch {
    return null;
  }
}

/** Retient la dernière semaine consultée pour la reproposer à la prochaine visite. */
export function ecrireDerniereSemaineConsultee(consult: DerniereSemaineConsultee): void {
  try {
    ecrireBrut(SANTE_SEMAINE_STORAGE_KEY, JSON.stringify(consult));
    window.dispatchEvent(new CustomEvent(SANTE_SEMAINE_EVENT, { detail: consult }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}