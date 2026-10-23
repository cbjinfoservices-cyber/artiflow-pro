/**
 * Calcul partagé des répartitions de pros inscrits par information d'entreprise.
 *
 * Utilisé à la fois par le bloc visuel en tête de « Pros inscrits »
 * (barres empilées + légende), par son export CSV et par l'archive PDF des
 * abonnements — afin que le même chiffre s'affiche partout.
 *
 * Trois dimensions sont couvertes : le statut juridique, la taille de
 * l'entreprise et le métier.
 */

import { METIERS } from "@/lib/metiers";
import { STATUTS_JURIDIQUES, TAILLES_ENTREPRISE } from "@/lib/entreprise";

/** Toute ligne portant les informations d'entreprise d'un pro. */
export interface ItemRepartitionnable {
  statut_juridique?: string | null;
  taille_entreprise?: string | null;
  metier?: string | null;
}

/** Dimension de segmentation d'une répartition. */
export type ChampRepartition = "statut_juridique" | "taille_entreprise" | "metier";

/** Une part de la répartition : libellé lisible, nombre de pros et part en %. */
export interface RepartitionLigne {
  /** Valeur brute stockée (ou `__non_renseigne`). */
  key: string;
  /** Libellé lisible affiché à l'utilisateur. */
  label: string;
  count: number;
  pct: number;
}

/** Clé réservée isolant les pros dont l'information n'est pas renseignée. */
export const CLE_NON_RENSEIGNE = "__non_renseigne";

/** Liste de référence associée à chaque dimension (pour garder un ordre stable). */
const REFERENCES: Record<ChampRepartition, readonly { value: string; label: string }[]> = {
  statut_juridique: STATUTS_JURIDIQUES,
  taille_entreprise: TAILLES_ENTREPRISE,
  metier: METIERS,
};

/**
 * Construit la répartition d'une liste de pros selon une dimension donnée.
 * Les valeurs de référence sans effectif sont masquées, et les pros sans
 * information sont regroupés dans une ligne « Non renseigné » placée en dernier.
 */
export function repartitionParChamp(
  items: ItemRepartitionnable[],
  champ: ChampRepartition,
): RepartitionLigne[] {
  const total = items.length;
  if (total === 0) return [];

  const lignes: RepartitionLigne[] = REFERENCES[champ]
    .map((v) => {
      const count = items.filter((it) => it[champ] === v.value).length;
      return { key: v.value, label: v.label, count, pct: Math.round((count / total) * 100) };
    })
    .filter((l) => l.count > 0);

  const nonRenseigne = items.filter((it) => !it[champ]).length;
  if (nonRenseigne > 0) {
    lignes.push({
      key: CLE_NON_RENSEIGNE,
      label: "Non renseigné",
      count: nonRenseigne,
      pct: Math.round((nonRenseigne / total) * 100),
    });
  }

  return lignes;
}