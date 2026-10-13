import { useState } from "react";
import Modal from "@/pages/app/components/Modal";
import Toast from "@/components/base/Toast";
import { useExportDonnees } from "@/hooks/useExportDonnees";
import { type FormatExportDonnees } from "@/lib/exportDonneesPersonnelles";
import { tailleLisible } from "@/lib/historiqueExportsDonnees";
import { lireFormatExportPrefere, enregistrerFormatExportPrefere } from "@/lib/formatExportPrefere";
import HistoriqueExportsListe from "@/pages/app/components/HistoriqueExportsListe";
import ReimportDonneesPanneau from "@/pages/app/components/ReimportDonneesPanneau";

export type OngletSauvegarde = "exporter" | "reimporter" | "historique";

const LIBELLE_FORMAT: Record<FormatExportDonnees, string> = {
  csv: "CSV",
  json: "JSON",
  complet: "CSV + JSON",
};

const FORMATS: { valeur: FormatExportDonnees; label: string; icone: string; aide: string }[] = [
  { valeur: "csv", label: "CSV", icone: "ri-file-text-line", aide: "Un fichier par catégorie, à ouvrir dans un tableur." },
  { valeur: "json", label: "JSON", icone: "ri-braces-line", aide: "Un fichier structuré, réutilisable pour un futur réimport." },
  { valeur: "complet", label: "Les deux", icone: "ri-stack-line", aide: "Le CSV pour lire, le JSON pour réimporter plus tard." },
];

const ONGLETS: { cle: OngletSauvegarde; label: string; icone: string }[] = [
  { cle: "exporter", label: "Exporter", icone: "ri-download-cloud-2-line" },
  { cle: "reimporter", label: "Réimporter", icone: "ri-upload-cloud-2-line" },
  { cle: "historique", label: "Historique", icone: "ri-history-line" },
];

/**
 * Fenêtre « Sauvegarder mes données », ouverte depuis le menu du compte (accessible sur n'importe
 * quelle page) ou depuis le rappel du tableau de bord. Elle regroupe en trois onglets :
 *  — **Exporter** : fabrique et télécharge une archive de sauvegarde (CSV / JSON / les deux) ;
 *  — **Réimporter** : lit un `donnees.json` et réinjecte les tables une par une ;
 *  — **Historique** : la liste des exports déjà réalisés (date, format, lignes, taille).
 */
export default function SauvegardeDonneesModal({
  onClose,
  ongletInitial = "exporter",
}: {
  onClose: () => void;
  ongletInitial?: OngletSauvegarde;
}) {
  const [onglet, setOnglet] = useState<OngletSauvegarde>(ongletInitial);
  // Format pré-sélectionné : on reprend le dernier choix mémorisé par l'artisan.
  const [format, setFormat] = useState<FormatExportDonnees>(() => lireFormatExportPrefere());
  const [toast, setToast] = useState<string | null>(null);
  const { enCours, erreur, dernier, exporter } = useExportDonnees();

  const aideFormat = FORMATS.find((f) => f.valeur === format)?.aide ?? "";

  const lancerExport = async () => {
    const res = await exporter(format);
    if (res) {
      setToast(
        `Archive ${LIBELLE_FORMAT[res.format]} prête : ${res.nom} · ${res.tables} catégorie${res.tables > 1 ? "s" : ""} · ${res.lignes} ligne${res.lignes > 1 ? "s" : ""} · ${tailleLisible(res.taille)}`,
      );
    }
  };

  return (
    <Modal
      title="Sauvegarder mes données"
      subtitle="Sauvegardez, restaurez ou consultez l'historique de vos données."
      onClose={onClose}
      wide
    >
      {/* Sélecteur d'onglet */}
      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200">
        {ONGLETS.map((o) => {
          const actif = onglet === o.cle;
          return (
            <button
              key={o.cle}
              type="button"
              onClick={() => setOnglet(o.cle)}
              aria-pressed={actif}
              className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                actif ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className={o.icone}></i>
              {o.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {onglet === "exporter" && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-foreground-600 leading-relaxed">
              Téléchargez l'ensemble de vos données (clients, devis, factures, chantiers, relances…) dans
              une archive ZIP. Seules les données de votre compte sont incluses. À conserver en lieu sûr :
              l'archive contient des coordonnées de clients.
            </p>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400 mb-1.5">
                Format de l'archive
              </p>
              <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-50 border border-background-200">
                {FORMATS.map((f) => {
                  const actif = format === f.valeur;
                  return (
                    <button
                      key={f.valeur}
                      type="button"
                      onClick={() => {
                        enregistrerFormatExportPrefere(f.valeur);
                        setFormat(f.valeur);
                      }}
                      title={f.aide}
                      aria-pressed={actif}
                      className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        actif ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                      }`}
                    >
                      <i className={f.icone}></i>
                      {f.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-foreground-500 mt-1.5 flex items-center gap-1.5">
                <i className="ri-information-line"></i>
                {aideFormat}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void lancerExport()}
                disabled={enCours}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <i className={`${enCours ? "ri-loader-4-line animate-spin" : "ri-download-cloud-2-line"}`}></i>
                {enCours ? "Préparation…" : `Exporter (${LIBELLE_FORMAT[format]})`}
              </button>
              {dernier && !enCours && (
                <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-secondary-100 text-secondary-700 text-[11px] font-semibold whitespace-nowrap">
                  <i className="ri-checkbox-circle-line"></i>
                  {dernier.tables} catégorie{dernier.tables > 1 ? "s" : ""} · {dernier.lignes} ligne
                  {dernier.lignes > 1 ? "s" : ""} · {tailleLisible(dernier.taille)}
                </span>
              )}
            </div>

            {erreur && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
                <i className="ri-error-warning-line mt-0.5 shrink-0"></i>
                <span>{erreur}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setOnglet("historique")}
              className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-accent-700 cursor-pointer hover:underline"
            >
              <i className="ri-history-line"></i>
              Voir l'historique de mes exports
            </button>
          </div>
        )}

        {onglet === "reimporter" && <ReimportDonneesPanneau />}

        {onglet === "historique" && <HistoriqueExportsListe />}
      </div>

      {toast && <Toast message={toast} icon="ri-download-cloud-2-line" onClose={() => setToast(null)} />}
    </Modal>
  );
}