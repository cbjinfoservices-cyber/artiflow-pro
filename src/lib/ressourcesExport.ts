import { articles, readingMinutes, type Article } from "@/mocks/ressources";
import { metiers } from "@/mocks/metiers";
import { getStatut } from "@/lib/lecture";
import { listerNotes } from "@/lib/bibliotheque";
import { toCsv, downloadCsv } from "@/lib/csv";

const STATUT_LABEL: Record<string, string> = {
  lu: "Lu",
  "en-cours": "En cours",
  "a-lire": "À lire",
};

/** Poids de tri de lecture (lu en premier) pour l'export du suivi. */
const STATUT_POIDS: Record<string, number> = { lu: 0, "en-cours": 1, "a-lire": 2 };

function statutLabel(slug: string): string {
  return STATUT_LABEL[getStatut(slug)] ?? "À lire";
}

function metierNom(category: string): string {
  return metiers.find((m) => m.slug === category)?.name ?? "Artisan";
}

/**
 * Exporte la liste affichée (résultat courant de la recherche, du filtre et du tri)
 * en CSV : titre, métier, temps de lecture, date, statut de lecture et lien.
 */
export function exportGuidesCsv(list: Article[], filename: string): void {
  const headers = ["Titre", "Métier", "Temps de lecture (min)", "Date de parution", "Statut de lecture", "Lien"];
  const rows = list.map((article) => [
    article.title,
    metierNom(article.category),
    readingMinutes(article),
    article.date,
    statutLabel(article.slug),
    `/ressources/${article.slug}`,
  ]);
  downloadCsv(filename, toCsv(headers, rows));
}

/**
 * Exporte l'intégralité du suivi de lecture : tous les guides du catalogue avec leur
 * statut (lu, en cours, à lire), triés du plus avancé au moins avancé.
 */
export function exportSuiviLectureCsv(): void {
  const headers = ["Titre", "Métier", "Temps de lecture (min)", "Statut de lecture", "Date de parution", "Lien"];
  const rows = [...articles]
    .sort((a, b) => {
      const ecart = (STATUT_POIDS[getStatut(a.slug)] ?? 2) - (STATUT_POIDS[getStatut(b.slug)] ?? 2);
      if (ecart !== 0) return ecart;
      return a.title.localeCompare(b.title, "fr");
    })
    .map((article) => [
      article.title,
      metierNom(article.category),
      readingMinutes(article),
      statutLabel(article.slug),
      article.date,
      `/ressources/${article.slug}`,
    ]);
  downloadCsv("artiflow-suivi-lecture.csv", toCsv(headers, rows));
}

/**
 * Exporte les notes personnelles enregistrées sur les guides : titre, métier,
 * le texte de la note, le statut de lecture et le lien. Seuls les guides
 * effectivement annotés apparaissent, triés alphabétiquement.
 */
export function exportNotesCsv(): void {
  const headers = ["Titre", "Métier", "Ma note", "Statut de lecture", "Lien"];
  const rows = listerNotes()
    .map(({ slug, texte }) => {
      const article = articles.find((a) => a.slug === slug);
      if (!article) return null;
      return [
        article.title,
        metierNom(article.category),
        texte,
        statutLabel(slug),
        `/ressources/${slug}`,
      ] as (string | number)[];
    })
    .filter((row): row is (string | number)[] => row !== null)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]), "fr"));
  downloadCsv("artiflow-notes-personnelles.csv", toCsv(headers, rows));
}