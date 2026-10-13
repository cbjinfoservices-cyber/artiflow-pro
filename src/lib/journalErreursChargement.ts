/**
 * Journal local des erreurs de chargement.
 *
 * Objectif : repérer plus vite, depuis le back-office, les requêtes qui échouent en
 * silence (colonne renommée, table absente, liaison entre deux tables non déclarée…).
 * Chaque échec de chargement important est consigné ici avec son message brut et un
 * « indice » en clair déduit automatiquement (colonne / table / liaison en cause).
 *
 * Le journal est volontairement :
 *  — borné (les N dernières entrées seulement, pour ne jamais gonfler le stockage) ;
 *  — local au navigateur (il enregistre ce qui s'est produit sur CET appareil) ;
 *  — silencieux en cas de panne : journaliser ne doit JAMAIS faire échouer un chargement.
 */
import { ecrireJson, lireJson } from "@/lib/stockageLocal";
import { toCsv } from "@/lib/csv";

/** Événement diffusé (dans le même onglet) après toute modification du journal. */
export const JOURNAL_ERREURS_EVENT = "artiflow:journal-erreurs-chargement";

/** Clé de stockage local du journal. */
const CLE = "artiflow:sante:journalErreursChargement";

/** Nombre maximal d'entrées conservées (les plus récentes). */
const MAX_ENTREES = 40;

/** Gravité d'une erreur : « blocage » empêche l'affichage, « avertissement » est secondaire. */
export type GraviteErreur = "blocage" | "avertissement";

/** Une entrée du journal des erreurs de chargement. */
export interface ErreurChargement {
  /** Identifiant technique unique (clé React). */
  id: string;
  /** Horodatage ISO de la dernière occurrence. */
  quand: string;
  /** Écran concerné, lisible (ex. « Envois automatiques »). */
  ecran: string;
  /** Source précise (nom de table ou d'étape, ex. « recap_envois »). */
  source: string;
  /** Message d'erreur brut remonté par le Backend, ou message lisible. */
  message: string;
  /** Code d'erreur Backend quand il existe (ex. « 42703 »). */
  code: string | null;
  /** Indice en clair déduit du message (colonne / table / liaison), ou null. */
  indice: string | null;
  /** Gravité de l'erreur. */
  gravite: GraviteErreur;
  /** Incident marqué comme traité (« résolu ») par l'utilisateur. */
  resolu: boolean;
}

/** Entrée à fournir pour journaliser (id, horodatage et état résolu sont gérés automatiquement). */
export type EntreeErreurChargement = Omit<ErreurChargement, "id" | "quand" | "resolu">;

/* -------------------------------------------------------------------------- */
/*                         Analyse des messages d'erreur                       */
/* -------------------------------------------------------------------------- */

