import { Link } from "react-router-dom";
import { useSectionNav } from "@/hooks/useSectionNav";
import { useDemoModal } from "@/hooks/useDemoModal";
import { openCookieConsent } from "@/components/feature/CookieConsent";
import { reseauxSociaux } from "@/mocks/social";
import EncartBesoinAide from "@/components/feature/EncartBesoinAide";

type FooterLink = { label: string; to?: string; section?: string };

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", section: "fonctionnalites" },
      { label: "Accéder à mon espace artisan", to: "/app" },
      { label: "Tarifs", to: "/tarifs" },
      { label: "Ressources", to: "/ressources" },
      { label: "Guides par sujet", to: "/ressources/sujets" },
      { label: "FAQ", section: "faq" },
    ],
  },
  {
    title: "Métiers",
    links: [
      { label: "Plombiers chauffagistes", to: "/metiers/plombier-chauffagiste" },
      { label: "Électriciens", to: "/metiers/electricien" },
      { label: "Maçons", to: "/metiers/macon" },
      { label: "Frigoristes climaticiens", to: "/metiers/installateur-climatisation" },
      { label: "Installateurs photovoltaïques", to: "/metiers/installateur-photovoltaique" },
      { label: "Voir tous les métiers", to: "/metiers" },
      { label: "Récapitulatif des métiers", to: "/metiers/recapitulatif" },
      { label: "Zones d'intervention", to: "/zones-intervention" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "Demander une démo", section: "contact" },
      { label: "Nous contacter", to: "/contact" },
      { label: "Nous rejoindre", to: "/nous-rejoindre" },
      { label: "À propos", to: "/a-propos#equipe" },
      { label: "Podcast", to: "/podcast" },
      { label: "Nouveautés produit", to: "/nouveautes" },
      { label: "Récapitulatif des annonces", to: "/nouveautes/recapitulatif" },
      { label: "Personnalisation des documents", to: "/nouveautes/personnalisation-documents" },
      { label: "Plan du site", to: "/plan-du-site" },
      { label: "Mentions légales", to: "/mentions-legales" },
      { label: "CGV & CGU", to: "/cgv" },
      { label: "Accord de sous-traitance", to: "/accord-sous-traitance" },
      { label: "RGPD & données", to: "/rgpd" },
      { label: "Supprimer mon compte", to: "/suppression-compte" },
      { label: "Politique de cookies", to: "/cookies" },
      { label: "Accessibilité", to: "/accessibilite" },
    ],
  },
  {
    title: "Sécurité",
    links: [
      { label: "Créer un mot de passe solide", to: "/guide/mot-de-passe-solide" },
      { label: "Ma sécurité du compte", to: "/app/profil" },
    ],
  },
];

export default function Footer() {
  const goSection = useSectionNav();
  const { openDemo } = useDemoModal();

  return (
    <footer className="bg-accent-950 text-background-100">
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-16">
        <div className="flex flex-col lg:flex-row lg:justify-between gap-10">
          <div className="max-w-sm">
            <Link to="/" className="flex items-center gap-2.5 mb-4 cursor-pointer">
              <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-500 text-background-50">
                <i className="ri-tools-fill text-lg"></i>
              </span>
              <span className="font-heading font-bold text-lg text-background-50">ArtiFlow-pro</span>
            </Link>
            <p className="text-sm text-background-200/80 leading-relaxed">
              L'assistant IA des artisans du bâtiment. Devis, relances, planning et chantiers — réglés depuis le téléphone, sans paperasse.
            </p>
            <div className="flex items-center gap-3 mt-5">
              {reseauxSociaux.map((reseau) => (
                <a
                  key={reseau.icon}
                  href={reseau.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={reseau.label}
                  title={reseau.label}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-background-50/10 text-background-100 hover:bg-primary-500 hover:text-background-50 transition-colors cursor-pointer"
                >
                  <i className={reseau.icon}></i>
                </a>
              ))}
            </div>

            {/* Encart d'aide : accès direct au contact + horaires de disponibilité de l'équipe. */}
            <EncartBesoinAide variante="sombre" className="mt-6" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-10">
            {columns.map((col) => (
              <div key={col.title}>
                <h4 className="font-heading font-semibold text-sm text-background-50 mb-4">{col.title}</h4>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.to ? (
                        <Link to={link.to} className="text-sm text-background-200/80 hover:text-primary-400 transition-colors cursor-pointer">
                          {link.label}
                        </Link>
                      ) : link.label === "Demander une démo" ? (
                        <button
                          type="button"
                          onClick={() => openDemo("footer")}
                          className="text-sm text-background-200/80 hover:text-primary-400 transition-colors cursor-pointer"
                        >
                          {link.label}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => goSection(link.section as string)}
                          className="text-sm text-background-200/80 hover:text-primary-400 transition-colors cursor-pointer"
                        >
                          {link.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-background-50/15 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-background-200/70">© {new Date().getFullYear()} ArtiFlow-pro. Tous droits réservés.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <p className="text-xs text-background-200/70">Conçu en France, pour les artisans de France.</p>
            <button
              type="button"
              onClick={openCookieConsent}
              className="inline-flex items-center gap-1.5 text-xs text-background-200/80 hover:text-primary-400 transition-colors cursor-pointer"
            >
              <i className="ri-equalizer-line"></i>
              Gérer mes cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}