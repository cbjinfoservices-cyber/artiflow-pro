import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useEcheancesDuJour } from "@/hooks/useEcheancesDuJour";
import { useArtisanData } from "@/hooks/useArtisanData";
import { useAuth } from "@/hooks/useAuth";
import { useRelancesAuto } from "@/hooks/useRelancesAuto";
import { useRelancesFactureEnvois } from "@/hooks/useRelancesFactureEnvois";
import { useRelancesClient } from "@/hooks/useRelancesClient";
import { useEscaladeAuto } from "@/hooks/useEscaladeAuto";
import { createClient, createDevis, deleteDevisModele, updateDevisModele, duplicateDevisModele, incrementModeleUsage, setDevisModeleArchive, computeTotaux, type ClientPayload, type DevisModele, type LigneInput } from "@/lib/artisanApi";
import { useDevisModeles } from "@/hooks/useDevisModeles";
import { useModeleUsages } from "@/hooks/useModeleUsages";
import { useModeleUsageEvents } from "@/hooks/useModeleUsageEvents";
import { formatEuros } from "@/lib/format";
import { todayISO } from "@/lib/dates";
import EmptyState from "@/pages/app/components/EmptyState";
import SampleDataButton from "@/pages/app/components/SampleDataButton";
import Modal from "@/pages/app/components/Modal";
import DevisFormModal from "@/pages/app/devis/components/DevisFormModal";
import ModelesRapidesPanel from "@/pages/app/dashboard/components/ModelesRapidesPanel";
import EditerModeleModal from "@/pages/app/dashboard/components/EditerModeleModal";
import KpiGrid from "@/pages/app/dashboard/components/KpiGrid";
import EncaissementDuJourCard from "@/pages/app/dashboard/components/EncaissementDuJourCard";
import BandeauEnvoisAuto from "@/pages/app/dashboard/components/BandeauEnvoisAuto";
import AlerteAbonnement from "@/pages/app/dashboard/components/AlerteAbonnement";
import AlerteAncienneteMotDePasse from "@/pages/app/dashboard/components/AlerteAncienneteMotDePasse";
import RecapEchecsEnvoiCard from "@/pages/app/components/RecapEchecsEnvoi";
import VerificationTachesSilencieuse from "@/pages/app/dashboard/components/VerificationTachesSilencieuse";
import SanteCompteCard from "@/pages/app/dashboard/components/SanteCompteCard";
import ReprendreDemarrageCard from "@/pages/app/dashboard/components/ReprendreDemarrageCard";
import RappelParcoursCard from "@/pages/app/dashboard/components/RappelParcoursCard";
import ReprendreDevisCard from "@/pages/app/dashboard/components/ReprendreDevisCard";
import VueFiltreeDevisCard from "@/pages/app/dashboard/components/VueFiltreeDevisCard";
import HistoriqueLiensCard from "@/pages/app/dashboard/components/HistoriqueLiensCard";
import VuesFavoritesCard from "@/pages/app/dashboard/components/VuesFavoritesCard";
import EchecsRecurrentsCard from "@/pages/app/dashboard/components/EchecsRecurrentsCard";
import TauxReussiteEnvoi from "@/pages/app/dashboard/components/TauxReussiteEnvoi";
import AlerteTauxSemaine from "@/pages/app/dashboard/components/AlerteTauxSemaine";
import AlerteEncaissementMois from "@/pages/app/dashboard/components/AlerteEncaissementMois";
import AlerteBilanManquant from "@/pages/app/dashboard/components/AlerteBilanManquant";
import RelancesAutoPanel from "@/pages/app/relances/components/RelancesAutoPanel";
import EscaladeServeurPanel from "@/pages/app/relances/components/EscaladeServeurPanel";
import RecapQuotidienPanel from "@/pages/app/dashboard/components/RecapQuotidienPanel";
import PauseVacancesPanel from "@/pages/app/dashboard/components/PauseVacancesPanel";
import RelancesFacturesPanel from "@/pages/app/dashboard/components/RelancesFacturesPanel";
import RelancesRetard from "@/pages/app/dashboard/components/RelancesRetard";
import AvoirFactureRecap from "@/pages/app/dashboard/components/AvoirFactureRecap";
import DernierBilanCard from "@/pages/app/dashboard/components/DernierBilanCard";
import CaChart from "@/pages/app/dashboard/components/CaChart";
import ActivityFeed from "@/pages/app/dashboard/components/ActivityFeed";
import DevisToRelance from "@/pages/app/dashboard/components/DevisToRelance";
import ClientsASuivre from "@/pages/app/dashboard/components/ClientsASuivre";
import RelancesProgrammees from "@/pages/app/dashboard/components/RelancesProgrammees";
import FacturationWidget from "@/pages/app/dashboard/components/FacturationWidget";
import FacturesEfMoisCard from "@/pages/app/dashboard/components/FacturesEfMoisCard";
import ReglementsDuMois from "@/pages/app/dashboard/components/ReglementsDuMois";
import RecentEnvois from "@/pages/app/dashboard/components/RecentEnvois";
import EnvoiActivityChart from "@/pages/app/dashboard/components/EnvoiActivityChart";
import RecapSmsWhatsApp from "@/pages/app/dashboard/components/RecapSmsWhatsApp";
import RelanceEnvoyeesJour from "@/pages/app/dashboard/components/RelanceEnvoyeesJour";
import RemplacementsMoisCard from "@/pages/app/dashboard/components/RemplacementsMoisCard";
import MiniCalendrierMois from "@/pages/app/dashboard/components/MiniCalendrierMois";
import RelancesEnvoyeesJourModal from "@/pages/app/dashboard/components/RelancesEnvoyeesJourModal";
import EncaissementsChart from "@/pages/app/dashboard/components/EncaissementsChart";
import FactureEncaisseChart from "@/pages/app/dashboard/components/FactureEncaisseChart";
import RecapHebdoRecentesCard from "@/pages/app/dashboard/components/RecapHebdoRecentesCard";
import AlerteOubliesRecap from "@/pages/app/dashboard/components/AlerteOubliesRecap";
import AlerteChantiersSilencieux from "@/pages/app/dashboard/components/AlerteChantiersSilencieux";
import AlerteEchecEnvoiAuto from "@/pages/app/dashboard/components/AlerteEchecEnvoiAuto";
import RelancesGroupeesMoisCard from "@/pages/app/dashboard/components/RelancesGroupeesMoisCard";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import RappelExportMensuel from "@/pages/app/dashboard/components/RappelExportMensuel";
import BandeauVerifConfigEmail from "@/pages/app/dashboard/components/BandeauVerifConfigEmail";
import EncartPaiementIndisponible from "@/pages/app/components/EncartPaiementIndisponible";
import { useDiagnosticPaiementEur } from "@/hooks/useDiagnosticPaiementEur";
import { guidePremiereVisiteVu, marquerGuidePremiereVisiteVu } from "@/lib/guidePremiereVisite";

