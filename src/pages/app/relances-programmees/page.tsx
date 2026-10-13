import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useArtisanData } from "@/hooks/useArtisanData";
import { useRelancesClient } from "@/hooks/useRelancesClient";
import {
  bulkRescheduleRelancesClient,
  bulkShiftRelancesClient,
  deleteRelanceClient,
  markRelanceClientEchec,
  markRelanceClientEnvoyee,
  type BulkReschedulePayload,
  type RelanceClientItem,
} from "@/lib/relancesClient";
import { sendClientRelanceEmail, updateClient, updateDecalageFavori, type ClientPayload } from "@/lib/artisanApi";
import { addDays, formatShortDate, toISODate, todayISO } from "@/lib/dates";
import { downloadCsv, toCsv } from "@/lib/csv";
import { lireFiltresRelancesProgrammees, memoriserFiltresRelancesProgrammees, effacerFiltresRelancesProgrammees } from "@/lib/relancesProgrammeesFiltresMemoire";
import { ajouterLienCopie } from "@/lib/liensCopiesMemoire";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import Modal from "@/pages/app/components/Modal";
import ScheduleRelanceModal from "@/pages/app/dashboard/components/ScheduleRelanceModal";
import BulkRescheduleModal from "@/pages/app/relances-programmees/components/BulkRescheduleModal";
import RelanceRow from "@/pages/app/relances-programmees/components/RelanceRow";
import PreviewRelanceClientModal from "@/pages/app/relances-programmees/components/PreviewRelanceClientModal";
import ConfirmSendModal from "@/pages/app/relances-programmees/components/ConfirmSendModal";
import RetryRecapModal, { type RetryRecap } from "@/pages/app/relances-programmees/components/RetryRecapModal";
import ClientFormModal from "@/pages/app/clients/components/ClientFormModal";
import CompleterEmailsModal from "@/pages/app/components/CompleterEmailsModal";
import RechercheRepliable from "@/components/feature/RechercheRepliable";
import type { ClientItem } from "@/hooks/useArtisanData";

/** Périodes de filtrage proposées pour la liste des relances à venir. */
type Periode = "7" | "30" | "90" | "all";

const PERIODES: { value: Periode; label: string }[] = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "all", label: "Tout" },
];

/** Périodes de filtrage proposées pour la liste des relances déjà traitées. */
type PeriodeTraitees = "jour" | "7" | "mois" | "all";

const PERIODES_TRAITEES: { value: PeriodeTraitees; label: string }[] = [
  { value: "jour", label: "Aujourd'hui" },
  { value: "7", label: "7 jours" },
  { value: "mois", label: "Ce mois" },
  { value: "all", label: "Tout" },
];

/** Filtre par statut proposé pour la liste des relances déjà traitées. */
type StatutTraitees = "all" | "envoyee" | "echec";

const STATUTS_TRAITEES: { value: StatutTraitees; label: string; icon: string }[] = [
  { value: "all", label: "Toutes", icon: "ri-list-check" },
  { value: "envoyee", label: "Envoyées", icon: "ri-send-plane-line" },
  { value: "echec", label: "En échec", icon: "ri-error-warning-line" },
];

/** Une relance déjà traitée est-elle considérée « en échec » (statut contenant « échec ») ? */
function estEnEchec(statut: string): boolean {
  return /chec/i.test(statut);
}

/**
 * Le motif d'échec indique-t-il un client sans adresse email ? C'est la cause récurrente la plus
 * fréquente, qu'on peut corriger directement dans la fiche du client puis re-tenter.
 */
function motifSansEmail(motif: string): boolean {
  return /adresse email/i.test(motif) || /sans email/i.test(motif);
}

/** Modes d'affichage : liste à plat, ou regroupée par client. */
type Vue = "liste" | "clients";

const VUES: { value: Vue; label: string; icon: string }[] = [
  { value: "liste", label: "Liste", icon: "ri-list-check" },
  { value: "clients", label: "Par client", icon: "ri-group-line" },
];

/**
 * Page dédiée aux relances client programmées : elle rassemble toutes les relances à venir
 * (envoi automatique à la date choisie) et permet de les prévisualiser avant envoi, de les
 * reprogrammer en lot (au global ou client par client) ou une par une, ou de les annuler.
 * Les envois déjà effectués sont listés en bas pour référence.
 */
