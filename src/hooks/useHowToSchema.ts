import { useStructuredData } from "@/hooks/useStructuredData";

export type HowToStep = {
  /** Titre court de l'étape, repris de la section correspondante du guide. */
  name: string;
  /** Description de l'étape, alignée sur le contenu réellement affiché. */
  text: string;
};

export type HowToInput = {
  /** Slug du guide, pour construire l'identifiant du bloc JSON-LD. */
  slug: string;
  /** Titre de la procédure (généralement le titre du guide). */
  name: string;
  /** Résumé de la méthode. */
  description: string;
  /** Durée totale de la procédure au format ISO 8601 (ex. « PT5M »). */
  totalTime?: string;
  /** Date de dernière mise à jour du guide (ISO 8601), pour signaler la fraîcheur. */
  dateModified?: string;
  /** Étapes ordonnées de la méthode. */
  steps: HowToStep[];
};

/**
 * Injecte un bloc Schema.org HowTo pour les guides qui décrivent une méthode
 * pas à pas. Les étapes doivent correspondre au contenu réellement affiché sur
 * la page, sous peine de voir le balisage ignoré par les moteurs de recherche.
 */
export function useHowToSchema(howTo: HowToInput | null, id = "artiflow-howto-schema") {
  const data =
    howTo && howTo.steps.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: howTo.name,
          description: howTo.description,
          inLanguage: "fr-FR",
          ...(howTo.totalTime ? { totalTime: howTo.totalTime } : {}),
          ...(howTo.dateModified ? { dateModified: howTo.dateModified } : {}),
          step: howTo.steps.map((step, index) => ({
            "@type": "HowToStep",
            position: index + 1,
            name: step.name,
            text: step.text,
          })),
        }
      : null;

  useStructuredData(data ? id : `${id}-disabled`, data);
}