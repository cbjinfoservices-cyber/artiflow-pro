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
import { useEchecsEnvoisClients, type EchecEnvoiClient } from "@/hooks/useEchecsEnvoisClients";
import { renvoyerEmailClientEnEchec } from "@/lib/suiviChantier";
import { ajouterRenvoiCloche } from "@/lib/renvoisClocheMemoire";
import { lireFiltresClients, memoriserFiltresClients, effacerFiltresClients } from "@/lib/clientsFiltresMemoire";
import { ajouterLienCopie } from "@/lib/liensCopiesMemoire";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import SampleDataButton from "@/pages/app/components/SampleDataButton";
import Modal from "@/pages/app/components/Modal";
import ClientFormModal from "@/pages/app/clients/components/ClientFormModal";
import QuickNoteModal from "@/pages/app/clients/components/QuickNoteModal";
import ProDetailPanel from "@/pages/app/clients/components/ProDetailPanel";
import ClientsProIndicateurs from "@/pages/app/clients/components/ClientsProIndicateurs";
import ClientsFiltreType, { type TypeClientFiltre } from "@/pages/app/clients/components/ClientsFiltreType";
import RepartitionCarnet from "@/pages/app/clients/components/RepartitionCarnet";
import ClientsProFiltres, { type TriPro } from "@/pages/app/clients/components/ClientsProFiltres";
import BadgeVuePartagee from "@/pages/app/components/BadgeVuePartagee";
import BoutonEpinglerVue from "@/pages/app/components/BoutonEpinglerVue";
import BoutonPartager from "@/pages/app/components/BoutonPartager";
import MenuVuesPartageesRecentes from "@/pages/app/components/MenuVuesPartageesRecentes";
import RechercheRepliable from "@/components/feature/RechercheRepliable";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import RappelAstucePage from "@/components/base/RappelAstucePage";
import { guidePremiereVisiteVu, marquerGuidePremiereVisiteVu } from "@/lib/guidePremiereVisite";
import type { ClientItem } from "@/hooks/useArtisanData";
import { originePublique } from "@/lib/site";

/** Champs attendus sur une fiche professionnelle, avec leur libellé lisible. */
const CHAMPS_PRO: ReadonlyArray<{ cle: "siret" | "contact_nom" | "secteur"; label: string }> = [
  { cle: "siret", label: "SIRET" },
  { cle: "contact_nom", label: "interlocuteur" },
  { cle: "secteur", label: "secteur" },
];

/** Liste les informations manquantes sur une fiche pro (vide si la fiche est complète). */
function champsProManquants(client: ClientItem): string[] {
  return CHAMPS_PRO.filter((champ) => !(client[champ.cle] ?? "").trim()).map((champ) => champ.label);
}

/** Une fiche pro est incomplète dès qu'il lui manque le SIRET, l'interlocuteur ou le secteur. */
function estProIncomplete(client: ClientItem): boolean {
  return champsProManquants(client).length > 0;
}

