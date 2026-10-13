/** Échappe une cellule CSV (séparateur point-virgule, compatible Excel FR). */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Construit le contenu CSV à partir d'un en-tête et de lignes de données. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCell).join(";"), ...rows.map((row) => row.map(escapeCell).join(";"))];
  return lines.join("\r\n");
}

/** Déclenche le téléchargement d'un fichier CSV (BOM UTF-8 pour Excel). */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Encode un contenu texte en base64 (UTF-8), pour l'envoyer en pièce jointe email. */
export function textToBase64(content: string): string {
  const bytes = new TextEncoder().encode(`\uFEFF${content}`);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}