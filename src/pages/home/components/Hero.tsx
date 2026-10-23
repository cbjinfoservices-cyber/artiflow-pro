import { Link } from "react-router-dom";
import { heroStats } from "@/mocks/landing";

/** Petites puces du bandeau de réassurance, sous les boutons. */
const reassurance = ["14 jours d'essai", "Sans engagement", "Résiliable en un clic"];

export default function Hero() {
  return (
    <section
      id="top"
      className="relative w-full min-h-[560px] lg:h-[min(100vh,720px)] flex items-center overflow-hidden bg-foreground-950"
    >
      <picture>
        <source
          media="(max-width: 767px)"
          srcSet="https://readdy.ai/api/search-image?query=Stylized%20artistic%20construction%20worksite%20scene%20with%20scaffolding%2C%20brick%20masonry%20wall%2C%20plumbing%20pipes%2C%20electrical%20wiring%20and%20painting%20tools%2C%20crane%20and%20timber%20frames%2C%20warm%20orange%20and%20deep%20teal%20green%20accents%2C%20cinematic%20moody%20lighting%2C%20completely%20blank%20unmarked%20surfaces%2C%20no%20signage%2C%20no%20lettering%2C%20no%20words%2C%20no%20text%2C%20clean%20plain%20walls%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=800&height=1000&seq=artiflow-hero-mobile&orientation=portrait"
        />
        <img
          src="https://readdy.ai/api/search-image?query=Stylized%20artistic%20construction%20worksite%20scene%20with%20scaffolding%2C%20brick%20masonry%20wall%2C%20plumbing%20pipes%2C%20electrical%20wiring%20and%20painting%20tools%2C%20crane%20and%20timber%20frames%2C%20warm%20orange%20and%20deep%20teal%20green%20accents%20on%20a%20deep%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20completely%20blank%20unmarked%20surfaces%2C%20no%20signage%2C%20no%20lettering%2C%20no%20words%2C%20no%20text%2C%20no%20poster%2C%20clean%20plain%20walls%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1920&height=1080&seq=artiflow-hero-clean-2&orientation=landscape"
          alt="Chantier de bâtiment tout corps d'état stylisé : échafaudages, maçonnerie, plomberie et électricité — ArtiFlow-pro, assistant IA pour artisans"
          title="ArtiFlow-pro, assistant IA pour artisans du bâtiment"
          width={1920}
          height={1080}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
      </picture>
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/70 to-black/35"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30"></div>

      <div className="relative z-10 w-full px-4 md:px-8 lg:px-12 pt-28 pb-16 md:pt-24 md:pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
          <div className="text-center lg:text-left animate-fade-up">
            <Link
              to="/nouveautes"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-background-50/10 border border-background-50/25 backdrop-blur text-background-50 text-xs md:text-sm font-medium whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
            >
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-500 text-background-50 text-[10px] font-bold uppercase tracking-wide">
                Nouveau
              </span>
              Renvois programmés & vérification d'adresse
              <i className="ri-arrow-right-line"></i>
            </Link>

            <h1 className="mt-5 font-heading font-extrabold text-background-50 text-4xl md:text-5xl lg:text-[3.6rem] leading-[1.06] tracking-tight">
              Vos devis, vos relances
              <br className="hidden md:block" /> et votre planning.
              <span className="block text-primary-400 mt-1.5">En pilote automatique.</span>
            </h1>

            <p className="mt-5 text-background-100/90 text-base md:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
              Vous dictez le chantier, l'IA rédige le devis, relance le client et range votre semaine — et si un
              email n'arrive pas, vous savez pourquoi.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3">
              <Link
                to="/app/auth?mode=inscription"
                className="inline-flex items-center justify-center gap-2 h-14 px-7 rounded-md bg-primary-500 text-background-50 text-base md:text-lg font-bold whitespace-nowrap cursor-pointer ring-2 ring-primary-400/40 hover:bg-primary-600 hover:ring-primary-300/60 transition-colors"
              >
                <i className="ri-rocket-2-line text-xl"></i>
                Essai gratuit 14 jours
              </Link>
              <a
                href="#contact"
                className="inline-flex items-center justify-center gap-2 h-12 md:h-14 px-6 rounded-md bg-background-50/10 border border-background-50/35 text-background-50 font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors backdrop-blur"
              >
                <i className="ri-calendar-check-line text-lg"></i>
                Demander une démo
              </a>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-1.5">
              {reassurance.map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 text-xs md:text-sm text-background-100/85 whitespace-nowrap">
                  <i className="ri-checkbox-circle-fill text-primary-400"></i>
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-3 max-w-xl mx-auto lg:mx-0">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="text-center lg:text-left px-3 py-2.5 rounded-lg bg-background-50/5 border border-background-50/15 backdrop-blur"
                >
                  <p className="font-heading font-bold text-xl md:text-2xl text-primary-400">{stat.value}</p>
                  <p className="mt-0.5 text-[11px] md:text-xs text-background-100/80 leading-snug">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Aperçu décoratif : la fiche client et le suivi des emails refusés. */}
          <div className="relative hidden lg:block max-w-md w-full mx-auto lg:mx-0 lg:ml-auto pointer-events-none" aria-hidden="true">
            <div className="rounded-xl border border-background-50/15 bg-background-50/95 p-4 md:p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 font-heading font-bold text-sm">
                  SD
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground-950 truncate">Mme Sophie Dupont</p>
                  <p className="text-[11px] text-foreground-500 truncate">Rénovation salle de bain · 4 380 €</p>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap">
                  <i className="ri-mail-line"></i>
                  Suivi email
                </span>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-foreground-600">
                <i className="ri-checkbox-circle-fill text-accent-600"></i>
                14 emails partis avec succès
              </div>

              <div className="mt-3 rounded-lg border border-primary-200 bg-primary-50 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-800">
                  <i className="ri-error-warning-line"></i>
                  Dernier email refusé
                </p>
                <p className="mt-1 text-[11px] text-foreground-700">
                  21 oct. 2026 à 09:14 · boîte du destinataire pleine
                </p>
                <p className="mt-1.5 text-[11px] text-foreground-600 break-all">
                  Adresse tentée : s.dupont@orange.fr
                </p>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap">
                  <i className="ri-shield-check-line"></i>
                  Vérifier et renvoyer
                </span>
                <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-background-300 bg-background-50 text-foreground-800 text-[11px] font-semibold whitespace-nowrap">
                  <i className="ri-timer-line"></i>
                  Renvoyer dans 24 h
                </span>
              </div>

              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-accent-700">
                <i className="ri-check-double-line"></i>
                Adresse valide : format et domaine corrects
              </p>
            </div>

            <div className="mt-3 md:absolute md:-left-6 md:-bottom-8 md:mt-0 w-full md:w-64 rounded-lg border border-background-50/20 bg-foreground-950/90 p-3 backdrop-blur">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-background-50">
                <i className="ri-time-line text-primary-400"></i>
                Renvois prévus
                <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-500 text-background-50">1</span>
              </p>
              <p className="mt-1.5 text-[11px] text-background-200/85">s.dupont@orange.fr</p>
              <p className="mt-0.5 text-[11px] font-semibold text-primary-400">dans 23 h 41 min · tout annuler</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}