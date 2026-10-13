import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useArtisanData, type ClientItem } from "@/hooks/useArtisanData";
import { createClient, deleteClient, updateClient, type ClientPayload } from "@/lib/artisanApi";
import { formatEuros } from "@/lib/format";
import { formatShortDate, todayISO } from "@/lib/dates";
import { toCsv, downloadCsv } from "@/lib/csv";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import Modal from "@/pages/app/components/Modal";
import ClientFormModal from "@/pages/app/clients/components/ClientFormModal";
import ProDetailPanel from "@/pages/app/professionnels/components/ProDetailPanel";
import RechercheRepliable from "@/components/feature/RechercheRepliable";

type TriPro = "nom" | "ca";

export default function AppProfessionnels() {
  usePageMeta("Professionnels · ArtiFlow-pro", "Gérez votre carnet de clients professionnels (entreprises) : coordonnées, SIRET, secteur et CA.");
  const { user } = useAuth();
  const { loading, error, clients, devis, chantiers, factures, reload } = useArtisanData();
  const [detail, setDetail] = useState<ClientItem | null>(null);

  const [query, setQuery] = useState("");
  const [secteurFilter, setSecteurFilter] = useState("");
  const [tri, setTri] = useState<TriPro>("nom");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ClientItem | null>(null);

  // Uniquement les clients professionnels (entreprises).
  const pros = useMemo(() => clients.filter((c) => c.type === "professionnel"), [clients]);

  const secteurs = useMemo(() => {
    const set = new Set<string>();
    pros.forEach((c) => {
      if (c.secteur) set.add(c.secteur);
    });
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [pros]);

  const caDe = (id: number) => devis.filter((d) => d.client_id === id).reduce((sum, d) => sum + Number(d.total_ht || 0), 0);
  const devisDe = (id: number) => devis.filter((d) => d.client_id === id).length;
  const chantiersDe = (id: number) => chantiers.filter((c) => c.client_id === id).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = pros.filter((c) => {
      const matchQ =
        !q ||
        c.nom.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.telephone ?? "").toLowerCase().includes(q) ||
        (c.contact_nom ?? "").toLowerCase().includes(q) ||
        (c.siret ?? "").toLowerCase().includes(q);
      const matchSecteur = !secteurFilter || c.secteur === secteurFilter;
      return matchQ && matchSecteur;
    });
    const sorted = [...list];
    if (tri === "ca") sorted.sort((a, b) => caDe(b.id) - caDe(a.id));
    else sorted.sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pros, query, secteurFilter, tri, devis]);

  const totalCa = useMemo(() => pros.reduce((sum, c) => sum + caDe(c.id), 0), [pros, devis]);
  const chantiersEnCours = useMemo(
    () => chantiers.filter((ch) => ch.client_id !== null && pros.some((p) => p.id === ch.client_id) && ch.statut === "En cours").length,
    [chantiers, pros],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (client: ClientItem) => {
    setEditing(client);
    setFormOpen(true);
  };

  const handleSubmit = async (payload: ClientPayload) => {
    if (!user) return;
    setBusy(true);
    setActionError(null);
    try {
      const full: ClientPayload = { ...payload, type: "professionnel" };
      if (editing) await updateClient(editing.id, full);
      else await createClient(user.id, full);
      setFormOpen(false);
      setEditing(null);
      await reload();
    } catch {
      setActionError("L'enregistrement du professionnel a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setActionError(null);
    try {
      await deleteClient(pendingDelete.id);
      setPendingDelete(null);
      await reload();
    } catch {
      setActionError("La suppression a échoué. Ce professionnel est peut-être lié à un devis ou un chantier.");
    }
  };

  const handleExportCsv = () => {
    const rows = filtered.map((c) => [
      c.nom,
      c.contact_nom ?? "",
      c.secteur ?? "",
      c.telephone ?? "",
      c.email ?? "",
      c.adresse ?? "",
      c.siret ?? "",
      devisDe(c.id),
      caDe(c.id).toFixed(2).replace(".", ","),
    ]);
    const csv = toCsv(
      ["Raison sociale", "Interlocuteur", "Secteur", "Téléphone", "Email", "Adresse", "SIRET", "Devis", "CA HT"],
      rows,
    );
    downloadCsv(`professionnels-artiflow-${todayISO()}.csv`, csv);
  };

  if (!loading && !error && pros.length === 0) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon="ri-building-2-line"
          title="Aucun client professionnel"
          text="Ajoutez une entreprise (raison sociale, interlocuteur, SIRET, secteur) pour la distinguer de vos clients particuliers. Vous pouvez aussi marquer un client existant comme professionnel depuis la page Clients."
        >
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-add-line"></i> Ajouter un professionnel
            </button>
            <Link to="/app/clients" className="text-sm text-accent-700 hover:underline">
              Voir tous mes clients
            </Link>
          </div>
        </EmptyState>
        {formOpen && (
          <ClientFormModal
            initial={editing}
            busy={busy}
            defaultType="professionnel"
            onClose={() => setFormOpen(false)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    );
  }

  return (
    <DataState loading={loading} error={error} onRetry={reload}>
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <RechercheRepliable
              carteId="professionnels"
              carteLabel="Professionnels"
              value={query}
              onChange={setQuery}
              placeholder="Rechercher une entreprise, un contact…"
              conteneurClassName="w-full sm:w-72"
            />
            {secteurs.length > 0 && (
              <div className="relative">
                <i className="ri-price-tag-3-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
                <select
                  value={secteurFilter}
                  onChange={(e) => setSecteurFilter(e.target.value)}
                  className="h-10 pl-9 pr-9 rounded-md bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 outline-none focus:border-primary-400 cursor-pointer appearance-none"
                  aria-label="Filtrer par secteur d'activité"
                >
                  <option value="">Tous les secteurs</option>
                  {secteurs.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-foreground-500 whitespace-nowrap">
              <strong className="text-foreground-900">{pros.length}</strong> professionnels
            </span>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exporter les professionnels affichés au format CSV"
            >
              <i className="ri-file-excel-2-line"></i>
              Exporter CSV
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-add-line"></i>
              Nouveau professionnel
            </button>
          </div>
        </div>

        {actionError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {actionError}
          </p>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-building-2-line text-accent-600"></i> Professionnels
            </span>
            <span className="font-heading font-bold text-2xl text-foreground-950">{pros.length}</span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-money-euro-circle-line text-primary-600"></i> CA généré
            </span>
            <span className="font-heading font-bold text-2xl text-foreground-950">{formatEuros(totalCa)}</span>
            <span className="text-[11px] text-foreground-500">devis liés à ces entreprises</span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-file-text-line text-secondary-600"></i> Devis émis
            </span>
            <span className="font-heading font-bold text-2xl text-foreground-950">
              {pros.reduce((sum, c) => sum + devisDe(c.id), 0)}
            </span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-hammer-line text-accent-600"></i> Chantiers en cours
            </span>
            <span className="font-heading font-bold text-2xl text-foreground-950">{chantiersEnCours}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
            <button
              type="button"
              onClick={() => setTri("nom")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                tri === "nom" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className="ri-sort-asc"></i>
              Nom
            </button>
            <button
              type="button"
              onClick={() => setTri("ca")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                tri === "ca" ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className="ri-sort-desc"></i>
              CA décroissant
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground-500 rounded-lg bg-background-100 border border-background-200">
            Aucun professionnel ne correspond à votre recherche.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <div key={c.id} className="flex flex-col p-5 rounded-lg bg-background-100 border border-background-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                      <i className="ri-building-2-line text-xl"></i>
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-heading font-semibold text-base text-foreground-950 truncate">{c.nom}</h3>
                      <p className="text-[11px] text-foreground-500 truncate">
                        {c.secteur ? `${c.secteur} · ` : ""}
                        {c.contact_nom ? c.contact_nom : "Interlocuteur à préciser"}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold">
                    <i className="ri-building-2-line text-[10px]"></i> PRO
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-1.5 text-sm text-foreground-600">
                  <span className="inline-flex items-center gap-2">
                    <i className="ri-phone-line text-foreground-400"></i>
                    {c.telephone ?? "—"}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <i className="ri-mail-line text-foreground-400"></i>
                    <span className="truncate">{c.email ?? "—"}</span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <i className="ri-map-pin-line text-foreground-400"></i>
                    <span className="truncate">{c.adresse ?? "—"}</span>
                  </span>
                  {c.siret && (
                    <span className="inline-flex items-center gap-2">
                      <i className="ri-bank-card-line text-foreground-400"></i>
                      SIRET {c.siret}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1 mt-4 py-3 border-t border-b border-background-200 text-center">
                  <div>
                    <p className="text-sm font-bold text-foreground-950">{devisDe(c.id)}</p>
                    <p className="text-[10px] text-foreground-500">devis</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground-950">{chantiersDe(c.id)}</p>
                    <p className="text-[10px] text-foreground-500">chantiers</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground-950">{formatEuros(caDe(c.id))}</p>
                    <p className="text-[10px] text-foreground-500">CA HT</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setDetail(c)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-primary-500 text-background-50 text-xs font-semibold hover:bg-primary-600 cursor-pointer whitespace-nowrap transition-colors"
                  >
                    <i className="ri-eye-line"></i> Voir la fiche
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md bg-background-50 border border-background-200 text-xs font-semibold text-foreground-700 hover:border-primary-300 cursor-pointer whitespace-nowrap transition-colors"
                  >
                    <i className="ri-edit-line"></i> Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(c)}
                    className="w-9 h-9 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-400 hover:text-red-600 hover:border-red-300 cursor-pointer transition-colors"
                    aria-label="Supprimer le professionnel"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-foreground-400">Client depuis le {formatShortDate(c.created_at ?? null)}</p>
              </div>
            ))}
          </div>
        )}

        {formOpen && (
          <ClientFormModal
            initial={editing}
            busy={busy}
            defaultType="professionnel"
            onClose={() => setFormOpen(false)}
            onSubmit={handleSubmit}
          />
        )}

        {detail && (
          <ProDetailPanel
            client={detail}
            devis={devis}
            chantiers={chantiers}
            factures={factures}
            onClose={() => setDetail(null)}
            onEdit={(c) => {
              setDetail(null);
              openEdit(c);
            }}
            onClientSaved={reload}
          />
        )}

        {pendingDelete && (
          <Modal title="Supprimer ce professionnel ?" onClose={() => setPendingDelete(null)}>
            <p className="text-sm text-foreground-600">
              <strong className="text-foreground-900">{pendingDelete.nom}</strong> sera retiré de votre carnet. Les devis déjà créés
              resteront dans l'historique.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
              >
                Supprimer
              </button>
            </div>
          </Modal>
        )}
      </div>
    </DataState>
  );
}