export default function AppDashboard() {
  usePageMeta("Tableau de bord · ArtiFlow-pro", "Votre activité d'artisan en un coup d'œil.");
  const navigate = useNavigate();
  const { loading, error, devis, clients, chantiers, factures, envois, relances, escaladeJournal, creneaux, intervenants, indisponibilites, reload, refresh } = useArtisanData();
  const { user } = useAuth();

  // Montant à encaisser aujourd'hui (factures échues ou arrivant à échéance), affiché en tête
  // du tableau de bord et cliquable vers la liste filtrée de la page Factures.
  const echeancesJour = useEcheancesDuJour();

  // Ouvre le détail des relances envoyées aujourd'hui (compteur « effet du jour J » cliquable).
  const [showEnvoyeesJour, setShowEnvoyeesJour] = useState(false);

  // Guide de première visite : présenté au tout premier passage sur le tableau de bord,
  // puis mémorisé une fois fermé. Réouvrable via « Revoir le guide ».
  const [guideVisible, setGuideVisible] = useState(() => !guidePremiereVisiteVu("tableau-de-bord"));
  const fermerGuide = () => {
    marquerGuidePremiereVisiteVu("tableau-de-bord");
    setGuideVisible(false);
  };

  // Diagnostic du paiement carte en euros : petit encart NON BLOQUANT si la configuration
  // du compte de paiement est incomplète, pour en informer sans gêner l'usage de l'espace.
  const {
    diagnostic: diagnosticPaiement,
    indisponible: paiementIndisponible,
    chargement: chargementPaiement,
    reverifier: reverifierPaiement,
  } = useDiagnosticPaiementEur();
  const [encartPaiementMasque, setEncartPaiementMasque] = useState(false);

  // Montant total des relances de factures envoyées ce mois-ci (KPI du tableau de bord).
  const { envois: relanceFactureEnvois } = useRelancesFactureEnvois(user?.id ?? null);

  // Relances client programmées (partagées entre le bandeau et le widget « Clients à suivre »).
  const { relances: relancesClient, reload: reloadRelancesClient } = useRelancesClient(user?.id ?? null);

  // « Effet du jour J » : combien de relances client ont réellement été envoyées aujourd'hui,
  // et combien restent programmées pour la journée (affiché en haut du tableau de bord).
  const relancesJour = useMemo(() => {
    const today = todayISO();
    const envoyees = relancesClient.filter(
      (r) => r.statut === "Envoyée" && (r.envoye_le ?? "").slice(0, 10) === today,
    ).length;
    const programmees = relancesClient.filter(
      (r) => r.statut === "Programmée" && r.date_prevue === today,
    ).length;
    return { envoyees, programmees };
  }, [relancesClient]);

  // Détail des relances client envoyées aujourd'hui (les plus récentes d'abord), pour la modale du compteur.
  const envoyeesJourList = useMemo(
    () =>
      relancesClient
        .filter((r) => r.statut === "Envoyée" && (r.envoye_le ?? "").slice(0, 10) === todayISO())
        .slice()
        .sort((a, b) => (b.envoye_le ?? "").localeCompare(a.envoye_le ?? "")),
    [relancesClient],
  );

  // Nom d'un client à partir de son identifiant (pour la liste des envois du jour).
  const clientNomParId = useMemo(() => {
    const map = new Map<number, string>();
    clients.forEach((c) => map.set(c.id, c.nom));
    return map;
  }, [clients]);

  // Modèles de devis personnalisés enregistrés par l'artisan (réutilisables en un clic).
  const { modeles: devisModeles, loading: loadingModeles, reload: reloadModeles } = useDevisModeles(user?.id ?? null);

  // Nombre d'utilisations de chaque modèle (pour repérer les plus rentables).
  const { usages: modeleUsages, reload: reloadUsages } = useModeleUsages(user?.id ?? null);

  // Historique daté des usages (une entrée par devis créé depuis un modèle), pour le graphique d'évolution.
  const { events: modeleUsageEvents, loading: loadingEvents, reload: reloadEvents } = useModeleUsageEvents(user?.id ?? null);

  // CA total généré par les modèles de devis (somme des devis créés depuis un modèle).
  const modelesStats = useMemo(() => {
    const entries = Object.values(modeleUsages);
    const ca = entries.reduce((sum, u) => sum + Number(u.montantTotal || 0), 0);
    const utilises = entries.filter((u) => u.utilisations > 0).length;
    return { ca, utilises };
  }, [modeleUsages]);

  // Nombre de devis réellement existants générés depuis chaque modèle (clé de modèle → total).
  const devisCounts = useMemo(() => {
    const map: Record<string, number> = {};
    devis.forEach((d) => {
      if (d.modeleCle) map[d.modeleCle] = (map[d.modeleCle] ?? 0) + 1;
    });
    return map;
  }, [devis]);

  // Série mensuelle du nombre de devis créés depuis chaque modèle sur les 12 derniers mois
  // (du plus ancien au plus récent) : sert à la mini-courbe et au classement par régularité.
  const devisMonthly = useMemo(() => {
    const map: Record<string, number[]> = {};
    const now = new Date();
    const keys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${d.getMonth()}`);
    }
    const index: Record<string, number> = {};
    keys.forEach((k, i) => {
      index[k] = i;
    });
    devis.forEach((d) => {
      if (!d.modeleCle) return;
      const c = new Date(d.created_at);
      if (Number.isNaN(c.getTime())) return;
      const i = index[`${c.getFullYear()}-${c.getMonth()}`];
      if (i === undefined) return;
      if (!map[d.modeleCle]) map[d.modeleCle] = new Array(12).fill(0);
      map[d.modeleCle][i] += 1;
    });
    return map;
  }, [devis]);

  // Nombre de mois consécutifs de croissance (clé → mois de hausse d'affilée jusqu'à ce mois).
  const devisStreaks = useMemo(() => {
    const map: Record<string, number> = {};
    const now = new Date();
    // Clés des 12 derniers mois, du plus ancien au plus récent.
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${d.getMonth()}`);
    }
    const series: Record<string, Record<string, number>> = {};
    devis.forEach((d) => {
      if (!d.modeleCle) return;
      const c = new Date(d.created_at);
      if (Number.isNaN(c.getTime())) return;
      const k = `${c.getFullYear()}-${c.getMonth()}`;
      if (!series[d.modeleCle]) series[d.modeleCle] = {};
      series[d.modeleCle][k] = (series[d.modeleCle][k] ?? 0) + 1;
    });
    Object.entries(series).forEach(([key, counts]) => {
      let streak = 0;
      for (let i = months.length - 1; i > 0; i--) {
        if ((counts[months[i]] ?? 0) > (counts[months[i - 1]] ?? 0)) streak += 1;
        else break;
      }
      map[key] = streak;
    });
    return map;
  }, [devis]);

  // Montant HT total réellement généré par les devis existants issus de chaque modèle (clé → somme HT).
  const devisTotals = useMemo(() => {
    const map: Record<string, number> = {};
    devis.forEach((d) => {
      if (d.modeleCle) map[d.modeleCle] = (map[d.modeleCle] ?? 0) + Number(d.total_ht || 0);
    });
    return map;
  }, [devis]);

  // Tendance par modèle : nombre de devis créés ce mois-ci vs le mois dernier (clé → { current, previous }).
  const devisTrends = useMemo(() => {
    const map: Record<string, { current: number; previous: number }> = {};
    const now = new Date();
    const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const currentKey = monthKey(now);
    const previousKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    devis.forEach((d) => {
      if (!d.modeleCle) return;
      const c = new Date(d.created_at);
      if (Number.isNaN(c.getTime())) return;
      const k = monthKey(c);
      if (k !== currentKey && k !== previousKey) return;
      const entry = map[d.modeleCle] ?? { current: 0, previous: 0 };
      if (k === currentKey) entry.current += 1;
      else entry.previous += 1;
      map[d.modeleCle] = entry;
    });
    return map;
  }, [devis]);

  const relanceMois = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const duMois = relanceFactureEnvois.filter((e) => {
      const d = new Date(e.envoye_le);
      if (Number.isNaN(d.getTime())) return false;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === prefix;
    });
    return {
      montant: duMois.reduce((sum, e) => sum + Number(e.montant || 0), 0),
      count: duMois.length,
    };
  }, [relanceFactureEnvois]);

  // Réglages des relances automatiques (seuil, décalage, escalade) partagés avec la page
  // Relances : les deux écrans pilotent exactement les mêmes valeurs.
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

  // Escalade automatique des relances critiques : déclenchée depuis le tableau de bord,
  // sans avoir besoin d'ouvrir la page Relances (même logique que là-bas).
  const { autoSending, autoNotice, autoError } = useEscaladeAuto({
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

  // Trace de contact réelle : un devis a été contacté dès qu'un envoi ou une relance lui est rattaché.
  const contactedDevisIds = useMemo(() => {
    const ids = new Set<number>();
    envois.forEach((e) => {
      if (e.devis_id !== null) ids.add(e.devis_id);
    });
    relances.forEach((r) => {
      if (r.devis_id) ids.add(r.devis_id);
    });
    return ids;
  }, [envois, relances]);

  const stats = useMemo(() => {
    const nonBrouillon = devis.filter((d) => d.statut !== "Brouillon");
    const signes = devis.filter((d) => d.statut === "Signé");
    const enAttente = devis.filter((d) => d.statut === "Envoyé" || d.statut === "À relancer");
    const enSuspens = devis.filter((d) => d.statut !== "Signé" && d.statut !== "Accepté");
    const aRelancer = enSuspens.filter((d) => contactedDevisIds.has(d.id));
    const jamaisContactes = enSuspens.filter((d) => !contactedDevisIds.has(d.id));
    const caSigne = signes.reduce((sum, d) => sum + Number(d.total_ht || 0), 0);
    const montantRelance = aRelancer.reduce((sum, d) => sum + Number(d.total_ht || 0), 0);
    const taux = nonBrouillon.length ? Math.round((signes.length / nonBrouillon.length) * 100) : 0;
    return { signes, enAttente, aRelancer, jamaisContactes, caSigne, montantRelance, taux };
  }, [devis, contactedDevisIds]);

  const chartData = useMemo(() => {
    const now = new Date();
    const raw: { key: string; label: string; longLabel: string; total: number }[] = [];
    // 7 mois en interne : le mois précédent même pour la barre la plus ancienne (6 affichés)
    for (let i = 6; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
      const total = devis
        .filter((d) => {
          if (d.statut === "Brouillon") return false;
          const c = new Date(d.created_at);
          return `${c.getFullYear()}-${c.getMonth()}` === key;
        })
        .reduce((sum, d) => sum + Number(d.total_ht || 0), 0);
      raw.push({
        key,
        label: monthDate.toLocaleDateString("fr-FR", { month: "short" }),
        longLabel: monthDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
        total,
      });
    }
    return raw.slice(1).map((point, idx) => {
      const prevTotal = raw[idx].total;
      const delta = prevTotal === 0 ? null : Math.round(((point.total - prevTotal) / prevTotal) * 100);
      return { ...point, prevTotal, delta };
    });
  }, [devis]);

  const feed = useMemo(
    () =>
      devis.slice(0, 4).map((d) => ({
        icon:
          d.statut === "Signé"
            ? "ri-checkbox-circle-line"
            : d.statut === "À relancer"
              ? "ri-notification-3-line"
              : "ri-file-text-line",
        text: `Devis ${d.numero} ${d.statut.toLowerCase()}${d.clientNom ? ` pour ${d.clientNom}` : ""}`,
        when: new Date(d.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
        tone: d.statut === "Signé" ? "accent" : d.statut === "À relancer" ? "secondary" : "primary",
      })),
    [devis],
  );

  // Modèle de devis rapide sélectionné : ouvre la fenêtre « Nouveau devis » pré-remplie.
  const [templateDraft, setTemplateDraft] = useState<{ cle: string; objet: string; lignes: LigneInput[]; modeleId?: number; modeleNom: string } | null>(null);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [modeleToDelete, setModeleToDelete] = useState<{ id: number; nom: string } | null>(null);
  const [modeleToEdit, setModeleToEdit] = useState<DevisModele | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openTemplate = (tpl: { cle: string; objet: string; lignes: LigneInput[]; modeleId?: number; modeleNom: string }) => {
    setTemplateNotice(null);
    setTemplateError(null);
    setTemplateDraft(tpl);
  };

  // Création d'un client directement depuis la fenêtre de devis (liste vide).
  const handleQuickCreateClient = async (payload: ClientPayload) => {
    if (!user) return null;
    const created = await createClient(user.id, payload);
    await reload();
    return created;
  };

  const handleDeleteModele = async () => {
    if (!modeleToDelete) return;
    setTemplateError(null);
    try {
      await deleteDevisModele(modeleToDelete.id);
      setTemplateNotice(`Modèle « ${modeleToDelete.nom} » supprimé.`);
      setModeleToDelete(null);
      await reloadModeles();
    } catch {
      setTemplateError("La suppression du modèle a échoué. Réessayez.");
      setModeleToDelete(null);
    }
  };

  const handleCreateFromTemplate = async (payload: {
    clientId: number | null;
    objet: string;
    statut: string;
    lignes: LigneInput[];
  }) => {
    if (!user) return;
    const draft = templateDraft;
    setTemplateBusy(true);
    setTemplateError(null);
    try {
      await createDevis(user.id, {
        ...payload,
        modeleCle: draft?.cle ?? null,
        modeleNom: draft?.modeleNom ?? null,
      });
      // On compte un usage réel du modèle (le devis a bien été créé) et on cumule son CA (HT).
      if (draft?.cle) {
        try {
          await incrementModeleUsage(draft.cle, draft.modeleId ?? null, computeTotaux(payload.lignes).ht);
          await reloadUsages();
          await reloadEvents();
        } catch {
          /* le devis est créé : le compteur se rattrapera au prochain usage */
        }
      }
      setTemplateDraft(null);
      await reload();
      setTemplateNotice("Devis créé depuis le modèle. Retrouvez-le dans la page Devis.");
    } catch {
      setTemplateError("La création du devis a échoué. Réessayez.");
    } finally {
      setTemplateBusy(false);
    }
  };

  const handleRenameModele = async (modele: DevisModele, nom: string) => {
    const propre = nom.trim();
    if (!propre || propre === modele.nom) return;
    setTemplateError(null);
    try {
      await updateDevisModele(modele.id, { nom: propre, objet: modele.objet, lignes: modele.lignes });
      setTemplateNotice(`Modèle renommé en « ${propre} ».`);
      await reloadModeles();
    } catch {
      setTemplateError("Le renommage du modèle a échoué. Réessayez.");
    }
  };

  const handleDuplicateModele = async (modele: DevisModele) => {
    if (!user) return;
    setTemplateError(null);
    try {
      await duplicateDevisModele(user.id, modele);
      setTemplateNotice(`Modèle « ${modele.nom} » dupliqué. Vous pouvez l'éditer pour créer votre variante.`);
      await reloadModeles();
    } catch {
      setTemplateError("La duplication du modèle a échoué. Réessayez.");
    }
  };

  // Archive (ou restaure) un modèle peu utilisé : il disparaît de la liste active mais
  // reste conservé en base pour l'historique et ses statistiques d'usage.
  const handleArchiveModele = async (modele: DevisModele, archive: boolean) => {
    setTemplateError(null);
    try {
      await setDevisModeleArchive(modele.id, archive);
      setTemplateNotice(
        archive
          ? `Modèle « ${modele.nom} » archivé. Il reste conservé pour l'historique.`
          : `Modèle « ${modele.nom} » restauré dans la liste active.`,
      );
      await reloadModeles();
    } catch {
      setTemplateError("L'archivage du modèle a échoué. Réessayez.");
    }
  };

  /**
   * Archivage automatique proposé pour les modèles non utilisés depuis plus de 90 jours :
   * applique l'archivage à tous les modèles de la liste en une seule confirmation.
   */
  const handleAutoArchiveStale = async (list: DevisModele[]) => {
    if (!list.length) return;
    setTemplateError(null);
    try {
      await Promise.all(list.map((m) => setDevisModeleArchive(m.id, true)));
      setTemplateNotice(
        `${list.length} modèle(s) non utilisé(s) depuis plus de 90 jours archivé(s). Ils restent conservés pour l'historique.`,
      );
      await reloadModeles();
    } catch {
      setTemplateError("L'archivage automatique a échoué. Réessayez.");
    }
  };

  /**
   * Archivage groupé de modèles fournis (ex. tous les modèles sans aucun devis),
   * appliqué en une seule opération confirmée depuis le panneau.
   */
  const handleArchiveModeles = async (list: DevisModele[]) => {
    if (!list.length) return;
    setTemplateError(null);
    try {
      await Promise.all(list.map((m) => setDevisModeleArchive(m.id, true)));
      setTemplateNotice(
        `${list.length} modèle${list.length > 1 ? "s" : ""} sans devis archivé${list.length > 1 ? "s" : ""}. Ils restent conservés pour l'historique.`,
      );
      await reloadModeles();
    } catch {
      setTemplateError("L'archivage groupé a échoué. Réessayez.");
    }
  };

  const handleEditModele = async (payload: { nom: string; objet: string; lignes: LigneInput[] }) => {
    if (!modeleToEdit) return;
    setEditBusy(true);
    setEditError(null);
    try {
      await updateDevisModele(modeleToEdit.id, payload);
      setTemplateNotice(`Modèle « ${payload.nom} » mis à jour.`);
      setModeleToEdit(null);
      await reloadModeles();
    } catch {
      setEditError("L'enregistrement des modifications a échoué. Réessayez.");
    } finally {
      setEditBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <i className="ri-loader-4-line animate-spin text-2xl text-primary-600"></i>
          <p className="text-sm text-foreground-500">Chargement de votre activité…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center text-center px-6 py-16 rounded-lg bg-background-100 border border-background-200">
        <span className="w-14 h-14 flex items-center justify-center rounded-full bg-primary-100 text-primary-700 text-2xl">
          <i className="ri-error-warning-line"></i>
        </span>
        <p className="mt-4 text-sm text-foreground-600 max-w-md">{error}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-5 inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
        >
          <i className="ri-refresh-line"></i> Réessayer
        </button>
      </div>
    );
  }

  const isEmpty = devis.length === 0 && clients.length === 0 && chantiers.length === 0;
  const relancesActives = relances.filter((r) => r.actif).length;

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-5 animate-fade-in">
        {guideVisible && (
          <GuidePremiereVisite
            titre="Bienvenue sur votre tableau de bord"
            sousTitre="Voici comment lire cet écran en 4 repères. Rien ne se déclenche sans votre accord : vous pouvez explorer tranquillement."
            etapes={[
              {
                icone: "ri-line-chart-line",
                titre: "Vos chiffres clés",
                texte:
                  "En haut, les cartes résument votre activité : chiffre d'affaires signé, devis en attente, clients, relances…",
              },
              {
                icone: "ri-notification-3-line",
                titre: "Ce qui demande attention",
                texte:
                  "Les bandeaux colorés signalent ce qu'il reste à faire (une relance, un réglage, une alerte). Plus c'est visible, plus c'est à regarder.",
              },
              {
                icone: "ri-bookmark-3-line",
                titre: "Repartir d'un modèle",
                texte:
                  "Plus bas, recréez un devis en un clic à partir de vos modèles enregistrés : le plus rapide pour facturer vite.",
              },
              {
                icone: "ri-question-line",
                titre: "Perdu ? Le bouton « Aide »",
                texte:
                  "En bas à droite, le bouton « Aide » explique chaque écran et traduit le jargon, en français simple.",
              },
            ]}
            note="Ce guide ne s'affiche qu'une seule fois. Vous pouvez le revoir à tout moment avec « Revoir le guide »."
            onFermer={fermerGuide}
          />
        )}

        <EmptyState
          icon="ri-sparkling-2-line"
          title="Votre espace est prêt"
          text="Vous n'avez encore aucune donnée. Créez votre premier devis quand vous voulez, ou chargez des données d'exemple pour découvrir ArtiFlow-pro à votre rythme."
        >
          <div className="flex flex-col items-center gap-3">
            <SampleDataButton onSeeded={reload} />
            <span className="text-xs text-foreground-400">Vous pourrez tout modifier ou supprimer ensuite.</span>
          </div>
        </EmptyState>
      </div>
    );
  }

  const kpis = [
    { label: "CA signé", value: formatEuros(stats.caSigne), trend: `${stats.signes.length} devis signés`, up: true, icon: "ri-line-chart-line", aide: "Le total des devis que vos clients ont acceptés et signés. C'est votre chiffre d'affaires engagé, pas encore forcément encaissé." },
    { label: "Devis en attente", value: String(stats.enAttente.length), trend: `${stats.aRelancer.length} à relancer`, up: false, icon: "ri-file-text-line", aide: "Les devis envoyés qui ne sont pas encore signés. Il reste à les relancer pour les transformer en chantier." },
    { label: "Taux de signature", value: `${stats.taux} %`, trend: "sur devis non brouillon", up: true, icon: "ri-quill-pen-line", aide: "La part de vos devis qui aboutissent, calculée sur les devis réellement envoyés (les brouillons ne comptent pas)." },
    { label: "Clients", value: String(clients.length), trend: `${chantiers.length} chantiers suivis`, up: true, icon: "ri-contacts-book-2-line", aide: "Le nombre de fiches de votre carnet de clients. Chaque devis et chaque facture y est rattaché." },
    { label: "Relancé ce mois-ci", value: formatEuros(relanceMois.montant), trend: `${relanceMois.count} relance${relanceMois.count > 1 ? "s" : ""} de factures`, up: false, icon: "ri-notification-3-line", aide: "Le montant des factures que vous avez relancées ce mois-ci, et le nombre de relances envoyées." },
    { label: "CA généré par les modèles", value: formatEuros(modelesStats.ca), trend: `${modelesStats.utilises} modèle${modelesStats.utilises > 1 ? "s" : ""} utilisé${modelesStats.utilises > 1 ? "s" : ""}`, up: true, icon: "ri-bookmark-3-line", aide: "Le chiffre d'affaires total des devis créés à partir de vos modèles enregistrés, pour voir ceux qui rapportent le plus." },
  ];

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      {guideVisible && (
        <GuidePremiereVisite
          titre="Bienvenue sur votre tableau de bord"
          sousTitre="Voici comment lire cet écran en 4 repères. Rien ne se déclenche sans votre accord : vous pouvez explorer tranquillement."
          etapes={[
            {
              icone: "ri-line-chart-line",
              titre: "Vos chiffres clés",
              texte:
                "En haut, les cartes résument votre activité : chiffre d'affaires signé, devis en attente, clients, relances…",
            },
            {
              icone: "ri-notification-3-line",
              titre: "Ce qui demande attention",
              texte:
                "Les bandeaux colorés signalent ce qu'il reste à faire (une relance, un réglage, une alerte). Plus c'est visible, plus c'est à regarder.",
            },
            {
              icone: "ri-bookmark-3-line",
              titre: "Repartir d'un modèle",
              texte:
                "Plus bas, recréez un devis en un clic à partir de vos modèles enregistrés : le plus rapide pour facturer vite.",
            },
            {
              icone: "ri-question-line",
              titre: "Perdu ? Le bouton « Aide »",
              texte:
                "En bas à droite, le bouton « Aide » explique chaque écran et traduit le jargon, en français simple.",
            },
          ]}
          note="Ce guide ne s'affiche qu'une seule fois. Vous pouvez le revoir à tout moment avec « Revoir le guide »."
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
          Revoir le guide
        </button>
      )}

      <RappelExportMensuel />

      <AlerteChantiersSilencieux />

      <AlerteEchecEnvoiAuto />

      <RelancesGroupeesMoisCard chantiers={chantiers} />

      {paiementIndisponible && !encartPaiementMasque ? (
        <EncartPaiementIndisponible
          motif={diagnosticPaiement?.motif}
          diagnostic={diagnosticPaiement}
          chargement={chargementPaiement}
          origine="tableau-de-bord"
          onReverifier={reverifierPaiement}
          onClose={() => setEncartPaiementMasque(true)}
        />
      ) : null}

      <BandeauVerifConfigEmail />

      <EncaissementDuJourCard echeances={echeancesJour} />

      <KpiGrid kpis={kpis} />

      <MiniCalendrierMois creneaux={creneaux} indisponibilites={indisponibilites} intervenants={intervenants} />

      <BandeauEnvoisAuto />

      <AlerteAncienneteMotDePasse />

      <RecapEchecsEnvoiCard journal={escaladeJournal} onRetried={refresh} />

      <VerificationTachesSilencieuse />

      <ReprendreDevisCard />

      <VueFiltreeDevisCard devis={devis} />

      <HistoriqueLiensCard />

      <VuesFavoritesCard />

      <AlerteAbonnement />

      <AlerteOubliesRecap />

      <RecapHebdoRecentesCard />

      <ReprendreDemarrageCard />

      <RappelParcoursCard />

      <SanteCompteCard clients={clients} escaladeJournal={escaladeJournal} onClientsChanged={reload} />

      <RelanceEnvoyeesJour
        envoyees={relancesJour.envoyees}
        programmees={relancesJour.programmees}
        onVoir={() => navigate("/app/relances-programmees")}
        onVoirEnvoyees={() => setShowEnvoyeesJour(true)}
      />

      <RemplacementsMoisCard />

      <RelancesProgrammees relances={relancesClient} clients={clients} />

      {autoSending && (
        <p className="text-xs text-primary-700 flex items-center gap-1.5">
          <i className="ri-loader-4-line animate-spin"></i>
          Escalade automatique des relances critiques en cours…
        </p>
      )}

      {autoNotice && (
        <p className="text-xs text-accent-700 flex items-center gap-1.5">
          <i className="ri-robot-2-line"></i>
          {autoNotice}
        </p>
      )}

      {autoError && (
        <p className="text-xs text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {autoError}
        </p>
      )}

      <RelancesAutoPanel
        auto={auto}
        actives={relancesActives}
        seuil={seuil}
        decalage={decalage}
        escaladeRetard={escaladeRetard}
        onToggleAuto={toggleAuto}
        onChangeSeuil={changeSeuil}
        onChangeDecalage={changeDecalage}
        onChangeEscaladeRetard={changeEscaladeRetard}
      />

      <EscaladeServeurPanel journal={escaladeJournal} userId={user?.id ?? null} onReload={reload} />

      <PauseVacancesPanel />

      <RecapQuotidienPanel />

      <RelancesFacturesPanel factures={factures} onReload={refresh} />

      <AlerteTauxSemaine relances={relancesClient} />

      <AlerteEncaissementMois factures={factures} />

      <AlerteBilanManquant />

      <TauxReussiteEnvoi
        relances={relancesClient}
        clients={clients}
        onClientsChanged={reload}
        onRelancesChanged={reloadRelancesClient}
      />

      <EchecsRecurrentsCard
        relances={relancesClient}
        clients={clients}
        onClientsChanged={reload}
        onRelancesChanged={reloadRelancesClient}
      />

      <RelancesRetard relances={relances} journal={escaladeJournal} />

      <AvoirFactureRecap factures={factures} />

      <DernierBilanCard />

      <FacturationWidget factures={factures} />

      <FacturesEfMoisCard factures={factures} />

      <ReglementsDuMois factures={factures} />

      <EncaissementsChart factures={factures} />

      <FactureEncaisseChart factures={factures} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CaChart data={chartData} devis={devis} />
        <ActivityFeed items={feed} />
      </div>

      <RecentEnvois envois={envois} devis={devis} factures={factures} />

      <EnvoiActivityChart envois={envois} />

      <RecapSmsWhatsApp envois={envois} />

      <div className="p-5 rounded-lg bg-accent-50 border border-accent-200 flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <i className="ri-sparkling-2-line"></i>
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground-950">Recommandation IA</p>
          <p className="text-sm text-foreground-600 mt-0.5">
            {stats.aRelancer.length > 0
              ? `${stats.aRelancer.length} devis attendent une relance. Lancer les relances maintenant pourrait récupérer environ ${formatEuros(stats.montantRelance)} cette semaine.`
              : "Aucun devis en attente de relance. Votre suivi client est à jour, continuez comme ça !"}
          </p>
        </div>
      </div>

      <ModelesRapidesPanel
          modeles={devisModeles}
          loadingModeles={loadingModeles}
          usages={modeleUsages}
          devisCounts={devisCounts}
          devisTotals={devisTotals}
          devisTrends={devisTrends}
          devisStreaks={devisStreaks}
          devisMonthly={devisMonthly}
          events={modeleUsageEvents}
          loadingEvents={loadingEvents}
          notice={templateNotice}
          error={templateError}
          onOpen={openTemplate}
          onViewDevis={(cle) => navigate(`/app/devis?modele=${encodeURIComponent(cle)}`)}
          onViewDevisMonth={(cle, _nom, ym) => navigate(`/app/devis?modele=${encodeURIComponent(cle)}&mois=${ym}`)}
          onEditModele={(m) => {
            setTemplateNotice(null);
            setTemplateError(null);
            setEditError(null);
            setModeleToEdit(m);
          }}
          onRenameModele={handleRenameModele}
          onDuplicateModele={handleDuplicateModele}
          onDeleteModele={(id, nom) => setModeleToDelete({ id, nom })}
          onArchiveModele={handleArchiveModele}
          onAutoArchiveStale={handleAutoArchiveStale}
          onArchiveModeles={handleArchiveModeles}
        />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ClientsASuivre
          clients={clients}
          onClientsChanged={reload}
          relances={relancesClient}
          onRelancesChanged={reloadRelancesClient}
        />
        <DevisToRelance
          aRelancer={stats.aRelancer}
          jamaisContactes={stats.jamaisContactes}
          partager={`/app/devis?statut=${encodeURIComponent("À suivre")}`}
        />
      </div>

      {templateDraft && (
        <DevisFormModal
          clients={clients}
          busy={templateBusy}
          onClose={() => setTemplateDraft(null)}
          onSubmit={handleCreateFromTemplate}
          onQuickCreateClient={handleQuickCreateClient}
          initialObjet={templateDraft.objet}
          initialLignes={templateDraft.lignes}
        />
      )}

      {modeleToEdit && (
        <EditerModeleModal
          modele={modeleToEdit}
          busy={editBusy}
          error={editError}
          onClose={() => setModeleToEdit(null)}
          onSubmit={handleEditModele}
        />
      )}

      {modeleToDelete && (
        <Modal title="Supprimer ce modèle ?" onClose={() => setModeleToDelete(null)}>
          <p className="text-sm text-foreground-600">
            Le modèle <strong className="text-foreground-900">{modeleToDelete.nom}</strong> sera définitivement supprimé. Vos devis
            déjà créés ne sont pas affectés.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setModeleToDelete(null)}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleDeleteModele}
              className="h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap"
            >
              Supprimer
            </button>
          </div>
        </Modal>
      )}

      {showEnvoyeesJour && (
        <RelancesEnvoyeesJourModal
          items={envoyeesJourList}
          clientNom={(id) => clientNomParId.get(id) ?? "Client"}
          onClose={() => setShowEnvoyeesJour(false)}
        />
      )}
    </div>
  );
}