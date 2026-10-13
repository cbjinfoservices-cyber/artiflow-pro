/**
 * Adresse absolue et partageable d'une intervention publique : lien profond vers
 * son ancre dédiée sur la page Média (`/podcast#<id>`). Tient compte du préfixe de
 * publication pour rester valide une fois le site en ligne.
 */
export function lienInterventionPartage(id: string): string {
  const base = (__BASE_PATH__ || "").replace(/\/+$/, "");
  return `${window.location.origin}${base}/podcast#${id}`;
}