export default function AppRelancesProgrammees() {
  usePageMeta("Relances programmées · ArtiFlow-pro", "Toutes vos relances client à venir, prévisualisables et reprogrammables en lot.");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, refreshProfile } = useAuth();
  const { loading, error, clients, reload: reloadClients } = useArtisanData();
  const { relances, reload: reloadRelances } = useRelancesClient(user?.id ?? null);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<RelanceClientItem | null>(null);
  const [previewing, setPreviewing] = useState<RelanceClientItem | null>(null);
  const [bulk, setBulk] = useState<{ ids: number[]; label: string } | null>(null);
  const [pendingCancel, setPendingCancel] = useState<RelanceClientItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendingRowId, setSendingRowId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Dernière vue mémorisée (période à venir, affichage, filtres « déjà traitées ») : valeur par défaut au retour.
  const memoFiltres = useMemo(lireFiltresRelancesProgrammees, []);
  const [periode, setPeriode] = useState<Periode>(() => {
    const q = searchParams.get("periode");
    if (q === "7" || q === "30" || q === "90" || q === "all") return q;
    const p = memoFiltres.periode;
    return p === "7" || p === "30" || p === "90" || p === "all" ? p : "all";
  });
  const [vue, setVue] = useState<Vue>(() => {
    const q = searchParams.get("vue");
    if (q === "liste" || q === "clients") return q;
    return memoFiltres.vue === "clients" ? "clients" : "liste";
  });
  const [inclureTraitees, setInclureTraitees] = useState(false);
  const [rechercheClient, setRechercheClient] = useState("");
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSendProgress, setBulkSendProgress] = useState<{ done: number; total: number } | null>(null);
  const [pendingSend, setPendingSend] = useState<RelanceClientItem[] | null>(null);
  const [periodeTraitees, setPeriodeTraitees] = useState<PeriodeTraitees>(() => {
    const q = searchParams.get("ptraitees");
    if (q === "jour" || q === "7" || q === "mois" || q === "all") return q;
    const p = memoFiltres.periodeTraitees;
    return p === "jour" || p === "7" || p === "mois" || p === "all" ? p : "all";
  });
  const [statutTraitees, setStatutTraitees] = useState<StatutTraitees>(() => {
    const q = searchParams.get("statut");
    if (q === "envoyee" || q === "echec" || q === "all") return q;
    const s = memoFiltres.statutTraitees;
    return s === "envoyee" || s === "echec" ? s : "all";
  });
  const [retryRecap, setRetryRecap] = useState<RetryRecap | null>(null);
  const [editingClient, setEditingClient] = useState<ClientItem | null>(null);
  const [clientBusy, setClientBusy] = useState(false);
  // Motif d'échec précis sélectionné dans « Déjà traitées » (« all » = tous les motifs).
  const [motifTraitees, setMotifTraitees] = useState<string>("all");
  // Semaine précise sélectionnée en cliquant une barre de la mini-courbe du tableau de bord
  // (date ISO du premier jour de la semaine ; null = pas de filtre de semaine).
  const [semaineTraitees, setSemaineTraitees] = useState<string | null>(null);
  const [showEmailsModal, setShowEmailsModal] = useState(false);
  // Confirmation visuelle temporaire du bouton « Copier le lien » de la vue partageable.
  const [lienCopie, setLienCopie] = useState(false);
  // Indique que l'envoi confirmé est une re-tentative d'échecs (affiche le récapitulatif de fin).
  const [pendingSendRetry, setPendingSendRetry] = useState(false);
  // Garde-fou : la re-tentative demandée depuis un raccourci (URL « retry=1 ») ne se déclenche qu'une fois.
  const retryFiredRef = useRef(false);

  const nomParClient = useMemo(() => {
    const map = new Map<number, string>();
    clients.forEach((c) => map.set(c.id, c.nom));
    return map;
  }, [clients]);

  const clientParId = useMemo(() => {
    const map = new Map<number, (typeof clients)[number]>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  // Mémorise la vue courante et la reflète dans l'URL (?periode=, ?vue=, ?ptraitees=, ?statut=)
  // pour la rendre partageable par lien, tout en préservant les raccourcis ponctuels surnuméraires
  // (motif, semaine, retry) éventuellement présents.
  useEffect(() => {
    memoriserFiltresRelancesProgrammees({ periode, vue, periodeTraitees, statutTraitees });
    const next = new URLSearchParams(searchParams);
    if (periode === "all") next.delete("periode");
    else next.set("periode", periode);
    if (vue === "liste") next.delete("vue");
    else next.set("vue", vue);
    if (periodeTraitees === "all") next.delete("ptraitees");
    else next.set("ptraitees", periodeTraitees);
    if (statutTraitees === "all") next.delete("statut");
    else next.set("statut", statutTraitees);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode, vue, periodeTraitees, statutTraitees]);

  // Oublie la dernière vue mémorisée et repart des filtres par défaut (et nettoie l'URL).
  const oublierVueRelances = () => {
    effacerFiltresRelancesProgrammees();
    setPeriode("all");
    setVue("liste");
    setPeriodeTraitees("all");
    setStatutTraitees("all");
    setMotifTraitees("all");
    setSemaineTraitees(null);
    const next = new URLSearchParams(searchParams);
    ["periode", "vue", "ptraitees", "statut", "motif", "semaine", "retry"].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
    setNotice("Dernière vue des relances oubliée : les filtres par défaut seront rechargés au prochain retour.");
  };

  // Copie un lien partageable de la vue courante des relances programmées (période, affichage,
  // filtres « déjà traitées »), enregistré aussi dans l'historique du tableau de bord.
  const copierLienRelances = async () => {
    const params = new URLSearchParams();
    if (periode !== "all") params.set("periode", periode);
    if (vue !== "liste") params.set("vue", vue);
    if (periodeTraitees !== "all") params.set("ptraitees", periodeTraitees);
    if (statutTraitees !== "all") params.set("statut", statutTraitees);
    const qs = params.toString();
    const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      ajouterLienCopie("Vue filtrée · relances programmées", url);
      setLienCopie(true);
      window.setTimeout(() => setLienCopie(false), 2500);
    } catch {
      setLienCopie(false);
    }
  };

  // Clients sans adresse email : ces fiches ne peuvent pas être relancées tant qu'elles restent vides.
  const clientsSansEmail = useMemo(() => clients.filter((c) => !c.email || !c.email.trim()), [clients]);

  // Présélection des filtres « Déjà traitées » depuis un raccourci (widget « Échecs récurrents ») :
  // le paramètre « motif » isole les relances en échec portant exactement ce motif.
  useEffect(() => {
    const statut = searchParams.get("statut");
    if (statut === "echec" || statut === "envoyee") setStatutTraitees(statut);
    else if (statut === "all") setStatutTraitees("all");
    const motif = searchParams.get("motif");
    if (motif) {
      setStatutTraitees("echec");
      setMotifTraitees(motif);
    }
    // Semaine précise choisie en cliquant une barre de la mini-courbe du tableau de bord.
    const semaine = searchParams.get("semaine");
    if (semaine) {
      setSemaineTraitees(semaine);
      setMotifTraitees("all");
    }
  }, [searchParams]);

  // Re-tentative ciblée demandée depuis un raccourci (widget « Échecs récurrents ») : l'URL
  // « retry=1 » ouvre directement la confirmation d'envoi sur les seuls échecs du motif visé.
  useEffect(() => {
    if (loading || error || retryFiredRef.current) return;
    if (searchParams.get("retry") !== "1") return;
    retryFiredRef.current = true;
    const motif = searchParams.get("motif");
    const liste = relances.filter(
      (r) => estEnEchec(r.statut) && (!motif || (r.motif_echec ?? "").trim() === motif),
    );
    if (!liste.length) return;
    setNotice(null);
    setActionError(null);
    setPendingSendRetry(true);
    setPendingSend(liste);
  }, [loading, error, relances, searchParams]);

  const clientNom = (id: number) => nomParClient.get(id) ?? "Client";

  // Relances à venir (les plus proches d'abord).
  const aVenir = useMemo(
    () =>
      relances
        .filter((r) => r.statut === "Programmée")
        .slice()
        .sort((a, b) => a.date_prevue.localeCompare(b.date_prevue)),
    [relances],
  );

  // Filtre par période : on garde les relances dont la date tombe dans la fenêtre choisie
  // (les retards restent visibles puisqu'ils sont antérieurs à la borne).
  const aVenirFiltre = useMemo(() => {
    if (periode === "all") return aVenir;
    const limite = toISODate(addDays(new Date(), Number(periode)));
    return aVenir.filter((r) => r.date_prevue <= limite);
  }, [aVenir, periode]);

  // Regroupement par client (pour la vue « Par client »), clients triés par échéance la plus proche.
  const groupes = useMemo(() => {
    const map = new Map<number, RelanceClientItem[]>();
    aVenirFiltre.forEach((r) => {
      const list = map.get(r.client_id) ?? [];
      list.push(r);
      map.set(r.client_id, list);
    });
    return Array.from(map.entries())
      .map(([clientId, items]) => ({ clientId, items }))
      .sort((a, b) => (a.items[0]?.date_prevue ?? "").localeCompare(b.items[0]?.date_prevue ?? ""));
  }, [aVenirFiltre]);

  // Vue « Par client » filtrée par recherche de nom (insensible à la casse).
  const groupesFiltres = useMemo(() => {
    const q = rechercheClient.trim().toLowerCase();
    if (!q) return groupes;
    return groupes.filter((g) => (nomParClient.get(g.clientId) ?? "").toLowerCase().includes(q));
  }, [groupes, rechercheClient, nomParClient]);

  // Relances déjà traitées (envoyées / en échec), les plus récentes d'abord.
  const traiteesToutes = useMemo(
    () =>
      relances
        .filter((r) => r.statut !== "Programmée")
        .slice()
        .sort((a, b) => b.date_prevue.localeCompare(a.date_prevue)),
    [relances],
  );

  // Filtre de période sur les relances déjà traitées : on se base sur la date d'envoi réel
  // (envoye_le) et, à défaut, sur la date prévue. Permet de retrouver les envois récents.
  const traitees = useMemo(() => {
    const ref = (r: RelanceClientItem) => (r.envoye_le ?? r.date_prevue ?? "").slice(0, 10);
    // Semaine précise choisie en cliquant une barre de la mini-courbe du tableau de bord :
    // on isole les relances traitées dont la date tombe dans cette semaine (7 jours).
    if (semaineTraitees) {
      const fin = toISODate(addDays(new Date(semaineTraitees), 6));
      return traiteesToutes.filter((r) => {
        const d = ref(r);
        return d >= semaineTraitees && d <= fin;
      });
    }
    if (periodeTraitees === "all") return traiteesToutes;
    if (periodeTraitees === "jour") return traiteesToutes.filter((r) => ref(r) === todayISO());
    if (periodeTraitees === "7") {
      const limite = toISODate(addDays(new Date(), -6));
      return traiteesToutes.filter((r) => {
        const d = ref(r);
        return d >= limite && d <= todayISO();
      });
    }
    const now = new Date();
    const prefixe = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return traiteesToutes.filter((r) => ref(r).startsWith(prefixe));
  }, [traiteesToutes, periodeTraitees, semaineTraitees]);

  // Compteurs par statut sur la période « Déjà traitées » sélectionnée.
  const traiteesEnvoyees = useMemo(() => traitees.filter((r) => r.statut === "Envoyée").length, [traitees]);
  const traiteesEchecs = useMemo(() => traitees.filter((r) => estEnEchec(r.statut)).length, [traitees]);

  // Fréquence de chaque motif d'échec (sur toutes les relances traitées) : un même motif qui revient
  // plusieurs fois signale un problème systémique (ex. « client sans email ») à corriger en amont.
  const motifRecurrents = useMemo(() => {
    const map = new Map<string, number>();
    traiteesToutes.forEach((r) => {
      if (estEnEchec(r.statut) && r.motif_echec && r.motif_echec.trim()) {
        const key = r.motif_echec.trim();
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    });
    return map;
  }, [traiteesToutes]);

  // Motifs revenant au moins deux fois (problèmes récurrents), les plus fréquents d'abord.
  const motifsRecurrents = useMemo(
    () =>
      Array.from(motifRecurrents.entries())
        .filter(([, count]) => count >= 2)
        .map(([motif, count]) => ({ motif, count }))
        .sort((a, b) => b.count - a.count),
    [motifRecurrents],
  );

  // Motifs d'échec distincts sur la période affichée, du plus fréquent au moins fréquent :
  // sert au filtre par motif précis (ex. isoler tous les « client sans email »).
  const motifsDisponibles = useMemo(() => {
    const map = new Map<string, number>();
    traitees.forEach((r) => {
      if (estEnEchec(r.statut) && r.motif_echec && r.motif_echec.trim()) {
        const key = r.motif_echec.trim();
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([motif, count]) => ({ motif, count }))
      .sort((a, b) => b.count - a.count);
  }, [traitees]);

  // Filtre par statut puis par motif précis, appliqué par-dessus la période : isole les envois
  // réussis, ou au contraire les relances en échec portant un motif donné (problème ciblé).
  const traiteesFiltrees = useMemo(() => {
    let list = traitees;
    if (statutTraitees === "envoyee") list = list.filter((r) => r.statut === "Envoyée");
    else if (statutTraitees === "echec") list = list.filter((r) => estEnEchec(r.statut));
    if (motifTraitees !== "all") list = list.filter((r) => (r.motif_echec ?? "").trim() === motifTraitees);
    return list;
  }, [traitees, statutTraitees, motifTraitees]);

  // Échecs réellement affichés après filtres (statut + motif) : cible exacte de la re-tentative.
  const echecsFiltres = useMemo(() => traiteesFiltrees.filter((r) => estEnEchec(r.statut)).length, [traiteesFiltrees]);

  // Décalage favori enregistré dans le profil (« +7 j par défaut »), appliqué en un clic.
  const favori = profile?.decalage_favori ?? null;

  const prochaine = aVenir[0] ?? null;
  const enRetard = useMemo(() => aVenir.filter((r) => r.date_prevue < todayISO()).length, [aVenir]);

  // Relances « du jour » : celles à envoyer aujourd'hui ou déjà en retard (date prévue <= aujourd'hui).
  const duJour = useMemo(() => aVenir.filter((r) => r.date_prevue <= todayISO()), [aVenir]);

  const allSelected = aVenirFiltre.length > 0 && selected.size === aVenirFiltre.length;

  // Relances actuellement affichées, dans l'ordre, pour la navigation clavier (↑/↓ + Entrée).
  const rowsAffichees = useMemo(
    () => (vue === "liste" ? aVenirFiltre : groupesFiltres.flatMap((g) => g.items)),
    [vue, aVenirFiltre, groupesFiltres],
  );

  /**
   * Navigation clavier de la liste : ↑/↓ déplace la « relance en cours » (surlignée) et
   * Entrée envoie immédiatement cette relance, sans passer par l'aperçu. Si le focus est déjà
   * sur un bouton de la ligne (ex. aperçu), on laisse le bouton gérer la touche Entrée.
   */
  const handleListKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!rowsAffichees.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const idx = rowsAffichees.findIndex((r) => r.id === focusedId);
      const next =
        idx === -1 ? 0 : e.key === "ArrowDown" ? Math.min(rowsAffichees.length - 1, idx + 1) : Math.max(0, idx - 1);
      setFocusedId(rowsAffichees[next].id);
      return;
    }
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;
      if (focusedId === null) return;
      const r = rowsAffichees.find((x) => x.id === focusedId);
      if (!r) return;
      e.preventDefault();
      void handleSendRow(r);
    }
  };

  const toggleOne = (id: number) => {
    setNotice(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setNotice(null);
    setSelected((prev) => (prev.size === aVenirFiltre.length ? new Set() : new Set(aVenirFiltre.map((r) => r.id))));
  };

  /** Sélectionne / désélectionne toutes les relances d'un même client (vue « Par client »). */
  const toggleGroup = (items: RelanceClientItem[]) => {
    setNotice(null);
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = items.map((r) => r.id);
      const allIn = ids.every((id) => next.has(id));
      ids.forEach((id) => {
        if (allIn) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const handleBulkReschedule = async (payload: BulkReschedulePayload) => {
    const ids = bulk?.ids ?? [...selected];
    if (!ids.length) return;
    setActionError(null);
    if (payload.mode === "date") {
      await bulkRescheduleRelancesClient(ids, payload.datePrevue);
      setNotice(
        `${ids.length} relance${ids.length > 1 ? "s" : ""} reprogrammée${ids.length > 1 ? "s" : ""} au ${formatShortDate(
          payload.datePrevue,
        )}.`,
      );
    } else {
      await bulkShiftRelancesClient(ids, payload.days);
      setNotice(
        `${ids.length} relance${ids.length > 1 ? "s" : ""} décalée${ids.length > 1 ? "s" : ""} de ${payload.days} jour${
          Math.abs(payload.days) > 1 ? "s" : ""
        }.`,
      );
    }
    setSelected(new Set());
    await reloadRelances();
  };

  /** Export CSV : relances à venir (selon le filtre de période) + relances traitées si la case est cochée. */
  const handleExport = () => {
    const source = inclureTraitees
      ? [
          ...aVenirFiltre.map((r) => ({ r, situation: "À venir" })),
          ...traiteesToutes.map((r) => ({ r, situation: "Traitée" })),
        ]
      : aVenirFiltre.map((r) => ({ r, situation: "À venir" }));
    const rows = source.map(({ r, situation }) => {
      const client = clientParId.get(r.client_id);
      return [
        clientNom(r.client_id),
        client?.email ?? "",
        situation,
        formatShortDate(r.date_prevue),
        r.date_prevue,
        r.statut,
        r.message ?? "",
        r.envoye_le ? formatShortDate(r.envoye_le) : "",
        client?.derniere_relance_at ? formatShortDate(client.derniere_relance_at) : "",
      ];
    });
    const csv = toCsv(
      ["Client", "Email", "Situation", "Date prévue", "Date ISO", "Statut", "Message", "Envoyée le", "Dernière relance"],
      rows,
    );
    downloadCsv(`relances-programmees-${todayISO()}.csv`, csv);
    setActionError(null);
    setNotice(`${rows.length} relance${rows.length > 1 ? "s" : ""} exportée${rows.length > 1 ? "s" : ""} en CSV.`);
  };

  /**
   * Export CSV de la liste « Déjà traitées » telle qu'affichée (filtres statut + période),
   * pour archiver les envois récents et, surtout, sortir la liste des échecs à re-traiter.
   */
  const handleExportTraitees = () => {
    const statutLabel =
      statutTraitees === "envoyee" ? "Envoyées" : statutTraitees === "echec" ? "En échec" : "Toutes";
    const periodeLabel = PERIODES_TRAITEES.find((p) => p.value === periodeTraitees)?.label ?? "Tout";
    const motifLabel = motifTraitees === "all" ? "" : ` · motif « ${motifTraitees} »`;
    const rows = traiteesFiltrees.map((r) => {
      const client = clientParId.get(r.client_id);
      return [
        clientNom(r.client_id),
        client?.email ?? "",
        r.statut,
        r.motif_echec ?? "",
        r.envoye_le ? formatShortDate(r.envoye_le) : "",
        formatShortDate(r.date_prevue),
        r.date_prevue,
        r.message ?? "",
      ];
    });
    const csv = toCsv(
      ["Client", "Email", "Statut", "Motif d'échec", "Envoyée le", "Date prévue", "Date ISO", "Message"],
      rows,
    );
    downloadCsv(`relances-traitees-${statutTraitees}-${periodeTraitees}-${todayISO()}.csv`, csv);
    setActionError(null);
    setNotice(
      `${rows.length} relance${rows.length > 1 ? "s" : ""} traitée${rows.length > 1 ? "s" : ""} exportée${
        rows.length > 1 ? "s" : ""
      } en CSV (${statutLabel} · ${periodeLabel}${motifLabel}).`,
    );
  };

  /**
   * Re-tente d'un seul clic les relances en échec actuellement affichées : si un motif précis
   * est sélectionné, seuls les échecs portant ce motif sont relancés ; sinon toute la période.
   */
  const handleRetryEchecs = () => {
    const liste = traiteesFiltrees.filter((r) => estEnEchec(r.statut));
    if (!liste.length || sendingRowId !== null || bulkSending) return;
    setNotice(null);
    setActionError(null);
    void performSend(liste, { retry: true });
  };

  /** Enregistre (ou retire) le décalage favori dans le profil Backend. */
  const handleSaveFavori = async (days: number | null) => {
    if (!user) return;
    await updateDecalageFavori(user.id, days);
    await refreshProfile();
  };

  /** Applique le décalage favori à la sélection en un seul clic. */
  const appliquerFavori = async () => {
    if (favori == null || selected.size === 0) return;
    setActionError(null);
    try {
      await handleBulkReschedule({ mode: "shift", days: favori });
    } catch {
      setActionError("Le décalage a échoué. Réessayez.");
    }
  };

  const handleSaved = async () => {
    await reloadRelances();
    setNotice("Relance programmée mise à jour.");
  };

  /**
   * Enregistre la fiche d'un client éditée depuis une relance en échec (ex. ajout de l'email
   * manquant). On recharge ensuite la liste des clients pour que l'email soit pris en compte
   * au prochain envoi ou à la prochaine re-tentative.
   */
  const handleEditClientSubmit = async (payload: ClientPayload) => {
    if (!editingClient) return;
    setClientBusy(true);
    setActionError(null);
    try {
      await updateClient(editingClient.id, payload);
      await reloadClients();
      setEditingClient(null);
      setNotice(`Fiche de ${payload.nom} mise à jour.`);
    } catch {
      setActionError("La mise à jour de la fiche client a échoué. Réessayez.");
    } finally {
      setClientBusy(false);
    }
  };

  /** Après un envoi immédiat depuis l'aperçu : on rafraîchit la liste et on confirme. */
  const handleRelanceEnvoyee = async () => {
    await reloadRelances();
    setNotice(
      previewing ? `Relance envoyée maintenant à ${clientNom(previewing.client_id)}.` : "Relance envoyée maintenant.",
    );
  };

  /**
   * Envoie une relance tout de suite depuis sa ligne (sans ouvrir l'aperçu), pratique pour
   * enchaîner plusieurs clients : le message part, puis la ligne passe en « Envoyée ».
   */
  const handleSendRow = async (r: RelanceClientItem) => {
    if (sendingRowId !== null) return;
    setNotice(null);
    setActionError(null);
    setSendingRowId(r.id);
    try {
      await sendClientRelanceEmail(r.client_id, r.message ?? "");
      await markRelanceClientEnvoyee(r.id);
      setNotice(`Relance envoyée maintenant à ${clientNom(r.client_id)}.`);
      await reloadRelances();
    } catch (e) {
      const motif = e instanceof Error ? e.message : "L'envoi a échoué.";
      try {
        await markRelanceClientEchec(r.id, motif);
      } catch {
        /* l'échec d'enregistrement du motif ne doit pas masquer l'erreur d'envoi */
      }
      setActionError(`L'envoi à ${clientNom(r.client_id)} a échoué : ${motif}`);
      await reloadRelances();
    } finally {
      setSendingRowId(null);
    }
  };

  /**
   * Ouvre la fenêtre de confirmation avant l'envoi groupé de la sélection courante :
   * on récapitule le nombre de relances et les clients concernés pour éviter un envoi par erreur.
   */
  const openConfirmSend = () => {
    const sels = aVenirFiltre.filter((r) => selected.has(r.id));
    if (!sels.length || sendingRowId !== null || bulkSending) return;
    setNotice(null);
    setActionError(null);
    setPendingSendRetry(false);
    setPendingSend(sels);
  };

  /**
   * Ouvre la confirmation pour « Tout envoyer aujourd'hui » : toutes les relances à envoyer
   * aujourd'hui ou déjà en retard, envoyées d'un seul coup après validation.
   */
  const openConfirmSendJour = () => {
    if (!duJour.length || sendingRowId !== null || bulkSending) return;
    setNotice(null);
    setActionError(null);
    setPendingSendRetry(false);
    setPendingSend(duJour);
  };

  /**
   * Envoie effectivement la liste confirmée, l'une après l'autre. Les clients sans email sont
   * ignorés, l'avancement s'affiche en direct, et chaque relance envoyée passe en « Envoyée ».
   */
  const performSend = async (list: RelanceClientItem[], opts?: { retry?: boolean }) => {
    const joignables = list.filter((r) => Boolean(clientParId.get(r.client_id)?.email));
    const nonJoignables = list.filter((r) => !clientParId.get(r.client_id)?.email);
    if (sendingRowId !== null || bulkSending) {
      setPendingSend(null);
      return;
    }
    // Aucun client joignable : pour une re-tentative on affiche tout de même le récapitulatif.
    if (joignables.length === 0) {
      setPendingSend(null);
      if (opts?.retry) {
        setRetryRecap({
          reussies: [],
          echecs: nonJoignables.map((r) => ({
            nom: clientNom(r.client_id),
            motif: "Ce client n'a pas d'adresse email. Ajoutez-la dans sa fiche.",
            clientId: r.client_id,
          })),
        });
      }
      return;
    }
    setNotice(null);
    setActionError(null);
    setBulkSending(true);
    setBulkSendProgress({ done: 0, total: joignables.length });
    const reussies: string[] = [];
    const echecs: { nom: string; motif: string; clientId: number }[] = [];
    for (let i = 0; i < joignables.length; i += 1) {
      const r = joignables[i];
      try {
        await sendClientRelanceEmail(r.client_id, r.message ?? "");
        await markRelanceClientEnvoyee(r.id);
        reussies.push(clientNom(r.client_id));
      } catch (e) {
        const motif = e instanceof Error ? e.message : "L'envoi a échoué.";
        try {
          await markRelanceClientEchec(r.id, motif);
        } catch {
          /* on continue la boucle même si le motif n'a pas pu être enregistré */
        }
        echecs.push({ nom: clientNom(r.client_id), motif, clientId: r.client_id });
      }
      setBulkSendProgress({ done: i + 1, total: joignables.length });
    }
    setBulkSending(false);
    setBulkSendProgress(null);
    setSelected(new Set());
    setPendingSend(null);
    await reloadRelances();
    // Re-tentative : on affiche le récapitulatif de fin plutôt qu'un simple bandeau de statut.
    if (opts?.retry) {
      setRetryRecap({
        reussies,
        echecs: [
          ...echecs,
          ...nonJoignables.map((r) => ({
            nom: clientNom(r.client_id),
            motif: "Ce client n'a pas d'adresse email. Ajoutez-la dans sa fiche.",
            clientId: r.client_id,
          })),
        ],
      });
      return;
    }
    const ignores = nonJoignables.length;
    if (reussies.length > 0) {
      setNotice(
        `${reussies.length} relance${reussies.length > 1 ? "s" : ""} envoyée${reussies.length > 1 ? "s" : ""} maintenant${
          ignores > 0 ? ` (${ignores} sans email ignorée${ignores > 1 ? "s" : ""})` : ""
        }.`,
      );
    }
    if (echecs.length) setActionError(`Envoi impossible pour : ${echecs.map((x) => x.nom).join(", ")}.`);
  };

  const confirmCancel = async () => {
    if (!pendingCancel) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteRelanceClient(pendingCancel.id);
      setNotice(`Relance de ${clientNom(pendingCancel.client_id)} annulée.`);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(pendingCancel.id);
        return next;
      });
      setPendingCancel(null);
      await reloadRelances();
    } catch {
      setActionError("L'annulation a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  /** Change la période « Déjà traitées » : le choix est mémorisé par l'effet de mémorisation de la vue. */
  const changerPeriodeTraitees = (value: PeriodeTraitees) => {
    setPeriodeTraitees(value);
    // Changer de période annule le filtre de semaine ponctuelle venant de la mini-courbe.
    setSemaineTraitees(null);
  };

  const retry = async () => {
    await Promise.all([reloadClients(), reloadRelances()]);
  };

  if (!loading && !error && relances.length === 0) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon="ri-calendar-schedule-line"
          title="Aucune relance programmée"
          text="Programmez une relance client depuis la fiche d'un client ou le widget « Clients à suivre » du tableau de bord : elle apparaîtra ici et partira automatiquement le jour choisi."
        />
      </div>
    );
  }

  /** Rendu d'une ligne de relance, réutilisé par la vue liste et la vue par client. */
  const renderRow = (r: RelanceClientItem) => (
    <RelanceRow
      key={r.id}
      relance={r}
      clientNom={clientNom(r.client_id)}
      hasEmail={Boolean(clientParId.get(r.client_id)?.email)}
      selected={selected.has(r.id)}
      focused={focusedId === r.id}
      onFocus={() => setFocusedId(r.id)}
      sending={sendingRowId === r.id}
      onToggle={() => toggleOne(r.id)}
      onEdit={() => {
        setNotice(null);
        setEditing(r);
      }}
      onCancel={() => {
        setNotice(null);
        setPendingCancel(r);
      }}
      onPreview={() => {
        setNotice(null);
        setPreviewing(r);
      }}
      onSendNow={() => handleSendRow(r)}
      onOpenClient={() => navigate(`/app/clients?client=${r.client_id}`)}
    />
  );

  return (
    <DataState loading={loading} error={error} onRetry={retry}>
      <div className="flex flex-col gap-5 animate-fade-in">
        {/* Bandeau d'introduction + indicateurs */}
        <div className="flex flex-col gap-4 p-5 rounded-lg bg-background-100 border border-background-200 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
              <i className="ri-calendar-schedule-line text-xl"></i>
            </span>
            <div>
              <h2 className="font-heading font-bold text-lg text-foreground-950">Relances programmées</h2>
              <p className="text-sm text-foreground-500">
                Envoi automatique à la date choisie, via la tâche quotidienne. Prévisualisez, reprogrammez en lot.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col items-center px-4 py-2 rounded-lg bg-background-50 border border-background-200">
              <span className="font-heading font-bold text-xl text-foreground-950">{aVenir.length}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-500">à venir</span>
            </div>
            {prochaine && (
              <div className="flex flex-col px-4 py-2 rounded-lg bg-background-50 border border-background-200">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-500">Prochaine</span>
                <span className="text-sm font-semibold text-foreground-900">
                  {clientNom(prochaine.client_id)} · {formatShortDate(prochaine.date_prevue)}
                </span>
              </div>
            )}
            {enRetard > 0 && (
              <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                <i className="ri-alarm-warning-line"></i>
                {enRetard} en retard
              </span>
            )}
            <button
              type="button"
              onClick={copierLienRelances}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
              title="Copier un lien partageable qui rouvre cette vue (période, affichage, filtres « déjà traitées »)"
            >
              <i className={lienCopie ? "ri-check-line" : "ri-link"}></i>
              {lienCopie ? "Lien copié" : "Copier le lien"}
            </button>
            <button
              type="button"
              onClick={oublierVueRelances}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
              title="Oublier la dernière vue mémorisée (période, affichage, filtres) et repartir des valeurs par défaut"
            >
              <i className="ri-eraser-line"></i>
              Oublier cette vue
            </button>
          </div>
        </div>

        {notice && (
          <p className="text-xs text-accent-700 flex items-center gap-1.5">
            <i className="ri-checkbox-circle-line"></i>
            {notice}
          </p>
        )}
        {actionError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {actionError}
          </p>
        )}

        {aVenir.length > 0 ? (
          <>
            {/* Filtre par période + choix du mode d'affichage */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
                {PERIODES.map((p) => {
                  const actif = periode === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => {
                        setPeriode(p.value);
                        setSelected(new Set());
                        setNotice(null);
                      }}
                      className={`inline-flex items-center h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        actif ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
                  {VUES.map((v) => {
                    const actif = vue === v.value;
                    return (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setVue(v.value)}
                        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          actif ? "bg-secondary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                        }`}
                      >
                        <i className={v.icon}></i>
                        {v.label}
                      </button>
                    );
                  })}
                </div>
                {vue === "clients" && (
                  <RechercheRepliable
                    carteId="relances-programmees"
                    carteLabel="Relances programmées"
                    value={rechercheClient}
                    onChange={setRechercheClient}
                    placeholder="Rechercher un client…"
                    ariaLabel="Rechercher un client"
                    conteneurClassName="w-full sm:w-60"
                  />
                )}
                <span className="text-xs text-foreground-500">
                  {aVenirFiltre.length} relance{aVenirFiltre.length > 1 ? "s" : ""} affichée
                  {aVenirFiltre.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Barre d'actions groupées */}
            <div className="flex flex-col gap-3 p-3 rounded-lg bg-background-100 border border-background-200 lg:flex-row lg:items-center lg:justify-between">
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-md text-xs font-semibold text-foreground-700 hover:bg-background-200 cursor-pointer whitespace-nowrap transition-colors w-fit"
              >
                <i className={allSelected ? "ri-checkbox-line text-primary-600" : "ri-checkbox-blank-line"}></i>
                {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                <span className="text-foreground-400">({selected.size})</span>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 h-9 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-600 whitespace-nowrap cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inclureTraitees}
                    onChange={(e) => setInclureTraitees(e.target.checked)}
                    className="w-4 h-4 rounded border-background-300 accent-primary-500 cursor-pointer"
                  />
                  Inclure les traitées
                </label>
                <button
                  type="button"
                  onClick={handleExport}
                  title="Exporter la liste des relances programmées au format CSV"
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors"
                >
                  <i className="ri-download-2-line"></i>
                  Exporter CSV
                </button>
                {favori != null && (
                  <button
                    type="button"
                    onClick={appliquerFavori}
                    disabled={selected.size === 0}
                    title={`Décaler la sélection de ${favori} jour${Math.abs(favori) > 1 ? "s" : ""} (réglage par défaut)`}
                    className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-accent-100 text-accent-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="ri-loop-right-line"></i>
                    Décaler +{favori} j
                  </button>
                )}
                <button
                  type="button"
                  onClick={openConfirmSend}
                  disabled={selected.size === 0 || bulkSending || sendingRowId !== null}
                  title="Envoyer maintenant toutes les relances sélectionnées, sans attendre leur date"
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkSending ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-send-plane-line"></i>}
                  {bulkSendProgress
                    ? `Envoi ${bulkSendProgress.done}/${bulkSendProgress.total}…`
                    : `Envoyer maintenant${selected.size > 0 ? ` (${selected.size})` : ""}`}
                </button>
                <button
                  type="button"
                  onClick={openConfirmSendJour}
                  disabled={duJour.length === 0 || bulkSending || sendingRowId !== null}
                  title="Cibler et envoyer d'un coup toutes les relances prévues aujourd'hui (retards inclus)"
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-flashlight-line"></i>
                  Tout envoyer aujourd'hui{duJour.length > 0 ? ` (${duJour.length})` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setBulk({ ids: [...selected], label: "la sélection" })}
                  disabled={selected.size === 0}
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-calendar-2-line"></i>
                  Reprogrammer la sélection
                </button>
              </div>
            </div>

            <p className="text-[11px] text-foreground-400 flex items-center gap-1.5">
              <i className="ri-keyboard-line"></i>
              Astuce : cliquez dans la liste, puis ↑/↓ pour choisir une relance et Entrée pour l'envoyer tout de suite.
            </p>

            {/* Liste des relances à venir : à plat ou regroupée par client ; navigable au clavier */}
            <div
              tabIndex={0}
              onKeyDown={handleListKeyDown}
              onFocus={() => {
                if (focusedId === null && rowsAffichees.length > 0) setFocusedId(rowsAffichees[0].id);
              }}
              aria-label="Liste des relances programmées, navigable au clavier"
              className="outline-none rounded-lg"
            >
              {aVenirFiltre.length > 0 ? (
                vue === "liste" ? (
                  <ul className="flex flex-col gap-2">{aVenirFiltre.map(renderRow)}</ul>
                ) : groupesFiltres.length === 0 ? (
                  <p className="p-8 text-center text-sm text-foreground-500 rounded-lg bg-background-100 border border-background-200">
                    Aucun client ne correspond à « {rechercheClient} ».
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {groupesFiltres.map((g) => {
                      const ids = g.items.map((r) => r.id);
                      const toutSelec = ids.every((id) => selected.has(id));
                      return (
                        <div
                          key={g.clientId}
                          className="flex flex-col gap-2 p-3 rounded-lg bg-background-50 border border-background-200"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800 font-semibold">
                                {clientNom(g.clientId).slice(0, 2).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <p className="font-heading font-semibold text-sm text-foreground-950 truncate">
                                  {clientNom(g.clientId)}
                                </p>
                                <p className="text-[11px] text-foreground-500">
                                  {g.items.length} relance{g.items.length > 1 ? "s" : ""} · prochaine le{" "}
                                  {formatShortDate(g.items[0].date_prevue)}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleGroup(g.items)}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap transition-colors"
                              >
                                <i className={toutSelec ? "ri-checkbox-line text-primary-600" : "ri-checkbox-blank-line"}></i>
                                {toutSelec ? "Désélectionner" : "Tout sélectionner"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setBulk({ ids, label: clientNom(g.clientId) })}
                                title={`Reprogrammer d'un coup les ${g.items.length} relances de ${clientNom(g.clientId)}`}
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                              >
                                <i className="ri-calendar-2-line"></i>
                                Reprogrammer ce client
                              </button>
                            </div>
                          </div>
                          <ul className="flex flex-col gap-2">{g.items.map(renderRow)}</ul>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <p className="p-8 text-center text-sm text-foreground-500 rounded-lg bg-background-100 border border-background-200">
                  Aucune relance programmée dans cette période. Élargissez le filtre pour en voir davantage.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="p-8 text-center text-sm text-foreground-500 rounded-lg bg-background-100 border border-background-200">
            Aucune relance à venir pour l'instant.
          </p>
        )}

        {/* Envois déjà traités, filtrables par période et par statut */}
        {traiteesToutes.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
                Déjà traitées · {traiteesFiltrees.length}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {/* Filtre par statut : toutes / envoyées / en échec */}
                <div className="flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
                  {STATUTS_TRAITEES.map((s) => {
                    const actif = statutTraitees === s.value;
                    const nb =
                      s.value === "all" ? traitees.length : s.value === "envoyee" ? traiteesEnvoyees : traiteesEchecs;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => {
                          setStatutTraitees(s.value);
                          setMotifTraitees("all");
                          setSemaineTraitees(null);
                        }}
                        className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          actif ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                        }`}
                      >
                        <i className={s.icon}></i>
                        {s.label}
                        <span className={actif ? "text-background-50/70" : "text-foreground-400"}>{nb}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Filtre par période (dernier choix mémorisé) */}
                <div className="flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
                  {PERIODES_TRAITEES.map((p) => {
                    const actif = periodeTraitees === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => changerPeriodeTraitees(p.value)}
                        title="Votre dernier choix est mémorisé pour la prochaine visite"
                        className={`inline-flex items-center h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          actif ? "bg-secondary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                {/* Raccourci depuis la mini-courbe : puce de la semaine précise sélectionnée */}
                {semaineTraitees && (
                  <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary-100 text-primary-700 text-[11px] font-semibold whitespace-nowrap">
                    <i className="ri-calendar-line"></i>
                    Semaine du {formatShortDate(semaineTraitees)}
                    <button
                      type="button"
                      onClick={() => setSemaineTraitees(null)}
                      title="Retirer le filtre de semaine"
                      aria-label="Retirer le filtre de semaine"
                      className="ml-0.5 cursor-pointer hover:text-primary-900"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                  </span>
                )}
                {/* Filtre par motif d'échec précis : isole un motif récurrent (ex. « client sans email ») */}
                {motifsDisponibles.length > 0 && (
                  <div className="relative w-fit">
                    <i className="ri-filter-3-line absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-400 text-xs pointer-events-none"></i>
                    <select
                      value={motifTraitees}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMotifTraitees(v);
                        if (v !== "all") setStatutTraitees("echec");
                      }}
                      title="Isoler les relances en échec portant un motif précis"
                      className={`h-8 max-w-[240px] pl-7 pr-7 rounded-full border text-[11px] font-semibold cursor-pointer appearance-none whitespace-nowrap truncate outline-none focus:ring-2 focus:ring-primary-300 ${
                        motifTraitees !== "all"
                          ? "bg-red-100 border-red-200 text-red-700"
                          : "bg-background-50 border-background-200 text-foreground-600"
                      }`}
                    >
                      <option value="all">Tous les motifs</option>
                      {motifsDisponibles.map((m) => (
                        <option key={m.motif} value={m.motif}>
                          {m.motif} ({m.count})
                        </option>
                      ))}
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-2 top-1/2 -translate-y-1/2 text-foreground-400 text-xs pointer-events-none"></i>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleRetryEchecs}
                  disabled={echecsFiltres === 0 || bulkSending || sendingRowId !== null}
                  title={
                    motifTraitees !== "all"
                      ? "Re-tenter uniquement les échecs portant le motif sélectionné"
                      : "Re-tenter l'envoi de toutes les relances en échec de cette période"
                  }
                  className="inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkSending ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-refresh-line"></i>}
                  {bulkSendProgress
                    ? `Re-tentative ${bulkSendProgress.done}/${bulkSendProgress.total}…`
                    : motifTraitees !== "all"
                      ? `Re-tenter ce motif${echecsFiltres > 0 ? ` (${echecsFiltres})` : ""}`
                      : `Re-tenter les échecs${echecsFiltres > 0 ? ` (${echecsFiltres})` : ""}`}
                </button>
                {/* Export CSV de la liste filtrée (statut + période) */}
                <button
                  type="button"
                  onClick={handleExportTraitees}
                  disabled={traiteesFiltrees.length === 0}
                  title="Exporter cette liste filtrée (statut + période) au format CSV, motif d'échec inclus"
                  className="inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-download-2-line"></i>
                  Exporter CSV
                </button>
                {/* Raccourci : compléter en série les clients sans adresse email */}
                {clientsSansEmail.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowEmailsModal(true)}
                    title="Ouvrir la liste des clients sans adresse email pour les renseigner en série"
                    className="inline-flex items-center justify-center gap-2 h-8 px-3 rounded-md bg-accent-100 text-accent-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
                  >
                    <i className="ri-mail-add-line"></i>
                    Compléter les emails manquants ({clientsSansEmail.length})
                  </button>
                )}
              </div>
            </div>
            {motifsRecurrents.length > 0 && statutTraitees !== "envoyee" && (
              <div className="flex flex-col gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                  <i className="ri-alarm-warning-fill"></i>
                  Problèmes récurrents détectés · {motifsRecurrents.reduce((s, m) => s + m.count, 0)} échecs
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {motifsRecurrents.map((m) => (
                    <li
                      key={m.motif}
                      className="inline-flex items-center gap-1.5 h-7 max-w-full px-2.5 rounded-full bg-background-50 border border-red-200 text-[11px] font-semibold text-red-700"
                      title={m.motif}
                    >
                      <i className="ri-repeat-line shrink-0"></i>
                      <span className="truncate max-w-[240px]">{m.motif}</span>
                      <span className="text-red-500 whitespace-nowrap">×{m.count}</span>
                      {motifSansEmail(m.motif) && <span className="text-red-500 whitespace-nowrap">· à corriger</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {traiteesFiltrees.length === 0 ? (
              <p className="p-6 text-center text-sm text-foreground-500 rounded-lg bg-background-100 border border-background-200">
                {statutTraitees === "envoyee" && traiteesEchecs > 0 ? (
                  <>
                    Aucun envoi réussi sur cette période.
                    <button
                      type="button"
                      onClick={() => {
                        setStatutTraitees("echec");
                        setMotifTraitees("all");
                      }}
                      className="ml-1.5 font-semibold text-primary-700 hover:underline cursor-pointer"
                    >
                      Voir les {traiteesEchecs} en échec
                    </button>
                  </>
                ) : statutTraitees === "echec" ? (
                  "Aucune relance en échec sur cette période. Tout est parti correctement."
                ) : (
                  "Aucune relance traitée ne correspond à ces filtres."
                )}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {traiteesFiltrees.map((r) => {
                  const envoyee = r.statut === "Envoyée";
                  const echec = !envoyee && estEnEchec(r.statut);
                  const email = clientParId.get(r.client_id)?.email;
                  return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background-50 border border-background-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full ${
                            envoyee ? "bg-accent-100 text-accent-700" : "bg-red-100 text-red-600"
                          }`}
                        >
                          <i className={envoyee ? "ri-send-plane-line" : "ri-error-warning-line"}></i>
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground-950 truncate">{clientNom(r.client_id)}</p>
                          <p className="text-[11px] text-foreground-500">
                            {envoyee ? "Envoyée" : r.statut} · {formatShortDate(r.envoye_le ?? r.date_prevue)}
                          </p>
                          {echec && r.motif_echec && (() => {
                            const tmp = r.motif_echec.trim();
                            const nb = motifRecurrents.get(tmp) ?? 0;
                            const recurrent = nb >= 2;
                            return (
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <p
                                  className={`text-[11px] flex items-center gap-1 max-w-[420px] ${
                                    recurrent ? "text-red-700 font-bold" : "text-red-600"
                                  }`}
                                  title={r.motif_echec}
                                >
                                  <i
                                    className={`shrink-0 ${recurrent ? "ri-alarm-warning-fill" : "ri-information-line"}`}
                                  ></i>
                                  <span className="truncate">{r.motif_echec}</span>
                                </p>
                                {recurrent && (
                                  <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-red-100 text-red-700 text-[10px] font-bold whitespace-nowrap">
                                    <i className="ri-repeat-line"></i>
                                    récurrent · {nb}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {echec && (
                          <button
                            type="button"
                            onClick={() => handleSendRow(r)}
                            disabled={sendingRowId !== null || !email}
                            title={!email ? "Ce client n'a pas d'adresse email" : "Re-tenter l'envoi de cette relance"}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {sendingRowId === r.id ? (
                              <i className="ri-loader-4-line animate-spin"></i>
                            ) : (
                              <i className="ri-refresh-line"></i>
                            )}
                            Re-tenter
                          </button>
                        )}
                        {echec && !email && (
                          <button
                            type="button"
                            onClick={() => {
                              const c = clientParId.get(r.client_id);
                              if (c) setEditingClient(c);
                            }}
                            title="Ouvrir la fiche de ce client pour ajouter son adresse email"
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
                          >
                            <i className="ri-mail-add-line"></i>
                            Ajouter l'email
                          </button>
                        )}
                        <span
                          className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-bold ${
                            envoyee ? "bg-accent-100 text-accent-800" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {r.statut}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {editing && (
        <ScheduleRelanceModal
          client={
            clientParId.get(editing.client_id) ?? {
              id: editing.client_id,
              nom: clientNom(editing.client_id),
              email: null,
              telephone: null,
              adresse: null,
              type: "particulier",
              contact_nom: null,
              siret: null,
              secteur: null,
              notes: null,
              note_priorite: null,
              derniere_relance_at: null,
            }
          }
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {previewing && (
        <PreviewRelanceClientModal
          relance={previewing}
          clientNom={clientNom(previewing.client_id)}
          onClose={() => setPreviewing(null)}
          onSent={handleRelanceEnvoyee}
        />
      )}

      {bulk && (
        <BulkRescheduleModal
          count={bulk.ids.length}
          label={bulk.label}
          favori={favori}
          onClose={() => setBulk(null)}
          onConfirm={handleBulkReschedule}
          onSaveFavori={handleSaveFavori}
        />
      )}

      {pendingSend && (
        <ConfirmSendModal
          relances={pendingSend}
          clientNom={clientNom}
          hasEmail={(id) => Boolean(clientParId.get(id)?.email)}
          busy={bulkSending}
          progress={bulkSendProgress}
          onClose={() => {
            if (!bulkSending) {
              setPendingSend(null);
              setPendingSendRetry(false);
            }
          }}
          onConfirm={() => performSend(pendingSend, pendingSendRetry ? { retry: true } : undefined)}
        />
      )}

      {retryRecap && (
        <RetryRecapModal
          recap={retryRecap}
          onClose={() => setRetryRecap(null)}
          onEditClient={(clientId) => {
            const c = clientParId.get(clientId);
            setRetryRecap(null);
            if (c) setEditingClient(c);
          }}
        />
      )}

      {editingClient && (
        <ClientFormModal
          initial={editingClient}
          busy={clientBusy}
          onClose={() => setEditingClient(null)}
          onSubmit={handleEditClientSubmit}
        />
      )}

      {showEmailsModal && (
        <CompleterEmailsModal
          clients={clients}
          relances={relances}
          onClose={() => setShowEmailsModal(false)}
          onSaved={reloadClients}
          onRelancesChanged={reloadRelances}
        />
      )}

      {pendingCancel && (
        <Modal title="Annuler cette relance ?" onClose={() => setPendingCancel(null)}>
          <p className="text-sm text-foreground-600">
            La relance programmée pour{" "}
            <strong className="text-foreground-900">{clientNom(pendingCancel.client_id)}</strong> le{" "}
            {formatShortDate(pendingCancel.date_prevue)} sera supprimée. Aucun email ne sera envoyé.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setPendingCancel(null)}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Garder la relance
            </button>
            <button
              type="button"
              onClick={confirmCancel}
              disabled={busy}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-red-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-red-600 whitespace-nowrap disabled:opacity-60"
            >
              {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-delete-bin-line"></i>}
              Annuler la relance
            </button>
          </div>
        </Modal>
      )}
    </DataState>
  );
}