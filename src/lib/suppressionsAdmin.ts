import { supabase } from "@/lib/supabase";
import { formaterDateFr } from "@/lib/compte";

/** Une demande de suppression encore dans sa période de grâce, vue par un gestionnaire. */
export interface SuppressionEnAttente {
  id: number;
  user_id: string;
  email: string | null;
  entreprise: string | null;
  demandee_le: string;
  prevue_le: string;
  fin_de_periode_le: string | null;
  details: Record<string, unknown> | null;
}

/**
 * Liste les suppressions de compte encore annulables, pour l'encart back-office.
 *
 * La lecture est autorisée par une politique Backend réservée aux gestionnaires
 * (`est_gestionnaire()`), donc un artisan ne peut jamais voir les demandes des autres.
 */
export async function fetchSuppressionsEnAttente(): Promise<SuppressionEnAttente[]> {
  const { data, error } = await supabase
    .from("suppressions_compte")
    .select("id, user_id, email, entreprise, demandee_le, prevue_le, fin_de_periode_le, details")
    .eq("statut", "programmee")
    .order("prevue_le", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as SuppressionEnAttente[];
}

/** Vrai si le rappel J-7 a déjà été envoyé pour cette demande. */
export function rappelJ7Envoye(details: Record<string, unknown> | null): boolean {
  return typeof details?.rappel_j7_envoye_le === "string";
}

/** Vrai si le rappel J-1 a déjà été envoyé pour cette demande. */
export function rappelJ1Envoye(details: Record<string, unknown> | null): boolean {
  return typeof details?.rappel_j1_envoye_le === "string";
}

/** Nombre de jours restants avant l'effacement réel (arrondi au jour supérieur, jamais négatif). */
export function joursRestantsSuppression(prevueLe: string): number {
  const cible = new Date(prevueLe).getTime();
  if (Number.isNaN(cible)) return 0;
  return Math.max(0, Math.ceil((cible - Date.now()) / (24 * 60 * 60 * 1000)));
}

/** Date d'un marqueur stocké dans `details`, formatée pour l'affichage (chaîne vide si absent). */
export function dateMarqueur(details: Record<string, unknown> | null, cle: string): string {
  const valeur = details?.[cle];
  return typeof valeur === "string" ? formaterDateFr(valeur) : "";
}

/** Vrai si un gestionnaire a déjà relancé cet artisan à la main. */
export function relanceManuelleEnvoyee(details: Record<string, unknown> | null): boolean {
  return typeof details?.relance_manuelle_le === "string";
}

/**
 * Nombre de relances manuelles déjà envoyées pour cette demande.
 * S'appuie sur le compteur `relances_manuelles` tenu par le Backend, avec repli sur
 * la simple présence d'une date de relance pour les demandes plus anciennes.
 */
export function nombreRelancesManuelles(details: Record<string, unknown> | null): number {
  const valeur = Number(details?.relances_manuelles);
  if (Number.isFinite(valeur) && valeur > 0) return Math.floor(valeur);
  return relanceManuelleEnvoyee(details) ? 1 : 0;
}

/**
 * Vrai si l'artisan a été relancé à la main **au moins deux fois** :
 * le signal d'une personne difficile à joindre. Sert au filtre du back-office.
 */
export function relanceManuelleMultiple(details: Record<string, unknown> | null): boolean {
  return nombreRelancesManuelles(details) >= 2;
}

/**
 * Vrai si **aucun** rappel n'est encore parti pour cette demande :
 * ni le rappel automatique J-7, ni le J-1, ni une relance manuelle.
 * Sert au filtre « Jamais rappelés » du back-office.
 */
export function jamaisRappele(details: Record<string, unknown> | null): boolean {
  return !rappelJ7Envoye(details) && !rappelJ1Envoye(details) && !relanceManuelleEnvoyee(details);
}

/** Vrai si la relance manuelle date du mois calendaire en cours. */
export function relanceManuelleCeMois(details: Record<string, unknown> | null): boolean {
  const valeur = details?.relance_manuelle_le;
  if (typeof valeur !== "string") return false;
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return false;
  const maintenant = new Date();
  return date.getFullYear() === maintenant.getFullYear() && date.getMonth() === maintenant.getMonth();
}

/**
 * Vrai si le rappel automatique J-7 est **en retard** : l'échéance arrive dans 3 jours
 * ou moins alors qu'aucun rappel J-7 n'est encore parti. Sert au filtre
 * « Sans rappel J-7 à moins de 3 jours » du back-office.
 */
export function rappelJ7EnRetard(details: Record<string, unknown> | null, prevueLe: string): boolean {
  return joursRestantsSuppression(prevueLe) <= 3 && !rappelJ7Envoye(details);
}

/**
 * Compte les relances manuelles effectuées depuis le 1er du mois courant,
 * toutes demandes confondues (y compris celles annulées depuis).
 * En cas d'échec de lecture, l'appelant retombe sur le comptage de la liste affichée.
 */
export async function compterRelancesManuellesCeMois(): Promise<number> {
  const debut = new Date();
  debut.setDate(1);
  debut.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("suppressions_compte")
    .select("details")
    .not("details->>relance_manuelle_le", "is", null)
    .limit(500);
  if (error) throw new Error(error.message);

  return (data ?? []).filter((row) => {
    const details = (row as { details?: Record<string, unknown> | null }).details ?? null;
    return relanceManuelleCeMois(details);
  }).length;
}

/** Motif de relance consigné par le dernier gestionnaire (chaîne vide si aucun). */
export function motifRelance(details: Record<string, unknown> | null): string {
  const valeur = details?.relance_motif;
  return typeof valeur === "string" ? valeur.trim() : "";
}

/** Une entrée de la trace d'audit des relances manuelles. */
export interface RelanceHistorique {
  /** Date ISO de l'envoi. */
  le: string;
  /** Motif saisi par le gestionnaire (chaîne vide si non renseigné). */
  motif: string;
}

/**
 * Historique complet des relances manuelles consignées (les 8 dernières).
 * Le Backend alimente `relances_historique` à chaque envoi ; pour les demandes plus
 * anciennes qui n'ont qu'une date de relance, on retombe sur cette date unique.
 */
export function historiqueRelances(details: Record<string, unknown> | null): RelanceHistorique[] {
  const brut = details?.relances_historique;
  const entrees = Array.isArray(brut) ? brut : [];
  const liste: RelanceHistorique[] = [];

  entrees.forEach((entree) => {
    if (!entree || typeof entree !== "object") return;
    const objet = entree as { le?: unknown; motif?: unknown };
    const le = typeof objet.le === "string" ? objet.le : "";
    if (!le || Number.isNaN(new Date(le).getTime())) return;
    const motif = typeof objet.motif === "string" ? objet.motif.trim() : "";
    liste.push({ le, motif });
  });

  if (liste.length === 0 && relanceManuelleEnvoyee(details)) {
    liste.push({
      le: String(details?.relance_manuelle_le),
      motif: motifRelance(details),
    });
  }

  return liste;
}

/**
 * Vrai si un gestionnaire a marqué cet artisan comme « appelé » : il sort alors de la
 * liste des personnes à rappeler par téléphone.
 */
export function dejaAppele(details: Record<string, unknown> | null): boolean {
  return typeof details?.appele_le === "string";
}

/** Date (formatée) du marquage « appelé », chaîne vide si absent. */
export function dateAppel(details: Record<string, unknown> | null): string {
  return dejaAppele(details) ? dateMarqueur(details, "appele_le") : "";
}

/** Résultats possibles d'un appel téléphonique, consignés dans la trace d'audit. */
export type ResultatAppel = "joint" | "ne_repond_pas" | "veut_partir";

/** Choix proposés au gestionnaire au moment de marquer un artisan comme appelé. */
export const RESULTATS_APPEL: ReadonlyArray<{
  valeur: ResultatAppel;
  libelle: string;
  court: string;
  icone: string;
}> = [
  { valeur: "joint", libelle: "Joint — l'artisan a répondu", court: "Joint", icone: "ri-phone-line" },
  { valeur: "ne_repond_pas", libelle: "Ne répond pas", court: "Ne répond pas", icone: "ri-volume-mute-line" },
  { valeur: "veut_partir", libelle: "Veut partir", court: "Veut partir", icone: "ri-logout-box-r-line" },
];

/** Résultat d'appel enregistré sur la demande (null si aucun). */
export function resultatAppel(details: Record<string, unknown> | null): ResultatAppel | null {
  const valeur = details?.appel_resultat;
  if (valeur === "joint" || valeur === "ne_repond_pas" || valeur === "veut_partir") return valeur;
  return null;
}

/** Libellé court du résultat d'appel (chaîne vide si aucun). */
export function libelleResultatAppel(details: Record<string, unknown> | null): string {
  const valeur = resultatAppel(details);
  return valeur ? RESULTATS_APPEL.find((r) => r.valeur === valeur)?.court ?? "" : "";
}

/** Note interne saisie lors de l'appel (chaîne vide si aucune). */
export function noteAppel(details: Record<string, unknown> | null): string {
  const valeur = details?.appel_note;
  return typeof valeur === "string" ? valeur.trim() : "";
}

/** Une entrée de l'historique des appels téléphoniques consignés. */
export interface AppelHistorique {
  /** Date ISO de l'appel. */
  le: string;
  /** Résultat déclaré par le gestionnaire (null si l'ancien marquage n'en avait pas). */
  resultat: ResultatAppel | null;
  /** Note interne facultative. */
  note: string;
  /** Email du gestionnaire qui a consigné l'appel. */
  par: string;
}

/**
 * Historique complet des appels consignés (les 8 derniers).
 * Le Backend alimente `appels_historique` à chaque marquage ; pour les demandes plus
 * anciennes qui n'ont qu'une date d'appel, on retombe sur cette entrée unique.
 */
export function historiqueAppels(details: Record<string, unknown> | null): AppelHistorique[] {
  const brut = details?.appels_historique;
  const entrees = Array.isArray(brut) ? brut : [];
  const liste: AppelHistorique[] = [];

  entrees.forEach((entree) => {
    if (!entree || typeof entree !== "object") return;
    const objet = entree as { le?: unknown; resultat?: unknown; note?: unknown; par?: unknown };
    const le = typeof objet.le === "string" ? objet.le : "";
    if (!le || Number.isNaN(new Date(le).getTime())) return;
    const resultat = objet.resultat;
    liste.push({
      le,
      resultat:
        resultat === "joint" || resultat === "ne_repond_pas" || resultat === "veut_partir"
          ? resultat
          : null,
      note: typeof objet.note === "string" ? objet.note.trim() : "",
      par: typeof objet.par === "string" ? objet.par : "",
    });
  });

  if (liste.length === 0 && dejaAppele(details)) {
    liste.push({
      le: String(details?.appele_le),
      resultat: resultatAppel(details),
      note: noteAppel(details),
      par: typeof details?.appele_par === "string" ? String(details.appele_par) : "",
    });
  }

  return liste;
}

/**
 * Vrai si l'artisan a été marqué comme appelé **cette semaine** (depuis lundi 00:00).
 * Sert au filtre « Appelés cette semaine » du back-office.
 */
export function appeleCetteSemaine(details: Record<string, unknown> | null): boolean {
  const valeur = details?.appele_le;
  if (typeof valeur !== "string") return false;
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return false;
  const maintenant = new Date();
  const debut = new Date(maintenant);
  const decalage = (maintenant.getDay() + 6) % 7;
  debut.setDate(maintenant.getDate() - decalage);
  debut.setHours(0, 0, 0, 0);
  return date.getTime() >= debut.getTime() && date.getTime() <= maintenant.getTime() + 60_000;
}

/**
 * Vrai si le dernier appel consigné est resté sans réponse.
 * L'artisan n'a pas été joint : il faut retenter plutôt que le considérer comme traité.
 */
export function dernierAppelSansReponse(details: Record<string, unknown> | null): boolean {
  return resultatAppel(details) === "ne_repond_pas";
}

/**
 * Nombre de tentatives d'appel consignées (l'historique complet, pas seulement le dernier).
 * Sert au compteur affiché sur la ligne : « 3 tentatives sans réponse ».
 */
export function nombreTentativesAppel(details: Record<string, unknown> | null): number {
  const tentatives = historiqueAppels(details).length;
  if (tentatives > 0) return tentatives;
  return dejaAppele(details) ? 1 : 0;
}

/**
 * Vrai si l'artisan a été marqué appelé mais doit être rappelé : le dernier appel
 * est tombé sur une absence de réponse. Il reste donc dans la liste à appeler.
 */
export function aRappelerTelephone(details: Record<string, unknown> | null): boolean {
  return dejaAppele(details) && dernierAppelSansReponse(details);
}

/**
 * Vrai si l'artisan doit être appelé : relancé au moins deux fois et jamais réellement
 * joint au téléphone. Un appel « ne répond pas » **ne sort pas** de la liste : c'est
 * justement le signal qu'il faut retenter. Sert à la mise en évidence des exports
 * PDF / CSV et de la liste.
 */
export function aAppelerArtisan(details: Record<string, unknown> | null): boolean {
  if (!relanceManuelleMultiple(details)) return false;
  return !dejaAppele(details) || dernierAppelSansReponse(details);
}

/** Vrai si l'artisan a confirmé au téléphone vouloir partir (départ à traiter en priorité). */
export function veutPartirArtisan(details: Record<string, unknown> | null): boolean {
  return resultatAppel(details) === "veut_partir";
}

/** Seuil (en heures) au-delà duquel un appel sans réponse déclenche un rappel de suivi. */
export const SEUIL_SUIVI_APPEL_HEURES = 48;

/** Seuils proposés au gestionnaire pour le rappel de suivi (heures). */
export const SEUILS_SUIVI_APPEL: readonly number[] = [24, 48, 72];

/** Libellé court d'un seuil de suivi (« 24 h », « 48 h »…). */
export function libelleSeuilSuivi(heures: number): string {
  return `${heures} h`;
}

/** Ramène une valeur quelconque à l'un des seuils proposés (48 h par défaut). */
export function normaliserSeuilSuivi(valeur: unknown): number {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return SEUIL_SUIVI_APPEL_HEURES;
  const arrondi = Math.round(n);
  if (SEUILS_SUIVI_APPEL.includes(arrondi)) return arrondi;
  // Tolère une valeur héritée : on retient le seuil proposé le plus proche.
  return SEUILS_SUIVI_APPEL.reduce((best, option) =>
    Math.abs(option - arrondi) < Math.abs(best - arrondi) ? option : best,
  );
}

/** Cache mémoire du seuil lu côté Backend (évite une requête par composant). */
let cacheSeuilSuivi: number | null = null;

/**
 * Lit le seuil de suivi réglé dans le back-office (table `parametres_app`, ligne id = 1).
 * Le même réglage pilote l'encart et l'archive PDF du récap de lundi, pour que tout le
 * monde parle du même délai. En cas d'indisponibilité, on retombe sur 48 h.
 */
export async function fetchSeuilSuiviAppel(): Promise<number> {
  if (cacheSeuilSuivi !== null) return cacheSeuilSuivi;
  try {
    const { data, error } = await supabase
      .from("parametres_app")
      .select("suivi_appel_heures")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    const seuil = normaliserSeuilSuivi(
      (data as { suivi_appel_heures?: number } | null)?.suivi_appel_heures,
    );
    cacheSeuilSuivi = seuil;
    return seuil;
  } catch {
    return SEUIL_SUIVI_APPEL_HEURES;
  }
}

/**
 * Enregistre un nouveau seuil de suivi (24 / 48 / 72 h). Écriture réservée aux gestionnaires
 * par les règles de sécurité du Backend. Le récap de lundi relit ce réglage à chaque envoi.
 */
export async function enregistrerSeuilSuiviAppel(heures: number, auteurEmail: string | null): Promise<number> {
  const propre = normaliserSeuilSuivi(heures);
  const { error } = await supabase.from("parametres_app").upsert(
    {
      id: 1,
      suivi_appel_heures: propre,
      updated_by: auteurEmail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
  cacheSeuilSuivi = propre;
  return propre;
}

/** Date ISO du dernier appel consigné (chaîne vide si aucun appel). */
export function dateDernierAppel(details: Record<string, unknown> | null): string {
  const liste = historiqueAppels(details);
  let derniere = "";
  let derniereMs = 0;
  liste.forEach((appel) => {
    const ms = new Date(appel.le).getTime();
    if (!Number.isNaN(ms) && ms > derniereMs) {
      derniereMs = ms;
      derniere = appel.le;
    }
  });
  return derniere;
}

/** Ancienneté en heures du dernier appel consigné (null si aucun appel lisible). */
export function heuresDepuisDernierAppel(details: Record<string, unknown> | null): number | null {
  const le = dateDernierAppel(details);
  if (!le) return null;
  const ms = new Date(le).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, (Date.now() - ms) / 3_600_000);
}

/**
 * Vrai si un **rappel de suivi** est dû : le dernier appel est resté sans réponse depuis
 * plus que le seuil réglé (48 h par défaut, ajustable à 24 / 48 / 72 h dans l'encart).
 * Sert à proposer automatiquement une nouvelle tentative, sans attendre que quelqu'un
 * pense à rouvrir la fiche.
 */
export function suiviAppelDu(
  details: Record<string, unknown> | null,
  seuilHeures: number = SEUIL_SUIVI_APPEL_HEURES,
): boolean {
  if (!dernierAppelSansReponse(details)) return false;
  const heures = heuresDepuisDernierAppel(details);
  if (heures === null || heures < seuilHeures) return false;
  // Un suivi déjà validé par un gestionnaire reste clos tant qu'aucun nouvel appel
  // n'est consigné : on ne repropose pas indéfiniment la même relance.
  return !suiviClosApresDernierAppel(details);
}

/** Motif saisi au moment de clore un suivi (chaîne vide si non renseigné). */
export function suiviValideMotif(details: Record<string, unknown> | null): string {
  const valeur = details?.suivi_valide_motif;
  return typeof valeur === "string" ? valeur.trim() : "";
}

/** Date ISO de validation du rappel de suivi (chaîne vide si aucun suivi validé). */
export function suiviValideLe(details: Record<string, unknown> | null): string {
  const valeur = details?.suivi_valide_le;
  if (typeof valeur !== "string") return "";
  return Number.isNaN(new Date(valeur).getTime()) ? "" : valeur;
}

/**
 * Vrai si le rappel de suivi a été validé **après** le dernier appel consigné.
 * Dans ce cas le suivi est clos : il ne doit plus apparaître comme dû.
 */
export function suiviClosApresDernierAppel(details: Record<string, unknown> | null): boolean {
  const valide = suiviValideLe(details);
  if (!valide) return false;
  const dernier = dateDernierAppel(details);
  if (!dernier) return true;
  return new Date(valide).getTime() >= new Date(dernier).getTime();
}

/** Début de la semaine calendaire en cours (lundi 00:00, heure locale). */
function debutSemaineMs(): number {
  const maintenant = new Date();
  const debut = new Date(maintenant);
  const decalage = (maintenant.getDay() + 6) % 7;
  debut.setDate(maintenant.getDate() - decalage);
  debut.setHours(0, 0, 0, 0);
  return debut.getTime();
}

/**
 * Vrai si le suivi a été validé cette semaine (depuis lundi 00:00).
 * Sert au compteur « suivis clos » de l'encart.
 */
export function suiviClosCetteSemaine(details: Record<string, unknown> | null): boolean {
  const valide = suiviValideLe(details);
  if (!valide) return false;
  return new Date(valide).getTime() >= debutSemaineMs();
}

/**
 * Nombre de suivis clos depuis lundi 00:00, toutes demandes confondues.
 * Permet de mesurer l'effet d'un changement de seuil (24 / 48 / 72 h).
 */
export function compterSuivisClosSemaine(
  demandes: ReadonlyArray<{ details: Record<string, unknown> | null }>,
): number {
  return demandes.filter((demande) => suiviClosCetteSemaine(demande.details)).length;
}

/** Note du dernier appel consigné (chaîne vide si aucun appel ou aucune note). */
export function noteDernierAppel(details: Record<string, unknown> | null): string {
  const liste = historiqueAppels(details);
  if (liste.length === 0) return "";
  const le = dateDernierAppel(details);
  const dernier = liste.find((appel) => appel.le === le) ?? liste[liste.length - 1];
  return dernier?.note ?? "";
}

/** Résultat du dernier appel consigné (null si aucun). */
export function resultatDernierAppel(details: Record<string, unknown> | null): ResultatAppel | null {
  const liste = historiqueAppels(details);
  if (liste.length === 0) return null;
  const le = dateDernierAppel(details);
  const dernier = liste.find((appel) => appel.le === le) ?? liste[liste.length - 1];
  return dernier?.resultat ?? null;
}

/** Nombre de jours (arrondi) depuis le dernier appel sans réponse, pour l'affichage. */
export function joursDepuisDernierAppel(details: Record<string, unknown> | null): number {
  const heures = heuresDepuisDernierAppel(details);
  if (heures === null) return 0;
  return Math.max(0, Math.floor(heures / 24));
}

/** Bilan chiffré des appels téléphoniques consignés depuis lundi 00:00. */
export interface StatistiquesAppelsSemaine {
  /** Tous les appels consignés cette semaine. */
  appels: number;
  /** Appels où l'artisan a répondu. */
  joints: number;
  /** Appels restés sans réponse (à retenter). */
  sansReponse: number;
  /** Appels où l'artisan a confirmé vouloir partir. */
  veutPartir: number;
}

/**
 * Bilan des appels de la semaine calendaire en cours (depuis lundi 00:00),
 * toutes demandes confondues. Alimente le récap affiché en tête de l'encart.
 */
export function statistiquesAppelsSemaine(
  demandes: ReadonlyArray<{ details: Record<string, unknown> | null }>,
): StatistiquesAppelsSemaine {
  const maintenant = new Date();
  const debut = new Date(maintenant);
  const decalage = (maintenant.getDay() + 6) % 7;
  debut.setDate(maintenant.getDate() - decalage);
  debut.setHours(0, 0, 0, 0);
  const debutMs = debut.getTime();

  const stats: StatistiquesAppelsSemaine = { appels: 0, joints: 0, sansReponse: 0, veutPartir: 0 };

  demandes.forEach((demande) => {
    historiqueAppels(demande.details).forEach((appel) => {
      const date = new Date(appel.le);
      if (Number.isNaN(date.getTime()) || date.getTime() < debutMs) return;
      stats.appels += 1;
      if (appel.resultat === "joint") stats.joints += 1;
      else if (appel.resultat === "ne_repond_pas") stats.sansReponse += 1;
      else if (appel.resultat === "veut_partir") stats.veutPartir += 1;
    });
  });

  return stats;
}

/**
 * Marque (ou démarque) un artisan comme appelé par téléphone.
 * L'action est réservée aux gestionnaires : le Backend revérifie le JWT avant d'écrire.
 */
export async function marquerArtisanAppele(
  demandeId: number,
  appele: boolean,
  options?: { resultat?: ResultatAppel; note?: string },
): Promise<{ message: string; appeleLe: string | null; resultat: ResultatAppel | null }> {
  const { data, error } = await supabase.functions.invoke("marquer-appel-artisan", {
    body: {
      demandeId,
      appele,
      resultat: appele ? (options?.resultat ?? "joint") : null,
      note: appele ? (options?.note ?? "").trim().slice(0, 200) : null,
    },
  });

  if (error) {
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = (await ctx.json().catch(() => null)) as { error?: string } | null;
      if (body?.error) throw new Error(body.error);
    }
    throw new Error("Le marquage n'a pas pu être enregistré. Réessayez dans un instant.");
  }

  const result = data as {
    ok?: boolean;
    message?: string;
    error?: string;
    appeleLe?: string | null;
    resultat?: string | null;
  } | null;
  if (!result?.ok) throw new Error(result?.error || "Le marquage n'a pas pu être enregistré.");
  const resultatFinal =
    result.resultat === "joint" || result.resultat === "ne_repond_pas" || result.resultat === "veut_partir"
      ? result.resultat
      : null;
  return {
    message:
      result.message ||
      (appele ? "L'artisan a été marqué comme appelé." : "Le marquage « appelé » a été retiré."),
    appeleLe: typeof result.appeleLe === "string" ? result.appeleLe : null,
    resultat: resultatFinal,
  };
}

/**
 * Clôt un rappel de suivi sans renvoyer d'email : le gestionnaire a traité la ligne
 * autrement (appel passé, artisan finalement joint, cas déjà réglé).
 *
 * La date de validation est conservée dans `details.suivi_valide_le` : le suivi ne
 * réapparaît pas tant qu'aucun nouvel appel n'est consigné, et il alimente le compteur
 * « suivis clos cette semaine » qui mesure l'effet du seuil réglé.
 */
export async function validerSuiviAppel(
  demandeId: number,
  motif?: string,
): Promise<{ message: string; valideLe: string; motif: string }> {
  const note = (motif ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const { data, error } = await supabase.functions.invoke("marquer-appel-artisan", {
    body: { demandeId, action: "valider_suivi", motif: note || null },
  });

  if (error) {
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = (await ctx.json().catch(() => null)) as { error?: string } | null;
      if (body?.error) throw new Error(body.error);
    }
    throw new Error("Le suivi n'a pas pu être clos. Réessayez dans un instant.");
  }

  const result = data as {
    ok?: boolean;
    message?: string;
    error?: string;
    valideLe?: string;
    motif?: string | null;
  } | null;
  if (!result?.ok) throw new Error(result?.error || "Le suivi n'a pas pu être clos.");
  return {
    message: result.message || "Le rappel de suivi est clos. Aucun email n'a été envoyé.",
    valideLe: typeof result.valideLe === "string" ? result.valideLe : new Date().toISOString(),
    motif: typeof result.motif === "string" ? result.motif : note,
  };
}

/**
 * Envoie tout de suite un email de rappel à l'artisan, sans attendre le cron J-7 / J-1.
 * Le Backend vérifie que l'appelant est bien gestionnaire avant tout envoi.
 *
 * `motif` est une note interne facultative (ex. « appel du 12/10, injoignable ») :
 * elle est conservée dans la trace d'audit mais n'apparaît jamais dans l'email.
 */
export async function relancerArtisanSuppression(
  demandeId: number,
  motif?: string,
): Promise<{ message: string; envoyeLe: string; motif: string }> {
  const note = (motif ?? "").trim();
  const { data, error } = await supabase.functions.invoke("relancer-suppression-artisan", {
    body: { demandeId, motif: note || null },
  });

  if (error) {
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = (await ctx.json().catch(() => null)) as { error?: string } | null;
      if (body?.error) throw new Error(body.error);
    }
    throw new Error("La relance n'a pas pu être envoyée. Réessayez dans un instant.");
  }

  const result = data as {
    ok?: boolean;
    message?: string;
    error?: string;
    envoyeLe?: string;
    motif?: string | null;
  } | null;
  if (!result?.ok) throw new Error(result?.error || "La relance n'a pas pu être envoyée.");
  return {
    message: result.message || "Le rappel a été envoyé à l'artisan.",
    envoyeLe: result.envoyeLe || new Date().toISOString(),
    motif: typeof result.motif === "string" ? result.motif : note,
  };
}

