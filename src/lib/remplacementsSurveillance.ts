/**
 * Préférences de surveillance du mini-graphe « Renvois par mois » de l'Espace comptable.
 *
 * Le mini-graphe du score de « Santé du compte » permet d'épingler une semaine « à surveiller »
 * (repère permanent sur sa barre). On offre le même repère au mini-graphe des remplacements,
 * pour uniformiser les deux graphes : l'artisan épingle le ou les mois qu'il veut garder à l'œil
 * en permanence, chacun marqué d'une épingle sur sa barre (mise en évidence simultanée possible).
 *
 * Les mois sont des clés « AAAA-MM ». Préférence purement locale (aucune donnée métier) :
 * écriture + événement, sur le même modèle que la semaine épinglée de la santé
 * (synchronisation des composants de la même page et entre onglets).
 */

import { ecrireBrut, lireBrut, supprimer } from "@/lib/stockageLocal";

/** Clé de mémorisation locale des mois épinglés (liste JSON de clés « AAAA-MM »). */
const REMPLACEMENTS_EPINGLES_STORAGE_KEY = "artiflow:compta:remplacements-mois-epingle";

/** Événement émis quand la liste des mois épinglés change. */
export const REMPLACEMENTS_EPINGLE_EVENT = "artiflow:compta:remplacements-mois-epingle";

/** Vrai si la valeur est une clé de mois valide (« AAAA-MM »). */
function estCleMois(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

/**
 * Relit les mois épinglés (liste, éventuellement vide). Gère la migration depuis l'ancienne
 * préférence qui ne mémorisait qu'un seul mois (chaîne brute « AAAA-MM »).
 */
export function lireMoisEpingles(): string[] {
  try {
    const raw = lireBrut(REMPLACEMENTS_EPINGLES_STORAGE_KEY);
    if (!raw) return [];
    // Ancienne préférence mono-mois : une simple clé « AAAA-MM » sans JSON.
    if (estCleMois(raw)) return [raw];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter(estCleMois)));
  } catch {
    return [];
  }
}

