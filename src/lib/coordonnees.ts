import { getSiteOrigin } from "@/lib/site";
import { logoArtiFlowPro } from "@/mocks/social";

/**
 * Coordonnées postales et horaires réels de l'entreprise.
 *
 * IMPORTANT — à compléter par l'équipe :
 * Dès que l'adresse réelle et les horaires sont connus, renseignez les champs
 * ci-dessous. La page Contact affichera alors automatiquement un bloc « Nos
 * coordonnées » et un balisage Schema.org LocalBusiness cohérent (l'affichage
 * et le balisage n'apparaissent QUE si l'adresse est renseignée, pour ne jamais
 * inventer de fausses coordonnées auprès de Google).
 *
 * Exemple d'adresse :
 *   adresseRue: "12 rue de l'Artisanat",
 *   codePostal: "75011",
 *   ville: "Paris",
 *   region: "Île-de-France",
 *
 * Exemple d'horaires (jours au format Schema.org) :
 *   horaires: [{ jours: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], ouvre: "09:00", ferme: "18:00" }]
 */
export type HoraireOuverture = {
  /** Jours au format Schema.org (Monday, Tuesday, …). */
  jours: string[];
  /** Heure d'ouverture au format HH:MM. */
  ouvre: string;
  /** Heure de fermeture au format HH:MM. */
  ferme: string;
};

export type CoordonneesEntreprise = {
  adresseRue: string;
  codePostal: string;
  ville: string;
  region: string;
  pays: string;
  telephone: string;
  email: string;
  /** Coordonnées GPS (facultatives, affichées seulement si renseignées). */
  latitude?: number;
  longitude?: number;
  horaires: HoraireOuverture[];
};

export const coordonneesEntreprise: CoordonneesEntreprise = {
  adresseRue: "",
  codePostal: "",
  ville: "",
  region: "",
  pays: "France",
  telephone: "+33788946191",
  email: "contact@artiflow-pro.fr",
  horaires: [],
};

/** Vrai si une adresse postale exploitable est renseignée. */
export function aAdressePostale(): boolean {
  const c = coordonneesEntreprise;
  return Boolean(c.adresseRue.trim() && c.codePostal.trim() && c.ville.trim());
}

/** Vrai si au moins un créneau d'ouverture est renseigné. */
export function aHoraires(): boolean {
  return coordonneesEntreprise.horaires.length > 0;
}

/**
 * Vrai si un balisage LocalBusiness peut être affiché sans inventer de données.
 * On exige au minimum l'adresse postale.
 */
export function localBusinessDisponible(): boolean {
  return aAdressePostale();
}

const JOURS_FR: Record<string, string> = {
  Monday: "lun.",
  Tuesday: "mar.",
  Wednesday: "mer.",
  Thursday: "jeu.",
  Friday: "ven.",
  Saturday: "sam.",
  Sunday: "dim.",
};

/** Libellé lisible d'un créneau d'ouverture (ex. « lun. – ven. : 9 h – 18 h »). */
export function formatHoraire(horaire: HoraireOuverture): string {
  const jours = horaire.jours.map((j) => JOURS_FR[j] ?? j);
  const plage = jours.length > 1 ? `${jours[0]} – ${jours[jours.length - 1]}` : jours[0] ?? "";
  return `${plage} : ${horaire.ouvre.replace(":", " h ")} – ${horaire.ferme.replace(":", " h ")}`;
}

/** Adresse postale sur une seule ligne (vide si incomplète). */
export function adresseSurUneLigne(): string {
  const c = coordonneesEntreprise;
  if (!aAdressePostale()) return "";
  return `${c.adresseRue}, ${c.codePostal} ${c.ville}`;
}

/** Construit le bloc Schema.org LocalBusiness (ou null si l'adresse manque). */
export function construireLocalBusiness(): Record<string, unknown> | null {
  if (!localBusinessDisponible()) return null;
  const c = coordonneesEntreprise;
  const origin = getSiteOrigin();

  const address: Record<string, unknown> = {
    "@type": "PostalAddress",
    streetAddress: c.adresseRue,
    postalCode: c.codePostal,
    addressLocality: c.ville,
    addressCountry: "FR",
  };
  if (c.region.trim()) address.addressRegion = c.region;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${origin}/#localbusiness`,
    name: "ArtiFlow-pro",
    url: `${origin}/`,
    image: logoArtiFlowPro,
    telephone: c.telephone,
    email: c.email,
    address,
    areaServed: { "@type": "Country", name: "France" },
    parentOrganization: { "@type": "Organization", "@id": `${origin}/#organization` },
  };

  if (typeof c.latitude === "number" && typeof c.longitude === "number") {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: c.latitude,
      longitude: c.longitude,
    };
  }

  if (aHoraires()) {
    data.openingHoursSpecification = c.horaires.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.jours,
      opens: h.ouvre,
      closes: h.ferme,
    }));
  }

  return data;
}