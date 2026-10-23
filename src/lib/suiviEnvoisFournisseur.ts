import { supabase } from "@/lib/supabase";

/**
 * Une trace d'envoi d'email, écrite par les fonctions Backend au moment de l'expédition.
 * `fournisseur` vaut « resend », le canal d'envoi unique depuis la bascule.
 * `repli = true` n'est plus utilisé : il ne reste qu'un seul fournisseur.
 */
export interface TraceEnvoiFournisseur {
  id: number;
  fonction: string;
  fournisseur: string;
  statut: string;
  repli: boolean;
  message: string | null;
  created_at: string;
}

/** Synthèse par fournisseur sur la période observée. */
export interface StatsFournisseur {
  fournisseur: string;
  label: string;
  icon: string;
  total: number;
  succes: number;
  echecs: number;
  replis: number;
  taux: number;
  dernierEnvoi: string | null;
  derniereErreur: string | null;
  derniereErreurAt: string | null;
}

/** Résultat complet du suivi des envois, prêt à afficher. */
export interface SuiviEnvois {
  stats: StatsFournisseur[];
  total: number;
  totalReplis: number;
  envoisSauves: number;
  traces: TraceEnvoiFournisseur[];
}

const COLONNES = "id, fonction, fournisseur, statut, repli, message, created_at";

const META: Record<string, { label: string; icon: string }> = {
  resend: { label: "Resend", icon: "ri-send-plane-line" },
};

function toStr(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function mapRow(row: Record<string, unknown>): TraceEnvoiFournisseur {
  return {
    id: Number(row.id) || 0,
    fonction: String(row.fonction ?? "envoi"),
    fournisseur: String(row.fournisseur ?? "inconnu"),
    statut: String(row.statut ?? "echec"),
    repli: row.repli === true,
    message: toStr(row.message),
    created_at: toStr(row.created_at) ?? new Date().toISOString(),
  };
}

/**
 * Charge l'historique récent des tentatives d'envoi et calcule, pour chaque fournisseur,
 * le taux de réussite réel. Sert à la carte de suivi du back-office : on veut voir d'un
 * coup d'œil si Resend tient la charge, et repérer les envois en échec.
 */
export async function chargerSuiviEnvois(jours = 30): Promise<SuiviEnvois> {
  const depuis = new Date(Date.now() - jours * 86400000).toISOString();
  const { data, error } = await supabase
    .from("envoi_fournisseur_historique")
    .select(COLONNES)
    .gte("created_at", depuis)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;

  const traces = ((data ?? []) as Array<Record<string, unknown>>).map(mapRow);
  const parFournisseur = new Map<string, StatsFournisseur>();

  traces.forEach((t) => {
    const cle = t.fournisseur.toLowerCase();
    const meta = META[cle] ?? { label: t.fournisseur, icon: "ri-mail-line" };
    const courant =
      parFournisseur.get(cle) ??
      ({
        fournisseur: cle,
        label: meta.label,
        icon: meta.icon,
        total: 0,
        succes: 0,
        echecs: 0,
        replis: 0,
        taux: 0,
        dernierEnvoi: null,
        derniereErreur: null,
        derniereErreurAt: null,
      } satisfies StatsFournisseur);

    courant.total += 1;
    if (t.statut === "succes") {
      courant.succes += 1;
      if (!courant.dernierEnvoi) courant.dernierEnvoi = t.created_at;
    } else {
      courant.echecs += 1;
      if (!courant.derniereErreurAt) {
        courant.derniereErreurAt = t.created_at;
        courant.derniereErreur = t.message;
      }
    }
    if (t.repli) courant.replis += 1;
    parFournisseur.set(cle, courant);
  });

  const stats = [...parFournisseur.values()].map((s) => ({
    ...s,
    taux: s.total > 0 ? Math.round((s.succes / s.total) * 100) : 0,
  }));

  // Resend d'abord (canal d'envoi unique), puis les autres par volume décroissant : la
  // lecture suit l'ordre logique du dispositif, pas l'ordre alphabétique.
  stats.sort((a, b) => {
    if (a.fournisseur === "resend") return -1;
    if (b.fournisseur === "resend") return 1;
    return b.total - a.total;
  });

  const totalReplis = traces.filter((t) => t.repli).length;
  const envoisSauves = traces.filter((t) => t.repli && t.statut === "succes").length;

  return { stats, total: traces.length, totalReplis, envoisSauves, traces };
}