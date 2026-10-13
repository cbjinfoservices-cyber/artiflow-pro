import type { LienAuthTestEntree, TypeLienAuth } from "@/lib/liensAuthTestsMemoire";
import type { FenetreRegularite, SemaineRegularite, TendanceSemaine } from "@/lib/regulariteLiensAuth";
import { libelleFenetre, tendanceEssai } from "@/lib/regulariteLiensAuth";
import { toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";

/** Libellé lisible d'un type de lien d'authentification. */
function libelleType(t: TypeLienAuth): string {
  return t === "reset" ? "Réinitialisation" : "Connexion";
}

/** Date + heure courte (« jj/mm/aaaa hh:mm ») d'un horodatage ISO. */
function dateHeure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Date longue (« jj/mm/aaaa ») d'un horodatage en millisecondes. */
function dateLongue(ms: number): string {
  return new Date(ms).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Suffixe de nom de fichier d'un périmètre : « -sN » (semaine cliquée) ou « -<fenêtre> ». */
function suffixePerimetre(semaine: SemaineRegularite | null, fenetre: FenetreRegularite): string {
  return semaine ? `-s${semaine.semainesAgo}` : `-${fenetre}`;
}

/** Contexte textuel d'un périmètre (« Semaine du … au … » ou le libellé de la fenêtre). */
function contextePerimetre(semaine: SemaineRegularite | null, fenetre: FenetreRegularite): string {
  if (semaine) {
    return `Semaine du ${dateLongue(semaine.debut)} au ${dateLongue(semaine.fin)}`;
  }
  return libelleFenetre(fenetre);
}

/** Options du récap texte copiable du filtre courant. */
export interface RecapLiensAuthOptions {
  /** Essais du périmètre courant (semaine cliquée + type sélectionné). */
  entrees: LienAuthTestEntree[];
  /** Semaine cliquée, ou null si aucun filtre de semaine n'est actif. */
  semaine: SemaineRegularite | null;
  /** Fenêtre affichée par le graphique (tous / 30 jours / 6 semaines). */
  fenetre: FenetreRegularite;
  /** Libellé du type sélectionné (« Tous », « Connexion », « Réinitialisation »). */
  libelleFiltreType: string;
  /** Adresse email isolée par le filtre par adresse, ou null si aucune adresse n'est isolée. */
  adresse?: string | null;
  /** Commentaire libre rattaché à l'adresse isolée, repris dans le récap le cas échéant. */
  commentaire?: string | null;
  /**
   * Tendance du périmètre courant (filtre de tendance actif, sinon tendance de la fenêtre),
   * reprise telle quelle du bandeau à l'écran pour que le récap copié y soit identique.
   */
  tendance?: TendanceSemaine | null;
}

/** Libellé lisible d'une tendance de périmètre (« en hausse », « en baisse », « stable »). */
function libelleTendancePerimetre(tendance: TendanceSemaine | null | undefined): string {
  if (tendance === "hausse") return "en hausse";
  if (tendance === "baisse") return "en baisse";
  return "stable";
}

/**
 * Construit un récap texte du filtre courant (semaine cliquée + type), prêt à être collé dans un
 * ticket ou un message : contexte de la fenêtre, répartition par type, puis la liste des essais du
 * plus récent au plus ancien. La liste n'est pas limitée à l'affichage à l'écran.
 */
export function construireRecapLiensAuth({
  entrees,
  semaine,
  fenetre,
  libelleFiltreType,
  adresse = null,
  commentaire = null,
  tendance = null,
}: RecapLiensAuthOptions): string {
  const lignes: string[] = [];
  lignes.push("Récap — Régularité des liens d'authentification");
  const filtreTxt = adresse ? `${libelleFiltreType} · adresse : ${adresse}` : libelleFiltreType;
  lignes.push(`${contextePerimetre(semaine, fenetre)} · filtre : ${filtreTxt}`);
  if (commentaire && commentaire.trim()) {
    lignes.push(`Commentaire : ${commentaire.trim()}`);
  }

  const connexion = entrees.filter((e) => e.type === "connexion").length;
  const reset = entrees.filter((e) => e.type === "reset").length;
  lignes.push(
    `Total du périmètre courant : ${entrees.length} essai${entrees.length > 1 ? "s" : ""} — connexion : ${connexion} · réinitialisation : ${reset} · tendance : ${libelleTendancePerimetre(tendance)}`,
  );

  if (entrees.length === 0) {
    lignes.push("");
    lignes.push("Aucun essai sur ce périmètre.");
    return lignes.join("\n");
  }

  lignes.push("");
  const triees = [...entrees].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  triees.forEach((e) => {
    lignes.push(`• ${libelleType(e.type)} — ${e.email} — ${dateHeure(e.created_at)}`);
  });
  return lignes.join("\n");
}

/** Résultat d'un CSV d'essais : contenu, nom de fichier et nombre de lignes de données. */
export interface CsvLiensAuth {
  contenu: string;
  nomFichier: string;
  lignes: number;
}

/** Commentaire mémorisé pour une adresse (chaîne vide si aucun), pour la colonne CSV dédiée. */
function commentairePour(commentaires: Record<string, string>, email: string): string {
  return commentaires[email.trim().toLowerCase()] ?? "";
}

/** Libellé de la colonne « Tendance » du CSV (variation de la semaine vs la précédente). */
function libelleTendance(tendance: TendanceSemaine | null): string {
  if (tendance === "hausse") return "Hausse";
  if (tendance === "baisse") return "Baisse";
  if (tendance === "stable") return "Stable";
  return "—";
}

/**
 * Construit le CSV des essais du filtre courant (type + horodatage par ligne), avec un en-tête de
 * contexte (périmètre + filtre) en tête de fichier pour tracer la sélection à l'intérieur du CSV.
 * Une colonne « Commentaire » reprend le commentaire libre rattaché à l'adresse de chaque ligne.
 */
export function construireCsvLiensAuth(
  entrees: LienAuthTestEntree[],
  semaine: SemaineRegularite | null,
  fenetre: FenetreRegularite,
  libelleFiltreType: string,
  adresse: string | null = null,
  commentaires: Record<string, string> = {},
  semaines: SemaineRegularite[] = [],
): CsvLiensAuth {
  const triees = [...entrees].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const rows = triees.map((e) => [
    libelleType(e.type),
    e.email,
    dateHeure(e.created_at),
    libelleTendance(tendanceEssai(semaines, e)),
    commentairePour(commentaires, e.email),
  ]);
  let contenu = toCsv(["Type", "Email", "Horodatage", "Tendance", "Commentaire"], rows);
  const filtreCsv = adresse
    ? `${libelleFiltreType} · adresse : ${adresse}`.replace(/"/g, '""')
    : libelleFiltreType.replace(/"/g, '""');
  const blocContexte = [
    `"${contextePerimetre(semaine, fenetre).replace(/"/g, '""')}"`,
    `"Filtre : ${filtreCsv}"`,
    `"Total du périmètre courant : ${entrees.length} essai${entrees.length > 1 ? "s" : ""}"`,
    `"Tendance : variation des essais de la semaine vs la semaine précédente"`,
  ].join("\r\n");
  contenu = `${blocContexte}\r\n${contenu}`;
  return {
    contenu,
    nomFichier: `essais-liens-auth${suffixePerimetre(semaine, fenetre)}-${todayISO()}.csv`,
    lignes: rows.length + 1,
  };
}

/** Nom de l'archive ZIP d'un export combiné (CSV + PNG) du périmètre courant. */
export function nomFichierZipLiensAuth(
  semaine: SemaineRegularite | null,
  fenetre: FenetreRegularite,
  dateISO: string = todayISO(),
): string {
  return `regularite-liens-auth${suffixePerimetre(semaine, fenetre)}-${dateISO}.zip`;
}

/** Transforme une adresse email en segment de nom de fichier sûr (minuscules, tirets). */
export function slugAdresse(email: string): string {
  const slug = email
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "adresse";
}

/** En-tête de contexte du CSV d'export dédié à une adresse isolée. */
function contexteCsvAdresse(email: string, nb: number): string {
  const propre = email.replace(/"/g, '""');
  return [
    `"Export dédié à l'adresse : ${propre}"`,
    `"${nb} essai${nb > 1 ? "s" : ""} — toutes fenêtres et tous types confondus"`,
  ].join("\r\n");
}

/**
 * Construit le CSV de TOUS les essais visant une adresse donnée, indépendamment de la fenêtre ou du
 * filtre de type affichés : un fichier dédié à l'adresse isolée, du plus récent au plus ancien.
 * L'en-tête de contexte rappelle l'adresse et le nombre d'essais couverts.
 */
export function construireCsvAdresse(
  entrees: LienAuthTestEntree[],
  email: string,
  commentaires: Record<string, string> = {},
): CsvLiensAuth {
  const duAdresse = entrees.filter((e) => e.email.toLowerCase() === email.toLowerCase());
  const triees = [...duAdresse].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const rows = triees.map((e) => [
    libelleType(e.type),
    e.email,
    dateHeure(e.created_at),
    commentairePour(commentaires, e.email),
  ]);
  const contenu = `${contexteCsvAdresse(email, triees.length)}\r\n${toCsv(
    ["Type", "Email", "Horodatage", "Commentaire"],
    rows,
  )}`;
  return {
    contenu,
    nomFichier: `essais-liens-auth-${slugAdresse(email)}-${todayISO()}.csv`,
    lignes: rows.length + 1,
  };
}

/** Nom de l'archive ZIP de l'export dédié à une adresse isolée (CSV + PNG). */
export function nomFichierZipAdresse(email: string, dateISO: string = todayISO()): string {
  return `regularite-liens-auth-${slugAdresse(email)}-${dateISO}.zip`;
}

/** En-tête de contexte du CSV d'historique complet (indépendant de toute fenêtre ou filtre). */
const CONTEXTE_CSV_COMPLET = [
  '"Historique complet des essais — liens d\'authentification"',
  '"Toutes fenêtres confondues · tous types"',
].join("\r\n");

/**
 * Construit le CSV de TOUT l'historique des essais, sans tenir compte de la fenêtre ni du filtre
 * appliqués à l'écran : un seul fichier regroupant tous les essais, du plus récent au plus ancien.
 * L'en-tête de contexte rappelle que l'export couvre l'historique complet.
 */
export function construireCsvHistoriqueComplet(
  entrees: LienAuthTestEntree[],
  commentaires: Record<string, string> = {},
): CsvLiensAuth {
  const triees = [...entrees].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const rows = triees.map((e) => [
    libelleType(e.type),
    e.email,
    dateHeure(e.created_at),
    commentairePour(commentaires, e.email),
  ]);
  const contenu = `${CONTEXTE_CSV_COMPLET}\r\n${toCsv(["Type", "Email", "Horodatage", "Commentaire"], rows)}`;
  return {
    contenu,
    nomFichier: `historique-liens-auth-complet-${todayISO()}.csv`,
    lignes: rows.length + 1,
  };
}