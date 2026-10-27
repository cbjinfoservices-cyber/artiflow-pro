import { Link } from "react-router-dom";

/** Petites puces du bandeau de réassurance, sous les boutons. */
const reassurance = ["14 jours d'essai", "Sans engagement", "Résiliable en un clic"];

/** Ce que l'application fait, en une ligne chacun : des capacités réelles, pas des statistiques. */
const atouts = [
  { icon: "ri-mic-line", label: "Devis dicté sur le chantier" },
  { icon: "ri-repeat-line", label: "Relances email, SMS, WhatsApp" },
  { icon: "ri-team-line", label: "Équipe pilotée sur mobile" },
  { icon: "ri-file-shield-2-line", label: "Facture électronique prête" },
];

/** Lignes du devis d'exemple affiché dans le visuel. */
const lignesExemple = [
  { designation: "Dépose ancien chauffe-eau", detail: "1 forfait", montant: "120,00 €" },
  { designation: "Chauffe-eau électrique 200 L", detail: "1 u", montant: "640,00 €" },
  { designation: "Raccordements et mise en service", detail: "3 h", montant: "165,00 €" },
];

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
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/80 to-black/40"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30"></div>

      <div className="relative z-10 w-full px-4 md:px-8 lg:px-12 pt-28 pb-16 md:pt-24 md:pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center">
          <div className="text-center lg:text-left animate-fade-up">
            <a
              href="#fonctionnalites"
              className="inline-flex max-w-full items-center gap-2 px-3.5 py-1.5 rounded-full bg-background-50/10 border border-background-50/25 backdrop-blur text-background-50 text-xs md:text-sm font-medium whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors"
            >
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-500 text-background-50 text-[10px] font-bold uppercase tracking-wide">
                Nouveau
              </span>
              {/* Libellé raccourci sur téléphone pour tenir sur une ligne. */}
              <span className="sm:hidden">Équipe mobile & e-facture</span>
              <span className="hidden sm:inline">Votre équipe sur mobile & facture électronique</span>
              <i className="ri-arrow-down-line"></i>
            </a>

            <h1 className="mt-5 font-heading font-extrabold text-background-50 text-4xl md:text-5xl lg:text-[3.6rem] leading-[1.06] tracking-tight">
              Moins de paperasse.
              <span className="block text-primary-400 mt-1.5">Plus de chantiers.</span>
            </h1>

            <p className="mt-5 text-background-100/90 text-base md:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
              Vous dictez le devis sur place, le client signe sur son téléphone, les relances partent toutes seules
              et votre équipe sait où aller. ArtiFlow-pro tient le bureau, vous gardez la main sur le métier.
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
                href="#journee"
                className="inline-flex items-center justify-center gap-2 h-12 md:h-14 px-6 rounded-md bg-background-50/10 border border-background-50/35 text-background-50 font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50/20 transition-colors backdrop-blur"
              >
                <i className="ri-play-circle-line text-lg"></i>
                Voir une journée type
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

            <ul className="mt-6 grid grid-cols-2 gap-2.5 md:gap-3 max-w-xl mx-auto lg:mx-0">
              {atouts.map((a) => (
                <li
                  key={a.label}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-background-50/5 border border-background-50/15 backdrop-blur text-left"
                >
                  <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-primary-500/20 text-primary-300">
                    <i className={a.icon}></i>
                  </span>
                  <span className="text-xs md:text-sm font-medium text-background-100 leading-snug">{a.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Visuel : un devis dicté, rédigé par l'IA, puis signé. Décoratif, masqué sur mobile. */}
          <div className="relative hidden lg:block max-w-md w-full mx-auto lg:ml-auto pointer-events-none" aria-hidden="true">
            <div className="rounded-xl bg-background-50/95 p-5 shadow-2xl backdrop-blur animate-fade-up [animation-delay:150ms]">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-primary-500 text-background-50">
                  <i className="ri-mic-fill"></i>
                </span>
                <div className="rounded-lg rounded-tl-none bg-background-100 px-3 py-2">
                  <p className="text-[11px] font-semibold text-foreground-500">Dicté sur le chantier · 10:12</p>
                  <p className="mt-0.5 text-[13px] text-foreground-900 leading-snug">
                    « Remplacement chauffe-eau 200 litres chez Mme Dupont, dépose de l'ancien, trois heures de pose. »
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-accent-700">
                <i className="ri-sparkling-2-fill"></i>
                Devis rédigé avec vos tarifs
              </div>
              <div className="mt-2 rounded-lg border border-background-200 divide-y divide-background-200">
                {lignesExemple.map((l) => (
                  <div key={l.designation} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-foreground-900 truncate">{l.designation}</p>
                      <p className="text-[10px] text-foreground-500">{l.detail}</p>
                    </div>
                    <span className="text-[12px] font-semibold text-foreground-900 tabular-nums">{l.montant}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 bg-background-100">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-foreground-600">Total TTC</span>
                  <span className="text-sm font-bold text-foreground-950 tabular-nums">1 017,50 €</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-500">
                  <i className="ri-send-plane-line"></i>
                  Envoyé à 10:14
                </span>
                <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold">
                  <i className="ri-quill-pen-line"></i>
                  Signé en ligne à 12:47
                </span>
              </div>
            </div>

            <div className="absolute -left-8 -bottom-16 w-60 rounded-lg border border-background-50/20 bg-foreground-950/90 p-3 backdrop-blur animate-float">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-background-50">
                <i className="ri-notification-3-line text-primary-400"></i>
                Pendant ce temps…
              </p>
              <p className="mt-1.5 text-[11px] text-background-200/85 leading-snug">
                3 relances parties toutes seules, 1 facture réglée.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
