import Infobulle from "@/components/base/Infobulle";

interface ExportComptableCarteProps {
  nbDevis: number;
  nbFactures: number;
  nbPaiements: number;
  periodeLabel: string;
  /** Libellé optionnel du client filtré (journal dédié à un client). */
  clientLabel?: string;
  busy: boolean;
  onExport: () => void;
  /** Déclenche l'export PDF complet (journal + TVA + synthèse) pour la période. */
  onExportPdf?: () => void;
  /** Indique qu'un export PDF est en cours (bouton désactivé + spinner). */
  pdfBusy?: boolean;
}

const COLONNES = [
  "Date",
  "Type",
  "Numéro",
  "Client",
  "Objet",
  "Montant HT",
  "TVA",
  "Montant TTC",
  "Statut",
];

const CONTENU = [
  { icon: "ri-file-text-line", label: "Devis", key: "devis" },
  { icon: "ri-receipt-line", label: "Factures & avoirs", key: "factures" },
  { icon: "ri-bank-card-line", label: "Paiements encaissés", key: "paiements" },
];

/**
 * Carte dédiée à l'export comptable : présente le contenu du fichier et déclenche
 * le téléchargement d'un unique CSV rassemblant devis, factures et paiements.
 */
export default function ExportComptableCarte({
  nbDevis,
  nbFactures,
  nbPaiements,
  periodeLabel,
  clientLabel,
  busy,
  onExport,
  onExportPdf,
  pdfBusy,
}: ExportComptableCarteProps) {
  const counts: Record<string, number> = {
    devis: nbDevis,
    factures: nbFactures,
    paiements: nbPaiements,
  };
  const totalDocs = nbDevis + nbFactures + nbPaiements;
  const vide = totalDocs === 0;

  return (
    <div className="rounded-lg bg-background-100 border border-background-200 p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          <i className="ri-file-excel-2-line text-xl"></i>
        </span>
        <div className="min-w-0">
          <h2 className="font-heading font-semibold text-base text-foreground-950">Export comptable consolidé</h2>
          <p className="text-xs text-foreground-500 mt-0.5">
            Un seul fichier CSV (séparateur point-virgule, compatible Excel) pour transmettre votre activité au
            comptable : devis, factures et paiements réunis dans un journal chronologique.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {CONTENU.map((c) => (
          <div key={c.key} className="flex items-center gap-3 p-3 rounded-md bg-background-50 border border-background-200">
            <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
              <i className={c.icon}></i>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-950">{counts[c.key]}</p>
              <p className="text-[11px] text-foreground-500 truncate">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Colonnes du journal</p>
        <div className="flex flex-wrap gap-1.5">
          {COLONNES.map((col) => (
            <span
              key={col}
              className="text-[11px] px-2 py-0.5 rounded-full bg-background-50 border border-background-200 text-foreground-600 whitespace-nowrap"
            >
              {col}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-foreground-400 mt-1">
          Un récapitulatif de synthèse (totaux HT/TTC, TVA collectée, encaissé, reste à encaisser) est ajouté en bas du
          fichier.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 border-t border-background-200">
        <p className="text-xs text-foreground-500">
          {vide ? (
            "Aucun document sur la période sélectionnée."
          ) : (
            <>
              Période : <strong className="text-foreground-800">{periodeLabel}</strong>
              {clientLabel ? (
                <>
                  {" "}· Client : <strong className="text-foreground-800">{clientLabel}</strong>
                </>
              ) : null}{" "}
              · <strong className="text-foreground-800">{totalDocs}</strong> ligne{totalDocs > 1 ? "s" : ""}
            </>
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {onExportPdf && (
            <Infobulle
              contenu="Un seul PDF prêt pour votre comptable : le journal, la TVA par taux et la synthèse de la période."
              position="haut"
              largeur={280}
            >
              <button
                type="button"
                onClick={onExportPdf}
                disabled={vide || pdfBusy}
                title="Télécharger un PDF complet : journal, TVA par taux et synthèse de la période"
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pdfBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-pdf-2-line"></i>}
                PDF complet
              </button>
            </Infobulle>
          )}
          <Infobulle
            contenu="Le fichier (compatible Excel) qui rassemble vos devis, factures et paiements, à transmettre à votre comptable."
            position="haut"
            largeur={280}
          >
            <button
              type="button"
              onClick={onExport}
              disabled={vide || busy}
              className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-download-2-line"></i>}
              Télécharger le CSV comptable
            </button>
          </Infobulle>
        </div>
      </div>
    </div>
  );
}