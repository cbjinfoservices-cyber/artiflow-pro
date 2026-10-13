import type { AlerteAutoRelance } from "@/lib/recontactSeuil";

/** Nombre d'alertes par mois sur une période glissante de `moisAffiches` mois. */
export interface PointMois {
  /** Clé « AAAA-MM ». */
  cle: string;
  /** Libellé court (ex. « oct. 25 »). */
  label: string;
  /** Nombre d'alertes envoyées sur ce mois. */
  count: number;
}

/**
 * Répartit les alertes artisan par mois sur une période glissante : du plus ancien mois affiché
 * jusqu'au mois courant. Logique partagée entre le mini-graphe (rendu des barres) et la carte
 * d'historique (export PNG/ZIP), pour garantir un contenu identique côté écran et côté fichier.
 */
export function pointsAlertesParMois(items: AlerteAutoRelance[], moisAffiches: number): PointMois[] {
  // Compte les alertes par mois (clé « AAAA-MM »).
  const parMois = new Map<string, number>();
  items.forEach((a) => {
    const d = new Date(a.envoyeLe);
    if (Number.isNaN(d.getTime())) return;
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    parMois.set(cle, (parMois.get(cle) ?? 0) + 1);
  });

  // Période glissante : du plus ancien mois affiché jusqu'au mois courant.
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("fr-FR", { month: "short" });
  const resultat: PointMois[] = [];
  for (let i = moisAffiches - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    resultat.push({
      cle,
      label: `${fmt.format(d).replace(".", "")} ${String(d.getFullYear()).slice(2)}`,
      count: parMois.get(cle) ?? 0,
    });
  }
  return resultat;
}