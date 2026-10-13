/** Un point du mini-graphe : le nombre d'alertes Stripe détectées un jour donné. */
export interface PointJourAlerte {
  /** Clé « AAAA-MM-JJ ». */
  cle: string;
  /** Libellé court (ex. « 12 oct »). */
  label: string;
  /** Nombre d'alertes détectées ce jour-là. */
  count: number;
}

/** Une alerte telle que nécessaire au calcul du délai de traitement. */
export interface AlertePourDelai {
  /** Horodatage ISO de détection de l'alerte. */
  created_at: string;
  /** Statut de traitement (« nouvelle » ou « traitee »). */
  statut: string;
  /** Horodatage ISO du marquage « traitée » (vide si non traitée). */
  traite_at: string;
}

/** Synthèse du délai de traitement (détection → marquage « traitée »). */
export interface DelaiTraitement {
  /** Délai moyen en millisecondes, ou null si aucune alerte traitée exploitable. */
  moyenneMs: number | null;
  /** Délai le plus court observé (ms), ou null. */
  minMs: number | null;
  /** Délai le plus long observé (ms), ou null. */
  maxMs: number | null;
  /** Nombre d'alertes prises en compte dans la moyenne. */
  nb: number;
}

/**
 * Calcule le délai moyen entre la détection d'une alerte et son marquage « traitée ».
 * Seules les alertes effectivement traitées (avec une date de traitement postérieure à la
 * détection) sont prises en compte ; les délais aberrants ou incomplets sont ignorés.
 */
export function delaiMoyenTraitement(items: AlertePourDelai[]): DelaiTraitement {
  const delais: number[] = [];
  items.forEach((it) => {
    if (it.statut !== "traitee" || !it.traite_at) return;
    const debut = new Date(it.created_at).getTime();
    const fin = new Date(it.traite_at).getTime();
    if (Number.isNaN(debut) || Number.isNaN(fin)) return;
    const d = fin - debut;
    if (d < 0) return;
    delais.push(d);
  });

  if (delais.length === 0) {
    return { moyenneMs: null, minMs: null, maxMs: null, nb: 0 };
  }
  const somme = delais.reduce((s, d) => s + d, 0);
  return {
    moyenneMs: somme / delais.length,
    minMs: Math.min(...delais),
    maxMs: Math.max(...delais),
    nb: delais.length,
  };
}

/** Convertit une date en clé « AAAA-MM-JJ » (jour calendaire local). */
function cleJour(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Répartit les alertes de configuration Stripe par jour sur une période glissante
 * (du plus ancien jour affiché jusqu'à aujourd'hui inclus). Utilisé par le mini-graphe
 * de fréquence affiché dans le back-office.
 */
export function pointsAlertesParJour(
  items: { created_at: string }[],
  jours = 30,
): PointJourAlerte[] {
  const parJour = new Map<string, number>();
  items.forEach((it) => {
    const d = new Date(it.created_at);
    if (Number.isNaN(d.getTime())) return;
    const cle = cleJour(d);
    parJour.set(cle, (parJour.get(cle) ?? 0) + 1);
  });

  const now = new Date();
  const fmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" });
  const resultat: PointJourAlerte[] = [];
  for (let i = jours - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const cle = cleJour(d);
    resultat.push({ cle, label: fmt.format(d).replace(".", ""), count: parJour.get(cle) ?? 0 });
  }
  return resultat;
}