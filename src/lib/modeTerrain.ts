import { Capacitor } from "@capacitor/core";

/**
 * Version « terrain » de l'application mobile : l'artisan y retrouve uniquement ce qui sert sur
 * le chantier (planning, chantiers, clients, équipe, pointages). Devis, factures, relances,
 * comptabilité, envois et réglages avancés restent sur le site, depuis un ordinateur.
 * Les comptes intervenant ont déjà leur propre espace allégé (IntervenantLayout).
 */
export const MODE_TERRAIN = Capacitor.isNativePlatform();

/** Page d'accueil de l'application mobile pour un artisan. */
export const ACCUEIL_TERRAIN = "/app/planning";

const PAGES_TERRAIN = [
  "/app/planning",
  "/app/chantiers",
  "/app/clients",
  "/app/intervenants",
  "/app/pointages",
  "/app/profil",
  "/app/preferences",
  "/app/mon-planning",
];

/** La page est-elle proposée dans la version terrain ? */
export function pageTerrain(chemin: string): boolean {
  const sansParametres = chemin.split(/[?#]/)[0];
  return PAGES_TERRAIN.some((p) => sansParametres === p || sansParametres.startsWith(`${p}/`));
}
