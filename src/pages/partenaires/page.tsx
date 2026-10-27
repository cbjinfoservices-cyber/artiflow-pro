import { Link } from "react-router-dom";
import BoutonCopier from "@/components/feature/BoutonCopier";
import LegalLayout, { LegalSection } from "@/components/feature/LegalLayout";
import { IMAGE_PARTAGE_PARTENAIRES } from "@/lib/imagesPartage";

const sections = [
  { id: "pourquoi", label: "Pourquoi s'associer" },
  { id: "profils", label: "Les partenaires que nous cherchons" },
  { id: "apport", label: "Ce que nous proposons" },
  { id: "badge", label: "Badge pour les artisans" },
  { id: "contact", label: "Devenir partenaire" },
];

const profils = [
  {
    icon: "ri-government-line",
    title: "Fédérations et chambres de métiers",
    text: "CAPEB, FFB, CMA, syndicats de métier : un outil concret à proposer à vos adhérents pour alléger l'administratif et préparer la facture électronique.",
  },
  {
    icon: "ri-calculator-line",
    title: "Experts-comptables et centres de gestion",
    text: "Des clients artisans qui transmettent des factures propres, au format Factur-X, avec les mentions obligatoires vérifiées.",
  },
  {
    icon: "ri-store-2-line",
    title: "Négoces et fournisseurs",
    text: "Grossistes en matériaux, plomberie, électricité ou solaire : un service à valeur ajoutée pour vos clients professionnels.",
  },
  {
    icon: "ri-graduation-cap-line",
    title: "Écoles et CFA du bâtiment",
    text: "Former les futurs artisans à la gestion d'entreprise sur un outil réel : devis, relances, planning et facturation.",
  },
  {
    icon: "ri-article-line",
    title: "Médias, blogs et podcasts",
    text: "Articles invités, interviews, démonstrations : nous partageons volontiers nos guides pratiques et notre expérience du terrain.",
  },
];

const apports = [
  "Des conditions dédiées pour vos adhérents, clients ou apprentis, définies ensemble selon votre réseau.",
  "Une présentation ou une démonstration d'ArtiFlow-pro lors de vos réunions, salons ou formations.",
  "Des contenus prêts à diffuser : guides pratiques, fiches métiers, articles sur la facture électronique.",
  "Une mention de votre organisation sur nos supports, avec un lien vers votre site.",
];

const SITE = "https://artiflow-pro.com";

/** Code HTML du badge, à coller sur le site d'un artisan client. */
function codeBadge(variante: "clair" | "sombre") {
  const fichier = variante === "clair" ? "badge-artiflow-pro.svg" : "badge-artiflow-pro-sombre.svg";
  return `<a href="${SITE}/" target="_blank" rel="noopener"><img src="${SITE}/badge/${fichier}" alt="Devis réalisés avec ArtiFlow-pro" width="232" height="52"></a>`;
}

const badges = [
  { variante: "clair" as const, label: "Pour un fond clair", fond: "bg-background-50" },
  { variante: "sombre" as const, label: "Pour un fond sombre", fond: "bg-foreground-950" },
];

export default function PartenairesPage() {
  return (
    <LegalLayout
      path="/partenaires"
      eyebrow="Partenariats"
      eyebrowIcon="ri-shake-hands-line"
      title="Devenir partenaire d'ArtiFlow-pro"
      intro="Fédérations, chambres de métiers, experts-comptables, fournisseurs, écoles et médias : construisons ensemble des outils plus simples pour les artisans du bâtiment."
      updatedAt="27 octobre 2026"
      metaTitle="Partenaires et réseaux d'artisans · ArtiFlow-pro"
      metaDescription="Fédérations, comptables, fournisseurs, écoles et médias : devenez partenaire d'ArtiFlow-pro, le logiciel IA des artisans du bâtiment."
      metaImage={IMAGE_PARTAGE_PARTENAIRES}
      breadcrumbLabel="Partenaires"
      breadcrumbSchemaId="artiflow-partenaires-breadcrumb-schema"
      sections={sections}
    >
      <LegalSection id="pourquoi" title="Pourquoi s'associer">
        <p>
          Les artisans du bâtiment passent beaucoup de temps sur leurs devis, leurs relances
          et leurs factures, souvent le soir après le chantier. Et la réforme de la facture électronique ajoute de
          nouvelles obligations. ArtiFlow-pro leur fait gagner ce temps : devis dictés depuis le chantier,
          relances automatiques, planning d'équipe et factures au format Factur-X.
        </p>
        <p>
          Les organisations qui accompagnent les artisans au quotidien sont les mieux placées pour leur faire
          connaître ces outils. C'est pourquoi nous cherchons à travailler avec elles.
        </p>
      </LegalSection>

      <LegalSection id="profils" title="Les partenaires que nous cherchons">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {profils.map((p) => (
            <div key={p.title} className="p-4 rounded-lg bg-background-100 border border-background-200">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                  <i className={p.icon}></i>
                </span>
                <h3 className="font-heading font-semibold text-sm text-foreground-950">{p.title}</h3>
              </div>
              <p className="mt-2 text-sm text-foreground-600 leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection id="apport" title="Ce que nous proposons">
        <ul className="flex flex-col gap-2.5">
          {apports.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <i className="ri-arrow-right-circle-line text-secondary-600 mt-0.5"></i>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p>
          Textes de présentation et logos sont disponibles dans notre{" "}
          <Link to="/presse" className="text-primary-700 underline">kit média</Link>.
        </p>
      </LegalSection>

      <LegalSection id="badge" title="Badge « Devis réalisés avec ArtiFlow-pro »">
        <p>
          Vous êtes artisan et utilisez ArtiFlow-pro ? Affichez le badge sur votre site : il montre à vos clients
          que vos devis sont détaillés et suivis avec sérieux. Copiez le code ci-dessous et collez-le dans votre
          page, par exemple en bas de la page d'accueil ou de la page contact.
        </p>
        <div className="flex flex-col gap-4">
          {badges.map((b) => (
            <div key={b.variante} className="rounded-lg border border-background-200 overflow-hidden">
              <div className={`${b.fond} flex items-center justify-center p-5`}>
                <img
                  src={`/badge/badge-artiflow-pro${b.variante === "sombre" ? "-sombre" : ""}.svg`}
                  alt="Devis réalisés avec ArtiFlow-pro"
                  width={232}
                  height={52}
                  loading="lazy"
                />
              </div>
              <div className="p-3 bg-background-100">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground-950">{b.label}</p>
                  <BoutonCopier texte={codeBadge(b.variante)} />
                </div>
                <pre className="mt-2 p-3 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-700 whitespace-pre-wrap break-all">
                  {codeBadge(b.variante)}
                </pre>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-foreground-600">
          Votre site est sur Wix, WordPress ou Jimdo ? Ajoutez un bloc « HTML » ou « Code intégré » et collez-y le
          code. Besoin d'aide ? Écrivez-nous, nous vous guidons.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Devenir partenaire">
        <p>
          Présentez-nous votre organisation et votre réseau : nous revenons vers vous rapidement pour en discuter.
          Écrivez à{" "}
          <a href="mailto:contact@artiflow-pro.com" className="text-primary-700 underline">
            contact@artiflow-pro.com
          </a>{" "}
          ou passez par la page <Link to="/contact" className="text-primary-700 underline">Contact</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