/** Enregistre la liste des mois épinglés (dédupliquée) et prévient les composants. */
export function ecrireMoisEpingles(mois: string[]): void {
  try {
    const unique = Array.from(new Set(mois.filter(estCleMois)));
    if (unique.length) ecrireBrut(REMPLACEMENTS_EPINGLES_STORAGE_KEY, JSON.stringify(unique));
    else supprimer(REMPLACEMENTS_EPINGLES_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_EPINGLE_EVENT, { detail: unique }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}

/** Vrai si le mois est actuellement épinglé « à surveiller ». */
export function estMoisEpingle(mois: string): boolean {
  return lireMoisEpingles().includes(mois);
}

/**
 * Clé de mémorisation locale de l'ordre d'épinglage d'origine : l'ordre dans lequel les mois ont été
 * épinglés (le plus récemment épinglé en tête), indépendamment des réordonnancements manuels. Sert au
 * bouton « Réinitialiser la priorité », qui restaure cet ordre quand l'ordre manuel a été chamboulé.
 */
const REMPLACEMENTS_EPINGLES_ORIGINE_STORAGE_KEY = "artiflow:compta:remplacements-mois-epingle-origine";

/**
 * Relit l'ordre d'épinglage d'origine des mois surveillés (du plus récent au plus ancien), filtré
 * sur les mois réellement épinglés. Repli sur l'ordre courant si aucun ordre d'origine n'est
 * mémorisé (anciennes préférences), ou complété par les mois épinglés qui manqueraient.
 */
export function lireMoisEpinglesOrigine(): string[] {
  const actuel = lireMoisEpingles();
  let origine: string[] = [];
  try {
    const raw = lireBrut(REMPLACEMENTS_EPINGLES_ORIGINE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) origine = parsed.filter(estCleMois);
    }
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  if (origine.length === 0) return actuel;
  const set = new Set(actuel);
  const suite = origine.filter((m) => set.has(m));
  actuel.forEach((m) => {
    if (!suite.includes(m)) suite.push(m);
  });
  return suite;
}

/** Enregistre l'ordre d'épinglage d'origine des mois surveillés (dédupliqué). */
function ecrireMoisEpinglesOrigine(mois: string[]): void {
  try {
    const unique = Array.from(new Set(mois.filter(estCleMois)));
    if (unique.length) ecrireBrut(REMPLACEMENTS_EPINGLES_ORIGINE_STORAGE_KEY, JSON.stringify(unique));
    else supprimer(REMPLACEMENTS_EPINGLES_ORIGINE_STORAGE_KEY);
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}

/**
 * Épingle un mois (ou le détache s'il l'était déjà). Un nouveau mois épinglé est placé en tête, pour
 * rester visible sur la pastille « Épinglé » (les premiers mois de la liste sont les plus prioritaires).
 * Renvoie la nouvelle liste active.
 */
export function basculerMoisEpingle(mois: string): string[] {
  const actuel = lireMoisEpingles();
  const etaitEpingle = actuel.includes(mois);
  const suivant = etaitEpingle ? actuel.filter((m) => m !== mois) : [mois, ...actuel];
  // On tient à jour l'ordre d'épinglage d'origine : un mois détaché disparaît, un mois nouvellement
  // épinglé se place en tête. Les réordonnancements manuels, eux, n'y touchent pas.
  const origineAvant = lireMoisEpinglesOrigine();
  const origine = etaitEpingle
    ? origineAvant.filter((m) => m !== mois)
    : [mois, ...origineAvant.filter((m) => m !== mois)];
  ecrireMoisEpinglesOrigine(origine);
  ecrireMoisEpingles(suivant);
  return suivant;
}

/**
 * Ajoute d'un coup plusieurs mois « à surveiller » (fusion avec ceux déjà épinglés, sans les
 * remplacer). Sert au raccourci « Épingler aussi les mois sous le seuil » du mini-graphe.
 * Renvoie la nouvelle liste active (dédupliquée).
 */
export function ajouterMoisEpingles(mois: string[]): string[] {
  const actuel = lireMoisEpingles();
  const nouveaux = mois.filter(estCleMois);
  const suivant = Array.from(new Set([...actuel, ...nouveaux]));
  // Les mois nouvellement épinglés rejoignent aussi l'ordre d'épinglage d'origine.
  const origineAvant = lireMoisEpinglesOrigine();
  const origine = Array.from(new Set([...origineAvant, ...nouveaux]));
  ecrireMoisEpinglesOrigine(origine);
  ecrireMoisEpingles(suivant);
  return suivant;
}

/** Détache tous les mois épinglés d'un coup (et oublie l'ordre d'épinglage d'origine). */
export function viderMoisEpingles(): void {
  ecrireMoisEpinglesOrigine([]);
  ecrireMoisEpingles([]);
}

/**
 * Réinitialise la priorité de surveillance des mois épinglés : restaure l'ordre d'épinglage
 * d'origine (du plus récemment épinglé au plus ancien), en effaçant les réordonnancements manuels.
 * Renvoie la nouvelle liste active.
 */
export function reinitialiserPrioriteEpingles(): string[] {
  const origine = lireMoisEpinglesOrigine();
  ecrireMoisEpingles(origine);
  return origine;
}

/**
 * Déplace un mois épinglé dans l'ordre de priorité de la surveillance : vers le haut (direction -1)
 * il remonte (plus prioritaire), vers le bas (direction 1) il redescend. Cet ordre est celui affiché
 * dans les deux vues (Espace comptable et tableau de bord). Renvoie la nouvelle liste active.
 */
export function deplacerMoisEpingle(mois: string, direction: -1 | 1): string[] {
  const actuel = lireMoisEpingles();
  const i = actuel.indexOf(mois);
  if (i < 0) return actuel;
  const j = i + direction;
  if (j < 0 || j >= actuel.length) return actuel;
  const suivant = [...actuel];
  const tmp = suivant[i];
  suivant[i] = suivant[j];
  suivant[j] = tmp;
  ecrireMoisEpingles(suivant);
  return suivant;
}

/**
 * Remonte un mois épinglé directement en tête de la surveillance (position la plus prioritaire), en
 * un seul geste — flèche « monter en tête » des puces de la pastille « Épinglé » (dans les deux vues)
 * et des barres du mini-graphe. Renvoie la nouvelle liste active.
 */
export function monterMoisEnTete(mois: string): string[] {
  const actuel = lireMoisEpingles();
  if (!actuel.includes(mois)) return actuel;
  const suivant = [mois, ...actuel.filter((m) => m !== mois)];
  ecrireMoisEpingles(suivant);
  return suivant;
}

/**
 * Réordonne entièrement les mois épinglés selon la liste fournie (glisser-déposer d'une puce sur une
 * autre) : on ne garde que les mois réellement épinglés, dans l'ordre demandé, puis on recolle à la
 * suite ceux qui auraient été omis. Renvoie la nouvelle liste active.
 */
export function reordonnerMoisEpingles(ordre: string[]): string[] {
  const actuel = lireMoisEpingles();
  const set = new Set(actuel);
  const suite = ordre.filter((m) => set.has(m));
  actuel.forEach((m) => {
    if (!suite.includes(m)) suite.push(m);
  });
  ecrireMoisEpingles(suite);
  return suite;
}

/**
 * Mode de rangement des mois épinglés : « priorite » = ordre manuel choisi (flèches / glisser),
 * « chrono » = ordre chronologique des mois (du plus ancien au plus récent). Préférence partagée
 * entre les deux vues (tableau de bord et Espace comptable), d'où la mémorisation locale.
 */
export type TriEpinglesMode = "priorite" | "chrono";

/** Clé de mémorisation locale du mode de rangement des mois épinglés. */
const TRI_EPINGLES_STORAGE_KEY = "artiflow:compta:remplacements-epingles-tri";

/** Événement émis quand le mode de rangement des mois épinglés change. */
export const REMPLACEMENTS_TRI_EPINGLES_EVENT = "artiflow:compta:remplacements-epingles-tri";

/** Relit le mode de rangement des mois épinglés (« priorite » par défaut). */
export function lireTriEpingles(): TriEpinglesMode {
  try {
    return lireBrut(TRI_EPINGLES_STORAGE_KEY) === "chrono" ? "chrono" : "priorite";
  } catch {
    return "priorite";
  }
}

/** Mémorise le mode de rangement des mois épinglés et prévient les composants. */
export function ecrireTriEpingles(value: TriEpinglesMode): void {
  try {
    ecrireBrut(TRI_EPINGLES_STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_TRI_EPINGLES_EVENT, { detail: value }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}

/** Bascule le mode de rangement des mois épinglés (priorité manuelle ↔ chronologique). Renvoie le nouveau mode. */
export function basculerTriEpingles(): TriEpinglesMode {
  const next: TriEpinglesMode = lireTriEpingles() === "chrono" ? "priorite" : "chrono";
  ecrireTriEpingles(next);
  return next;
}

/**
 * Applique le mode de rangement mémorisé à une liste de mois épinglés : ordre manuel tel quel
 * (« priorite ») ou tri chronologique (« chrono », du plus ancien au plus récent). L'ordre manuel
 * mémorisé n'est jamais modifié par le seul affichage.
 */
export function trierMoisEpingles(mois: string[]): string[] {
  if (lireTriEpingles() === "chrono") return [...mois].sort();
  return [...mois];
}

/**
 * Libellé d'en-tête lisible du mode de rangement des mois épinglés, pour le tracer à l'identique
 * dans les exports (mini-récap PDF et CSV des mois épinglés).
 */
export function libelleTriEpingles(mode: TriEpinglesMode): string {
  return mode === "chrono"
    ? "Rangement : chrono (ordre des mois)"
    : "Rangement : priorité (ordre manuel de surveillance)";
}

/** Libellé lisible d'une clé de mois (« 2026-10 » → « Octobre 2026 »). */
export function libelleMoisCle(cle: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(cle);
  if (!m) return cle;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Construit le texte « rangement » copié dans le presse-papiers : le libellé du mode de rangement
 * suivi de la liste priorisée des mois épinglés (1. Octobre 2026, 2. ...). Partagé entre le bandeau
 * d'actions des remplacements et les menus de reprise (mois clavier / mois faibles), pour que
 * « Copier le rangement » copie partout exactement le même contenu.
 */
export function texteRangementEpingles(moisEpinglesTries: string[], mode: TriEpinglesMode): string {
  const lignes = moisEpinglesTries.map((cle, idx) => `${idx + 1}. ${libelleMoisCle(cle)}`);
  return [
    libelleTriEpingles(mode),
    `Mois épinglés à surveiller (${moisEpinglesTries.length}) :`,
    lignes.length ? lignes.join("\n") : "(aucun)",
  ].join("\n");
}

/**
 * Clé de session mémorisant qu'on part ouvrir le mois le plus faible dans la comptabilité,
 * afin de surligner brièvement sa puce sur la pastille « Épinglé » au retour sur le tableau de bord.
 */
const RETOUR_PLUS_FAIBLE_SESSION_KEY = "artiflow:compta:retour-plus-faible";

/**
 * Marque le mois le plus faible qu'on s'apprête à ouvrir dans la comptabilité (stockage de
 * session uniquement, aucun impact métier), pour le surligner au retour sur le tableau de bord.
 */
export function marquerRetourPlusFaible(mois: string): void {
  try {
    if (estCleMois(mois)) sessionStorage.setItem(RETOUR_PLUS_FAIBLE_SESSION_KEY, mois);
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}

/**
 * Relit (puis efface) le mois le plus faible à surligner brièvement après un aller-retour en
 * comptabilité. Renvoie null si aucun retour n'est en attente.
 */
export function consommerRetourPlusFaible(): string | null {
  try {
    const value = sessionStorage.getItem(RETOUR_PLUS_FAIBLE_SESSION_KEY);
    if (value && estCleMois(value)) {
      sessionStorage.removeItem(RETOUR_PLUS_FAIBLE_SESSION_KEY);
      return value;
    }
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  return null;
}

/** Clé de mémorisation locale du filtre « mois sous le seuil ». */
const REMPLACEMENTS_SOUSSEUIL_STORAGE_KEY = "artiflow:compta:remplacements-sous-seuil";

/** Événement émis quand le filtre « sous le seuil » change. */
export const REMPLACEMENTS_SOUSSEUIL_EVENT = "artiflow:compta:remplacements-sous-seuil";

/** Relit l'état du filtre « mois sous le seuil » (désactivé par défaut). */
export function lireRempFiltreSousSeuil(): boolean {
  try {
    return lireBrut(REMPLACEMENTS_SOUSSEUIL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Active ou désactive le filtre « mois sous le seuil » et prévient les composants. */
export function ecrireRempFiltreSousSeuil(value: boolean): void {
  try {
    ecrireBrut(REMPLACEMENTS_SOUSSEUIL_STORAGE_KEY, value ? "1" : "0");
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_SOUSSEUIL_EVENT, { detail: value }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}

/**
 * Clé de mémorisation locale du dernier mois le plus faible consulté : permet de le reprendre
d'un clic depuis l'en-tête de la vue « Remplacements » (raccourci de confort, aucune donnée métier).
 */
const DERNIER_MOIS_FAIBLE_STORAGE_KEY = "artiflow:compta:dernier-mois-faible";

/** Événement émis quand le dernier mois le plus faible consulté change. */
export const REMPLACEMENTS_DERNIER_FAIBLE_EVENT = "artiflow:compta:dernier-mois-faible";

/** Relit le dernier mois le plus faible consulté (« AAAA-MM », chaîne vide si aucun). */
export function lireDernierMoisFaible(): string {
  try {
    const value = lireBrut(DERNIER_MOIS_FAIBLE_STORAGE_KEY);
    if (value && estCleMois(value)) return value;
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  const historique = lireHistoriqueMoisFaibles();
  return historique[0] ?? "";
}

/** Mémorise le dernier mois le plus faible consulté et prévient les composants. */
export function ecrireDernierMoisFaible(mois: string): void {
  try {
    if (estCleMois(mois)) ecrireBrut(DERNIER_MOIS_FAIBLE_STORAGE_KEY, mois);
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_DERNIER_FAIBLE_EVENT, { detail: mois }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  // On alimente aussi l'historique des mois faibles consultés (liste), pour pouvoir en reprendre
  // un à tout moment depuis le petit menu de l'en-tête de la vue « Remplacements ».
  ajouterMoisFaibleHistorique(mois);
}

/**
 * Clé de mémorisation locale de l'historique des « mois faibles consultés » (liste JSON de clés
 * « AAAA-MM », du plus récent au plus ancien). Préférence purement locale, aucune donnée métier.
 */
const HISTORIQUE_MOIS_FAIBLES_STORAGE_KEY = "artiflow:compta:historique-mois-faibles";

/** Événement émis quand l'historique des mois faibles consultés change. */
export const REMPLACEMENTS_HISTORIQUE_FAIBLE_EVENT = "artiflow:compta:historique-mois-faibles";

/** Nombre maximal de mois faibles conservés dans l'historique. */
const HISTORIQUE_MOIS_FAIBLES_MAX = 8;

/**
 * Relit l'historique des mois faibles consultés (du plus récent au plus ancien, éventuellement
 * vide). Gère la migration depuis l'ancienne préférence mono-mois « dernier mois faible ».
 */
export function lireHistoriqueMoisFaibles(): string[] {
  try {
    const raw = lireBrut(HISTORIQUE_MOIS_FAIBLES_STORAGE_KEY);
    if (!raw) {
      const dernier = lireBrut(DERNIER_MOIS_FAIBLE_STORAGE_KEY);
      if (dernier && estCleMois(dernier)) return [dernier];
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter(estCleMois)));
  } catch {
    return [];
  }
}

/**
 * Ajoute un mois faible consulté en tête de l'historique (dédupliqué, plafonné) et prévient les
 * composants. Renvoie la nouvelle liste active.
 */
export function ajouterMoisFaibleHistorique(mois: string): string[] {
  if (!estCleMois(mois)) return lireHistoriqueMoisFaibles();
  const actuel = lireHistoriqueMoisFaibles().filter((c) => c !== mois);
  const suivant = [mois, ...actuel].slice(0, HISTORIQUE_MOIS_FAIBLES_MAX);
  try {
    ecrireBrut(HISTORIQUE_MOIS_FAIBLES_STORAGE_KEY, JSON.stringify(suivant));
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_HISTORIQUE_FAIBLE_EVENT, { detail: suivant }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  return suivant;
}

/** Vide l'historique des mois faibles consultés. */
export function viderHistoriqueMoisFaibles(): void {
  try {
    supprimer(HISTORIQUE_MOIS_FAIBLES_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_HISTORIQUE_FAIBLE_EVENT, { detail: [] }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}

/**
 * Clé de mémorisation locale du dernier mois ouvert au clavier (Entrée sur une barre du
 * mini-graphe), pour le reproposer en « Reprendre » depuis l'en-tête. Préférence locale.
 */
const DERNIER_MOIS_CLAVIER_STORAGE_KEY = "artiflow:compta:dernier-mois-clavier";

/** Événement émis quand le dernier mois ouvert au clavier change. */
export const REMPLACEMENTS_DERNIER_CLAVIER_EVENT = "artiflow:compta:dernier-mois-clavier";

/** Relit le dernier mois ouvert au clavier (« AAAA-MM », chaîne vide si aucun). */
export function lireDernierMoisClavier(): string {
  try {
    const value = lireBrut(DERNIER_MOIS_CLAVIER_STORAGE_KEY);
    if (value && estCleMois(value)) return value;
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  return "";
}

/** Mémorise le dernier mois ouvert au clavier (navigation Entrée du mini-graphe) et prévient les composants. */
export function ecrireDernierMoisClavier(mois: string): void {
  try {
    if (estCleMois(mois)) ecrireBrut(DERNIER_MOIS_CLAVIER_STORAGE_KEY, mois);
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_DERNIER_CLAVIER_EVENT, { detail: mois }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  // On alimente aussi l'historique des mois ouverts au clavier (liste), pour pouvoir en reprendre
  // un à tout moment depuis le petit menu de l'en-tête de la vue « Remplacements ».
  ajouterMoisClavierHistorique(mois);
}

/**
 * Clé de mémorisation locale de l'historique des « mois ouverts au clavier » (liste JSON de clés
 * « AAAA-MM », du plus récent au plus ancien). Préférence purement locale, aucune donnée métier.
 */
const HISTORIQUE_MOIS_CLAVIER_STORAGE_KEY = "artiflow:compta:historique-mois-clavier";

/** Événement émis quand l'historique des mois ouverts au clavier change. */
export const REMPLACEMENTS_HISTORIQUE_CLAVIER_EVENT = "artiflow:compta:historique-mois-clavier";

/** Nombre maximal de mois ouverts au clavier conservés dans l'historique. */
const HISTORIQUE_MOIS_CLAVIER_MAX = 8;

/**
 * Relit l'historique des mois ouverts au clavier (du plus récent au plus ancien, éventuellement
 * vide). Gère la migration depuis l'ancienne préférence mono-mois « dernier mois clavier ».
 */
export function lireHistoriqueMoisClavier(): string[] {
  try {
    const raw = lireBrut(HISTORIQUE_MOIS_CLAVIER_STORAGE_KEY);
    if (!raw) {
      const dernier = lireBrut(DERNIER_MOIS_CLAVIER_STORAGE_KEY);
      if (dernier && estCleMois(dernier)) return [dernier];
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter(estCleMois)));
  } catch {
    return [];
  }
}

/**
 * Ajoute un mois ouvert au clavier en tête de l'historique (dédupliqué, plafonné) et prévient les
 * composants. Renvoie la nouvelle liste active.
 */
export function ajouterMoisClavierHistorique(mois: string): string[] {
  if (!estCleMois(mois)) return lireHistoriqueMoisClavier();
  const actuel = lireHistoriqueMoisClavier().filter((c) => c !== mois);
  const suivant = [mois, ...actuel].slice(0, HISTORIQUE_MOIS_CLAVIER_MAX);
  try {
    ecrireBrut(HISTORIQUE_MOIS_CLAVIER_STORAGE_KEY, JSON.stringify(suivant));
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_HISTORIQUE_CLAVIER_EVENT, { detail: suivant }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  return suivant;
}

/** Vide l'historique des mois ouverts au clavier. */
export function viderHistoriqueMoisClavier(): void {
  try {
    supprimer(HISTORIQUE_MOIS_CLAVIER_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_HISTORIQUE_CLAVIER_EVENT, { detail: [] }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}

/** Clé de mémorisation locale du filtre « mois épinglé uniquement ». */
const REMPLACEMENTS_EPINGLEUNIQUEMENT_STORAGE_KEY = "artiflow:compta:remplacements-epingle-uniquement";

/** Événement émis quand le filtre « mois épinglé uniquement » change. */
export const REMPLACEMENTS_EPINGLEUNIQUEMENT_EVENT = "artiflow:compta:remplacements-epingle-uniquement";

/** Relit l'état du filtre « mois épinglé uniquement » (désactivé par défaut). */
export function lireRempFiltreEpingle(): boolean {
  try {
    return lireBrut(REMPLACEMENTS_EPINGLEUNIQUEMENT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Active ou désactive le filtre « mois épinglé uniquement » et prévient les composants. */
export function ecrireRempFiltreEpingle(value: boolean): void {
  try {
    ecrireBrut(REMPLACEMENTS_EPINGLEUNIQUEMENT_STORAGE_KEY, value ? "1" : "0");
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_EPINGLEUNIQUEMENT_EVENT, { detail: value }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}

/**
 * Clé de mémorisation locale du repli de la pastille « Épinglé » (préférence d'affichage). Elle est
 * partagée entre le tableau de bord et la vue « Remplacements » de l'Espace comptable, pour garder
 * la même présentation des mois surveillés dans les deux vues (cohérence d'ensemble).
 */
const EPINGLES_REPLIE_STORAGE_KEY = "artiflow:dashboard:epingles-replie";

/** Événement émis quand l'état replié / déplié de la pastille « Épinglé » change. */
export const REMPLACEMENTS_EPINGLES_REPLIE_EVENT = "artiflow:dashboard:epingles-replie";

/** Relit l'état replié / déplié de la pastille « Épinglé » (déplié par défaut). */
export function lireEpinglesReplie(): boolean {
  try {
    return lireBrut(EPINGLES_REPLIE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mémorise l'état replié / déplié de la pastille « Épinglé » et prévient les composants. */
export function ecrireEpinglesReplie(value: boolean): void {
  try {
    if (value) ecrireBrut(EPINGLES_REPLIE_STORAGE_KEY, "1");
    else supprimer(EPINGLES_REPLIE_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_EPINGLES_REPLIE_EVENT, { detail: value }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}

/**
 * Ancrage possible du petit menu de l'historique des mois ouverts au clavier : il peut s'ouvrir
 * depuis le compteur « N mois au clavier » ou depuis le chevron du bouton « Reprendre ».
 */
export type MenuClavierAncre = "compteur" | "bouton";

/**
 * Clé de mémorisation de l'état ouvert / fermé du menu de l'historique des mois clavier : on le
 * retrouve tel quel à la prochaine visite de l'Espace comptable (préférence d'affichage locale).
 */
const MENU_CLAVIER_STORAGE_KEY = "artiflow:compta:menu-clavier-ouvert";

/** Événement émis quand l'état ouvert / fermé du menu des mois clavier change. */
export const REMPLACEMENTS_MENU_CLAVIER_EVENT = "artiflow:compta:menu-clavier-ouvert";

/**
 * Relit l'ancrage du menu des mois clavier mémorisé (null = menu fermé), pour le rouvrir au même
 * endroit à la prochaine visite.
 */
export function lireMenuClavierOuvert(): MenuClavierAncre | null {
  try {
    const value = lireBrut(MENU_CLAVIER_STORAGE_KEY);
    if (value === "compteur" || value === "bouton") return value;
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  return null;
}

/** Mémorise l'ancrage du menu des mois clavier (null = fermé) et prévient les composants. */
export function ecrireMenuClavierOuvert(value: MenuClavierAncre | null): void {
  try {
    if (value) ecrireBrut(MENU_CLAVIER_STORAGE_KEY, value);
    else supprimer(MENU_CLAVIER_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_MENU_CLAVIER_EVENT, { detail: value }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}

/**
 * Clé de mémorisation locale de l'historique des réinitialisations de priorité : chaque entrée
 * trace la date d'une réinitialisation et le nombre de mois épinglés alors concernés, pour garder
 * une trace des changements d'ordre de surveillance. Préférence purement locale, aucune donnée métier.
 */
const HISTORIQUE_REINIT_STORAGE_KEY = "artiflow:compta:remplacements-reinitialisations";

/** Événement émis quand l'historique des réinitialisations de priorité change. */
export const REMPLACEMENTS_REINITIALISATIONS_EVENT = "artiflow:compta:remplacements-reinitialisations";

/** Nombre maximal de réinitialisations conservées dans l'historique. */
const HISTORIQUE_REINIT_MAX = 12;

/** Une entrée de l'historique des réinitialisations de priorité (date + mode + nombre de mois). */
export interface ReinitialisationEpinglesEntry {
  /** Date ISO de la réinitialisation. */
  date: string;
  /** Nombre de mois épinglés concernés au moment de la réinitialisation. */
  nbMois: number;
  /**
   * Mode de rangement en vigueur au moment de la réinitialisation (« priorite » ou « chrono »),
   * mémorisé pour tracer rétroactivement le tri appliqué à chaque reset. Absent sur les anciennes
   * entrées enregistrées avant cette information.
   */
  mode?: TriEpinglesMode;
}

/** Vrai si la valeur est une entrée d'historique de réinitialisation valide. */
function estEntreeReinit(value: unknown): value is ReinitialisationEpinglesEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as { date?: unknown; nbMois?: unknown };
  return typeof v.date === "string" && typeof v.nbMois === "number";
}

/**
 * Relit l'historique des réinitialisations de priorité (du plus récent au plus ancien, éventuellement
 * vide). Chaque entrée associe la date de la réinitialisation au nombre de mois épinglés concernés.
 */
export function lireHistoriqueReinitialisations(): ReinitialisationEpinglesEntry[] {
  try {
    const raw = lireBrut(HISTORIQUE_REINIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(estEntreeReinit).slice(0, HISTORIQUE_REINIT_MAX);
  } catch {
    return [];
  }
}

/**
 * Mémorise une nouvelle réinitialisation de priorité (date du jour + nombre de mois concernés) en
 * tête de l'historique (plafonné) et prévient les composants. Renvoie la nouvelle liste active.
 */
export function ajouterReinitialisationHistorique(
  nbMois: number,
  mode?: TriEpinglesMode,
): ReinitialisationEpinglesEntry[] {
  const suivant = [
    { date: new Date().toISOString(), nbMois: Math.max(0, Math.round(nbMois)), mode },
    ...lireHistoriqueReinitialisations(),
  ].slice(0, HISTORIQUE_REINIT_MAX);
  try {
    ecrireBrut(HISTORIQUE_REINIT_STORAGE_KEY, JSON.stringify(suivant));
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_REINITIALISATIONS_EVENT, { detail: suivant }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  return suivant;
}

/** Vide l'historique des réinitialisations de priorité. */
export function viderHistoriqueReinitialisations(): void {
  try {
    supprimer(HISTORIQUE_REINIT_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(REMPLACEMENTS_REINITIALISATIONS_EVENT, { detail: [] }));
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
}

/**
 * Copie un texte dans le presse-papiers du navigateur, avec repli sur un champ temporaire pour les
 * navigateurs / contextes (http) où l'API Clipboard n'est pas disponible. Renvoie true si la copie
 * a réussi. Sert au bouton « Copier le rangement ».
 */
export async function copierTextePressePapiers(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* repli ci-dessous */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}