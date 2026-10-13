import { useState } from "react";
import Toast from "@/components/base/Toast";
import { useExportDonnees } from "@/hooks/useExportDonnees";
import { type FormatExportDonnees } from "@/lib/exportDonneesPersonnelles";
import { tailleLisible } from "@/lib/historiqueExportsDonnees";
import { lireFormatExportPrefere, enregistrerFormatExportPrefere } from "@/lib/formatExportPrefere";
import SauvegardeDonneesModal from "@/pages/app/components/SauvegardeDonneesModal";

/** Libellé lisible du format d'export (repris dans le message de confirmation). */
const LIBELLE_FORMAT: Record<FormatExportDonnees, string> = {
  csv: "CSV",
  json: "JSON",
  complet: "CSV + JSON",
};

/** Les trois formats proposés, dans l'ordre d'affichage du sélecteur. */
const FORMATS: { valeur: FormatExportDonnees; label: string; aide: string }[] = [
  { valeur: "csv", label: "CSV", aide: "Un fichier par catégorie, à ouvrir dans un tableur." },
  { valeur: "json", label: "JSON", aide: "Un fichier structuré, réutilisable pour un futur réimport." },
  { valeur: "complet", label: "Les deux", aide: "Le CSV pour lire, le JSON pour réimporter plus tard." },
];

/**
 * Bloc « Sauvegarde de vos données » : permet à l'artisan de télécharger d'un clic
 * l'ensemble de ses données (une archive ZIP, un CSV par catégorie et/ou un JSON structuré).
 * Les lectures sont filtrées par le Backend : seules les données du compte connecté sont exportées.
 */
export default function ExportDonneesCard() {
  // Format pré-sélectionné : on reprend le dernier choix mémorisé par l'artisan.
  const [format, setFormat] = useState<FormatExportDonnees>(() => lireFormatExportPrefere());
  const [toast, setToast] = useState<string | null>(null);
  const [historiqueOpen, setHistoriqueOpen] = useState(false);
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
    <section className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
          <i className="ri-download-cloud-2-line"></i>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-semibold text-base text-foreground-950">
            Sauvegarde de vos données
          </h3>
          <p className="text-xs text-foreground-500 mt-0.5 leading-relaxed">
            Téléchargez l'ensemble de vos données (clients, devis, factures, chantiers, relances…) dans
            une archive ZIP. Seules les données de votre compte sont incluses. À conserver en lieu sûr —
            l'archive contient des coordonnées de clients.
          </p>
        </div>
      </div>

      {/* Choix du format : CSV (lisible), JSON (préparé pour un futur réimport), ou les deux. */}
      <div className="mt-4">
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
                  actif
                    ? "bg-primary-500 text-background-50"
                    : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i
                  className={
                    f.valeur === "json" ? "ri-braces-line" : f.valeur === "complet" ? "ri-stack-line" : "ri-file-text-line"
                  }
                ></i>
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void lancerExport()}
          disabled={enCours}
          title="Construire et télécharger l'archive de vos données"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <i className={`${enCours ? "ri-loader-4-line animate-spin" : "ri-download-cloud-2-line"}`}></i>
          {enCours ? "Préparation de l'archive…" : `Exporter mes données (${LIBELLE_FORMAT[format]})`}
        </button>
        <button
          type="button"
          onClick={() => setHistoriqueOpen(true)}
          title="Voir l'historique de mes sauvegardes"
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-background-300 text-foreground-700 text-sm font-medium whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
        >
          <i className="ri-history-line"></i>
          Historique
        </button>
        {dernier && !enCours && (
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-secondary-100 text-secondary-700 text-[11px] font-semibold whitespace-nowrap">
            <i className="ri-checkbox-circle-line"></i>
            Dernier export ({LIBELLE_FORMAT[dernier.format]}) : {dernier.tables} catégorie
            {dernier.tables > 1 ? "s" : ""} · {dernier.lignes} ligne{dernier.lignes > 1 ? "s" : ""} ·{" "}
            {tailleLisible(dernier.taille)}
          </span>
        )}
      </div>

      {erreur && (
        <div className="mt-3 flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
          <i className="ri-error-warning-line mt-0.5 shrink-0"></i>
          <span>{erreur}</span>
        </div>
      )}

      {toast && <Toast message={toast} icon="ri-download-cloud-2-line" onClose={() => setToast(null)} />}
      {historiqueOpen && (
        <SauvegardeDonneesModal ongletInitial="historique" onClose={() => setHistoriqueOpen(false)} />
      )}
    </section>
  );
}