/**
 * Journal local des « signalements imminents » déjà envoyés. Il ne s'agit que d'un historique
 * d'affichage (aucune donnée métier) : chaque fois qu'une notification navigateur part pour un
 * traitement qui entre dans la fenêtre d'alerte, une ligne est ajoutée ici, pour pouvoir vérifier
 * ce qui a déjà été signalé et à quel moment. Les dernières entrées sont conservées en tête.
 */

/** Une ligne du journal : un traitement signalé à un instant donné. */
export interface EntreeJournalImminent {
  /** Clé unique de la ligne (identifiant du traitement + horodatage). */
  cle: string;
  /** Identifiant de l'automatisation concernée (sert à regrouper / réactiver). */
  id: string;
  /** Nom affiché de l'automatisation au moment du signalement. */
  nom: string;
  /** Nature du traitement (récap ou automatisation). */
  categorie: "recap" | "automatisation";
  /** Classe d'icône Remix affichée. */
  icone: string;
  /** Horodatage ISO du signalement. */
  notifieLe: string;
  /** Délai restant (en minutes) au moment du signalement. */
  dansMin: number;
}

const CLE = "artiflow.imminents.journal";
const MAX = 60;

/** Événement diffusé après chaque modification, pour tenir l'affichage à jour à chaud. */
export const JOURNAL_IMMINENTES_EVENT = "artiflow-imminents-journal";

/** Lit le journal (du plus récent au plus ancien), robuste à un stockage corrompu. */
export function lireJournalImminentes(): EntreeJournalImminent[] {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return [];
    const parsed = JSON.parse(brut);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is EntreeJournalImminent =>
        Boolean(v) && typeof v.cle === "string" && typeof v.notifieLe === "string",
      )
      .map((v) => ({
        cle: v.cle,
        id: typeof v.id === "string" ? v.id : v.cle,
        nom: typeof v.nom === "string" ? v.nom : "Automatisation",
        categorie: v.categorie === "recap" ? "recap" : "automatisation",
        icone: typeof v.icone === "string" ? v.icone : "ri-timer-flash-line",
        notifieLe: v.notifieLe,
        dansMin: Number.isFinite(v.dansMin) ? Math.max(0, Math.round(v.dansMin)) : 0,
      }));
  } catch {
    return [];
  }
}

/** Ajoute des lignes en tête du journal (les plus récentes d'abord) et le plafonne. */
export function ajouterJournalImminentes(entrees: EntreeJournalImminent[]): void {
  if (entrees.length === 0) return;
  try {
    const liste = [...entrees, ...lireJournalImminentes()].slice(0, MAX);
    localStorage.setItem(CLE, JSON.stringify(liste));
    window.dispatchEvent(new Event(JOURNAL_IMMINENTES_EVENT));
  } catch {
    /* stockage indisponible : le journal n'est pas persistant */
  }
}

/** Vide le journal des signalements. */
export function viderJournalImminentes(): void {
  try {
    localStorage.removeItem(CLE);
    window.dispatchEvent(new Event(JOURNAL_IMMINENTES_EVENT));
  } catch {
    /* stockage indisponible : rien à vider */
  }
}