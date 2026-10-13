import { useEffect, useMemo, useState } from "react";
import { getStatut, subscribeLecture, type StatutLecture } from "@/lib/lecture";

/**
 * Compteur qui s'incrémente à chaque changement de lecture (position ou
 * marqueur « lu »), pour recalculer les listes qui dépendent de plusieurs guides.
 */
export function useLectureVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeLecture(() => setVersion((value) => value + 1));
    return unsubscribe;
  }, []);
  return version;
}

/** Statut de lecture d'un guide : « lu », « en-cours » ou « a-lire ». */
export function useLectureStatut(guideSlug?: string): StatutLecture {
  const version = useLectureVersion();
  return useMemo(
    () => (guideSlug ? getStatut(guideSlug) : "a-lire"),
    [guideSlug, version]
  );
}