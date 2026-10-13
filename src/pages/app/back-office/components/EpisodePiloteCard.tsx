import { useState } from "react";
import { useEpisodePilote } from "@/hooks/useEpisodePilote";
import { episodesPodcast } from "@/mocks/podcasts";

const EPISODE_RECENT = episodesPodcast[0];

/**
 * Commande back-office pour désigner l'épisode « pilote » du podcast : celui mis
 * en avant sur la page Média et qui alimente la carte lecteur Twitter / les
 * métadonnées audio lors du partage. Le réglage est global (partagé par tous les
 * visiteurs) et enregistré côté Backend — plus besoin de passer par la page
 * publique pour le changer.
 */
export default function EpisodePiloteCard() {
  const [episodePilote, definirEpisodePilote] = useEpisodePilote();
  const [message, setMessage] = useState<string | null>(null);

  const estRecent = episodePilote.id === EPISODE_RECENT.id;

  const choisir = (id: string) => {
    definirEpisodePilote(id);
    setMessage("Épisode à la une mis à jour pour tous les visiteurs");
    window.setTimeout(() => setMessage(null), 2600);
  };

  return (
    <div className="flex flex-col rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <i className="ri-mic-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">Épisode pilote du podcast</h3>
            <p className="text-[11px] text-foreground-500">
              Épisode mis en avant qui pilote la carte lecteur au partage de la page Média.
            </p>
          </div>
        </div>
        {message && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground-600">
            <i className="ri-checkbox-circle-line text-accent-600"></i>
            {message}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 p-5">
        {/* Épisode actuellement à la une */}
        <div className="flex gap-4 p-4 rounded-lg bg-background-50 border border-background-200">
          <div className="w-28 h-20 shrink-0 rounded-md overflow-hidden bg-background-100 border border-background-200">
            <img
              src={episodePilote.thumbnailUrl}
              alt={`Miniature de l'épisode ${episodePilote.title}`}
              title={episodePilote.title}
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent-100 text-accent-900 text-[11px] font-semibold">
                <i className="ri-star-line"></i>
                À la une
              </span>
              {estRecent && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-900 text-[11px] font-semibold">
                  <i className="ri-history-line"></i>
                  Le plus récent
                </span>
              )}
            </div>
            <p className="mt-2 font-heading font-semibold text-sm text-foreground-950 leading-snug line-clamp-2">
              {episodePilote.title}
            </p>
            <p className="mt-1 text-[11px] text-foreground-500">
              Ép. {episodePilote.episodeNumber} · {episodePilote.show} · {episodePilote.date}
            </p>
          </div>
        </div>

        {/* Sélection */}
        <div className="flex flex-col justify-center gap-3">
          <label
            htmlFor="back-office-episode-pilote"
            className="text-xs font-semibold uppercase tracking-wide text-foreground-500"
          >
            Choisir l'épisode à la une
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <i className="ri-mic-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500"></i>
              <select
                id="back-office-episode-pilote"
                value={episodePilote.id}
                onChange={(e) => choisir(e.target.value)}
                className="w-full h-11 pl-9 pr-9 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 appearance-none cursor-pointer"
              >
                {episodesPodcast.map((episode) => (
                  <option key={episode.id} value={episode.id}>
                    Ép. {episode.episodeNumber} · {episode.show} — {episode.title}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-500 pointer-events-none"></i>
            </div>
            <button
              type="button"
              onClick={() => choisir(EPISODE_RECENT.id)}
              disabled={estRecent}
              title="Remettre l'épisode le plus récent à la une"
              aria-label="Remettre l'épisode le plus récent à la une"
              className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-md bg-background-50 border border-background-200 text-foreground-700 hover:border-primary-300 hover:text-primary-700 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <i className="ri-history-line"></i>
            </button>
          </div>
          <p className="text-xs text-foreground-500">
            Réglage global, enregistré côté Backend et partagé par tous les visiteurs. Par défaut,
            l'épisode le plus récent est mis en avant.
          </p>
        </div>
      </div>
    </div>
  );
}