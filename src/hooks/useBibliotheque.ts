import { useEffect, useMemo, useState } from "react";
import { compterBibliotheque, compterFavoris, compterNotes, compterNotesLibres, getNote, isFavori, subscribeBibliotheque } from "@/lib/bibliotheque";

/**
 * Compteur incrémenté à chaque changement de favori ou de note, pour recalculer
 * les listes et compteurs qui en dépendent.
 */
export function useBibliothequeVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribeBibliotheque(() => setVersion((value) => value + 1)), []);
  return version;
}

/** Vrai si le guide est en favori. */
export function useFavori(slug?: string): boolean {
  const version = useBibliothequeVersion();
  return useMemo(() => isFavori(slug), [slug, version]);
}

/** Note personnelle du guide. */
export function useNote(slug?: string): string {
  const version = useBibliothequeVersion();
  return useMemo(() => getNote(slug), [slug, version]);
}

/** Nombre total de guides en favori. */
export function useCompteurFavoris(): number {
  const version = useBibliothequeVersion();
  return useMemo(() => compterFavoris(), [version]);
}

/** Nombre total de guides disposant d'une note personnelle. */
export function useCompteurNotes(): number {
  const version = useBibliothequeVersion();
  return useMemo(() => compterNotes(), [version]);
}

/** Nombre de notes libres (non rattachées à un guide). */
export function useCompteurNotesLibres(): number {
  const version = useBibliothequeVersion();
  return useMemo(() => compterNotesLibres(), [version]);
}

/** Nombre total de notes (attachées à un guide + notes libres). */
export function useCompteurNotesTotal(): number {
  const version = useBibliothequeVersion();
  return useMemo(() => compterNotes() + compterNotesLibres(), [version]);
}

/** Nombre total d'éléments de la bibliothèque (favoris + notes, y compris libres). */
export function useCompteurBibliotheque(): number {
  const version = useBibliothequeVersion();
  return useMemo(() => compterBibliotheque(), [version]);
}