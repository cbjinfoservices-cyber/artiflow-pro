import { useState } from "react";
import { Link } from "react-router-dom";
import Toast from "@/components/base/Toast";
import { interventionsPubliques, iconesFormat, estEnLigne, lieuxIntervention, compteParLieu } from "@/mocks/interventions";
import type { InterventionPublique } from "@/mocks/interventions";
import { episodesPodcast, compteEpisodesParLieu } from "@/mocks/podcasts";
import { lienInterventionPartage } from "@/lib/interventions";

const toneChip: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

/**
 * Section « Interventions publiques » du plan du site : chaque conférence,
 * webinaire, table ronde, masterclass et interview renvoie vers son ancre
 * dédiée sur la page Média (`/podcast#<id>`), afin que chaque prise de parole
 * soit directement explorable depuis le plan du site. Un bouton « copier le
 * lien » permet de partager une prise de parole précise.
 */
export default function InterventionsPlanDuSite() {
  const [toast, setToast] = useState<string | null>(null);

  const copierLien = async (intervention: InterventionPublique) => {
    try {
      await navigator.clipboard.writeText(lienInterventionPartage(intervention.id));
      setToast(`Lien de « ${intervention.title} » copié`);
    } catch {
      setToast("Impossible de copier le lien pour le moment");
    }
  };

  return (
    <section
      id="interventions-publiques"
      className="w-full bg-background-100 border-y border-background-200 scroll-mt-32"
    >
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div className="max-w-2xl">
            <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 tracking-tight">
              Les interventions publiques
            </h2>
            <p className="mt-2 text-sm text-foreground-600 leading-relaxed">
              {interventionsPubliques.length} prises de parole de l'équipe (conférences, webinaires,
              tables rondes, masterclasses et interviews), chacune accessible par son ancre sur la page
              Média.
            </p>
          </div>
          <Link
            to="/podcast#interventions-publiques"
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700 hover:gap-3 transition-all cursor-pointer whitespace-nowrap"
          >
            Voir la page Média
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>

        {/* Récap « interventions · épisodes » par lieu : chaque puce ouvre la page
            Média déjà filtrée sur la ville (`/podcast?lieu=…`). */}
        <div className="mb-8 rounded-lg bg-background-50 border border-background-200 p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-500">
              <i className="ri-map-pin-2-line"></i>
              Interventions &amp; épisodes par lieu
            </span>
            <span className="text-xs text-foreground-400">
              — une ville ouvre la page Média déjà filtrée.
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link
              to="/podcast"
              title="Voir toutes les interventions et tous les épisodes"
              className="inline-flex items-center gap-3 h-11 px-4 rounded-full bg-background-100 border border-background-200 hover:border-accent-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground-900">
                <i className="ri-map-2-line text-accent-700"></i>
                Toute la France
              </span>
              <span className="w-px h-4 bg-background-300"></span>
              <span className="inline-flex items-center gap-1.5 text-xs text-foreground-700">
                <i className="ri-presentation-line text-secondary-700"></i>
                <strong className="font-semibold text-foreground-900">{interventionsPubliques.length}</strong>
                interventions
              </span>
              <span className="text-foreground-300">·</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-foreground-700">
                <i className="ri-mic-line text-primary-700"></i>
                <strong className="font-semibold text-foreground-900">{episodesPodcast.length}</strong>
                épisodes
              </span>
            </Link>
            {lieuxIntervention.map((lieu) => {
              const enLigne = estEnLigne(lieu);
              const nbInterventions = compteParLieu(lieu);
              const nbEpisodes = compteEpisodesParLieu(lieu);
              return (
                <Link
                  key={lieu}
                  to={`/podcast?lieu=${encodeURIComponent(lieu)}`}
                  title={`Voir les interventions et épisodes liés à ${lieu}`}
                  className="inline-flex items-center gap-3 h-11 px-4 rounded-full bg-background-100 border border-background-200 hover:border-accent-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground-900">
                    <i className={enLigne ? "ri-global-line text-accent-700" : "ri-map-pin-line text-accent-700"}></i>
                    {lieu}
                  </span>
                  <span className="w-px h-4 bg-background-300"></span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-foreground-700">
                    <i className="ri-presentation-line text-secondary-700"></i>
                    <strong className="font-semibold text-foreground-900">{nbInterventions}</strong>
                    intervention{nbInterventions > 1 ? "s" : ""}
                  </span>
                  <span className="text-foreground-300">·</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-foreground-700">
                    <i className="ri-mic-line text-primary-700"></i>
                    <strong className="font-semibold text-foreground-900">{nbEpisodes}</strong>
                    épisode{nbEpisodes > 1 ? "s" : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {interventionsPubliques.map((intervention) => (
            <div
              key={intervention.id}
              className="group flex items-start gap-4 p-5 rounded-lg bg-background-50 border border-background-200 hover:border-accent-300 transition-colors"
            >
              <Link
                to={`/podcast#${intervention.id}`}
                title={`${intervention.format} · ${intervention.title}`}
                className="flex items-start gap-4 min-w-0 flex-1 cursor-pointer"
              >
                <span
                  className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-lg ${toneChip[intervention.tone]}`}
                >
                  <i className={intervention.icon}></i>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-500">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${toneChip[intervention.tone]}`}
                    >
                      <i className={iconesFormat[intervention.format]}></i>
                      {intervention.format}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <i className="ri-broadcast-line"></i>
                      {intervention.event}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <i className="ri-calendar-line"></i>
                      {intervention.date}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <i className={estEnLigne(intervention.location) ? "ri-global-line" : "ri-map-pin-line"}></i>
                      {intervention.location}
                    </span>
                  </span>
                  <span className="mt-2 block font-heading font-semibold text-sm text-foreground-950 leading-snug">
                    {intervention.title}
                  </span>
                  <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-foreground-500">
                    <i className="ri-user-voice-line"></i>
                    {intervention.speaker}
                  </span>
                </span>
                <i className="ri-arrow-right-line mt-1 shrink-0 text-foreground-400 group-hover:text-accent-600 transition-colors"></i>
              </Link>
              <button
                type="button"
                onClick={() => copierLien(intervention)}
                title="Copier le lien de cette intervention"
                aria-label={`Copier le lien de « ${intervention.title} »`}
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-background-100 border border-background-200 text-foreground-500 hover:border-accent-300 hover:text-accent-700 transition-colors cursor-pointer"
              >
                <i className="ri-link"></i>
              </button>
            </div>
          ))}
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} icon="ri-link" />}
    </section>
  );
}