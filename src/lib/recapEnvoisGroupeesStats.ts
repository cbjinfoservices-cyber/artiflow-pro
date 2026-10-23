/**
 * Calculs partagés du récap mensuel des envois groupés.
 *
 * Toutes les cartes (suivi des emails clients, comparaison de deux mois) et le PDF
 * s'appuient sur ces mêmes fonctions : les chiffres affichés ne peuvent donc jamais
 * diverger d'un écran à l'autre.
 */

/** Une ligne légère du journal des emails clients (jamais le contenu des emails). */
export interface SuiviNotificationRow {
  chantier_id: number;
  created_at: string;
  /** « manuel », « groupe » ou « auto ». */
  origine: string;
  destinataire: string | null;
}

/** Un envoi groupé daté, pour le détail du PDF. */
export interface RecapEnvoiGroupeDetail {
  chantierId: number;
  destinataire: string | null;
  at: string;
}

/** Récapitulatif complet d'un mois donné. */
export interface RecapMoisStats {
  /** Clé du mois « AAAA-MM ». */
  cle: string;
  /** Nombre d'emails groupés réellement partis ce mois-ci. */
  emailsGroupees: number;
  /** Identifiants des chantiers distincts relancés par un envoi groupé. */
  chantiersRelances: number[];
  /** Détail daté des envois groupés du mois (du plus récent au plus ancien). */
  details: RecapEnvoiGroupeDetail[];
  /** Délai moyen (jours) avant l'email suivant sur le même chantier, ou null. */
  delaiMoyenJours: number | null;
  /** Envois groupés du mois encore sans email suivant. */
  enAttente: number;
  /** Ancienneté moyenne (jours) de ces envois en attente. */
  attenteMoyenneJours: number | null;
}

/** Clé « AAAA-MM » d'une date. */
export function cleMois(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Clé « AAAA-MM » du mois en cours. */
export function cleMoisCourant(): string {
  return cleMois(new Date());
}

/** Clé « AAAA-MM » d'un décalage par rapport au mois en cours (0 = ce mois, -1 = le précédent). */
export function cleMoisDecale(decalage: number): string {
  const now = new Date();
  return cleMois(new Date(now.getFullYear(), now.getMonth() + decalage, 1));
}

/** Libellé lisible d'un mois (« Août 2026 »). */
export function libelleMoisRecap(cle: string): string {
  const [annee, mois] = cle.split("-").map((v) => Number(v));
  if (!annee || !mois) return cle;
  const label = new Date(annee, mois - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Libellé court d'un mois (« août 26 »), pour les sélecteurs compacts. */
export function libelleMoisCourt(cle: string): string {
  const [annee, mois] = cle.split("-").map((v) => Number(v));
  if (!annee || !mois) return cle;
  return new Date(annee, mois - 1, 1).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
}

/** Première borne [début, fin[ d'un mois « AAAA-MM ». */
export function bornesMois(cle: string): { debut: number; fin: number } {
  const [annee, mois] = cle.split("-").map((v) => Number(v));
  const debut = new Date(annee, (mois ?? 1) - 1, 1).getTime();
  const fin = new Date(annee, (mois ?? 1), 1).getTime();
  return { debut, fin };
}

/** Liste des N derniers mois (clé la plus récente d'abord), mois en cours inclus. */
export function listeMoisRecents(nombre = 12): string[] {
  const now = new Date();
  return Array.from({ length: Math.max(1, nombre) }, (_, i) =>
    cleMois(new Date(now.getFullYear(), now.getMonth() - i, 1)),
  );
}

function moyenne(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  const somme = valeurs.reduce((total, v) => total + v, 0);
  return Math.round((somme / valeurs.length) * 10) / 10;
}

/**
 * Calcule le récap d'un mois précis à partir des lignes du journal.
 * `maintenant` permet de figer l'ancienneté des envois en attente (tests / comparaison).
 */
export function calculerRecapMois(
  rows: SuiviNotificationRow[],
  cle: string,
  maintenant: number = Date.now(),
): RecapMoisStats {
  const { debut, fin } = bornesMois(cle);
  const parChantier = new Map<number, Array<{ at: number; origine: string; destinataire: string | null }>>();

  rows.forEach((row) => {
    const id = Number(row.chantier_id);
    if (!Number.isFinite(id)) return;
    const at = new Date(String(row.created_at ?? "")).getTime();
    if (!Number.isFinite(at)) return;
    const liste = parChantier.get(id) ?? [];
    liste.push({
      at,
      origine: String(row.origine ?? "manuel"),
      destinataire: row.destinataire === null || row.destinataire === undefined ? null : String(row.destinataire),
    });
    parChantier.set(id, liste);
  });

  const chantiersRelances = new Set<number>();
  const details: RecapEnvoiGroupeDetail[] = [];
  const delais: number[] = [];
  const attentes: number[] = [];
  let emailsGroupees = 0;

  parChantier.forEach((liste, chantierId) => {
    const triee = [...liste].sort((a, b) => a.at - b.at);
    triee.forEach((item, index) => {
      if (item.origine !== "groupe") return;
      // Un envoi hors du mois observé (avant ou après) compte seulement comme « email suivant ».
      if (item.at < debut || item.at >= fin) return;
      emailsGroupees += 1;
      chantiersRelances.add(chantierId);
      details.push({
        chantierId,
        destinataire: item.destinataire,
        at: new Date(item.at).toISOString(),
      });
      const suivant = triee.slice(index + 1).find((x) => x.at > item.at);
      if (suivant) {
        delais.push((suivant.at - item.at) / 86_400_000);
      } else {
        attentes.push(Math.max(0, (maintenant - item.at) / 86_400_000));
      }
    });
  });

  return {
    cle,
    emailsGroupees,
    chantiersRelances: Array.from(chantiersRelances),
    details: details.sort((a, b) => b.at.localeCompare(a.at)),
    delaiMoyenJours: moyenne(delais),
    enAttente: attentes.length,
    attenteMoyenneJours: moyenne(attentes),
  };
}