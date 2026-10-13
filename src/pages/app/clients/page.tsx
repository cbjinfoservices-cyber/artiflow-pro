import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useArtisanData } from "@/hooks/useArtisanData";
import { createClient, deleteClient, updateClient, type ClientPayload } from "@/lib/artisanApi";
import { toCsv, downloadCsv } from "@/lib/csv";
import { formatShortDate, todayISO } from "@/lib/dates";
import { notePrioriteInfo, NOTE_PRIORITES } from "@/lib/notePriorites";
import { RELANCE_CLIENT_DELAI_ALERTE, joursDepuisDerniereRelance } from "@/lib/relancesClient";
import { useRelancesClient } from "@/hooks/useRelancesClient";
import { lireFiltresClients, memoriserFiltresClients, effacerFiltresClients } from "@/lib/clientsFiltresMemoire";
import { ajouterLienCopie } from "@/lib/liensCopiesMemoire";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import SampleDataButton from "@/pages/app/components/SampleDataButton";
import Modal from "@/pages/app/components/Modal";
import ClientFormModal from "@/pages/app/clients/components/ClientFormModal";
import QuickNoteModal from "@/pages/app/clients/components/QuickNoteModal";
import ProDetailPanel from "@/pages/app/professionnels/components/ProDetailPanel";
import BadgeVuePartagee from "@/pages/app/components/BadgeVuePartagee";
import BoutonEpinglerVue from "@/pages/app/components/BoutonEpinglerVue";
import BoutonPartager from "@/pages/app/components/BoutonPartager";
import MenuVuesPartageesRecentes from "@/pages/app/components/MenuVuesPartageesRecentes";
import RechercheRepliable from "@/components/feature/RechercheRepliable";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import { guidePremiereVisiteVu, marquerGuidePremiereVisiteVu } from "@/lib/guidePremiereVisite";
import type { ClientItem } from "@/hooks/useArtisanData";