/**
 * Annule une suppression programmée depuis le back-office.
 * Le Backend vérifie que l'appelant est bien gestionnaire avant toute action.
 */
export async function annulerSuppressionParGestionnaire(demandeId: number): Promise<string> {
  const { data, error } = await supabase.functions.invoke("annuler-suppression-gestionnaire", {
    body: { demandeId },
  });

  if (error) {
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = (await ctx.json().catch(() => null)) as { error?: string } | null;
      if (body?.error) throw new Error(body.error);
    }
    throw new Error("L'annulation n'a pas pu être effectuée. Réessayez dans un instant.");
  }

  const result = data as { ok?: boolean; message?: string; error?: string } | null;
  if (!result?.ok) throw new Error(result?.error || "L'annulation n'a pas pu être effectuée.");
  return result.message || "La suppression a été annulée.";
}

/** Archive PDF renvoyée par l'aperçu du récap hebdomadaire. */
export interface ArchiveRecapTest {
  filename: string;
  base64: string;
  /** Nombre de demandes incluses dans l'archive. */
  count: number;
  /** Nombre d'alertes Stripe non traitées au moment du test (affiché dans le récap). */
  total: number;
  /** Demandes déjà relancées au moins deux fois, surlignées dans le PDF. */
  aAppeler: number;
}

