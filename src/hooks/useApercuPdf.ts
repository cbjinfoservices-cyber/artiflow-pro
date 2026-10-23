import { useCallback, useState } from "react";
import type { jsPDF } from "jspdf";

/** Demande d'aperçu d'un PDF avant téléchargement. */
export interface ApercuPdfDemande {
  /** Titre de la fenêtre (ex. « Aperçu · Bilan d'archivage »). */
  title: string;
  /** Sous-titre explicatif sous le titre. */
  subtitle?: string;
  /** Nom du fichier proposé au téléchargement. */
  filename: string;
  /** Construit le document PDF à afficher (exécuté à l'ouverture de la fenêtre). */
  build: () => Promise<jsPDF>;
  /** Petite mention informative sous l'aperçu. */
  note?: string;
}

/**
 * Petit état partagé pour ouvrir la fenêtre commune d'aperçu PDF
 * (`ApercuPdfModal`) depuis n'importe quelle carte d'export : on prépare le
 * document, on le montre à l'écran, puis l'artisan télécharge s'il le souhaite.
 */
export default function useApercuPdf() {
  const [apercu, setApercu] = useState<ApercuPdfDemande | null>(null);
  const ouvrirApercuPdf = useCallback((demande: ApercuPdfDemande) => setApercu(demande), []);
  const fermerApercuPdf = useCallback(() => setApercu(null), []);
  return { apercu, ouvrirApercuPdf, fermerApercuPdf };
}