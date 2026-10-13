import type { ComptableRemplacement } from "@/lib/artisanApi";

/** Date et heure d'un renvoi (« 12 oct. 2026 à 08:00 »). */
export function dateHeureLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${date} à ${heure}`;
}

/** Libellé lisible de l'exercice concerné (« Exercice 2025 » ou « Septembre 2026 »). */
export function exerciceLabel(exercice: string | null, type: string | null): string {
  if (!exercice) return "—";
  if (/^\d{4}-\d{2}$/.test(exercice)) {
    const [y, m] = exercice.split("-").map((v) => Number(v));
    const d = new Date(y, m - 1, 1);
    const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  if (type === "bilan" || /^\d{4}$/.test(exercice)) return `Exercice ${exercice}`;
  return exercice;
}

/** Nature du renvoi de remplacement (« Bilan d'archivage », « Journal mensuel »). */
export function natureLabel(type: string | null): string {
  if (type === "bilan") return "Bilan d'archivage";
  if (type === "journal") return "Journal mensuel";
  return "Renvoi comptable";
}

/** Clé d'adresse normalisée (comparaison insensible à la casse et aux espaces). */
export function cleAdresse(adresse: string): string {
  return adresse.trim().toLowerCase();
}

/** Clé « AAAA-MM » d'une date ISO (chaîne vide si la date est invalide). */
export function moisCleDeDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Libellé lisible d'une clé de mois (« 2026-10 » → « Octobre 2026 »). */
export function moisCleLabel(cle: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(cle);
  if (!m) return cle;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Modes de tri proposés pour lire la liste des remplacements. */
export type TriKey = "date" | "renvois" | "adresse" | "record";

export const TRIS: { key: TriKey; label: string; icon: string; title: string }[] = [
  { key: "date", label: "Date", icon: "ri-calendar-line", title: "Trier par date du dernier renvoi" },
  { key: "renvois", label: "Renvois", icon: "ri-swap-box-line", title: "Trier par nombre de renvois" },
  { key: "adresse", label: "Adresse", icon: "ri-sort-asc", title: "Trier par adresse (A → Z)" },
  {
    key: "record",
    label: "Mois record",
    icon: "ri-award-line",
    title: "Afficher en premier les pièces du mois le plus actif",
  },
];

/** Clé de stockage du tri choisi, conservé d'une visite à l'autre de l'Espace comptable. */
export const TRI_STORAGE_KEY = "artiflow:compta:remplacements-tri";

/** Clé de stockage du filtre rapide « Mois record uniquement », mémorisé comme le tri. */
export const RECORD_STORAGE_KEY = "artiflow:compta:remplacements-record-uniquement";

/** Clé de stockage de la période du mini-graphe, mémorisée comme le tri. */
export const CHART_MOIS_STORAGE_KEY = "artiflow:compta:remplacements-chart-mois";

/** Clés de stockage des filtres du panneau de sélection (nature + adresse), mémorisés comme le tri. */
export const SEL_NATURE_STORAGE_KEY = "artiflow:compta:remplacements-sel-nature";
export const SEL_ADRESSE_STORAGE_KEY = "artiflow:compta:remplacements-sel-adresse";

/** Relit le tri mémorisé (préférence d'affichage uniquement), « date » par défaut. */
export function lireTriMemorise(): TriKey {
  try {
    const v = localStorage.getItem(TRI_STORAGE_KEY);
    if (v === "date" || v === "renvois" || v === "adresse" || v === "record") return v;
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  return "date";
}

/** Relit le filtre rapide « Mois record uniquement » (désactivé par défaut). */
export function lireRecordUniquementMemorise(): boolean {
  try {
    return localStorage.getItem(RECORD_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Relit la nature mémorisée du filtre de sélection (« tous » par défaut). */
export function lireSelNatureMemorise(): "tous" | "journal" | "bilan" {
  try {
    const v = localStorage.getItem(SEL_NATURE_STORAGE_KEY);
    if (v === "tous" || v === "journal" || v === "bilan") return v;
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  return "tous";
}

/** Relit l'adresse mémorisée du filtre de sélection (chaîne vide par défaut). */
export function lireSelAdresseMemorise(): string {
  try {
    return localStorage.getItem(SEL_ADRESSE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Périodes proposées pour le mini-graphe des renvois par mois. */
export type ChartMois = 3 | 6 | 12;

export const CHART_PERIODES: ChartMois[] = [3, 6, 12];

/** Relit la période mémorisée du mini-graphe (6 mois par défaut). */
export function lireChartMoisMemorise(): ChartMois {
  try {
    const v = Number(localStorage.getItem(CHART_MOIS_STORAGE_KEY));
    if (v === 3 || v === 6 || v === 12) return v;
  } catch {
    /* préférence de confort : ignorée si le stockage est indisponible */
  }
  return 6;
}

/** Natures proposées pour filtrer les pièces du mois dans le panneau de sélection. */
export const SEL_NATURES: { key: "tous" | "journal" | "bilan"; label: string; icon: string }[] = [
  { key: "tous", label: "Toutes", icon: "ri-list-check" },
  { key: "journal", label: "Journaux", icon: "ri-calendar-schedule-line" },
  { key: "bilan", label: "Bilans", icon: "ri-archive-drawer-line" },
];

/** Groupe d'adresses ponctuelles avec leurs renvois (pour la liste). */
export interface GroupeRemplacement {
  cle: string;
  adresse: string;
  nom: string | null;
  items: ComptableRemplacement[];
}