/**
 * Demande au Backend de construire l'archive PDF telle qu'elle sera jointe au récap
 * hebdomadaire, sans rien envoyer. Sert au bouton « Tester le récap avec l'archive ».
 *
 * L'accès est réservé aux gestionnaires : le Backend vérifie le JWT de l'appelant.
 */
export async function testerRecapAvecArchive(): Promise<ArchiveRecapTest> {
  const { data, error } = await supabase.functions.invoke("recap-hebdo-alertes-stripe-non-traitees", {
    body: { preview: true, avecArchive: true },
  });

  if (error) {
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = (await ctx.json().catch(() => null)) as { error?: string } | null;
      if (body?.error) throw new Error(body.error);
    }
    throw new Error("Le test du récap n'a pas pu être lancé. Réessayez dans un instant.");
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    total?: number;
    archive?: { filename?: string; base64?: string; count?: number; aAppeler?: number };
  } | null;

  if (!result?.ok) throw new Error(result?.error || "Le test du récap a échoué.");
  if (!result.archive?.base64 || !result.archive.filename) {
    throw new Error("L'archive PDF n'a pas pu être construite pour ce test.");
  }

  return {
    filename: result.archive.filename,
    base64: result.archive.base64,
    count: Number(result.archive.count) || 0,
    total: Number(result.total) || 0,
    aAppeler: Number(result.archive.aAppeler) || 0,
  };
}

