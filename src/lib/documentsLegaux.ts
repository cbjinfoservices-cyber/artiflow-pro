/**
 * Données communes aux documents légaux (politique de confidentialité, accord de sous-traitance,
 * CGV) : une seule source pour l'identité de l'éditeur, la liste des prestataires et la version
 * des conditions acceptées à l'inscription.
 */

/** Version des CGV et de l'accord de sous-traitance : enregistrée avec l'acceptation à l'inscription. */
export const VERSION_CONDITIONS = "2026-10-25";

/** Date lisible de la version en vigueur. */
export const DATE_CONDITIONS = "25 octobre 2026";

export const EDITEUR = {
  nom: "CBJ-INFOSERVICES",
  forme: "société à responsabilité limitée",
  adresse: "14 voie des Meuniers, 94550 Chevilly-Larue, France",
  siren: "990 157 562",
  email: "contact@artiflow-pro.com",
};

/** Prestataires (sous-traitants ultérieurs) : à tenir aligné avec le code (supabase/functions/_shared). */
export const PRESTATAIRES = [
  { nom: "IONOS SE", role: "Hébergement du site web", lieu: "Union européenne" },
  { nom: "Supabase, Inc.", role: "Base de données, comptes, fichiers et photos", lieu: "Données hébergées en Irlande (UE)" },
  { nom: "Brevo (Sendinblue SAS)", role: "Envoi des emails et des SMS", lieu: "France (UE)" },
  { nom: "Stripe Payments Europe Ltd", role: "Paiement des abonnements", lieu: "Irlande (UE)" },
  { nom: "OpenAI", role: "Rédaction des devis par intelligence artificielle", lieu: "États-Unis" },
];
