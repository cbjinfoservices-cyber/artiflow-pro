import { useEffect, useState, type RefObject } from "react";
import type { FactureItem, RelanceItem } from "@/hooks/useArtisanData";
import { marquerEscaladeAuto } from "@/lib/artisanApi";
import { buildFacturePdfById } from "@/lib/facturePdf";
import { sendRelanceEmail, sendRelanceSms } from "@/lib/email";
import { pdfToBase64 } from "@/lib/pdf";
import { todayISO } from "@/lib/dates";
import { joursDeRetard } from "@/lib/relances";

/**
 * Construit la pièce jointe PDF de la facture liée à un devis (pour l'attacher à une relance).
 * Renvoie null si aucune facture n'est rattachée ou si la génération échoue.
 */
export async function buildFactureAttachment(
  factures: FactureItem[],
  devisId: number,
): Promise<{ pdfBase64: string; filename: string } | null> {
  const facture = factures.find((f) => f.devis_id === devisId);
  if (!facture) return null;
  try {
    const result = await buildFacturePdfById(facture.id);
    if (!result) return null;
    return { pdfBase64: pdfToBase64(result.doc), filename: `${result.numero}.pdf` };
  } catch {
    return null;
  }
}

export interface EscaladeAuto {
  /** Un envoi automatique d'escalade est en cours. */
  autoSending: boolean;
  /** Message de succès après une escalade automatique. */
  autoNotice: string | null;
  /** Message d'erreur après une escalade automatique. */
  autoError: string | null;
  clearAuto: () => void;
}

interface Params {
  relances: RelanceItem[];
  factures: FactureItem[];
  auto: boolean;
  seuil: number;
  escaladeRetard: number;
  /** Garde d'exécution unique fournie par useRelancesAuto (une seule escalade par session). */
  autoEscalatedRef: RefObject<boolean>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Escalade automatique des relances critiques : toute relance dépassée qui est soit
 * repoussée plusieurs fois (seuil), soit en retard de plus de N jours, est renvoyée au
 * client dès que l'écran est ouvert — sans aucune action manuelle (si les relances auto
 * sont actives). Logique partagée entre la page Relances et le tableau de bord, pour
 * déclencher l'escalade depuis n'importe quel écran.
 */
export function useEscaladeAuto({
  relances,
  factures,
  auto,
  seuil,
  escaladeRetard,
  autoEscalatedRef,
  loading,
  error,
  reload,
}: Params): EscaladeAuto {
  const [autoSending, setAutoSending] = useState(false);
  const [autoNotice, setAutoNotice] = useState<string | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || error || !auto) return;
    if (autoEscalatedRef.current) return;
    const today = todayISO();
    const candidates = relances.filter(
      (r) =>
        r.statut !== "Envoyée" &&
        r.actif &&
        r.date_prevue !== null &&
        r.date_prevue.slice(0, 10) < today &&
        (r.reprogrammations >= seuil || joursDeRetard(r.date_prevue) >= escaladeRetard),
    );
    if (candidates.length === 0) return;
    autoEscalatedRef.current = true;
    let cancelled = false;
    (async () => {
      setAutoSending(true);
      let sent = 0;
      let failed = 0;
      for (const r of candidates) {
        if (cancelled) break;
        try {
          if (r.canal === "Email") {
            const attach = await buildFactureAttachment(factures, r.devis_id);
            await sendRelanceEmail(r.id, attach?.pdfBase64, attach?.filename, true);
          } else {
            await sendRelanceSms(r.id, r.canal, true);
          }
          await marquerEscaladeAuto(r.id);
          sent += 1;
        } catch {
          failed += 1;
        }
      }
      if (cancelled) return;
      await reload();
      setAutoSending(false);
      if (sent > 0) {
        setAutoNotice(
          `${sent} relance(s) critique(s) ont été escaladées automatiquement vers vos clients (repoussées ${seuil} fois ou plus, ou en retard de plus de ${escaladeRetard} jours).`,
        );
      }
      if (failed > 0) {
        setAutoError(`${failed} relance(s) automatique(s) n'ont pas pu être envoyées.`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // buildFactureAttachment est un helper pur (pas une dépendance de rendu).
  }, [loading, error, auto, seuil, escaladeRetard, relances, factures, reload, autoEscalatedRef]);

  const clearAuto = () => {
    setAutoNotice(null);
    setAutoError(null);
  };

  return { autoSending, autoNotice, autoError, clearAuto };
}