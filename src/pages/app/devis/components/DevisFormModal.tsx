import { useMemo, useState } from "react";
import type { ClientItem } from "@/hooks/useArtisanData";
import { useAuth } from "@/hooks/useAuth";
import { normalizeTvaRate, TVA_RATES, type ClientPayload, type LigneInput } from "@/lib/artisanApi";
import { designationDansBibliotheque, type LigneAInserer } from "@/lib/bibliothequeLignes";
import { DEVIS_STATUTS_FORM } from "@/lib/statuts";
import { formatEuros } from "@/lib/format";
import Modal from "@/pages/app/components/Modal";
import ClientFormModal from "@/pages/app/clients/components/ClientFormModal";
import LignesBibliothequeModal from "@/pages/app/devis/components/LignesBibliothequeModal";
import Toast from "@/components/base/Toast";
import Infobulle from "@/components/base/Infobulle";
import { useEnregistrerLigneBibliotheque } from "@/hooks/useEnregistrerLigneBibliotheque";
import { useCategoriesEnregistrement } from "@/hooks/useCategoriesEnregistrement";
import { useLignesBibliotheque } from "@/hooks/useLignesBibliotheque";
import EnregistrerLigneMenu from "@/pages/app/components/EnregistrerLigneMenu";
import DejaBibliothequeBadge from "@/pages/app/components/DejaBibliothequeBadge";
import { genererLignesDevis } from "@/lib/devisIa";

interface LigneDraft {
  designation: string;
  unite: string;
  quantite: string;
  prix: string;
  taux: string;
}

const emptyLigne = (): LigneDraft => ({ designation: "", unite: "u", quantite: "1", prix: "", taux: "20" });

/** Options de taux de TVA affichées dans chaque ligne (avec la virgule française). */
const TVA_OPTIONS = TVA_RATES.map((t) => ({ value: String(t), label: `${String(t).replace(".", ",")} %` }));

