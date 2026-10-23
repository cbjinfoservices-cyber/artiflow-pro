import { useEffect, useState } from "react";
import Toast from "@/components/base/Toast";
import { STOCKAGE_LOCAL_EVENT } from "@/lib/stockageLocal";
import { toCsv, downloadCsv } from "@/lib/csv";
import {
  lireHistoriqueExports,
  viderHistoriqueExports,
  tailleLisible,
  type EntreeHistoriqueExport,
} from "@/lib/historiqueExportsDonnees";
import { lirePdfArchive, telechargerPdfArchive } from "@/lib/archivesRecapPdf";

const LIBELLE_FORMAT: Record<string, string> = {
  csv: "CSV",
  json: "JSON",
  complet: "CSV + JSON",
  "recap-pdf": "Récap PDF",
};

const ICONE_FORMAT: Record<string, string> = {
  csv: "ri-file-text-line",
  json: "ri-braces-line",
  complet: "ri-stack-line",
  "recap-pdf": "ri-file-pdf-2-line",
};

/** Date lisible : « 12 oct. 2026 à 14:30 ». */
function dateLisible(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "date inconnue";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Historique des exports de données : la liste des sauvegardes réalisées (date, format,
 * catégories, lignes, taille). Se met à jour automatiquement dès qu'un export est fait ailleurs.
 */
export default function HistoriqueExportsListe() {
  const [liste, setListe] = useState<EntreeHistoriqueExport[]>(() => lireHistoriqueExports());
  const [confirmerVidage, setConfirmerVidage] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Nom du PDF de récap en cours de relecture depuis l'archive locale.
  const [ouverture, setOuverture] = useState<string | null>(null);

  useEffect(() => {
    const rafraichir = () => setListe(lireHistoriqueExports());
    window.addEventListener(STOCKAGE_LOCAL_EVENT, rafraichir);
    window.addEventListener("storage", rafraichir);
    return () => {
      window.removeEventListener(STOCKAGE_LOCAL_EVENT, rafraichir);
      window.removeEventListener("storage", rafraichir);
    };
  }, []);

  const totalLignes = liste.reduce((somme, e) => somme + e.lignes, 0);

  /** Produit un CSV de l'historique (date, format, catégories, lignes, taille) pour l'archivage. */
  const exporterHistoriqueCsv = () => {
    const headers = [
      "Date",
      "Format",
      "Categories",
      "Lignes",
      "Taille (octets)",
      "Taille lisible",
      "Fichier",
    ];
    const rows = liste.map((e) => [
      dateLisible(e.date),
      LIBELLE_FORMAT[e.format] ?? e.format,
      e.tables,
      e.lignes,
      e.taille,
      tailleLisible(e.taille),
      e.nom,
    ]);
    const jour = new Date().toISOString().slice(0, 10);
    downloadCsv(`artiflow-historique-exports-${jour}.csv`, toCsv(headers, rows));
    setToast("Historique des exports téléchargé en CSV.");
  };

  /** Rouvre le PDF d'un récap mensuel archivé dans le navigateur et le télécharge. */
  const ouvrirRecapArchive = async (nom: string) => {
    setOuverture(nom);
    try {
      const blob = await lirePdfArchive(nom);
      if (!blob) {
        setToast("Ce PDF n'est plus disponible dans l'archive locale de ce navigateur.");
        return;
      }
      telechargerPdfArchive(nom, blob);
      setToast("Récap mensuel téléchargé.");
    } finally {
      setOuverture(null);
    }
  };

  if (liste.length === 0) {
    return (
      <div className="flex flex-col items-center text-center px-6 py-10 rounded-lg bg-background-100 border border-background-200">
        <span className="w-12 h-12 flex items-center justify-center rounded-full bg-background-200 text-foreground-500 text-xl">
          <i className="ri-history-line"></i>
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground-950">Aucun export pour l'instant</p>
        <p className="mt-1 text-xs text-foreground-500 max-w-sm">
          Chaque sauvegarde que vous ferez apparaîtra ici, avec sa date, son format et le nombre de
          lignes. C'est votre journal de sécurité.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-foreground-600">
          <strong className="text-foreground-950">{liste.length}</strong> export{liste.length > 1 ? "s" : ""} enregistré
          {liste.length > 1 ? "s" : ""} · <strong className="text-foreground-950">{totalLignes}</strong> ligne
          {totalLignes > 1 ? "s" : ""} au total
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exporterHistoriqueCsv}
            title="Télécharger l'historique en CSV (date, format, lignes, taille) pour l'archivage"
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-background-300 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors"
          >
            <i className="ri-file-download-line"></i>
            Exporter en CSV
          </button>
          {confirmerVidage ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-xs text-foreground-600">Vider l'historique ?</span>
              <button
                type="button"
                onClick={() => {
                  viderHistoriqueExports();
                  setConfirmerVidage(false);
                  setToast("Historique des exports vidé.");
                }}
                className="h-7 px-3 rounded-md bg-red-600 text-white text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-red-700 transition-colors"
              >
                Oui, vider
              </button>
              <button
                type="button"
                onClick={() => setConfirmerVidage(false)}
                className="h-7 px-3 rounded-md text-foreground-600 text-xs font-medium whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              >
                Annuler
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmerVidage(true)}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-foreground-500 text-xs font-medium whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className="ri-delete-bin-line"></i>
              Vider
            </button>
          )}
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-background-200 rounded-lg border border-background-200 overflow-hidden">
        {liste.map((e, index) => (
          <li key={`${e.date}-${index}`} className="flex items-center gap-3 px-3 py-2.5 bg-background-50">
            <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
              <i className={ICONE_FORMAT[e.format] ?? "ri-archive-line"}></i>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground-950 truncate">
                {dateLisible(e.date)}
                <span className="ml-2 inline-flex items-center h-5 px-2 rounded-full bg-background-200 text-foreground-600 text-[10px] font-semibold whitespace-nowrap">
                  {LIBELLE_FORMAT[e.format] ?? e.format}
                </span>
              </p>
              <p className="text-[11px] text-foreground-500 truncate">
                {e.tables} catégorie{e.tables > 1 ? "s" : ""} · {e.lignes} ligne{e.lignes > 1 ? "s" : ""} ·{" "}
                {tailleLisible(e.taille)}
                {e.nom ? ` · ${e.nom}` : ""}
              </p>
            </div>
            {e.format === "recap-pdf" && e.nom && (
              <button
                type="button"
                onClick={() => void ouvrirRecapArchive(e.nom)}
                disabled={ouverture === e.nom}
                title="Rouvrir ce récap mensuel archivé et le télécharger"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-accent-100 border border-accent-200 text-accent-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <i className={ouverture === e.nom ? "ri-loader-4-line animate-spin" : "ri-download-2-line"}></i>
                Télécharger
              </button>
            )}
          </li>
        ))}
      </ul>

      {toast && <Toast message={toast} icon="ri-history-line" onClose={() => setToast(null)} />}
    </div>
  );
}