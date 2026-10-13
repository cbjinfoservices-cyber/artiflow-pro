import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useArtisanData } from "@/hooks/useArtisanData";
import { useAuth } from "@/hooks/useAuth";
import { formatEuros } from "@/lib/format";
import { addDays, toISODate, todayISO } from "@/lib/dates";
import { downloadCsv } from "@/lib/csv";
import { buildBalanceAgeePdf, buildJournalComptablePdf, buildRecapTvaPdf } from "@/lib/comptabilitePdf";
import { savePdf, pdfToBase64 } from "@/lib/pdf";
import { buildJournalComptableCsv, buildJournalLignes, computeComptaTotaux, computeTvaParTaux, computeBalanceAgee, isAvoir, type ComptaDevis, type ComptaFacture } from "@/lib/exportComptable";
import { sendJournalComptableEmail, updateComptableEmail, updateComptableCommentaire, updateComptableAutoSettings, updateComptableOverrideEmail, updateComptableExportPrefs, updateComptableDernierExport, updateComptableRelanceSettings, updateComptableBilanSettings, updateComptableAppUrl, runEnvoiJournalNow, runRelanceManquanteNow, runEnvoiBilanNow, renvoyerJournalMois, type ComptableEnvoi, type ComptableExportKind, type ComptableRemplacement } from "@/lib/artisanApi";
import { publicBaseUrl } from "@/lib/signature";
import { useComptableEnvois } from "@/hooks/useComptableEnvois";
import { useDernierBilan } from "@/hooks/useDernierBilan";
import { useComptableRemplacements } from "@/hooks/useComptableRemplacements";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import SampleDataButton from "@/pages/app/components/SampleDataButton";
import BoutonPartager from "@/pages/app/components/BoutonPartager";
import MenuVuesPartageesRecentes from "@/pages/app/components/MenuVuesPartageesRecentes";
import ExportComptableCarte from "@/pages/app/comptabilite/components/ExportComptableCarte";
import EnvoyerComptableCarte from "@/pages/app/comptabilite/components/EnvoyerComptableCarte";
import EnvoiAutoCarte from "@/pages/app/comptabilite/components/EnvoiAutoCarte";
import RemplacementsCarte from "@/pages/app/comptabilite/components/RemplacementsCarte";
import RecapTvaCarte from "@/pages/app/comptabilite/components/RecapTvaCarte";
import BalanceAgeeCarte from "@/pages/app/comptabilite/components/BalanceAgeeCarte";
import Infobulle from "@/components/base/Infobulle";
import EncartAide from "@/components/base/EncartAide";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import { guidePremiereVisiteVu, marquerGuidePremiereVisiteVu } from "@/lib/guidePremiereVisite";

const PERIODES = ["Tout", "Ce mois", "Ce trimestre", "Cette année", "Personnalisé"] as const;

function periodRange(periode: string): { start: Date; end: Date } | null {
  const now = new Date();
  if (periode === "Ce mois") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  }
  if (periode === "Ce trimestre") {
    const q = Math.floor(now.getMonth() / 3);
    return { start: new Date(now.getFullYear(), q * 3, 1), end: new Date(now.getFullYear(), q * 3 + 3, 1) };
  }
  if (periode === "Cette année") {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
  }
  return null;
}

