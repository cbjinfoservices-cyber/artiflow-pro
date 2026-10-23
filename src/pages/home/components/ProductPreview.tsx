import { useState } from "react";
import { Link } from "react-router-dom";
import { previewTabs } from "@/mocks/dashboard";
import DashboardView from "./preview/DashboardView";
import DevisView from "./preview/DevisView";
import PlanningView from "./preview/PlanningView";
import RelancesView from "./preview/RelancesView";
import ChantiersView from "./preview/ChantiersView";

const sideIcons = [
  "ri-dashboard-line",
  "ri-file-text-line",
  "ri-calendar-2-line",
  "ri-notification-3-line",
  "ri-building-2-line",
  "ri-contacts-book-2-line",
  "ri-settings-3-line",
];

export default function ProductPreview() {
  const [active, setActive] = useState("dashboard");

  return (
    <section id="apercu" className="relative w-full bg-background-100 border-y border-background-200 overflow-hidden">
      {/* Texture de fond discrète : schéma de chantier tout corps d'état, très légère pour ne pas gêner la lecture */}
      <img
        src="https://readdy.ai/api/search-image?query=Subtle%20stylized%20construction%20blueprint%20texture%20with%20thin%20charcoal%20and%20warm%20orange%20line%20drawings%20of%20building%20floor%20plans%2C%20scaffolding%20frames%20and%20technical%20annotations%20on%20a%20light%20off-white%20paper%20background%2C%20minimal%20airy%20technical%20illustration%2C%20soft%20even%20lighting%2C%20high%20detail&width=1280&height=720&seq=artiflow-apercu-bg&orientation=landscape"
        alt="Schéma technique de chantier tout corps d'état en arrière-plan de l'aperçu de l'application ArtiFlow-pro"
        title="Aperçu de l'application ArtiFlow-pro"
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover object-center opacity-[0.14]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background-100 via-background-100/85 to-background-100"></div>
      <div className="relative w-full px-4 md:px-8 lg:px-12 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
            <i className="ri-window-line"></i>
            L'application
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-foreground-950 tracking-tight">
            Un coup d'œil dans ArtiFlow-pro
          </h2>
          <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
            Cliquez sur les onglets pour explorer le tableau de bord, les devis, le planning, les relances et le suivi de chantier.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {previewTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                active === tab.id
                  ? "bg-primary-500 text-background-50"
                  : "bg-background-50 text-foreground-600 border border-background-200 hover:text-foreground-950"
              }`}
            >
              <i className={tab.icon}></i>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-8 max-w-6xl mx-auto rounded-lg overflow-hidden border border-background-300 bg-background-50">
          <div className="flex items-center gap-3 px-4 h-11 bg-background-200/70 border-b border-background-300">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-400"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-secondary-400"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-accent-400"></span>
            </div>
            <div className="flex-1 flex justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 h-6 rounded-md bg-background-50 text-[11px] text-foreground-500">
                <i className="ri-lock-line text-accent-500"></i>
                artiflow-pro.com/app
              </span>
            </div>
          </div>

          <div className="flex">
            <aside className="hidden md:flex flex-col items-center gap-1 py-4 px-2.5 bg-background-100 border-r border-background-200">
              {sideIcons.map((icon, i) => (
                <span
                  key={icon}
                  className={`w-9 h-9 flex items-center justify-center rounded-md text-lg ${
                    i === previewTabs.findIndex((t) => t.id === active)
                      ? "bg-primary-100 text-primary-700"
                      : "text-foreground-400"
                  }`}
                >
                  <i className={icon}></i>
                </span>
              ))}
            </aside>

            <div className="flex-1 min-w-0 p-3 md:p-5">
              {active === "dashboard" && <DashboardView />}
              {active === "devis" && <DevisView />}
              {active === "planning" && <PlanningView />}
              {active === "relances" && <RelancesView />}
              {active === "chantiers" && <ChantiersView />}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 h-12 px-7 rounded-md bg-primary-500 text-background-50 font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-login-box-line text-lg"></i>
            Ouvrir mon espace artisan
          </Link>
        </div>
      </div>
    </section>
  );
}