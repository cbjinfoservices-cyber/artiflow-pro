import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Récapitulatif HEBDOMADAIRE par email vers les gestionnaires : liste les alertes de
// configuration Stripe (table `alerte_config_stripe`) qui ne sont PAS ENCORE TRAITÉES,
// avec une synthèse par cause (carte / pays / configuration) et le détail des alertes les
// plus anciennes (donc les plus urgentes).
//
// Prévue pour tourner SANS session utilisateur : appelée par une tâche planifiée
// (voir le guide des tâches planifiées), à déclencher CHAQUE HEURE. La fonction revérifie
// elle-même le jour et l'heure (défaut : lundi 08:00, heure de Paris) et son anti-doublon,
// donc un appel horaire ne produit qu'un seul envoi par semaine.
//
// Un appel avec `preview: true` renvoie simplement le HTML de l'email (aucun envoi).
// Un appel avec `force: true` envoie tout de suite, sans tenir compte du jour/heure
// ni de l'anti-doublon (pour un test manuel depuis l'interface).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Compte gestionnaire principal : toujours prévenu, même sans ligne en base. */
const GESTIONNAIRE_PRINCIPAL_EMAIL = "cbj.infoservices@gmail.com";

/** Anti-doublon : pas deux récaps à moins de 6 jours d'intervalle. */
const INTERVALLE_MIN_JOURS = 6;
/** Jour/heure d'envoi par défaut (lundi 08:00, heure de Paris). */
const JOUR_DEFAUT = 1;
const HEURE_DEFAUT = 8;
/** Nombre maximum d'alertes détaillées dans l'email. */
const MAX_DETAIL = 15;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type EnvoiOptions = {
  nom: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string }>;
};

/**
 * Envoie via Brevo, puis bascule automatiquement sur Resend si Brevo échoue.
 * Aucun récapitulatif n'est perdu, même si Brevo est en incident. La tentative est
 * tracée dans `envoi_fournisseur_historique` pour la carte « Suivi des envois ».
 */