/** Message texte à partir d'une erreur quelconque (Error, erreur Backend, chaîne…). */
export function messageDepuisErreur(error: unknown): string {
  if (!error) return "Erreur inconnue";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || error.name || "Erreur";
  if (typeof error === "object") {
    const o = error as Record<string, unknown>;
    const msg = o.message ?? o.details ?? o.hint ?? o.error;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return "Erreur inconnue";
}

/** Code d'erreur Backend éventuel (ex. « 42703 », « PGRST200 »). */
export function codeDepuisErreur(error: unknown): string | null {
  if (error && typeof error === "object") {
    const c = (error as Record<string, unknown>).code;
    if (typeof c === "string" && c.trim()) return c;
  }
  return null;
}

/**
 * Déduit un indice lisible de la cause probable d'une erreur Backend : colonne
 * manquante, table absente, ou liaison entre deux tables non déclarée. Renvoie
 * `null` si le message ne permet pas de conclure.
 */
export function extraireIndiceErreur(
  message: string | null | undefined,
  code?: string | null,
): string | null {
  const msg = String(message ?? "");
  const c = String(code ?? "");

  // Colonne absente : « column X.Y does not exist » / « Could not find the 'Y' column of 'X' … »
  let m = msg.match(/column\s+["']?([\w]+)\.([\w]+)["']?\s+does not exist/i);
  if (m) return `Colonne « ${m[2]} » absente de la table « ${m[1]} ».`;

  m = msg.match(/Could not find the '([^']+)' column of '([^']+)'/i);
  if (m) return `Colonne « ${m[1]} » absente de la table « ${m[2]} ».`;

  // Table absente : « relation "X" does not exist »
  m = msg.match(/relation\s+["']([\w.]+)["']\s+does not exist/i);
  if (m) return `Table « ${m[1]} » introuvable.`;

  m = msg.match(/Could not find the table '([^']+)'/i);
  if (m) return `Table « ${m[1]} » introuvable.`;

  // Liaison manquante entre deux tables (jointure / embed PostgREST impossible).
  if (/Could not find a relationship between/i.test(msg)) {
    m = msg.match(/between '([^']+)' and '([^']+)'/i);
    if (m) return `Liaison manquante entre « ${m[1]} » et « ${m[2]} » (jointure impossible).`;
    return "Liaison entre deux tables introuvable (jointure impossible).";
  }

  if (c === "PGRST200" || c === "PGRST205") {
    return "Table ou liaison introuvable dans le cache du Backend.";
  }
  if (c === "42703") return "Une colonne demandée n'existe pas dans la table.";
  if (c === "42P01") return "Une table demandée n'existe pas.";
  if (/invalid input syntax/i.test(msg)) return "Type de valeur invalide pour une colonne.";
  if (/permission denied/i.test(msg)) return "Accès refusé par les règles de sécurité.";
  return null;
}

/* -------------------------------------------------------------------------- */
/*                        Lecture / écriture du journal                        */
/* -------------------------------------------------------------------------- */

/** Validation robuste d'une entrée relue depuis le stockage (jamais d'exception). */
function validerEntree(brut: unknown): ErreurChargement | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const gravite: GraviteErreur = o.gravite === "avertissement" ? "avertissement" : "blocage";
  return {
    id: String(o.id ?? ""),
    quand: String(o.quand ?? ""),
    ecran: String(o.ecran ?? ""),
    source: String(o.source ?? ""),
    message: String(o.message ?? ""),
    code: o.code === null || o.code === undefined ? null : String(o.code),
    indice: o.indice === null || o.indice === undefined ? null : String(o.indice),
    gravite,
    resolu: o.resolu === true,
  };
}

/** Validation robuste de la liste complète relue depuis le stockage. */
function validerListe(brut: unknown): ErreurChargement[] {
  if (!Array.isArray(brut)) return [];
  return brut.map(validerEntree).filter((e): e is ErreurChargement => e !== null);
}

/** Lit le journal courant (le plus récent en premier). Ne remonte jamais d'erreur. */
export function lireJournalErreurs(): ErreurChargement[] {
  return lireJson<ErreurChargement[]>(CLE, validerListe);
}

/** Préfixe d'identifiant unique, tolérant à l'absence de crypto.randomUUID. */
function nouvelId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* environnement sans crypto : on retombe sur un identifiant horodaté */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Prévient les composants du même onglet que le journal a changé. */
function notifier(): void {
  try {
    window.dispatchEvent(new Event(JOURNAL_ERREURS_EVENT));
  } catch {
    /* environnement sans window : on ignore */
  }
}

/**
 * Consigne une erreur de chargement. Les occurrences identiques consécutives
 * (même écran, même source, même message) sont fusionnées en rafraîchissant leur
 * horodatage, pour éviter de noyer un vrai problème sous des doublons.
 */
export function journaliserErreurChargement(entree: EntreeErreurChargement): void {
  try {
    const liste = lireJournalErreurs();
    const quand = new Date().toISOString();
    const dernier = liste[0];
    const estDoublon =
      dernier &&
      dernier.ecran === entree.ecran &&
      dernier.source === entree.source &&
      dernier.message === entree.message;

    if (estDoublon) {
      const maj: ErreurChargement[] = [
        {
          ...dernier,
          quand,
          code: entree.code ?? dernier.code,
          indice: entree.indice ?? dernier.indice,
          gravite: entree.gravite,
          // L'erreur se reproduit : on la « rouvre » même si elle avait été marquée résolue.
          resolu: false,
        },
        ...liste.slice(1),
      ];
      ecrireJson(CLE, maj);
    } else {
      const nouvelle: ErreurChargement = { id: nouvelId(), quand, resolu: false, ...entree };
      ecrireJson(CLE, [nouvelle, ...liste].slice(0, MAX_ENTREES));
    }
    notifier();
  } catch {
    /* journaliser ne doit jamais perturber le chargement en cours */
  }
}

/**
 * Raccourci : analyse une erreur quelconque et la consigne, avec son indice déduit.
 * À appeler depuis les `catch` des chargements (et les branches d'erreur Backend).
 */
export function journaliserDepuisErreur(params: {
  ecran: string;
  source: string;
  error: unknown;
  gravite?: GraviteErreur;
}): void {
  const { ecran, source, error } = params;
  const code = codeDepuisErreur(error);
  const message = messageDepuisErreur(error);
  journaliserErreurChargement({
    ecran,
    source,
    message,
    code,
    indice: extraireIndiceErreur(message, code),
    gravite: params.gravite ?? "blocage",
  });
}

/**
 * Marque (ou rouvre) un incident comme résolu. Sert à suivre ce qui a déjà été corrigé
 * sans le supprimer : l'entrée reste visible, simplement signalée comme traitée.
 */
export function marquerErreurResolue(id: string, resolu: boolean): void {
  try {
    const liste = lireJournalErreurs();
    const maj = liste.map((e) => (e.id === id ? { ...e, resolu } : e));
    ecrireJson(CLE, maj);
    notifier();
  } catch {
    /* journaliser ne doit jamais perturber l'interface */
  }
}

/** Vide entièrement le journal. */
export function viderJournalErreurs(): void {
  ecrireJson(CLE, []);
  notifier();
}

/**
 * Construit le contenu CSV du journal des erreurs de chargement : une ligne par incident,
 * la plus récente en premier. Sert à archiver une trace datée des incidents AVANT de les
 * corriger (le journal local pouvant être vidé). Les colonnes couvrent la date, la gravité,
 * l'écran, la source, le code Backend, l'indice en clair et le message brut.
 */
export function journalErreursVersCsv(entrees: ErreurChargement[]): string {
  const headers = ["Date et heure", "Gravité", "Résolu", "Écran", "Source", "Code", "Indice", "Message"];
  const rows = entrees.map((e) => [
    e.quand,
    e.gravite === "blocage" ? "Blocage" : "Avertissement",
    e.resolu ? "Oui" : "Non",
    e.ecran,
    e.source,
    e.code ?? "",
    e.indice ?? "",
    e.message,
  ]);
  return toCsv(headers, rows);
}