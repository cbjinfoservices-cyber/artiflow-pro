import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { journaliserDepuisErreur } from "@/lib/journalErreursChargement";
import { episodesPodcast, type EpisodePodcast } from "@/mocks/podcasts";

/**
 * Épisode « pilote » de la page Média : celui qui est mis en avant et qui pilote
 * la carte lecteur (Twitter « player » + métadonnées audio) lorsqu'on partage la
 * page.
 *
 * Il s'agit désormais d'un **réglage global** : l'épisode choisi est enregistré
 * dans le Backend (table `parametres_podcast`, ligne unique id = 1) et partagé
 * par tous les visiteurs, et non plus mémorisé dans le navigateur de chacun. À
 * défaut (aucune valeur enregistrée, ou Backend indisponible), l'épisode le plus
 * récent est mis en avant.
 */

const IDS_EPISODES = episodesPodcast.map((episode) => episode.id);
const EPISODE_PAR_DEFAUT = episodesPodcast[0].id;
const TABLE = "parametres_podcast";

/** Ne retient une valeur que si elle correspond à un épisode connu. */
function episodeValide(id: unknown): string | null {
  return typeof id === "string" && IDS_EPISODES.includes(id) ? id : null;
}

/**
 * Renvoie `[episodePilote, definirEpisodePilote]` : l'épisode actuellement mis
 * en avant (valeur globale) et un setter qui le persiste pour tout le monde.
 */
export function useEpisodePilote(): [EpisodePodcast, (id: string) => void] {
  const [id, setId] = useState<string>(EPISODE_PAR_DEFAUT);

  // Lecture initiale : l'épisode pilote est une valeur globale partagée par tous.
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from(TABLE)
          .select("episode_pilote_id")
          .eq("id", 1)
          .maybeSingle();
        if (error) {
          journaliserDepuisErreur({
            ecran: "Back-office · Épisode pilote",
            source: "parametres_podcast",
            error,
            gravite: "avertissement",
          });
          return;
        }
        const valide = episodeValide(data?.episode_pilote_id);
        if (!annule && valide) setId(valide);
      } catch (e) {
        journaliserDepuisErreur({
          ecran: "Back-office · Épisode pilote",
          source: "parametres_podcast",
          error: e,
          gravite: "avertissement",
        });
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  const definirEpisodePilote = useCallback((nouvelId: string) => {
    if (!IDS_EPISODES.includes(nouvelId)) return;
    // Mise à jour immédiate de l'interface, puis persistance globale côté Backend.
    setId(nouvelId);
    void (async () => {
      try {
        await supabase
          .from(TABLE)
          .upsert(
            { id: 1, episode_pilote_id: nouvelId, updated_at: new Date().toISOString() },
            { onConflict: "id" },
          );
      } catch (e) {
        // Échec d'enregistrement : consigné dans le journal pour ne plus passer inaperçu.
        journaliserDepuisErreur({
          ecran: "Back-office · Épisode pilote",
          source: "parametres_podcast (écriture)",
          error: e,
          gravite: "avertissement",
        });
      }
    })();
  }, []);

  const episode = episodesPodcast.find((item) => item.id === id) ?? episodesPodcast[0];
  return [episode, definirEpisodePilote];
}