/** Résultat d'une relance groupée : ce qui est parti, ce qui a échoué. */
export interface ResultatRelanceGroupee {
  /** Demandes pour lesquelles l'email est réellement parti. */
  envoyees: { id: number; envoyeLe: string }[];
  /** Demandes en échec, avec le message renvoyé par le Backend. */
  echecs: { id: number; message: string }[];
  /** Demandes laissées de côté parce que le plafond d'envois par clic est atteint. */
  ignorees: number;
}

/**
 * Plafonds proposés avant confirmation d'une relance groupée.
 * Garde-fou anti-« relance massive involontaire » : au-delà, il faut un second clic.
 */
export const PLAFONDS_RELANCE_GROUPPEE: readonly number[] = [5, 10, 20];

/** Plafond retenu par défaut (10 envois par clic). */
export const PLAFOND_RELANCE_GROUPPEE = 10;

/** Plafond absolu accepté, y compris par le Backend. */
export const PLAFOND_MAX_RELANCE_GROUPPEE = 20;

/**
 * Relance plusieurs artisans en un seul clic (filtre « J-7 manquant »).
 *
 * Le lot part en **une seule requête** vers la fonction Backend dédiée : c'est elle qui
 * applique le plafond choisi (5, 10 ou 20), dans la limite de 20. Même si l'interface
 * se trompait, jamais plus de 20 emails ne peuvent partir sur un clic.
 *
 * Chaque envoi, côté Backend, passe par la même logique que la relance unitaire :
 * contrôle gestionnaire, gabarit d'email et trace d'audit datée identiques.
 */
