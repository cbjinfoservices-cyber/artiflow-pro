import { cleArtiflow, v } from "@/lib/stockageLocal";
import { lieuxIntervention } from "@/mocks/interventions";
import { lieuxEpisode } from "@/mocks/podcasts";
import { useFiltreUrl } from "@/pages/podcast/components/useFiltreUrl";

/**
 * Lieu partagé par toute la page Média : les épisodes de podcast et les
 * interventions publiques filtrent sur le même lieu, que l'on soit passé par le
 * filtre, la carte ou un lien partagé.
 *
 * S'appuie sur le hook générique `useFiltreUrl` : le lieu suit l'URL (`?lieu=Lyon`)
 * *et* reste mémorisé d'une visite à l'autre. Un lieu inconnu dans l'URL est ignoré
 * (retour à la préférence), pour ne jamais aboutir à une liste vide à cause d'un
 * lien erroné.
 */

const CLE_LIEU_MEDIA = cleArtiflow("podcast", "lieu");
const lieuMediaValide = v.chaine("tous", { max: 60 });

// Lieux acceptés : « tous », les villes des interventions et celles des épisodes.
const LIEUX_CONNUS = new Set<string>(["tous", ...lieuxIntervention, ...lieuxEpisode]);

/**
 * Renvoie `[lieuActif, definirLieu]` : le lieu courant (URL + mémoire combinées) et
 * un setter qui met à jour à la fois le stockage local et le paramètre d'URL.
 */
export function useLieuMedia(): [string, (lieu: string) => void] {
  return useFiltreUrl({
    cle: CLE_LIEU_MEDIA,
    parametre: "lieu",
    valider: lieuMediaValide,
    defaut: "tous",
    estValide: (valeur) => LIEUX_CONNUS.has(valeur.trim()),
  });
}