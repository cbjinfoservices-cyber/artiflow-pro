import { useCallback, useEffect, useState } from "react";
import { chargerStatutEmail } from "@/lib/diagnosticEmail";
import { CLE_VERIF_CONFIG_EMAIL, lireVerifConfigEmail } from "@/lib/verifConfigEmailMemoire";
import { STOCKAGE_LOCAL_EVENT, type StockageLocalChange } from "@/lib/stockageLocal";

/**
 * État partagé de la configuration d'envoi des emails.
 *
 * Il interroge le Backend une fois au montage pour connaître l'état réel (clé + domaine
 * vérifiés), puis reste synchronisé avec la mémoire locale : lorsqu'une vérification est
 * faite ailleurs (carte des Préférences, bouton « Re-vérifier »), l'état se met à jour sans
 * nouvel appel. Sert au badge d'alerte du menu du compte.
 *
 * `pret` vaut `null` tant qu'aucune vérification n'a encore été faite.
 */
export function useStatutEnvoiEmails() {
  const initial = lireVerifConfigEmail();
  const [pret, setPret] = useState<boolean | null>(initial ? initial.pret : null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState("");

  const rafraichir = useCallback(async () => {
    setLoading(true);
    try {
      const statut = await chargerStatutEmail();
      setPret(statut.ready === true);
      setErreur("");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de vérifier la configuration d'envoi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void rafraichir();
  }, [rafraichir]);

  // Reste synchronisé quand une vérification est faite ailleurs (carte Préférences, re-vérification).
  useEffect(() => {
    const onChangement = (ev: Event) => {
      const detail = (ev as CustomEvent<StockageLocalChange>).detail;
      if (detail?.cle !== CLE_VERIF_CONFIG_EMAIL) return;
      const memo = lireVerifConfigEmail();
      if (memo) setPret(memo.pret);
    };
    window.addEventListener(STOCKAGE_LOCAL_EVENT, onChangement);
    return () => window.removeEventListener(STOCKAGE_LOCAL_EVENT, onChangement);
  }, []);

  /** Vrai uniquement quand la config a été vérifiée et qu'elle n'est PAS prête. */
  const alerte = pret === false;

  return { pret, loading, erreur, alerte, rafraichir };
}