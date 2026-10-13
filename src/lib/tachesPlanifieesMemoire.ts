/**
 * Mémoire locale de l'état « branché / non branché » des tâches planifiées.
 *
 * Il ne s'agit que d'une trace d'affichage (aucune donnée métier) : à chaque fois que
 * l'utilisateur déclenche les fonctions depuis le Diagnostic, on mémorise pour chaque
 * fonction si elle a répondu (donc si elle est bien branchée / déployée) et à quel moment.
 * Cela permet d'afficher « branlé / non branché » par fonction sans attendre l'heure du cron.
 */

/** Dernier appel détecté d'une fonction planifiée. */
export interface DetectionTache {
  /** Nom technique de la fonction (slug). */
  slug: string;
  /** Date/heure (ISO) du dernier appel détecté. */
  quand: string;
  /** Vrai si la fonction a répondu correctement (elle est donc branchée). */
  ok: boolean;
  /** Code HTTP renvoyé, ou null si l'appel n'a pas abouti. */
  http: number | null;
  /** Message court renvoyé par la fonction (ou la raison de l'échec). */
  message: string;
  /** Vrai si la détection vient d'un simple « ping » silencieux (aucune logique exécutée). */
  silencieux?: boolean;
}

const CLE = "artiflow.taches.detections";
const EVT = "artiflow-taches-detections";

/** Événement diffusé après chaque mise à jour des détections. */
export const DETECTIONS_TACHE_EVENT = EVT;

/** Toutes les détections connues, indexées par slug (robuste à un stockage corrompu). */
export function lireDetections(): Record<string, DetectionTache> {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return {};
    const parsed = JSON.parse(brut) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, DetectionTache> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([slug, valeur]) => {
      if (valeur && typeof valeur === "object") {
        const o = valeur as Record<string, unknown>;
        out[slug] = {
          slug,
          quand: typeof o.quand === "string" ? o.quand : "",
          ok: o.ok === true,
          http: typeof o.http === "number" ? o.http : null,
          message: typeof o.message === "string" ? o.message : "",
          silencieux: o.silencieux === true,
        };
      }
    });
    return out;
  } catch {
    return {};
  }
}

/** Mémorise les détections d'une salve d'appels (fusion avec l'existant) et prévient l'affichage. */
export function enregistrerDetections(resultats: DetectionTache[]): void {
  if (resultats.length === 0) return;
  const actuel = lireDetections();
  resultats.forEach((r) => {
    actuel[r.slug] = r;
  });
  try {
    localStorage.setItem(CLE, JSON.stringify(actuel));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* stockage indisponible : la détection n'est pas persistante */
  }
}

/** Efface toutes les détections mémorisées (retour à « jamais détecté »). */
export function effacerDetections(): void {
  try {
    localStorage.removeItem(CLE);
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* stockage indisponible */
  }
}

/**
 * Horodatage (ISO) de la dernière vérification connue, toutes fonctions confondues, ou null.
 * Sert d'en-tête « dernière vérification » et de garde anti-rafale pour le ping automatique.
 */
export function lireDerniereVerification(): string | null {
  const detections = Object.values(lireDetections()).filter((d) => d.quand);
  if (detections.length === 0) return null;
  return detections.reduce((max, d) => (d.quand > max ? d.quand : max), "");
}

/**
 * Une entrée du journal local des vérifications silencieuses.
 * Sert à garder un historique de fiabilité : à chaque ping, on note l'heure et combien
 * de fonctions ont répondu, pour repérer une dégradation dans le temps.
 */
export interface PassageSilencieux {
  /** Date/heure (ISO) du passage. */
  quand: string;
  /** Nombre de fonctions joignables lors de ce passage. */
  joignables: number;
  /** Nombre total de fonctions testées. */
  total: number;
}

const CLE_JOURNAL = "artiflow.taches.journal";
const EVT_JOURNAL = "artiflow-taches-journal";
/** Nombre maximum d'entrées conservées (les plus récentes d'abord). */
const JOURNAL_MAX = 20;

/** Événement diffusé après chaque mise à jour du journal des passages. */
export const JOURNAL_TACHE_EVENT = EVT_JOURNAL;

/** Toutes les entrées du journal (les plus récentes d'abord), robuste à un stockage corrompu. */
export function lireJournalPassages(): PassageSilencieux[] {
  try {
    const brut = localStorage.getItem(CLE_JOURNAL);
    if (!brut) return [];
    const parsed = JSON.parse(brut) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v) => v && typeof v === "object")
      .map((v) => {
        const o = v as Record<string, unknown>;
        return {
          quand: typeof o.quand === "string" ? o.quand : "",
          joignables: typeof o.joignables === "number" ? o.joignables : 0,
          total: typeof o.total === "number" ? o.total : 0,
        };
      })
      .filter((p) => p.quand);
  } catch {
    return [];
  }
}

