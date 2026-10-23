import { Link } from "react-router-dom";
import { espaces } from "@/mocks/landing";
import { metiers } from "@/mocks/metiers";
import ApercuEmailHome from "./ApercuEmailHome";

const toneStyles: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

// Mise en avant de la personnalisation des documents, reprise de la page Tarifs
// pour rester cohérent sur tout le site.
const personnalisation: { icon: string; label: string }[] = [
  { icon: "ri-palette-line", label: "Couleur d'accent au choix" },
  { icon: "ri-image-line", label: "Votre logo sur les documents" },
  { icon: "ri-mail-send-line", label: "Identité reprise dans vos emails" },
  { icon: "ri-quill-pen-line", label: "Jusqu'à la signature du client" },
];

export default function Features() {
  return (
    <section id="fonctionnalites" className="w-full bg-background-50">
      <div className="w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
            <i className="ri-apps-2-line"></i>
            Vos espaces
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
            Sept espaces, une seule app
          </h2>
          <p className="mt-4 text-foreground-600 text-base leading-relaxed">
            ArtiFlow-pro est rangé comme votre métier : chaque espace regroupe ce qui va ensemble, sans vous perdre.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {espaces.map((espace) => (
            <article
              key={espace.title}
              className="p-5 rounded-lg bg-background-100 border border-background-200 hover:bg-background-50 hover:border-primary-300 transition-colors"
            >
              <span className={`w-11 h-11 flex items-center justify-center rounded-lg text-xl mb-4 ${toneStyles[espace.tone]}`}>
                <i className={espace.icon}></i>
              </span>
              <h3 className="font-heading font-semibold text-base text-foreground-950">{espace.title}</h3>
              <p className="mt-2 text-sm text-foreground-600 leading-relaxed">{espace.description}</p>
            </article>
          ))}
        </div>

        {/* Mise en avant de la personnalisation (cohérente avec la page Tarifs) avec
            un aperçu visuel de l'email client, avant même d'aller sur les tarifs. */}
        <div className="mt-6 p-6 md:p-8 rounded-lg bg-background-100 border border-background-200">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-10 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold uppercase tracking-wide">
                <i className="ri-palette-line"></i>
                À votre image
              </span>
              <h3 className="mt-3 font-heading font-bold text-xl md:text-2xl text-foreground-950 tracking-tight">
                Des documents à votre image
              </h3>
              <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
                Couleur d'accent, logo, coordonnées de paiement et pied de page : on règle l'habillage une fois dans
                votre profil, et il suit du devis à la signature du client.
              </p>

              <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {personnalisation.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-start gap-3 p-3.5 rounded-lg bg-background-50 border border-background-200"
                  >
                    <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-base bg-accent-100 text-accent-700">
                      <i className={item.icon}></i>
                    </span>
                    <span className="text-sm font-medium text-foreground-800 leading-snug">{item.label}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/tarifs#documents"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  Voir la personnalisation
                  <i className="ri-arrow-right-line"></i>
                </Link>
                <Link
                  to="/nouveautes/personnalisation-documents"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors"
                >
                  <i className="ri-megaphone-line"></i>
                  Lire l'annonce
                </Link>
              </div>
            </div>

            <div>
              <ApercuEmailHome />
              <p className="mt-3 flex items-center justify-center gap-2 text-xs text-foreground-500">
                <i className="ri-mail-send-line text-accent-600"></i>
                Aperçu de l'email reçu par votre client — devis, facture ou relance
              </p>
            </div>
          </div>

          {/* Lien contextuel : la personnalisation s'adapte à chaque corps d'état. */}
          <div className="mt-6 pt-5 border-t border-background-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="max-w-xl">
                <h4 className="font-heading font-semibold text-base text-foreground-950">
                  La personnalisation s'adapte à votre métier
                </h4>
                <p className="mt-1.5 text-sm text-foreground-600 leading-relaxed">
                  Chaque corps d'état garde ses postes, ses unités et sa mise en page — avec vos couleurs sur
                  chaque document. Choisissez le vôtre pour voir un exemple concret.
                </p>
              </div>
              <Link
                to="/metiers"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-700 transition-colors shrink-0"
              >
                <i className="ri-tools-line"></i>
                Voir tous les métiers
              </Link>
            </div>
            <ul className="mt-4 flex flex-wrap gap-2">
              {metiers.map((m) => (
                <li key={m.slug}>
                  <Link
                    to={`/metiers/${m.slug}`}
                    className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full bg-background-50 border border-background-200 text-sm text-foreground-700 whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors"
                  >
                    <i className="ri-hammer-line text-accent-600"></i>
                    {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}