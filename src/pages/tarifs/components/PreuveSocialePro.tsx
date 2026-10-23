import { proTestimonials, proStats } from "@/mocks/tarifs";

export default function PreuveSocialePro() {
  return (
    <section id="preuve-pro" className="w-full bg-background-50">
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
            <i className="ri-award-line"></i>
            Ils ont choisi l'offre Pro
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
            Des artisans qui ont arrêté de relancer à la main
          </h2>
          <p className="mt-4 text-base text-foreground-600 leading-relaxed">
            L'offre Pro automatise les relances, regroupe les chantiers par zone et fait signer les devis en ligne. Voilà ce que ça change au quotidien.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          {proTestimonials.map((t) => (
            <article
              key={t.name}
              className="flex flex-col p-6 rounded-lg border border-background-200 bg-background-100"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5 text-accent-500">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <i key={i} className="ri-star-fill text-sm"></i>
                  ))}
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
                  <i className="ri-award-fill"></i>
                  Pro
                </span>
              </div>

              <p className="mt-4 text-sm text-foreground-700 leading-relaxed flex-1">« {t.quote} »</p>

              <div className="mt-5 pt-5 border-t border-background-200 flex items-center gap-3">
                <div className="w-11 h-11 shrink-0 rounded-full overflow-hidden bg-background-200">
                  <img
                    src={t.avatar}
                    alt={`${t.name}, ${t.role} - avis client sur ArtiFlow-pro`}
                    title={`${t.name} · artisan abonné à ArtiFlow-pro Pro`}
                    width={128}
                    height={128}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground-950 truncate">{t.name}</p>
                  <p className="text-xs text-foreground-500 truncate">{t.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {proStats.map((stat) => (
            <div
              key={stat.label}
              className="p-5 rounded-lg border border-background-200 bg-background-100 text-center"
            >
              <p className="font-heading font-extrabold text-2xl md:text-3xl text-foreground-950">{stat.value}</p>
              <p className="mt-1 text-xs md:text-sm text-foreground-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}