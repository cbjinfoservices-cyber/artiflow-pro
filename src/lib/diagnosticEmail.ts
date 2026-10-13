import { supabase } from "@/lib/supabase";
import { downloadCsv, toCsv, textToBase64 } from "@/lib/csv";
import { consignerRecapEchecsEnvoye } from "@/lib/recapEchecsBlanc";
import { noterVerificationConfigEmail } from "@/lib/verifConfigEmailMemoire";

/** Un domaine d'envoi tel que renvoyé par l'API Resend. */
export interface ResendDomaine {
  id: string;
  name: string;
  status: string;
  region?: string;
}

/** Résultat du diagnostic de configuration des emails d'envoi. */
export interface StatutEmail {
  /** Une clé API Resend est présente côté Backend. */
  keyPresent: boolean;
  /** Un domaine d'envoi est configuré côté Backend. */
  domainPresent: boolean;
  /** Nom du domaine d'envoi configuré (RESEND_FROM_DOMAIN), ou null. */
  domainName: string | null;
  /** Adresse d'expédition qui sera utilisée (noreply@domaine), ou null. */
  fromAddress: string | null;
  /** L'API Resend a répondu correctement. */
  apiReachable: boolean;
  /** Message d'erreur renvoyé par l'API Resend, le cas échéant. */
  apiError: string | null;
  /** État de vérification du domaine configuré, ou null si non consultable. */
  domainStatus: string | null;
  /** Liste des domaines déclarés dans Resend. */
  domains: ResendDomaine[];
  /** Un enregistrement DMARC (_dmarc.domaine) est présent. */
  dmarcPresent: boolean;
  /** Valeur de l'enregistrement DMARC détecté, ou null. */
  dmarcValue: string | null;
  /** Vrai si la clé, le domaine ET la vérification sont tous bons. */
  ready: boolean;
  /** Horodatage de la vérification. */
  checkedAt: string;
}

/** Une entrée de l'historique des vérifications de configuration email. */
export interface DiagnosticEntree {
  id: number;
  ready: boolean;
  key_present: boolean;
  domain_present: boolean;
  domain_name: string | null;
  domain_status: string | null;
  api_reachable: boolean;
  api_error: string | null;
  checked_at: string;
}

/** Une entrée de l'historique des emails de test envoyés. */
export interface EmailTestEntree {
  id: number;
  destinataire: string;
  expediteur: string | null;
  /** "succes" ou "echec". */
  resultat: string;
  message: string | null;
  created_at: string;
}

/** Libellé humain d'un statut de domaine Resend. */
export function libelleStatutDomaine(status: string | null): string {
  if (!status) return "Inconnu";
  const map: Record<string, string> = {
    verified: "Vérifié",
    pending: "En attente de vérification",
    not_started: "Non démarré",
    failed: "Échec de vérification",
    not_found: "Introuvable dans Resend",
  };
  return map[status] ?? status;
}

/**
 * Charge l'état réel de la configuration d'envoi d'emails (présence de la clé,
 * domaine configuré et vérification effective) via la fonction Backend dédiée.
 */
export async function chargerStatutEmail(): Promise<StatutEmail> {
  const { data, error } = await supabase.functions.invoke("email-config-status", { body: {} });
  if (error) throw new Error(error.message);
  const payload = data as (StatutEmail & { ok?: boolean; error?: string }) | null;
  if (!payload || payload.ok === false) {
    throw new Error(payload?.error || "Le diagnostic n'a pas pu être chargé.");
  }
  // On mémorise la date de cette vérification réussie et son verdict : le rappel mensuel du
  // tableau de bord et le badge du menu du compte s'appuient ensuite sur cette mémoire locale.
  noterVerificationConfigEmail(payload.checkedAt, payload.ready === true);
  return payload;
}

/**
 * Charge l'historique des vérifications de configuration email, du plus récent au
 * plus ancien. Le Backend n'y consigne une entrée que lorsque l'état change.
 */
export async function chargerHistoriqueDiagnostic(limit = 20): Promise<DiagnosticEntree[]> {
  const { data, error } = await supabase
    .from("diagnostic_email_historique")
    .select("*")
    .order("checked_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as DiagnosticEntree[];
}

/**
 * Charge l'historique des emails de test envoyés, du plus récent au plus ancien.
 * Chaque test (réussi ou en échec) y est consigné pour garder une trace des validations.
 */
export async function chargerHistoriqueEmailsTest(limit = 20): Promise<EmailTestEntree[]> {
  const { data, error } = await supabase
    .from("email_test_historique")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as EmailTestEntree[];
}

/**
 * Renvoie l'horodatage ISO du DERNIER email de test réussi, ou null s'il n'y en a aucun.
 * Sert de preuve « vu récemment » en haut du Diagnostic : on peut afficher la date de la
 * dernière réception confirmée sans avoir à relancer un envoi.
 */
export async function chargerDernierTestReussi(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("email_test_historique")
      .select("created_at")
      .eq("resultat", "succes")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) return null;
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) return null;
    const iso = String(rows[0].created_at ?? "");
    return iso || null;
  } catch {
    return null;
  }
}

/** Statistiques de réussite des emails de test sur une période. */
export interface StatsEmailsTest {
  total: number;
  succes: number;
  echecs: number;
  /** Taux de réussite en pourcentage (0-100). */
  taux: number;
}

/**
 * Calcule le taux de réussite des emails de test sur les N derniers jours.
 * Sert au petit indicateur chiffré en haut de l'écran Diagnostic.
 */
