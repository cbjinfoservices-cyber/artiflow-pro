import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useArtisanData, type RelanceItem } from "@/hooks/useArtisanData";
import { useAuth } from "@/hooks/useAuth";
import { useRelancesAuto } from "@/hooks/useRelancesAuto";
import { useEscaladeAuto, buildFactureAttachment } from "@/hooks/useEscaladeAuto";
import { useHistoriqueRepro } from "@/hooks/useHistoriqueRepro";
import {
  createRelance,
  deleteRelance,
  duplicateRelance,
  fetchRelanceReprogrammations,
  reprogrammerRelancesEnRetard,
  retryEscaladeFailures,
  updateRelanceDate,
  updateRelanceStatut,
  type RelancePayload,
  type ReprogrammationItem,
} from "@/lib/artisanApi";
import { sendRelanceEmail, sendRelanceSms } from "@/lib/email";
import { downloadCsv, toCsv } from "@/lib/csv";
import { canalIcon, RELANCE_CANAUX } from "@/lib/statuts";
import { formatShortDate, todayISO } from "@/lib/dates";
import { RETARD_PERIODES, joursDeRetard } from "@/lib/relances";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import SampleDataButton from "@/pages/app/components/SampleDataButton";
import RecapEchecsEnvoiCard from "@/pages/app/components/RecapEchecsEnvoi";
import BoutonPartager from "@/pages/app/components/BoutonPartager";
import MenuVuesPartageesRecentes from "@/pages/app/components/MenuVuesPartageesRecentes";
import RelanceFormModal from "@/pages/app/relances/components/RelanceFormModal";
import EscaladeServeurPanel from "@/pages/app/relances/components/EscaladeServeurPanel";
import JournalEscalade from "@/pages/app/relances/components/JournalEscalade";
import RelancesAutoPanel from "@/pages/app/relances/components/RelancesAutoPanel";
import RelanceCard from "@/pages/app/relances/components/RelanceCard";
import DuplicateRelanceModal from "@/pages/app/relances/components/DuplicateRelanceModal";
import EnvoiGroupeModal from "@/pages/app/relances/components/EnvoiGroupeModal";
import ConfirmReprogAllModal from "@/pages/app/relances/components/ConfirmReprogAllModal";
import SupprimerRelanceModal from "@/pages/app/relances/components/SupprimerRelanceModal";
import HistoriqueReproModal from "@/pages/app/relances/components/HistoriqueReproModal";
import HistoriqueTab from "@/pages/app/relances/components/HistoriqueTab";
import TesterSmsModal from "@/pages/app/relances/components/TesterSmsModal";
import Infobulle from "@/components/base/Infobulle";
import EncartAide from "@/components/base/EncartAide";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import { guidePremiereVisiteVu, marquerGuidePremiereVisiteVu } from "@/lib/guidePremiereVisite";

