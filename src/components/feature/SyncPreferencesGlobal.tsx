import { usePreferencesAffichageSync } from "@/hooks/usePreferencesAffichageSync";

/**
 * Monte la synchronisation des préférences d'affichage une seule fois pour toute l'application,
 * y compris sur les pages publiques (bibliothèque de ressources, etc.) où certains de ces réglages
 * se modifient aussi. Le module de synchronisation étant un singleton, ce montage complète celui
 * de la coque de l'espace sans double travail. Ne rend rien.
 */
export default function SyncPreferencesGlobal() {
  usePreferencesAffichageSync();
  return null;
}