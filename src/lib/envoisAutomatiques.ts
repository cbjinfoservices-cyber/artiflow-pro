import { formatShortDate } from "@/lib/dates";

/** État global d'une automatisation, affiché par une pastille de couleur. */
export type AutoStatut = "ok" | "attention" | "inactif" | "inconnu";

/** Nature d'un traitement automatique : un récapitulatif envoyé, ou une automatisation d'action. */
export type CategorieAuto = "recap" | "automatisation";

/** Une automatisation suivie par la page de vérification des envois automatiques. */
export interface AutoItem {
  /** Identifiant stable (sert de clé React et de repère interne). */
  id: string;
  /** Nature du traitement (récap ou automatisation), pour regrouper le bandeau du menu. */
  categorie: CategorieAuto;
  /** Nom affiché de l'automatisation. */
  nom: string;
  /** Petite description de ce que fait l'automatisation. */
  description: string;
  /** Classe d'icône Remix affichée dans la pastille de gauche. */
  icone: string;
  /** Fréquence de passage (hebdomadaire, quotidienne, mensuelle…). */
  frequence: string;
  /** Page de l'application liée (réglages / historique), ouverte depuis la carte. */
  lien: string;
  /** Libellé du bouton qui ouvre `lien`. */
  lienLabel: string;
  /** L'automatisation est activée par un réglage de l'utilisateur. */
  actif: boolean;
  /** L'automatisation est temporairement suspendue (ex. pause vacances). */
  enPause: boolean;
  /** Date (ISO) du dernier passage réellement effectué, ou null. */
  dernierPassage: string | null;
  /** Détail court du dernier passage (comptes concernés, envois, mois…), ou null. */
  dernierDetail: string | null;
  /** Date (ISO) de la prochaine exécution prévue, ou null si non calculable. */
  prochaine: string | null;
  /** Libellé prêt à l'affichage de la prochaine exécution (ex. « demain à 08:00 »). */
  prochaineLibelle: string;
  /** Le passage laisse une trace exploitable en base (sinon la date n'est pas fiable). */
  tracable: boolean;
  /** État synthétique affiché par la pastille. */
  statut: AutoStatut;
  /** Remarque complémentaire expliquant une limite ou un point d'attention. */
  note: string | null;
}