export default function AppClients() {
  usePageMeta("Clients · ArtiFlow-pro", "Gérez votre carnet de clients artisans.");
  const { user } = useAuth();
  const { loading, error, clients, devis, chantiers, factures, reload } = useArtisanData();
  // Relances client programmées : pour signaler « relance prévue » directement sur les cartes.
  const { relances: relancesClient } = useRelancesClient(user?.id ?? null);

  // Dernière vue mémorisée des filtres clients (type, priorité, « a des notes ») : valeur par défaut au retour.
  const memoFiltres = useMemo(lireFiltresClients, []);

  // Filtres de la vue, mémorisés dans l'URL (?type=, ?priorite=, ?notes=1) pour rendre la vue filtrée partageable.
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Indicateur « vue partagée » : vrai quand l'adresse contient des filtres (vue reçue via un lien partagé).
  const aFiltresUrl = useMemo(
    () => ["type", "priorite", "notes"].some((k) => searchParams.has(k)),
    [searchParams],
  );
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(() => {
    const t = searchParams.get("type");
    return t === "Particuliers" || t === "Professionnels" ? t : memoFiltres.type ?? "Tous";
  });
  const [prioriteFilter, setPrioriteFilter] = useState(() => {
    const p = searchParams.get("priorite");
    return p && NOTE_PRIORITES.some((x) => x.key === p) ? p : memoFiltres.priorite ?? "Toutes";
  });
  const [hasNotes, setHasNotes] = useState(() => searchParams.get("notes") === "1" || Boolean(memoFiltres.notes));
  const [noticeCopie, setNoticeCopie] = useState(false);
  const [quickNote, setQuickNote] = useState<ClientItem | null>(null);
  const [detail, setDetail] = useState<ClientItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ClientItem | null>(null);

  // Guide de première visite : présenté au premier passage sur le carnet de clients,
  // puis mémorisé une fois fermé. Réouvrable via « Revoir le guide des clients ».
  const [guideVisible, setGuideVisible] = useState(() => !guidePremiereVisiteVu("clients"));
  const fermerGuide = () => {
    marquerGuidePremiereVisiteVu("clients");
    setGuideVisible(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      const matchQ =
        !q ||
        c.nom.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.telephone ?? "").toLowerCase().includes(q);
      const matchType =
        typeFilter === "Tous" ||
        (typeFilter === "Professionnels" ? c.type === "professionnel" : c.type !== "professionnel");
      const matchNotes = !hasNotes || Boolean(c.notes && c.notes.trim().length > 0);
      const matchPriorite = prioriteFilter === "Toutes" || c.note_priorite === prioriteFilter;
      return matchQ && matchType && matchNotes && matchPriorite;
    });
  }, [clients, query, typeFilter, hasNotes, prioriteFilter]);

  const nbAvecNotes = useMemo(() => clients.filter((c) => Boolean(c.notes && c.notes.trim())).length, [clients]);

  // Mémorise la vue courante (type, priorité, « a des notes ») pour la restaurer au prochain retour.
  useEffect(() => {
    memoriserFiltresClients({ type: typeFilter, priorite: prioriteFilter, notes: hasNotes });
  }, [typeFilter, prioriteFilter, hasNotes]);

  // Construit les paramètres d'URL de la vue filtrée courante (type, priorité, notes), avec surcharge ponctuelle.
  const buildParams = (override: Partial<{ type: string; priorite: string; notes: boolean }> = {}) => {
    const t = override.type ?? typeFilter;
    const p = override.priorite ?? prioriteFilter;
    const n = override.notes ?? hasNotes;
    const params = new URLSearchParams();
    if (t && t !== "Tous") params.set("type", t);
    if (p && p !== "Toutes") params.set("priorite", p);
    if (n) params.set("notes", "1");
    return params;
  };

  // Chemin interne de la vue courante (filtres), pour le bouton « Partager » de l'en-tête.
  const qsPartage = buildParams().toString();
  const cheminPartage = `${location.pathname}${qsPartage ? `?${qsPartage}` : ""}`;

  // Oublie la dernière vue mémorisée et repart des filtres par défaut (et nettoie l'URL).
  const oublierVueClients = () => {
    effacerFiltresClients();
    setTypeFilter("Tous");
    setPrioriteFilter("Toutes");
    setHasNotes(false);
    setSearchParams(buildParams({ type: "Tous", priorite: "Toutes", notes: false }), { replace: true });
  };

  // Remet d'un coup les filtres du carnet (type, priorité, « a des notes ») à leurs valeurs par
  // défaut. Ne touche pas à la mémoire de la dernière vue, contrairement à « Oublier cette vue ».
  const reinitialiserFiltresClients = () => {
    setTypeFilter("Tous");
    setPrioriteFilter("Toutes");
    setHasNotes(false);
    setSearchParams(buildParams({ type: "Tous", priorite: "Toutes", notes: false }), { replace: true });
  };


  // Copie un lien partageable de la vue filtrée du carnet de clients (type + priorité + notes).
  const copyClientsLink = async () => {
    const qs = buildParams().toString();
    const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      ajouterLienCopie("Vue filtrée · clients", url);
      setNoticeCopie(true);
      window.setTimeout(() => setNoticeCopie(false), 2500);
    } catch {
      setNoticeCopie(false);
    }
  };

  // Date de la prochaine relance programmée par client (la plus proche), pour la pastille des cartes.
  const relanceParClient = useMemo(() => {
    const map = new Map<number, string>();
    relancesClient
      .filter((r) => r.statut === "Programmée")
      .forEach((r) => {
        const prev = map.get(r.client_id);
        if (!prev || r.date_prevue < prev) map.set(r.client_id, r.date_prevue);
      });
    return map;
  }, [relancesClient]);

  // Nombre de fiches par priorité (pour afficher un compteur sur chaque filtre).
  const nbParPriorite = useMemo(() => {
    const map: Record<string, number> = {};
    clients.forEach((c) => {
      if (c.note_priorite) map[c.note_priorite] = (map[c.note_priorite] ?? 0) + 1;
    });
    return map;
  }, [clients]);

  const handleExportCsv = () => {
    const rows = filtered.map((c) => [
      c.nom,
      c.type === "professionnel" ? "Professionnel" : "Particulier",
      c.contact_nom ?? "",
      c.secteur ?? "",
      c.telephone ?? "",
      c.email ?? "",
      c.adresse ?? "",
      c.siret ?? "",
      c.notes ?? "",
      notePrioriteInfo(c.note_priorite)?.label ?? "",
    ]);
    const csv = toCsv(
      ["Nom", "Type", "Interlocuteur", "Secteur", "Téléphone", "Email", "Adresse", "SIRET", "Notes internes", "Priorité"],
      rows,
    );
    downloadCsv(`clients-artiflow-${todayISO()}.csv`, csv);
  };

  const countDevis = (id: number) => devis.filter((d) => d.client_id === id).length;
  const countChantiers = (id: number) => chantiers.filter((c) => c.client_id === id).length;

  // Ouverture automatique d'une fiche quand on arrive avec un client ciblé
  // (lien « Voir le client » depuis un devis ou une facture).
  useEffect(() => {
    // Le filtre de priorité (?priorite=) fait désormais partie de la vue partageable : il est lu
    // directement à l'initialisation, on ne le consomme donc plus ici.
    const param = searchParams.get("client");
    if (!param || loading || clients.length === 0) return;
    const id = Number(param);
    if (!Number.isFinite(id)) return;
    const found = clients.find((c) => c.id === id);
    if (found) {
      setDetail(found);
      const next = new URLSearchParams(searchParams);
      next.delete("client");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, clients, loading]);

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
      if (editing) await updateClient(editing.id, payload);
      else await createClient(user.id, payload);
      setFormOpen(false);
      setEditing(null);
      await reload();
    } catch {
      setActionError("L'enregistrement du client a échoué. Réessayez.");
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
      setActionError("La suppression a échoué. Le client est peut-être lié à un devis ou un chantier.");
    }
  };

  if (!loading && !error && clients.length === 0) {
    return (
      <div className="flex flex-col gap-5 animate-fade-in">
        {guideVisible && (
          <GuidePremiereVisite
            titre="Bienvenue : ajoutez vos premiers clients"
            sousTitre="Voici, en 4 étapes, comment constituer votre carnet. Un client enregistré une fois se retrouve ensuite partout : devis, factures, relances."
            etapes={[
              {
                icone: "ri-user-add-line",
                titre: "Ajoutez un client",
                texte:
                  "Cliquez « Nouveau client » et saisissez au moins son nom. Téléphone, email et adresse pourront être complétés plus tard.",
              },
              {
                icone: "ri-information-2-line",
                titre: "Choisissez le type",
                texte:
                  "Particulier ou professionnel : cela change les informations demandées (SIRET, interlocuteur…). Tout reste modifiable ensuite.",
              },
              {
                icone: "ri-sticky-note-line",
                titre: "Ajoutez une note interne",
                texte:
                  "Repérez l'essentiel (préférences, budget, priorité) : la note reste privée, elle n'est jamais envoyée au client.",
              },
              {
                icone: "ri-file-add-line",
                titre: "Créez le devis",
                texte:
                  "Depuis la fiche du client, lancez un devis en un clic : les coordonnées sont reprises automatiquement.",
              },
            ]}
            note="Ce guide ne s'affiche qu'une seule fois. Vous pouvez le revoir à tout moment avec « Revoir le guide des clients »."
            onFermer={fermerGuide}
          />
        )}
        <EmptyState
          icon="ri-contacts-book-2-line"
          title="Votre carnet de clients est vide"
          text="Ajoutez vos premiers clients pour pouvoir créer des devis. Vous pouvez aussi charger un jeu de données d'exemple."
        >
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-add-line"></i> Ajouter un client
            </button>
            <SampleDataButton onSeeded={reload} />
          </div>
        </EmptyState>
        {formOpen && (
          <ClientFormModal initial={editing} busy={busy} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} />
        )}
      </div>
    );
  }

  return (
    <DataState loading={loading} error={error} onRetry={reload}>
      <div className="flex flex-col gap-5 animate-fade-in">
        {guideVisible && (
          <GuidePremiereVisite
            titre="Bienvenue : ajoutez vos premiers clients"
            sousTitre="Voici, en 4 étapes, comment constituer votre carnet. Un client enregistré une fois se retrouve ensuite partout : devis, factures, relances."
            etapes={[
              {
                icone: "ri-user-add-line",
                titre: "Ajoutez un client",
                texte:
                  "Cliquez « Nouveau client » et saisissez au moins son nom. Téléphone, email et adresse pourront être complétés plus tard.",
              },
              {
                icone: "ri-information-2-line",
                titre: "Choisissez le type",
                texte:
                  "Particulier ou professionnel : cela change les informations demandées (SIRET, interlocuteur…). Tout reste modifiable ensuite.",
              },
              {
                icone: "ri-sticky-note-line",
                titre: "Ajoutez une note interne",
                texte:
                  "Repérez l'essentiel (préférences, budget, priorité) : la note reste privée, elle n'est jamais envoyée au client.",
              },
              {
                icone: "ri-file-add-line",
                titre: "Créez le devis",
                texte:
                  "Depuis la fiche du client, lancez un devis en un clic : les coordonnées sont reprises automatiquement.",
              },
            ]}
            note="Ce guide ne s'affiche qu'une seule fois. Vous pouvez le revoir à tout moment avec « Revoir le guide des clients »."
            onFermer={fermerGuide}
          />
        )}

        {!guideVisible && (
          <button
            type="button"
            onClick={() => setGuideVisible(true)}
            className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-100 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 hover:text-accent-700 transition-colors"
          >
            <i className="ri-question-line"></i>
            Revoir le guide des clients
          </button>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto">
          <RechercheRepliable
            carteId="clients"
            carteLabel="Clients"
            value={query}
            onChange={setQuery}
            placeholder="Rechercher un client…"
            conteneurClassName="w-full md:w-72"
          />
          {aFiltresUrl && (
            <>
              <BadgeVuePartagee />
              <BoutonEpinglerVue label="Clients · vue partagée" />
            </>
          )}
          <MenuVuesPartageesRecentes basePath="/app/clients" />
          <BoutonPartager
            label="Vue filtrée · clients"
            chemin={cheminPartage}
            title="Partager la vue courante du carnet de clients"
            align="left"
          />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-foreground-500 whitespace-nowrap">
              <strong className="text-foreground-900">{clients.length}</strong> clients
            </span>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exporter la liste affichée (avec notes internes) au format CSV"
            >
              <i className="ri-file-excel-2-line"></i>
              Exporter CSV
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-user-add-line"></i>
              Nouveau client
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
            {["Tous", "Particuliers", "Professionnels"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTypeFilter(t);
                  setSearchParams(buildParams({ type: t }), { replace: true });
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  typeFilter === t ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !hasNotes;
              setHasNotes(next);
              setSearchParams(buildParams({ notes: next }), { replace: true });
            }}
            aria-pressed={hasNotes}
            title="Afficher uniquement les clients avec une note interne"
            className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              hasNotes
                ? "bg-accent-500 border-accent-500 text-background-50"
                : "bg-background-100 border-background-200 text-foreground-700 hover:border-accent-300"
            }`}
          >
            <i className="ri-sticky-note-line"></i>
            A des notes
            <span
              className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                hasNotes ? "bg-background-50/25 text-background-50" : "bg-accent-100 text-accent-800"
              }`}
            >
              {nbAvecNotes}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
            <i className="ri-flag-2-line"></i>
            Priorité
          </span>
          <button
            type="button"
            onClick={() => {
              setPrioriteFilter("Toutes");
              setSearchParams(buildParams({ priorite: "Toutes" }), { replace: true });
            }}
            aria-pressed={prioriteFilter === "Toutes"}
            className={`h-9 px-3.5 rounded-full border text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              prioriteFilter === "Toutes"
                ? "bg-primary-500 border-primary-500 text-background-50"
                : "bg-background-100 border-background-200 text-foreground-700 hover:border-primary-300"
            }`}
          >
            Toutes
          </button>
          {NOTE_PRIORITES.map((p) => {
            const count = nbParPriorite[p.key] ?? 0;
            const active = prioriteFilter === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  const next = active ? "Toutes" : p.key;
                  setPrioriteFilter(next);
                  setSearchParams(buildParams({ priorite: next }), { replace: true });
                }}
                aria-pressed={active}
                disabled={count === 0}
                title={count === 0 ? "Aucune fiche avec cette priorité" : `Isoler les fiches « ${p.label} »`}
                className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors ${
                  active ? p.badge : "bg-background-100 border-background-200 text-foreground-700 hover:border-accent-300"
                } ${count === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span className={`w-2 h-2 rounded-full ${active ? "bg-background-50/70" : p.dot}`}></span>
                {p.label}
                <span
                  className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold ${
                    active ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {(typeFilter !== "Tous" || prioriteFilter !== "Toutes" || hasNotes) && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-lg bg-accent-50 border border-accent-200 animate-fade-in">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-800 whitespace-nowrap">
              <i className="ri-filter-3-line"></i>
              Vue filtrée · carnet de clients
            </span>
            {aFiltresUrl && (
              <>
                <BadgeVuePartagee />
                <BoutonEpinglerVue label="Clients · vue partagée" />
              </>
            )}
            <span className="hidden sm:block w-px h-4 bg-accent-200" aria-hidden="true"></span>
            {typeFilter !== "Tous" && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className="ri-contacts-book-2-line text-accent-600"></i>
                {typeFilter}
              </span>
            )}
            {prioriteFilter !== "Toutes" && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className="ri-flag-2-line text-accent-600"></i>
                {notePrioriteInfo(prioriteFilter)?.label ?? prioriteFilter}
              </span>
            )}
            {hasNotes && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className="ri-sticky-note-line text-accent-600"></i>
                A des notes
              </span>
            )}
            <span className="text-[11px] text-foreground-500 whitespace-nowrap">
              {filtered.length} client{filtered.length > 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={reinitialiserFiltresClients}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                title="Remettre le type, la priorité et le filtre « a des notes » à leurs valeurs par défaut"
              >
                <i className="ri-filter-off-line"></i>
                Réinitialiser tous les filtres
              </button>
              <button
                type="button"
                onClick={copyClientsLink}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                title="Copier un lien partageable contenant le type, la priorité et le filtre « a des notes »"
              >
                <i className={noticeCopie ? "ri-check-line" : "ri-link"}></i>
                {noticeCopie ? "Lien copié" : "Copier le lien"}
              </button>
              <button
                type="button"
                onClick={oublierVueClients}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-accent-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                title="Oublier la dernière vue mémorisée des clients et repartir des filtres par défaut"
              >
                <i className="ri-eraser-line"></i>
                Oublier cette vue
              </button>
            </div>
          </div>
        )}

        {actionError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {actionError}
          </p>
        )}

        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground-500 rounded-lg bg-background-100 border border-background-200">
            Aucun client ne correspond à votre recherche.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const relance = relanceParClient.get(c.id);
              return (
                <div key={c.id} className="flex flex-col p-5 rounded-lg bg-background-100 border border-background-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800 font-semibold">
                        {c.nom.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-heading font-semibold text-base text-foreground-950 truncate">{c.nom}</h3>
                        <p className="text-[11px] text-foreground-500">{countDevis(c.id)} devis · {countChantiers(c.id)} chantiers</p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-bold ${
                        c.type === "professionnel" ? "bg-accent-100 text-accent-800" : "bg-secondary-100 text-secondary-800"
                      }`}
                    >
                      <i className={c.type === "professionnel" ? "ri-building-2-line" : "ri-user-line"}></i>
                      {c.type === "professionnel" ? "PRO" : "Particulier"}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-col gap-1.5 text-sm text-foreground-600">
                    <span className="inline-flex items-center gap-2">
                      <i className="ri-phone-line text-foreground-400"></i>
                      {c.telephone ?? "—"}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <i className="ri-mail-line text-foreground-400"></i>
                      {c.email ?? "—"}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <i className="ri-map-pin-line text-foreground-400"></i>
                      {c.adresse ?? "—"}
                    </span>
                  </div>

                  {c.notes && c.notes.trim() ? (
                    <div className="mt-3 flex flex-col gap-1.5 rounded-md bg-accent-100/50 border border-accent-100 px-2.5 py-2">
                      {(() => {
                        const pr = notePrioriteInfo(c.note_priorite);
                        return pr ? (
                          <span className={`self-start inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[10px] font-bold ${pr.badge}`}>
                            <i className={pr.icon}></i>
                            {pr.label}
                          </span>
                        ) : null;
                      })()}
                      <div className="flex items-start gap-2">
                        <i className="ri-sticky-note-line text-accent-600 text-sm mt-0.5"></i>
                        <span className="text-[11px] text-foreground-600 line-clamp-2">{c.notes.trim()}</span>
                      </div>
                    </div>
                  ) : null}

                  {c.derniere_relance_at &&
                    (() => {
                      const jours = joursDepuisDerniereRelance(c.derniere_relance_at);
                      const recent = jours !== null && jours < RELANCE_CLIENT_DELAI_ALERTE;
                      return (
                        <p
                          className={`mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium ${
                            recent ? "text-red-600" : "text-foreground-400"
                          }`}
                          title={recent ? "Relance récente : évitez un nouvel envoi trop rapproché" : "Date de la dernière relance"}
                        >
                          <i className={recent ? "ri-alarm-warning-line" : "ri-history-line"}></i>
                          Dernière relance le {formatShortDate(c.derniere_relance_at)}
                          {recent ? " · récente" : ""}
                        </p>
                      );
                    })()}

                  {relance && (
                    <p
                      className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent-700"
                      title="Relance email programmée : elle partira automatiquement à cette date"
                    >
                      <i className="ri-calendar-schedule-line"></i>
                      Relance prévue le {formatShortDate(relance)}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-background-200">
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
                      onClick={() => setQuickNote(c)}
                      title={c.notes && c.notes.trim() ? "Modifier la note interne" : "Ajouter une note rapide"}
                      aria-label="Note interne"
                      className={`w-9 h-9 flex items-center justify-center rounded-md border cursor-pointer transition-colors ${
                        c.notes && c.notes.trim()
                          ? "bg-accent-100 border-accent-200 text-accent-700 hover:bg-accent-200"
                          : "bg-background-50 border-background-200 text-foreground-400 hover:text-accent-700 hover:border-accent-300"
                      }`}
                    >
                      <i className="ri-sticky-note-line"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(c)}
                      className="w-9 h-9 flex items-center justify-center rounded-md bg-background-50 border border-background-200 text-foreground-400 hover:text-red-600 hover:border-red-300 cursor-pointer transition-colors"
                      aria-label="Supprimer le client"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {formOpen && (
          <ClientFormModal initial={editing} busy={busy} onClose={() => setFormOpen(false)} onSubmit={handleSubmit} />
        )}

        {quickNote && (
          <QuickNoteModal client={quickNote} onClose={() => setQuickNote(null)} onSaved={reload} />
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
          <Modal title="Supprimer ce client ?" onClose={() => setPendingDelete(null)}>
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