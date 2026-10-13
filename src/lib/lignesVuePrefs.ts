/**
 * Préférences de vue de la page « Bibliothèque de lignes » : on mémorise l'onglet
 * actif (« Mes lignes » / « Catalogue métier »), le filtre de catégorie, la recherche
 * texte en cours et l'activation du filtre « Épinglées uniquement », afin de les
 * restaurer à la prochaine visite. Ce sont de simples préférences d'affichage locales,
 * sans aucun impact sur les données en base. L'onglet, la catégorie et le filtre épinglées
 * sont sauvegardés sur le compte (Backend) ; la recherche en cours reste locale.
 *
 * Toutes les lectures / écritures passent par `src/lib/stockageLocal.ts` (jamais localStorage en direct).
 */

import { marquerPreferenceModifiee } from "@/lib/preferencesAffichageNotif";
import { ecrireBrut, ecrireJson, lireJson, lireTexte, supprimer } from "@/lib/stockageLocal";

export type OngletLignes = "perso" | "catalogue";

const ONGLET_KEY = "artiflow:biblio:lignes:onglet";
const CATEGORIE_KEY = "artiflow:biblio:lignes:categorie";
const RECHERCHE_KEY = "artiflow:biblio:lignes:recherche";
const EPINGLEES_KEY = "artiflow:biblio:lignes:epinglees";

/** Valeur du filtre signifiant « toutes les catégories ». */
export const CATEGORIE_TOUTES = "Toutes";

/** Configuration de vue complète (recherche + catégorie + filtre épinglées). */
export interface ConfigVueLignes {
  recherche: string;
  categorie: string;
  epinglees: boolean;
}

/** Relit l'onglet mémorisé (« perso » par défaut). */
export function lireOngletLignes(): OngletLignes {
  return lireTexte(ONGLET_KEY, "") === "catalogue" ? "catalogue" : "perso";
}

/** Mémorise l'onglet actif. */
export function ecrireOngletLignes(onglet: OngletLignes): void {
  if (lireOngletLignes() === onglet) return;
  if (!ecrireBrut(ONGLET_KEY, onglet)) return;
  marquerPreferenceModifiee("lignes");
}

/** Relit le filtre catégorie mémorisé (« Toutes » par défaut). */
export function lireCategorieLignes(): string {
  return lireTexte(CATEGORIE_KEY, "") || CATEGORIE_TOUTES;
}

/** Mémorise le filtre catégorie courant. */
export function ecrireCategorieLignes(categorie: string): void {
  if (lireCategorieLignes() === categorie) return;
  if (!ecrireBrut(CATEGORIE_KEY, categorie)) return;
  marquerPreferenceModifiee("lignes");
}

/** Relit la recherche texte mémorisée (chaîne vide par défaut). */
export function lireRechercheLignes(): string {
  return lireTexte(RECHERCHE_KEY, "");
}

/** Mémorise la recherche texte courante (on efface l'entrée si elle est vide). */
export function ecrireRechercheLignes(recherche: string): void {
  if (recherche) ecrireBrut(RECHERCHE_KEY, recherche);
  else supprimer(RECHERCHE_KEY);
}

/** Indique si le filtre « Épinglées uniquement » était actif à la dernière visite. */
export function lireEpingleesLignes(): boolean {
  return lireTexte(EPINGLEES_KEY, "") === "1";
}

/** Mémorise l'état du filtre « Épinglées uniquement ». */
export function ecrireEpingleesLignes(actif: boolean): void {
  if (lireEpingleesLignes() === actif) return;
  if (actif) {
    if (!ecrireBrut(EPINGLEES_KEY, "1")) return;
  } else {
    supprimer(EPINGLEES_KEY);
  }
  marquerPreferenceModifiee("lignes");
}

const CONFIG_KEY = "artiflow:biblio:lignes:derniereConfig";

/**
 * Relit la dernière configuration de filtres enregistrée (recherche + catégorie +
 * épinglées). Elle est conservée lorsqu'on réinitialise la vue, afin de pouvoir y
 * revenir d'un seul clic.
 */
export function lireDerniereConfigLignes(): ConfigVueLignes | null {
  return lireJson<ConfigVueLignes | null>(CONFIG_KEY, (brut) => {
    if (!brut || typeof brut !== "object") return null;
    const parsed = brut as Partial<ConfigVueLignes>;
    if (typeof parsed.recherche !== "string" || typeof parsed.categorie !== "string") return null;
    return {
      recherche: parsed.recherche,
      categorie: parsed.categorie,
      epinglees: Boolean(parsed.epinglees),
    };
  });
}

/** Mémorise la dernière configuration de filtres (restaurable d'un clic). */
export function ecrireDerniereConfigLignes(config: ConfigVueLignes): void {
  ecrireJson(CONFIG_KEY, config);
}

/** Oublie la dernière configuration de filtres mémorisée. */
export function effacerDerniereConfigLignes(): void {
  supprimer(CONFIG_KEY);
}