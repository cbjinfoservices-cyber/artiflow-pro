/**
 * Date de dernière mise à jour de chaque guide (format ISO 8601).
 *
 * Sert à renseigner « dateModified » dans le balisage Schema.org : c'est le
 * signal qui indique aux moteurs de recherche qu'un contenu a été rafraîchi
 * récemment. Une date vide n'est jamais inventée : un guide absent de cette
 * table n'émet simplement pas de dateModified.
 *
 * Règle : la date de mise à jour doit toujours être postérieure (ou égale) à
 * la date de publication du guide. On reste volontairement près des dates de
 * parution pour refléter de véritables révisions éditoriales.
 */
const miseAJourGuides: Record<string, string> = {
  "devis-chaudiere-en-5-minutes": "2026-10-17",
  "relance-apres-depannage-urgent": "2026-09-18",
  "devis-mise-aux-normes-postes-oublies": "2026-09-29",
  "messages-relance-devis-electricite": "2026-09-22",
  "chiffrer-extension-sans-erreur-metres": "2026-10-17",
  "organiser-chantiers-par-zone": "2026-09-15",
  "devis-peinture-au-m2-methode-simple": "2026-10-17",
  "pourquoi-devis-facade-partent-trop-tard": "2026-09-19",
  "variantes-materiaux-dans-un-seul-devis": "2026-09-27",
  "suivre-commande-sur-mesure-du-devis-a-la-pose": "2026-09-13",
  "calculer-reserve-chutes-carrelage": "2026-09-30",
  "devis-salle-de-bain-structurer": "2026-10-17",
  "apres-orage-prioriser-urgences-toiture": "2026-10-04",
  "devis-sinistre-assurance-clair": "2026-09-18",
  "devis-faux-plafond-sans-erreur": "2026-09-25",
  "renovation-appartement-piece-par-piece": "2026-09-12",
  "chiffrer-pose-split-climatisation": "2026-10-21",
  "relancer-devis-pompe-a-chaleur": "2026-10-22",
  "contrat-entretien-climatisation": "2026-10-22",
  "facture-electronique-ce-qui-change-artisan": "2026-10-22",
};

/**
 * Retourne la date de dernière mise à jour d'un guide au format ISO 8601,
 * ou undefined si aucune date n'est renseignée.
 */
export function getGuideMiseAJour(slug?: string): string | undefined {
  if (!slug) return undefined;
  return miseAJourGuides[slug];
}