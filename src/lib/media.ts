import { originePublique } from "@/lib/site";
/**
 * Adresse absolue et partageable d'une vue filtrée de la page Média.
 *
 * Seuls les filtres actifs (différents de leur valeur par défaut) sont inscrits
 * dans l'URL : le lien reproduit donc exactement la combinaison affichée
 * (lieu + format + intervenant + tri), sans bruit inutile.
 * Tient compte du préfixe de publication pour rester valide une fois le site en ligne.
 */
export function lienVueMedia(filtres: {
  lieu?: string;
  format?: string;
  intervenant?: string;
  tri?: string;
}): string {
  const base = (__BASE_PATH__ || "").replace(/\/+$/, "");
  const params = new URLSearchParams();
  if (filtres.lieu && filtres.lieu !== "tous") params.set("lieu", filtres.lieu);
  if (filtres.format && filtres.format !== "tous") params.set("format", filtres.format);
  if (filtres.intervenant && filtres.intervenant !== "tous") {
    params.set("intervenant", filtres.intervenant);
  }
  if (filtres.tri && filtres.tri !== "recent") params.set("tri", filtres.tri);
  const requete = params.toString();
  return `${originePublique()}${base}/podcast${requete ? `?${requete}` : ""}`;
}