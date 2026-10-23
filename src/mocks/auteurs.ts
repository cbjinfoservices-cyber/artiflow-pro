import { articles, type Article } from "@/mocks/ressources";

/**
 * Répartition des guides par membre de l'équipe (auteur du contenu).
 * Cette table relie chaque guide à une personne de la fiche « équipe », ce qui
 * permet de construire une véritable page auteur par membre (bio + articles
 * écrits + prises de parole) et de renforcer les entités Person.
 *
 * Clé = identifiant du membre (ancre /a-propos#id), valeur = liste des slugs de
 * guides dont il/elle est l'auteur.
 */
export const articlesParAuteur: Record<string, string[]> = {
  "lea-marchand": [
    "devis-chaudiere-en-5-minutes",
    "relance-apres-depannage-urgent",
    "chiffrer-extension-sans-erreur-metres",
    "chiffrer-pose-split-climatisation",
  ],
  "antoine-lefevre": [
    "organiser-chantiers-par-zone",
    "devis-faux-plafond-sans-erreur",
    "renovation-appartement-piece-par-piece",
  ],
  "karim-benali": [
    "devis-mise-aux-normes-postes-oublies",
    "messages-relance-devis-electricite",
  ],
  "sophie-renard": [
    "variantes-materiaux-dans-un-seul-devis",
    "suivre-commande-sur-mesure-du-devis-a-la-pose",
    "calculer-reserve-chutes-carrelage",
  ],
  "camille-dufour": [
    "devis-salle-de-bain-structurer",
    "devis-peinture-au-m2-methode-simple",
    "apres-orage-prioriser-urgences-toiture",
  ],
  "julien-barbier": [
    "pourquoi-devis-facade-partent-trop-tard",
    "devis-sinistre-assurance-clair",
    "relancer-devis-pompe-a-chaleur",
    "contrat-entretien-climatisation",
    "facture-electronique-ce-qui-change-artisan",
  ],
};

/** Identifiant du membre auteur d'un guide, ou undefined si non attribué. */
export function auteurIdDuGuide(slug: string): string | undefined {
  return Object.keys(articlesParAuteur).find((auteurId) =>
    articlesParAuteur[auteurId].includes(slug)
  );
}

/** Guides écrits par un membre, ordonnés comme le catalogue principal. */
export function articlesDuMembre(membreId: string): Article[] {
  const slugs = articlesParAuteur[membreId] ?? [];
  return articles.filter((article) => slugs.includes(article.slug));
}