export default function DevisFormModal({
  clients,
  busy,
  onClose,
  onSubmit,
  onQuickCreateClient,
  initialObjet = "",
  initialLignes,
}: {
  clients: ClientItem[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: { clientId: number | null; objet: string; statut: string; lignes: LigneInput[] }) => void;
  onQuickCreateClient?: (payload: ClientPayload) => Promise<ClientItem | null>;
  initialObjet?: string;
  initialLignes?: LigneInput[];
}) {
  const { user } = useAuth();
  const { enregistrer } = useEnregistrerLigneBibliotheque();
  const categoriesEnregistrement = useCategoriesEnregistrement(user?.id ?? null);
  const { lignes: biblioLignes, reload: reloadBiblio } = useLignesBibliotheque(user?.id ?? null);
  const [clientId, setClientId] = useState<string>(clients[0] ? String(clients[0].id) : "");
  // Clients créés à la volée depuis cette fenêtre : conservés même si la liste
  // du parent n'est pas encore rechargée, pour pouvoir être sélectionnés aussitôt.
  const [extraClients, setExtraClients] = useState<ClientItem[]>([]);
  const [clientsModalOpen, setClientsModalOpen] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [objet, setObjet] = useState(initialObjet);
  const [statut, setStatut] = useState<string>("Brouillon");
  const [lignes, setLignes] = useState<LigneDraft[]>(
    initialLignes && initialLignes.length
      ? initialLignes.map((l) => ({
          designation: l.designation,
          unite: l.unite || "u",
          quantite: String(l.quantite ?? 1),
          prix: l.prix_unitaire ? String(l.prix_unitaire) : "",
          taux: String(normalizeTvaRate(l.taux_tva)),
        }))
      : [emptyLigne()],
  );
  const [error, setError] = useState<string | null>(null);
  const [biblioOpen, setBiblioOpen] = useState(false);
  const [iaOpen, setIaOpen] = useState(false);
  const [iaText, setIaText] = useState("");
  const [iaBusy, setIaBusy] = useState(false);
  const [iaError, setIaError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "error" } | null>(null);

  const allClients = useMemo(() => {
    const map = new Map<number, ClientItem>();
    clients.forEach((c) => map.set(c.id, c));
    extraClients.forEach((c) => {
      if (!map.has(c.id)) map.set(c.id, c);
    });
    return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [clients, extraClients]);

  const totaux = useMemo(() => {
    const round = (v: number) => Math.round(v * 100) / 100;
    const ht = lignes.reduce((sum, l) => sum + (Number(l.quantite) || 0) * (Number(l.prix) || 0), 0);
    const tva = lignes.reduce(
      (sum, l) => sum + (Number(l.quantite) || 0) * (Number(l.prix) || 0) * (normalizeTvaRate(l.taux) / 100),
      0,
    );
    return { ht: round(ht), tva: round(tva), ttc: round(ht + tva) };
  }, [lignes]);

  // Taux distincts réellement utilisés (au moins une ligne chiffrée) : pour résumer la TVA appliquée.
  const tauxUtilises = useMemo(() => {
    const set = new Set<number>();
    lignes.forEach((l) => {
      if ((Number(l.quantite) || 0) * (Number(l.prix) || 0) > 0) set.add(normalizeTvaRate(l.taux));
    });
    return [...set].sort((a, b) => b - a);
  }, [lignes]);

  const updateLigne = (index: number, patch: Partial<LigneDraft>) => {
    setLignes((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const addLigne = () => setLignes((prev) => [...prev, emptyLigne()]);
  const removeLigne = (index: number) => setLignes((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  // Insère les lignes pré-formatées sélectionnées dans la bibliothèque.
  // Une première ligne restée vide est remplacée pour éviter les lignes fantômes.
  const handleInsertBiblio = (inserees: LigneAInserer[]) => {
    setLignes((prev) => {
      const base = prev.length === 1 && !prev[0].designation.trim() && !prev[0].prix.trim() ? [] : prev;
      const nouvelles: LigneDraft[] = inserees.map((l) => ({
        designation: l.designation,
        unite: l.unite || "u",
        quantite: "1",
        prix: l.prix_unitaire ? String(l.prix_unitaire) : "",
        taux: String(normalizeTvaRate(l.taux_tva)),
      }));
      return [...base, ...nouvelles];
    });
    setBiblioOpen(false);
  };

  // Enregistre une ligne du devis dans la bibliothèque, dans la catégorie choisie.
  const handleEnregistrerLigne = async (index: number, categorie: string) => {
    const ligne = lignes[index];
    if (!ligne) return;
    if (!ligne.designation.trim()) {
      setToast({ tone: "error", message: "Renseignez d'abord la désignation de la ligne." });
      return;
    }
    try {
      await enregistrer(
        {
          designation: ligne.designation,
          unite: ligne.unite,
          prix_unitaire: Number(ligne.prix) || 0,
          taux_tva: normalizeTvaRate(ligne.taux),
        },
        categorie,
      );
      await reloadBiblio();
      setToast({ tone: "ok", message: `« ${ligne.designation.trim()} » enregistrée dans « ${categorie} ».` });
    } catch {
      setToast({ tone: "error", message: "L'enregistrement dans la bibliothèque a échoué. Réessayez." });
    }
  };

  const handleQuickCreate = async (payload: ClientPayload) => {
    if (!onQuickCreateClient) return;
    setCreatingClient(true);
    setClientError(null);
    try {
      const created = await onQuickCreateClient(payload);
      if (created) {
        setExtraClients((prev) => [...prev, created]);
        setClientId(String(created.id));
      }
      setClientsModalOpen(false);
    } catch {
      setClientError("La création du client a échoué. Réessayez.");
    } finally {
      setCreatingClient(false);
    }
  };

  const handleGenerateIa = async () => {
    const description = iaText.trim();
    if (description.length < 8) {
      setIaError("Décrivez le chantier en quelques mots pour que l'IA puisse proposer un devis.");
      return;
    }
    setIaBusy(true);
    setIaError(null);
    try {
      const res = await genererLignesDevis(description);
      if (res.lignes.length === 0) {
        setIaError("L'IA n'a rien proposé. Précisez un peu la demande et réessayez.");
        return;
      }
      setLignes(
        res.lignes.map((l) => ({
          designation: l.designation,
          unite: l.unite || "u",
          quantite: String(l.quantite ?? 1),
          prix: l.prix_unitaire ? String(l.prix_unitaire) : "",
          taux: "20",
        })),
      );
      if (res.objet && !objet.trim()) setObjet(res.objet);
      setIaOpen(false);
      setIaText("");
    } catch (e) {
      setIaError(e instanceof Error ? e.message : "La génération du devis a échoué.");
    } finally {
      setIaBusy(false);
    }
  };

  const handleSubmit = () => {
    if (!objet.trim()) {
      setError("Donnez un objet à votre devis.");
      return;
    }
    const clean = lignes
      .filter((l) => l.designation.trim())
      .map<LigneInput>((l) => ({
        designation: l.designation.trim(),
        unite: l.unite.trim() || "u",
        quantite: Number(l.quantite) || 0,
        prix_unitaire: Number(l.prix) || 0,
        taux_tva: normalizeTvaRate(l.taux),
      }));
    if (clean.length === 0) {
      setError("Ajoutez au moins une ligne avec une désignation.");
      return;
    }
    setError(null);
    onSubmit({ clientId: clientId ? Number(clientId) : null, objet: objet.trim(), statut, lignes: clean });
  };

  const inputCls = "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400";

  return (
    <>
      <Modal
        title="Nouveau devis"
        subtitle="Composez les lignes du devis, le total se calcule automatiquement."
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
              onClick={handleSubmit}
              disabled={busy}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60"
            >
              {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
              Enregistrer le devis
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-primary-200 bg-primary-50/70 p-3.5">
            {!iaOpen ? (
              <button
                type="button"
                onClick={() => {
                  setIaError(null);
                  setIaOpen(true);
                }}
                className="w-full flex items-center gap-3 text-left cursor-pointer"
              >
                <span className="w-9 h-9 flex items-center justify-center rounded-md bg-primary-500 text-background-50 shrink-0">
                  <i className="ri-sparkling-2-line"></i>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground-950">Générer le devis avec l'IA</span>
                  <span className="block text-xs text-foreground-600">Décrivez le chantier, l'IA rédige les lignes et les prix, vous ajustez ensuite.</span>
                </span>
                <i className="ri-arrow-right-s-line text-foreground-400 ml-auto text-lg shrink-0"></i>
              </button>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground-950">
                    <i className="ri-sparkling-2-line text-primary-500"></i> Décrivez le chantier
                  </span>
                  <button
                    type="button"
                    onClick={() => setIaOpen(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 cursor-pointer"
                    aria-label="Fermer"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </div>
                <textarea
                  value={iaText}
                  onChange={(e) => setIaText(e.target.value)}
                  rows={3}
                  placeholder="Ex : remplacer un ballon d'eau chaude 200 L dans une salle de bain au 2e étage, évacuation à refaire, fourniture et pose."
                  className="w-full px-3 py-2.5 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 placeholder:text-foreground-400 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-foreground-500">Touchez « Générer » : les lignes proposées remplacent celles du formulaire.</span>
                  <button
                    type="button"
                    onClick={handleGenerateIa}
                    disabled={iaBusy}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60"
                  >
                    {iaBusy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-sparkling-2-line"></i>}
                    {iaBusy ? "Génération…" : "Générer"}
                  </button>
                </div>
                {iaError && <p className="text-xs text-red-600">{iaError}</p>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Client</span>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${inputCls} cursor-pointer`}>
                <option value="">Sans client</option>
                {allClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
              {allClients.length === 0 && onQuickCreateClient && (
                <button
                  type="button"
                  onClick={() => {
                    setClientError(null);
                    setClientsModalOpen(true);
                  }}
                  className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold cursor-pointer hover:bg-secondary-200 whitespace-nowrap transition-colors"
                >
                  <i className="ri-user-add-line"></i> Créer un client
                </button>
              )}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground-700">Statut</span>
              <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inputCls} cursor-pointer`}>
                {DEVIS_STATUTS_FORM.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Objet des travaux</span>
            <input
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
              placeholder="Rénovation salle de bain"
              className={inputCls}
            />
          </label>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-foreground-700 uppercase tracking-wide">Lignes du devis</span>
              <div className="flex flex-wrap items-center gap-2">
                <Infobulle
                  contenu="Piocher dans votre bibliothèque de prestations prêtes à l'emploi : les lignes s'ajoutent au devis."
                  position="haut"
                  largeur={270}
                >
                  <button
                    type="button"
                    onClick={() => setBiblioOpen(true)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-100 text-accent-800 text-xs font-semibold cursor-pointer hover:bg-accent-200 whitespace-nowrap transition-colors"
                    title="Insérer des lignes de désignation pré-formatées"
                  >
                    <i className="ri-list-check-2"></i> Depuis la bibliothèque
                  </button>
                </Infobulle>
                <button
                  type="button"
                  onClick={addLigne}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold cursor-pointer hover:bg-secondary-200 whitespace-nowrap"
                >
                  <i className="ri-add-line"></i> Ajouter une ligne
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {lignes.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-md bg-background-100 border border-background-200">
                  <div className="col-span-12 sm:col-span-3 flex flex-col items-start gap-1">
                    <input
                      value={l.designation}
                      onChange={(e) => updateLigne(i, { designation: e.target.value })}
                      placeholder="Désignation"
                      className="w-full h-9 px-2.5 rounded-md bg-background-50 border border-background-200 text-sm outline-none focus:border-primary-400"
                    />
                    {designationDansBibliotheque(biblioLignes, l.designation) && <DejaBibliothequeBadge />}
                  </div>
                  <input
                    value={l.unite}
                    onChange={(e) => updateLigne(i, { unite: e.target.value })}
                    placeholder="unité"
                    className="col-span-3 sm:col-span-1 h-9 px-2.5 rounded-md bg-background-50 border border-background-200 text-sm outline-none focus:border-primary-400"
                  />
                  <input
                    value={l.quantite}
                    onChange={(e) => updateLigne(i, { quantite: e.target.value })}
                    inputMode="decimal"
                    placeholder="Qté"
                    className="col-span-3 sm:col-span-2 h-9 px-2.5 rounded-md bg-background-50 border border-background-200 text-sm outline-none focus:border-primary-400"
                  />
                  <input
                    value={l.prix}
                    onChange={(e) => updateLigne(i, { prix: e.target.value })}
                    inputMode="decimal"
                    placeholder="P.U. €"
                    className="col-span-3 sm:col-span-2 h-9 px-2.5 rounded-md bg-background-50 border border-background-200 text-sm outline-none focus:border-primary-400"
                  />
                  <select
                    value={l.taux}
                    onChange={(e) => updateLigne(i, { taux: e.target.value })}
                    className="col-span-3 sm:col-span-2 h-9 px-2 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-700 outline-none focus:border-primary-400 cursor-pointer"
                    title="Taux de TVA appliqué à cette ligne"
                    aria-label="Taux de TVA de la ligne"
                  >
                    {TVA_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        TVA {o.label}
                      </option>
                    ))}
                  </select>
                  <div className="col-span-12 sm:col-span-2 flex items-center justify-end gap-1">
                    <EnregistrerLigneMenu
                      categories={categoriesEnregistrement}
                      onSave={(categorie) => handleEnregistrerLigne(i, categorie)}
                      compact
                    />
                    <button
                      type="button"
                      onClick={() => removeLigne(i)}
                      className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-red-600 cursor-pointer"
                      aria-label="Supprimer la ligne"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-accent-50 border border-accent-200">
            <div className="min-w-0">
              <span className="text-xs font-medium text-foreground-700">Total</span>
              {tauxUtilises.length > 1 && (
                <p className="text-[11px] text-foreground-500 mt-0.5">
                  Plusieurs taux : {tauxUtilises.map((t) => `${String(t).replace(".", ",")} %`).join(" · ")}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-foreground-950">{formatEuros(totaux.ht)} HT</p>
              <p className="text-[11px] text-foreground-500">
                TVA {formatEuros(totaux.tva)} · {formatEuros(totaux.ttc)} TTC
              </p>
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </Modal>

      {biblioOpen && (
        <LignesBibliothequeModal
          userId={user?.id ?? null}
          onClose={() => setBiblioOpen(false)}
          onInsert={handleInsertBiblio}
          designationsUtilisees={lignes.map((l) => l.designation)}
        />
      )}
      {clientsModalOpen && (
        <ClientFormModal
          initial={null}
          busy={creatingClient}
          onClose={() => setClientsModalOpen(false)}
          onSubmit={handleQuickCreate}
        />
      )}
      {clientError && (
        <p className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] text-xs text-red-700 bg-background-50 border border-red-200 rounded-md px-3 py-2">
          {clientError}
        </p>
      )}
      {toast && (
        <Toast
          message={toast.message}
          icon={toast.tone === "ok" ? "ri-bookmark-line" : "ri-error-warning-line"}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}