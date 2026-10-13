import { Link } from "react-router-dom";
import type { EpisodePodcast } from "@/mocks/podcasts";
import { estEnLigne } from "@/mocks/interventions";

const toneBubble: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

type EpisodeCardProps = {
  episode: EpisodePodcast;
  /** Variante « vedette » : carte plus large avec lecteur mis en avant. */
  featured?: boolean;
};

/**
 * Carte d'un épisode de podcast : bandeau média, intervenant (cliquable vers sa
 * page auteur), lien secondaire vers sa fiche dans la page À propos, description,
 * lecteur audio intégré et lien vers la plateforme d'origine.
 */
export default function EpisodeCard({ episode, featured = false }: EpisodeCardProps) {
  return (
    <article
      id={episode.id}
      className={`group flex flex-col rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 transition-colors scroll-mt-32 ${
        featured ? "p-6 md:p-8" : "p-5 md:p-6"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-lg ${toneBubble[episode.tone]}`}>
            <i className={episode.icon}></i>
          </span>
          <div className="min-w-0">
            <div className="font-heading font-semibold text-sm text-foreground-950 truncate">
              {episode.show}
            </div>
            <div className="text-xs text-foreground-500">Épisode {episode.episodeNumber}</div>
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-900 text-[11px] font-semibold">
          <i className="ri-time-line"></i>
          {episode.duration}
        </span>
      </div>

      <h3
        className={`mt-4 font-heading font-semibold text-foreground-950 leading-snug ${
          featured ? "text-xl md:text-2xl" : "text-base md:text-lg"
        }`}
      >
        {episode.title}
      </h3>

      <p className="mt-2.5 text-sm text-foreground-600 leading-relaxed flex-1">
        {episode.description}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-foreground-500">
        <span className="inline-flex items-center gap-1.5">
          <i className="ri-calendar-line"></i>
          {episode.date}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className={estEnLigne(episode.location) ? "ri-global-line" : "ri-map-pin-line"}></i>
          {episode.location}
        </span>
        <Link
          to={`/auteurs/${episode.speakerId}`}
          title={`Voir la page de ${episode.speaker}`}
          className="inline-flex items-center gap-1.5 text-foreground-700 hover:text-primary-700 transition-colors cursor-pointer"
        >
          <i className="ri-user-voice-line"></i>
          {episode.speaker}
        </Link>
        <Link
          to={`/a-propos#${episode.speakerId}`}
          title={`Voir la fiche équipe de ${episode.speaker} dans À propos`}
          aria-label={`Voir la fiche équipe de ${episode.speaker} dans À propos`}
          className="inline-flex items-center gap-1.5 text-foreground-500 hover:text-primary-700 transition-colors cursor-pointer"
        >
          <i className="ri-team-line"></i>
          Fiche équipe
        </Link>
      </div>

      <div className="mt-4">
        <audio
          controls
          preload="none"
          src={episode.audioUrl}
          className="w-full"
        >
          Votre navigateur ne prend pas en charge la lecture audio.
        </audio>
      </div>

      <a
        href={episode.listenUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer"
      >
        Écouter sur la plateforme d'origine
        <i className="ri-external-link-line"></i>
      </a>
    </article>
  );
}