import { useEffect, useState } from "react";
import { lireSonActif, SON_PREF_EVENT } from "@/lib/sonPrefsMemoire";

/**
 * Suit la préférence « son de confirmation » (activé / coupé) et se met à jour à chaud dès
 * qu'elle change, y compris depuis un autre onglet. Sert à afficher le petit indicateur de
 * sons coupés dans l'en-tête du menu.
 */
export function useSonActif(): boolean {
  const [actif, setActif] = useState(() => lireSonActif());

  useEffect(() => {
    const maj = () => setActif(lireSonActif());
    window.addEventListener(SON_PREF_EVENT, maj);
    window.addEventListener("storage", maj);
    return () => {
      window.removeEventListener(SON_PREF_EVENT, maj);
      window.removeEventListener("storage", maj);
    };
  }, []);

  return actif;
}