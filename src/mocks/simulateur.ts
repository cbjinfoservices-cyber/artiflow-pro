export const simulateurMetiers = [
  {
    slug: "plombier-chauffagiste",
    name: "Plombier chauffagiste",
    minutesAvant: 18,
    minutesApres: 2,
    tauxSignatureAvant: 36,
    tauxSignatureApres: 44,
    panierMoyen: 1200,
  },
  {
    slug: "electricien",
    name: "Électricien",
    minutesAvant: 22,
    minutesApres: 2.5,
    tauxSignatureAvant: 33,
    tauxSignatureApres: 42,
    panierMoyen: 1400,
  },
  {
    slug: "macon",
    name: "Maçon",
    minutesAvant: 28,
    minutesApres: 3,
    tauxSignatureAvant: 29,
    tauxSignatureApres: 37,
    panierMoyen: 8500,
  },
  {
    slug: "peintre-finitions",
    name: "Peintre finitions",
    minutesAvant: 16,
    minutesApres: 2,
    tauxSignatureAvant: 38,
    tauxSignatureApres: 46,
    panierMoyen: 2200,
  },
  {
    slug: "menuisier",
    name: "Menuisier",
    minutesAvant: 25,
    minutesApres: 3,
    tauxSignatureAvant: 31,
    tauxSignatureApres: 40,
    panierMoyen: 3800,
  },
  {
    slug: "carreleur",
    name: "Carreleur",
    minutesAvant: 20,
    minutesApres: 2.5,
    tauxSignatureAvant: 35,
    tauxSignatureApres: 43,
    panierMoyen: 2500,
  },
  {
    slug: "couvreur",
    name: "Couvreur",
    minutesAvant: 24,
    minutesApres: 3,
    tauxSignatureAvant: 30,
    tauxSignatureApres: 38,
    panierMoyen: 4200,
  },
  {
    slug: "platrier",
    name: "Plaquiste plâtrier",
    minutesAvant: 18,
    minutesApres: 2.5,
    tauxSignatureAvant: 34,
    tauxSignatureApres: 42,
    panierMoyen: 2600,
  },
  {
    slug: "installateur-climatisation",
    name: "Frigoriste climaticien",
    minutesAvant: 26,
    minutesApres: 3,
    tauxSignatureAvant: 31,
    tauxSignatureApres: 39,
    panierMoyen: 4200,
  },
];

/**
 * Exemples de lignes de devis climatisation que l'IA propose à partir de la
 * bibliothèque de prix de l'artisan. Servent d'aperçu concret sous le
 * simulateur de la page d'accueil.
 */
export const simulateurLignesClimatisation = [
  {
    designation: "Pose split 2,5 kW R32, support mural et liaisons",
    unite: "forfait",
    prix: 1690,
  },
  {
    designation: "Gainable 4 pièces, réseau de gaines et plénum",
    unite: "forfait",
    prix: 7450,
  },
  {
    designation: "Mise en service et contrôle d'étanchéité",
    unite: "intervention",
    prix: 240,
  },
];