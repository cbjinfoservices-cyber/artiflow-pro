import { useCallback, useEffect, useRef, useState } from "react";
import { verifierToutesFonctionsSilencieusement } from "@/lib/tachesPlanifiees";
import {
  enregistrerDetections,
  enregistrerPassage,
  lireDerniereVerification,
} from "@/lib/tachesPlanifieesMemoire";

/** Délai minimal entre deux vérifications silencieuses automatiques (10 minutes). */
const INTERVALLE_MS = 10 * 60 * 1000;

/**
 * Rafraîchit silencieusement l'état « branché / non branché » des tâches planifiées,
 * sans aucun clic et sans jamais envoyer d'email (ping OPTIONS).
 *
 * - Lancé une fois au montage quand `enabled` vaut true (chargement du tableau de bord).
 * - Garde anti-rafale : on ne relance pas automatiquement si une vérification a eu lieu
 *   il y a moins de 10 min (sauf relance manuelle forcée).
 * - On ne mémorise QUE les succès dans l'état « branché / non branché » : un ping silencieux
 *   ne doit jamais créer de fausse alerte.
 * - Chaque passage (même automatique) est ajouté au journal local de fiabilité.
 */
export function useVerificationSilencieuseTaches(enabled = true) {
  const [enCours, setEnCours] = useState(false);
  const [dernierCompte, setDernierCompte] = useState<{ joignables: number; total: number } | null>(null);
  const occupe = useRef(false);

  const lancer = useCallback(async (force = false) => {
    if (occupe.current) return;
    if (!force) {
      const derniere = lireDerniereVerification();
      if (derniere) {
        const t = new Date(derniere).getTime();
        if (Number.isFinite(t) && Date.now() - t < INTERVALLE_MS) return;
      }
    }
    occupe.current = true;
    setEnCours(true);
    try {
      const resultats = await verifierToutesFonctionsSilencieusement();
      const succes = resultats.filter((r) => r.ok);
      if (succes.length > 0) enregistrerDetections(succes);
      const compte = { joignables: succes.length, total: resultats.length };
      setDernierCompte(compte);
      // Historique de fiabilité : on note l'heure et le nombre de fonctions joignables.
      enregistrerPassage({ quand: new Date().toISOString(), ...compte });
    } catch {
      /* silencieux : aucune conséquence visible en cas d'échec réseau */
    } finally {
      setEnCours(false);
      occupe.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void lancer(false);
  }, [enabled, lancer]);

  return {
    enCours,
    /** Dernier résultat connu ({ joignables, total }), pour un retour visuel immédiat. */
    dernierCompte,
    /** Relance respectant la garde anti-rafale (usage programmatique). */
    relancer: () => lancer(false),
    /** Relance forcée, à la demande de l'utilisateur (ignore la garde anti-rafale). */
    forcer: () => lancer(true),
  };
}