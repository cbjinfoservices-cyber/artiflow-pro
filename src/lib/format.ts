export function formatEuros(value: number): string {
  return `${Math.round(Number.isFinite(value) ? value : 0).toLocaleString("fr-FR")} €`;
}

export function formatCompactEuros(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  if (v >= 1000) return `${Math.round(v / 100) / 10}k€`;
  return `${Math.round(v)}€`;
}