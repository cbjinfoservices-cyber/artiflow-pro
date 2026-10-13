// Helpers et constantes partagés du domaine « relances / escalade serveur ».
// Regroupés ici pour être réutilisés par la page Relances et ses composants découpés.

import { downloadCsv, toCsv } from "@/lib/csv";
import type { EscaladeJournalItem } from "@/hooks/useArtisanData";

/** Nombre de jours entiers écoulés depuis la date prévue (0 si non dépassée). */
export function joursDeRetard(datePrevue: string | null): number {
  if (!datePrevue) return 0;
  const d = new Date(`${datePrevue.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

/** Heure + date d'un passage d'escalade serveur (ex. « 07 oct. 14:00 »). */
export function formatRunTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Exporte les passages d'escalade serveur au format CSV : une ligne par passage (date, heure,
 * dossiers examinés, envois réussis, échecs et détail des clients non envoyés). Un intervalle
 * de dates optionnel (`from` / `to`, format AAAA-MM-JJ) restreint l'export à la plage choisie ;
 * laissé vide, tout l'historique fourni est exporté. Compatible Excel (séparateur « ; », BOM UTF-8).
 * Renvoie le nombre de passages réellement exportés (0 si aucun sur la plage).
 */
export function exporterJournalEscalade(
  journal: EscaladeJournalItem[],
  opts: { from?: string | null; to?: string | null } = {},
): { exported: number } {
  const fromTs = opts.from ? Date.parse(`${opts.from.slice(0, 10)}T00:00:00`) : null;
  const toTs = opts.to ? Date.parse(`${opts.to.slice(0, 10)}T23:59:59`) : null;

  const filtres = journal.filter((run) => {
    const t = Date.parse(run.run_at);
    if (Number.isNaN(t)) return fromTs === null && toTs === null;
    if (fromTs !== null && t < fromTs) return false;
    if (toTs !== null && t > toTs) return false;
    return true;
  });
  if (!filtres.length) return { exported: 0 };

  const rows = filtres.map((run) => {
    const d = new Date(run.run_at);
    const valide = !Number.isNaN(d.getTime());
    const detail = run.clientsEchoues
      .map((c) => {
        const numero = c.numero ? ` (${c.numero})` : "";
        const retard = c.jours > 0 ? ` - ${c.jours} j de retard` : "";
        return `${c.nom}${numero} [${c.canal}]${retard} : ${c.erreur}`;
      })
      .join(" | ");
    return [
      valide ? d.toLocaleDateString("fr-FR") : run.run_at,
      valide ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
      String(run.examined),
      String(run.envoye),
      String(run.echoue),
      detail,
    ];
  });
  const csv = toCsv(
    ["Date", "Heure", "Dossiers examinés", "Envois réussis", "Échecs", "Clients non envoyés"],
    rows,
  );
  const suffixe =
    opts.from && opts.to ? `${opts.from.slice(0, 10)}_${opts.to.slice(0, 10)}` : new Date().toISOString().slice(0, 10);
  downloadCsv(`journal-escalade-${suffixe}.csv`, csv);
  return { exported: filtres.length };
}

/** Seuils de reprogrammations proposés pour déclencher l'escalade automatique. */
export const SEUIL_OPTIONS = [2, 3, 5] as const;
export const SEUIL_DEFAUT = 3;
/** Décalage par défaut (en jours) proposé pour les boutons « Dupliquer » et « Tout reprogrammer ». */
export const DECALAGE_OPTIONS = [7, 14] as const;
export const DECALAGE_DEFAUT = 7;
/** Seuil (en jours de retard) au-delà duquel une relance est escaladée automatiquement. */
export const ESCALADE_RETARD_OPTIONS = [15, 30, 60] as const;
export const ESCALADE_RETARD_DEFAUT = 30;
/** Paliers de « nombre de jours de retard » pour cibler les dossiers critiques. */
export const RETARD_PERIODES = [
  { value: 0, label: "Toutes" },
  { value: 7, label: "+7 j" },
  { value: 30, label: "+30 j" },
  { value: 60, label: "+60 j" },
] as const;

/** Canaux d'envoi d'une relance, utilisés pour filtrer le récapitulatif email. */
export const CANAUX = ["Email", "SMS", "WhatsApp"] as const;
export const CANAUX_DEFAUT: string[] = ["Email", "SMS", "WhatsApp"];

/** Paliers (en jours) du seuil « devis sans réponse » inclus dans le récapitulatif email. */
export const RECAP_DEVIS_SEUIL_OPTIONS = [7, 14, 21] as const;
export const RECAP_DEVIS_SEUIL_DEFAUT = 7;

/** Paliers (en jours de retard) de la relance automatique des factures critiques. */
export const RECAP_RELANCE_FACTURE_SEUIL_OPTIONS = [30, 60] as const;
export const RECAP_RELANCE_FACTURE_SEUIL_DEFAUT = 30;

/**
 * Délai minimum (en jours) entre deux rappels d'une même facture : évite de relancer
 * deux fois de suite le même client. 0 = pas de garde-fou.
 */
export const RELANCE_FACTURE_DELAI_OPTIONS = [7, 14, 30] as const;
export const RELANCE_FACTURE_DELAI_DEFAUT = 14;

/** Durées (en jours) proposées pour la pause vacances. */
export const PAUSE_OPTIONS = [3, 7, 14, 30] as const;
export const PAUSE_DEFAUT = 7;

/** La pause vacances est active tant que la date de fin n'est pas dépassée. */
export function estPauseActive(dateFin?: string | null): boolean {
  if (!dateFin) return false;
  const d = new Date(`${String(dateFin).slice(0, 10)}T23:59:59`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() >= Date.now();
}

/** Nombre de jours restants de pause (0 si aucune pause active). */
export function joursPauseRestants(dateFin?: string | null): number {
  if (!dateFin || !estPauseActive(dateFin)) return 0;
  const d = new Date(`${String(dateFin).slice(0, 10)}T23:59:59`);
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
}

/** Formate une date de fin de pause en « 07 oct. ». */
export function formatPauseFin(dateFin?: string | null): string {
  if (!dateFin) return "—";
  const d = new Date(`${String(dateFin).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}