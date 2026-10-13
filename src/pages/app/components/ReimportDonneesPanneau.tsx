import { useRef, useState, type ChangeEvent } from "react";
import Toast from "@/components/base/Toast";
import { useExportDonnees } from "@/hooks/useExportDonnees";
import { tailleLisible } from "@/lib/historiqueExportsDonnees";
import {
  lireFichierReimport,
  reinjecterTableReimport,
  reinjecterToutesLesTables,
  tableReimportable,
  totalLignesReimport,
  type FichierReimport,
} from "@/lib/reimportDonneesPersonnelles";

type Resultat = { ok: boolean; lignes: number; erreur?: string };

/**
 * Panneau de réimport : on choisit un fichier `donnees.json`, on découvre les tables qu'il
 * contient, puis on les réinjecte **une par une** (ou toutes, dans l'ordre logique). Chaque
 * opération est précédée d'une confirmation et son résultat est affiché.
 *
 * Garde-fou : avant chaque réinjection, on **propose une sauvegarde de sécurité** (export complet
 * CSV + JSON de l'état actuel). Réinjecter écrase les données existantes : disposer d'une copie
 * juste avant permet de revenir en arrière si quelque chose ne se passe pas comme prévu.
 */
export default function ReimportDonneesPanneau() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fichier, setFichier] = useState<FichierReimport | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [resultats, setResultats] = useState<Record<string, Resultat>>({});
  const [enCours, setEnCours] = useState<string | null>(null);
  const [confirmationTable, setConfirmationTable] = useState<string | null>(null);
  const [confirmationTout, setConfirmationTout] = useState(false);
  const [sauvegardeEnCours, setSauvegardeEnCours] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { exporter, erreur: erreurExport } = useExportDonnees();

  const choisirFichier = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErreurLecture(null);
    setResultats({});
    setConfirmationTable(null);
    setConfirmationTout(false);
    try {
      const analyse = await lireFichierReimport(file);
      setFichier(analyse);
    } catch (err) {
      setFichier(null);
      setErreurLecture(err instanceof Error ? err.message : "Lecture du fichier impossible.");
    }
  };

  /** Construit et télécharge une sauvegarde de sécurité (CSV + JSON). Renvoie vrai si réussie. */
  const faireSauvegardeSecurite = async (): Promise<boolean> => {
    setSauvegardeEnCours(true);
    try {
      const res = await exporter("complet");
      if (res) {
        setToast(
          `Sauvegarde de sécurité prête : ${res.nom} · ${res.tables} catégorie${res.tables > 1 ? "s" : ""} · ${res.lignes} ligne${res.lignes > 1 ? "s" : ""} · ${tailleLisible(res.taille)}`,
        );
        return true;
      }
      return false;
    } finally {
      setSauvegardeEnCours(false);
    }
  };

  const reinjecterUne = async (table: string) => {
    if (!fichier) return;
    setConfirmationTable(null);
    setEnCours(table);
    try {
      const n = await reinjecterTableReimport(table, fichier.donnees[table] ?? []);
      setResultats((r) => ({ ...r, [table]: { ok: true, lignes: n } }));
    } catch (err) {
      setResultats((r) => ({
        ...r,
        [table]: {
          ok: false,
          lignes: 0,
          erreur: err instanceof Error ? err.message : "Réinjection impossible.",
        },
      }));
    } finally {
      setEnCours(null);
    }
  };

  /** Sauvegarde de sécurité d'abord, puis réinjection de la table (bloqué si la sauvegarde échoue). */
  const reinjecterUneAvecSauvegarde = async (table: string) => {
    const ok = await faireSauvegardeSecurite();
    if (!ok) return;
    await reinjecterUne(table);
  };

  const reinjecterTout = async () => {
    if (!fichier) return;
    setConfirmationTout(false);
    setEnCours("__tout__");
    try {
      const res = await reinjecterToutesLesTables(fichier.donnees);
      const map: Record<string, Resultat> = {};
      res.forEach((r) => {
        map[r.table] = { ok: r.ok, lignes: r.lignes, erreur: r.erreur };
      });
      setResultats(map);
    } finally {
      setEnCours(null);
    }
  };

  /** Sauvegarde de sécurité d'abord, puis réinjection complète (bloqué si la sauvegarde échoue). */
  const reinjecterToutAvecSauvegarde = async () => {
    const ok = await faireSauvegardeSecurite();
    if (!ok) return;
    await reinjecterTout();
  };

  const nbTablesRemplies = fichier ? fichier.tables.filter((t) => t.lignes > 0).length : 0;
  const occupe = enCours !== null || sauvegardeEnCours;

  return (
    <div className="flex flex-col gap-4">
      {/* Avertissement clair sur ce que fait (et ne fait pas) le réimport. */}
      <div className="flex items-start gap-2 p-3 rounded-md bg-secondary-50 border border-secondary-200 text-secondary-900 text-xs">
        <i className="ri-alert-line mt-0.5 shrink-0"></i>
        <span>
          Le réimport est prévu pour <strong>votre compte</strong> : il remet les enregistrements à
          l'identique (mise à jour des lignes déjà présentes, ajout des nouvelles). Comme il{" "}
          <strong>écrase</strong> les données existantes, une <strong>sauvegarde de sécurité</strong> vous est
          proposée juste avant chaque réinjection.
        </span>
      </div>

      {/* Sélection du fichier */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void choisirFichier(e)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
        >
          <i className="ri-folder-open-line"></i>
          Choisir un fichier « donnees.json »
        </button>
        {fichier && (
          <span className="text-xs text-foreground-600">
            {fichier.application}
            {fichier.genereLe ? ` · sauvegarde du ${new Date(fichier.genereLe).toLocaleDateString("fr-FR")}` : ""}
          </span>
        )}
      </div>

      {erreurLecture && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
          <i className="ri-error-warning-line mt-0.5 shrink-0"></i>
          <span>{erreurLecture}</span>
        </div>
      )}

      {erreurExport && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
          <i className="ri-error-warning-line mt-0.5 shrink-0"></i>
          <span>Sauvegarde de sécurité impossible : {erreurExport}</span>
        </div>
      )}

      {fichier && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-foreground-600">
              <strong className="text-foreground-950">{nbTablesRemplies}</strong> table
              {nbTablesRemplies > 1 ? "s" : ""} avec des données ·{" "}
              <strong className="text-foreground-950">{totalLignesReimport(fichier)}</strong> ligne
              {totalLignesReimport(fichier) > 1 ? "s" : ""} au total
            </p>
            {confirmationTout ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-foreground-600">
                  <i className="ri-shield-check-line text-accent-600"></i>
                  Sauvegarder d'abord ?
                </span>
                <button
                  type="button"
                  onClick={() => void reinjecterToutAvecSauvegarde()}
                  disabled={occupe}
                  title="Télécharger une sauvegarde de sécurité (CSV + JSON), puis tout réinjecter"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
                >
                  <i className={`${sauvegardeEnCours ? "ri-loader-4-line animate-spin" : "ri-shield-check-line"}`}></i>
                  Sauvegarder puis tout réinjecter
                </button>
                <button
                  type="button"
                  onClick={() => void reinjecterTout()}
                  disabled={occupe}
                  title="Réinjecter directement, sans sauvegarde de sécurité"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-background-300 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-60"
                >
                  <i className="ri-download-2-line"></i>
                  Sans sauvegarde
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmationTout(false)}
                  disabled={occupe}
                  className="h-8 px-3 rounded-md text-foreground-600 text-xs font-medium whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                >
                  Annuler
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmationTout(true)}
                disabled={occupe}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
              >
                <i className={`${enCours === "__tout__" ? "ri-loader-4-line animate-spin" : "ri-download-2-line"}`}></i>
                {enCours === "__tout__" ? "Réinjection…" : "Tout réinjecter"}
              </button>
            )}
          </div>

          <ul className="flex flex-col divide-y divide-background-200 rounded-lg border border-background-200 overflow-hidden">
            {fichier.tables.map((t) => {
              const res = resultats[t.table];
              const connu = tableReimportable(t.table);
              const enCoursTable = enCours === t.table;
              const attente = confirmationTable === t.table;
              return (
                <li key={t.table} className="flex flex-wrap items-center gap-3 px-3 py-2.5 bg-background-50">
                  <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-background-200 text-foreground-600">
                    <i className="ri-table-line"></i>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground-950 truncate">
                      {t.libelle}
                      {!connu && (
                        <span className="ml-2 inline-flex items-center h-5 px-2 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold whitespace-nowrap">
                          ignorée
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-foreground-500 truncate">
                      {t.lignes} ligne{t.lignes > 1 ? "s" : ""} · {t.colonnes.length} colonne
                      {t.colonnes.length > 1 ? "s" : ""}
                    </p>
                  </div>

                  {res && (
                    <span
                      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                        res.ok ? "bg-secondary-100 text-secondary-700" : "bg-red-100 text-red-700"
                      }`}
                      title={res.erreur}
                    >
                      <i className={res.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
                      {res.ok ? `${res.lignes} réinjectée${res.lignes > 1 ? "s" : ""}` : "échec"}
                    </span>
                  )}

                  {attente ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs text-foreground-600">
                        <i className="ri-shield-check-line text-accent-600"></i>
                        Sauvegarder d'abord ?
                      </span>
                      <button
                        type="button"
                        onClick={() => void reinjecterUneAvecSauvegarde(t.table)}
                        disabled={occupe}
                        title="Télécharger une sauvegarde de sécurité (CSV + JSON), puis réinjecter cette table"
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60"
                      >
                        <i className={`${sauvegardeEnCours ? "ri-loader-4-line animate-spin" : "ri-shield-check-line"}`}></i>
                        Sauvegarder puis réinjecter
                      </button>
                      <button
                        type="button"
                        onClick={() => void reinjecterUne(t.table)}
                        disabled={occupe}
                        title="Réinjecter directement, sans sauvegarde de sécurité"
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-background-300 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-60"
                      >
                        Sans sauvegarde
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmationTable(null)}
                        disabled={occupe}
                        className="h-8 px-3 rounded-md text-foreground-600 text-xs font-medium whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                      >
                        Annuler
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmationTable(t.table)}
                      disabled={occupe || t.lignes === 0 || !connu}
                      title={!connu ? "Table non gérée par l'application" : "Réinjecter cette table"}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-background-300 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <i className={`${enCoursTable ? "ri-loader-4-line animate-spin" : "ri-upload-2-line"}`}></i>
                      Réinjecter
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {toast && <Toast message={toast} icon="ri-shield-check-line" onClose={() => setToast(null)} />}
    </div>
  );
}