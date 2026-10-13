import { supabase } from "@/lib/supabase";
import { downloadCsv, toCsv } from "@/lib/csv";

/** Un envoi raté (test email ou relance d'escalade) avec son contexte. */
export interface EchecEnvoiDetail {
  /** Horodatage ISO de l'échec. */
  quand: string;
  /** Canal concerné (« Email », « SMS », « WhatsApp »…). */
  canal: string;
  /** Destinataire (adresse ou numéro), ou nom du client à défaut. */
  destinataire: string;
  /** Message d'erreur renvoyé par le service d'envoi, si connu. */
  message: string | null;
  /** Origine de l'échec : test manuel ou passage d'escalade automatique. */
  source: "test" | "escalade";
}

/** Récapitulatif des échecs d'envoi sur une fenêtre glissante de N jours. */
export interface RecapEchecsEnvoi {
  /** Taille de la fenêtre analysée, en jours (1 = 24 h). */
  jours: number;
  /** Nombre total d'envois ratés sur la fenêtre. */
  total: number;
  /** Dont tests email de validation ratés. */
  testsEchoues: number;
  /** Dont relances d'escalade automatique ratées. */
  relancesEchouees: number;
  /** Nombre de passages d'escalade en échec. */
  passagesEscalade: number;
  /** Répartition des échecs par canal (du plus fréquent au moins fréquent). */
  parCanal: { canal: string; count: number }[];
  /** Les derniers échecs détaillés (les plus récents d'abord). */
  derniers: EchecEnvoiDetail[];
  /** Id des relances d'escalade en échec sur la fenêtre, pour un réessai ciblé. */
  idsEscalade: number[];
}

function recapVide(jours: number): RecapEchecsEnvoi {
  return {
    jours,
    total: 0,
    testsEchoues: 0,
    relancesEchouees: 0,
    passagesEscalade: 0,
    parCanal: [],
    derniers: [],
    idsEscalade: [],
  };
}

function str(value: unknown, defaut = ""): string {
  return value === null || value === undefined ? defaut : String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function liste(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

/**
 * Agrège, sur une fenêtre glissante de `jours` jours, les échecs d'envoi consignés
 * côté Backend : les tests email de validation ratés et les relances d'escalade
 * automatique ratées. `jours = 1` correspond aux dernières 24 heures.
 * Ne lève jamais : en cas d'erreur de lecture, renvoie un récapitulatif vide.
 */
export async function chargerEchecsEnvoiRecap(
  jours: number,
  userId?: string | null,
): Promise<RecapEchecsEnvoi> {
  const fenetre = [1, 7, 30].includes(jours) ? jours : 1;
  const depuis = new Date(Date.now() - fenetre * 24 * 60 * 60 * 1000).toISOString();
  try {
    let testsQuery = supabase
      .from("email_test_historique")
      .select("destinataire, message, created_at, resultat, user_id")
      .neq("resultat", "succes")
      .gte("created_at", depuis)
      .order("created_at", { ascending: false });
    if (userId) testsQuery = testsQuery.eq("user_id", userId);

    const [testsRes, journalRes] = await Promise.all([
      testsQuery,
      supabase
        .from("escalade_journal")
        .select("run_at, echoue, clients_echoues, relances_echouees")
        .gte("run_at", depuis)
        .order("run_at", { ascending: false }),
    ]);

    const tests = testsRes.error ? [] : ((testsRes.data ?? []) as Array<Record<string, unknown>>);
    const passages = journalRes.error ? [] : ((journalRes.data ?? []) as Array<Record<string, unknown>>);

    const details: EchecEnvoiDetail[] = [];
    const canaux = new Map<string, number>();
    const idsEscalade = new Set<number>();

    const ajouterCanal = (canal: string) => {
      const cle = canal || "Email";
      canaux.set(cle, (canaux.get(cle) ?? 0) + 1);
    };

    // Tests email de validation ratés.
    tests.forEach((t) => {
      details.push({
        quand: str(t.created_at),
        canal: "Email",
        destinataire: str(t.destinataire, "—"),
        message: t.message == null ? null : str(t.message),
        source: "test",
      });
      ajouterCanal("Email");
    });

    // Relances d'escalade automatique ratées.
    let passagesEscalade = 0;
    let relancesEchouees = 0;
    passages.forEach((p) => {
      const echoue = num(p.echoue);
      if (echoue <= 0) return;
      passagesEscalade += 1;
      relancesEchouees += echoue;
      const runAt = str(p.run_at);
      liste(p.clients_echoues).forEach((c) => {
        const canal = str(c.canal, "Email");
        details.push({
          quand: runAt,
          canal,
          destinataire: str(c.numero) || str(c.nom, "—"),
          message: c.erreur == null ? null : str(c.erreur),
          source: "escalade",
        });
        ajouterCanal(canal);
      });
      liste(p.relances_echouees).forEach((v) => {
        const id = num(v);
        if (id > 0) idsEscalade.add(id);
      });
    });

    const parCanal = Array.from(canaux.entries())
      .map(([canal, count]) => ({ canal, count }))
      .sort((a, b) => b.count - a.count);

    const derniers = details
      .slice()
      .sort((a, b) => a.quand.localeCompare(b.quand))
      .reverse()
      .slice(0, 5);

    return {
      jours: fenetre,
      total: tests.length + relancesEchouees,
      testsEchoues: tests.length,
      relancesEchouees,
      passagesEscalade,
      parCanal,
      derniers,
      idsEscalade: Array.from(idsEscalade),
    };
  } catch {
    return recapVide(fenetre);
  }
}

/** Une entrée du petit historique des réessais lancés depuis le tableau de bord. */
export interface ReessaiHistorique {
  id: number;
  /** Date et heure du réessai (ISO). */
  quand: string;
  /** Fenêtre visée lors du réessai, en jours. */
  fenetreJours: number;
  /** Nombre d'envois relancés avec succès. */
  relancesRelancees: number;
  /** Nombre d'envois encore en échec après le réessai. */
  relancesEchouees: number;
  /** Un test email de validation a-t-il été renvoyé ? */
  testRelance: boolean;
  /** Résumé lisible du résultat, ou null. */
  resume: string | null;
}

/**
 * Récupère les derniers réessais lancés par l'artisan (le plus récent en premier),
 * pour afficher un petit historique (date + résultat) sous le bouton « Réessayer ».
 * RLS garantit qu'un artisan ne voit que ses propres réessais.
 */
export async function chargerHistoriqueReessais(
  userId: string,
  limite = 5,
): Promise<ReessaiHistorique[]> {
  try {
    const { data, error } = await supabase
      .from("reessais_envoi_historique")
      .select("id, created_at, fenetre_jours, relances_relancees, relances_echouees, test_relance, resume")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limite);
    if (error) return [];
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id),
      quand: String(row.created_at ?? ""),
      fenetreJours: num(row.fenetre_jours) || 1,
      relancesRelancees: num(row.relances_relancees),
      relancesEchouees: num(row.relances_echouees),
      testRelance: Boolean(row.test_relance),
      resume: row.resume == null ? null : String(row.resume),
    }));
  } catch {
    return [];
  }
}