/** Transforme un libellé en suffixe de nom de fichier sûr (« SCI Voltaire » → « sci-voltaire »). */
function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function AppComptabilite() {
  usePageMeta(
    "Comptabilité · ArtiFlow-pro",
    "Exportez un journal comptable consolidé : devis, factures et paiements réunis dans un seul fichier pour votre comptable.",
  );
  const { profile, user, refreshProfile } = useAuth();
  const { loading, error, devis, clients, factures, reload } = useArtisanData();

  const [periode, setPeriode] = useState<string>("Tout");
  const [clientId, setClientId] = useState<string>("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [balancePdfBusy, setBalancePdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [journalPdfBusy, setJournalPdfBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoNotice, setAutoNotice] = useState<string | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testNotice, setTestNotice] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [renvoyerBusyId, setRenvoyerBusyId] = useState<number | null>(null);
  // Mois (« AAAA-MM ») en cours de renvoi depuis l'alerte des mois manquants.
  const [renvoyerMoisBusyCle, setRenvoyerMoisBusyCle] = useState<string | null>(null);
  // Mois initial pré-filtré à l'ouverture, transmis par le lien « Renvoyer ce mois »
  // d'un email d'alerte (paramètre d'URL ?mois=AAAA-MM).
  const [moisInitial, setMoisInitial] = useState<string>("");
  // Ouvre l'Espace comptable avec l'alerte de régularité dépliée sur les mois manquants,
  // via le lien « Renvoyer tous les mois manquants » d'un email d'alerte (?manquants=1).
  const [manquantsFocus, setManquantsFocus] = useState<boolean>(false);
  // Vue à mettre en avant à l'ouverture (ex. « remplacements »), transmise par le raccourci
  // « X remplacements ce mois » du tableau de bord (?vue=remplacements).
  const [vueFocus, setVueFocus] = useState<string>("");
  // Adresse ponctuelle sur laquelle filtrer la vue « Remplacements » à l'ouverture, transmise
  // par le bouton « Voir le remplaçant habituel » du tableau de bord (?adresse=<clé>).
  const [adresseFocus, setAdresseFocus] = useState<string>("");
  // Tri à appliquer à l'ouverture de la vue « Remplacements », transmis par le sélecteur
  // du raccourci « X remplacements ce mois » du tableau de bord (?tri=date|renvois|adresse).
  const [triFocus, setTriFocus] = useState<"date" | "renvois" | "adresse" | "">("");
  // Active à l'ouverture le filtre rapide « Mois record uniquement » de la vue « Remplacements »,
  // transmis par le bouton « Mois record uniquement » du raccourci du tableau de bord (?record=1).
  const [recordFocus, setRecordFocus] = useState<boolean>(false);
  // Active à l'ouverture le filtre « mois épinglé uniquement » de la vue « Remplacements »,
  // transmis par le jeton « Épinglé : <mois> » du raccourci du tableau de bord (?epingles=1).
  const [epingleFocus, setEpingleFocus] = useState<boolean>(false);
  // Mois (« AAAA-MM ») sur lequel filtrer la vue « Remplacements » à l'ouverture, transmis
  // par le clic d'un mois épinglé de la pastille « Épinglé » du tableau de bord (?moisremp=AAAA-MM).
  const [moisRempFocus, setMoisRempFocus] = useState<string>("");
  // Arrivée depuis le raccourci « Ouvrir le mois le plus faible » du tableau de bord (?faible=1) :
  // la barre du mois le plus faible est surlignée brièvement dans le mini-graphe des remplacements.
  const [faibleFocus, setFaibleFocus] = useState<boolean>(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Guide de première visite : ouvert au premier passage sur l'Espace comptable, puis mémorisé
  // une fois fermé par l'artisan. Réouvrable à tout moment via « Revoir le guide ».
  const [guideVisible, setGuideVisible] = useState(() => !guidePremiereVisiteVu("comptabilite"));
  const fermerGuide = () => {
    marquerGuidePremiereVisiteVu("comptabilite");
    setGuideVisible(false);
  };

  // Historique des envois du journal au comptable (carte d'envoi automatique).
  // On charge large (200) pour alimenter la vue jusqu'à 24 mois du mini-graphe.
  const { envois: comptableEnvois, loading: comptableEnvoisLoading, reload: reloadComptableEnvois } = useComptableEnvois(200);

  // Dernier bilan d'archivage envoyé (date + exercice) et liste des bilans déjà archivés,
  // affichés dans la carte d'envoi automatique.
  const { bilan: dernierBilan, bilans: bilansArchives, loading: dernierBilanLoading, reload: reloadDernierBilan } = useDernierBilan();

  // Renvois de remplacement déjà effectués (adresse ponctuelle, date, exercice), pour la vue « Remplacements ».
  const {
    remplacements,
    loading: remplacementsLoading,
    error: remplacementsError,
    reload: reloadRemplacements,
  } = useComptableRemplacements(200);

  // Ouverture filtrée sur un client : la fiche client peut ouvrir la comptabilité
  // avec ?client=<id>, on applique le filtre puis on nettoie l'URL.
  useEffect(() => {
    const param = searchParams.get("client");
    const periodeParam = searchParams.get("periode");
    const moisParam = searchParams.get("mois");
    const manquantsParam = searchParams.get("manquants");
    const vueParam = searchParams.get("vue");
    const adresseParam = searchParams.get("adresse");
    const triParam = searchParams.get("tri");
    const recordParam = searchParams.get("record");
    const epinglesParam = searchParams.get("epingles");
    // Mois précis sur lequel ouvrir la liste des remplacements (clic d'un mois épinglé
    // de la pastille « Épinglé » du tableau de bord, ?moisremp=AAAA-MM).
    const moisRempParam = searchParams.get("moisremp");
    // Marqueur d'ouverture du mois le plus faible depuis le tableau de bord (?faible=1).
    const faibleParam = searchParams.get("faible");
    // Semaine précise choisie en cliquant une barre de la tendance du score de santé
    // (?semaine=AAAA-MM-JJ) : on pré-filtre la période sur lundi → dimanche de cette semaine.
    const semaineParam = searchParams.get("semaine");
    if (
      !param &&
      !periodeParam &&
      !moisParam &&
      !manquantsParam &&
      !vueParam &&
      !adresseParam &&
      !triParam &&
      !recordParam &&
      !epinglesParam &&
      !moisRempParam &&
      !faibleParam &&
      !semaineParam
    )
      return;
    if (param) setClientId(param);
    if (periodeParam && (PERIODES as readonly string[]).includes(periodeParam)) setPeriode(periodeParam);
    if (moisParam && /^\d{4}-\d{2}$/.test(moisParam)) setMoisInitial(moisParam);
    if (manquantsParam === "1" || manquantsParam === "tous") setManquantsFocus(true);
    if (vueParam) setVueFocus(vueParam);
    if (adresseParam) setAdresseFocus(adresseParam);
    if (triParam === "date" || triParam === "renvois" || triParam === "adresse") setTriFocus(triParam);
    if (recordParam === "1") setRecordFocus(true);
    if (epinglesParam === "1") setEpingleFocus(true);
    if (moisRempParam && /^\d{4}-\d{2}$/.test(moisRempParam)) setMoisRempFocus(moisRempParam);
    if (faibleParam === "1") setFaibleFocus(true);
    if (semaineParam && /^\d{4}-\d{2}-\d{2}$/.test(semaineParam)) {
      setPeriode("Personnalisé");
      setCustomStart(semaineParam);
      setCustomEnd(toISODate(addDays(new Date(`${semaineParam}T00:00:00`), 6)));
    }
    const next = new URLSearchParams(searchParams);
    next.delete("client");
    next.delete("periode");
    next.delete("mois");
    next.delete("manquants");
    next.delete("vue");
    next.delete("adresse");
    next.delete("tri");
    next.delete("record");
    next.delete("epingles");
    next.delete("moisremp");
    next.delete("faible");
    next.delete("semaine");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Amène l'artisan directement à la vue demandée par le raccourci du tableau de bord
  // (ex. la liste des remplacements), une fois la page rendue.
  useEffect(() => {
    if (vueFocus !== "remplacements") return;
    const t = setTimeout(() => {
      document.getElementById("remplacements")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setVueFocus("");
    }, 320);
    return () => clearTimeout(t);
  }, [vueFocus]);

  // Mémorise une fois par visite la base publique de l'app, afin que les emails
  // comptables déclenchés côté serveur puissent contenir un lien vers l'Espace comptable.
  const appUrlSavedRef = useRef(false);
  useEffect(() => {
    if (!user || appUrlSavedRef.current) return;
    appUrlSavedRef.current = true;
    const url = publicBaseUrl();
    if (profile?.comptable_app_url !== url) {
      updateComptableAppUrl(user.id, url).catch(() => {
        /* confort : son échec ne bloque rien */
      });
    }
  }, [user, profile?.comptable_app_url]);

  // Filtre période : l'ensemble du journal (devis + factures) est restreint à la plage choisie.
  const { devisPeriode, facturesPeriode } = useMemo(() => {
    const range = periodRange(periode);
    const dStart = periode === "Personnalisé" && customStart ? new Date(`${customStart}T00:00:00`) : range?.start ?? null;
    const dEnd = periode === "Personnalisé" && customEnd ? new Date(`${customEnd}T23:59:59`) : range?.end ?? null;
    const inRange = (value: string | null | undefined) => {
      if (!dStart && !dEnd) return true;
      if (!value) return false;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return false;
      if (dStart && d < dStart) return false;
      if (dEnd && d > dEnd) return false;
      return true;
    };

    // Filtre client : restreint devis et factures à un seul client (journal dédié).
    const matchClient = (id: number | null | undefined) => clientId === "" || String(id ?? "") === clientId;

    const devisD: ComptaDevis[] = devis
      .filter((d) => inRange(d.created_at) && matchClient(d.client_id))
      .map((d) => ({
        numero: d.numero,
        clientId: d.client_id,
        clientNom: d.clientNom,
        objet: d.objet,
        total_ht: d.total_ht,
        total_ttc: d.total_ttc,
        statut: d.statut,
        created_at: d.created_at,
      }));
    const facturesD: ComptaFacture[] = factures
      .filter((f) => inRange(f.date_emission ?? f.created_at) && matchClient(f.client_id))
      .map((f) => ({
        numero: f.numero,
        clientId: f.client_id,
        clientNom: f.clientNom,
        objet: f.objet,
        total_ht: f.total_ht,
        total_ttc: f.total_ttc,
        statut: f.statut,
        date_emission: f.date_emission,
        date_echeance: f.date_echeance,
        date_paiement: f.date_paiement,
        created_at: f.created_at,
        lignes: f.lignes
          ? f.lignes.map((l) => ({
              designation: l.designation,
              unite: l.unite,
              quantite: l.quantite,
              prix_unitaire: l.prix_unitaire,
              taux_tva: l.taux_tva,
            }))
          : null,
      }));
    return { devisPeriode: devisD, facturesPeriode: facturesD };
  }, [devis, factures, periode, customStart, customEnd, clientId]);

  const totaux = useMemo(() => computeComptaTotaux(devisPeriode, facturesPeriode), [devisPeriode, facturesPeriode]);
  const tvaParTaux = useMemo(() => computeTvaParTaux(facturesPeriode), [facturesPeriode]);
  const journalLignes = useMemo(() => buildJournalLignes(devisPeriode, facturesPeriode), [devisPeriode, facturesPeriode]);
  const apercu = useMemo(() => journalLignes.slice(0, 10), [journalLignes]);

  // Balance âgée : instantané des créances impayées (hors filtre de période), restreint
  // au client sélectionné, pour refléter l'état réel des encaissements à date.
  const balanceAgee = useMemo(() => {
    const list: ComptaFacture[] = factures
      .filter((f) => clientId === "" || String(f.client_id ?? "") === clientId)
      .map((f) => ({
        numero: f.numero,
        clientNom: f.clientNom,
        objet: f.objet,
        total_ht: f.total_ht,
        total_ttc: f.total_ttc,
        statut: f.statut,
        date_emission: f.date_emission,
        date_echeance: f.date_echeance,
        date_paiement: f.date_paiement,
        created_at: f.created_at,
      }));
    return computeBalanceAgee(list);
  }, [factures, clientId]);

  // Détail des factures impayées (une ligne par facture, du plus ancien au plus récent),
  // repris dans l'export PDF de la balance âgée. Même périmètre que la balance (filtre client,
  // avoirs et factures réglées exclus).
  const balanceAgeeDetail = useMemo(() => {
    const ref = Date.now();
    return factures
      .filter((f) => clientId === "" || String(f.client_id ?? "") === clientId)
      .filter((f) => !isAvoir(f.numero) && f.statut !== "Payée")
      .map((f) => {
        const dateRef = f.date_echeance ?? f.date_emission ?? f.created_at;
        const t = dateRef ? new Date(dateRef).getTime() : NaN;
        const jours = Number.isNaN(t) ? 0 : Math.max(0, Math.floor((ref - t) / 86400000));
        return {
          numero: f.numero,
          client: f.clientNom ?? "",
          echeance: dateRef ?? null,
          jours,
          montant: Number(f.total_ttc || 0),
        };
      })
      .sort((a, b) => b.jours - a.jours);
  }, [factures, clientId]);

  const periodeLabel = periode === "Personnalisé"
    ? customStart || customEnd
      ? `Du ${customStart || "…"} au ${customEnd || "…"}`
      : "Période personnalisée"
    : periode;
  const clientLabel = clientId ? clients.find((c) => String(c.id) === clientId)?.nom ?? "Client" : "";
  const filtreLabel = clientLabel ? `${periodeLabel} · ${clientLabel}` : periodeLabel;

  // Au moins un filtre de la barre (période / client / dates) s'écarte-t-il des valeurs par défaut ?
  const filtresBarreActifs =
    periode !== "Tout" || clientId !== "" || customStart !== "" || customEnd !== "";

  // Remet d'un coup la barre de filtres à zéro : période « Tout », aucun client, aucune date.
  const reinitialiserFiltresBarre = () => {
    setPeriode("Tout");
    setClientId("");
    setCustomStart("");
    setCustomEnd("");
  };


  // Chemin de partage de la vue comptable courante (période + client), pour alimenter
  // l'historique « Vues partagées récemment » de cette même page.
  const cheminPartage = (() => {
    const p = new URLSearchParams();
    if (clientId) p.set("client", clientId);
    if (periode && periode !== "Tout") p.set("periode", periode);
    const qs = p.toString();
    return `/app/comptabilite${qs ? `?${qs}` : ""}`;
  })();

  // Identité de l'émetteur, reprise en tête des PDF générés.
  const emetteurInfo = {
    entreprise: profile?.entreprise ?? "Mon entreprise",
    metier: profile?.metier ?? "",
    telephone: profile?.telephone ?? "",
    email: profile?.email ?? user?.email ?? "",
    siret: profile?.siret ?? null,
    tva: profile?.tva ?? null,
  };
  const comptableEmail = profile?.comptable_email ?? "";
  // Format d'export par défaut mémorisé, ramené à une valeur valide.
  const exportFormatPref: "image" | "csv" | "both" =
    profile?.comptable_export_format === "image" || profile?.comptable_export_format === "csv"
      ? profile.comptable_export_format
      : "both";

  const handleExportPdfTva = () => {
    setPdfError(null);
    setPdfBusy(true);
    try {
      const doc = buildRecapTvaPdf({
        emetteur: emetteurInfo,
        tva: tvaParTaux,
        totalTva: totaux.tvaCollectee,
        totaux,
        filtreLabel,
      });
      const suffixeClient = clientLabel
        ? `-${clientLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`
        : "";
      savePdf(doc, `recap-tva-artiflow-${todayISO()}${suffixeClient}.pdf`);
      setNotice(`Récapitulatif de TVA par taux exporté en PDF${clientLabel ? ` (client : ${clientLabel})` : ""}.`);
    } catch {
      setPdfError("L'export PDF du récapitulatif de TVA a échoué. Réessayez.");
    } finally {
      setPdfBusy(false);
    }
  };

  const handleExportBalanceAgee = () => {
    setPdfError(null);
    setNotice(null);
    setBalancePdfBusy(true);
    try {
      const doc = buildBalanceAgeePdf({
        emetteur: emetteurInfo,
        filtreLabel: clientLabel ? `Client : ${clientLabel}` : "Toutes créances à date",
        balance: balanceAgee,
        detail: balanceAgeeDetail,
      });
      const suffixeClient = clientLabel ? `-${slugify(clientLabel)}` : "";
      savePdf(doc, `balance-agee-artiflow-${todayISO()}${suffixeClient}.pdf`);
      setNotice(`Balance âgée des créances exportée en PDF${clientLabel ? ` (client : ${clientLabel})` : ""}.`);
    } catch {
      setPdfError("L'export PDF de la balance âgée a échoué. Réessayez.");
    } finally {
      setBalancePdfBusy(false);
    }
  };

  const handleExport = () => {
    setNotice(null);
    setBusy(true);
    try {
      const csv = buildJournalComptableCsv(devisPeriode, facturesPeriode);
      const suffixe = periode === "Tout" ? "" : `-${periode.toLowerCase().replace(/\s+/g, "-")}`;
      const suffixeClient = clientLabel ? `-${clientLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : "";
      downloadCsv(`journal-comptable-artiflow-${todayISO()}${suffixe}${suffixeClient}.csv`, csv);
      setNotice(
        `Journal comptable exporté${clientLabel ? ` (client : ${clientLabel})` : ""} : un seul fichier avec devis, factures et paiements.`,
      );
    } finally {
      setBusy(false);
    }
  };

  // Export PDF complet de la période : journal + TVA par taux + synthèse en un seul document.
  const handleExportPdfJournal = () => {
    setNotice(null);
    setPdfError(null);
    setJournalPdfBusy(true);
    try {
      const doc = buildJournalComptablePdf({
        emetteur: emetteurInfo,
        filtreLabel,
        lignes: journalLignes,
        totaux,
        tva: tvaParTaux,
      });
      const suffixe = periode === "Tout" ? "" : `-${slugify(periode)}`;
      const suffixeClient = clientLabel ? `-${slugify(clientLabel)}` : "";
      savePdf(doc, `journal-comptable-artiflow-${todayISO()}${suffixe}${suffixeClient}.pdf`);
      setNotice(`Journal comptable exporté en PDF${clientLabel ? ` (client : ${clientLabel})` : ""} : journal, TVA et synthèse réunis.`);
    } catch {
      setPdfError("L'export PDF du journal comptable a échoué. Réessayez.");
    } finally {
      setJournalPdfBusy(false);
    }
  };

  // Envoi du journal comptable au comptable par email, avec le PDF complet en pièce jointe.
  const handleSendComptable = async (email: string, message: string) => {
    setEmailNotice(null);
    setEmailError(null);
    setEmailBusy(true);
    try {
      const doc = buildJournalComptablePdf({
        emetteur: emetteurInfo,
        filtreLabel,
        lignes: journalLignes,
        totaux,
        tva: tvaParTaux,
      });
      const pdfBase64 = pdfToBase64(doc);
      const suffixe = periode === "Tout" ? "" : `-${slugify(periode)}`;
      const suffixeClient = clientLabel ? `-${slugify(clientLabel)}` : "";
      const filename = `journal-comptable-artiflow-${todayISO()}${suffixe}${suffixeClient}.pdf`;
      if (user) {
        try {
          await updateComptableEmail(user.id, email);
        } catch {
          /* le journal part quand même : l'adresse sera simplement re-saisie la prochaine fois */
        }
      }
      await sendJournalComptableEmail({
        to: email,
        pdfBase64,
        filename,
        periodeLabel,
        clientLabel: clientLabel || undefined,
        message: message || undefined,
        lignes: journalLignes.length,
      });
      setEmailNotice(`Journal comptable envoyé à ${email}, avec le PDF consolidé en pièce jointe.`);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "L'envoi au comptable a échoué. Réessayez.");
    } finally {
      setEmailBusy(false);
    }
  };

  // Enregistre les réglages de l'envoi automatique mensuel du journal au comptable
  // (jour, heure), le choix d'y joindre un récap de régularité automatique, et la
  // réception optionnelle d'une copie du récap par l'artisan lui-même.
  const handleSaveAuto = async (settings: { actif: boolean; jour: number; heure: number; rapportAuto: boolean; copieArtisan: boolean }) => {
    if (!user) return;
    setAutoNotice(null);
    setAutoError(null);
    setAutoBusy(true);
    try {
      await updateComptableAutoSettings(user.id, settings);
      try {
        await updateComptableAppUrl(user.id, publicBaseUrl());
      } catch {
        /* l'URL de l'app est un confort : son échec ne bloque pas les réglages */
      }
      await refreshProfile();
      if (!settings.actif) {
        setAutoNotice("Envoi automatique désactivé.");
      } else {
        const recap = settings.rapportAuto ? " avec le récap de régularité (graphe + CSV)" : "";
        setAutoNotice(
          `Envoi automatique activé${recap} : le journal du mois écoulé partira le ${settings.jour === 1 ? "1er" : settings.jour} à ${String(settings.heure).padStart(2, "0")} h.`,
        );
      }
    } catch {
      setAutoError("L'enregistrement des réglages a échoué. Réessayez.");
    } finally {
      setAutoBusy(false);
    }
  };

  // Mémorise les préférences d'export du mini-graphe de régularité (période + format).
  const handleSaveExportPrefs = async (prefs: { periode: string; format: "image" | "csv" | "both" }) => {
    if (!user) return;
    try {
      await updateComptableExportPrefs(user.id, prefs);
      await refreshProfile();
    } catch {
      /* préférence de confort : son échec ne doit pas perturber l'usage du graphe */
    }
  };

  // Mémorise le dernier type d'export de l'historique utilisé (CSV/PDF, filtré/complet)
  // pour le remettre en avant et le reproposer à la prochaine visite de l'Espace comptable.
  const handleSaveDernierExport = (kind: ComptableExportKind) => {
    if (!user) return;
    void (async () => {
      try {
        await updateComptableDernierExport(user.id, kind);
        await refreshProfile();
      } catch {
        /* préférence de confort : son échec ne doit pas perturber l'export */
      }
    })();
  };

  // Enregistre le réglage de l'alerte à l'artisan (mois attendu resté sans envoi automatique).
  const handleSaveRelanceManquante = async (settings: { actif: boolean; delai: number }) => {
    if (!user) return;
    await updateComptableRelanceSettings(user.id, settings);
    await refreshProfile();
  };

  // Envoie tout de suite un email d'alerte de test à l'artisan, pour vérifier le rendu
  // sans attendre un vrai mois manquant. Le repère anti-doublon du mois en cours n'est pas touché.
  const handleTestRelance = async () => {
    if (!user) return { sent: 0, configured: false, reason: "Vous devez être connecté pour tester l'alerte." };
    return runRelanceManquanteNow(user.id);
  };

  // Enregistre le réglage du bilan d'archivage annuel (historique transmis en fin d'année),
  // y compris l'option « m'envoyer une copie du bilan ».
  const handleSaveBilan = async (settings: { actif: boolean; jour: number; copieArtisan: boolean }) => {
    if (!user) return;
    await updateComptableBilanSettings(user.id, settings);
    await refreshProfile();
  };

  // Envoie tout de suite le bilan d'archivage de l'exercice au comptable, pour vérifier le rendu.
  const handleTestBilan = async () => {
    if (!user) {
      return { sent: 0, configured: false, annee: "", reason: "Vous devez être connecté pour tester le bilan." };
    }
    return runEnvoiBilanNow(user.id);
  };

  // Renvoie par email le bilan d'archivage d'un exercice déjà archivé (d'un clic depuis la
  // liste des bilans). `overrideTo`, s'il est fourni, ajoute une copie à une adresse ponctuelle
  // (ex. expert-comptable remplaçant) et la mémorise pour la reproposer au prochain renvoi.
  const handleEnvoyerBilan = async (annee: string, overrideTo?: string, overrideNom?: string) => {
    if (!user) {
      return { sent: 0, configured: false, reason: "Vous devez être connecté pour renvoyer le bilan." };
    }
    const adresse = overrideTo && overrideTo.trim() ? overrideTo.trim() : undefined;
    const result = await runEnvoiBilanNow(user.id, annee, adresse, overrideNom);
    if (adresse && result.sent > 0) {
      try {
        await updateComptableOverrideEmail(user.id, adresse);
        await refreshProfile();
      } catch {
        /* le renvoi a réussi : la mémorisation de l'adresse est un simple confort */
      }
      void reloadRemplacements();
    }
    return { sent: result.sent, configured: result.configured, reason: result.reason };
  };

  // Envoi de test immédiat du journal du mois écoulé au comptable (mode forcé) :
  // permet de vérifier le rendu de l'email et de la pièce jointe avant de compter
  // sur la tâche planifiée mensuelle.
  const handleTestEnvoi = async () => {
    if (!user) return;
    setTestNotice(null);
    setTestError(null);
    setTestBusy(true);
    try {
      const result = await runEnvoiJournalNow(user.id);
      await reloadComptableEnvois();
      if (result.sent > 0) {
        setTestNotice(
          `Envoi de test réussi : le journal du mois écoulé${result.monthLabel ? ` (${result.monthLabel})` : ""} vient de partir vers votre comptable. Vérifiez la réception et le rendu.`,
        );
      } else if (!result.configured) {
        setTestError("L'envoi d'emails n'est pas encore activé : configurez Resend pour tester l'envoi réel.");
      } else {
        setTestError(result.reason || "L'envoi de test n'a rien pu expédier. Vérifiez l'email du comptable et le contenu de la période.");
      }
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "L'envoi de test a échoué. Réessayez.");
    } finally {
      setTestBusy(false);
    }
  };

  // Renvoie d'un clic le journal d'un mois présent dans l'historique au comptable
  // (même contenu qu'un envoi automatique : PDF complet + résumé). L'envoi est marqué
  // « manuel » et ne perturbe pas le repère du mois envoyé automatiquement.
  const handleRenvoyer = async (env: ComptableEnvoi, overrideTo?: string, overrideNom?: string) => {
    if (!user || !env.moisCle) return;
    setTestNotice(null);
    setTestError(null);
    setRenvoyerBusyId(env.id);
    try {
      const result = await renvoyerJournalMois(user.id, env.moisCle, overrideTo, overrideNom);
      await reloadComptableEnvois();
      if (result.sent > 0) {
        if (overrideTo && overrideTo.trim()) {
          // Mémorise l'adresse ponctuelle pour la reproposer en suggestion au prochain renvoi.
          try {
            await updateComptableOverrideEmail(user.id, overrideTo.trim());
            await refreshProfile();
          } catch {
            /* le renvoi a réussi : la mémorisation de l'adresse est un simple confort */
          }
          void reloadRemplacements();
        }
        setTestNotice(
          overrideTo
            ? `Journal de ${env.mois ?? result.monthLabel} envoyé à ${overrideTo} (adresse ponctuelle, sans modifier votre comptable habituel).`
            : `Journal de ${env.mois ?? result.monthLabel} renvoyé à votre comptable.`,
        );
      } else if (!result.configured) {
        setTestError("L'envoi d'emails n'est pas encore activé : configurez Resend pour renvoyer le journal.");
      } else {
        setTestError(result.reason || "Le renvoi du journal n'a rien pu expédier. Vérifiez l'email du comptable.");
      }
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "Le renvoi du journal a échoué. Réessayez.");
    } finally {
      setRenvoyerBusyId(null);
    }
  };

  // Renvoie d'un clic le journal d'un mois signalé comme « manquant » (aucun envoi
  // automatique) directement depuis l'alerte de régularité. Même contenu qu'un envoi
  // automatique (PDF complet + résumé), marqué « manuel ».
  const handleRenvoyerMois = async (cle: string) => {
    if (!user) return;
    setTestNotice(null);
    setTestError(null);
    setRenvoyerMoisBusyCle(cle);
    try {
      const result = await renvoyerJournalMois(user.id, cle);
      await reloadComptableEnvois();
      if (result.sent > 0) {
        setTestNotice(`Journal de ${result.monthLabel || cle} renvoyé à votre comptable.`);
      } else if (!result.configured) {
        setTestError("L'envoi d'emails n'est pas encore activé : configurez Resend pour renvoyer le journal.");
      } else {
        setTestError(result.reason || "Le renvoi du journal n'a rien pu expédier. Vérifiez l'email du comptable.");
      }
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "Le renvoi du journal a échoué. Réessayez.");
    } finally {
      setRenvoyerMoisBusyCle(null);
    }
  };

  // Renvoie en une seule action le journal de tous les mois manquants (bouton
  // « Renvoyer tous les mois manquants » de l'alerte de régularité dépliée).
  const handleRenvoyerTousMois = async (cles: string[]) => {
    if (!user || cles.length === 0) return;
    setTestNotice(null);
    setTestError(null);
    setRenvoyerMoisBusyCle("__tous__");
    let ok = 0;
    let ko = 0;
    let nonConfigure = false;
    for (const cle of cles) {
      try {
        const result = await renvoyerJournalMois(user.id, cle);
        if (result.sent > 0) ok += 1;
        else if (!result.configured) nonConfigure = true;
        else ko += 1;
      } catch {
        ko += 1;
      }
    }
    await reloadComptableEnvois();
    setRenvoyerMoisBusyCle(null);
    if (nonConfigure && ok === 0) {
      setTestError("L'envoi d'emails n'est pas encore activé : configurez Resend pour renvoyer les journaux.");
    } else if (ok === 0) {
      setTestError("Le renvoi des mois manquants n'a rien pu expédier. Vérifiez l'email du comptable.");
    } else if (ko > 0) {
      setTestNotice(
        `${ok} mois renvoyé${ok > 1 ? "s" : ""} au comptable, ${ko} en échec. Relancez pour les mois restants.`,
      );
    } else {
      setTestNotice(`${ok} mois manquant${ok > 1 ? "s" : ""} renvoyé${ok > 1 ? "s" : ""} au comptable.`);
    }
  };

  // Depuis la vue « Remplacements », renvoie en un clic la dernière pièce transmise à une
  // adresse ponctuelle : un bilan d'archivage (par exercice) ou un journal mensuel (par mois),
  // tel quel et vers la même adresse, sans modifier l'email du comptable habituel.
  const handleRenvoyerDernierePiece = async (
    r: ComptableRemplacement,
  ): Promise<{ ok: boolean; message: string }> => {
    if (!user) return { ok: false, message: "Vous devez être connecté pour renvoyer la pièce." };
    if (r.type === "bilan" && r.exercice) {
      const result = await runEnvoiBilanNow(user.id, r.exercice, r.adresse, r.nom ?? undefined);
      if (result.sent > 0) {
        void reloadRemplacements();
        return { ok: true, message: `Bilan de l'exercice ${r.exercice} renvoyé à ${r.adresse}.` };
      }
      if (!result.configured) {
        return { ok: false, message: "L'envoi d'emails n'est pas encore activé : configurez Resend." };
      }
      return { ok: false, message: result.reason || "Le renvoi du bilan n'a rien pu expédier." };
    }
    if (r.type === "journal" && r.exercice) {
      const result = await renvoyerJournalMois(user.id, r.exercice, r.adresse, r.nom ?? undefined);
      if (result.sent > 0) {
        void reloadRemplacements();
        return {
          ok: true,
          message: `Journal de ${result.monthLabel || r.exercice} renvoyé à ${r.adresse}.`,
        };
      }
      if (!result.configured) {
        return { ok: false, message: "L'envoi d'emails n'est pas encore activé : configurez Resend." };
      }
      return { ok: false, message: result.reason || "Le renvoi du journal n'a rien pu expédier." };
    }
    return { ok: false, message: "Nature de la pièce inconnue : renvoi impossible." };
  };

  // Mémorise le commentaire libre joint aux envois de régularité au comptable, pour le
  // reproposer tel quel au prochain envoi (mis à jour silencieusement, sans bloquer l'envoi).
  const handleSaveCommentaire = async (value: string) => {
    if (!user) return;
    try {
      await updateComptableCommentaire(user.id, value);
      await refreshProfile();
    } catch {
      /* le commentaire est un confort : son échec ne doit pas perturber l'envoi */
    }
  };

  if (!loading && !error && devis.length === 0 && factures.length === 0) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon="ri-file-chart-line"
          title="Rien à exporter pour l'instant"
          text="Dès que vous aurez des devis et des factures, vous pourrez générer ici un journal comptable consolidé à transmettre à votre comptable."
        >
          <SampleDataButton onSeeded={reload} />
        </EmptyState>
      </div>
    );
  }

  const cartes = [
    { label: "Total facturé TTC", value: formatEuros(totaux.factureTTC), tone: "bg-background-100 border-background-200", accent: "text-foreground-950" },
    { label: "Encaissé TTC", value: formatEuros(totaux.encaisse), tone: "bg-accent-50 border-accent-200", accent: "text-accent-700" },
    { label: "Reste à encaisser", value: formatEuros(totaux.resteAEncaisser), tone: "bg-secondary-50 border-secondary-200", accent: "text-secondary-700" },
    { label: "TVA collectée", value: formatEuros(totaux.tvaCollectee), tone: "bg-background-100 border-background-200", accent: "text-foreground-950" },
  ];

  return (
    <DataState loading={loading} error={error} onRetry={reload}>
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading font-semibold text-lg text-foreground-950">Espace comptable</h2>
            <p className="text-sm text-foreground-500 mt-0.5">
              Rassemblez vos devis, factures et paiements dans un unique export, prêt à envoyer à votre comptable.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <BoutonPartager
              label={clientLabel ? `Comptabilité · ${clientLabel}` : "Comptabilité"}
              chemin={cheminPartage}
              title="Copier le lien de cette vue comptable"
              compact
            />
            <MenuVuesPartageesRecentes basePath="/app/comptabilite" />
          </div>
        </div>

        {guideVisible && (
          <GuidePremiereVisite
            titre="Bienvenue dans votre espace comptable"
            sousTitre="Voici, en 4 étapes, comment transmettre votre comptabilité à votre comptable. Rien n'est envoyé sans votre accord."
            etapes={[
              {
                icone: "ri-calendar-line",
                titre: "Choisissez la période",
                texte:
                  "En haut, choisissez la période (et un client si besoin). « Tout » prend l'ensemble de votre activité.",
              },
              {
                icone: "ri-download-2-line",
                titre: "Téléchargez le journal",
                texte:
                  "Cliquez « Télécharger le CSV » ou « PDF complet » pour récupérer un seul fichier prêt à transmettre.",
              },
              {
                icone: "ri-send-plane-line",
                titre: "Envoyez au comptable",
                texte:
                  "Renseignez l'email de votre comptable puis cliquez « Envoyer au comptable » : le PDF part en pièce jointe.",
              },
              {
                icone: "ri-calendar-schedule-line",
                titre: "Automatisez",
                texte:
                  "Activez l'envoi automatique mensuel : le journal partira tout seul, chaque mois, le jour que vous choisissez.",
              },
            ]}
            note="Ce guide ne s'affiche qu'une seule fois. Vous pouvez le revoir à tout moment avec « Revoir le guide du comptable »."
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
            Revoir le guide du comptable
          </button>
        )}

        <EncartAide
          ton="primary"
          icone="ri-file-chart-line"
          titre="Comment transmettre ma comptabilité ?"
          etapes={[
            "Choisissez la période (et un client si besoin) : le journal se met à jour tout seul.",
            "Téléchargez le CSV (pour Excel) ou le PDF complet (journal + TVA + synthèse).",
            "Envoyez-le à votre comptable par email, ou activez l'envoi automatique mensuel pour ne plus y penser.",
          ]}
          note="Rien n'est transmis tant que vous ne cliquez pas « Envoyer ». L'envoi automatique, lui, ne part que si vous l'avez activé."
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
            {PERIODES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPeriode(p);
                  if (p !== "Personnalisé") {
                    setCustomStart("");
                    setCustomEnd("");
                  }
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  periode === p ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {clients.length > 0 && (
            <div className="relative">
              <i className="ri-user-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-9 pl-9 pr-14 rounded-full bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 outline-none focus:border-primary-400 cursor-pointer appearance-none max-w-[220px]"
                title="Restreindre le journal à un seul client"
                aria-label="Filtrer le journal comptable par client"
              >
                <option value="">Tous les clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
            </div>
          )}
          {clientLabel && (
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap">
              <i className="ri-user-3-line"></i>
              Journal client : {clientLabel}
              <button
                type="button"
                onClick={() => setClientId("")}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-secondary-200 cursor-pointer"
                aria-label="Retirer le filtre client"
                title="Retirer le filtre client"
              >
                <i className="ri-close-line text-sm"></i>
              </button>
            </span>
          )}
          <Infobulle
            contenu="Remet la période sur « Tout » et enlève le filtre client, pour revoir l'ensemble de votre activité."
            position="bas"
            largeur={280}
          >
            <button
              type="button"
              onClick={reinitialiserFiltresBarre}
              disabled={!filtresBarreActifs}
              title="Remettre la période et le client à leurs valeurs par défaut (Tout · tous les clients)"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background-50 border border-background-200 text-xs font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-filter-off-line"></i>
              Réinitialiser tous les filtres
            </button>
          </Infobulle>
        </div>

        {periode === "Personnalisé" && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 p-4 rounded-lg bg-background-100 border border-background-200 animate-fade-in">
            <div className="flex flex-col gap-1">
              <label htmlFor="compta-date-start" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Du
              </label>
              <input
                id="compta-date-start"
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="compta-date-end" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Au
              </label>
              <input
                id="compta-date-end"
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomStart("");
                setCustomEnd("");
              }}
              disabled={!customStart && !customEnd}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-close-circle-line"></i>
              Effacer les dates
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cartes.map((c) => (
            <div key={c.label} className={`p-4 rounded-lg border ${c.tone}`}>
              <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">{c.label}</p>
              <p className={`mt-1 font-heading font-bold text-xl ${c.accent}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <RecapTvaCarte
          tva={tvaParTaux}
          totalTva={totaux.tvaCollectee}
          filtreLabel={filtreLabel}
          onExportPdf={handleExportPdfTva}
          exportingPdf={pdfBusy}
        />

        <BalanceAgeeCarte
          balance={balanceAgee}
          filtreLabel={clientLabel ? `Client : ${clientLabel}` : "Toutes créances à date"}
          onExportPdf={handleExportBalanceAgee}
          exportingPdf={balancePdfBusy}
        />

        {pdfError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {pdfError}
          </p>
        )}

        {notice && (
          <p className="text-xs text-accent-700 flex items-center gap-1.5">
            <i className="ri-checkbox-circle-line"></i>
            {notice}
          </p>
        )}

        <ExportComptableCarte
          nbDevis={totaux.nbDevis}
          nbFactures={totaux.nbFactures}
          nbPaiements={totaux.nbPaiements}
          periodeLabel={periodeLabel}
          clientLabel={clientLabel}
          busy={busy}
          onExport={handleExport}
          onExportPdf={handleExportPdfJournal}
          pdfBusy={journalPdfBusy}
        />

        <EnvoyerComptableCarte
          defaultEmail={comptableEmail}
          busy={emailBusy}
          notice={emailNotice}
          error={emailError}
          onSend={handleSendComptable}
        />

        <EnvoiAutoCarte
          defaultActif={profile?.comptable_auto_actif ?? false}
          defaultRapportAuto={profile?.comptable_rapport_auto_actif ?? false}
          defaultCopieArtisan={profile?.comptable_rapport_copie_artisan ?? true}
          defaultJour={profile?.comptable_auto_jour ?? 1}
          defaultHeure={profile?.comptable_auto_heure ?? 8}
          comptableEmail={comptableEmail}
          emetteur={emetteurInfo}
          artisanEmail={profile?.email ?? user?.email ?? ""}
          dernierMois={profile?.comptable_auto_dernier_mois ?? null}
          historique={comptableEnvois}
          historiqueLoading={comptableEnvoisLoading}
          overrideSuggestion={profile?.comptable_override_email || profile?.comptable_override_email_defaut || ""}
          overrideAdresses={profile?.comptable_override_adresses ?? []}
          busy={autoBusy}
          notice={autoNotice}
          error={autoError}
          onSave={handleSaveAuto}
          onTest={handleTestEnvoi}
          testBusy={testBusy}
          testNotice={testNotice}
          testError={testError}
          onRenvoyer={handleRenvoyer}
          renvoyerBusyId={renvoyerBusyId}
          defaultCommentaire={profile?.comptable_commentaire ?? ""}
          onSaveCommentaire={handleSaveCommentaire}
          onRenvoyerMois={handleRenvoyerMois}
          renvoyerMoisBusyCle={renvoyerMoisBusyCle}
          onRenvoyerTousMois={handleRenvoyerTousMois}
          focusManquants={manquantsFocus}
          exportPeriode={profile?.comptable_export_periode ?? "12"}
          exportFormat={exportFormatPref}
          onSaveExportPrefs={handleSaveExportPrefs}
          defaultExportDernier={profile?.comptable_export_dernier ?? ""}
          onSaveDernierExport={handleSaveDernierExport}
          defaultRelanceManquanteActif={profile?.comptable_relance_manquante_actif ?? false}
          defaultRelanceDelai={profile?.comptable_relance_delai ?? 3}
          onSaveRelanceManquante={handleSaveRelanceManquante}
          onTestRelance={handleTestRelance}
          defaultBilanActif={profile?.comptable_bilan_auto_actif ?? false}
          defaultBilanJour={profile?.comptable_bilan_jour ?? 5}
          defaultBilanCopieArtisan={profile?.comptable_bilan_copie_artisan ?? true}
          onSaveBilan={handleSaveBilan}
          onTestBilan={handleTestBilan}
          onEnvoyerBilan={handleEnvoyerBilan}
          dernierBilan={dernierBilan}
          bilans={bilansArchives}
          bilanLoading={dernierBilanLoading}
          onReloadDernierBilan={reloadDernierBilan}
          initialFiltreMois={moisInitial}
        />

        <RemplacementsCarte
          remplacements={remplacements}
          loading={remplacementsLoading}
          error={remplacementsError}
          onReload={() => void reloadRemplacements()}
          emetteur={emetteurInfo}
          filtreAdresseInitial={adresseFocus}
          filtreTriInitial={triFocus || undefined}
          filtreRecordInitial={recordFocus}
          filtreEpingleInitial={epingleFocus}
          filtreMoisInitial={moisRempFocus}
          filtreFaibleInitial={faibleFocus}
          onRenvoyerDerniere={handleRenvoyerDernierePiece}
        />

        {apercu.length > 0 && (
          <div className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-background-200">
              <h3 className="font-heading font-semibold text-sm text-foreground-950">Aperçu du journal</h3>
              <span className="text-[11px] text-foreground-500">
                {totaux.nbDevis + totaux.nbFactures + totaux.nbPaiements} ligne(s) · les 10 premières
              </span>
            </div>
            <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-2.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide bg-background-200/50">
              <span className="col-span-2">Date</span>
              <span className="col-span-2">Type</span>
              <span className="col-span-2">Numéro</span>
              <span className="col-span-3">Client</span>
              <span className="col-span-2 text-right">Montant TTC</span>
              <span className="col-span-1 text-right">Statut</span>
            </div>
            {apercu.map((l, i) => (
              <div
                key={`${l.type}-${l.numero}-${i}`}
                className="grid grid-cols-1 lg:grid-cols-12 gap-1 lg:gap-3 px-5 py-3 border-t border-background-200 text-sm"
              >
                <span className="lg:col-span-2 text-foreground-600">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    Date
                  </span>
                  {l.date || "—"}
                </span>
                <span className="lg:col-span-2">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    Type
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      l.type === "Paiement"
                        ? "bg-accent-100 text-accent-700"
                        : l.type === "Devis"
                          ? "bg-secondary-100 text-secondary-700"
                          : "bg-primary-100 text-primary-700"
                    }`}
                  >
                    <i
                      className={
                        l.type === "Paiement"
                          ? "ri-bank-card-line"
                          : l.type === "Devis"
                            ? "ri-file-text-line"
                            : "ri-receipt-line"
                      }
                    ></i>
                    {l.type}
                  </span>
                </span>
                <span className="lg:col-span-2 text-foreground-800 font-medium">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    Numéro
                  </span>
                  {l.numero}
                </span>
                <span className="lg:col-span-3 text-foreground-700 truncate">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    Client
                  </span>
                  {l.client || "Sans client"}
                </span>
                <span className="lg:col-span-2 text-foreground-950 font-semibold lg:text-right">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    Montant
                  </span>
                  {l.type === "Devis" ? `${formatEuros(l.ttc)} (devis)` : formatEuros(l.ttc)}
                </span>
                <span className="lg:col-span-1 text-foreground-500 lg:text-right text-xs">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    Statut
                  </span>
                  {l.statut}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DataState>
  );
}