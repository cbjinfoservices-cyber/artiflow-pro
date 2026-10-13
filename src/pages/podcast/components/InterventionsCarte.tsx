import { useMemo } from "react";
import { Link } from "react-router-dom";
import { interventionsPubliques, estEnLigne } from "@/mocks/interventions";

type InterventionsCarteProps = {
  /** Lieu actuellement actif dans la liste (« tous », une ville ou « En ligne »). */
  lieuActif: string;
  /** Change le lieu actif : la carte pilote ainsi directement les filtres de la liste. */
  onLieuChange: (lieu: string) => void;
};

/**
 * Petite carte encadrant les interventions publiques en présentiel : une carte
 * Google Maps (iframe intégrée) avec sélection de la ville, la liste des villes
 * où l'équipe se déplace, et un bouton qui renvoie vers le formulaire de contact
 * pré-rempli avec la ville choisie (« M'alerter des interventions près de chez
 * moi »). Ne concerne que les lieux physiques : les interventions « En ligne »
 * ne sont pas cartographiables.
 *
 * La carte est *pilotable* : elle ne garde plus d'état interne, mais reçoit le
 * lieu actif et le remonte à la section parente. Cliquer une ville filtre donc
 * aussitôt la liste des interventions, et sélectionner un lieu dans les filtres
 * recentre la carte en retour (liaison carte ↔ filtres dans les deux sens).
 */
export default function InterventionsCarte({ lieuActif, onLieuChange }: InterventionsCarteProps) {
  const villes = useMemo(
    () =>
      Array.from(
        new Set(
          interventionsPubliques
            .map((intervention) => intervention.location)
            .filter((lieu) => !estEnLigne(lieu))
        )
      ).sort((a, b) => a.localeCompare(b, "fr")),
    []
  );

  const compteVille = (ville: string) =>
    interventionsPubliques.filter((intervention) => intervention.location === ville).length;

  // Seules les villes physiques sont cartographiables : « En ligne » et « tous »
  // retombent sur la vue d'ensemble de la France.
  const villeSurCarte = lieuActif !== "tous" && !estEnLigne(lieuActif) ? lieuActif : "";

  const requeteCarte = villeSurCarte ? `${villeSurCarte}, France` : "France";
  const carteSrc = `https://www.google.com/maps?q=${encodeURIComponent(
    requeteCarte
  )}&z=${villeSurCarte ? 12 : 5}&output=embed`;

  const contactUrl = `/contact?sujet=${encodeURIComponent("Interventions près de chez moi")}${
    villeSurCarte ? `&ville=${encodeURIComponent(villeSurCarte)}` : ""
  }`;

  return (
    <div className="mb-8 rounded-lg bg-background-50 border border-background-200 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr]">
        <div className="relative w-full h-64 md:h-80 bg-background-100">
          <iframe
            title="Carte des interventions en présentiel de l'équipe ArtiFlow-pro (Lyon, Paris, Nantes, Bordeaux)"
            src={carteSrc}
            className="absolute inset-0 w-full h-full border-0"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          ></iframe>
        </div>

        <div className="p-6 md:p-7 flex flex-col">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
            <i className="ri-road-map-line"></i>
            Où nous rencontrer en présentiel
          </span>
          <h3 className="mt-2 font-heading font-bold text-lg md:text-xl text-foreground-950 tracking-tight">
            L'équipe se déplace dans toute la France
          </h3>
          <p className="mt-2 text-sm text-foreground-600 leading-relaxed">
            Sélectionnez une ville ci-dessous : elle se situe sur la carte et filtre aussitôt la
            liste des interventions plus bas.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onLieuChange("tous")}
              aria-pressed={lieuActif === "tous"}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                lieuActif === "tous"
                  ? "bg-accent-500 text-background-50"
                  : "bg-background-100 border border-background-200 text-foreground-700 hover:border-accent-300"
              }`}
            >
              <i className="ri-map-2-line"></i>
              Toute la France
            </button>
            {villes.map((ville) => {
              const actif = lieuActif === ville;
              return (
                <button
                  key={ville}
                  type="button"
                  onClick={() => onLieuChange(ville)}
                  aria-pressed={actif}
                  title={`Filtrer les interventions à ${ville}`}
                  className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    actif
                      ? "bg-accent-500 text-background-50"
                      : "bg-background-100 border border-background-200 text-foreground-700 hover:border-accent-300"
                  }`}
                >
                  <i className="ri-map-pin-line"></i>
                  {ville}
                  <span
                    className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                      actif
                        ? "bg-background-50/25 text-background-50"
                        : "bg-accent-100 text-accent-900"
                    }`}
                  >
                    {compteVille(ville)}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-foreground-500">
            {villeSurCarte
              ? `Les interventions de la liste sont filtrées sur ${villeSurCarte}.`
              : "Aucun filtre de ville : toutes les interventions sont affichées plus bas."}
          </p>

          <Link
            to={contactUrl}
            className="mt-5 inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-notification-3-line"></i>
            M'alerter des interventions près de chez moi
          </Link>
          <p className="mt-2 text-[11px] text-foreground-400">
            {villeSurCarte
              ? `Le formulaire s'ouvrira pré-rempli pour ${villeSurCarte}.`
              : "Astuce : choisissez d'abord une ville pour la mentionner automatiquement."}
          </p>
        </div>
      </div>
    </div>
  );
}