export default function AppClients() {
  usePageMeta(
    "Clients · ArtiFlow-pro",
    "Votre carnet de clients : particuliers et entreprises (interlocuteur, secteur, SIRET, CA) réunis dans un seul écran.",
  );
  const { user } = useAuth();
  const { loading, error, clients, devis, chantiers, factures, reload } = useArtisanData();
  // Relances client programmées : pour signaler « relance prévue » directement sur les cartes.
  const { relances: relancesClient } = useRelancesClient(user?.id ?? null);
  // Emails clients refusés : pour rappeler le dernier refus sur la fiche et proposer le renvoi.
  const { parChantier: echecsParChantier, reload: reloadEchecs } = useEchecsEnvoisClients();
  const echecParClient = useMemo(() => {
    const map = new Map<number, EchecEnvoiClient>();
    Object.values(echecsParChantier).forEach((echec) => {
      if (!echec.clientId) return;
      const deja = map.get(echec.clientId);
      if (!deja || echec.created_at > deja.created_at) map.set(echec.clientId, echec);
    });
    return map;
  }, [echecsParChantier]);

  // Dernière vue mémorisée des filtres clients (type, priorité, « a des notes ») : valeur par défaut au retour.
  const memoFiltres = useMemo(lireFiltresClients, []);

  // Filtres de la vue, mémorisés dans l'URL (?type=, ?priorite=, ?notes=1) pour rendre la vue filtrée partageable.
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Indicateur « vue partagée » : vrai quand l'adresse porte de vrais filtres reçus par lien.
  // Les vues « Particuliers » et « Professionnels » sont devenues des modes de navigation normaux
  // (elles ont leur entrée dans le menu), elles ne comptent donc pas comme un partage.
  const aFiltresUrl = useMemo(
    () =>
      ["priorite", "notes", "incomplet"].some((k) => searchParams.has(k)) ||
      (searchParams.has("type") &&
        !["Particuliers", "Professionnels"].includes(searchParams.get("type") ?? "")),
    [searchParams],
  );
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(() => {
    const t = searchParams.get("type");
    if (t === "Particuliers" || t === "Professionnels") return t;
    // Un lien « fiches incomplètes » sans type explicite reste une vue professionnels.
    if (searchParams.get("incomplet") === "1") return "Professionnels";
    return memoFiltres.type ?? "Tous";
  });
  const [prioriteFilter, setPrioriteFilter] = useState(() => {
    const p = searchParams.get("priorite");
    return p && NOTE_PRIORITES.some((x) => x.key === p) ? p : memoFiltres.priorite ?? "Toutes";
  });
  const [hasNotes, setHasNotes] = useState(() => searchParams.get("notes") === "1" || Boolean(memoFiltres.notes));
  // Tri et secteur ne concernent que la vue professionnels : ils restent locaux à la session.
  const [tri, setTri] = useState<TriPro>("nom");
  const [secteurFilter, setSecteurFilter] = useState("");
  // Filtre « fiche pro incomplète » : n'a de sens que dans la vue professionnels.
  const [proIncomplet, setProIncomplet] = useState(() => searchParams.get("incomplet") === "1");
  const [noticeCopie, setNoticeCopie] = useState(false);
  const [quickNote, setQuickNote] = useState<ClientItem | null>(null);
  const [detail, setDetail] = useState<ClientItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientItem | null>(null);
  // Type pré-sélectionné dans le formulaire quand on arrive par « + Particulier » / « + Entreprise » du menu.
  const [formType, setFormType] = useState<"particulier" | "professionnel" | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Message de confirmation après enregistrement (et renvoi éventuel d'un email refusé).
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ClientItem | null>(null);

  // Guide de première visite : présenté au premier passage sur le carnet de clients,
  // puis mémorisé une fois fermé. Réouvrable via « Revoir le guide des clients ».
  const [guideVisible, setGuideVisible] = useState(() => !guidePremiereVisiteVu("clients"));
  const fermerGuide = () => {
    marquerGuidePremiereVisiteVu("clients");
    setGuideVisible(false);
  };

  // Vue « Professionnels » : ce n'est pas un second carnet, seulement le carnet filtré sur les
  // entreprises. On y ajoute les repères utiles côté pro (secteur, CA généré, tri par CA).
  const modePro = typeFilter === "Professionnels";
  const pros = useMemo(() => clients.filter((c) => c.type === "professionnel"), [clients]);
  // Répartition du carnet, affichée sur les pastilles du filtre de type.
  const nbParticuliers = useMemo(() => clients.filter((c) => c.type !== "professionnel").length, [clients]);
  const caDe = (id: number) => devis.filter((d) => d.client_id === id).reduce((sum, d) => sum + Number(d.total_ht || 0), 0);
  const secteurs = useMemo(() => {
    const set = new Set<string>();
    pros.forEach((c) => {
      if (c.secteur) set.add(c.secteur);
    });
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  }, [pros]);
  // Nombre de fiches pro auxquelles il manque au moins une information (SIRET, interlocuteur, secteur).
  const nbProsIncompletes = useMemo(() => pros.filter(estProIncomplete).length, [pros]);

  // Répartition complète du carnet, affichée en tête de page : volume, devis et CA par type de fiche.
  const repartition = useMemo(() => {
    const calculer = (liste: ClientItem[]) => ({
      nombre: liste.length,
      devis: liste.reduce((sum, c) => sum + devis.filter((d) => d.client_id === c.id).length, 0),
      ca: liste.reduce((sum, c) => sum + caDe(c.id), 0),
    });
    return {
      particuliers: calculer(clients.filter((c) => c.type !== "professionnel")),
      entreprises: calculer(clients.filter((c) => c.type === "professionnel")),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, devis]);

  // Mini-historique : CA généré sur les 3 derniers mois (mois courant inclus), par type de fiche.
  // On s'appuie sur la date de création du devis, comme le CA global des cartes de répartition.
  const historiqueCa = useMemo(() => {
    const mois: { cle: string; label: string }[] = [];
    const aujourdhui = new Date();
    for (let i = 2; i >= 0; i -= 1) {
      const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - i, 1);
      mois.push({
        cle: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
      });
    }
    const cleMois = (iso: string) => iso.slice(0, 7);
    const calculer = (liste: ClientItem[]) => {
      const ids = new Set(liste.map((c) => c.id));
      return mois.map((m) => ({
        label: m.label,
        ca: devis
          .filter((d) => d.client_id !== null && ids.has(d.client_id) && cleMois(d.created_at) === m.cle)
          .reduce((sum, d) => sum + Number(d.total_ht || 0), 0),
      }));
    };
    return {
      particuliers: calculer(clients.filter((c) => c.type !== "professionnel")),
      entreprises: calculer(clients.filter((c) => c.type === "professionnel")),
    };
  }, [clients, devis]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = clients.filter((c) => {
      const matchQ =
        !q ||
        c.nom.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.telephone ?? "").toLowerCase().includes(q) ||
        (c.contact_nom ?? "").toLowerCase().includes(q) ||
        (c.siret ?? "").toLowerCase().includes(q);
      const matchType =
        typeFilter === "Tous" ||
        (typeFilter === "Professionnels" ? c.type === "professionnel" : c.type !== "professionnel");
      const matchNotes = !hasNotes || Boolean(c.notes && c.notes.trim().length > 0);
      const matchPriorite = prioriteFilter === "Toutes" || c.note_priorite === prioriteFilter;
      const matchSecteur = !modePro || !secteurFilter || c.secteur === secteurFilter;
      const matchIncomplet = !modePro || !proIncomplet || estProIncomplete(c);
      return matchQ && matchType && matchNotes && matchPriorite && matchSecteur && matchIncomplet;
    });
    if (!modePro) return list;
    const sorted = [...list];
    if (tri === "ca") sorted.sort((a, b) => caDe(b.id) - caDe(a.id));
    else sorted.sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, query, typeFilter, hasNotes, prioriteFilter, modePro, secteurFilter, tri, proIncomplet, devis]);

  const nbAvecNotes = useMemo(() => clients.filter((c) => Boolean(c.notes && c.notes.trim())).length, [clients]);

  // Mémorise la vue courante (type, priorité, « a des notes ») pour la restaurer au prochain retour.
  useEffect(() => {
    memoriserFiltresClients({ type: typeFilter, priorite: prioriteFilter, notes: hasNotes });
  }, [typeFilter, prioriteFilter, hasNotes]);

  // Les entrées « Particuliers » et « Entreprises » du menu ouvrent la même page avec un filtre de
  // type dans l'adresse : si l'on est déjà sur le carnet, on aligne l'écran sur la nouvelle adresse.
  useEffect(() => {
    const t = searchParams.get("type");
    if (t !== "Particuliers" && t !== "Professionnels") return;
    setTypeFilter((precedent) => (precedent === t ? precedent : t));
    if (t !== "Professionnels") {
      setSecteurFilter("");
      setProIncomplet(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Construit les paramètres d'URL de la vue filtrée courante (type, priorité, notes), avec surcharge ponctuelle.
  const buildParams = (override: Partial<{ type: string; priorite: string; notes: boolean; incomplet: boolean }> = {}) => {
    const t = override.type ?? typeFilter;
    const p = override.priorite ?? prioriteFilter;
    const n = override.notes ?? hasNotes;
    const inc = override.incomplet ?? proIncomplet;
    const params = new URLSearchParams();
    if (t && t !== "Tous") params.set("type", t);
    if (p && p !== "Toutes") params.set("priorite", p);
    if (n) params.set("notes", "1");
    if (t === "Professionnels" && inc) params.set("incomplet", "1");
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
    setSecteurFilter("");
    setTri("nom");
    setProIncomplet(false);
    setSearchParams(buildParams({ type: "Tous", priorite: "Toutes", notes: false, incomplet: false }), { replace: true });
  };

  // Remet d'un coup les filtres du carnet (type, priorité, « a des notes ») à leurs valeurs par
  // défaut. Ne touche pas à la mémoire de la dernière vue, contrairement à « Oublier cette vue ».
  const reinitialiserFiltresClients = () => {
    setTypeFilter("Tous");
    setPrioriteFilter("Toutes");
    setHasNotes(false);
    setSecteurFilter("");
    setTri("nom");
    setProIncomplet(false);
    setSearchParams(buildParams({ type: "Tous", priorite: "Toutes", notes: false, incomplet: false }), { replace: true });
  };


  // Copie un lien partageable de la vue filtrée du carnet de clients (type + priorité + notes).
  const copyClientsLink = async () => {
    const qs = buildParams().toString();
    const url = `${originePublique()}${window.location.pathname}${qs ? `?${qs}` : ""}`;
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
    const entetes = [
      "Nom",
      "Type",
      "Interlocuteur",
      "Secteur",
      "Téléphone",
      "Email",
      "Adresse",
      "SIRET",
      "Notes internes",
      "Priorité",
      ...(modePro ? ["Devis", "CA HT"] : []),
    ];
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
      ...(modePro
        ? [String(devis.filter((d) => d.client_id === c.id).length), caDe(c.id).toFixed(2).replace(".", ",")]
        : []),
    ]);
    const csv = toCsv(entetes, rows);
    downloadCsv(`${modePro ? "professionnels" : "clients"}-artiflow-${todayISO()}.csv`, csv);
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

  // Bascule le carnet sur un type de fiche (pastilles et cartes de répartition partagent cette logique).
  const changerType = (t: TypeClientFiltre) => {
    setTypeFilter(t);
    if (t !== "Professionnels") {
      setSecteurFilter("");
      setProIncomplet(false);
    }
    setSearchParams(buildParams({ type: t, incomplet: t === "Professionnels" ? proIncomplet : false }), {
      replace: true,
    });
  };

  const openCreate = (type?: "particulier" | "professionnel") => {
    setEditing(null);
    setFormType(type ?? (modePro ? "professionnel" : undefined));
    setFormOpen(true);
  };

  // Ferme le formulaire et oublie le type pré-sélectionné, pour ne pas le conserver à la réouverture.
  const fermerFormulaire = () => {
    setFormOpen(false);
    setFormType(undefined);
  };

  // Les raccourcis « + Particulier » / « + Entreprise » du menu arrivent avec `?nouveau=` : on ouvre
  // directement le formulaire avec le bon type, puis on retire le paramètre pour ne pas le rejouer.
  useEffect(() => {
    const nouveau = searchParams.get("nouveau");
    if (!nouveau) return;
    if (nouveau === "particulier" || nouveau === "professionnel") {
      setEditing(null);
      setFormType(nouveau);
      setFormOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("nouveau");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openEdit = (client: ClientItem) => {
    setEditing(client);
    setFormType(undefined);
    setFormOpen(true);
  };

  const handleSubmit = async (payload: ClientPayload, options?: { renvoyerApres?: boolean }) => {
    if (!user) return;
    setBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      let notice: string | null = null;
      if (editing) {
        await updateClient(editing.id, payload);
        // Adresse corrigée + renvoi accepté : on réexpédie le dernier email refusé
        // avec la nouvelle adresse, sans repasser par la cloche.
        const echec = echecParClient.get(editing.id) ?? null;
        if (options?.renvoyerApres && echec) {
          const resultat = await renvoyerEmailClientEnEchec(echec.chantierId, echec.motif);
          notice = resultat.ok
            ? resultat.destinataire
              ? `Fiche enregistrée · email renvoyé à ${resultat.destinataire}.`
              : "Fiche enregistrée · email renvoyé au client."
            : `Fiche enregistrée, mais le renvoi a échoué : ${resultat.error ?? "adresse toujours refusée."}`;
          ajouterRenvoiCloche({
            chantierId: echec.chantierId,
            destinataire: resultat.destinataire ?? echec.destinataire,
            ok: resultat.ok,
            message: resultat.ok
              ? `Renvoyé à ${resultat.destinataire ?? echec.destinataire ?? "l'adresse corrigée"}.`
              : resultat.error ?? "Le renvoi a échoué.",
          });
          reloadEchecs();
        }
      } else {
        await createClient(user.id, payload);
      }
      fermerFormulaire();
      setEditing(null);
      setActionNotice(notice);
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
              onClick={() => openCreate()}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-add-line"></i> Ajouter un client
            </button>
            <SampleDataButton onSeeded={reload} />
          </div>
        </EmptyState>
        {formOpen && (
          <ClientFormModal
            initial={editing}
            busy={busy}
            defaultType={formType ?? (modePro ? "professionnel" : undefined)}
            onClose={fermerFormulaire}
            onSubmit={handleSubmit}
            echecEnvoi={editing ? echecParClient.get(editing.id) ?? null : null}
          />
        )}
      </div>
    );
  }

  return (
    <DataState loading={loading} error={error} onRetry={reload}>
      <div className="flex flex-col gap-5 animate-fade-in">
        {/* Répartition du carnet : deux cartes cliquables qui filtrent directement sur un type. */}
        <RepartitionCarnet
          particuliers={repartition.particuliers}
          entreprises={repartition.entreprises}
          historiqueParticuliers={historiqueCa.particuliers}
          historiqueEntreprises={historiqueCa.entreprises}
          actif={typeFilter as TypeClientFiltre}
          onChoisir={changerType}
        />
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
          {aFiltresUrl && <BadgeVuePartagee />}
          {(aFiltresUrl || typeFilter !== "Tous") && (
            <BoutonEpinglerVue
              label={
                typeFilter === "Professionnels"
                  ? "Clients · Professionnels"
                  : typeFilter === "Particuliers"
                    ? "Clients · Particuliers"
                    : "Clients · vue partagée"
              }
              chemin={cheminPartage}
            />
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
              onClick={() => openCreate()}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className={modePro ? "ri-building-2-line" : "ri-user-add-line"}></i>
              {modePro ? "Nouveau professionnel" : "Nouveau client"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ClientsFiltreType
            valeur={typeFilter}
            onChanger={changerType}
            nbParticuliers={nbParticuliers}
            nbEntreprises={pros.length}
          />
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

        {(typeFilter !== "Tous" || prioriteFilter !== "Toutes" || hasNotes || proIncomplet) &&
          !(typeFilter !== "Tous" && prioriteFilter === "Toutes" && !hasNotes && !proIncomplet) && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-lg bg-accent-50 border border-accent-200 animate-fade-in">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-800 whitespace-nowrap">
              <i className="ri-filter-3-line"></i>
              Vue filtrée · carnet de clients
            </span>
            {aFiltresUrl && <BadgeVuePartagee />}
            <span className="hidden sm:block w-px h-4 bg-accent-200" aria-hidden="true"></span>
            {typeFilter !== "Tous" && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className="ri-contacts-book-2-line text-accent-600"></i>
                {typeFilter}
              </span>
            )}
            {modePro && secteurFilter && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className="ri-price-tag-3-line text-accent-600"></i>
                {secteurFilter}
              </span>
            )}
            {modePro && proIncomplet && (
              <span
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap"
                title="Fiches pro auxquelles il manque au moins une information (SIRET, interlocuteur ou secteur)"
              >
                <i className="ri-error-warning-line text-secondary-700"></i>
                Fiche incomplète
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

        {modePro && (
          <ClientsProIndicateurs
            pros={pros}
            devis={devis}
            chantiers={chantiers}
            onVoirTous={() => {
              setTypeFilter("Tous");
              setSecteurFilter("");
              setProIncomplet(false);
              setSearchParams(buildParams({ type: "Tous", incomplet: false }), { replace: true });
            }}
          />
        )}

        {modePro && (
          <ClientsProFiltres
            secteurs={secteurs}
            secteur={secteurFilter}
            onSecteurChange={setSecteurFilter}
            tri={tri}
            onTriChange={setTri}
            incomplet={proIncomplet}
            onIncompletChange={(v) => {
              setProIncomplet(v);
              setSearchParams(buildParams({ incomplet: v }), { replace: true });
            }}
            nbIncomplets={nbProsIncompletes}
          />
        )}

        {actionError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {actionError}
          </p>
        )}

        {actionNotice && (
          <div className="flex items-start gap-1.5 px-3 py-2 rounded-md bg-accent-50 border border-accent-200 text-xs text-accent-900">
            <i className="ri-checkbox-circle-line mt-0.5"></i>
            <span className="min-w-0 flex-1">{actionNotice}</span>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              aria-label="Fermer le message"
              className="w-5 h-5 shrink-0 flex items-center justify-center rounded text-accent-800 hover:bg-accent-100 cursor-pointer"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground-500 rounded-lg bg-background-100 border border-background-200">
            Aucun client ne correspond à votre recherche.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const relance = relanceParClient.get(c.id);
              const manquants = modePro ? champsProManquants(c) : [];
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

                  {manquants.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      title={`Compléter cette fiche (${manquants.join(", ")}) pour des devis et factures sans aller-retour`}
                      className="mt-3 self-start inline-flex flex-wrap items-center gap-1 h-7 px-2.5 rounded-full bg-secondary-100 border border-secondary-200 text-[11px] font-semibold text-secondary-800 whitespace-nowrap cursor-pointer hover:bg-secondary-200 hover:border-secondary-300 transition-colors"
                    >
                      <i className="ri-error-warning-line"></i>
                      Fiche incomplète : {manquants.join(", ")} manquant{manquants.length > 1 ? "s" : ""}
                      <i className="ri-edit-line"></i>
                    </button>
                  )}

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

        {/* Rappel discret en bas d'écran : les astuces de cet écran vivent dans le panneau Aide. */}
        <RappelAstucePage />

        {formOpen && (
          <ClientFormModal
            initial={editing}
            busy={busy}
            defaultType={formType ?? (modePro ? "professionnel" : undefined)}
            onClose={fermerFormulaire}
            onSubmit={handleSubmit}
            echecEnvoi={editing ? echecParClient.get(editing.id) ?? null : null}
          />
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
            echecEnvoi={echecParClient.get(detail.id) ?? null}
            onEnvoiRelance={reloadEchecs}
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