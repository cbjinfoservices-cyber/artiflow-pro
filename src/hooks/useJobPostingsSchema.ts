import { useStructuredData } from "@/hooks/useStructuredData";
import { getSiteOrigin } from "@/lib/site";
import { postesOuverts } from "@/mocks/rejoindre";
import { logoArtiFlowPro, profilsSociaux } from "@/mocks/social";

/**
 * Injecte un bloc Schema.org JobPosting pour chaque poste ouvert.
 * Ce balisage rend les offres éligibles à Google Jobs (encart d'offres
 * d'emploi dans les résultats de recherche). Il faut impérativement que la
 * page affiche réellement les postes décrits ici.
 */
export function useJobPostingsSchema(id = "artiflow-job-postings-schema") {
  const origin = getSiteOrigin();
  const now = new Date();
  const datePosted = now.toISOString().slice(0, 10);
  const validThrough = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const jobPostings = postesOuverts.map((poste) => ({
    "@type": "JobPosting",
    identifier: {
      "@type": "PropertyValue",
      name: "ArtiFlow-pro",
      value: poste.id,
    },
    title: poste.title,
    description: `<p>${poste.description}</p><p>Contrat : ${poste.contrat}. Lieu : ${poste.lieu}.</p>`,
    datePosted,
    validThrough,
    employmentType: poste.employmentType,
    directApply: true,
    url: `${origin}/nous-rejoindre#${poste.id}`,
    industry: "Logiciel pour le bâtiment",
    hiringOrganization: {
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: "ArtiFlow-pro",
      sameAs: profilsSociaux,
      logo: logoArtiFlowPro,
    },
    ...(poste.teletravail
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: {
            "@type": "Country",
            name: "France",
          },
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: poste.ville,
              addressCountry: "FR",
            },
          },
        }),
  }));

  const data = {
    "@context": "https://schema.org",
    "@graph": jobPostings,
  };

  useStructuredData(id, data);
}