export default function AppRelances() {
  usePageMeta("Relances · ArtiFlow-pro", "Relancez automatiquement vos devis sans réponse.");
  const { loading, error, relances, devis, factures, escaladeJournal, reload, refresh } = useArtisanData();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Onglet + filtres de l'onglet Historique pilotés par l'URL : la vue exacte est
  // partageable et restaurée après un rafraîchissement (ex. ?tab=historique&canal=SMS&periode=30&q=dupont).
  const tab: "relances" | "historique" = searchParams.get("tab") === "historique" ? "historique" : "relances";
  const rawPeriode = Number(searchParams.get("periode"));
  const histoPeriode = rawPeriode === 30 || rawPeriode === 7 ? rawPeriode : 0;
  const rawCanal = searchParams.get("canal") ?? "Tous";
  const histoCanal = (RELANCE_CANAUX as readonly string[]).includes(rawCanal) ? rawCanal : "Tous";
  const histoRecherche = searchParams.get("q") ?? "";

  // Chemin de partage de la vue courante (onglet + filtres inclus), pour alimenter l'historique
  // « Vues partagées récemment » de cette même page et rouvrir exactement le même écran.
  const cheminPartage = searchParams.toString() ? `/app/relances?${searchParams.toString()}` : "/app/relances";

  const [canal, setCanal] = useState("Tous");
  const [vue, setVue] = useState<string>("Programmées");
  const [retardOnly, setRetardOnly] = useState(false);
  const [retardPeriode, setRetardPeriode] = useState<number>(0);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCanal, setBulkCanal] = useState<string>("Email");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkDone, setBulkDone] = useState(0);
  const [canalEscalade, setCanalEscalade] = useState<string>("Tous");
  const [duplicateFor, setDuplicateFor] = useState<RelanceItem | null>(null);
  const [duplicateCanal, setDuplicateCanal] = useState<string>("Email");
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [historyRows, setHistoryRows] = useState<ReprogrammationItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<number | null>(null);
  const [tempDate, setTempDate] = useState<string>("");
  const [savingDate, setSavingDate] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [smsTestOpen, setSmsTestOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [reprogAllBusy, setReprogAllBusy] = useState(false);
  const [confirmReprogAll, setConfirmReprogAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [retryingJournalId, setRetryingJournalId] = useState<number | null>(null);

  // Guide de première visite : ouvert au premier passage sur la page Relances, puis
  // mémorisé une fois fermé par l'artisan. Réouvrable à tout moment via « Revoir le guide ».
  const [guideVisible, setGuideVisible] = useState(() => !guidePremiereVisiteVu("relances"));
  const fermerGuide = () => {
    marquerGuidePremiereVisiteVu("relances");
    setGuideVisible(false);
  };

  // Réglages des relances automatiques (seuil, décalage, escalade) : logique partagée
  // avec le tableau de bord, donc les deux écrans pilotent exactement les mêmes valeurs.
  const {
    auto,
    seuil,
    decalage,
    escaladeRetard,
    autoEscalatedRef,
    toggleAuto,
    changeSeuil,
    changeDecalage,
    changeEscaladeRetard,
  } = useRelancesAuto();

  // Escalade automatique des relances critiques : déclenchée dès l'ouverture de l'écran,
  // logique partagée avec le tableau de bord (pour agir d'un seul écran).
  const { autoSending, autoNotice: autoEscaladeNotice, autoError: autoEscaladeError } = useEscaladeAuto({
    relances,
    factures,
    auto,
    seuil,
    escaladeRetard,
    autoEscalatedRef,
    loading,
    error,
    reload,
  });

  // Historique agrégé des reprogrammations : alimente l'onglet Historique et son badge de compteur.
  const historiqueRepro = useHistoriqueRepro(relances);

  // Onglet et filtres de l'Historique reflétés dans l'URL (source de vérité) : la vue exacte
  // est partageable et se restaure après un rafraîchissement de la page.
  const updateParams = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    setSearchParams(next, { replace: true });
  };

  const setTab = (next: "relances" | "historique") => {
    updateParams((p) => {
      if (next === "historique") p.set("tab", "historique");
      else p.delete("tab");
    });
  };

  const setHistoPeriode = (value: number) => {
    updateParams((p) => {
      if (value) p.set("periode", String(value));
      else p.delete("periode");
    });
  };

  const setHistoCanal = (value: string) => {
    updateParams((p) => {
      if (value && value !== "Tous") p.set("canal", value);
      else p.delete("canal");
    });
  };

  const setHistoRecherche = (value: string) => {
    updateParams((p) => {
      if (value) p.set("q", value);
      else p.delete("q");
    });
  };

  // À l'ouverture de l'onglet Historique, les reprogrammations courantes sont marquées comme vues.
  const markedHistoTabRef = useRef(false);
  useEffect(() => {
    if (tab === "historique") {
      if (!markedHistoTabRef.current) {
        markedHistoTabRef.current = true;
        historiqueRepro.markSeen();
      }
    } else {
      markedHistoTabRef.current = false;
    }
    // historiqueRepro.markSeen est stable côté données ; on ne veut le déclencher qu'une fois par visite.
  }, [tab, historiqueRepro]);

  const appliedRetardRef = useRef(false);

  // Ouvre la liste filtrée sur un palier de retard quand on arrive depuis le badge du menu
  // (ex. /app/relances?retard=30). Le paramètre est consommé puis retiré de l'URL.
  useEffect(() => {
    if (appliedRetardRef.current) return;
    appliedRetardRef.current = true;
    const raw = searchParams.get("retard");
    if (raw === null) return;
    const val = Number(raw);
    setRetardOnly(true);
    setRetardPeriode(!Number.isNaN(val) && val > 0 ? val : 0);
    const next = new URLSearchParams(searchParams);
    next.delete("retard");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Ouvre directement la fenêtre « Tester l'envoi SMS » quand on arrive avec le paramètre
  // « ?test=sms » (ex. /app/relances?test=sms).
  const appliedTestSmsRef = useRef(false);
  useEffect(() => {
    if (appliedTestSmsRef.current) return;
    if (searchParams.get("test") !== "sms") return;
    appliedTestSmsRef.current = true;
    setSmsTestOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("test");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Exporte l'historique des reprogrammations de la relance ouverte en CSV.
  const exportHistoryCsv = () => {
    if (!historyRows.length) return;
    const relance = relances.find((r) => r.id === historyId);
    const rows = historyRows.map((h) => [
      h.ancienne_date ? formatShortDate(h.ancienne_date) : "Sans date",
      h.nouvelle_date ? formatShortDate(h.nouvelle_date) : "Sans date",
      formatShortDate(h.created_at),
    ]);
    const csv = toCsv(["Ancienne date", "Nouvelle date", "Repoussée le"], rows);
    const raw = relance?.clientNom || relance?.devisNumero || `relance-${historyId}`;
    const base = `historique-reprogrammations-${raw}`.replace(/[^a-zA-Z0-9-_]+/g, "-");
    downloadCsv(`${base}.csv`, csv);
  };

  const openHistory = async (id: number) => {
    setHistoryId(id);
    setHistoryRows([]);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const rows = await fetchRelanceReprogrammations(id);
      setHistoryRows(rows);
    } catch {
      setHistoryError("Impossible de charger l'historique pour l'instant.");
    } finally {
      setHistoryLoading(false);
    }
  };

  // « En retard » : relance encore non envoyée dont la date prévue est dépassée.
  const enRetard = useMemo(() => {
    const today = todayISO();
    return relances.filter((r) => r.statut !== "Envoyée" && r.date_prevue !== null && r.date_prevue.slice(0, 10) < today);
  }, [relances]);
  const retardIds = useMemo(() => new Set(enRetard.map((r) => r.id)), [enRetard]);

  const filtered = useMemo(
    () =>
      relances.filter((r) => {
        const matchCanal = canal === "Tous" || r.canal === canal;
        const matchVue =
          vue === "Toutes" ||
          (vue === "Déjà envoyées"
            ? r.statut === "Envoyée" && !r.escaladeAuto
            : vue === "Renvois auto"
              ? r.escaladeAuto
              : r.statut !== "Envoyée");
        const matchCanalEscalade = vue !== "Renvois auto" || canalEscalade === "Tous" || r.canal === canalEscalade;
        const matchRetard = !retardOnly || retardIds.has(r.id);
        const matchPeriode =
          retardPeriode === 0 || (retardIds.has(r.id) && joursDeRetard(r.date_prevue) >= retardPeriode);
        return matchCanal && matchVue && matchCanalEscalade && matchRetard && matchPeriode;
      }),
    [relances, canal, vue, canalEscalade, retardOnly, retardPeriode, retardIds],
  );

  // Compteurs par canal pour l'onglet Escalades (Email / SMS / WhatsApp).
  const escaladeParCanal = useMemo(() => {
    const counts = new Map<string, number>();
    relances.forEach((r) => {
      if (r.escaladeAuto) counts.set(r.canal, (counts.get(r.canal) ?? 0) + 1);
    });
    return counts;
  }, [relances]);

  // Les relances en retard remontent en premier, de la plus ancienne (la plus oubliée) à la plus récente.
  const ordered = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const aLate = retardIds.has(a.id) ? 0 : 1;
      const bLate = retardIds.has(b.id) ? 0 : 1;
      if (aLate !== bLate) return aLate - bLate;
      if (aLate === 0) return (a.date_prevue ?? "").localeCompare(b.date_prevue ?? "");
      return 0;
    });
    return arr;
  }, [filtered, retardIds]);

  const actives = relances.filter((r) => r.actif).length;
  const nbProgrammees = relances.filter((r) => r.statut !== "Envoyée").length;
  const nbEnvoyees = relances.filter((r) => r.statut === "Envoyée" && !r.escaladeAuto).length;
  const nbEscalades = relances.filter((r) => r.escaladeAuto).length;
  const nbEnRetard = enRetard.length;

  // Retards filtrés par le palier de jours sélectionné (pour cibler les dossiers critiques).
  const retardsFiltres = useMemo(
    () => (retardPeriode === 0 ? enRetard : enRetard.filter((r) => joursDeRetard(r.date_prevue) >= retardPeriode)),
    [enRetard, retardPeriode],
  );
  // Cibles d'un envoi groupé : les retards filtrés qui sont encore actifs (hors pause).
  const bulkTargets = useMemo(() => retardsFiltres.filter((r) => r.actif), [retardsFiltres]);

  // Construit le PDF de la facture liée au devis (pour le joindre à la relance).
  const buildRelanceAttachment = (devisId: number) => buildFactureAttachment(factures, devisId);

  // L'escalade automatique des relances critiques est gérée par le hook partagé
  // useEscaladeAuto (voir plus haut), pour être déclenchable aussi depuis le tableau de bord.

  const toggleRelance = async (id: number, actif: boolean) => {
    setActionError(null);
    try {
      await updateRelanceStatut(id, actif ? "En pause" : "Programmée");
      await reload();
    } catch {
      setActionError("La mise à jour de la relance a échoué.");
    }
  };

  const openDateEditor = (id: number, current: string | null) => {
    setActionError(null);
    setEditingDateId(id);
    setTempDate(current ? current.slice(0, 10) : todayISO());
  };

  const saveRelanceDate = async () => {
    if (editingDateId === null) return;
    setSavingDate(true);
    setActionError(null);
    try {
      await updateRelanceDate(editingDateId, tempDate || null);
      setEditingDateId(null);
      setActionNotice("Nouvelle date enregistrée pour la relance.");
      await reload();
    } catch {
      setActionError("Le changement de date a échoué.");
    } finally {
      setSavingDate(false);
    }
  };

  // Ouvre la fenêtre de duplication avec le choix du canal d'envoi.
  const openDuplicate = (r: RelanceItem) => {
    setActionError(null);
    setActionNotice(null);
    setDuplicateCanal(r.canal);
    setDuplicateFor(r);
  };

  // Duplique une relance en retard en une nouvelle datée par défaut à +N jours,
  // sur le canal d'envoi choisi par l'utilisateur.
  const handleDuplicate = async (r: RelanceItem, canalChoisi: string) => {
    setDuplicatingId(r.id);
    setActionError(null);
    setActionNotice(null);
    try {
      await duplicateRelance({ devis_id: r.devis_id, canal: canalChoisi, message: r.message }, decalage);
      setDuplicateFor(null);
      await reload();
      setActionNotice(
        `Relance dupliquée pour ${r.clientNom ?? "votre client"} par ${canalChoisi}, reportée à +${decalage} jours.`,
      );
    } catch {
      setActionError("La duplication de la relance a échoué.");
    } finally {
      setDuplicatingId(null);
    }
  };

  // Recule d'un coup toutes les relances en retard sur aujourd'hui + N jours.
  const handleReprogAll = async () => {
    setReprogAllBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await reprogrammerRelancesEnRetard(enRetard.map((r) => r.id), decalage);
      setConfirmReprogAll(false);
      await reload();
      setActionNotice(`${nbEnRetard} relance(s) en retard décalée(s) à +${decalage} jours.`);
    } catch {
      setActionError("Le décalage groupé a échoué.");
    } finally {
      setReprogAllBusy(false);
    }
  };

  // Réessaie l'escalade uniquement sur les clients non envoyés d'un passage donné.
  const handleRetryFailures = async (run: { id: number; relancesEchouees: number[] }) => {
    if (!user || run.relancesEchouees.length === 0) return;
    setRetryingJournalId(run.id);
    setActionError(null);
    setActionNotice(null);
    try {
      const res = await retryEscaladeFailures(user.id, run.relancesEchouees);
      await reload();
      if (res.envoye > 0) {
        setActionNotice(
          `${res.envoye} envoi${res.envoye > 1 ? "s" : ""} réussie${res.envoye > 1 ? "s" : ""} au réessai${
            res.echoue > 0 ? ` · ${res.echoue} encore en échec` : ""
          }.`,
        );
      } else {
        setActionError(
          `${run.relancesEchouees.length} envoi${run.relancesEchouees.length > 1 ? "s" : ""} toujours en échec. Vérifiez vos identifiants d'envoi (Resend / Twilio).`,
        );
      }
    } catch {
      setActionError("Le réessai des échecs a échoué.");
    } finally {
      setRetryingJournalId(null);
    }
  };

  // Ouvre la fenêtre d'envoi groupé avec choix unique du canal.
  const openBulk = () => {
    setActionError(null);
    setActionNotice(null);
    setBulkDone(0);
    setBulkCanal(canal === "SMS" || canal === "WhatsApp" ? canal : "Email");
    setBulkOpen(true);
  };

  // Envoie d'un seul clic une relance à toutes les cibles en retard, sur le canal choisi.
  const handleBulkSend = async () => {
    if (!bulkTargets.length) return;
    setBulkSending(true);
    setActionError(null);
    setActionNotice(null);
    setBulkDone(0);
    let sent = 0;
    let failed = 0;
    for (const r of bulkTargets) {
      try {
        if (bulkCanal === "Email") {
          const attach = await buildRelanceAttachment(r.devis_id);
          await sendRelanceEmail(r.id, attach?.pdfBase64, attach?.filename, true);
        } else {
          await sendRelanceSms(r.id, bulkCanal, true);
        }
        sent += 1;
      } catch {
        failed += 1;
      }
      setBulkDone(sent + failed);
    }
    setBulkSending(false);
    setBulkOpen(false);
    await reload();
    if (sent > 0) {
      setActionNotice(`${sent} relance(s) envoyée(s) par ${bulkCanal} aux clients les plus en retard.`);
    }
    if (failed > 0) {
      setActionError(`${failed} relance(s) groupée(s) n'ont pas pu être envoyées.`);
    }
  };

  const handleCreate = async (payload: RelancePayload) => {
    setBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const relanceId = await createRelance(payload);
      setFormOpen(false);
      await reload();
      if (payload.canal === "Email") {
        try {
          const attach = await buildRelanceAttachment(payload.devis_id);
          await sendRelanceEmail(relanceId, attach?.pdfBase64, attach?.filename);
          setActionNotice(
            attach
              ? "Relance envoyée par email à votre client, avec la facture en pièce jointe."
              : "Relance envoyée par email à votre client.",
          );
        } catch (sendErr) {
          const detail = sendErr instanceof Error ? sendErr.message : "";
          setActionNotice(
            `Relance programmée. ${
              detail || "Activez Resend (clé API + domaine) pour que l'envoi automatique fonctionne."
            }`,
          );
        }
      } else {
        try {
          await sendRelanceSms(relanceId, payload.canal);
          setActionNotice(`Relance ${payload.canal} envoyée à votre client.`);
        } catch (sendErr) {
          const detail = sendErr instanceof Error ? sendErr.message : "";
          setActionNotice(
            `Relance ${payload.canal} programmée. ${
              detail || "Ajoutez vos identifiants Twilio pour que l'envoi fonctionne."
            }`,
          );
        }
      }
    } catch {
      setActionError("La programmation de la relance a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async (r: RelanceItem) => {
    setActionError(null);
    setActionNotice(null);
    setSendingId(r.id);
    try {
      if (r.canal === "Email") {
        const attach = await buildRelanceAttachment(r.devis_id);
        await sendRelanceEmail(r.id, attach?.pdfBase64, attach?.filename);
        setActionNotice(
          `Relance envoyée à ${r.clientNom ?? "votre client"}${attach ? ", facture en pièce jointe" : ""}.`,
        );
      } else {
        await sendRelanceSms(r.id, r.canal);
        setActionNotice(`Relance ${r.canal} envoyée à ${r.clientNom ?? "votre client"}.`);
      }
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "L'envoi de la relance a échoué.");
    } finally {
      setSendingId(null);
    }
  };

  const confirmDelete = async () => {
    if (pendingDelete === null) return;
    setActionError(null);
    try {
      await deleteRelance(pendingDelete);
      setPendingDelete(null);
      await reload();
    } catch {
      setActionError("La suppression a échoué.");
    }
  };

  // Au moins un filtre de la liste s'écarte-t-il des valeurs par défaut ?
  const filtresRelancesActifs =
    canal !== "Tous" || vue !== "Programmées" || retardOnly || retardPeriode !== 0 || canalEscalade !== "Tous";

  // Remet d'un coup tous les filtres de la liste (canal, vue, retard, escalade) à leurs valeurs
  // par défaut, pour repartir d'une liste complète.
  const reinitialiserFiltresRelances = () => {
    setCanal("Tous");
    setVue("Programmées");
    setRetardOnly(false);
    setRetardPeriode(0);
    setCanalEscalade("Tous");
  };


  if (!loading && !error && relances.length === 0) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon="ri-notification-3-line"
          title="Aucune relance programmée"
          text="Programmez une relance pour un devis sans réponse, ou chargez un jeu de données d'exemple pour voir ArtiFlow-pro relancer vos clients à votre place."
        >
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-add-line"></i> Programmer une relance
            </button>
            <SampleDataButton onSeeded={reload} />
          </div>
        </EmptyState>
        {formOpen && <RelanceFormModal devis={devis} busy={busy} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />}
        {smsTestOpen && <TesterSmsModal onClose={() => setSmsTestOpen(false)} />}
      </div>
    );
  }

  return (
    <DataState loading={loading} error={error} onRetry={reload}>
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
          <button
            type="button"
            onClick={() => setTab("relances")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
              tab === "relances" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
            }`}
          >
            <i className="ri-notification-3-line"></i>
            Relances
          </button>
          <button
            type="button"
            onClick={() => setTab("historique")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
              tab === "historique" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
            }`}
          >
            <i className="ri-history-line"></i>
            Historique
            {historiqueRepro.total > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                  historiqueRepro.fresh > 0
                    ? "bg-accent-500 text-background-50"
                    : tab === "historique"
                      ? "bg-background-50/25"
                      : "bg-background-200 text-foreground-600"
                }`}
              >
                {historiqueRepro.total}
              </span>
            )}
            {historiqueRepro.fresh > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-accent-700">
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-accent-500 opacity-75 animate-ping"></span>
                  <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-accent-500"></span>
                </span>
                {historiqueRepro.fresh} nouvelle{historiqueRepro.fresh > 1 ? "s" : ""}
              </span>
            )}
          </button>
        </div>
          <div className="flex items-center gap-2">
            <BoutonPartager
              label={tab === "historique" ? "Relances · Historique" : "Relances"}
              chemin={cheminPartage}
              title="Copier le lien de cette vue de relances"
              compact
            />
            <MenuVuesPartageesRecentes basePath="/app/relances" />
          </div>
        </div>

        {guideVisible && (
          <GuidePremiereVisite
            titre="Bienvenue : relancez sans y penser"
            sousTitre="Voici, en 4 étapes, comment relancer poliment un client resté sans réponse, sans avoir à y revenir vous-même."
            etapes={[
              {
                icone: "ri-add-line",
                titre: "Créez une relance",
                texte:
                  "Bouton « Nouvelle relance » : choisissez le client d'un devis resté sans réponse et rédigez votre message.",
              },
              {
                icone: "ri-calendar-line",
                titre: "Choisissez la date et le canal",
                texte:
                  "Indiquez le jour d'envoi et le canal : email, SMS ou WhatsApp. C'est vous qui décidez.",
              },
              {
                icone: "ri-send-plane-line",
                titre: "L'outil envoie tout seul",
                texte:
                  "Le jour venu, le message part automatiquement. Vous pouvez aussi cliquer « Envoyer » à la main.",
              },
              {
                icone: "ri-restart-line",
                titre: "Décalez ou laissez faire",
                texte:
                  "Toujours pas de réponse ? « Changer la date » la repousse d'un clic, ou laissez l'outil renvoyer les dossiers les plus en retard.",
              },
            ]}
            note="Ce guide ne s'affiche qu'une seule fois. Vous pouvez le revoir à tout moment avec « Revoir le guide des relances »."
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
            Revoir le guide des relances
          </button>
        )}

        {tab === "historique" ? (
          <HistoriqueTab
            relances={relances}
            rows={historiqueRepro.rows}
            loading={historiqueRepro.loading}
            error={historiqueRepro.error}
            periode={histoPeriode}
            canal={histoCanal}
            recherche={histoRecherche}
            onPeriodeChange={setHistoPeriode}
            onCanalChange={setHistoCanal}
            onRechercheChange={setHistoRecherche}
          />
        ) : (
          <div className="flex flex-col gap-5">
        {/* Ancre du lexique : « Renvoi automatique » pointe directement ici (seuil d'escalade). */}
        <div id="reglage-escalade" className="scroll-mt-24">
          <RelancesAutoPanel
            auto={auto}
            actives={actives}
            seuil={seuil}
            decalage={decalage}
            escaladeRetard={escaladeRetard}
            onToggleAuto={toggleAuto}
            onChangeSeuil={changeSeuil}
            onChangeDecalage={changeDecalage}
            onChangeEscaladeRetard={changeEscaladeRetard}
          />
        </div>

        {/* Encart « comment faire » : expliquer simplement le fonctionnement des relances. */}
        <EncartAide
          ton="primary"
          icone="ri-notification-3-line"
          titre="Comment marchent les relances ?"
          etapes={[
            "Créez une relance pour le client d'un devis resté sans réponse (bouton « Nouvelle relance »).",
            "Choisissez la date et le canal : email, SMS ou WhatsApp.",
            "Le jour venu, l'outil envoie le message tout seul. Vous pouvez aussi cliquer « Envoyer » à la main.",
            "Laissée sans réponse ? Décalez la date d'un clic, ou laissez l'outil renvoyer automatiquement les dossiers les plus en retard.",
          ]}
          note="Le statut « Renvoyée automatiquement » signifie qu'un dossier resté trop longtemps sans réponse a été relancé tout seul. Rien ne part si vous mettez les relances automatiques en pause."
        />

        <EscaladeServeurPanel journal={escaladeJournal} userId={user?.id ?? null} onReload={reload} />

        {/* Bloc de pilotage unifié (surveillance + échecs), identique au tableau de bord :
            un seul endroit pour régler la surveillance, suivre les échecs et réessayer. */}
        <RecapEchecsEnvoiCard journal={escaladeJournal} onRetried={refresh} />

        {escaladeJournal.length > 0 && (
          <JournalEscalade
            journal={escaladeJournal}
            retryingJournalId={retryingJournalId}
            onRetryFailures={handleRetryFailures}
          />
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Infobulle
                contenu="Choisir le canal d'envoi des relances : Email, SMS ou WhatsApp. « Tous » affiche les relances de tous les canaux."
                position="bas"
                largeur={300}
              >
                <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:text-accent-700 cursor-help">
                  <i className="ri-information-line text-sm"></i>
                </span>
              </Infobulle>
              <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
                {RELANCE_CANAUX.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCanal(c)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      canal === c ? "bg-secondary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Infobulle
                contenu="Envoyer un SMS ou un WhatsApp de test à un numéro saisi sur le moment, pour vérifier que ce canal fonctionne."
                position="bas"
                largeur={280}
              >
                <button
                  type="button"
                  onClick={() => setSmsTestOpen(true)}
                  title="Envoyer un SMS/WhatsApp de test à un numéro saisi à la volée (validation Twilio)"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-accent-300 hover:text-accent-700 transition-colors"
                >
                  <i className="ri-message-3-line"></i>
                  Tester l'envoi SMS
                </button>
              </Infobulle>
              <Infobulle
                contenu="Remettre le canal, la vue et les filtres de la liste à leurs valeurs de départ."
                position="bas"
                largeur={240}
              >
                <button
                  type="button"
                  onClick={reinitialiserFiltresRelances}
                  disabled={!filtresRelancesActifs}
                  title="Remettre le canal, la vue, le filtre retard et le filtre de renvoi auto à leurs valeurs par défaut"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-filter-off-line"></i>
                  Réinitialiser tous les filtres
                </button>
              </Infobulle>
              <Infobulle
                contenu="Programmer une relance pour le client d'un devis resté sans réponse : vous choisissez la date et le canal (email, SMS, WhatsApp)."
                position="bas"
                largeur={280}
              >
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                >
                  <i className="ri-add-line"></i>
                  Nouvelle relance
                </button>
              </Infobulle>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Infobulle
              contenu="Choisir ce que la liste montre : « Programmées » = pas encore envoyées, « Déjà envoyées » = parties chez le client, « Renvois auto » = relancées toutes seules après un long silence."
              position="bas"
              largeur={330}
            >
              <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:text-accent-700 cursor-help">
                <i className="ri-information-line text-sm"></i>
              </span>
            </Infobulle>
            <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
              {[
                { label: "Programmées", count: nbProgrammees, tone: "primary" },
                { label: "Déjà envoyées", count: nbEnvoyees, tone: "accent" },
                { label: "Renvois auto", count: nbEscalades, tone: "accent" },
              ].map((v) => (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => setVue(v.label)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    vue === v.label
                      ? v.tone === "accent"
                        ? "bg-accent-500 text-background-50"
                        : "bg-primary-500 text-background-50"
                      : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {v.label}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      vue === v.label ? "bg-background-50/25" : "bg-background-200 text-foreground-600"
                    }`}
                  >
                    {v.count}
                  </span>
                </button>
              ))}
            </div>
            {vue !== "Toutes" && (
              <button
                type="button"
                onClick={() => setVue("Toutes")}
                className="text-xs font-medium text-foreground-500 hover:text-foreground-800 cursor-pointer whitespace-nowrap"
              >
                Tout afficher
              </button>
            )}
            {vue === "Renvois auto" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
                  <i className="ri-filter-3-line"></i>
                  Canal :
                </span>
                {RELANCE_CANAUX.map((c) => {
                  const count = c === "Tous" ? nbEscalades : escaladeParCanal.get(c) ?? 0;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCanalEscalade(c)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                        canalEscalade === c
                          ? "bg-accent-500 text-background-50"
                          : "bg-background-100 text-foreground-600 hover:bg-background-200 border border-background-200"
                      }`}
                    >
                      {c !== "Tous" && <i className={canalIcon(c)}></i>}
                      {c}
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          canalEscalade === c ? "bg-background-50/25" : "bg-background-200 text-foreground-600"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {nbEnRetard > 0 && (
              <button
                type="button"
                onClick={() => setRetardOnly((v) => !v)}
                title="Voir uniquement les relances dont la date prévue est dépassée"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  retardOnly ? "bg-primary-600 text-background-50" : "bg-primary-100 text-primary-700 hover:bg-primary-200"
                }`}
              >
                <i className="ri-alarm-warning-line"></i>
                En retard · {nbEnRetard}
                {retardOnly && <i className="ri-close-line"></i>}
              </button>
            )}
            {nbEnRetard > 0 && (
              <div className="inline-flex items-center gap-1.5">
                <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
                  <i className="ri-timer-flash-line"></i>
                  Retard :
                </span>
                <Infobulle
                  contenu="Ne montrer que les relances dont la date prévue est dépassée depuis un certain temps : « +7 j », « +30 j », « +60 j ». « Toutes » affiche tous les retards, du plus ancien au plus récent."
                  position="haut"
                  largeur={310}
                >
                  <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:text-accent-700 cursor-help">
                    <i className="ri-information-line text-sm"></i>
                  </span>
                </Infobulle>
                <div className="flex gap-0.5 p-0.5 rounded-full bg-background-100 border border-background-200">
                  {RETARD_PERIODES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setRetardPeriode(p.value)}
                      title={
                        p.value === 0
                          ? "Afficher tous les retards"
                          : `Afficher uniquement les retards de plus de ${p.value} jours`
                      }
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        retardPeriode === p.value
                          ? "bg-primary-500 text-background-50"
                          : "text-foreground-600 hover:bg-background-200"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {nbEnRetard > 0 && (
              <Infobulle
                contenu="Reculer d'un coup toutes les relances en retard : elles seront renvoyées plus tard, sans rien changer à leur message."
                position="haut"
                largeur={280}
              >
                <button
                  type="button"
                  onClick={() => setConfirmReprogAll(true)}
                  title="Reculer d'un coup toutes les relances en retard de plusieurs jours"
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
                >
                  <i className="ri-calendar-check-line"></i>
                  Tout décaler · +{decalage}j
                </button>
              </Infobulle>
            )}
            {bulkTargets.length > 0 && (
              <Infobulle
                contenu="Envoyer une relance à tous les clients les plus en retard, en un seul clic, sur le canal que vous choisirez."
                position="haut"
                largeur={280}
              >
                <button
                  type="button"
                  onClick={openBulk}
                  title="Envoyer d'un seul clic une relance à tous les clients les plus en retard"
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
                >
                  <i className="ri-send-plane-2-line"></i>
                  Envoi groupé · {bulkTargets.length}
                </button>
              </Infobulle>
            )}
            {nbEnRetard > 1 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-500">
                <i className="ri-sort-desc"></i>
                Retards triés du plus ancien au plus récent
              </span>
            )}
          </div>
        </div>

        {autoSending && (
          <p className="text-xs text-primary-700 flex items-center gap-1.5">
            <i className="ri-loader-4-line animate-spin"></i>
            Renvoi automatique des relances reportées plusieurs fois…
          </p>
        )}

        {actionError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {actionError}
          </p>
        )}

        {actionNotice && (
          <p className="text-xs text-accent-700 flex items-center gap-1.5">
            <i className="ri-checkbox-circle-line"></i>
            {actionNotice}
          </p>
        )}

        {autoEscaladeNotice && (
          <p className="text-xs text-accent-700 flex items-center gap-1.5">
            <i className="ri-robot-2-line"></i>
            {autoEscaladeNotice}
          </p>
        )}

        {autoEscaladeError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {autoEscaladeError}
          </p>
        )}

        {ordered.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground-500 rounded-lg bg-background-100 border border-background-200">
            Aucune relance ne correspond à ce filtre.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {ordered.map((r) => (
              <RelanceCard
                key={r.id}
                relance={r}
                seuil={seuil}
                decalage={decalage}
                auto={auto}
                isLate={retardIds.has(r.id)}
                editingDateId={editingDateId}
                tempDate={tempDate}
                savingDate={savingDate}
                duplicatingId={duplicatingId}
                sendingId={sendingId}
                onOpenDateEditor={openDateEditor}
                onTempDateChange={setTempDate}
                onSaveDate={saveRelanceDate}
                onCancelDate={() => setEditingDateId(null)}
                onOpenDuplicate={openDuplicate}
                onOpenHistory={openHistory}
                onSend={handleSend}
                onToggle={toggleRelance}
                onDelete={setPendingDelete}
              />
            ))}
          </div>
        )}
          </div>
        )}

        {formOpen && <RelanceFormModal devis={devis} busy={busy} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />}

        {duplicateFor && (
          <DuplicateRelanceModal
            relance={duplicateFor}
            canal={duplicateCanal}
            decalage={decalage}
            busy={duplicatingId === duplicateFor.id}
            onSelectCanal={setDuplicateCanal}
            onConfirm={() => handleDuplicate(duplicateFor, duplicateCanal)}
            onClose={() => setDuplicateFor(null)}
          />
        )}

        {bulkOpen && (
          <EnvoiGroupeModal
            targets={bulkTargets.length}
            retardPeriode={retardPeriode}
            canal={bulkCanal}
            sending={bulkSending}
            done={bulkDone}
            onSelectCanal={setBulkCanal}
            onConfirm={handleBulkSend}
            onClose={() => setBulkOpen(false)}
          />
        )}

        {confirmReprogAll && (
          <ConfirmReprogAllModal
            count={nbEnRetard}
            decalage={decalage}
            busy={reprogAllBusy}
            onConfirm={handleReprogAll}
            onClose={() => setConfirmReprogAll(false)}
          />
        )}

        {historyId !== null && (
          <HistoriqueReproModal
            loading={historyLoading}
            error={historyError}
            rows={historyRows}
            onExport={exportHistoryCsv}
            onClose={() => setHistoryId(null)}
          />
        )}

        {pendingDelete !== null && (
          <SupprimerRelanceModal onConfirm={confirmDelete} onClose={() => setPendingDelete(null)} />
        )}

        {smsTestOpen && <TesterSmsModal onClose={() => setSmsTestOpen(false)} />}
      </div>
    </DataState>
  );
}