/** Nombre de jours entiers écoulés depuis une date, ou l'infini si inconnue. */
export function joursDepuis(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

/** Date courte d'un horodatage (« 12 oct. 2026 »), ou « — ». */
export function formatJour(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return formatShortDate(iso);
}

/** Nombre de jours entiers séparant deux dates (au jour près). */
function ecartJours(a: Date, b: Date): number {
  const ja = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const jb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((ja - jb) / 86400000);
}

/** Libellé d'une échéance future : « aujourd'hui à 08:00 », « demain à 08:00 », « dans N j », sinon la date. */
export function libelleEcheance(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const jours = ecartJours(d, new Date());
  if (jours === 0) return `aujourd'hui à ${heure}`;
  if (jours === 1) return `demain à ${heure}`;
  if (jours > 1 && jours <= 7) return `dans ${jours} jours (${formatShortDate(iso)})`;
  return formatShortDate(iso);
}

/** Prochaine occurrence d'un jour du mois à une heure donnée (mensuel). */
export function prochainMensuel(jour: number, heure: number, now: Date = new Date()): string {
  const j = Math.min(28, Math.max(1, Math.round(Number.isFinite(jour) && jour > 0 ? jour : 1)));
  const h = Math.min(23, Math.max(0, Math.round(Number.isFinite(heure) ? heure : 8)));
  let d = new Date(now.getFullYear(), now.getMonth(), j, h, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d = new Date(now.getFullYear(), now.getMonth() + 1, j, h, 0, 0, 0);
  return d.toISOString();
}

/** Prochaine occurrence annuelle en janvier, à un jour et une heure donnés. */
export function prochainAnnuel(jour: number, heure: number, now: Date = new Date()): string {
  const j = Math.min(28, Math.max(1, Math.round(Number.isFinite(jour) && jour > 0 ? jour : 5)));
  const h = Math.min(23, Math.max(0, Math.round(Number.isFinite(heure) ? heure : 8)));
  let d = new Date(now.getFullYear(), 0, j, h, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d = new Date(now.getFullYear() + 1, 0, j, h, 0, 0, 0);
  return d.toISOString();
}

/** Prochaine occurrence quotidienne à une heure donnée (aujourd'hui ou demain). */
export function prochainQuotidien(heure: number, now: Date = new Date()): string {
  const h = Math.min(23, Math.max(0, Math.round(Number.isFinite(heure) ? heure : 8)));
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0, 0);
  if (d.getTime() <= now.getTime()) d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, 0, 0, 0);
  return d.toISOString();
}

/** Prochaine heure pleine (pour un passage horaire). */
export function prochainHoraire(now: Date = new Date()): string {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

/**
 * Prochaine occurrence d'un jour de la semaine (1 = lundi … 7 = dimanche) à une heure donnée.
 * Sert à calculer l'échéance d'un envoi hebdomadaire (ex. récap hebdo le lundi à 08:00).
 */
export function prochainHebdo(jour: number, heure: number, now: Date = new Date()): string {
  const cible = Math.min(7, Math.max(1, Math.round(Number.isFinite(jour) && jour > 0 ? jour : 1)));
  const h = Math.min(23, Math.max(0, Math.round(Number.isFinite(heure) ? heure : 8)));
  // JS : 0 = dimanche … 6 = samedi. Convention Backend : 1 = lundi … 7 = dimanche.
  const jsCible = cible % 7;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0, 0);
  let delta = (jsCible - d.getDay() + 7) % 7;
  if (delta === 0 && d.getTime() <= now.getTime()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d.toISOString();
}

/**
 * Détermine l'état d'une automatisation à partir de son activation et de son dernier passage.
 * `toleranceJours` est le délai au-delà duquel l'absence de passage devient suspecte pour
 * la fréquence concernée (ex. 8 jours pour un récap hebdomadaire).
 */
export function calculerStatut(params: {
  actif: boolean;
  enPause?: boolean;
  tracable: boolean;
  dernierPassage: string | null;
  toleranceJours: number;
  /** Nombre de points d'attention métier (ex. échecs d'envoi) forcant le statut « attention ». */
  alertes?: number;
}): AutoStatut {
  const { actif, enPause = false, tracable, dernierPassage, toleranceJours, alertes = 0 } = params;
  if (!actif || enPause) return "inactif";
  if (alertes > 0) return "attention";
  if (!tracable) return "inconnu";
  if (!dernierPassage) return "attention";
  return joursDepuis(dernierPassage) <= toleranceJours ? "ok" : "attention";
}

/** Fenêtre « imminente » par défaut : une exécution prévue dans l'heure déclenche le rappel du menu. */
export const FENETRE_IMMINENTE_MS = 60 * 60 * 1000;

/** Une automatisation (ou un récap) dont l'exécution approche à moins d'une heure. */
export interface ExecutionImminente {
  /** L'automatisation concernée (nom, icône, page liée…). */
  item: AutoItem;
  /** Date/heure prévue de l'exécution. */
  date: Date;
  /** Millisecondes restantes avant l'exécution. */
  dansMs: number;
}

/**
 * Grille de rappel chronologique : sélectionne les automatisations actives (non en pause) dont la
 * prochaine exécution tombe dans la fenêtre fournie (une heure par défaut), triées de la plus proche
 * à la plus lointaine. La fenêtre est réglable (15 / 30 / 60 min) : elle pilote à la fois le bandeau
 * du menu, le badge « Imminents » de l'en-tête et la notification navigateur.
 */
export function executionsImminentes(
  items: AutoItem[],
  now: Date = new Date(),
  fenetreMs: number = FENETRE_IMMINENTE_MS,
): ExecutionImminente[] {
  const t = now.getTime();
  const borne = Number.isFinite(fenetreMs) && fenetreMs > 0 ? fenetreMs : FENETRE_IMMINENTE_MS;
  return items
    .filter((item) => item.actif && !item.enPause && item.prochaine)
    .map((item) => {
      const date = new Date(item.prochaine as string);
      return { item, date, dansMs: date.getTime() - t };
    })
    .filter((e) => !Number.isNaN(e.date.getTime()) && e.dansMs >= 0 && e.dansMs <= borne)
    .sort((a, b) => a.dansMs - b.dansMs);
}

/** Libellé court du délai restant avant une exécution (« dans 42 min », « dans moins d'1 min »). */
export function libelleDans(dansMs: number): string {
  const minutes = Math.round(dansMs / 60000);
  if (minutes <= 1) return "dans moins d'1 min";
  return `dans ${minutes} min`;
}