export async function relancerArtisansSuppression(
  ids: number[],
  options?: {
    /** Note interne commune, conservée dans la trace d'audit de chaque envoi. */
    motif?: string;
    /** Plafond d'envois choisi par le gestionnaire (5, 10 ou 20). */
    plafond?: number;
  },
): Promise<ResultatRelanceGroupee & { plafond: number }> {
  const demande = Number(options?.plafond);
  const plafond = PLAFONDS_RELANCE_GROUPPEE.includes(demande) ? demande : PLAFOND_RELANCE_GROUPPEE;

  const { data, error } = await supabase.functions.invoke("relancer-suppressions-groupees", {
    body: {
      ids,
      motif: (options?.motif ?? "").trim() || null,
      plafond,
    },
  });

  if (error) {
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = (await ctx.json().catch(() => null)) as { error?: string } | null;
      if (body?.error) throw new Error(body.error);
    }
    throw new Error("La relance groupée n'a pas pu être lancée. Réessayez dans un instant.");
  }

  const result = data as {
    ok?: boolean;
    error?: string;
    plafond?: number;
    envoyees?: { id: number; envoyeLe: string }[];
    echecs?: { id: number; message: string }[];
    ignorees?: number;
  } | null;

  if (!result?.ok) throw new Error(result?.error || "La relance groupée a échoué.");

  return {
    envoyees: Array.isArray(result.envoyees) ? result.envoyees : [],
    echecs: Array.isArray(result.echecs) ? result.echecs : [],
    ignorees: Number(result.ignorees) || 0,
    plafond: Number(result.plafond) || plafond,
  };
}