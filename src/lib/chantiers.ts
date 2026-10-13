import type { ChantierItem } from "@/hooks/useArtisanData";

export function chantierProgress(c: ChantierItem): number {
  if (c.etapes.length === 0) return c.statut === "Terminé" ? 100 : 0;
  const done = c.etapes.filter((e) => e.fait).length;
  return Math.round((done / c.etapes.length) * 100);
}