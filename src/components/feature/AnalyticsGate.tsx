import { useEffect } from "react";
import { initAnalyticsConsent } from "@/lib/analytics";

/**
 * Point d'entrée unique de la mesure d'audience.
 * Il ne charge rien directement : tout passe par le consentement du visiteur.
 * Aucun script de mesure n'est chargé avant l'acceptation des cookies.
 */
export default function AnalyticsGate() {
  useEffect(() => initAnalyticsConsent(), []);

  return null;
}