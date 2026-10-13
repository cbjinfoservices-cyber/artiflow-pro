/**
 * Commentaire libre rattaché à une adresse email d'essai des liens d'authentification (Diagnostic).
 * Mémorisation locale d'un petit texte par adresse, pour annoter une adresse isolée sur le graphe de
 * régularité (ex. « boîte pleine », « en quarantaine », « à recontacter »). Aucune donnée métier :
 * c'est un mémo d'interface, repris dans le CSV et le récap copié quand une adresse est isolée.
 */

const CLE = "artiflow.liens-auth.commentaires-adresses";

/** Longueur maximale d'un commentaire d'adresse. */
export const COMMENTAIRE_ADRESSE_MAX = 200;

/** Événement diffusé après chaque modification, pour tenir l'affichage à jour à chaud. */
export const COMMENTAIRES_ADRESSES_EVENT = "artiflow-liens-auth-commentaires-adresses";

/** Clé de stockage d'une adresse (minuscules, sans espaces superflus). */
function cleAdresse(email: string): string {
  return email.trim().toLowerCase();
}

/** Tous les commentaires enregistrés, indexés par adresse en minuscules. */
export function lireCommentairesAdresses(): Record<string, string> {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return {};
    const parsed = JSON.parse(brut);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([k, v]) => {
      if (typeof v === "string" && v.trim()) out[k] = v;
    });
    return out;
  } catch {
    return {};
  }
}

/** Commentaire mémorisé pour une adresse donnée (chaîne vide si aucun). */
export function lireCommentaireAdresse(email: string): string {
  if (!email) return "";
  return lireCommentairesAdresses()[cleAdresse(email)] ?? "";
}

/** Mémorise (ou efface si vide) le commentaire d'une adresse, puis prévient les composants. */
export function ecrireCommentaireAdresse(email: string, commentaire: string): void {
  const cle = cleAdresse(email);
  if (!cle) return;
  try {
    const tous = lireCommentairesAdresses();
    const propre = commentaire.slice(0, COMMENTAIRE_ADRESSE_MAX);
    if (propre.trim()) tous[cle] = propre;
    else delete tous[cle];
    localStorage.setItem(CLE, JSON.stringify(tous));
    window.dispatchEvent(new Event(COMMENTAIRES_ADRESSES_EVENT));
  } catch {
    /* stockage indisponible : le commentaire n'est pas persistant */
  }
}