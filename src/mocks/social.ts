export type ReseauSocial = {
  icon: string;
  label: string;
  href: string;
};

/**
 * Profils officiels d'ArtiFlow-pro.
 * Source unique utilisée par le pied de page et par les données structurées
 * (champ sameAs des entités Organization / Person) afin de consolider l'entité
 * de marque pour le Knowledge Graph.
 */
export const reseauxSociaux: ReseauSocial[] = [
  {
    icon: "ri-linkedin-fill",
    label: "LinkedIn d'ArtiFlow-pro",
    href: "https://www.linkedin.com/company/artiflow-pro",
  },
  {
    icon: "ri-facebook-circle-fill",
    label: "Facebook d'ArtiFlow-pro",
    href: "https://www.facebook.com/artiflowpro",
  },
  {
    icon: "ri-instagram-line",
    label: "Instagram d'ArtiFlow-pro",
    href: "https://www.instagram.com/artiflowpro",
  },
  {
    icon: "ri-youtube-fill",
    label: "Chaîne YouTube d'ArtiFlow-pro",
    href: "https://www.youtube.com/@artiflowpro",
  },
];

export const profilsSociaux: string[] = reseauxSociaux.map((reseau) => reseau.href);

export const logoArtiFlowPro =
  "https://readdy.ai/api/search-image?query=Minimal%20modern%20app%20logo%20mark%20for%20an%20AI%20construction%20assistant%20named%20ArtiFlow-pro%2C%20flat%20geometric%20symbol%20combining%20a%20stylized%20hammer%20and%20a%20spark%2C%20warm%20amber%20orange%20and%20deep%20teal%20green%2C%20centered%20on%20a%20clean%20off-white%20background%2C%20simple%20vector%20style%2C%20crisp%20high%20detail&width=512&height=512&seq=artiflow-logo-mark&orientation=squarish";

export const descriptionArtiFlowPro =
  "ArtiFlow-pro est l'assistant IA des artisans du bâtiment : devis générés par IA, relances automatiques, planning intelligent et suivi de chantier.";