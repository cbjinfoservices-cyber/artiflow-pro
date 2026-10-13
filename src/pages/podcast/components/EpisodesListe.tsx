import { useMemo } from "react";
import { Link } from "react-router-dom";
import EpisodeCard from "@/pages/podcast/components/EpisodeCard";
import { episodesPodcast, lieuxEpisode } from "@/mocks/podcasts";
import { estEnLigne } from "@/mocks/interventions";

/**
 * Liste complète des épisodes de podcast de la page Média, avec un filtre
 * « par lieu » identique à celui des interventions publiques (mêmes villes en
 * présentiel + « En ligne »), pour un repérage cohérent sur toute la page.
 * Chaque carte réaffiche son lieu d'enregistrement (épingle ou globe).
 *
 * Le lieu n'est plus géré ici : il est partagé avec le reste de la page Média
 * (interventions, carte, URL `?lieu=`), d'où les deux props reçues du parent.
 */
type EpisodesListeProps = {
  /** Lieu actif, partagé avec le reste de la page Média (et l'URL). */
  lieuActif: string;
  /** Change le lieu actif : pilote aussi la carte et les interventions. */
  onLieuChange: (lieu: string) => void;
  /** Identifiant de l'épisode mis à la une : exclu de la liste pour ne pas le dupliquer. */
  episodePiloteId: string;
};

export default function EpisodesListe({ lieuActif, onLieuChange, episodePiloteId }: EpisodesListeProps) {
  const autresEpisodes = useMemo(
    () => episodesPodcast.filter((episode) => episode.id !== episodePiloteId),
    [episodePiloteId]
  );

  const episodesFiltres = useMemo(
    () =>
      autresEpisodes.filter(
        (episode) => lieuActif === "tous" || episode.location === lieuActif
      ),
    [autresEpisodes, lieuActif]
  );

  const compteLieu = (lieu: string) =>
    autresEpisodes.filter((episode) => episode.location === lieu).length;

  return (
    <section className="w-full bg-background-50 border-b border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-18">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
              <i className="ri-stack-line"></i>
              {episodesPodcast.length} épisodes
            </span>
            <h2 className="mt-3 font-heading font-bold text-2xl md:text-4xl text-foreground-950 tracking-tight">
              Toutes les prises de parole
            </h2>
            <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
              Chaque épisode est écoutable directement ici, et renvoie vers l'émission d'origine pour
              aller plus loin.
            </p>
          </div>
          <Link
            to="/a-propos#equipe"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer whitespace-nowrap"
          >
            Voir les intervenants
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>

        {/* Filtre par lieu : mêmes villes et « En ligne » que les interventions */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-500 mr-1">
            <i className="ri-map-pin-2-line"></i>
            Filtrer par lieu :
          </span>
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
            <i className="ri-earth-line"></i>
            Tous les lieux
            <span
              className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                lieuActif === "tous"
                  ? "bg-background-50/25 text-background-50"
                  : "bg-accent-100 text-accent-900"
              }`}
            >
              {autresEpisodes.length}
            </span>
          </button>
          {lieuxEpisode.map((lieu) => {
            const actif = lieuActif === lieu;
            const enLigne = estEnLigne(lieu);
            return (
              <button
                key={lieu}
                type="button"
                onClick={() => onLieuChange(lieu)}
                aria-pressed={actif}
                title={enLigne ? "Épisodes enregistrés en ligne" : `Épisodes enregistrés à ${lieu}`}
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  actif
                    ? "bg-accent-500 text-background-50"
                    : "bg-background-100 border border-background-200 text-foreground-700 hover:border-accent-300"
                }`}
              >
                <i className={enLigne ? "ri-global-line" : "ri-map-pin-line"}></i>
                {lieu}
                <span
                  className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                    actif
                      ? "bg-background-50/25 text-background-50"
                      : "bg-accent-100 text-accent-900"
                  }`}
                >
                  {compteLieu(lieu)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-foreground-500 mb-6">
          <span className="inline-flex items-center gap-1.5">
            <i className="ri-list-check"></i>
            {episodesFiltres.length} épisode{episodesFiltres.length > 1 ? "s" : ""}
          </span>
          {lieuActif !== "tous" && <span>· à {lieuActif}</span>}
          {lieuActif !== "tous" && (
            <button
              type="button"
              onClick={() => onLieuChange("tous")}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-background-100 border border-background-200 text-foreground-700 font-semibold cursor-pointer hover:border-accent-300 transition-colors"
            >
              <i className="ri-close-line"></i>
              Réinitialiser le filtre
            </button>
          )}
        </div>

        {episodesFiltres.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {episodesFiltres.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-lg border border-dashed border-background-300 bg-background-100">
            <span className="w-14 h-14 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-2xl">
              <i className="ri-mic-line"></i>
            </span>
            <h3 className="mt-4 font-heading font-semibold text-lg text-foreground-950">
              Aucun épisode pour ce lieu
            </h3>
            <p className="mt-2 text-sm text-foreground-600 max-w-md">
              Essayez un autre lieu, ou affichez de nouveau tous les épisodes.
            </p>
            <button
              type="button"
              onClick={() => onLieuChange("tous")}
              className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
            >
              <i className="ri-refresh-line"></i>
              Voir tous les épisodes
            </button>
          </div>
        )}
      </div>
    </section>
  );
}