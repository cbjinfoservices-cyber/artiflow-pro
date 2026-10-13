import { Link } from "react-router-dom";
import { episodesPodcast } from "@/mocks/podcasts";

const toneBubble: Record<string, string> = {
  primary: "bg-primary-100 text-primary-700",
  accent: "bg-accent-100 text-accent-700",
  secondary: "bg-secondary-100 text-secondary-700",
};

/**
 * Section « L'équipe sur les ondes » de la page À propos : les 3 dernières
 * prises de parole de l'équipe, avec un lien vers la page Podcast complète.
 */
export default function EquipeOndes() {
  const derniers = episodesPodcast.slice(0, 3);

  return (
    <section className="w-full bg-background-50 border-b border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
              <i className="ri-mic-line"></i>
              L'équipe sur les ondes
            </span>
            <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
              Nos dernières prises de parole dans les médias
            </h2>
            <p className="mt-4 text-base text-foreground-600 leading-relaxed">
              Podcasts, conférences et tables rondes : les membres de l'équipe partagent régulièrement leur
              expertise sur le chiffrage, l'IA et la protection des données. Voici les trois dernières.
            </p>
          </div>
          <Link
            to="/podcast"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer whitespace-nowrap"
          >
            Voir tous les épisodes
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {derniers.map((episode) => (
            <article
              key={episode.id}
              className="group flex flex-col rounded-lg bg-background-100 border border-background-200 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-center justify-between gap-3 p-5 pb-0">
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

              <div className="flex flex-col flex-1 p-5">
                <h3 className="font-heading font-semibold text-base text-foreground-950 leading-snug">
                  {episode.title}
                </h3>
                <p className="mt-2 text-sm text-foreground-600 leading-relaxed flex-1">
                  {episode.description}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-foreground-500">
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
                  <span className="inline-flex items-center gap-1.5">
                    <i className="ri-calendar-line"></i>
                    {episode.date}
                  </span>
                </div>

                <Link
                  to={`/podcast#${episode.id}`}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:gap-3 transition-all cursor-pointer"
                >
                  Écouter l'épisode
                  <i className="ri-play-circle-line"></i>
                </Link>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            to="/podcast"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-headphone-line"></i>
            Écouter tous les podcasts
          </Link>
        </div>
      </div>
    </section>
  );
}