export async function chargerStatsEmailsTest(jours = 30): Promise<StatsEmailsTest> {
  const depuis = new Date(Date.now() - jours * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("email_test_historique")
    .select("resultat")
    .gte("created_at", depuis);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { resultat: string }[];
  const total = rows.length;
  const succes = rows.filter((r) => r.resultat === "succes").length;
  const echecs = total - succes;
  const taux = total > 0 ? Math.round((succes / total) * 100) : 0;
  return { total, succes, echecs, taux };
}

/** Un point de la courbe d'évolution du taux de réussite des emails de test. */
export interface PointTaux {
  /** Jour concerné (AAAA-MM-JJ). */
  jour: string;
  /** Libellé court du jour (« 8 sept. »). */
  dateLabel: string;
  /** Taux de réussite cumulé, jusqu'à ce jour inclus (0-100). */
  taux: number;
  /** Nombre de tests cumulés depuis le début de la fenêtre. */
  totalCumul: number;
  /** Nombre d'échecs cumulés depuis le début de la fenêtre. */
  echecsCumul: number;
  /** Nombre de tests lancés ce jour-là. */
  testsJour: number;
  /** Nombre d'échecs ce jour-là. */
  echecsJour: number;
}

/**
 * Construit la courbe cumulée du taux de réussite des emails de test sur une fenêtre
 * donnée (début + N jours) : un point par jour, le taux étant cumulé depuis le début de
 * la fenêtre. Base commune à la période courante et à la période précédente (courbe comparée).
 */
async function chargerSerieTauxFenetre(debut: Date, jours: number): Promise<PointTaux[]> {
  const fin = new Date(debut);
  fin.setDate(debut.getDate() + jours);

  const { data, error } = await supabase
    .from("email_test_historique")
    .select("resultat, created_at")
    .gte("created_at", debut.toISOString())
    .lt("created_at", fin.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { resultat: string; created_at: string }[];
  // Répartition par jour, exprimée sur la clé AAAA-MM-JJ locale.
  const parJour = new Map<string, { total: number; echecs: number }>();
  rows.forEach((r) => {
    const d = new Date(r.created_at);
    if (Number.isNaN(d.getTime())) return;
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cur = parJour.get(cle) ?? { total: 0, echecs: 0 };
    cur.total += 1;
    if (r.resultat !== "succes") cur.echecs += 1;
    parJour.set(cle, cur);
  });

  const points: PointTaux[] = [];
  let cumulTotal = 0;
  let cumulEchecs = 0;
  for (let i = 0; i < jours; i += 1) {
    const d = new Date(debut);
    d.setDate(debut.getDate() + i);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const jour = parJour.get(cle) ?? { total: 0, echecs: 0 };
    cumulTotal += jour.total;
    cumulEchecs += jour.echecs;
    const taux = cumulTotal > 0 ? Math.round(((cumulTotal - cumulEchecs) / cumulTotal) * 100) : 0;
    points.push({
      jour: cle,
      dateLabel: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      taux,
      totalCumul: cumulTotal,
      echecsCumul: cumulEchecs,
      testsJour: jour.total,
      echecsJour: jour.echecs,
    });
  }
  return points;
}

/**
 * Reconstruit la courbe d'évolution du taux de réussite des emails de test sur les N
 * derniers jours : un point par jour, le taux étant cumulé depuis le début de la fenêtre
 * (il aboutit donc au taux global de la période). Sert au petit graphique du Diagnostic.
 */
export async function chargerSerieTauxEmailsTest(jours = 30): Promise<PointTaux[]> {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  debut.setDate(debut.getDate() - (jours - 1));
  return chargerSerieTauxFenetre(debut, jours);
}

/**
 * Reconstruit la même courbe cumulée, mais sur la fenêtre PRÉCÉDENTE (les N jours qui
 * précèdent immédiatement la période courante), alignée index par index. Sert à superposer
 * la courbe « mois dernier » à la courbe « ce mois » sur le graphe d'évolution.
 */
export async function chargerSerieTauxEmailsTestPrecedent(jours = 30): Promise<PointTaux[]> {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  debut.setDate(debut.getDate() - (2 * jours - 1));
  return chargerSerieTauxFenetre(debut, jours);
}

/** Expéditeur réellement utilisé pour l'email de test. */
export interface ResultatEmailTest {
  to: string;
  fromAddress: string;
  /** Identifiant Resend du message envoyé (permet de suivre sa livraison). */
  id: string | null;
}

/**
 * Envoie un email de test à l'adresse fournie, via la fonction Backend dédiée.
 * Valide ainsi l'envoi de bout en bout (clé API + domaine d'envoi).
 * Lève une erreur lisible si l'envoi échoue.
 */
export async function envoyerEmailTest(to: string): Promise<ResultatEmailTest> {
  const { data, error } = await supabase.functions.invoke("send-test-email", { body: { to } });
  if (error) throw new Error(error.message);
  const payload = data as
    | { ok?: boolean; error?: string; to?: string; fromAddress?: string; id?: string | null }
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi de l'email de test a échoué.");
  return { to: payload.to ?? to, fromAddress: payload.fromAddress ?? "", id: payload.id ?? null };
}

/**
 * Envoie une copie de test à blanc : rejoue le contenu EXACT fourni (objet + HTML) vers
 * une adresse de test, sans jamais toucher aux vrais destinataires (clients, comptable).
 * Le message est marqué « test à blanc » côté Backend. Lève une erreur lisible si l'envoi échoue.
 */
export async function envoyerEmailBlanc(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ to: string; id: string | null }> {
  const { data, error } = await supabase.functions.invoke("send-test-email", {
    body: { to: opts.to, blanc: true, subject: opts.subject, html: opts.html },
  });
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; error?: string; to?: string; id?: string | null } | null;
  if (!payload?.ok) throw new Error(payload?.error || "Le test à blanc a échoué.");
  return { to: payload.to ?? opts.to, id: payload.id ?? null };
}

/**
 * Envoie un export CSV par email à l'artisan connecté (en pièce jointe), afin de conserver
 * une trace datée hors du navigateur. Le destinataire est toujours l'adresse de l'artisan :
 * on n'exporte jamais vers un tiers. Lève une erreur lisible si l'envoi échoue.
 */
export async function envoyerCsvParEmail(opts: {
  csv: string;
  filename: string;
  subject?: string;
}): Promise<{ to: string }> {
  const { data, error } = await supabase.functions.invoke("send-export-csv-email", {
    body: {
      contentBase64: textToBase64(opts.csv),
      filename: opts.filename,
      subject: opts.subject,
    },
  });
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; error?: string; to?: string } | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi de l'export par email a échoué.");
  return { to: payload.to ?? "" };
}

/**
 * Envoie a l'artisan connecte un recapitulatif listant UNIQUEMENT les automatisations en
 * echec apres un rejeu global « test a blanc ». Le destinataire est toujours l'adresse de
 * l'artisan : on n'exporte jamais vers un tiers. Leve une erreur lisible si l'envoi echoue.
 */
