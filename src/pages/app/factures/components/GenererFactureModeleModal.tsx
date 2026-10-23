import { useEffect, useMemo, useState } from "react";
import type { FactureModele } from "@/lib/artisanApi";
import type { ClientItem } from "@/hooks/useArtisanData";
import { formatEuros } from "@/lib/format";
import Modal from "@/pages/app/components/Modal";

const ECHEANCES = [15, 30, 45] as const;

/**
 * Fenêtre « Depuis un modèle » : choisir un modèle de facture, le client et l'échéance,
 * puis générer la facture. Permet aussi de renommer, archiver ou supprimer les modèles.
 */
export default function GenererFactureModeleModal({
  modeles,
  clients,
  loading,
  busy,
  error,
  onClose,
  onGenerate,
  onDelete,
  onArchive,
  onRenommer,
}: {
  modeles: FactureModele[];
  clients: ClientItem[];
  loading: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onGenerate: (modele: FactureModele, clientId: number | null, echeanceJours: number) => void;
  onDelete: (modele: FactureModele) => void;
  onArchive: (modele: FactureModele, archive: boolean) => void;
  onRenommer: (modele: FactureModele, nom: string) => void;
}) {
  const actifs = useMemo(() => modeles.filter((m) => !m.archive), [modeles]);
  const archives = useMemo(() => modeles.filter((m) => m.archive), [modeles]);
  const [voirArchives, setVoirArchives] = useState(false);
  const [selectionId, setSelectionId] = useState<number | null>(null);
  const [clientId, setClientId] = useState<number | "">("");
  const [echeance, setEcheance] = useState<number>(30);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Sélectionne automatiquement le premier modèle actif disponible.
  useEffect(() => {
    if (selectionId === null && actifs.length > 0) setSelectionId(actifs[0].id);
    if (selectionId !== null && !modeles.some((m) => m.id === selectionId)) {
      setSelectionId(actifs[0]?.id ?? null);
    }
  }, [actifs, modeles, selectionId]);

  const liste = voirArchives ? archives : actifs;
  const selection = modeles.find((m) => m.id === selectionId) ?? null;
  const totalHT = selection
    ? selection.lignes.reduce((s, l) => s + Number(l.quantite || 0) * Number(l.prix_unitaire || 0), 0)
    : 0;

  const validerRename = (modele: FactureModele) => {
    const nom = renameValue.trim();
    if (nom && nom !== modele.nom) onRenommer(modele, nom);
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <Modal
      title="Générer une facture depuis un modèle"
      subtitle="Choisissez une trame de facture réutilisable, le client et l'échéance de règlement."
      onClose={onClose}
      wide
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => selection && onGenerate(selection, clientId === "" ? null : clientId, echeance)}
            disabled={busy || !selection}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-add-line"></i>}
            Générer la facture
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <i className="ri-loader-4-line animate-spin text-xl text-primary-600"></i>
        </div>
      ) : modeles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="w-12 h-12 flex items-center justify-center rounded-full bg-background-100 text-foreground-300">
            <i className="ri-bookmark-line text-xl"></i>
          </span>
          <p className="text-sm text-foreground-600">Aucun modèle de facture pour l'instant.</p>
          <p className="text-xs text-foreground-400 max-w-sm">
            Ouvrez le menu d'une facture et cliquez sur « Enregistrer comme modèle » pour créer votre première trame
            réutilisable.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">
              {voirArchives ? `Modèles archivés (${archives.length})` : `Modèles disponibles (${actifs.length})`}
            </p>
            <button
              type="button"
              onClick={() => setVoirArchives((v) => !v)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-100 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className={voirArchives ? "ri-inbox-unarchive-line" : "ri-archive-line"}></i>
              {voirArchives ? "Voir les modèles actifs" : "Voir les archivés"}
            </button>
          </div>

          {liste.length === 0 ? (
            <p className="py-6 text-center text-sm text-foreground-500">
              {voirArchives ? "Aucun modèle archivé." : "Aucun modèle actif. Consultez les archives."}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {liste.map((m) => {
                const on = m.id === selectionId;
                const total = m.lignes.reduce((s, l) => s + Number(l.quantite || 0) * Number(l.prix_unitaire || 0), 0);
                return (
                  <div
                    key={m.id}
                    className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border transition-colors ${
                      on ? "border-primary-400 bg-primary-50" : "border-background-200 bg-background-50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectionId(m.id)}
                      aria-pressed={on}
                      className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full cursor-pointer transition-colors ${
                        on
                          ? "bg-primary-500 text-background-50"
                          : "bg-background-100 border border-background-300 text-foreground-400 hover:border-primary-300"
                      }`}
                      title="Utiliser ce modèle"
                    >
                      <i className={on ? "ri-check-line" : "ri-bookmark-line"}></i>
                    </button>

                    <div className="min-w-0 flex-1">
                      {renamingId === m.id ? (
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => validerRename(m)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") validerRename(m);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          autoFocus
                          className="h-8 px-2 rounded-md bg-background-50 border border-primary-300 text-sm outline-none"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-foreground-900 truncate">{m.nom}</p>
                      )}
                      <p className="text-[11px] text-foreground-500 truncate">
                        {m.objet ? `${m.objet} · ` : ""}
                        {m.lignes.length} ligne{m.lignes.length > 1 ? "s" : ""} · {formatEuros(total)} HT
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(m.id);
                          setRenameValue(m.nom);
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-primary-700 cursor-pointer"
                        title="Renommer le modèle"
                        aria-label="Renommer le modèle"
                      >
                        <i className="ri-pencil-line"></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => onArchive(m, !m.archive)}
                        className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-secondary-700 cursor-pointer"
                        title={m.archive ? "Désarchiver le modèle" : "Archiver le modèle"}
                        aria-label={m.archive ? "Désarchiver le modèle" : "Archiver le modèle"}
                      >
                        <i className={m.archive ? "ri-inbox-unarchive-line" : "ri-archive-line"}></i>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(m)}
                        className="w-8 h-8 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-red-600 cursor-pointer"
                        title="Supprimer le modèle"
                        aria-label="Supprimer le modèle"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-md bg-background-50 border border-background-200">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Client</span>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 cursor-pointer"
              >
                <option value="">— Aucun client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Échéance de règlement</span>
              <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200 w-fit">
                {ECHEANCES.map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setEcheance(j)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      echeance === j ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                    }`}
                  >
                    {j} jours
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selection && (
            <div className="flex items-center justify-between p-3 rounded-md bg-accent-50 border border-accent-200">
              <span className="text-xs font-medium text-foreground-700">Total du modèle {selection.nom}</span>
              <span className="text-sm font-bold text-foreground-950">{formatEuros(totalHT)} HT</span>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <i className="ri-error-warning-line"></i>
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}