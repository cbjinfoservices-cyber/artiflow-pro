import type { DiagnosticPaiementEur } from "@/lib/abonnementPaiement";

/** Clé de session où est mémorisé le dernier diagnostic de paiement. */
const CLE_CACHE = "artiflow.diagnostic.paiement-eur";

/** Durée de validité du diagnostic mis en cache (10 minutes). */
export const DUREE_CACHE_DIAGNOSTIC_MS = 10 * 60 * 1000;

/**
 * Lit le diagnostic de paiement mémorisé (s'il n'a pas expiré). Renvoie `null` si
 * aucun diagnostic valide n'est disponible ou si le stockage est inaccessible.
 */
export function lireCacheDiagnosticPaiement(): DiagnosticPaiementEur | null {
  try {
    const brut = window.sessionStorage.getItem(CLE_CACHE);
    if (!brut) return null;
    const enveloppe = JSON.parse(brut) as { horodatage?: number; diagnostic?: DiagnosticPaiementEur };
    if (!enveloppe?.diagnostic || typeof enveloppe.horodatage !== "number") return null;
    if (Date.now() - enveloppe.horodatage > DUREE_CACHE_DIAGNOSTIC_MS) return null;
    return enveloppe.diagnostic;
  } catch {
    return null;
  }
}

/** Mémorise le diagnostic de paiement pour éviter d'appeler le Backend à chaque navigation. */
export function ecrireCacheDiagnosticPaiement(diagnostic: DiagnosticPaiementEur): void {
  try {
    window.sessionStorage.setItem(CLE_CACHE, JSON.stringify({ horodatage: Date.now(), diagnostic }));
  } catch {
    /* stockage indisponible : on continue sans cache */
  }
}

/**
 * Vide le cache du diagnostic de paiement. Appelé après un paiement réussi : ainsi le
 * bandeau « paiement indisponible » de la page Tarifs ne reste pas affiché à tort tant
 * que le cache n'a pas expiré.
 */
export function viderCacheDiagnosticPaiement(): void {
  try {
    window.sessionStorage.removeItem(CLE_CACHE);
  } catch {
    /* stockage indisponible : rien à faire */
  }
}