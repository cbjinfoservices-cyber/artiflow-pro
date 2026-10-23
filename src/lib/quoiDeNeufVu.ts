import { nouveautes, type Nouveaute } from "@/mocks/nouveautes";
import { cleArtiflow, ecrireBrut, lireTexte } from "@/lib/stockageLocal";

/**
 * Mémoire « quoi de neuf » : la dernière version du journal que l'artisan a vue.
 *
 * Une seule clé alimente trois endroits qui doivent rester d'accord entre eux :
 *  — le bandeau « Quoi de neuf » de l'espace artisan (il se remontre à chaque nouvelle version) ;
 *  — le compteur de nouveautés non lues à côté du bouton d'aide ;
 *  — le bloc « Quoi de neuf » de la cloche.
 *
 * La règle est volontairement simple : tout ce qui est plus récent que la version vue est non lu.
 * Une version inconnue (ou absente) est traitée comme « rien n'a encore été lu », ce qui est le cas
 * d'un nouvel arrivant : le journal complet reste à découvrir.
 */
export const CLE_QUOI_DE_NEUF_VU = cleArtiflow("quoiDeNeuf", "vuVersion");

/** Le journal, du plus récent au plus ancien : un seul tri fait autorité pour tout le projet. */
export const nouveautesTriees: Nouveaute[] = [...nouveautes].sort((a, b) =>
  b.dateIso.localeCompare(a.dateIso),
);

/** La dernière livraison publiée (tête du journal). */
export const derniereNouveaute: Nouveaute = nouveautesTriees[0];

/** Version du journal déjà lue (« » si l'artisan n'a encore fermé aucune annonce). */
export function lireVersionVue(): string {
  return lireTexte(CLE_QUOI_DE_NEUF_VU).trim();
}

/** Mémorise comme lue une version du journal (par défaut la plus récente). */
export function marquerQuoiDeNeufVu(version: string = derniereNouveaute.version): void {
  ecrireBrut(CLE_QUOI_DE_NEUF_VU, version);
}

/**
 * Nouveautés publiées après la version vue, de la plus récente à la plus ancienne.
 * Une version inconnue (absente, renommée) ne doit jamais masquer des livraisons :
 * on considère alors que tout reste à lire.
 */
export function nonLuesDepuis(versionVue: string): Nouveaute[] {
  if (!versionVue) return [...nouveautesTriees];
  const index = nouveautesTriees.findIndex((n) => n.version === versionVue);
  if (index < 0) return [...nouveautesTriees];
  return nouveautesTriees.slice(0, index);
}