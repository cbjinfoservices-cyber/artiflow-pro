import type { LienAuthTestEntree } from "@/lib/liensAuthTestsMemoire";

/** Fenêtre affichée par le graphique de régularité des liens d'authentification (nombre de barres). */
export type FenetreRegularite = "tous" | "30j" | "6s";

/** Nombre de semaines affichées par la fenêtre par défaut (« 6 semaines »). */
export const NB_SEMAINES_REGULARITE = 6;

/** Nombre de fenêtres hebdomadaires couvrant les 30 derniers jours (30 / 7 ≈ 4,3 → 5 barres). */
export const SEMAINES_FENETRE_30J = 5;

/** Nombre maximum de fenêtres hebdomadaires affichées (garde-fou pour la fenêtre « Tous »). */
const MAX_SEMAINES_FENETRE = 104;

/** Étiquettes des fenêtres proposées dans la légende du graphique (de la plus large à la plus fine). */
export const FENETRES_REGULARITE: { key: FenetreRegularite; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "30j", label: "30 jours" },
  { key: "6s", label: "6 semaines" },
];

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Une fenêtre hebdomadaire du graphique de régularité. */
export interface SemaineRegularite {
  /** Nombre de semaines en arrière depuis aujourd'hui : 0 = semaine en cours. */
  semainesAgo: number;
  /** Début de la fenêtre (inclus), en millisecondes. */
  debut: number;
  /** Fin de la fenêtre (exclue), en millisecondes. */
  fin: number;
  /** Nombre d'essais relancés dans la fenêtre. */
  count: number;
  /** Libellé court (« jj/mm ») du début de semaine. */
  label: string;
  /** La fenêtre couvre-t-elle la semaine en cours ? */
  estCourante: boolean;
}

