import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";
import { equipe } from "@/mocks/equipe";
import { logoArtiFlowPro, profilsSociaux } from "@/mocks/social";

/**
 * Injecte un bloc Schema.org dédié aux fondateurs de la marque.
 * Il réutilise le même @id que le bloc Organization global afin que Google
 * consolide les signaux autour d'une seule entité de marque (name, url, logo,
 * profils sociaux, fondateurs et leurs rôles), ce qui renforce le Knowledge
 * Panel. Chaque fondateur dispose de sa photo, de sa fiche bio dédiée (url),
 * de ses domaines d'expertise et de son profil LinkedIn.
 */
export function useFoundersSchema(id = "artiflow-founders-schema") {
  const origin = getSiteOrigin();
  const organizationId = `${origin}/#organization`;

  const fondateurs = equipe.filter((membre) => /cofondat/i.test(membre.role));

  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": organizationId,
    name: "ArtiFlow-pro",
    url: origin,
    logo: logoArtiFlowPro,
    sameAs: profilsSociaux,
    description:
      "ArtiFlow-pro est l'assistant IA des artisans du bâtiment : devis générés par IA, relances automatiques, planning intelligent et suivi de chantier.",
    founder: fondateurs.map((membre) => ({
      "@type": "Person",
      "@id": `${origin}/a-propos#${membre.id}`,
      name: membre.name,
      jobTitle: membre.role,
      description: membre.bio,
      image: membre.photo,
      url: `${origin}/a-propos#${membre.id}`,
      knowsAbout: membre.expertises,
      workLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: membre.ville,
          addressCountry: "FR",
        },
      },
      worksFor: { "@id": organizationId },
      sameAs: membre.linkedin,
    })),
  };

  useStructuredData(id, data);
}