/** Ajoute un passage en tête du journal (borné) et prévient l'affichage. */
export function enregistrerPassage(passage: PassageSilencieux): void {
  if (!passage.quand) return;
  const suivant = [passage, ...lireJournalPassages()].slice(0, JOURNAL_MAX);
  try {
    localStorage.setItem(CLE_JOURNAL, JSON.stringify(suivant));
    window.dispatchEvent(new Event(EVT_JOURNAL));
  } catch {
    /* stockage indisponible : le journal n'est pas persistant */
  }
}

/** Efface tout le journal des passages. */
export function effacerJournalPassages(): void {
  try {
    localStorage.removeItem(CLE_JOURNAL);
    window.dispatchEvent(new Event(EVT_JOURNAL));
  } catch {
    /* stockage indisponible */
  }
}

/** Nombre de passages silencieux partiels consécutifs à partir duquel on alerte sur la fiabilité (valeur par défaut). */
export const SEUIL_FIABILITE_PARTIELS = 2;

/** Bornes du seuil d'alerte réglable depuis le Diagnostic. */
export const SEUIL_FIABILITE_MIN = 2;
export const SEUIL_FIABILITE_MAX = 6;

const CLE_SEUIL = "artiflow.taches.seuilFiabilite";
const EVT_SEUIL = "artiflow-taches-seuil";
/** Événement diffusé quand le seuil d'alerte de fiabilité change. */
export const SEUIL_FIABILITE_EVENT = EVT_SEUIL;

/**
 * Seuil d'alerte de fiabilité réglé par l'utilisateur (nombre de passages partiels d'affilée),
 * borné, ou la valeur par défaut. Robuste à un stockage indisponible.
 */
export function lireSeuilFiabilite(): number {
  try {
    const brut = localStorage.getItem(CLE_SEUIL);
    const n = brut === null ? Number.NaN : Number.parseInt(brut, 10);
    if (Number.isFinite(n) && n >= SEUIL_FIABILITE_MIN && n <= SEUIL_FIABILITE_MAX) return n;
  } catch {
    /* stockage indisponible */
  }
  return SEUIL_FIABILITE_PARTIELS;
}

/**
 * Une entrée de l'historique des changements de seuil d'alerte : garde la trace datée de
 * quand la sensibilité a été modifiée, pour retrouver la raison d'un réglage plus tard.
 */
export interface ChangementSeuil {
  /** Date/heure (ISO) du changement. */
  quand: string;
  /** Ancienne valeur du seuil. */
  ancien: number;
  /** Nouvelle valeur du seuil. */
  nouveau: number;
}

const CLE_HIST_SEUIL = "artiflow.taches.seuilFiabilite.historique";
/** Nombre maximum de changements de seuil conservés (les plus récents d'abord). */
const HIST_SEUIL_MAX = 20;

/** Historique des changements de seuil (les plus récents d'abord), robuste à un stockage corrompu. */
export function lireHistoriqueSeuil(): ChangementSeuil[] {
  try {
    const brut = localStorage.getItem(CLE_HIST_SEUIL);
    if (!brut) return [];
    const parsed = JSON.parse(brut) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v) => v && typeof v === "object")
      .map((v) => {
        const o = v as Record<string, unknown>;
        return {
          quand: typeof o.quand === "string" ? o.quand : "",
          ancien: typeof o.ancien === "number" ? o.ancien : 0,
          nouveau: typeof o.nouveau === "number" ? o.nouveau : 0,
        };
      })
      .filter((c) => c.quand);
  } catch {
    return [];
  }
}

/** Efface l'historique des changements de seuil (le réglage actuel reste inchangé). */
export function effacerHistoriqueSeuil(): void {
  try {
    localStorage.removeItem(CLE_HIST_SEUIL);
    window.dispatchEvent(new Event(EVT_SEUIL));
  } catch {
    /* stockage indisponible */
  }
}

/**
 * Enregistre un nouveau seuil d'alerte (borné) et prévient l'affichage. Un changement réel
 * est ajouté à l'historique daté, pour retrouver plus tard quand la sensibilité a évolué.
 */
export function enregistrerSeuilFiabilite(valeur: number): void {
  const borne = Math.min(SEUIL_FIABILITE_MAX, Math.max(SEUIL_FIABILITE_MIN, Math.round(valeur)));
  const ancien = lireSeuilFiabilite();
  try {
    localStorage.setItem(CLE_SEUIL, String(borne));
    if (ancien !== borne) {
      const suivant = [
        { quand: new Date().toISOString(), ancien, nouveau: borne },
        ...lireHistoriqueSeuil(),
      ].slice(0, HIST_SEUIL_MAX);
      localStorage.setItem(CLE_HIST_SEUIL, JSON.stringify(suivant));
    }
    window.dispatchEvent(new Event(EVT_SEUIL));
  } catch {
    /* stockage indisponible */
  }
}

