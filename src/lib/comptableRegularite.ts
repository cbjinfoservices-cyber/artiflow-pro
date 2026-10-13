import type { ComptableEnvoi } from "@/lib/artisanApi";

/** Clé « AAAA-MM » à partir d'une date ISO, ou null si la date est invalide. */
export function moisCleFromISO(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Libellé long d'un mois (« Septembre 2026 ») à partir d'une clé « AAAA-MM ». */
export function moisLabelLong(cle: string): string {
  const [y, m] = cle.split("-").map(Number);
  if (!y || !m) return cle;
  const s = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Liste des mois attendus restés sans envoi automatique du journal comptable — les
 * « trous » de régularité. On part du premier envoi automatique (exclu) et on compte
 * chaque mois écoulé (hors mois en cours) qui n'a reçu aucun envoi automatique.
 * Les récaps de régularité sont ignorés : ce ne sont pas des envois de journal.
 */
export function computeMoisManquants(historique: ComptableEnvoi[]): string[] {
  const autoMonths = new Set<string>();
  let premier: string | null = null;
  historique.forEach((env) => {
    if (env.recap) return;
    if ((env.mode ?? "").toLowerCase() !== "automatique") return;
    const cle = moisCleFromISO(env.envoye_le);
    if (!cle) return;
    autoMonths.add(cle);
    if (premier === null || cle < premier) premier = cle;
  });
  if (premier === null) return [];

  const [fy, fm] = premier.split("-").map(Number);
  const now = new Date();
  const cleCourante = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const out: string[] = [];
  let y = fy;
  let m = fm + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  while (true) {
    const cle = `${y}-${String(m).padStart(2, "0")}`;
    if (cle >= cleCourante) break;
    if (!autoMonths.has(cle)) out.push(cle);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/**
 * Regroupe des lignes mensuelles par année, avec un sous-total annuel pour chaque
 * colonne numérique. Utile aux archives longues de mois manquants : on insère une
 * ligne d'entête « Année AAAA », on liste les mois, puis on ferme par un
 * « Sous-total AAAA ». `cellFn` renvoie les cellules d'un mois à partir de la 2e
 * colonne (la 1re colonne, le libellé du mois, est ajoutée ici).
 */
export function buildManquantsGroupedRows<T extends { cle: string }>(
  data: T[],
  moisLabelFn: (cle: string) => string,
  cellFn: (item: T) => (string | number)[],
): (string | number)[][] {
  const sorted = [...data].sort((a, b) => a.cle.localeCompare(b.cle));
  const annees: string[] = [];
  sorted.forEach((d) => {
    const an = d.cle.slice(0, 4);
    if (an && !annees.includes(an)) annees.push(an);
  });

  const nCols = sorted.length ? cellFn(sorted[0]).length : 0;
  const rows: (string | number)[][] = [];
  annees.forEach((an) => {
    const mois = sorted.filter((d) => d.cle.slice(0, 4) === an);
    rows.push([`Année ${an}`, ...Array.from({ length: nCols }, () => "")]);
    const totaux = Array.from({ length: nCols }, () => 0);
    const hasNum = Array.from({ length: nCols }, () => false);
    mois.forEach((d) => {
      const cells = cellFn(d);
      cells.forEach((c, i) => {
        if (typeof c === "number") {
          totaux[i] += c;
          hasNum[i] = true;
        }
      });
      rows.push([moisLabelFn(d.cle), ...cells]);
    });
    rows.push([`Sous-total ${an}`, ...totaux.map((v, i) => (hasNum[i] ? v : ""))]);
  });

  // Total toutes années confondues : chiffre global d'archivage en clôture du tableau.
  if (annees.length > 0) {
    const grand = Array.from({ length: nCols }, () => 0);
    const hasGrand = Array.from({ length: nCols }, () => false);
    sorted.forEach((d) => {
      cellFn(d).forEach((c, i) => {
        if (typeof c === "number") {
          grand[i] += c;
          hasGrand[i] = true;
        }
      });
    });
    const label = annees.length > 1 ? "Total (toutes années)" : `Total ${annees[0]}`;
    rows.push([label, ...grand.map((v, i) => (hasGrand[i] ? v : ""))]);
  }

  return rows;
}

/**
 * Regroupe des lignes arbitraires par année, avec un sous-total annuel pour chaque
 * colonne numérique et un total toutes années confondues en clôture. Même esprit que
 * `buildManquantsGroupedRows`, mais pour des éléments quelconques : l'année, le libellé
 * de la 1re colonne et les autres cellules sont fournis via des accesseurs. Utile pour
 * archiver un long historique d'envois regroupé par exercice.
 */
export function groupRowsByYear<T>(
  items: T[],
  yearOf: (item: T) => string,
  labelOf: (item: T) => string,
  cellsOf: (item: T) => (string | number)[],
): (string | number)[][] {
  const annees = Array.from(new Set(items.map(yearOf).filter(Boolean))).sort();
  const nCols = items.length ? cellsOf(items[0]).length : 0;
  const emptyCols = Array.from({ length: nCols }, () => "");
  const rows: (string | number)[][] = [];

  annees.forEach((an) => {
    const elems = items.filter((it) => yearOf(it) === an);
    rows.push([`Année ${an}`, ...emptyCols]);
    const totaux = Array.from({ length: nCols }, () => 0);
    const hasNum = Array.from({ length: nCols }, () => false);
    elems.forEach((it) => {
      const cells = cellsOf(it);
      cells.forEach((c, i) => {
        if (typeof c === "number") {
          totaux[i] += c;
          hasNum[i] = true;
        }
      });
      rows.push([labelOf(it), ...cells]);
    });
    rows.push([`Sous-total ${an}`, ...totaux.map((v, i) => (hasNum[i] ? v : ""))]);
  });

  if (annees.length > 0) {
    const grand = Array.from({ length: nCols }, () => 0);
    const hasGrand = Array.from({ length: nCols }, () => false);
    items.forEach((it) => {
      cellsOf(it).forEach((c, i) => {
        if (typeof c === "number") {
          grand[i] += c;
          hasGrand[i] = true;
        }
      });
    });
    const label = annees.length > 1 ? "Total (toutes années)" : `Total ${annees[0]}`;
    rows.push([label, ...grand.map((v, i) => (hasGrand[i] ? v : ""))]);
  }

  return rows;
}