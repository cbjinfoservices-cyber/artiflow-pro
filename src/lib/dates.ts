export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfWeek(input: Date): Date {
  const d = new Date(input);
  const offset = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(input: Date, days: number): Date {
  const d = new Date(input);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Formate un horodatage en date + heure courtes (« 2 oct. 2026 à 14:30 »). */
export function formatDateHeureCourte(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const jour = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${jour} à ${heure}`;
}

/**
 * Formate une date ISO (YYYY-MM-DD) en français long (« 2 octobre 2026 »).
 * On force le fuseau UTC car une date « 2026-10-02 » est interprétée à minuit
 * UTC : sans cela, un fuseau négatif afficherait le jour précédent.
 */
export function formatDateLongue(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDayName(input: Date): string {
  const s = input.toLocaleDateString("fr-FR", { weekday: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatMonth(input: Date): string {
  const s = input.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Nombre de jours écoulés depuis une date ISO (0 aujourd'hui, +∞ si invalide). */
export function joursDepuis(dateISO: string): number {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / 86_400_000);
}

/** Vrai si la date est récente (par défaut : moins de 30 jours). */
export function estNouveau(dateISO: string, jours = 30): boolean {
  return joursDepuis(dateISO) <= jours;
}

/**
 * Libellé de fraîcheur en français (« aujourd'hui », « hier », « il y a 5 jours »).
 * Renvoie une chaîne vide si la date est invalide.
 */
export function libelleFraicheur(dateISO: string): string {
  const jours = joursDepuis(dateISO);
  if (!Number.isFinite(jours)) return "";
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  return `il y a ${jours} jours`;
}

export function todayISO(): string {
  return toISODate(new Date());
}