const CLE_VU_FIABILITE = "artiflow.taches.fiabiliteVu";
const EVT_VU_FIABILITE = "artiflow-taches-fiabilite-vu";
/** Événement diffusé quand l'utilisateur marque (ou efface) le bandeau de fiabilité comme vu. */
export const FIABILITE_VU_EVENT = EVT_VU_FIABILITE;

/**
 * Horodatage du dernier passage marqué « vu », ou null. Le bandeau de fiabilité se masque
 * tant qu'aucun nouveau passage n'est venu après cette marque.
 */
export function lireFiabiliteVu(): string | null {
  try {
    return localStorage.getItem(CLE_VU_FIABILITE);
  } catch {
    return null;
  }
}

/** Marque le passage courant comme « vu » : le bandeau de fiabilité reste masqué jusqu'au prochain passage. */
export function marquerFiabiliteVu(quand: string): void {
  if (!quand) return;
  try {
    localStorage.setItem(CLE_VU_FIABILITE, quand);
    window.dispatchEvent(new Event(EVT_VU_FIABILITE));
  } catch {
    /* stockage indisponible */
  }
}

/** Réinitialise la marque « vu » (le bandeau de fiabilité réapparaît immédiatement). */
export function effacerFiabiliteVu(): void {
  try {
    localStorage.removeItem(CLE_VU_FIABILITE);
    window.dispatchEvent(new Event(EVT_VU_FIABILITE));
  } catch {
    /* stockage indisponible */
  }
}

/**
 * Dernier passage silencieux 100 % réussi (toutes les fonctions joignables), ou null.
 * Sert de repère « dernière fiabilité parfaite » dans le résumé du tableau de bord.
 */
export function dernierPassageParfait(passages: PassageSilencieux[]): PassageSilencieux | null {
  return passages.find((p) => p.total > 0 && p.joignables >= p.total) ?? null;
}

/**
 * Taux de joignabilité agrégé (entre 0 et 1) sur les derniers passages, ou null si aucun
 * passage exploitable. Sert à afficher un pourcentage de fiabilité sur les derniers contrôles.
 */
export function tauxJoignabilite(passages: PassageSilencieux[], max = 12): number | null {
  const serie = passages.slice(0, max).filter((p) => p.total > 0);
  if (serie.length === 0) return null;
  const joignables = serie.reduce((s, p) => s + p.joignables, 0);
  const total = serie.reduce((s, p) => s + p.total, 0);
  return total > 0 ? joignables / total : null;
}

/**
 * Nombre de passages partiels consécutifs les plus récents (fin de série) : au moins une
 * fonction n'était pas joignable. Sert à détecter une dégradation progressive de la fiabilité.
 */
export function passagesPartielsConsecutifs(passages: PassageSilencieux[]): number {
  let n = 0;
  for (const p of passages) {
    if (p.total > 0 && p.joignables < p.total) n += 1;
    else break;
  }
  return n;
}

const CLE_CREEES = "artiflow.taches.creees";
const EVT_CREEES = "artiflow-taches-creees";
/** Événement diffusé quand une case « tâche créée » change (suivi de mise en place du cron). */
export const TACHES_CREEES_EVENT = EVT_CREEES;

/**
 * Cases « tâche créée » cochées par l'utilisateur, indexées par slug de fonction. Purement
 * local (trace de progression de la mise en place sur cron-job.org), robuste à un stockage corrompu.
 */
export function lireTachesCreees(): Record<string, boolean> {
  try {
    const brut = localStorage.getItem(CLE_CREEES);
    if (!brut) return {};
    const parsed = JSON.parse(brut) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, boolean> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([slug, valeur]) => {
      if (valeur === true) out[slug] = true;
    });
    return out;
  } catch {
    return {};
  }
}

/** Coche (ou décoche) une tâche comme « créée » et prévient l'affichage. */
export function basculerTacheCreee(slug: string, cree: boolean): void {
  if (!slug) return;
  const actuel = lireTachesCreees();
  if (cree) actuel[slug] = true;
  else delete actuel[slug];
  try {
    localStorage.setItem(CLE_CREEES, JSON.stringify(actuel));
    window.dispatchEvent(new Event(EVT_CREEES));
  } catch {
    /* stockage indisponible */
  }
}

/** Décoche toutes les tâches (le suivi repart de zéro). */
export function effacerTachesCreees(): void {
  try {
    localStorage.removeItem(CLE_CREEES);
    window.dispatchEvent(new Event(EVT_CREEES));
  } catch {
    /* stockage indisponible */
  }
}