async function envoyerEmailAvecRepli(
  fonction: string,
  opts: EnvoiOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<{ ok: boolean; fournisseur: string; repli: boolean; error?: string }> {
  const trace = async (fournisseur: string, statut: string, repli: boolean, message?: string) => {
    if (!admin) return;
    try {
      await admin
        .from("envoi_fournisseur_historique")
        .insert({ fonction, fournisseur, statut, repli, message: message ?? null });
    } catch {
      /* trace non bloquante */
    }
  };
  const brevoKey = ""; // Resend est le canal principal : Brevo n'est plus sollicité.
  const brevoFrom = (Deno.env.get("BREVO_FROM_EMAIL") ?? "").trim() || "contact@artiflow-pro.fr";
  let erreurBrevo = "";
  if (brevoKey) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: opts.nom, email: brevoFrom },
          to: opts.to.map((email) => ({ email })),
          cc: opts.cc?.length ? opts.cc.map((email) => ({ email })) : undefined,
          subject: opts.subject,
          htmlContent: opts.html,
          attachment: opts.attachments?.length
            ? opts.attachments.map((a) => ({ name: a.filename, content: a.content }))
            : undefined,
        }),
      });
      if (res.ok) {
        await trace("brevo", "succes", false);
        return { ok: true, fournisseur: "brevo", repli: false };
      }
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      erreurBrevo = data?.message || `Brevo a refusé l'envoi (code ${res.status}).`;
      await trace("brevo", "echec", false, erreurBrevo);
    } catch (e) {
      erreurBrevo = e instanceof Error ? e.message : "Brevo est injoignable.";
      await trace("brevo", "echec", false, erreurBrevo);
    }
  }
  const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();
  if (resendKey && fromDomain) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${opts.nom} <noreply@${fromDomain}>`,
          to: opts.to,
          cc: opts.cc?.length ? opts.cc : undefined,
          subject: opts.subject,
          html: opts.html,
          attachments: opts.attachments?.length ? opts.attachments : undefined,
        }),
      });
      if (res.ok) {
        await trace("resend", "succes", false);
        return { ok: true, fournisseur: "resend", repli: true };
      }
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      const erreur = data?.message || `Resend a refusé l'envoi (code ${res.status}).`;
      await trace("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    } catch (e) {
      const erreur = e instanceof Error ? e.message : "Resend est injoignable.";
      await trace("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    }
  }
  return { ok: false, fournisseur: "aucun", repli: false, error: erreurBrevo };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function frDateTime(value: unknown): string {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

/** Ancienneté lisible depuis une date (« il y a 3 j », « il y a 5 h »…). */
function anciennete(value: unknown): string {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  if (diff <= 0) return "à l'instant";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "moins d'1 h";
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

/** Heure courante (0-23) à l'heure de Paris. */
function parisHour(): number {
  try {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const h = parts.find((p) => p.type === "hour")?.value;
    if (h !== undefined) return Number(h) % 24;
  } catch {
    /* repli */
  }
  return new Date().getHours();
}

/** Jour de la semaine courant à l'heure de Paris (1 = lundi … 7 = dimanche). */
function parisWeekday(): number {
  try {
    const wd = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date());
    const map: Record<string, number> = { lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6, dim: 7 };
    const key = wd.toLowerCase().replace(".", "").slice(0, 3);
    if (map[key]) return map[key];
  } catch {
    /* repli */
  }
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

/** Rassemble les adresses email des gestionnaires (principal + table gestionnaires). */
async function adressesGestionnaires(admin: Admin): Promise<string[]> {
  const set = new Set<string>();
  set.add(GESTIONNAIRE_PRINCIPAL_EMAIL);
  try {
    const { data } = await admin.from("gestionnaires").select("email");
    (data ?? []).forEach((row: { email?: string }) => {
      const email = String(row?.email ?? "").trim();
      if (email) set.add(email);
    });
  } catch {
    /* best-effort : on garde au minimum le gestionnaire principal */
  }
  return Array.from(set);
}

/** Une alerte de configuration Stripe encore non traitée. */
interface AlerteNonTraitee {
  id: number;
  motif: "pays" | "carte" | "";
  pays: string;
  created_at: string;
}

/** Répartition des alertes pour une cause donnée. */
interface GroupeCause {
  cle: "carte" | "pays" | "configuration";
  label: string;
  count: number;
}

/** Libellé lisible d'une cause d'alerte. */
function libelleCause(motif: string): string {
  if (motif === "carte") return "Carte non activée";
  if (motif === "pays") return "Pays / devise non supporté";
  return "Configuration incomplète";
}

/** Classe un motif dans l'une des causes de synthèse. */
function cleCause(motif: string): "carte" | "pays" | "configuration" {
  if (motif === "carte") return "carte";
  if (motif === "pays") return "pays";
  return "configuration";
}

/** Regroupe les alertes par cause, de la plus fréquente à la moins fréquente. */
function grouperParCause(alertes: AlerteNonTraitee[]): GroupeCause[] {
  const map = new Map<string, GroupeCause>();
  alertes.forEach((a) => {
    const cle = cleCause(a.motif);
    const cur = map.get(cle);
    if (cur) {
      cur.count += 1;
    } else {
      map.set(cle, { cle, label: libelleCause(a.motif), count: 1 });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Archive PDF des suppressions en attente, jointe automatiquement au récap
// ---------------------------------------------------------------------------

interface SuppressionRow {
  id: number;
  email: string | null;
  entreprise: string | null;
  demandee_le: string;
  prevue_le: string;
  details: Record<string, unknown> | null;
}

type RGB = [number, number, number];

const PDF_INK: RGB = [38, 36, 33];
const PDF_MUTED: RGB = [122, 116, 110];
const PDF_LINE: RGB = [228, 224, 218];
const PDF_ACCENT: RGB = [182, 108, 48];
const PDF_RED: RGB = [176, 58, 58];

/** Correspondance WinAnsi des caractères accentués utilisés dans les libellés FR. */
const WIN_ANSI: Record<string, number> = {
  "é": 233, "è": 232, "ê": 234, "ë": 235, "à": 224, "â": 226, "ä": 228,
  "ç": 231, "ù": 249, "û": 251, "ü": 252, "ô": 244, "ö": 246, "î": 238, "ï": 239,
  "É": 201, "È": 200, "Ê": 202, "À": 192, "Ç": 199, "Ô": 212, "Ù": 217, "Î": 206,
  "Œ": 140, "œ": 156, "«": 171, "»": 187, "’": 146, "—": 151, "·": 183, "€": 128, "…": 133,
};

function pdfCharCode(ch: string): number {
  const connu = WIN_ANSI[ch];
  if (typeof connu === "number") return connu;
  const code = ch.codePointAt(0) ?? 32;
  return code <= 255 ? code : 63;
}

/** Échappe une chaîne pour un littéral PDF (WinAnsi, octal pour les accents). */
function pdfString(value: string): string {
  let out = "";
  for (const ch of value) {
    if (ch === "(" || ch === ")" || ch === "\\") {
      out += `\\${ch}`;
      continue;
    }
    const code = pdfCharCode(ch);
    if (code >= 32 && code <= 126) out += ch;
    else out += `\\${code.toString(8).padStart(3, "0")}`;
  }
  return out;
}

function pdfDateFr(value: unknown): string {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function pdfDateHeureFr(value: Date): string {
  return `${value.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} à ${value.toLocaleTimeString(
    "fr-FR",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

function dateMarqueurPdf(details: Record<string, unknown> | null, cle: string): string {
  const valeur = details?.[cle];
  return typeof valeur === "string" ? pdfDateFr(valeur) : "";
}

function joursRestantsPdf(prevueLe: string): number {
  const cible = new Date(prevueLe).getTime();
  if (Number.isNaN(cible)) return 0;
  return Math.max(0, Math.ceil((cible - Date.now()) / (24 * 60 * 60 * 1000)));
}

function couperTexte(value: string, maxCaracteres: number): string {
  if (value.length <= maxCaracteres) return value;
  return `${value.slice(0, Math.max(0, maxCaracteres - 1))}…`;
}

/** Nombre de relances manuelles consignées (compteur, avec repli sur la date). */
function nbRelancesPdf(details: Record<string, unknown> | null): number {
  const valeur = Number(details?.relances_manuelles);
  if (Number.isFinite(valeur) && valeur > 0) return Math.floor(valeur);
  return typeof details?.relance_manuelle_le === "string" ? 1 : 0;
}

/** Motif de relance consigné par le gestionnaire (chaîne vide si aucun). */
function motifRelancePdf(details: Record<string, unknown> | null): string {
  const valeur = details?.relance_motif;
  return typeof valeur === "string" ? valeur.trim() : "";
}

/** Vrai si le gestionnaire a déjà joint l'artisan par téléphone. */
function dejaAppelePdf(details: Record<string, unknown> | null): boolean {
  return typeof details?.appele_le === "string";
}

/** Vrai si le dernier appel est resté sans réponse : l'artisan reste à rappeler. */
function dernierAppelSansReponsePdf(details: Record<string, unknown> | null): boolean {
  return details?.appel_resultat === "ne_repond_pas";
}

/** Vrai si l'artisan a confirmé au téléphone vouloir partir (à traiter en priorité). */
function veutPartirPdf(details: Record<string, unknown> | null): boolean {
  return details?.appel_resultat === "veut_partir";
}

/** Nombre de tentatives d'appel consignées, avec repli sur le simple marquage. */
function nbTentativesPdf(details: Record<string, unknown> | null): number {
  const tentatives = historiqueAppelsPdf(details).length;
  if (tentatives > 0) return tentatives;
  return dejaAppelePdf(details) ? 1 : 0;
}

/**
 * Vrai s'il reste un appel à passer : deux relances minimum et jamais réellement joint.
 * Un appel « ne répond pas » ne sort pas de la liste : il faut retenter.
 */
function aAppelerPdf(details: Record<string, unknown> | null): boolean {
  if (nbRelancesPdf(details) < 2) return false;
  return !dejaAppelePdf(details) || dernierAppelSansReponsePdf(details);
}

/** Résultats d'appel reconnus, avec leur libellé court. */
const RESULTATS_APPEL_PDF: Record<string, string> = {
  joint: "Joint",
  ne_repond_pas: "Ne répond pas",
  veut_partir: "Veut partir",
};

/** Libellé court du résultat d'appel (chaîne vide si absent). */
function libelleResultatAppelPdf(resultat: unknown): string {
  return typeof resultat === "string" ? RESULTATS_APPEL_PDF[resultat] ?? "" : "";
}

/** Une entrée de l'historique des appels consignés. */
interface AppelPdf {
  le: string;
  resultat: string;
  note: string;
}

/**
 * Historique des appels téléphoniques consignés (les 8 derniers).
 * Pour les demandes plus anciennes qui n'ont qu'une date d'appel, on retombe sur
 * cette entrée unique afin de ne rien perdre de la trace.
 */
function historiqueAppelsPdf(details: Record<string, unknown> | null): AppelPdf[] {
  const brut = details?.appels_historique;
  const entrees = Array.isArray(brut) ? brut : [];
  const liste: AppelPdf[] = [];
  entrees.forEach((entree) => {
    if (!entree || typeof entree !== "object") return;
    const objet = entree as { le?: unknown; resultat?: unknown; note?: unknown };
    const le = typeof objet.le === "string" ? objet.le : "";
    if (!le || Number.isNaN(new Date(le).getTime())) return;
    liste.push({
      le,
      resultat: typeof objet.resultat === "string" ? objet.resultat : "",
      note: typeof objet.note === "string" ? objet.note.trim() : "",
    });
  });
  if (liste.length === 0 && typeof details?.appele_le === "string") {
    liste.push({
      le: String(details.appele_le),
      resultat: typeof details?.appel_resultat === "string" ? String(details.appel_resultat) : "",
      note: typeof details?.appel_note === "string" ? String(details.appel_note).trim() : "",
    });
  }
  return liste;
}

/** Bilan des appels téléphoniques de la semaine calendaire en cours (depuis lundi 00:00, heure de Paris). */
interface BilanAppelsSemaine {
  appels: number;
  joints: number;
  sansReponse: number;
  veutPartir: number;
  /** Demandes dont le dernier appel est sans réponse depuis plus de 48 h. */
  suivisDus: number;
  /** Rappels de suivi clos par un gestionnaire depuis lundi 00:00 (sans email). */
  suivisClos: number;
}

/** Minuit (heure de Paris) du lundi de la semaine en cours, en millisecondes UTC. */
function debutSemaineParisMs(): number {
  const now = new Date();
  let paris: Date;
  try {
    paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  } catch {
    paris = new Date(now.getTime());
  }
  const decalage = (paris.getDay() + 6) % 7;
  const debut = new Date(paris.getTime());
  debut.setDate(paris.getDate() - decalage);
  debut.setHours(0, 0, 0, 0);
  // `paris` correspond à l'heure locale de Paris relue comme de l'UTC : on retire le décalage.
  const offset = paris.getTime() - now.getTime();
  return debut.getTime() - offset;
}

/** Date du dernier appel consigné (chaîne vide si aucun). */
function dateDernierAppelPdf(details: Record<string, unknown> | null): string {
  let derniere = "";
  let derniereMs = 0;
  historiqueAppelsPdf(details).forEach((appel) => {
    const ms = new Date(appel.le).getTime();
    if (!Number.isNaN(ms) && ms > derniereMs) {
      derniereMs = ms;
      derniere = appel.le;
    }
  });
  return derniere;
}

/** Seuil par défaut du rappel de suivi (heures) quand le réglage n'est pas lisible. */
const SEUIL_SUIVI_DEFAUT = 48;

/** Seuils acceptés par le back-office : 24 / 48 / 72 h. */
const SEUILS_SUIVI = [24, 48, 72];

/** Ramène un seuil lu en base à l'une des valeurs proposées (48 h par défaut). */
function normaliserSeuilSuivi(valeur: unknown): number {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return SEUIL_SUIVI_DEFAUT;
  const arrondi = Math.round(n);
  if (SEUILS_SUIVI.includes(arrondi)) return arrondi;
  return SEUILS_SUIVI.reduce((best, option) =>
    Math.abs(option - arrondi) < Math.abs(best - arrondi) ? option : best,
  );
}

/** Note interne du dernier appel consigné (chaîne vide s'il n'y en a pas). */
function noteDernierAppelPdf(details: Record<string, unknown> | null): string {
  const liste = historiqueAppelsPdf(details);
  if (liste.length === 0) return "";
  const le = dateDernierAppelPdf(details);
  const dernier = liste.find((appel) => appel.le === le) ?? liste[liste.length - 1];
  return dernier?.note ?? "";
}

/** Vrai si l'appel est resté sans réponse depuis plus que le seuil réglé (rappel de suivi dû). */
function suiviAppelDuPdf(
  details: Record<string, unknown> | null,
  seuilHeures: number = SEUIL_SUIVI_DEFAUT,
): boolean {
  if (details?.appel_resultat !== "ne_repond_pas") return false;
  const le = dateDernierAppelPdf(details);
  if (!le) return false;
  const ms = new Date(le).getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms >= seuilHeures * 3_600_000;
}

/** Nombre de jours écoulés depuis le dernier appel consigné (0 si illisible). */
function joursDepuisDernierAppelPdf(details: Record<string, unknown> | null): number {
  const le = dateDernierAppelPdf(details);
  if (!le) return 0;
  const ms = new Date(le).getTime();
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
}

/** Vrai si le rappel de suivi a été clos depuis lundi 00:00 (heure de Paris). */
function suiviClosCetteSemainePdf(details: Record<string, unknown> | null): boolean {
  const valeur = details?.suivi_valide_le;
  if (typeof valeur !== "string") return false;
  const ms = new Date(valeur).getTime();
  if (Number.isNaN(ms)) return false;
  return ms >= debutSemaineParisMs();
}

/** Agrège les appels de la semaine depuis lundi 00:00 (heure de Paris), toutes demandes confondues. */
function bilanAppelsSemaine(rows: SuppressionRow[], seuilSuivi: number = SEUIL_SUIVI_DEFAUT): BilanAppelsSemaine {
  const debut = debutSemaineParisMs();
  const bilan: BilanAppelsSemaine = {
    appels: 0,
    joints: 0,
    sansReponse: 0,
    veutPartir: 0,
    suivisDus: 0,
    suivisClos: 0,
  };
  rows.forEach((row) => {
    historiqueAppelsPdf(row.details).forEach((appel) => {
      const ms = new Date(appel.le).getTime();
      if (Number.isNaN(ms) || ms < debut) return;
      bilan.appels += 1;
      if (appel.resultat === "joint") bilan.joints += 1;
      else if (appel.resultat === "ne_repond_pas") bilan.sansReponse += 1;
      else if (appel.resultat === "veut_partir") bilan.veutPartir += 1;
    });
    if (suiviAppelDuPdf(row.details, seuilSuivi)) bilan.suivisDus += 1;
    if (suiviClosCetteSemainePdf(row.details)) bilan.suivisClos += 1;
  });
  return bilan;
}

/** Découpe un texte en lignes d'au plus `max` caractères (coupure sur les espaces). */
function decouperLignesPdf(texte: string, max: number): string[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let courante = "";
  mots.forEach((mot) => {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (essai.length > max && courante) {
      lignes.push(courante);
      courante = mot;
    } else {
      courante = essai;
    }
  });
  if (courante) lignes.push(courante);
  return lignes;
}

/** Générateur PDF minimal (Helvetica, A4) : aucun accent perdu grâce à l'encodage WinAnsi. */
class SimplePdf {
  private pages: string[][] = [[]];

  readonly width = 595.28;

  readonly height = 841.89;

  private static couleur(c: RGB, contour: boolean): string {
    const valeurs = `${(c[0] / 255).toFixed(3)} ${(c[1] / 255).toFixed(3)} ${(c[2] / 255).toFixed(3)}`;
    return `${valeurs} ${contour ? "RG" : "rg"}`;
  }

  private textOp(
    x: number,
    y: number,
    size: number,
    value: string,
    opts: { bold?: boolean; color?: RGB } = {},
  ): string {
    const font = opts.bold ? "F2" : "F1";
    const c = opts.color ?? PDF_INK;
    return `BT ${SimplePdf.couleur(c, false)} /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(
      this.height - y
    ).toFixed(2)} Tm (${pdfString(value)}) Tj ET`;
  }

  private push(op: string): void {
    this.pages[this.pages.length - 1].push(op);
  }

  newPage(): void {
    this.pages.push([]);
  }

  text(x: number, y: number, size: number, value: string, opts: { bold?: boolean; color?: RGB } = {}): void {
    this.push(this.textOp(x, y, size, value, opts));
  }

  line(x1: number, y1: number, x2: number, y2: number, width = 0.7, color: RGB = PDF_LINE): void {
    this.push(
      `${SimplePdf.couleur(color, true)} ${width} w ${x1.toFixed(2)} ${(this.height - y1).toFixed(2)} m ${x2.toFixed(
        2,
      )} ${(this.height - y2).toFixed(2)} l S`,
    );
  }

  rect(x: number, y: number, w: number, h: number, color: RGB): void {
    this.push(
      `${SimplePdf.couleur(color, false)} ${x.toFixed(2)} ${(this.height - y - h).toFixed(2)} ${w.toFixed(
        2,
      )} ${h.toFixed(2)} re f`,
    );
  }

  /** Ajoute la mention de pied de page et la pagination sur toutes les pages. */
  stampFooter(left: string): void {
    const total = this.pages.length;
    this.pages = this.pages.map((ops, i) => [
      ...ops,
      `${SimplePdf.couleur(PDF_LINE, true)} 0.7 w 40.00 ${(this.height - 800).toFixed(2)} m 555.28 ${(
        this.height - 800
      ).toFixed(2)} l S`,
      this.textOp(40, 814, 8, left, { color: PDF_MUTED }),
      this.textOp(555.28 - `Page ${i + 1} / ${total}`.length * 4, 814, 8, `Page ${i + 1} / ${total}`, {
        color: PDF_MUTED,
      }),
    ]);
  }

  toBase64(): string {
    const objects: string[] = [];
    const total = this.pages.length;
    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push(
      `<< /Type /Pages /Kids [${this.pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ")}] /Count ${total} >>`,
    );
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    this.pages.forEach((ops, i) => {
      const content = ops.join("\n");
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(
          2,
        )}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`,
      );
      objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach((offset) => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

    return btoa(pdf);
  }
}

const COLONNES_PDF = [
  { label: "Entreprise", x: 0, w: 74, right: false },
  { label: "Email", x: 74, w: 134, right: false },
  { label: "Demande", x: 208, w: 44, right: false },
  { label: "Échéance", x: 252, w: 44, right: false },
  { label: "Reste", x: 296, w: 22, right: true },
  { label: "Rappel J-7", x: 318, w: 50, right: false },
  { label: "Rappel J-1", x: 368, w: 50, right: false },
  { label: "Relance", x: 418, w: 50, right: false },
  { label: "Suivi dû", x: 468, w: 47, right: false },
];

/** Construit l'archive PDF d'audit des demandes de suppression encore annulables. */
function construireArchiveSuppressions(
  rows: SuppressionRow[],
  seuilSuivi: number = SEUIL_SUIVI_DEFAUT,
): {
  base64: string;
  filename: string;
  count: number;
  aAppeler: number;
  suivisDus: number;
} {
  const doc = new SimplePdf();
  const marge = 40;
  const now = new Date();

  doc.rect(0, 0, doc.width, 6, PDF_INK);
  doc.text(marge, 54, 16, "SUPPRESSIONS DE COMPTE EN ATTENTE", { bold: true });
  doc.text(marge, 72, 9, `Archive d'audit · rapport hebdomadaire · éditée le ${pdfDateHeureFr(now)}`, {
    color: PDF_MUTED,
  });
  doc.text(marge, 86, 9, "Sélection : toutes les demandes encore annulables au moment de l'envoi", {
    color: PDF_MUTED,
  });
  doc.text(marge, 98, 9, `Rappel de suivi proposé après ${seuilSuivi} h sans réponse`, {
    color: PDF_MUTED,
  });
  doc.line(marge, 108, 555.28, 108);

  const imminentes = rows.filter((r) => joursRestantsPdf(r.prevue_le) <= 1).length;
  const dansSept = rows.filter((r) => joursRestantsPdf(r.prevue_le) <= 7).length;
  const relances = rows.filter((r) => typeof r.details?.relance_manuelle_le === "string").length;
  const kpis: Array<[string, string]> = [
    ["DEMANDES EN ATTENTE", String(rows.length)],
    ["ÉCHÉANCE ≤ 7 JOURS", String(dansSept)],
    ["ÉCHÉANCE ≤ 1 JOUR", String(imminentes)],
    ["RELANCES MANUELLES", String(relances)],
  ];
  const largeurBloc = (515 - 3 * 10) / 4;
  kpis.forEach(([label, valeur], i) => {
    const bx = marge + i * (largeurBloc + 10);
    doc.rect(bx, 120, largeurBloc, 42, [247, 245, 241]);
    doc.rect(bx, 120, 3, 42, PDF_ACCENT);
    doc.text(bx + 10, 136, 6.5, label, { color: PDF_MUTED, bold: true });
    doc.text(bx + 10, 154, 13, valeur, { bold: true });
  });

  let y = 184;
  const dessinerEntete = (haut: number) => {
    doc.rect(marge, haut, 515, 16, [243, 241, 237]);
    COLONNES_PDF.forEach((col) => {
      const tx = col.right ? marge + col.x + col.w - 4 : marge + col.x + 4;
      doc.text(tx, haut + 11, 6.2, col.label, { bold: true, color: PDF_INK });
    });
  };
  dessinerEntete(y);
  y += 16;

  if (rows.length === 0) {
    doc.text(marge + 4, y + 14, 8, "Aucune suppression en attente : aucun compte en période de grâce.", {
      color: PDF_MUTED,
    });
    y += 26;
  } else {
    rows.forEach((r) => {
      if (y > 770) {
        doc.newPage();
        y = 56;
        dessinerEntete(y);
        y += 16;
      }
      const jours = joursRestantsPdf(r.prevue_le);
      const nbRelances = nbRelancesPdf(r.details);
      const sansReponse = dernierAppelSansReponsePdf(r.details);
      const tentatives = nbTentativesPdf(r.details);
      const cells = [
        r.entreprise || "Non renseignée",
        r.email || "—",
        pdfDateFr(r.demandee_le),
        pdfDateFr(r.prevue_le),
        jours > 0 ? `J-${jours}` : "Jour J",
        dateMarqueurPdf(r.details, "rappel_j7_envoye_le") || "À venir",
        dateMarqueurPdf(r.details, "rappel_j1_envoye_le") || "À venir",
        nbRelances >= 2
          ? sansReponse
            ? `${nbRelances}× · ${tentatives} sans rép.`
            : dejaAppelePdf(r.details)
              ? `${nbRelances}× · appelé`
              : `${nbRelances}× · appeler`
          : dateMarqueurPdf(r.details, "relance_manuelle_le") || "—",
        suiviAppelDuPdf(r.details, seuilSuivi)
          ? `Oui · ${joursDepuisDernierAppelPdf(r.details)} j`
          : "—",
      ];
      // Les demandes déjà relancées au moins deux fois sont surlignées : le signal qu'il
      // faut décrocher le téléphone plutôt que d'envoyer un troisième email.
      if (nbRelances >= 2) {
        doc.rect(marge, y, 515, 16, [250, 240, 226]);
      }
      COLONNES_PDF.forEach((col, i) => {
        const max = Math.max(4, Math.floor(col.w / 3));
        const value = couperTexte(cells[i], max);
        const tx = col.right ? marge + col.x + col.w - 4 - value.length * 3 : marge + col.x + 4;
        const alerte = i === 4 && (value === "J-1" || value === "Jour J");
        const aAppeler = i === 7 && nbRelances >= 2;
        const suiviDu = i === 8 && suiviAppelDuPdf(r.details, seuilSuivi);
        doc.text(
          tx,
          y + 11,
          6,
          value,
          alerte
            ? { bold: true, color: PDF_RED }
            : aAppeler || suiviDu
              ? { bold: true, color: PDF_ACCENT }
              : {},
        );
      });
      doc.line(marge, y + 16, marge + 515, y + 16, 0.4, [238, 235, 230]);
      y += 16;
    });
  }

  const aAppeler = rows.filter((r) => aAppelerPdf(r.details));
  const sansReponse = rows.filter((r) => aAppelerPdf(r.details) && dernierAppelSansReponsePdf(r.details));
  const veulentPartir = rows.filter((r) => veutPartirPdf(r.details));
  const avecMotif = rows.filter((r) => motifRelancePdf(r.details).length > 0);

  y += 20;

  // Callout « à appeler » : les artisans déjà relancés deux fois ne répondent plus aux emails.
  if (aAppeler.length > 0) {
    const noms = aAppeler.map((r) => r.entreprise || r.email || "Demande sans nom").join(", ");
    const lignes = decouperLignesPdf(
      `${aAppeler.length} demande${aAppeler.length > 1 ? "s" : ""} déjà relancée${
        aAppeler.length > 1 ? "s" : ""
      } au moins deux fois et pas encore jointe${
        aAppeler.length > 1 ? "s" : ""
      } au téléphone : ${noms}. Un troisième email a peu de chances d'aboutir — privilégier un appel téléphonique.${
        sansReponse.length > 0
          ? ` Dont ${sansReponse.length} déjà appelée${
              sansReponse.length > 1 ? "s" : ""
            } sans réponse : une nouvelle tentative reste nécessaire.`
          : ""
      }`,
      108,
    ).slice(0, 5);
    const hauteur = 26 + lignes.length * 10;
    if (y + hauteur > 730) {
      doc.newPage();
      y = 60;
    }
    doc.rect(marge, y, 515, hauteur, [250, 240, 226]);
    doc.rect(marge, y, 3, hauteur, PDF_ACCENT);
    doc.text(marge + 12, y + 13, 6.5, "À APPELER PLUTÔT QU'À RELANCER PAR EMAIL", {
      bold: true,
      color: PDF_ACCENT,
    });
    lignes.forEach((ligne, i) => {
      doc.text(marge + 12, y + 26 + i * 10, 7.2, ligne, { color: PDF_INK });
    });
    y += hauteur + 12;
  }

  // Départs confirmés au téléphone : priorité de traitement pour l'équipe.
  if (veulentPartir.length > 0) {
    const noms = veulentPartir.map((r) => r.entreprise || r.email || "Demande sans nom").join(", ");
    const lignes = decouperLignesPdf(
      `${veulentPartir.length} artisan${veulentPartir.length > 1 ? "s ont" : " a"} confirmé vouloir partir lors d'un appel : ${noms}. Le départ peut suivre son cours sans nouvelle relance.`,
      108,
    ).slice(0, 4);
    const hauteur = 26 + lignes.length * 10;
    if (y + hauteur > 730) {
      doc.newPage();
      y = 60;
    }
    doc.rect(marge, y, 515, hauteur, [238, 226, 216]);
    doc.rect(marge, y, 3, hauteur, PDF_ACCENT);
    doc.text(marge + 12, y + 13, 6.5, "DÉPARTS CONFIRMÉS AU TÉLÉPHONE", { bold: true, color: PDF_ACCENT });
    lignes.forEach((ligne, i) => {
      doc.text(marge + 12, y + 26 + i * 10, 7.2, ligne, { color: PDF_INK });
    });
    y += hauteur + 12;
  }

  // Rappels de suivi dus : liste nominative, avec la note du dernier appel.
  const suivisDus = rows.filter((r) => suiviAppelDuPdf(r.details, seuilSuivi));
  if (suivisDus.length > 0) {
    const texteSuivis = suivisDus
      .slice(0, 8)
      .map((r) => {
        const note = noteDernierAppelPdf(r.details);
        const jours = joursDepuisDernierAppelPdf(r.details);
        return `${r.entreprise || r.email || "Demande"} (${jours} j)${
          note ? ` : « ${couperTexte(note, 60)} »` : " : aucune note d'appel"
        }`;
      })
      .join(" · ");
    const suite =
      suivisDus.length > 8
        ? ` (+${suivisDus.length - 8} autre${suivisDus.length - 8 > 1 ? "s" : ""})`
        : "";
    const lignes = decouperLignesPdf(
      `${suivisDus.length} artisan${suivisDus.length > 1 ? "s" : ""} sans réponse depuis plus de ${seuilSuivi} h : ${texteSuivis}${suite}`,
      108,
    ).slice(0, 7);
    const hauteur = 26 + lignes.length * 10;
    if (y + hauteur > 730) {
      doc.newPage();
      y = 60;
    }
    doc.rect(marge, y, 515, hauteur, [250, 240, 226]);
    doc.rect(marge, y, 3, hauteur, PDF_ACCENT);
    doc.text(marge + 12, y + 13, 6.5, "RAPPELS DE SUIVI DUS — NOTE DU DERNIER APPEL", {
      bold: true,
      color: PDF_ACCENT,
    });
    lignes.forEach((ligne, i) => {
      doc.text(marge + 12, y + 26 + i * 10, 7.2, ligne, { color: PDF_INK });
    });
    y += hauteur + 12;
  }

  // Motifs consignés par les gestionnaires : la trace écrite de pourquoi on a relancé.
  if (avecMotif.length > 0) {
    const texteMotifs = avecMotif
      .slice(0, 10)
      .map((r) => `${r.entreprise || r.email || "Demande"} : « ${couperTexte(motifRelancePdf(r.details), 70)} »`)
      .join(" · ");
    const suite =
      avecMotif.length > 10 ? ` (+${avecMotif.length - 10} autre${avecMotif.length - 10 > 1 ? "s" : ""})` : "";
    const lignes = decouperLignesPdf(`${texteMotifs}${suite}`, 118).slice(0, 5);
    const hauteur = 26 + lignes.length * 10;
    if (y + hauteur > 730) {
      doc.newPage();
      y = 60;
    }
    doc.rect(marge, y, 515, hauteur, [247, 245, 241]);
    doc.rect(marge, y, 3, hauteur, [138, 130, 120]);
    doc.text(marge + 12, y + 13, 6.5, "MOTIFS DE RELANCE CONSIGNÉS", { bold: true, color: PDF_MUTED });
    lignes.forEach((ligne, i) => {
      doc.text(marge + 12, y + 26 + i * 10, 7.2, ligne, { color: PDF_INK });
    });
    y += hauteur + 12;
  }

  // Historique des appels : résultat (joint / ne répond pas / veut partir) et note.
  const demandesAvecAppels = rows.filter((r) => historiqueAppelsPdf(r.details).length > 0);
  if (demandesAvecAppels.length > 0) {
    const lignesAppels = demandesAvecAppels
      .slice(0, 8)
      .map((r) => {
        const appels = historiqueAppelsPdf(r.details)
          .slice(-2)
          .map((a) => {
            const resultat = libelleResultatAppelPdf(a.resultat) || "résultat non consigné";
            const note = a.note ? ` — « ${couperTexte(a.note, 50)} »` : "";
            return `${resultat} le ${pdfDateFr(a.le)}${note}`;
          })
          .join(", ");
        return `${r.entreprise || r.email || "Demande"} : ${appels}`;
      })
      .join(" · ");
    const suite =
      demandesAvecAppels.length > 8
        ? ` (+${demandesAvecAppels.length - 8} autre${demandesAvecAppels.length - 8 > 1 ? "s" : ""})`
        : "";
    const lignes = decouperLignesPdf(`${lignesAppels}${suite}`, 118).slice(0, 6);
    const hauteur = 26 + lignes.length * 10;
    if (y + hauteur > 730) {
      doc.newPage();
      y = 60;
    }
    doc.rect(marge, y, 515, hauteur, [247, 245, 241]);
    doc.rect(marge, y, 3, hauteur, [138, 130, 120]);
    doc.text(marge + 12, y + 13, 6.5, "MOTIFS D'APPEL CONSIGNÉS", { bold: true, color: PDF_MUTED });
    lignes.forEach((ligne, i) => {
      doc.text(marge + 12, y + 26 + i * 10, 7.2, ligne, { color: PDF_INK });
    });
    y += hauteur + 12;
  }

  if (y > 720) {
    doc.newPage();
    y = 60;
  }
  doc.rect(marge, y, 515, 46, [247, 245, 241]);
  doc.rect(marge, y, 3, 46, PDF_ACCENT);
  doc.text(marge + 12, y + 14, 6.5, "PORTÉE DU DOCUMENT", { bold: true, color: PDF_MUTED });
  doc.text(
    marge + 12,
    y + 28,
    7.5,
    "Fige l'état des demandes encore annulables, les rappels J-7 / J-1 et les relances manuelles.",
    { color: PDF_INK },
  );
  doc.text(marge + 12, y + 39, 7.5, "Aucune donnée métier : à classer avec les preuves d'audit RGPD.", {
    color: PDF_INK,
  });

  doc.stampFooter("Archive générée avec ArtiFlow-pro · récap hebdomadaire");

  const jour = now.toISOString().slice(0, 10);
  return {
    base64: doc.toBase64(),
    filename: `suppressions-en-attente-semaine-${jour}.pdf`,
    count: rows.length,
    aAppeler: aAppeler.length,
    suivisDus: suivisDus.length,
  };
}

/** Construit l'email récapitulatif hebdomadaire des alertes Stripe non traitées. */
function buildEmailHtml(
  groupes: GroupeCause[],
  alertes: AlerteNonTraitee[],
  total: number,
  destinataires: string[],
  estTest = false,
  archive?: { count: number; filename: string; aAppeler?: number; suivisDus?: number },
  appels?: BilanAppelsSemaine,
  seuilSuivi: number = SEUIL_SUIVI_DEFAUT,
): string {
  const lignesGroupes = groupes
    .map(
      (g) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:13px;color:#18181b;">${escapeHtml(g.label)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:13px;color:#b45309;font-weight:700;text-align:center;">${g.count}</td>
      </tr>`,
    )
    .join("");

  const recents = alertes.slice(0, MAX_DETAIL);
  const lignesDetail = recents
    .map(
      (a) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#18181b;">${escapeHtml(
          libelleCause(a.motif),
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#52525b;text-transform:uppercase;">${escapeHtml(
          a.pays || "—",
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#71717a;">${escapeHtml(
          frDateTime(a.created_at),
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#b45309;font-weight:600;">${escapeHtml(
          anciennete(a.created_at),
        )}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">Récap hebdo · alertes Stripe à traiter</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">ArtiFlow-pro · ${estTest ? "envoi de test" : "synthèse automatique des alertes non traitées"}</p>
      </div>
      <div style="padding:24px;">
        ${
          appels
            ? `<div style="margin:0 0 18px;padding:14px 16px;border:1px solid #e8e2d9;border-radius:10px;background:#fbf7f1;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8a6a48;">Appels téléphoniques de la semaine</p>
          <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#3f3f46;">
            <strong>${appels.appels} appel${appels.appels > 1 ? "s" : ""}</strong> consigné${appels.appels > 1 ? "s" : ""} depuis lundi 00:00, toutes demandes confondues.
          </p>
          <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:6px 0;">
            <tr>
              <td style="width:25%;padding:9px 6px;background:#ffffff;border:1px solid #ece7e0;border-radius:8px;text-align:center;">
                <div style="font-size:18px;font-weight:700;color:#3f6b45;">${appels.joints}</div>
                <div style="font-size:11px;color:#71717a;">Joints</div>
              </td>
              <td style="width:25%;padding:9px 6px;background:#ffffff;border:1px solid #ece7e0;border-radius:8px;text-align:center;">
                <div style="font-size:18px;font-weight:700;color:#6b6459;">${appels.sansReponse}</div>
                <div style="font-size:11px;color:#71717a;">Sans réponse</div>
              </td>
              <td style="width:25%;padding:9px 6px;background:#ffffff;border:1px solid #ece7e0;border-radius:8px;text-align:center;">
                <div style="font-size:18px;font-weight:700;color:#b45309;">${appels.veutPartir}</div>
                <div style="font-size:11px;color:#71717a;">Veut partir</div>
              </td>
              <td style="width:25%;padding:9px 6px;background:#ffffff;border:1px solid #ece7e0;border-radius:8px;text-align:center;">
                <div style="font-size:18px;font-weight:700;color:#8a6a48;">${appels.suivisClos}</div>
                <div style="font-size:11px;color:#71717a;">Suivis clos</div>
              </td>
            </tr>
          </table>
          <p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#6b6459;">
            <strong>${appels.suivisClos} suivi${appels.suivisClos > 1 ? "s" : ""} clos cette semaine</strong> par un gestionnaire depuis le back-office, sans nouvel email. Le motif saisi à la clôture figure dans le PDF joint.
          </p>
          ${
            appels.suivisDus > 0
              ? `<p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#8a6a48;"><strong>${appels.suivisDus} rappel${appels.suivisDus > 1 ? "s" : ""} de suivi proposé${appels.suivisDus > 1 ? "s" : ""}</strong> : dernier appel sans réponse depuis plus de ${seuilSuivi} h, une nouvelle tentative est attendue. La liste nominative et la note du dernier appel figurent dans le PDF joint.</p>`
              : ""
          }
        </div>`
            : ""
        }
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fef3c7;color:#b45309;font-size:12px;font-weight:700;">
          ${total} alerte${total > 1 ? "s" : ""} de configuration Stripe en attente de traitement
        </div>
        <p style="margin:16px 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Ces alertes signalent qu'un client n'a pas pu ouvrir la page de paiement (configuration
          Stripe incomplète) et qu'<strong>aucune action de traitement n'a encore été enregistrée</strong>.
          Traitez-les depuis le back-office (« Marquer comme traitée ») pour éviter d'y revenir.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#f4f4f5;">
              <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Cause</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;color:#71717a;">En attente</th>
            </tr>
          </thead>
          <tbody>${lignesGroupes}</tbody>
        </table>
        ${
          lignesDetail
            ? `<p style="margin:20px 0 8px;font-size:13px;font-weight:700;color:#18181b;">Détail des ${recents.length} alerte${recents.length > 1 ? "s" : ""} les plus anciennes</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Cause</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Pays</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Détectée le</th>
              <th style="padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Ancienneté</th>
            </tr>
          </thead>
          <tbody>${lignesDetail}</tbody>
        </table>`
            : ""
        }
        ${
          archive
            ? `<div style="margin:18px 0 0;padding:12px 14px;border:1px solid #e5e5e5;border-radius:10px;background:#fafafa;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#18181b;">Pièce jointe · archive des suppressions en attente</p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:#52525b;">
            Le PDF <strong>${escapeHtml(archive.filename)}</strong> est joint à cet email : ${archive.count} demande${
              archive.count > 1 ? "s" : ""
            } encore annulable${archive.count > 1 ? "s" : ""}, avec échéances, jours restants, rappels J-7 / J-1, relances manuelles, résultats des appels téléphoniques et colonne « Suivi dû » (seuil ${seuilSuivi} h).
            ${
              archive.aAppeler && archive.aAppeler > 0
                ? `<strong>${archive.aAppeler} demande${archive.aAppeler > 1 ? "s" : ""}</strong> déjà relancée${
                    archive.aAppeler > 1 ? "s" : ""
                  } au moins deux fois et pas encore jointe${
                    archive.aAppeler > 1 ? "s" : ""
                  } au téléphone y sont surlignées : à appeler plutôt qu'à relancer par email. `
                : ""
            }
            À classer avec les preuves d'audit RGPD.
          </p>
        </div>`
            : ""
        }
        <p style="margin:18px 0 0;font-size:12px;color:#a1a1aa;">
          Récap généré le ${escapeHtml(frDateTime(new Date().toISOString()))} et envoyé à ${escapeHtml(
            destinataires.join(", "),
          )}.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé via ArtiFlow-pro.
      </div>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const force = body?.force === true;
    const preview = body?.preview === true;
    const ignoreTime = body?.ignoreTime === true;
    // L'aperçu peut renvoyer l'archive PDF réelle (données personnelles : emails des
    // artisans). Dans ce cas seulement, l'appelant doit être un gestionnaire connecté.
    const avecArchive = body?.avecArchive === true;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    if (preview && avecArchive) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (!anonKey) return json({ ok: false, error: "Aperçu indisponible." }, 500);
      const authHeader = req.headers.get("Authorization") ?? "";
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: userData, error: userError } = await authClient.auth.getUser();
      const user = userData?.user;
      if (userError || !user?.email) return json({ ok: false, error: "Vous devez être connecté." }, 401);
      const { data: gestionnaire } = await admin
        .from("gestionnaires")
        .select("email")
        .ilike("email", user.email)
        .maybeSingle();
      if (!gestionnaire) {
        return json({ ok: false, error: "Cette action est réservée aux gestionnaires." }, 403);
      }
    }

    // 1) Alertes de configuration Stripe encore NON traitées (les plus anciennes d'abord :
    //    ce sont les plus urgentes à traiter).
    const { data, error } = await admin
      .from("alerte_config_stripe")
      .select("id, motif, pays, created_at")
      .neq("statut", "traitee")
      .order("created_at", { ascending: true });
    if (error) return json({ ok: false, error: error.message }, 500);

    const alertes = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id) || 0,
      motif: (row.motif === "pays" || row.motif === "carte" ? row.motif : "") as "pays" | "carte" | "",
      pays: row.pays ? String(row.pays) : "",
      created_at: String(row.created_at ?? ""),
    })) as AlerteNonTraitee[];

    const total = alertes.length;
    const groupes = grouperParCause(alertes);
    const destinataires = await adressesGestionnaires(admin);

    // 1 bis) Archive PDF des suppressions encore annulables, jointe au récap.
    //    Elle est générée à chaque envoi, donc elle reflète l'état du moment (preuve d'audit).
    const { data: suppressionsData } = await admin
      .from("suppressions_compte")
      .select("id, email, entreprise, demandee_le, prevue_le, details")
      .eq("statut", "programmee")
      .order("prevue_le", { ascending: true });
    const suppressions = (suppressionsData ?? []) as SuppressionRow[];
    // Seuil de suivi réglé depuis l'encart du back-office (24 / 48 / 72 h), 48 h par défaut.
    const { data: parametres } = await admin
      .from("parametres_app")
      .select("suivi_appel_heures")
      .eq("id", 1)
      .maybeSingle();
    const seuilSuivi = normaliserSeuilSuivi(
      (parametres as { suivi_appel_heures?: number } | null)?.suivi_appel_heures,
    );
    const archive = construireArchiveSuppressions(suppressions, seuilSuivi);
    // Bilan des appels de la semaine, affiché en haut de l'email.
    const appelsSemaine = bilanAppelsSemaine(suppressions, seuilSuivi);

    // Mode aperçu : on renvoie le HTML de l'email, sans rien envoyer.
    if (preview) {
      return json({
        ok: true,
        preview: true,
        total,
        groupes,
        appelsSemaine,
        seuilSuivi,
        destinataires,
        archive: {
          count: archive.count,
          filename: archive.filename,
          aAppeler: archive.aAppeler,
          suivisDus: archive.suivisDus,
          ...(avecArchive ? { base64: archive.base64 } : {}),
        },
        subject: `Récap hebdo · ${total} alerte${total > 1 ? "s" : ""} Stripe à traiter`,
        html: buildEmailHtml(groupes, alertes, total, destinataires, true, archive, appelsSemaine, seuilSuivi),
      });
    }

    if (!resendKey || !fromDomain) {
      return json({
        ok: true,
        configured: false,
        sent: 0,
        total,
        reason: "Resend non configuré (clé API + domaine d'envoi).",
      });
    }

    // 2) Jour/heure d'envoi (défaut lundi 08:00, heure de Paris) — sauf test manuel.
    if (!force && !ignoreTime) {
      const jourCible = Number.isFinite(Number(body?.day)) ? ((Number(body.day) - 1 + 7) % 7) + 1 : JOUR_DEFAUT;
      const heureCible = Number.isFinite(Number(body?.hour)) ? Number(body.hour) % 24 : HEURE_DEFAUT;
      if (parisWeekday() !== jourCible || parisHour() !== heureCible) {
        return json({ ok: true, sent: 0, total, reason: "Hors créneau d'envoi hebdomadaire." });
      }
    }

    // 3) Rien à signaler : on n'envoie pas d'email vide (sauf test manuel).
    if (total === 0 && !force) {
      return json({ ok: true, sent: 0, total, reason: "Aucune alerte Stripe en attente de traitement." });
    }

    // 4) Anti-doublon : pas deux récaps à moins de 6 jours d'intervalle (sauf test manuel).
    if (!force) {
      const { data: derniers } = await admin
        .from("recap_alertes_stripe_envois")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      const dernier = Array.isArray(derniers) && derniers[0] ? String(derniers[0].created_at ?? "") : "";
      const t = dernier ? new Date(dernier).getTime() : 0;
      if (t && Date.now() - t < INTERVALLE_MIN_JOURS * 86_400_000) {
        return json({ ok: true, sent: 0, total, reason: "Récap déjà envoyé cette semaine." });
      }
    }

    if (destinataires.length === 0) {
      return json({ ok: true, sent: 0, total, reason: "Aucun gestionnaire à prévenir." });
    }

    // 5) Envoi de l'email aux gestionnaires.
    const subject = `${force ? "Test · " : ""}Récap hebdo · ${total} alerte${total > 1 ? "s" : ""} Stripe à traiter`;
    const envoi = await envoyerEmailAvecRepli(
      "recap-hebdo-alertes-stripe-non-traitees",
      {
        nom: "ArtiFlow-pro",
        to: destinataires,
        subject,
        html: buildEmailHtml(groupes, alertes, total, destinataires, force, archive, appelsSemaine, seuilSuivi),
        attachments: [{ filename: archive.filename, content: archive.base64 }],
      },
      admin,
    );

    if (!envoi.ok) {
      return json({ ok: true, sent: 0, total, reason: envoi.error || "Envoi refusé." });
    }

    // Trace de l'envoi (sert d'anti-doublon et d'archive).
    await admin.from("recap_alertes_stripe_envois").insert({
      nb_alertes: total,
      destinataires,
    });

    return json({
      ok: true,
      configured: true,
      sent: 1,
      total,
      groupes,
      destinataires,
      archive: {
        count: archive.count,
        filename: archive.filename,
        aAppeler: archive.aAppeler,
        suivisDus: archive.suivisDus,
      },
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
