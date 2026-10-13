/**
 * Mémoire du filtre du bandeau « Prochaines exécutions » affiché dans le menu. Il ne s'agit
 * que d'une préférence d'affichage (aucune donnée métier) : l'utilisateur peut demander que le
 * dernier filtre choisi (« Tout », « Récaps » ou « Automatisations ») soit conservé entre deux
 * connexions. Tant que l'option n'est pas activée, rien n'est mémorisé.
 *
 * La lecture / écriture passe exclusivement par `@/lib/stockageLocal` (accès sûrs, sans exception).
 */

import { ecrireBrut, lireBrut, supprimer } from "@/lib/stockageLocal";

const CLE_FILTRE = "artiflow.bandeau.filtre";
const CLE_OPTION = "artiflow.bandeau.filtre.memoire";
const CLE_COMPTEURS = "artiflow.bandeau.filtre.compteurs";
const CLE_SURVOL = "artiflow.bandeau.filtre.survol";
const CLE_LIBELLE = "artiflow.bandeau.filtre.libelle";

/** Libellé par défaut de la pastille « filtre mémorisé » (quand l'utilisateur n'en a pas choisi). */
export const LIBELLE_FILTRE_DEFAUT = "Filtre mémorisé";

/** Filtre d'affichage du bandeau : tout, ou un seul type de traitement. */
export type FiltreBandeau = "tout" | "recap" | "automatisation";

/** Événement diffusé après chaque modification, pour tenir l'affichage à jour à chaud. */
export const FILTRE_BANDEAU_EVENT = "artiflow-bandeau-filtre";

/** Diffuse l'événement de mise à jour, en ignorant un environnement sans window. */
function notifier(): void {
  try {
    window.dispatchEvent(new Event(FILTRE_BANDEAU_EVENT));
  } catch {
    /* environnement sans window : on ignore */
  }
}

/** Vrai si la valeur fournie est un filtre reconnu. */
function estFiltre(valeur: string | null): valeur is FiltreBandeau {
  return valeur === "tout" || valeur === "recap" || valeur === "automatisation";
}

/** L'option « mémoriser le filtre » est-elle activée ? Désactivée par défaut. */
export function lireOptionFiltreActive(): boolean {
  return lireBrut(CLE_OPTION) === "1";
}

/** Dernier filtre mémorisé, ou « tout » si aucun n'a été conservé. */
export function lireFiltreMemorise(): FiltreBandeau {
  const brut = lireBrut(CLE_FILTRE);
  return estFiltre(brut) ? brut : "tout";
}

/** Mémorise le filtre courant et prévient les composants intéressés. */
export function ecrireFiltreMemorise(filtre: FiltreBandeau): void {
  if (!ecrireBrut(CLE_FILTRE, filtre)) return;
  notifier();
}

/**
 * Active ou désactive la mémorisation du filtre. À la désactivation, le filtre conservé et son
 * libellé personnalisé sont effacés : l'option coupée ne laisse aucune trace.
 */
export function ecrireOptionFiltreActive(active: boolean): void {
  if (!ecrireBrut(CLE_OPTION, active ? "1" : "0")) return;
  if (!active) {
    supprimer(CLE_FILTRE);
    supprimer(CLE_LIBELLE);
  }
  notifier();
}

/** Compteurs de consultation par filtre (sert à déterminer le filtre le plus consulté). */
function lireCompteurs(): Record<FiltreBandeau, number> {
  const base: Record<FiltreBandeau, number> = { tout: 0, recap: 0, automatisation: 0 };
  const brut = lireBrut(CLE_COMPTEURS);
  if (!brut) return base;
  try {
    const parsed = JSON.parse(brut) as Partial<Record<FiltreBandeau, number>>;
    (["tout", "recap", "automatisation"] as FiltreBandeau[]).forEach((cle) => {
      const valeur = parsed[cle];
      if (typeof valeur === "number" && Number.isFinite(valeur) && valeur > 0) {
        base[cle] = Math.floor(valeur);
      }
    });
  } catch {
    /* données illisibles : compteurs vides */
  }
  return base;
}

/**
 * Récap des consultations par filtre : nombre de fois où chaque filtre (« Tout », « Récaps »,
 * « Automatisations ») a été choisi. Sert à afficher d'un coup d'œil le filtre le plus consulté.
 */
export function lireConsultations(): Record<FiltreBandeau, number> {
  return lireCompteurs();
}

/** Remet à zéro les compteurs de consultation : le « filtre le plus consulté » repart de zéro. */
export function reinitialiserConsultations(): void {
  supprimer(CLE_COMPTEURS);
  notifier();
}

/** Mémorise une consultation de filtre (chaque choix fait monter son compteur). */
export function enregistrerConsultation(filtre: FiltreBandeau): void {
  const compteurs = lireCompteurs();
  compteurs[filtre] += 1;
  if (!ecrireBrut(CLE_COMPTEURS, JSON.stringify(compteurs))) return;
  notifier();
}

/**
 * Filtre le plus consulté (celui que l'utilisateur choisit le plus souvent), ou `null` si aucun
 * historique n'existe encore. Sert à rouvrir le bandeau directement sur la vue préférée.
 */
export function lireFiltrePlusConsulte(): FiltreBandeau | null {
  const compteurs = lireCompteurs();
  let meilleur: FiltreBandeau | null = null;
  let max = 0;
  (["tout", "recap", "automatisation"] as FiltreBandeau[]).forEach((cle) => {
    if (compteurs[cle] > max) {
      max = compteurs[cle];
      meilleur = cle;
    }
  });
  return meilleur;
}

/** Mémorise la dernière famille survolée (utile pour rouvrir le bandeau au bon endroit). */
export function enregistrerSurvol(filtre: FiltreBandeau): void {
  ecrireBrut(CLE_SURVOL, filtre);
}

/** Dernière famille survolée dans le bandeau, ou `null` si aucune n'a été survolée. */
export function lireDernierSurvol(): FiltreBandeau | null {
  const brut = lireBrut(CLE_SURVOL);
  return estFiltre(brut) ? brut : null;
}

/** Libellé personnalisé de la pastille « filtre mémorisé » (chaîne vide = libellé par défaut). */
export function lireLibelleFiltre(): string {
  return lireBrut(CLE_LIBELLE) ?? "";
}

/** Enregistre le libellé personnalisé du filtre mémorisé (vide = libellé par défaut, 24 max). */
export function ecrireLibelleFiltre(libelle: string): void {
  const propre = libelle.trim().slice(0, 24);
  if (propre) {
    if (!ecrireBrut(CLE_LIBELLE, propre)) return;
  } else {
    supprimer(CLE_LIBELLE);
  }
  notifier();
}