export async function envoyerRecapEchecsBlanc(opts: {
  echecs: Array<{ nom: string; message: string }>;
  total: number;
  dateRejeu?: string;
}): Promise<{ to: string }> {
  const { data, error } = await supabase.functions.invoke("send-recap-echecs-blanc", {
    body: {
      echecs: opts.echecs,
      total: opts.total,
      dateRejeu: opts.dateRejeu,
    },
  });
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; error?: string; to?: string } | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du récap des échecs a échoué.");
  await consignerRecapEchecsEnvoye("manuel");
  return { to: payload.to ?? "" };
}

/** Un groupe d'échecs rattaché à une automatisation, pour le récap CSV par email. */
export interface GroupeEchecsRecap {
  /** Nom affiché de l'automatisation. */
  nom: string;
  /** Nombre d'échecs de cette automatisation. */
  echecs: number;
  /** Date lisible du dernier échec de cette automatisation. */
  dernier: string;
}

/**
 * Envoie à l'artisan connecté un récap d'échecs par email AVEC un fichier CSV en pièce jointe
 * qui regroupe les échecs par automatisation : utile pour archiver tout l'historique des rejeux
 * d'un seul geste. Le destinataire est toujours l'adresse de l'artisan (jamais un tiers).
 * Lève une erreur lisible si l'envoi échoue.
 */
export async function envoyerRecapEchecsCsv(opts: {
  csv: string;
  filename: string;
  groupes: GroupeEchecsRecap[];
  total: number;
  dateExporte?: string;
}): Promise<{ to: string }> {
  const { data, error } = await supabase.functions.invoke("send-recap-echecs-csv", {
    body: {
      contentBase64: textToBase64(opts.csv),
      filename: opts.filename,
      groupes: opts.groupes,
      total: opts.total,
      dateExporte: opts.dateExporte,
    },
  });
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; error?: string; to?: string } | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du récap CSV par email a échoué.");
  await consignerRecapEchecsEnvoye("manuel");
  return { to: payload.to ?? "" };
}

/** Verdict réel de livraison d'un email, tel que rapporté par Resend. */
export interface StatutLivraisonEmail {
  id: string;
  to: string | null;
  /** Dernier évènement connu : delivered, bounced, complained, delivery_delayed, sent… */
  lastEvent: string | null;
}

/**
 * Interroge Resend pour connaitre le verdict RÉEL de livraison d'un email déjà envoyé.
 * Un envoi accepté ne garantit pas la livraison : cette fonction révèle si le message a
 * été livré, rejeté (bounce) ou signalé. Lève une erreur lisible si l'appel échoue.
 */
