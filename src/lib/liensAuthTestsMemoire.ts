/**
 * Historique LOCAL des liens d'authentification relancés depuis l'écran Diagnostic
 * (connexion par email et mot de passe oublié). Il ne s'agit que d'une trace d'affichage,
 * sans donnée métier : on garde les derniers essais (date, type, adresse) pour se repérer
 * entre deux vérifications, sans rien écrire côté Backend. Les liens de test eux-mêmes ne
 * sont jamais stockés — seul le fait de les avoir demandés l'est.
 */

import { ecrireJson, supprimer, lireJson } from "@/lib/stockageLocal";

/** Type de lien d'authentification relancé. */
export type TypeLienAuth = "connexion" | "reset";

/** Un essai de lien d'authentification relancé depuis le Diagnostic. */
export interface LienAuthTestEntree {
  id: string;
  type: TypeLienAuth;
  email: string;
  created_at: string;
}

const CLE = "artiflow.liens-auth.tests";

/** Nombre maximum d'essais conservés (les plus récents). Assez large pour compter
 * fidèlement les tests d'un mois glissant (régularité des vérifications). */
const MAX = 100;

/** Événement diffusé après chaque modification, pour tenir l'affichage à jour à chaud. */
export const LIENS_AUTH_TESTS_EVENT = "artiflow-liens-auth-tests";

/** Liste des derniers liens de test relancés, du plus récent au plus ancien. */
export function lireLiensAuthTests(): LienAuthTestEntree[] {
  return lireJson<LienAuthTestEntree[]>(CLE, (brut) => {
    if (!Array.isArray(brut)) return [];
    return brut
      .filter(
        (v): v is { type?: unknown; email: string; created_at?: unknown; id?: unknown } =>
          Boolean(v) && typeof (v as { email?: unknown }).email === "string",
      )
      .map((v, i) => ({
        id: typeof v.id === "string" ? v.id : `${Date.now()}-${i}`,
        type: v.type === "reset" ? "reset" : "connexion",
        email: v.email,
        created_at: typeof v.created_at === "string" ? v.created_at : new Date().toISOString(),
      }))
      .slice(0, MAX);
  });
}

/** Ajoute un essai en tête de liste (historique chronologique : chaque essai compte,
 * même type + même adresse, pour pouvoir mesurer la régularité des vérifications),
 * puis borne la liste. */
export function ajouterLienAuthTest(type: TypeLienAuth, email: string): void {
  const propre = email.trim();
  if (!propre) return;
  const entree: LienAuthTestEntree = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    email: propre,
    created_at: new Date().toISOString(),
  };
  const liste = lireLiensAuthTests();
  liste.unshift(entree);
  ecrire(liste.slice(0, MAX));
}

/** Vide l'historique local des essais. */
export function effacerLiensAuthTests(): void {
  supprimer(CLE);
}

/** Écrit la liste en mémoire locale et prévient les composants intéressés. */
function ecrire(liste: LienAuthTestEntree[]): void {
  if (!ecrireJson(CLE, liste)) return;
  try {
    window.dispatchEvent(new Event(LIENS_AUTH_TESTS_EVENT));
  } catch {
    /* environnement sans window : on ignore */
  }
}