/** Formate un jour en « jj/mm » court pour l'axe du graphique. */
function formaterJour(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/** Libellé lisible d'une fenêtre, repris dans l'en-tête du graphique et le PNG exporté. */
export function libelleFenetre(fenetre: FenetreRegularite): string {
  if (fenetre === "30j") return "30 derniers jours";
  if (fenetre === "tous") return "tout l'historique";
  return `${NB_SEMAINES_REGULARITE} dernières semaines`;
}

/**
 * Nombre de fenêtres hebdomadaires couvertes par une fenêtre donnée : 6 pour « 6 semaines », 5 pour
 * « 30 jours », et, pour « Tous », le nombre de semaines écoulées depuis l'essai le plus ancien
 * (au moins 6, borné à deux ans).
 */
export function nbSemainesFenetre(
  fenetre: FenetreRegularite,
  entrees: LienAuthTestEntree[],
  maintenant: number = Date.now(),
): number {
  if (fenetre === "6s") return NB_SEMAINES_REGULARITE;
  if (fenetre === "30j") return SEMAINES_FENETRE_30J;
  let plusAncien = maintenant;
  entrees.forEach((e) => {
    const t = new Date(e.created_at).getTime();
    if (Number.isFinite(t) && t < plusAncien) plusAncien = t;
  });
  const semaines = Math.ceil((maintenant - plusAncien) / (7 * JOUR_MS)) + 1;
  return Math.max(NB_SEMAINES_REGULARITE, Math.min(semaines, MAX_SEMAINES_FENETRE));
}

/**
 * Construit les fenêtres hebdomadaires (de la plus ancienne à gauche à la plus récente à droite),
 * en comptant les essais de chaque période. Sert à la fois au graphique de régularité et au filtre
 * de la liste, pour garantir des bornes identiques des deux côtés.
 */
export function calculerSemainesRegularite(
  entrees: LienAuthTestEntree[],
  nbSemaines: number = NB_SEMAINES_REGULARITE,
  maintenant: number = Date.now(),
): SemaineRegularite[] {
  const total = Math.max(1, Math.min(nbSemaines, MAX_SEMAINES_FENETRE));
  const semaines: SemaineRegularite[] = [];
  for (let i = total - 1; i >= 0; i -= 1) {
    const fin = maintenant - i * 7 * JOUR_MS;
    const debut = fin - 7 * JOUR_MS;
    const count = entrees.filter((e) => {
      const t = new Date(e.created_at).getTime();
      return Number.isFinite(t) && t > debut && t <= fin;
    }).length;
    semaines.push({
      semainesAgo: i,
      debut,
      fin,
      count,
      label: formaterJour(debut),
      estCourante: i === 0,
    });
  }
  return semaines;
}

/** Vrai si l'essai tombe dans la fenêtre hebdomadaire donnée (mêmes bornes que le graphique). */
export function estDansSemaine(entree: LienAuthTestEntree, semaine: SemaineRegularite): boolean {
  const t = new Date(entree.created_at).getTime();
  return Number.isFinite(t) && t > semaine.debut && t <= semaine.fin;
}

/**
 * Essais tombant dans une fenêtre hebdomadaire, du plus récent au plus ancien. Sert au détail
 * affiché dans l'info-bulle d'une barre « en hausse » (dates et adresses des essais concernés).
 */
export function essaisSemaine(
  entrees: LienAuthTestEntree[],
  semaine: SemaineRegularite,
): LienAuthTestEntree[] {
  return entrees
    .filter((e) => estDansSemaine(e, semaine))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/** Adresse la plus testée sur une période : nombre d'essais associé, pour l'info-bulle. */
export interface AdresseTestee {
  /** Adresse email testée le plus souvent sur la période. */
  email: string;
  /** Nombre d'essais relancés vers cette adresse sur la période. */
  count: number;
}

/**
 * Adresse la plus testée d'une fenêtre hebdomadaire (info-bulle d'une barre du graphique).
 * Renvoie null si la semaine ne compte aucun essai. En cas d'égalité, l'adresse la plus
 * ancienne dans l'ordre alphabétique est retenue pour rester stable d'un affichage à l'autre.
 */
export function adresseLaPlusTestee(
  entrees: LienAuthTestEntree[],
  semaine: SemaineRegularite,
): AdresseTestee | null {
  const compte = new Map<string, AdresseTestee>();
  entrees.forEach((e) => {
    if (!estDansSemaine(e, semaine)) return;
    const cle = e.email.toLowerCase();
    const courant = compte.get(cle);
    if (courant) courant.count += 1;
    else compte.set(cle, { email: e.email, count: 1 });
  });
  let meilleur: AdresseTestee | null = null;
  compte.forEach((v) => {
    if (
      !meilleur ||
      v.count > meilleur.count ||
      (v.count === meilleur.count && v.email.localeCompare(meilleur.email) < 0)
    ) {
      meilleur = { email: v.email, count: v.count };
    }
  });
  return meilleur;
}

/** Une adresse email testée et le nombre d'essais qui lui sont associés (filtre par adresse). */
export interface AdresseComptee {
  /** Adresse email testée (telle que saisie au premier essai). */
  email: string;
  /** Nombre d'essais relancés vers cette adresse sur tout l'historique. */
  count: number;
}

/**
 * Adresses distinctes testées, triées par nombre d'essais décroissant (puis alphabétiquement en
 * cas d'égalité). Sert au filtre par adresse du graphique : une même adresse saisie en plusieurs
 * casses (ou avec des espaces) ne compte qu'une fois.
 */
export function adressesTestees(entrees: LienAuthTestEntree[]): AdresseComptee[] {
  const compte = new Map<string, AdresseComptee>();
  entrees.forEach((e) => {
    const email = e.email.trim();
    if (!email) return;
    const cle = email.toLowerCase();
    const courant = compte.get(cle);
    if (courant) courant.count += 1;
    else compte.set(cle, { email, count: 1 });
  });
  return [...compte.values()].sort(
    (a, b) => b.count - a.count || a.email.localeCompare(b.email),
  );
}

/** Sens de la comparaison d'une barre avec la semaine précédente (mini-indicateur de tendance). */
export type TendanceSemaine = "hausse" | "baisse" | "stable";

/**
 * Compare le nombre d'essais d'une fenêtre hebdomadaire à celui de la fenêtre précédente (la barre
 * juste à sa gauche). Renvoie null pour la première barre (aucun point de comparaison) et pour un
 * index hors bornes. « stable » couvre un nombre inchangé.
 */
export function tendanceSemaine(
  semaines: SemaineRegularite[],
  index: number,
): TendanceSemaine | null {
  if (index <= 0 || index >= semaines.length) return null;
  const courant = semaines[index].count;
  const precedent = semaines[index - 1].count;
  if (courant > precedent) return "hausse";
  if (courant < precedent) return "baisse";
  return "stable";
}

/** Une entrée du mini-récap « dernières semaines » affiché dans l'info-bulle d'une barre. */
export interface RecapSemaine {
  /** Nombre de semaines en arrière depuis aujourd'hui (0 = semaine en cours). */
  semainesAgo: number;
  /** Libellé court (« jj/mm ») du début de semaine. */
  label: string;
  /** Nombre d'essais de la semaine. */
  count: number;
  /** La semaine est-elle la semaine en cours ? */
  estCourante: boolean;
  /** Tendance de la semaine comparée à la semaine précédente (null pour la première). */
  tendance: TendanceSemaine | null;
}

/**
 * Mini-récap des « taille » dernières semaines jusqu'à la barre d'index donné (inclus), de la plus
 * ancienne à la plus récente. Sert à l'info-bulle d'une barre pour lire la tendance sur plusieurs
 * semaines d'un coup. La tendance de chaque semaine est comparée à la semaine réellement précédente
 * (même hors du mini-récap), pour rester cohérente avec l'indicateur de la barre.
 */
export function miniRecapSemaines(
  semaines: SemaineRegularite[],
  index: number,
  taille = 3,
): RecapSemaine[] {
  if (index < 0 || index >= semaines.length) return [];
  const debut = Math.max(0, index - Math.max(1, taille) + 1);
  const out: RecapSemaine[] = [];
  for (let i = debut; i <= index; i += 1) {
    const s = semaines[i];
    out.push({
      semainesAgo: s.semainesAgo,
      label: s.label,
      count: s.count,
      estCourante: s.estCourante,
      tendance: tendanceSemaine(semaines, i),
    });
  }
  return out;
}

/** Synthèse de tendance sur toute la fenêtre affichée (indicateur global d'en-tête). */
export interface TendanceGlobale {
  /** Nombre de semaines en hausse (vs semaine précédente). */
  hausses: number;
  /** Nombre de semaines en baisse (vs semaine précédente). */
  baisses: number;
  /** Nombre de semaines au nombre d'essais inchangé. */
  stables: number;
  /** Solde « hausses − baisses » (positif = tendance à la hausse). */
  net: number;
  /** Variation moyenne d'essais par semaine (peut être décimale, signée). */
  moyenne: number;
  /** Sens global retenu pour l'affichage. */
  sens: TendanceSemaine;
}

/**
 * Synthèse de tendance sur toute la fenêtre affichée : nombre de semaines en hausse / en baisse
 * (comparaison à la semaine précédente), solde (« net ») et variation moyenne par semaine. Sert à
 * l'indicateur global de l'en-tête de la carte. Renvoie une tendance stable à zéro quand il n'y a
 * pas au moins deux semaines à comparer.
 */
export function tendanceGlobale(semaines: SemaineRegularite[]): TendanceGlobale {
  const vide: TendanceGlobale = { hausses: 0, baisses: 0, stables: 0, net: 0, moyenne: 0, sens: "stable" };
  if (semaines.length < 2) return vide;
  let hausses = 0;
  let baisses = 0;
  let stables = 0;
  let sommeDelta = 0;
  for (let i = 1; i < semaines.length; i += 1) {
    const delta = semaines[i].count - semaines[i - 1].count;
    sommeDelta += delta;
    if (delta > 0) hausses += 1;
    else if (delta < 0) baisses += 1;
    else stables += 1;
  }
  const paires = semaines.length - 1;
  const moyenne = sommeDelta / paires;
  const net = hausses - baisses;
  const sens: TendanceSemaine = net > 0 ? "hausse" : net < 0 ? "baisse" : "stable";
  return { hausses, baisses, stables, net, moyenne, sens };
}

/**
 * Vrai si un essai tombe dans une fenêtre hebdomadaire « en hausse » (dont le nombre d'essais est
 * supérieur à celui de la semaine réellement précédente). Sert au filtre rapide « semaines en
 * hausse », qui ne liste que les essais des périodes où les tests augmentent. La première barre
 * (sans point de comparaison) n'est jamais considérée comme en hausse, et un essai hors fenêtre
 * affichée est exclu.
 */
export function estDansSemaineEnHausse(
  semaines: SemaineRegularite[],
  entree: LienAuthTestEntree,
): boolean {
  const index = semaines.findIndex((s) => estDansSemaine(entree, s));
  if (index < 0) return false;
  return tendanceSemaine(semaines, index) === "hausse";
}

/**
 * Vrai si un essai tombe dans une fenêtre hebdomadaire « en baisse » (dont le nombre d'essais est
 * inférieur à celui de la semaine réellement précédente). Pendant symétrique de
 * `estDansSemaineEnHausse`, pour le filtre rapide « semaines en baisse » : ne liste que les essais
 * des périodes où les tests diminuent. La première barre (sans point de comparaison) est exclue, et
 * un essai hors fenêtre affichée l'est aussi.
 */
export function estDansSemaineEnBaisse(
  semaines: SemaineRegularite[],
  entree: LienAuthTestEntree,
): boolean {
  const index = semaines.findIndex((s) => estDansSemaine(entree, s));
  if (index < 0) return false;
  return tendanceSemaine(semaines, index) === "baisse";
}

/**
 * Tendance de la semaine d'un essai, comparée à la semaine réellement précédente. Sert à la colonne
 * « Tendance » du CSV (hausse / baisse / stable par ligne). Renvoie null quand l'essai ne tombe dans
 * aucune des fenêtres affichées (aucune comparaison possible).
 */
export function tendanceEssai(
  semaines: SemaineRegularite[],
  entree: LienAuthTestEntree,
): TendanceSemaine | null {
  const index = semaines.findIndex((s) => estDansSemaine(entree, s));
  if (index < 0) return null;
  return tendanceSemaine(semaines, index);
}