export async function verifierLivraisonEmail(id: string): Promise<StatutLivraisonEmail> {
  const { data, error } = await supabase.functions.invoke("check-email-delivery", {
    body: { id },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | { ok?: boolean; error?: string; id?: string; to?: string | null; lastEvent?: string | null }
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "Impossible de vérifier la livraison.");
  return { id: payload.id ?? id, to: payload.to ?? null, lastEvent: payload.lastEvent ?? null };
}

/** Traduit un évènement Resend en libellé lisible + niveau de gravité visuel. */
export function libelleEvenementLivraison(event: string | null): {
  label: string;
  niveau: "ok" | "attente" | "echec";
} {
  switch (event) {
    case "delivered":
      return { label: "Livré au serveur du destinataire", niveau: "ok" };
    case "opened":
      return { label: "Email ouvert par le destinataire", niveau: "ok" };
    case "clicked":
      return { label: "Lien cliqué par le destinataire", niveau: "ok" };
    case "sent":
      return { label: "Accepté par Resend, en cours d'acheminement", niveau: "attente" };
    case "delivery_delayed":
      return { label: "Livraison retardée — Resend réessaie automatiquement", niveau: "attente" };
    case "bounced":
      return { label: "Rejeté par la boîte du destinataire (bounce)", niveau: "echec" };
    case "complained":
      return { label: "Signalé comme spam par le destinataire", niveau: "echec" };
    default:
      return { label: "Statut pas encore disponible", niveau: "attente" };
  }
}

/**
 * Envoie un email de test de l'alerte a l'adresse de reception fournie, afin de
 * verifier qu'elle recoit bien les alertes d'echec. Passe par la meme fonction Backend
 * que l'envoi de test, en mode « alerte ».
 */
export async function testerAlerteEmail(to: string): Promise<ResultatEmailTest> {
  const { data, error } = await supabase.functions.invoke("send-test-email", {
    body: { to, alerteTest: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | { ok?: boolean; error?: string; to?: string; fromAddress?: string }
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du test d'alerte a échoué.");
  return { to: payload.to ?? to, fromAddress: payload.fromAddress ?? "", id: null };
}

/**
 * Calcule le taux de reussite des emails de test sur une fenetre explicite
 * (bornes ISO). Sert a comparer la periode courante a la periode precedente
 * pour la fleche de tendance du recapitulatif.
 */
export async function chargerStatsEmailsTestPeriode(
  debutISO: string,
  finISO: string,
): Promise<StatsEmailsTest> {
  const { data, error } = await supabase
    .from("email_test_historique")
    .select("resultat")
    .gte("created_at", debutISO)
    .lt("created_at", finISO);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { resultat: string }[];
  const total = rows.length;
  const succes = rows.filter((r) => r.resultat === "succes").length;
  const echecs = total - succes;
  const taux = total > 0 ? Math.round((succes / total) * 100) : 0;
  return { total, succes, echecs, taux };
}

/** Une entree de l'historique des alertes de taux de reussite envoyees. */
export interface TauxAlerteEntree {
  id: number;
  /** Taux de reussite au moment de l'envoi (en %). */
  taux: number;
  /** Seuil regle au moment de l'envoi (en %). */
  seuil: number;
  /** Fenetre (en jours) prise en compte au moment de l'envoi. */
  jours: number;
  /** Nombre d'emails de test sur la periode. */
  total: number;
  /** Nombre d'echecs sur la periode. */
  echecs: number;
  /** Vrai pour un envoi de demonstration lance a la main, faux pour une alerte automatique. */
  manuel: boolean;
  created_at: string;
}

/** Normalise une ligne brute de taux_alerte_historique en entree typée. */
function mapperAlerteTaux(row: Record<string, unknown>): TauxAlerteEntree {
  return {
    id: Number(row.id),
    taux: Number(row.taux ?? 0),
    seuil: Number(row.seuil ?? 0),
    jours: Number(row.jours ?? 0),
    total: Number(row.total ?? 0),
    echecs: Number(row.echecs ?? 0),
    manuel: Boolean(row.manuel),
    created_at: String(row.created_at ?? ""),
  };
}

/**
 * Charge l'historique des alertes de taux envoyees (reelles et tests), du plus recent au
 * plus ancien. Sert au petit historique affiche a cote du reglage de l'alerte de taux.
 */
export async function chargerHistoriqueTauxAlerte(limit = 6): Promise<TauxAlerteEntree[]> {
  const { data, error } = await supabase
    .from("taux_alerte_historique")
    .select("id, taux, seuil, jours, total, echecs, manuel, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapperAlerteTaux);
}

/**
 * Charge les alertes de taux AUTOMATIQUES (hors tests manuels) envoyees sur une periode
 * explicite (bornes ISO), du plus ancien au plus recent. Alimente l'export CSV sur une
 * periode choisie (date de debut / date de fin) plutot que l'historique affiche a l'ecran.
 */
export async function chargerAlertesTauxAutomatiquesPeriode(
  debutISO: string,
  finISO: string,
): Promise<TauxAlerteEntree[]> {
  const { data, error } = await supabase
    .from("taux_alerte_historique")
    .select("id, taux, seuil, jours, total, echecs, manuel, created_at")
    .eq("manuel", false)
    .gte("created_at", debutISO)
    .lte("created_at", finISO)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapperAlerteTaux);
}

/**
 * Compte le nombre d'alertes de taux envoyees (reelles et tests) sur les N derniers jours.
 * Alimente le petit compteur affiche au-dessus de l'historique de l'alerte de taux.
 */
export async function compterAlertesTaux(jours = 30): Promise<number> {
  const depuis = new Date(Date.now() - jours * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("taux_alerte_historique")
    .select("id", { count: "exact", head: true })
    .gte("created_at", depuis);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Compte les alertes de taux envoyees (reelles et tests) sur une periode explicite
 * (bornes ISO). Sert a comparer deux fenetres cote a cote (ce mois vs le mois dernier).
 */
export async function compterAlertesTauxPeriode(debutISO: string, finISO: string): Promise<number> {
  const { count, error } = await supabase
    .from("taux_alerte_historique")
    .select("id", { count: "exact", head: true })
    .gte("created_at", debutISO)
    .lt("created_at", finISO);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Synthese d'une periode d'alertes de taux automatiques, pour comparaison cote a cote. */
export interface ResumeAlertesTaux {
  /** Nombre d'alertes automatiques envoyees sur la periode. */
  total: number;
  /** Nombre de jours distincts avec au moins une alerte. */
  jours: number;
  /** Taux de reussite moyen des alertes de la periode, en % (0 si aucune alerte). */
  tauxMoyen: number;
  /** Nombre cumule d'echecs sur les alertes de la periode. */
  echecs: number;
  /** Nombre d'alertes de la periode dont le taux etait sous le seuil. */
  sousSeuil: number;
}

/**
 * Resumme une liste d'alertes de taux (deja chargee) : nombre d'alertes, jours distincts,
 * taux moyen, echecs cumules et nombre sous le seuil. Pure, reutilisable sans requete.
 */
export function resumerAlertesTaux(rows: TauxAlerteEntree[]): ResumeAlertesTaux {
  const total = rows.length;
  if (total === 0) return { total: 0, jours: 0, tauxMoyen: 0, echecs: 0, sousSeuil: 0 };
  const jours = new Set<string>();
  let sommeTaux = 0;
  let echecs = 0;
  let sousSeuil = 0;
  rows.forEach((h) => {
    const d = new Date(h.created_at);
    if (!Number.isNaN(d.getTime())) {
      jours.add(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }
    sommeTaux += h.taux;
    echecs += h.echecs;
    if (h.taux < h.seuil) sousSeuil += 1;
  });
  return {
    total,
    jours: jours.size,
    tauxMoyen: Math.round(sommeTaux / total),
    echecs,
    sousSeuil,
  };
}

/**
 * Resumme les alertes de taux AUTOMATIQUES d'une periode explicite (bornes ISO). Sert a
 * l'export CSV comparatif (deux periodes cote a cote) et au resume du graphe.
 */
export async function resumerAlertesTauxAutoPeriode(
  debutISO: string,
  finISO: string,
): Promise<ResumeAlertesTaux> {
  const rows = await chargerAlertesTauxAutomatiquesPeriode(debutISO, finISO);
  return resumerAlertesTaux(rows);
}

/**
 * Renvoie la liste des jours (AAAA-MM-JJ) sur lesquels une alerte de taux a ete envoyee
 * (reelle ou test), sur les N derniers jours. Sert a reperer d'un coup d'oeil, sur le
 * graphe d'evolution, les jours qui ont declenche (ou servi de test) une alerte.
 */
export async function chargerJoursAlertesTaux(jours = 30): Promise<string[]> {
  const depuis = new Date(Date.now() - jours * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("taux_alerte_historique")
    .select("created_at")
    .gte("created_at", depuis);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  ((data ?? []) as { created_at: string }[]).forEach((r) => {
    const d = new Date(r.created_at);
    if (Number.isNaN(d.getTime())) return;
    set.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  });
  return Array.from(set);
}

/**
 * Envoie un email de test de l'alerte « mot de passe ancien » a l'artisan connecte, pour
 * qu'il previsualise le rendu avant d'activer l'interrupteur. Passe par la tache planifiee
 * dediee en mode « force » : l'email part immediatement, sans tenir compte du seuil ni de
 * la mise de cote, et l'adresse est celle du profil. Leve une erreur lisible si l'envoi echoue.
 */
export async function testerAlerteMotDePasseAncien(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("alerte-mot-de-passe-ancien", {
    body: { userId, force: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | {
        ok?: boolean;
        error?: string;
        sent?: number;
        configured?: boolean;
        details?: Array<{ reason?: string }>;
      }
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du test de l'alerte a échoué.");
  if (payload.configured === false) {
    throw new Error(
      "L'envoi d'email n'est pas encore configuré (clé Resend + domaine vérifié). Activez Resend puis relancez le diagnostic.",
    );
  }
  if (!payload.sent) {
    throw new Error(payload.details?.[0]?.reason || "L'email de test n'a pas pu être envoyé.");
  }
}

/**
 * Envoie un email de demonstration du RECAP MENSUEL des alertes « mot de passe ancien » a
 * l'artisan connecte, pour previsualiser le rendu avant d'activer l'interrupteur. Passe par
 * la tache planifiee dediee en mode « force » : l'email part immediatement, sans tenir compte
 * du jour ni de l'anti-doublon, et l'adresse est celle du profil. Leve une erreur lisible si
 * l'envoi echoue.
 */
export async function testerRecapMensuelMotDePasse(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("recap-mensuel-mot-de-passe", {
    body: { userId, force: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | {
        ok?: boolean;
        error?: string;
        sent?: number;
        configured?: boolean;
        details?: Array<{ reason?: string }>;
      }
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du test du récap mensuel a échoué.");
  if (payload.configured === false) {
    throw new Error(
      "L'envoi d'email n'est pas encore configuré (clé Resend + domaine vérifié). Activez Resend puis relancez le diagnostic.",
    );
  }
  if (!payload.sent) {
    throw new Error(payload.details?.[0]?.reason || "L'email de test n'a pas pu être envoyé.");
  }
}

/**
 * Envoie un email de démonstration du RÉCAP TRIMESTRIEL des alertes « mot de passe ancien »
 * (listing des récaps mensuels du trimestre écoulé) à l'artisan connecté, pour prévisualiser
 * le rendu avant que le comptable ne le reçoive réellement. Passe par la tâche planifiée
 * dédiée en mode « force » : l'email part immédiatement, sans tenir compte du jour d'envoi ni
 * de l'anti-doublon trimestriel. Leve une erreur lisible si l'envoi échoue.
 */
export async function testerRecapTrimestrielMotDePasse(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("recap-trimestriel-mot-de-passe", {
    body: { userId, force: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | {
        ok?: boolean;
        error?: string;
        sent?: number;
        configured?: boolean;
        details?: Array<{ reason?: string }>;
      }
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du test trimestriel a échoué.");
  if (payload.configured === false) {
    throw new Error(
      "L'envoi d'email n'est pas encore configuré (clé Resend + domaine vérifié). Activez Resend puis relancez le diagnostic.",
    );
  }
  if (!payload.sent) {
    throw new Error(payload.details?.[0]?.reason || "L'email de test n'a pas pu être envoyé.");
  }
}

/**
 * Envoie un email de démonstration de l'HISTORIQUE ANNUEL des récaps mensuels (PDF joint) à
 * l'artisan connecté, pour prévisualiser le document avant sa transmission réelle au comptable
 * en fin d'année. Passe par la tâche planifiée dédiée en mode « force » : l'envoi part
 * immédiatement, sans tenir compte du jour ni de l'anti-doublon annuel.
 */
export async function testerHistoriqueAnnuelRecaps(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("envoi-recap-mensuel-annuel", {
    body: { userId, force: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | {
        ok?: boolean;
        error?: string;
        sent?: number;
        configured?: boolean;
        details?: Array<{ reason?: string }>;
      }
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du test annuel a échoué.");
  if (payload.configured === false) {
    throw new Error(
      "L'envoi d'email n'est pas encore configuré (clé Resend + domaine vérifié). Activez Resend puis relancez le diagnostic.",
    );
  }
  if (!payload.sent) {
    throw new Error(payload.details?.[0]?.reason || "L'email de test n'a pas pu être envoyé.");
  }
}

/**
 * Envoie un email de démonstration du COMPARATIF DE CADENCE (PDF comparant la fenêtre
 * courante à la fenêtre précédente) à l'artisan connecté, pour prévisualiser le document
 * avant sa transmission réelle au comptable en fin d'exercice. Passe par la tâche planifiée
 * dédiée en mode « force » : l'envoi part immédiatement, sans tenir compte du jour ni de
 * l'anti-doublon annuel.
 */
export async function testerComparatifCadenceAnnuel(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("envoi-comparatif-cadence-annuel", {
    body: { userId, force: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | {
        ok?: boolean;
        error?: string;
        sent?: number;
        configured?: boolean;
        details?: Array<{ reason?: string }>;
      }
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du comparatif de cadence a échoué.");
  if (payload.configured === false) {
    throw new Error(
      "L'envoi d'email n'est pas encore configuré (clé Resend + domaine vérifié). Activez Resend puis relancez le diagnostic.",
    );
  }
  if (!payload.sent) {
    throw new Error(payload.details?.[0]?.reason || "Le comparatif de démonstration n'a pas pu être envoyé.");
  }
}

/** Une entree de l'historique des recaps mensuels « mot de passe ancien » envoyes. */
export interface HistoriqueRecapMensuelEntree {
  id: number;
  /** Cle « AAAA-MM » du mois recapitule. */
  mois_cle: string;
  /** Adresse de l'artisan (destinataire principal). */
  destinataire: string | null;
  /** Vrai si le comptable a ete mis en copie de cet envoi. */
  copie_comptable: boolean;
  /** Vrai pour un envoi de demonstration, faux pour un recap mensuel reel. */
  manuel: boolean;
  created_at: string;
}

/**
 * Charge l'historique des recaps mensuels « mot de passe ancien » de l'artisan connecte, du
 * plus recent au plus ancien (RLS : chacun ne voit que ses propres envois). Sert au graphe
 * du Diagnostic et a l'export CSV.
 */
export async function chargerHistoriqueRecapsMensuels(limit = 60): Promise<HistoriqueRecapMensuelEntree[]> {
  const { data, error } = await supabase
    .from("mot_de_passe_recap_historique")
    .select("id, mois_cle, destinataire, copie_comptable, manuel, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    mois_cle: String(row.mois_cle ?? ""),
    destinataire: row.destinataire == null ? null : String(row.destinataire),
    copie_comptable: Boolean(row.copie_comptable),
    manuel: Boolean(row.manuel),
    created_at: String(row.created_at ?? ""),
  }));
}

/** Un point mensuel de la serie des recaps envoyes (un point par mois, du plus ancien au plus recent). */
export interface PointRecapMensuel {
  /** Cle « AAAA-MM » du mois. */
  cle: string;
  /** Libelle court (« sept. 25 »). */
  label: string;
  /** Nombre d'envois mensuels automatiques (reels). */
  auto: number;
  /** Nombre de tests manuels. */
  tests: number;
  /** Total des envois du mois. */
  total: number;
}

/**
 * Construit la serie des recaps envoyes sur les N derniers mois (un point par mois, en
 * comblant les mois vides). Alimente le graphe « recaps mensuels sur 12 mois » du Diagnostic.
 * La serie part de l'historique consigne cote Backend (RLS : ses propres envois uniquement).
 */
export async function chargerSerieRecapsMensuels(mois = 12): Promise<PointRecapMensuel[]> {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  debut.setDate(1);
  debut.setMonth(debut.getMonth() - (mois - 1));
  const { data, error } = await supabase
    .from("mot_de_passe_recap_historique")
    .select("created_at, manuel")
    .gte("created_at", debut.toISOString());
  if (error) throw new Error(error.message);

  const compte = new Map<string, { auto: number; tests: number }>();
  ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const d = new Date(String(row.created_at ?? ""));
    if (Number.isNaN(d.getTime())) return;
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = compte.get(cle) ?? { auto: 0, tests: 0 };
    if (row.manuel === true) b.tests += 1;
    else b.auto += 1;
    compte.set(cle, b);
  });

  const points: PointRecapMensuel[] = [];
  for (let i = 0; i < mois; i += 1) {
    const d = new Date(debut.getFullYear(), debut.getMonth() + i, 1);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = compte.get(cle) ?? { auto: 0, tests: 0 };
    points.push({
      cle,
      label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      auto: b.auto,
      tests: b.tests,
      total: b.auto + b.tests,
    });
  }
  return points;
}

/** Libelle lisible d'une cle « AAAA-MM » (« octobre 2026 »). */
export function libelleMoisCle(cle: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(cle);
  if (!m) return cle;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  if (Number.isNaN(d.getTime())) return cle;
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** Date de debut (incluse) de la fenetre des N derniers mois, calage au 1er du mois. */
export function debutFenetreMois(mois = 12): Date {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  debut.setDate(1);
  debut.setMonth(debut.getMonth() - (mois - 1));
  return debut;
}

/**
 * Construit la serie mensuelle des recaps a partir d'une liste d'envois DEJA chargee (pure,
 * sans requete). Sert au graphe filtre (tous / reels / tests) du Diagnostic : on lui passe
 * la sous-liste voulue et il recompte les barres mois par mois.
 *
 * `offsetFenetres` decale la fenetre dans le passe : 0 = les `mois` derniers mois (fenetre
 * courante), 1 = les `mois` mois precedent cette fenetre (fenetre precedente). Sert au
 * comparatif « 12 mois vs 12 mois precedents ».
 */
export function construireSerieRecapsMensuels(
  entrees: HistoriqueRecapMensuelEntree[],
  mois = 12,
  offsetFenetres = 0,
): PointRecapMensuel[] {
  const debut = debutFenetreMois(mois * (offsetFenetres + 1));

  const compte = new Map<string, { auto: number; tests: number }>();
  entrees.forEach((e) => {
    const d = new Date(e.created_at);
    if (Number.isNaN(d.getTime()) || d < debut) return;
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = compte.get(cle) ?? { auto: 0, tests: 0 };
    if (e.manuel) b.tests += 1;
    else b.auto += 1;
    compte.set(cle, b);
  });

  const points: PointRecapMensuel[] = [];
  for (let i = 0; i < mois; i += 1) {
    const d = new Date(debut.getFullYear(), debut.getMonth() + i, 1);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = compte.get(cle) ?? { auto: 0, tests: 0 };
    points.push({
      cle,
      label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      auto: b.auto,
      tests: b.tests,
      total: b.auto + b.tests,
    });
  }
  return points;
}

/**
 * Exporte l'historique des recaps mensuels au format CSV (une ligne par envoi : mois
 * recapitule, date, heure, type, destinataire et copie au comptable). Compatible Excel
 * (separateur « ; », accents geres).
 *
 * Si `comparatif` est fourni, on ajoute a la suite un second bloc : le comparatif
 * « 12 mois vs 12 mois precedents » du graphe des recaps (nombre d'envois par mois sur la
 * fenetre courante et sur la fenetre equivalente precedente, avec la variation). Le tout
 * tient dans un seul fichier CSV pour tracer le trimestre selectionne ET la tendance annuelle.
 */
export function exporterHistoriqueRecapsMensuels(
  entrees: HistoriqueRecapMensuelEntree[],
  comparatif?: { courant: PointRecapMensuel[]; precedent: PointRecapMensuel[] },
  fenetre = 12,
): void {
  const rows = entrees.map((e) => {
    const d = new Date(e.created_at);
    const valide = !Number.isNaN(d.getTime());
    return [
      libelleMoisCle(e.mois_cle),
      valide ? d.toLocaleDateString("fr-FR") : e.created_at,
      valide ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
      e.manuel ? "Test manuel" : "Automatique",
      e.destinataire ?? "",
      e.copie_comptable ? "Oui" : "Non",
    ];
  });
  const detailCsv = toCsv(
    ["Mois recapitule", "Date d'envoi", "Heure", "Type", "Destinataire", "Comptable en copie"],
    rows,
  );

  let contenu = `Recaps mensuels affiches\r\n${detailCsv}`;

  if (comparatif) {
    const comparatifRows = comparatif.courant.map((p, i) => {
      const prec = comparatif.precedent[i] ?? { total: 0, auto: 0, tests: 0 };
      const delta = prec.total > 0 ? Math.round(((p.total - prec.total) / prec.total) * 100) : null;
      return [
        p.label,
        String(p.total),
        String(prec.total),
        delta === null ? "N/A" : `${delta > 0 ? "+" : ""}${delta}%`,
      ];
    });
    const comparatifCsv = toCsv(
      ["Mois", `Recaps (${fenetre} derniers mois)`, `Recaps (${fenetre} mois precedents)`, "Variation"],
      comparatifRows,
    );
    const totalCourant = comparatif.courant.reduce((s, p) => s + p.total, 0);
    const totalPrecedent = comparatif.precedent.reduce((s, p) => s + p.total, 0);
    const deltaGlobal =
      totalPrecedent > 0 ? Math.round(((totalCourant - totalPrecedent) / totalPrecedent) * 100) : null;
    const synthese = toCsv(
      [`Comparatif ${fenetre} vs ${fenetre} mois precedents`, "Total recaps", "Variation"],
      [
        [
          `${fenetre} derniers mois`,
          String(totalCourant),
          deltaGlobal === null ? "N/A" : `${deltaGlobal > 0 ? "+" : ""}${deltaGlobal}%`,
        ],
        [`${fenetre} mois precedents`, String(totalPrecedent), ""],
      ],
    );
    contenu = `${contenu}\r\n\r\nComparatif ${fenetre} mois vs ${fenetre} mois precedents\r\n${synthese}\r\n${comparatifCsv}`;
  }

  downloadCsv(`recaps-mensuels-mot-de-passe-${new Date().toISOString().slice(0, 10)}.csv`, contenu);
}

/** Cle « AAAA-Tn » du trimestre auquel appartient une date (T1 = janv.-mars). */
export function cleTrimestreDeDate(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-T${q}`;
}

/** Libelle lisible d'une cle de trimestre « AAAA-Tn » (« T3 2026 »). */
export function libelleTrimestreCle(cle: string): string {
  const m = /^(\d{4})-T([1-4])$/.exec(cle);
  if (!m) return cle;
  return `T${m[2]} ${m[1]}`;
}

/**
 * Cles des N derniers trimestres (du plus recent au plus ancien), en terminant sur le
 * trimestre courant. Sert au filtre par trimestre du bloc des derniers recaps.
 */
export function trimestresRecents(n: number, base = new Date()): string[] {
  const cles: string[] = [];
  let q = Math.floor(base.getMonth() / 3) + 1;
  let annee = base.getFullYear();
  for (let i = 0; i < n; i += 1) {
    cles.push(`${annee}-T${q}`);
    q -= 1;
    if (q < 1) {
      q = 4;
      annee -= 1;
    }
  }
  return cles;
}

/** Echeance trimestrielle attendue : trimestre a recapituer et date/heure de l'echeance. */
export interface EcheanceTrimestre {
  /** Cle du trimestre qui aurait du etre recapitule (« AAAA-Tn »). */
  cle: string;
  /** Libelle lisible (« T3 2026 »). */
  libelle: string;
  /** Date/heure ISO de l'echeance (1er janvier/avril/juillet/octobre a 09:00). */
  echeanceISO: string;
}

/**
 * Determine le trimestre attendu par la DERNIERE echeance trimestrielle passee (1er
 * janvier/avril/juillet/octobre a 09:00). Sert a detecter un recap trimestriel qui n'est
 * pas parti a la date attendue. Pure : ne fait aucune requete.
 */
export function dernierTrimestreAttendu(now = new Date()): EcheanceTrimestre {
  const moisCloture = [1, 4, 7, 10];
  const moisCourant = now.getMonth() + 1;
  let anneeRef = now.getFullYear();
  let moisRef: number | null = null;
  for (let i = moisCloture.length - 1; i >= 0; i -= 1) {
    if (moisCloture[i] <= moisCourant) {
      moisRef = moisCloture[i];
      break;
    }
  }
  if (moisRef === null) {
    moisRef = 10;
    anneeRef -= 1;
  }
  let echeance = new Date(anneeRef, moisRef - 1, 1, 9, 0, 0);
  // Si l'echeance de ce mois n'est pas encore passee (avant 09:00 le 1er), on recule d'un trimestre.
  if (echeance.getTime() > now.getTime()) {
    const idx = moisCloture.indexOf(moisRef);
    moisRef = moisCloture[(idx + moisCloture.length - 1) % moisCloture.length];
    if (idx === 0) anneeRef -= 1;
    echeance = new Date(anneeRef, moisRef - 1, 1, 9, 0, 0);
  }
  // Le trimestre recapitule est celui qui s'acheve le mois precedent l'echeance.
  const moisRecap = moisRef === 1 ? 12 : moisRef - 1;
  const anneeRecap = moisRef === 1 ? anneeRef - 1 : anneeRef;
  const q = Math.floor((moisRecap - 1) / 3) + 1;
  const cle = `${anneeRecap}-T${q}`;
  return { cle, libelle: libelleTrimestreCle(cle), echeanceISO: echeance.toISOString() };
}

/** Echeance annuelle attendue : exercice a transmettre et date/heure de l'echeance. */
export interface EcheanceAnnuelle {
  /** Exercice qui aurait du etre transmis (« AAAA »). */
  annee: string;
  /** Date/heure ISO de l'echeance (3 janvier a 07:00). */
  echeanceISO: string;
}

/**
 * Determine l'exercice attendu par la DERNIERE echeance annuelle passee (3 janvier a 07:00).
 * Sert a detecter un envoi annuel du PDF d'historique qui n'est pas parti a la date
 * attendue. Pure : ne fait aucune requete.
 */
export function derniereAnneeAttendue(now = new Date()): EcheanceAnnuelle {
  let anneeEcheance = now.getFullYear();
  let echeance = new Date(anneeEcheance, 0, 3, 7, 0, 0);
  if (echeance.getTime() > now.getTime()) {
    anneeEcheance -= 1;
    echeance = new Date(anneeEcheance, 0, 3, 7, 0, 0);
  }
  // L'exercice transmis au mois de janvier de l'annee A est A-1.
  return { annee: String(anneeEcheance - 1), echeanceISO: echeance.toISOString() };
}

/**
 * Envoie un email de demonstration de l'alerte de taux : il montre le taux de reussite
 * actuel compare au seuil regle, afin de verifier le rendu et la reception de l'alerte.
 */
export async function testerAlerteTaux(to: string): Promise<ResultatEmailTest> {
  const { data, error } = await supabase.functions.invoke("send-test-email", {
    body: { to, tauxTest: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | { ok?: boolean; error?: string; to?: string; fromAddress?: string }
    | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du test de l'alerte de taux a échoué.");
  return { to: payload.to ?? to, fromAddress: payload.fromAddress ?? "", id: null };
}

/** Une entree de l'historique des envois de l'alerte « mot de passe ancien ». */
export interface HistoriqueMotDePasseEnvoiEntree {
  id: number;
  /** Adresse a laquelle l'alerte a ete envoyee. */
  destinataire: string | null;
  /** Anciennete du mot de passe (en jours) au moment de l'envoi. */
  anciennete_jours: number | null;
  /** Vrai pour un envoi de demonstration lance a la main, faux pour une alerte reelle automatique. */
  manuel: boolean;
  created_at: string;
}

/**
 * Charge l'historique des envois de l'alerte « mot de passe ancien » de l'artisan connecte,
 * du plus recent au plus ancien (RLS : chacun ne voit que ses propres envois). Sert a la
 * carte de suivi du Diagnostic et a son export CSV.
 */
export async function chargerHistoriqueEnvoisMotDePasse(
  limit = 30,
): Promise<HistoriqueMotDePasseEnvoiEntree[]> {
  const { data, error } = await supabase
    .from("mot_de_passe_alerte_historique")
    .select("id, destinataire, anciennete_jours, manuel, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    destinataire: row.destinataire == null ? null : String(row.destinataire),
    anciennete_jours: row.anciennete_jours == null ? null : Number(row.anciennete_jours),
    manuel: Boolean(row.manuel),
    created_at: String(row.created_at ?? ""),
  }));
}

/**
 * Exporte l'historique des envois de l'alerte « mot de passe ancien » au format CSV
 * (une ligne par envoi : date, heure, type, destinataire et anciennete en jours).
 * Compatible Excel (separateur « ; », accents geres).
 */
export function exporterHistoriqueEnvoisMotDePasse(entrees: HistoriqueMotDePasseEnvoiEntree[]): void {
  const rows = entrees.map((e) => {
    const d = new Date(e.created_at);
    const valide = !Number.isNaN(d.getTime());
    return [
      valide ? d.toLocaleDateString("fr-FR") : e.created_at,
      valide ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
      e.manuel ? "Test manuel" : "Automatique",
      e.destinataire ?? "",
      e.anciennete_jours != null ? String(e.anciennete_jours) : "",
    ];
  });
  const csv = toCsv(["Date", "Heure", "Type", "Destinataire", "Anciennete (jours)"], rows);
  downloadCsv(`historique-alerte-mot-de-passe-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

/** Rendu HTML de l'email d'alerte « mot de passe ancien », tel qu'il sera envoyé. */
export interface ApercuAlerteMotDePasse {
  /** HTML complet de l'email, à afficher dans un aperçu. */
  html: string;
  /** Nom de l'emetteur tel qu'il apparaitra dans l'email. */
  emetteurNom: string;
  /** Adresse a laquelle l'email serait envoye (celle du profil). */
  destinataire: string;
}

/**
 * Recupere le RENDU EXACT de l'email d'alerte « mot de passe ancien » sans rien envoyer :
 * la fonction Backend construit le HTML et le renvoie en mode « apercu ». Permet de verifier
 * la mise en page (texte, bouton, anciennete) avant tout envoi reel. Leve une erreur lisible
 * si l'apercu ne peut pas etre genere.
 */
export async function apercuAlerteMotDePasseAncien(userId: string): Promise<ApercuAlerteMotDePasse> {
  const { data, error } = await supabase.functions.invoke("alerte-mot-de-passe-ancien", {
    body: { userId, preview: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | { ok?: boolean; error?: string; html?: string; emetteurNom?: string; destinataire?: string }
    | null;
  if (!payload?.ok || !payload.html) {
    throw new Error(payload?.error || "L'aperçu de l'email n'a pas pu être généré.");
  }
  return {
    html: payload.html,
    emetteurNom: payload.emetteurNom ?? "",
    destinataire: payload.destinataire ?? "",
  };
}

/**
 * Récupère le RENDU EXACT de l'email du RÉCAP MENSUEL des alertes « mot de passe ancien »
 * sans rien envoyer : la fonction Backend construit le HTML et le renvoie en mode « aperçu ».
 * Permet de vérifier la mise en page avant tout envoi réel. Lève une erreur lisible en cas d'échec.
 */
export async function apercuRecapMensuelMotDePasse(userId: string): Promise<ApercuAlerteMotDePasse> {
  const { data, error } = await supabase.functions.invoke("recap-mensuel-mot-de-passe", {
    body: { userId, preview: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | { ok?: boolean; error?: string; html?: string; emetteurNom?: string; destinataire?: string }
    | null;
  if (!payload?.ok || !payload.html) {
    throw new Error(payload?.error || "L'aperçu du récap mensuel n'a pas pu être généré.");
  }
  return {
    html: payload.html,
    emetteurNom: payload.emetteurNom ?? "",
    destinataire: payload.destinataire ?? "",
  };
}

/**
 * Récupère le RENDU EXACT de l'email du RÉCAP TRIMESTRIEL des alertes « mot de passe ancien »
 * (listing des récaps mensuels du trimestre écoulé) sans rien envoyer : la fonction Backend
 * construit le HTML et le renvoie en mode « aperçu ». Lève une erreur lisible en cas d'échec.
 */
export async function apercuRecapTrimestrielMotDePasse(userId: string): Promise<ApercuAlerteMotDePasse> {
  const { data, error } = await supabase.functions.invoke("recap-trimestriel-mot-de-passe", {
    body: { userId, preview: true },
  });
  if (error) throw new Error(error.message);
  const payload = data as
    | { ok?: boolean; error?: string; html?: string; emetteurNom?: string; destinataire?: string }
    | null;
  if (!payload?.ok || !payload.html) {
    throw new Error(payload?.error || "L'aperçu du récap trimestriel n'a pas pu être généré.");
  }
  return {
    html: payload.html,
    emetteurNom: payload.emetteurNom ?? "",
    destinataire: payload.destinataire ?? "",
  };
}