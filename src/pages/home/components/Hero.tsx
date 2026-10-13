import { Link } from "react-router-dom";
import { heroStats } from "@/mocks/landing";

export default function Hero() {
  return (
    <section id="top" className="relative w-full min-h-[640px] md:min-h-[760px] flex items-center overflow-hidden">
      <img
        src="https://readdy.ai/api/search-image?query=Stylized%20artistic%20construction%20worksite%20scene%20with%20scaffolding%2C%20brick%20masonry%20wall%2C%20plumbing%20pipes%2C%20electrical%20wiring%20and%20painting%20tools%2C%20crane%20and%20timber%20frames%2C%20warm%20orange%20and%20deep%20teal%20green%20accents%20on%20a%20deep%20dark%20charcoal%20background%2C%20cinematic%20moody%20lighting%2C%20completely%20blank%20unmarked%20surfaces%2C%20no%20signage%2C%20no%20lettering%2C%20no%20words%2C%20no%20text%2C%20no%20poster%2C%20clean%20plain%20walls%2C%20editorial%20minimal%20composition%2C%20high%20detail&width=1920&height=1080&seq=artiflow-hero-clean-2&orientation=landscape"
        alt="Chantier tout corps d'état stylisé"
        title="ArtiFlow-pro, assistant IA pour artisans du bâtiment"
        className="absolute inset-0 w-full h-full object-cover object-top"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/60"></div>

      <div className="relative z-10 w-full px-4 md:px-8 lg:px-12 pt-28 pb-20">
        <div className="max-w-3xl mx-auto text-center animate-fade-up">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-background-50/10 border border-background-50/25 backdrop-blur text-background-50 text-xs md:text-sm font-medium">
            <i className="ri-sparkling-2-line text-primary-400"></i>
            SaaS IA pour artisans du bâtiment
          </span>

          <h1 className="mt-6 font-heading font-extrabold text-background-50 text-4xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight">
            Vos devis, vos relances
            <br />
            et votre planning.
            <span className="block text-primary-400 mt-2">En pilote automatique.</span>
          </h1>

          <p className="mt-6 text-background-100/90 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            ArtiFlow-pro transforme votre téléphone en assistant : vous dictez le chantier, l'IA rédige le devis,
            relance le client et range votre semaine. Moins de paperasse, plus de chantiers.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
            <a
              href="#contact"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-md bg-primary-500 text-background-50 font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-calendar-check-line text-lg"></i>
              Demander une démo
            </a>
            <Link
              to="/app"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-md bg-background-50 text-foreground-950 font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
            >
              <i className="ri-login-box-line text-lg"></i>
              Accéder à mon espace artisan
            </Link>
            <a
              href="#apercu"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-md bg-background-50/10 border border-background-50/30 text-background-50 font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors backdrop-blur"
            >
              <i className="ri-window-line text-lg"></i>
              Voir l'aperçu
            </a>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          {heroStats.map((stat) => (
            <div key={stat.label} className="text-center px-3 py-4 rounded-lg bg-background-50/5 border border-background-50/15 backdrop-blur">
              <p className="font-heading font-bold text-2xl md:text-3xl text-primary-400">{stat.value}</p>
              <p className="mt-1 text-xs md:text-sm text-background-100/80">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}