/**
 * Consigne un réessai dans le journal (date + résultat), pour le petit historique
 * affiché sous le bouton « Réessayer ». N'échoue jamais bruyamment : l'action de
 * réessai elle-même ne doit pas être bloquée par une erreur d'écriture du journal.
 */
export async function enregistrerReessai(
  userId: string,
  payload: {
    fenetreJours: number;
    relancesRelancees: number;
    relancesEchouees: number;
    testRelance: boolean;
    resume: string;
  },
): Promise<void> {
  try {
    await supabase.from("reessais_envoi_historique").insert({
      user_id: userId,
      fenetre_jours: payload.fenetreJours,
      relances_relancees: payload.relancesRelancees,
      relances_echouees: payload.relancesEchouees,
      test_relance: payload.testRelance,
      resume: payload.resume,
    });
  } catch {
    /* le journal est best effort : on n'interrompt pas le réessai pour autant */
  }
}

/** Libellé court d'une fenêtre de réessai, en jours (1 = 24 h). */
function libelleFenetre(jours: number): string {
  return jours === 1 ? "24 h" : `${jours} j`;
}

/**
 * Exporte le journal des réessais au format CSV (date, heure, fenêtre, résultat et
 * compteurs), pour garder une trace horodatée des tentatives. Compatible Excel
 * (séparateur « ; », accents gérés).
 */
export function exporterHistoriqueReessais(historique: ReessaiHistorique[]): void {
  if (!historique.length) return;
  const rows = historique.map((h) => {
    const d = new Date(h.quand);
    const valide = !Number.isNaN(d.getTime());
    const resultat =
      h.resume ||
      (h.relancesEchouees > 0
        ? `${h.relancesEchouees} envoi(s) encore en échec`
        : h.relancesRelancees > 0
          ? `${h.relancesRelancees} envoi(s) relancé(s)`
          : "Réessai effectué");
    return [
      valide ? d.toLocaleDateString("fr-FR") : h.quand,
      valide ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
      libelleFenetre(h.fenetreJours),
      resultat,
      String(h.relancesRelancees),
      String(h.relancesEchouees),
      h.testRelance ? "Oui" : "Non",
    ];
  });
  const csv = toCsv(
    ["Date", "Heure", "Fenêtre", "Résultat", "Envois relancés", "Encore en échec", "Test email"],
    rows,
  );
  downloadCsv(`journal-reessais-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

/**
 * Demande au Backend d'alerter l'artisan par email lorsqu'un réessai reste en échec
 * après plusieurs tentatives consécutives. La décision (au moins `seuil` échecs d'affilée —
 * seuil réglable, 2 / 3 / 5) et l'envoi sont faits côté serveur, pour éviter tout spam et
 * garder la clé Resend protégée. Avec `test: true`, un email de démonstration est envoyé pour
 * vérifier le rendu. Renvoie si un email a réellement été expédié, plus la raison éventuelle.
 */
export async function envoyerAlerteReessaiEchec(
  opts: { seuil?: number; test?: boolean } = {},
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("alerte-reessai-echec", {
      body: { seuil: opts.seuil, test: opts.test === true },
    });
    if (error) return { sent: false };
    const payload = data as { ok?: boolean; sent?: boolean; reason?: string } | null;
    return { sent: Boolean(payload?.sent), reason: payload?.reason };
  } catch {
    return { sent: false };
  }
}