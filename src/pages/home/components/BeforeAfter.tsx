import { useState } from "react";
import { avantApres } from "@/mocks/landing";
import { useDemoModal } from "@/hooks/useDemoModal";

type Mode = "avant" | "apres";

export default function BeforeAfter() {
  const [mode, setMode] = useState<Mode>("avant");
  const { openDemo } = useDemoModal();

  return (
    <section id="avant-apres" className="relative w-full bg-background-50 overflow-hidden">
      {/* Couple de photos de terrain « avant / après » : un chantier tout corps d'état en cours
          et le même type de logement une fois les travaux terminés, pour ancrer la section dans le métier. */}
      <figure className="hidden xl:block absolute right-6 top-20 w-[340px]">
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <img
              src="https://readdy.ai/api/search-image?query=Real%20documentary%20photograph%20of%20a%20residential%20construction%20site%20with%20several%20trades%20at%20work%2C%20bricklayer%20laying%20blocks%2C%20electrician%20running%20cables%20through%20conduits%2C%20plumber%20fitting%20pipes%2C%20scaffolding%20and%20professional%20tools%20on%20site%2C%20warm%20golden%20hour%20natural%20light%2C%20authentic%20realistic%20editorial%20photography%2C%20high%20detail&width=600&height=440&seq=artiflow-chantier-terrain&orientation=landscape"
              alt="Chantier du bâtiment tout corps d'état en cours de travaux"
              title="Chantier tout corps d'état en cours de travaux suivi avec ArtiFlow-pro"
              className="w-full h-[150px] object-cover object-center rounded-lg border border-background-200"
            />
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground-950/70 text-background-50 text-[10px] font-semibold">
              Avant
            </span>
          </div>
          <div className="relative">
            <img
              src="https://readdy.ai/api/search-image?query=Real%20documentary%20photograph%20of%20a%20fully%20finished%20renovated%20house%20interior%2C%20freshly%20painted%20white%20walls%2C%20polished%20wooden%20floor%2C%20neat%20tiling%20and%20installed%20fixtures%2C%20clean%20bright%20modern%20living%20space%20after%20construction%20completion%2C%20warm%20natural%20daylight%2C%20impeccable%20craftsmanship%2C%20realistic%20editorial%20photography%2C%20high%20detail&width=600&height=440&seq=artiflow-chantier-termine&orientation=landscape"
              alt="Logement rénové tout corps d'état une fois le chantier terminé"
              title="Chantier tout corps d'état terminé et livré, suivi avec ArtiFlow-pro"
              className="w-full h-[150px] object-cover object-center rounded-lg border border-background-200"
            />
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-500 text-background-50 text-[10px] font-semibold">
              Après
            </span>
          </div>
        </div>
        <figcaption className="mt-2 text-[11px] leading-snug text-foreground-500 text-center">
          Chantier tout corps d'état : du gros œuvre à la finition livrée.
        </figcaption>
      </figure>
      <div className="relative w-full px-4 md:px-8 lg:px-12 py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
            <i className="ri-arrow-left-right-line"></i>
            Avant / Après
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
            Ce que change vraiment ArtiFlow-pro
          </h2>
          <p className="mt-4 text-base text-foreground-600 leading-relaxed">
            Vous êtes artisan, pas secrétaire. Même semaine de chantier : voyez ce qui change concrètement.
          </p>

          <div className="mt-7 inline-flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200">
            <button
              type="button"
              onClick={() => setMode("avant")}
              className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                mode === "avant" ? "bg-foreground-950 text-background-50" : "text-foreground-600 hover:text-foreground-900"
              }`}
            >
              Avant ArtiFlow-pro
            </button>
            <button
              type="button"
              onClick={() => setMode("apres")}
              className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                mode === "apres" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:text-foreground-900"
              }`}
            >
              Avec ArtiFlow-pro
            </button>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch max-w-6xl mx-auto">
          {(["avant", "apres"] as Mode[]).map((key) => {
            const data = avantApres[key];
            const active = mode === key;
            const isApres = key === "apres";

            return (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                aria-pressed={active}
                className={`text-left rounded-lg border p-6 md:p-8 transition-all duration-500 ${
                  isApres
                    ? "bg-foreground-950 border-foreground-950 text-background-50"
                    : "bg-background-100 border-background-200"
                } ${active ? "opacity-100 ring-2 ring-primary-400" : "opacity-55"}`}
              >
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    isApres ? "bg-background-50/15 text-background-50" : "bg-secondary-100 text-secondary-800"
                  }`}
                >
                  <i className={isApres ? "ri-sparkling-2-line" : "ri-emotion-unhappy-line"}></i>
                  {data.label}
                </span>

                <h3
                  className={`mt-4 font-heading font-bold text-xl md:text-2xl tracking-tight ${
                    isApres ? "text-background-50" : "text-foreground-950"
                  }`}
                >
                  {data.headline}
                </h3>
                <p className={`mt-3 text-sm leading-relaxed ${isApres ? "text-background-200/80" : "text-foreground-600"}`}>
                  {data.intro}
                </p>

                <ul className="mt-6 flex flex-col gap-4">
                  {data.points.map((point) => (
                    <li key={point.title} className="flex items-start gap-3">
                      <span
                        className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-lg ${
                          isApres ? "bg-background-50/10 text-primary-400" : "bg-secondary-100 text-secondary-700"
                        }`}
                      >
                        <i className={point.icon}></i>
                      </span>
                      <div>
                        <p className={`text-sm font-semibold ${isApres ? "text-background-50" : "text-foreground-950"}`}>
                          {point.title}
                        </p>
                        <p className={`mt-0.5 text-xs leading-relaxed ${isApres ? "text-background-200/75" : "text-foreground-500"}`}>
                          {point.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className={`mt-7 pt-6 border-t flex flex-col gap-4 ${isApres ? "border-background-50/15" : "border-background-200"}`}>
                  {data.metrics.map((metric) => (
                    <div key={metric.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs ${isApres ? "text-background-200/80" : "text-foreground-500"}`}>
                          {metric.label}
                        </span>
                        <span className={`text-sm font-bold font-heading ${isApres ? "text-primary-400" : "text-foreground-900"}`}>
                          {metric.value}
                        </span>
                      </div>
                      <div className={`h-1.5 rounded-full overflow-hidden ${isApres ? "bg-background-50/15" : "bg-background-200"}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${
                            isApres ? "bg-primary-500" : "bg-secondary-500"
                          }`}
                          style={{ width: `${active ? metric.ratio : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => openDemo("avant-apres")}
            className="inline-flex items-center gap-2 h-12 px-7 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-arrow-right-circle-line text-lg"></i>
            Passer moi aussi à l'après
          </button>
          <p className="mt-3 text-xs text-foreground-500">
            En moyenne, les artisans ArtiFlow-pro envoient leurs devis jusqu'à 6× plus vite.
          </p>
        </div>
      </div>
    </section>
  );
}