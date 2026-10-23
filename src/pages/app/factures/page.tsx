import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useArtisanData, type FactureItem } from "@/hooks/useArtisanData";
import { createAvoirFromFacture, createFactureFromDevis, createFactureFromModele, createFactureModeleFromFacture, createRelance, deleteFacture, deleteFactureModele, duplicateFacture, fetchDevisLignes, setFactureModeleArchive, updateFactureDatePaiement, updateFactureModele, updateFactureStatut, type FactureModele } from "@/lib/artisanApi";
import { FACTURE_STATUTS, FACTURE_STATUTS_FORM, canalIcon, factureIsAvoir, factureStatusTone } from "@/lib/statuts";
import { formatEuros } from "@/lib/format";
import { formatShortDate, todayISO } from "@/lib/dates";
import { toCsv, downloadCsv } from "@/lib/csv";
import { type TriFacture, parseTriFacture, triFactureLabel } from "@/lib/facturesTri";
import { lireFiltresFactures, memoriserFiltresFactures, effacerFiltresFactures } from "@/lib/facturesFiltresMemoire";
import { ajouterLienCopie } from "@/lib/liensCopiesMemoire";
import { buildDocumentPdf, pdfToBase64 } from "@/lib/pdf";
import { statutJuridiqueLabel } from "@/lib/entreprise";
import { styleDocumentsDepuisProfil } from "@/lib/documentStyle";
import { mentionsEfactureProfil } from "@/lib/factureElectronique";
import { updateEfactureStatut } from "@/lib/factureElectroniqueApi";
import { sendFactureEmail, sendRelanceEmail } from "@/lib/email";
import { fetchDevisSignature } from "@/lib/signature";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import SampleDataButton from "@/pages/app/components/SampleDataButton";
import Modal from "@/pages/app/components/Modal";
import StatutBadge from "@/pages/app/components/StatutBadge";
import GenererFactureModal from "@/pages/app/factures/components/GenererFactureModal";
import GenererFactureModeleModal from "@/pages/app/factures/components/GenererFactureModeleModal";
import EnregistrerFactureModeleModal from "@/pages/app/factures/components/EnregistrerFactureModeleModal";
import { useFactureModeles } from "@/hooks/useFactureModeles";
import FactureLignesModal from "@/pages/app/factures/components/FactureLignesModal";
import FacturesSortBar from "@/pages/app/factures/components/FacturesSortBar";
import BadgeVuePartagee from "@/pages/app/components/BadgeVuePartagee";
import BoutonEpinglerVue from "@/pages/app/components/BoutonEpinglerVue";
import BoutonPartager from "@/pages/app/components/BoutonPartager";
import MenuVuesPartageesRecentes from "@/pages/app/components/MenuVuesPartageesRecentes";
import RechercheRepliable from "@/components/feature/RechercheRepliable";
import ApercuPdfModal from "@/components/feature/ApercuPdfModal";
import Infobulle from "@/components/base/Infobulle";
import EncartAide from "@/components/base/EncartAide";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import RappelAstucePage from "@/components/base/RappelAstucePage";
import { guidePremiereVisiteVu, marquerGuidePremiereVisiteVu } from "@/lib/guidePremiereVisite";
import { originePublique } from "@/lib/site";

const PERIODES = ["Tout", "Ce mois", "Ce trimestre", "Cette année", "Personnalisé"] as const;
const DOC_TYPES = ["Factures", "Avoirs", "Tous"] as const;

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

function formatDayFr(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function envoiTypeLabel(type: string): string {
  if (type === "relance") return "Relance";
  if (type === "devis") return "Devis";
  return "Facture";
}

export default function AppFactures() {
  usePageMeta("Factures · ArtiFlow-pro", "Générez et suivez les factures de vos devis signés.");
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, error, devis, clients, factures, envois, reload } = useArtisanData();

  // Filtres de la vue, mémorisés dans l'URL (?statut=, ?type=, ?periode=, ?debut=, ?fin=, ?q=, ?tri=)
  // pour rendre la vue filtrée partageable et la restituer au rechargement.
  const [searchParams, setSearchParams] = useSearchParams();
  // Indicateur « vue partagée » : vrai quand l'adresse contient des filtres (vue reçue via un lien partagé).
  const aFiltresUrl = useMemo(
    () => ["statut", "type", "periode", "debut", "fin", "tri", "encaisser"].some((k) => searchParams.has(k)),
    [searchParams],
  );
  // Dernière vue mémorisée (statut, type, période, tri) : valeur par défaut quand l'URL ne porte aucun filtre.
  const memoFiltres = useMemo(lireFiltresFactures, []);
  const [statut, setStatut] = useState(() => {
    // Arrivée depuis la pastille d'échéances : on repart de « Toutes », sinon un statut mémorisé
    // (ex. « Payée ») viderait la liste des factures à encaisser.
    const s =
      searchParams.get("statut") ??
      (searchParams.get("encaisser") === "jour" ? "Toutes" : memoFiltres.statut);
    return s && ["Toutes", ...FACTURE_STATUTS].includes(s) ? s : "Toutes";
  });
  const [docType, setDocType] = useState<string>(() => {
    const t = searchParams.get("type") ?? memoFiltres.type;
    return t === "Avoirs" || t === "Tous" ? t : "Factures";
  });
  const [periode, setPeriode] = useState<string>(() => {
    const p = searchParams.get("periode") ?? memoFiltres.periode ?? "";
    return (PERIODES as readonly string[]).includes(p) ? p : "Tout";
  });
  const [customStart, setCustomStart] = useState(() => searchParams.get("debut") ?? "");
  const [customEnd, setCustomEnd] = useState(() => searchParams.get("fin") ?? "");
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  // Filtre « à encaisser » : posé par la pastille d'échéances du jour de la barre latérale.
  // Il ne garde que les factures impayées dont l'échéance est aujourd'hui ou déjà dépassée.
  const [encaisserJour, setEncaisserJour] = useState(() => searchParams.get("encaisser") === "jour");
  const [tri, setTri] = useState<TriFacture>(() => {
    // L'URL (lien partagé) prime ; sinon on restaure le tri de la dernière vue.
    const fromUrl = parseTriFacture(searchParams.get("tri"));
    if (fromUrl) return fromUrl;
    // Arrivée par la pastille « À encaisser aujourd'hui » : on propose d'emblée la facture
    // dont l'échéance est la plus ancienne, c'est celle qui appelle un règlement en premier.
    if (searchParams.get("encaisser") === "jour") return "echeance-asc";
    return parseTriFacture(memoFiltres.tri ?? null);
  });
  const [genOpen, setGenOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewFacture, setPreviewFacture] = useState<FactureItem | null>(null);
  const [emailingId, setEmailingId] = useState<number | null>(null);
  const [relancingId, setRelancingId] = useState<number | null>(null);
  // Facture électronique en cours de repassage en « Prête à transmettre » après correction.
  const [efBusyId, setEfBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FactureItem | null>(null);
  const [historyFacture, setHistoryFacture] = useState<FactureItem | null>(null);
  const [lignesFacture, setLignesFacture] = useState<FactureItem | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<FactureItem | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  // Modèles de factures réutilisables (trames) : génération depuis un modèle + enregistrement.
  const { modeles: modelesFacture, loading: loadingModelesFacture, reload: reloadModelesFacture } = useFactureModeles(
    user?.id ?? null,
  );
  const [genModeleOpen, setGenModeleOpen] = useState(false);
  const [modeleSaveTarget, setModeleSaveTarget] = useState<FactureItem | null>(null);
  const [savingModele, setSavingModele] = useState(false);
  const [modeleError, setModeleError] = useState<string | null>(null);

  // Guide de première visite : ouvert au premier passage sur la page Factures, puis
  // mémorisé une fois fermé par l'artisan. Réouvrable à tout moment via « Revoir le guide ».
  const [guideVisible, setGuideVisible] = useState(() => !guidePremiereVisiteVu("factures"));
  const fermerGuide = () => {
    marquerGuidePremiereVisiteVu("factures");
    setGuideVisible(false);
  };

  const invoicedDevisIds = useMemo(() => new Set(factures.map((f) => f.devis_id)), [factures]);
  const generatable = useMemo(
    () => devis.filter((d) => d.statut === "Signé" && !invoicedDevisIds.has(d.id)),
    [devis, invoicedDevisIds],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const range = periodRange(periode);
    return factures.filter((f) => {
      const matchStatut = statut === "Toutes" || f.statut === statut;
      const isAvoir = factureIsAvoir(f.numero);
      const matchType = docType === "Tous" || (docType === "Avoirs" ? isAvoir : !isAvoir);
      const matchEncaisser =
        !encaisserJour ||
        (f.statut !== "Payée" && Boolean(f.date_echeance) && String(f.date_echeance) <= todayISO());
      let matchPeriode = true;
      if (periode === "Personnalisé") {
        const d = new Date(f.date_emission ?? f.created_at);
        const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
        const end = customEnd ? new Date(`${customEnd}T23:59:59`) : null;
        matchPeriode =
          !Number.isNaN(d.getTime()) && (start === null || d >= start) && (end === null || d <= end);
      } else if (range) {
        const d = new Date(f.date_emission ?? f.created_at);
        matchPeriode = !Number.isNaN(d.getTime()) && d >= range.start && d < range.end;
      }
      const matchQuery =
        !q ||
        f.numero.toLowerCase().includes(q) ||
        (f.clientNom ?? "").toLowerCase().includes(q) ||
        (f.devisNumero ?? "").toLowerCase().includes(q) ||
        (f.objet ?? "").toLowerCase().includes(q);
      return matchStatut && matchType && matchPeriode && matchQuery && matchEncaisser;
    });
  }, [factures, statut, docType, query, periode, customStart, customEnd, encaisserJour]);

  // Liste affichée : même contenu que `filtered`, mais réordonné selon le tri actif (date, montant, client, échéance).
  const facturesAffichees = useMemo(() => {
    if (!tri) return filtered;
    const arr = [...filtered];
    const dateVal = (f: FactureItem) => {
      const t = new Date(f.date_emission ?? f.created_at).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    if (tri === "date-desc") arr.sort((a, b) => dateVal(b) - dateVal(a));
    else if (tri === "date-asc") arr.sort((a, b) => dateVal(a) - dateVal(b));
    else if (tri === "montant-desc") arr.sort((a, b) => Number(b.total_ttc || 0) - Number(a.total_ttc || 0));
    else if (tri === "montant-asc") arr.sort((a, b) => Number(a.total_ttc || 0) - Number(b.total_ttc || 0));
    else if (tri === "client-asc" || tri === "client-desc") {
      arr.sort((a, b) => {
        const cmp = (a.clientNom ?? "").localeCompare(b.clientNom ?? "", "fr", { sensitivity: "base" });
        return tri === "client-asc" ? cmp : -cmp;
      });
    } else if (tri === "echeance-asc") {
      const ech = (f: FactureItem) => {
        const t = new Date(f.date_echeance ?? "").getTime();
        return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
      };
      arr.sort((a, b) => ech(a) - ech(b));
    }
    return arr;
  }, [filtered, tri]);

  // Factures rejetées présentes dans la vue courante : on les remonte en tête de page
  // pour que le motif à corriger soit visible sans quitter la liste.
  const facturesRejeteesAffichees = useMemo(
    () => facturesAffichees.filter((f) => f.efacture_statut === "rejetee"),
    [facturesAffichees],
  );

  const stats = useMemo(() => {
    const total = factures.reduce((sum, f) => sum + Number(f.total_ttc || 0), 0);
    const encaisse = factures.filter((f) => f.statut === "Payée").reduce((sum, f) => sum + Number(f.total_ttc || 0), 0);
    return { total, encaisse, attente: total - encaisse };
  }, [factures]);

  const avoirsStats = useMemo(() => {
    const list = factures.filter((f) => factureIsAvoir(f.numero));
    const total = list.reduce((sum, f) => sum + Number(f.total_ttc || 0), 0);
    return { count: list.length, total };
  }, [factures]);

  const envoiCountByFacture = useMemo(() => {
    const map = new Map<number, number>();
    envois.forEach((e) => {
      if (e.facture_id !== null) map.set(e.facture_id, (map.get(e.facture_id) ?? 0) + 1);
    });
    return map;
  }, [envois]);

  const historyEnvois = useMemo(
    () => (historyFacture ? envois.filter((e) => e.facture_id === historyFacture.id) : []),
    [historyFacture, envois],
  );

  // Synchronise la recherche texte avec l'URL (?q=) : utile au retour arrière/navigation dans l'historique.
  useEffect(() => {
    const qUrl = searchParams.get("q") ?? "";
    setQuery((prev) => (prev === qUrl ? prev : qUrl));
  }, [searchParams]);

  // Le paramètre ?encaisser=jour peut être posé sans remonter la page : c'est le cas de l'onglet
  // Factures de la barre mobile, qui pointe directement vers la liste filtrée. On aligne donc
  // l'état dès que l'URL change, en gardant un tri déjà choisi exprès par l'artisan.
  const encaisserUrl = searchParams.get("encaisser") === "jour";
  useEffect(() => {
    setEncaisserJour(encaisserUrl);
    if (encaisserUrl) {
      setStatut("Toutes");
      setTri((prev) => prev || "echeance-asc");
    }
  }, [encaisserUrl]);

  // Mémorise la vue courante (statut, type, période, tri) pour la restaurer automatiquement au retour sur la page.
  useEffect(() => {
    memoriserFiltresFactures({ statut, type: docType, periode, tri });
  }, [statut, docType, periode, tri]);

  // Construit les paramètres d'URL de la vue filtrée courante (filtres + tri + recherche), avec surcharge ponctuelle.
  const buildParams = (
    override: Partial<{
      statut: string;
      type: string;
      periode: string;
      tri: TriFacture;
      q: string;
      debut: string;
      fin: string;
      encaisser: string;
    }> = {},
  ) => {
    const s = override.statut ?? statut;
    const ty = override.type ?? docType;
    const pe = override.periode ?? periode;
    const t = override.tri ?? tri;
    const q = override.q ?? query;
    const debut = override.debut ?? customStart;
    const fin = override.fin ?? customEnd;
    const enc = override.encaisser ?? (encaisserJour ? "jour" : "");
    const p = new URLSearchParams();
    if (s && s !== "Toutes") p.set("statut", s);
    if (ty && ty !== "Factures") p.set("type", ty);
    if (pe === "Personnalisé") {
      p.set("periode", pe);
      if (debut) p.set("debut", debut);
      if (fin) p.set("fin", fin);
    } else if (pe && pe !== "Tout") {
      p.set("periode", pe);
    }
    if (t) p.set("tri", t);
    if (q.trim()) p.set("q", q);
    if (enc) p.set("encaisser", enc);
    return p;
  };

  // Chemin interne de la vue courante (filtres + recherche), pour le bouton « Partager » de l'en-tête.
  const qsPartage = buildParams().toString();
  const cheminPartage = `${location.pathname}${qsPartage ? `?${qsPartage}` : ""}`;

  // Applique le tri actif et le mémorise dans l'URL (?tri=) pour le conserver au rechargement et le partager.
  const applyTri = (next: TriFacture) => {
    setTri(next);
    setSearchParams(buildParams({ tri: next }), { replace: true });
  };

  // Construit et copie un lien partageable de la vue filtrée (statut + type + période + tri + recherche).
  const copyFacturesLink = async () => {
    const qs = buildParams().toString();
    const url = `${originePublique()}${window.location.pathname}${qs ? `?${qs}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      ajouterLienCopie("Vue filtrée · factures", url);
      setActionNotice("Lien filtré copié : partagez-le pour ouvrir la même vue des factures.");
    } catch {
      setActionNotice("Copie automatique impossible : l'adresse de la page contient déjà vos filtres.");
    }
  };

  // Réinitialise d'un coup les filtres et le tri, et nettoie l'URL (la recherche garde son propre bouton d'effacement).
  const resetFacturesFilters = () => {
    setStatut("Toutes");
    setDocType("Factures");
    setPeriode("Tout");
    setCustomStart("");
    setCustomEnd("");
    setTri("");
    setEncaisserJour(false);
    setSearchParams(
      buildParams({
        statut: "Toutes",
        type: "Factures",
        periode: "Tout",
        tri: "",
        debut: "",
        fin: "",
        encaisser: "",
      }),
      { replace: true },
    );
    setActionNotice("Filtres réinitialisés.");
  };


  // Oublie la dernière vue mémorisée : on efface la mémoire ET on repart des filtres par défaut,
  // pour que le prochain retour sur la page ne restaure plus cette vue.
  const oublierVueFactures = () => {
    effacerFiltresFactures();
    setStatut("Toutes");
    setDocType("Factures");
    setPeriode("Tout");
    setCustomStart("");
    setCustomEnd("");
    setTri("");
    setEncaisserJour(false);
    setSearchParams(
      buildParams({
        statut: "Toutes",
        type: "Factures",
        periode: "Tout",
        tri: "",
        debut: "",
        fin: "",
        encaisser: "",
      }),
      { replace: true },
    );
    setActionNotice("Dernière vue des factures oubliée : les filtres par défaut seront rechargés au prochain retour.");
  };

  const handleGenerate = async (devisId: number, echeanceJours = 30) => {
    if (!user) return;
    const source = devis.find((d) => d.id === devisId);
    if (!source) return;
    setBusy(true);
    setActionError(null);
    try {
      await createFactureFromDevis(
        user.id,
        {
          id: source.id,
          client_id: source.client_id,
          numero: source.numero,
          total_ht: source.total_ht,
          total_ttc: source.total_ttc,
        },
        echeanceJours,
      );
      setGenOpen(false);
      await reload();
    } catch {
      setActionError("La génération de la facture a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const handleStatut = async (id: number, value: string) => {
    setActionError(null);
    try {
      await updateFactureStatut(id, value);
      await reload();
    } catch {
      setActionError("La mise à jour du statut a échoué.");
    }
  };

  /**
   * Repasse une facture rejetée en « Prête à transmettre » d'un seul clic, une fois ses
   * données corrigées. Le motif de rejet est effacé par la mise à jour elle-même : plus
   * besoin de repasser par le menu de statut du registre.
   */
  const handleRepasserPrete = async (f: FactureItem) => {
    setActionError(null);
    setActionNotice(null);
    setEfBusyId(f.id);
    try {
      await updateEfactureStatut(f.id, "preparee");
      await reload();
      setActionNotice(
        `${f.numero} repassée en « Prête à transmettre » : le motif de rejet est effacé, il ne reste plus qu'à la transmettre depuis le registre.`,
      );
    } catch {
      setActionError("La mise à jour de l'étape électronique a échoué.");
    } finally {
      setEfBusyId(null);
    }
  };

  // Enregistre la date de règlement réelle (modifiable une fois la facture payée),
  // pour dater précisément chaque encaissement dans le journal comptable.
  const handleDatePaiement = async (id: number, value: string) => {
    setActionError(null);
    try {
      await updateFactureDatePaiement(id, value || null);
      await reload();
    } catch {
      setActionError("La mise à jour de la date de règlement a échoué.");
    }
  };

  const handleRelance = async (f: FactureItem) => {
    if (!f.devis_id) {
      setActionError("Cette facture n'est liée à aucun devis.");
      return;
    }
    setActionError(null);
    setActionNotice(null);
    setRelancingId(f.id);
    try {
      const echeance = f.date_echeance ? ` (échéance du ${formatShortDate(f.date_echeance)})` : "";
      const message = `Bonjour${f.clientNom ? ` ${f.clientNom}` : ""}, nous vous rappelons que la facture ${f.numero} d'un montant de ${formatEuros(
        f.total_ttc,
      )} reste en attente de règlement${echeance}. Merci de bien vouloir procéder au paiement.`;
      const relanceId = await createRelance({ devis_id: f.devis_id, canal: "Email", message, date_prevue: todayISO() });
      let pdfBase64 = "";
      try {
        const doc = await buildFacturePdf(f);
        pdfBase64 = pdfToBase64(doc);
      } catch {
        /* le PDF est facultatif : la relance part quand même */
      }
      try {
        await sendRelanceEmail(relanceId, pdfBase64, `${f.numero}.pdf`);
        setActionNotice(`Relance de la facture ${f.numero} envoyée par email avec la facture en pièce jointe.`);
        await reload();
      } catch (sendErr) {
        const detail = sendErr instanceof Error ? sendErr.message : "";
        setActionNotice(
          `Relance enregistrée pour la facture ${f.numero}. ${
            detail || "Activez Resend (clé API + domaine) pour que l'envoi automatique fonctionne."
          }`,
        );
      }
    } catch {
      setActionError("La création de la relance a échoué.");
    } finally {
      setRelancingId(null);
    }
  };

  const handleExportCsv = () => {
    const formatMontant = (v: number) => Number(v || 0).toFixed(2).replace(".", ",");
    const rows: (string | number)[][] = filtered.map((f) => [
      f.numero,
      f.clientNom ?? "",
      f.devisNumero ?? "",
      f.objet ?? "",
      formatMontant(Number(f.total_ht || 0)),
      formatMontant(Number(f.total_ttc || 0)),
      f.statut,
      f.date_emission ? formatShortDate(f.date_emission) : "",
      f.date_echeance ? formatShortDate(f.date_echeance) : "",
      f.statut === "Payée" && f.date_paiement ? formatShortDate(f.date_paiement) : "",
    ]);

    const totalHT = filtered.reduce((sum, f) => sum + Number(f.total_ht || 0), 0);
    const totalTTC = filtered.reduce((sum, f) => sum + Number(f.total_ttc || 0), 0);
    const countByStatut = FACTURE_STATUTS_FORM.map((s) => ({
      statut: s,
      count: filtered.filter((f) => f.statut === s).length,
    }));

    rows.push([]);
    rows.push(["Récapitulatif (filtré)", "", "", "", "", "", "", "", ""]);
    // La colonne de tri active est mémorisée dans le fichier pour retrouver la vue telle quelle.
    rows.push(["Tri appliqué", "", "", triFactureLabel(tri) || "Aucun (ordre par défaut)"]);
    rows.push(["Nombre de factures", String(filtered.length)]);
    countByStatut.forEach((c) => rows.push([`  · ${c.statut}`, String(c.count)]));
    rows.push(["Total HT", "", "", "", formatMontant(totalHT)]);
    rows.push(["Total TTC", "", "", "", "", formatMontant(totalTTC)]);

    const csv = toCsv(
      ["Numéro", "Client", "Devis", "Objet", "Montant HT", "Montant TTC", "Statut", "Émission", "Échéance", "Réglée le"],
      rows,
    );
    const suffixeTri = tri ? `-tri-${tri}` : "";
    downloadCsv(`factures-artiflow-${todayISO()}${suffixeTri}.csv`, csv);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setActionError(null);
    try {
      await deleteFacture(pendingDelete.id);
      setPendingDelete(null);
      await reload();
    } catch {
      setActionError("La suppression a échoué.");
    }
  };

  const buildFacturePdf = async (f: FactureItem) => {
    // On privilégie la copie figée des lignes stockée sur la facture ;
    // on retombe sur le devis uniquement pour les factures créées avant cette copie.
    const lignes =
      f.lignes && f.lignes.length > 0 ? f.lignes : f.devis_id ? await fetchDevisLignes(f.devis_id) : [];
    const client = clients.find((c) => c.id === f.client_id) ?? null;
    const signatureInfo = f.devis_id ? await fetchDevisSignature(f.devis_id) : null;
    return buildDocumentPdf({
      type: "facture",
      numero: f.numero,
      dateLabel: formatShortDate(f.date_emission),
      statut: f.statut,
      objet: f.objet ?? "",
      emetteur: {
        entreprise: profile?.entreprise ?? "",
        metier: profile?.metier ?? "",
        telephone: profile?.telephone ?? "",
        email: profile?.email ?? user?.email ?? "",
        logo: profile?.logo_url ?? null,
        formeJuridique: statutJuridiqueLabel(profile?.statut_juridique) || null,
        siret: profile?.siret ?? null,
        tva: profile?.tva ?? null,
        assurance: profile?.assurance ?? null,
        penalitesRetard: profile?.penalites_retard ?? null,
        escompte: profile?.efacture_escompte ?? null,
      },
      client: client
        ? { nom: client.nom, adresse: client.adresse, telephone: client.telephone, email: client.email }
        : f.clientNom
          ? { nom: f.clientNom }
          : null,
      lignes,
      totalHT: f.total_ht,
      totalTTC: f.total_ttc,
      echeanceLabel: f.date_echeance ? formatShortDate(f.date_echeance) : undefined,
      reference: f.devisNumero ?? undefined,
      style: {
        ...styleDocumentsDepuisProfil(profile),
        mentionElectronique: true,
        mentionsSupplementaires: mentionsEfactureProfil(profile),
      },
      signature: signatureInfo?.signed_at
        ? {
            nom: signatureInfo.signataire_nom ?? client?.nom ?? "Client",
            dateLabel: formatShortDate(signatureInfo.signed_at),
            image: signatureInfo.signature_image,
          }
        : null,
    });
  };

  const handleDownload = (f: FactureItem) => {
    // Ouvre l'aperçu AVANT téléchargement : on repère ainsi un souci de mise en page
    // (largeur de colonne, texte coupé…) directement à l'écran, puis on enregistre depuis l'aperçu.
    setActionError(null);
    setPreviewFacture(f);
  };

  const handleEmail = async (f: FactureItem) => {
    setActionError(null);
    setActionNotice(null);
    const client = clients.find((c) => c.id === f.client_id) ?? null;
    if (!client?.email) {
      setActionError("Ce client n'a pas d'adresse email. Ajoutez-la dans sa fiche pour envoyer la facture.");
      return;
    }
    setEmailingId(f.id);
    try {
      const doc = await buildFacturePdf(f);
      await sendFactureEmail(f.id, pdfToBase64(doc), `${f.numero}.pdf`);
      setActionNotice(`Facture ${f.numero} envoyée à ${client.email} avec le PDF en pièce jointe.`);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "L'envoi de la facture a échoué.");
    } finally {
      setEmailingId(null);
    }
  };

  const handleDuplicate = async (f: FactureItem, mode: "facture" | "avoir") => {
    if (!user) return;
    setActionError(null);
    setActionNotice(null);
    setDuplicating(true);
    try {
      const lignes =
        f.lignes && f.lignes.length > 0 ? f.lignes : f.devis_id ? await fetchDevisLignes(f.devis_id) : [];
      const source = {
        devis_id: f.devis_id,
        client_id: f.client_id,
        total_ht: f.total_ht,
        total_ttc: f.total_ttc,
        lignes,
      };
      if (mode === "avoir") {
        await createAvoirFromFacture(user.id, source);
        setActionNotice(`Avoir créé à partir de la facture ${f.numero}.`);
      } else {
        await duplicateFacture(user.id, source);
        setActionNotice(`Facture dupliquée à partir de ${f.numero}.`);
      }
      setDuplicateTarget(null);
      await reload();
    } catch {
      setActionError(mode === "avoir" ? "La création de l'avoir a échoué." : "La duplication de la facture a échoué.");
    } finally {
      setDuplicating(false);
    }
  };

  // Enregistre une facture comme modèle de facture réutilisable.
  const handleSaveFactureModele = async (nom: string) => {
    if (!user || !modeleSaveTarget) return;
    setSavingModele(true);
    setModeleError(null);
    try {
      await createFactureModeleFromFacture(user.id, modeleSaveTarget.id, nom);
      setModeleSaveTarget(null);
      setActionNotice(`Modèle « ${nom} » enregistré. Réutilisez-le pour vos prochaines factures.`);
      await reloadModelesFacture();
    } catch {
      setModeleError("L'enregistrement du modèle a échoué. Réessayez.");
    } finally {
      setSavingModele(false);
    }
  };

  // Génère une facture à partir d'un modèle de facture.
  const handleGenerateFromModele = async (modele: FactureModele, clientId: number | null, echeanceJours: number) => {
    if (!user) return;
    setBusy(true);
    setActionError(null);
    try {
      await createFactureFromModele(user.id, { objet: modele.objet, lignes: modele.lignes }, clientId, echeanceJours);
      setGenModeleOpen(false);
      setActionNotice(`Facture générée depuis le modèle « ${modele.nom} ».`);
      await reload();
    } catch {
      setActionError("La génération de la facture à partir du modèle a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteModele = async (modele: FactureModele) => {
    setModeleError(null);
    try {
      await deleteFactureModele(modele.id);
      await reloadModelesFacture();
    } catch {
      setActionError("La suppression du modèle a échoué.");
    }
  };

  const handleArchiveModele = async (modele: FactureModele, archive: boolean) => {
    setModeleError(null);
    try {
      await setFactureModeleArchive(modele.id, archive);
      await reloadModelesFacture();
    } catch {
      setActionError("La mise à jour du modèle a échoué.");
    }
  };

  const handleRenommerModele = async (modele: FactureModele, nom: string) => {
    setModeleError(null);
    try {
      await updateFactureModele(modele.id, { nom, objet: modele.objet, lignes: modele.lignes });
      await reloadModelesFacture();
    } catch {
      setActionError("Le renommage du modèle a échoué.");
    }
  };

  if (!loading && !error && factures.length === 0) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon="ri-receipt-line"
          title="Aucune facture pour l'instant"
          text="Une facture se génère à partir d'un devis signé. Signez un devis, puis générez la facture correspondante en un clic."
        >
          <div className="flex flex-col items-center gap-3">
            {generatable.length > 0 ? (
              <button
                type="button"
                onClick={() => setGenOpen(true)}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-add-line"></i> Générer depuis un devis signé
              </button>
            ) : (
              <SampleDataButton onSeeded={reload} />
            )}
            <span className="text-xs text-foreground-400">
              {generatable.length > 0
                ? `${generatable.length} devis signé(s) prêt(s) à facturer.`
                : "Chargez des exemples pour voir la facturation à l'œuvre."}
            </span>
          </div>
        </EmptyState>
        {genOpen && (
          <GenererFactureModal devis={generatable} busy={busy} onGenerate={handleGenerate} onClose={() => setGenOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <DataState loading={loading} error={error} onRetry={reload}>
      <div className="flex flex-col gap-5 animate-fade-in">
        {guideVisible && (
          <GuidePremiereVisite
            titre="Bienvenue : créez vos premières factures"
            sousTitre="Voici, en 4 étapes, comment transformer un devis signé en facture, l'envoyer et vous faire payer. Rien n'est engagé tant que votre client n'a pas signé."
            etapes={[
              {
                icone: "ri-file-check-line",
                titre: "Un devis signé d'abord",
                texte:
                  "Une facture naît toujours d'un devis signé. Signez un devis, il apparaîtra alors comme « à facturer ».",
              },
              {
                icone: "ri-add-line",
                titre: "Générez la facture",
                texte:
                  "Cliquez « Générer une facture » et choisissez le devis : les lignes et les montants sont repris tout seuls.",
              },
              {
                icone: "ri-mail-send-line",
                titre: "Envoyez-la au client",
                texte:
                  "Bouton « Envoyer » : la facture part par email avec le PDF en pièce jointe. Ou téléchargez-la pour l'imprimer.",
              },
              {
                icone: "ri-money-euro-circle-line",
                titre: "Encaissez puis relancez",
                texte:
                  "Réglée ? Passez le statut sur « Payée » et indiquez la date. Sinon, cliquez « Relancer » pour un rappel courtois.",
              },
            ]}
            note="Ce guide ne s'affiche qu'une seule fois. Vous pouvez le revoir à tout moment avec « Revoir le guide des factures »."
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
            Revoir le guide des factures
          </button>
        )}

        <Link
          to="/app/facturation-electronique"
          className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary-100 border border-primary-200 text-primary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-200 transition-colors"
        >
          <i className="ri-file-code-line"></i>
          Facturation électronique : préparer et suivre mes factures
        </Link>

        {facturesRejeteesAffichees.length > 0 && (
          <div className="flex flex-col gap-2 p-4 rounded-lg bg-accent-50 border border-accent-200 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-accent-900 inline-flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i>
                {facturesRejeteesAffichees.length} facture{facturesRejeteesAffichees.length > 1 ? "s" : ""} rejetée
                {facturesRejeteesAffichees.length > 1 ? "s" : ""} dans cette vue : corrigez les données puis retransmettez.
              </p>
              <Link
                to="/app/facturation-electronique?statut=rejetee"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap hover:bg-secondary-600 transition-colors"
              >
                <i className="ri-send-plane-line"></i>
                Retransmettre
              </Link>
            </div>
            <ul className="flex flex-col gap-1">
              {facturesRejeteesAffichees.map((f) => (
                <li
                  key={f.id}
                  className="text-[11px] text-foreground-700 flex flex-wrap items-center gap-1.5"
                >
                  <span className="font-semibold text-foreground-950">{f.numero}</span>
                  <span className="text-foreground-500">{f.clientNom ?? "Sans client"}</span>
                  <span className="text-foreground-400">·</span>
                  <span className="break-words min-w-0">
                    {f.efacture_motif ? `Motif : ${f.efacture_motif}` : "Aucun motif enregistré"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRepasserPrete(f)}
                    disabled={efBusyId === f.id}
                    title="La facture repasse directement en « Prête à transmettre » et le motif de rejet est effacé."
                    className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-50 border border-accent-300 text-accent-900 text-[10px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-100 transition-colors disabled:opacity-60"
                  >
                    {efBusyId === f.id ? (
                      <i className="ri-loader-4-line animate-spin"></i>
                    ) : (
                      <i className="ri-check-double-line"></i>
                    )}
                    Repasser prête
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-background-100 border border-background-200">
            <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Total facturé</p>
            <p className="mt-1 font-heading font-bold text-xl text-foreground-950">{formatEuros(stats.total)}</p>
          </div>
          <div className="p-4 rounded-lg bg-accent-50 border border-accent-200">
            <p className="text-[11px] font-semibold text-accent-700 uppercase tracking-wide">Encaissé</p>
            <p className="mt-1 font-heading font-bold text-xl text-foreground-950">{formatEuros(stats.encaisse)}</p>
          </div>
          <div className="p-4 rounded-lg bg-secondary-50 border border-secondary-200">
            <p className="text-[11px] font-semibold text-secondary-700 uppercase tracking-wide">En attente</p>
            <p className="mt-1 font-heading font-bold text-xl text-foreground-950">{formatEuros(stats.attente)}</p>
          </div>
        </div>

        {/* Encart « comment faire » : guider pas à pas la facturation et la relance des impayés. */}
        <EncartAide
          ton="primary"
          icone="ri-receipt-line"
          titre="Comment faire une facture ?"
          etapes={[
            "Signez d'abord un devis : une facture naît toujours d'un devis signé.",
            "Cliquez « Générer une facture » et choisissez le devis à facturer : les lignes sont reprises toutes seules.",
            "Envoyez-la au client (bouton « Envoyer ») avec le PDF en pièce jointe, ou téléchargez-la pour l'imprimer.",
            "Pas encore payée ? Cliquez « Relancer » : un rappel courtois part avec la facture rappelée en pièce jointe.",
          ]}
          note="Quand la facture est réglée, passez son statut sur « Payée » et indiquez la date de règlement : cette date sert ensuite au journal comptable."
        />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto">
          <RechercheRepliable
            carteId="factures"
            carteLabel="Factures"
            value={query}
            onChange={(value) => {
              setQuery(value);
              setSearchParams(buildParams({ q: value }), { replace: true });
            }}
            placeholder="Rechercher une facture, un client…"
            conteneurClassName="w-full md:w-72"
          />
          {aFiltresUrl && (
            <>
              <BadgeVuePartagee />
              <BoutonEpinglerVue label="Factures · vue partagée" />
            </>
          )}
          <MenuVuesPartageesRecentes basePath="/app/factures" />
          <BoutonPartager
            label="Vue filtrée · factures"
            chemin={cheminPartage}
            title="Partager la vue courante des factures"
            align="left"
          />
          </div>
          <Infobulle
            contenu="Télécharger la liste des factures affichées dans un fichier tableur (pour archiver ou ouvrir dans Excel)."
            position="bas"
            largeur={260}
          >
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exporter les factures au format CSV"
            >
              <i className="ri-file-excel-2-line"></i>
              <span className="hidden sm:inline">Exporter CSV</span>
            </button>
          </Infobulle>
          <Infobulle
            contenu="Créer une facture à partir d'un devis signé : les lignes et les montants sont repris automatiquement."
            position="bas"
            largeur={280}
          >
            <button
              type="button"
              onClick={() => setGenOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-add-line"></i>
              Générer une facture
            </button>
          </Infobulle>
          <Infobulle
            contenu="Générer une facture à partir d'un modèle réutilisable (une trame que vous avez enregistrée depuis une facture)."
            position="bas"
            largeur={280}
          >
            <button
              type="button"
              onClick={() => {
                setModeleError(null);
                setGenModeleOpen(true);
              }}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
            >
              <i className="ri-bookmark-line"></i>
              Depuis un modèle
              {modelesFacture.filter((m) => !m.archive).length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-secondary-500 text-background-50 text-[10px] font-bold">
                  {modelesFacture.filter((m) => !m.archive).length}
                </span>
              )}
            </button>
          </Infobulle>
        </div>

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

        <div className="flex flex-wrap items-center gap-2">
          <Infobulle
            contenu="Choisir ce que la liste affiche : vos factures, vos avoirs (notes de crédit qui viennent en déduction), ou les deux à la fois."
            position="bas"
            largeur={280}
          >
            <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:text-accent-700 cursor-help">
              <i className="ri-information-line text-sm"></i>
            </span>
          </Infobulle>
          <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
          {DOC_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setDocType(t);
                setSearchParams(buildParams({ type: t }), { replace: true });
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                docType === t ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i
                className={
                  t === "Avoirs" ? "ri-refund-2-line" : t === "Factures" ? "ri-receipt-line" : "ri-file-list-3-line"
                }
              ></i>
              {t}
              {t === "Avoirs" && avoirsStats.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    docType === t ? "bg-background-50/25" : "bg-background-200 text-foreground-600"
                  }`}
                >
                  {avoirsStats.count}
                </span>
              )}
            </button>
          ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Infobulle
            contenu="Filtrer la liste par statut. Émise = partie chez le client, en attente de règlement ; Payée = l'argent a été encaissé ; En retard = l'échéance est dépassée et le paiement n'est pas arrivé. « Toutes » les affiche toutes."
            position="bas"
            largeur={320}
          >
            <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:text-accent-700 cursor-help">
              <i className="ri-information-line text-sm"></i>
            </span>
          </Infobulle>
          <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
          {FACTURE_STATUTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatut(s);
                setSearchParams(buildParams({ statut: s }), { replace: true });
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                statut === s ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {s}
            </button>
          ))}
          <span className="w-px self-stretch bg-background-200 mx-1" aria-hidden="true"></span>
          <button
            type="button"
            onClick={() => {
              const next = !encaisserJour;
              setEncaisserJour(next);
              if (next) setStatut("Toutes");
              // À l'activation du filtre, on trie d'emblée par échéance la plus ancienne
              // (sauf si un tri a déjà été choisi exprès par l'artisan).
              const nextTri = next && !tri ? "echeance-asc" : tri;
              if (next && !tri) setTri("echeance-asc");
              setSearchParams(
                buildParams({
                  encaisser: next ? "jour" : "",
                  statut: next ? "Toutes" : statut,
                  tri: nextTri,
                }),
                { replace: true },
              );
            }}
            aria-pressed={encaisserJour}
            title="N'afficher que les factures encore impayées dont l'échéance est aujourd'hui ou déjà dépassée"
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
              encaisserJour ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
            }`}
          >
            <i className="ri-money-euro-circle-line"></i>
            À encaisser aujourd'hui
          </button>
          </div>
        </div>

        {docType === "Avoirs" && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-accent-50 border border-accent-200 animate-fade-in">
            <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <i className="ri-refund-2-line text-lg"></i>
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground-950">
                {avoirsStats.count} avoir{avoirsStats.count > 1 ? "s" : ""} émis
              </p>
              <p className="text-xs text-foreground-600">
                Notes de crédit pour un total de {formatEuros(Math.abs(avoirsStats.total))} · chacune téléchargeable en PDF.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Infobulle
            contenu="Limiter la liste à une période : ce mois-ci, ce trimestre, cette année, ou des dates précises (« Personnalisé »). Le filtre porte sur la date d'émission de la facture."
            position="bas"
            largeur={300}
          >
            <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:text-accent-700 cursor-help">
              <i className="ri-information-line text-sm"></i>
            </span>
          </Infobulle>
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
                setSearchParams(buildParams({ periode: p, debut: "", fin: "" }), { replace: true });
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                periode === p ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {p}
            </button>
          ))}
          </div>
        </div>

        {periode === "Personnalisé" && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 p-4 rounded-lg bg-background-100 border border-background-200 animate-fade-in">
            <div className="flex flex-col gap-1">
              <label htmlFor="factures-date-start" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Du
              </label>
              <input
                id="factures-date-start"
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setSearchParams(buildParams({ debut: e.target.value }), { replace: true });
                }}
                className="h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="factures-date-end" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Au
              </label>
              <input
                id="factures-date-end"
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setSearchParams(buildParams({ fin: e.target.value }), { replace: true });
                }}
                className="h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-transparent uppercase tracking-wide select-none" aria-hidden="true">
                Action
              </span>
              <button
                type="button"
                onClick={() => {
                  setCustomStart("");
                  setCustomEnd("");
                  setSearchParams(buildParams({ debut: "", fin: "" }), { replace: true });
                }}
                disabled={!customStart && !customEnd}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-close-circle-line"></i>
                Effacer les dates
              </button>
            </div>
            <p className="sm:ml-auto text-xs text-foreground-500">
              {customStart || customEnd
                ? `Sélection : ${filtered.length} facture${filtered.length > 1 ? "s" : ""}${
                    customStart ? ` · du ${formatDayFr(customStart)}` : ""
                  }${customEnd ? ` au ${formatDayFr(customEnd)}` : ""}`
                : "Choisissez une date de début et/ou de fin pour délimiter la période."}
            </p>
          </div>
        )}

        <FacturesSortBar tri={tri} onSort={applyTri} />

        {(statut !== "Toutes" || docType !== "Factures" || periode !== "Tout" || tri || encaisserJour) && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-lg bg-accent-50 border border-accent-200 animate-fade-in">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-800 whitespace-nowrap">
              <i className="ri-filter-3-line"></i>
              Vue filtrée · partageable
            </span>
            {aFiltresUrl && (
              <>
                <BadgeVuePartagee />
                <BoutonEpinglerVue label="Factures · vue partagée" />
              </>
            )}
            <span className="hidden sm:block w-px h-4 bg-accent-200" aria-hidden="true"></span>
            {docType !== "Factures" && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className="ri-file-list-3-line text-accent-600"></i>
                {docType}
              </span>
            )}
            {statut !== "Toutes" && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className="ri-filter-3-line text-accent-600"></i>
                {statut}
              </span>
            )}
            {periode !== "Tout" && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className="ri-calendar-2-line text-accent-600"></i>
                {periode}
              </span>
            )}
            {tri && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className="ri-sort-asc text-accent-600"></i>
                <span className="capitalize">{triFactureLabel(tri)}</span>
              </span>
            )}
            {encaisserJour && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className="ri-money-euro-circle-line text-accent-600"></i>
                À encaisser (échéance du jour ou dépassée)
              </span>
            )}
            <span className="text-[11px] text-foreground-500 whitespace-nowrap">
              {filtered.length} document{filtered.length > 1 ? "s" : ""} ·{" "}
              {formatEuros(filtered.reduce((s, f) => s + Number(f.total_ttc || 0), 0))} TTC
            </span>
            <div className="flex items-center gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={copyFacturesLink}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                title="Copier un lien partageable contenant le statut, le type, la période, le tri et la recherche"
              >
                <i className="ri-link"></i>
                Copier le lien
              </button>
              <button
                type="button"
                onClick={resetFacturesFilters}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                title="Retirer tous les filtres et le tri actif"
              >
                <i className="ri-filter-off-line"></i>
                Réinitialiser tous les filtres
              </button>
              <button
                type="button"
                onClick={oublierVueFactures}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                title="Oublier la dernière vue mémorisée des factures et repartir des filtres par défaut"
              >
                <i className="ri-eraser-line"></i>
                Oublier cette vue
              </button>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
          <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-3 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide bg-background-200/50">
            <span className="col-span-2">Facture</span>
            <span className="col-span-3">Client</span>
            <span className="col-span-1">Devis</span>
            <span className="col-span-2 text-right">Montant TTC</span>
            <span className="col-span-4 text-right">Statut / actions</span>
          </div>
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-foreground-500">
              {encaisserJour
                ? "Aucune facture impayée n'arrive à échéance aujourd'hui ou n'est déjà en retard. Tout est encaissé, bravo."
                : docType === "Avoirs"
                  ? "Aucun avoir ne correspond à votre recherche."
                  : "Aucune facture ne correspond à votre recherche."}
            </p>
          ) : (
            facturesAffichees.map((f) => (
              <div
                key={f.id}
                className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-3 px-5 py-4 border-t border-background-200 hover:bg-background-50 transition-colors"
              >
                <span className="lg:col-span-2 flex items-center gap-2 text-sm font-semibold text-foreground-900">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    Facture
                  </span>
                  <span
                    className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-md ${
                      factureIsAvoir(f.numero) ? "bg-accent-100 text-accent-700" : "bg-background-200 text-foreground-600"
                    }`}
                  >
                    <i className={`text-sm ${factureIsAvoir(f.numero) ? "ri-refund-2-line" : "ri-receipt-line"}`}></i>
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    {f.numero}
                    {factureIsAvoir(f.numero) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-100 text-accent-700 font-semibold uppercase tracking-wide">
                        Avoir
                      </span>
                    )}
                  </span>
                </span>
                <span className="lg:col-span-3 text-sm text-foreground-800">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    Client
                  </span>
                  {f.clientNom ?? "Sans client"}
                  <span className="block text-[11px] text-foreground-400 mt-0.5">
                    Émise le {formatShortDate(f.date_emission)} · échéance {formatShortDate(f.date_echeance)}
                  </span>
                  {f.statut === "Payée" && (
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-accent-700">
                      <i className="ri-checkbox-circle-line"></i>
                      Réglée le
                      <input
                        type="date"
                        value={f.date_paiement ?? ""}
                        onChange={(e) => handleDatePaiement(f.id, e.target.value)}
                        className="h-7 px-1.5 rounded-md bg-background-50 border border-accent-200 text-[11px] text-foreground-700 outline-none focus:border-accent-400 cursor-pointer"
                        title="Date réelle du règlement (utilisée dans le journal comptable)"
                        aria-label={`Date de règlement de la facture ${f.numero}`}
                      />
                    </span>
                  )}
                  {f.client_id && (
                    <button
                      type="button"
                      onClick={() => navigate(`/app/clients?client=${f.client_id}`)}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:text-primary-800 cursor-pointer whitespace-nowrap transition-colors"
                      title="Ouvrir la fiche complète du client"
                    >
                      <i className="ri-user-line"></i>
                      Voir le client
                    </button>
                  )}
                </span>
                <span className="lg:col-span-1 text-sm text-foreground-600">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    Devis
                  </span>
                  {f.devisNumero ?? "—"}
                </span>
                <span className="lg:col-span-2 text-sm font-semibold text-foreground-950 lg:text-right">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    Montant TTC
                  </span>
                  {formatEuros(f.total_ttc)}
                </span>
                <span className="lg:col-span-4 flex flex-wrap items-center gap-2 lg:justify-end">
                  <Infobulle
                    contenu="Changer l'état de cette facture en un clic : « Émise » = en attente de règlement, « Payée » = encaissée, « En retard » = échéance dépassée."
                    position="haut"
                    largeur={280}
                  >
                    <select
                      value={f.statut}
                      onChange={(e) => handleStatut(f.id, e.target.value)}
                      className="h-9 px-2.5 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-700 outline-none focus:border-primary-400 cursor-pointer"
                      title="Changer le statut de la facture en un clic"
                    >
                      {FACTURE_STATUTS_FORM.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Infobulle>
                  <StatutBadge label={f.statut} tone={factureStatusTone(f.statut)} />
                  {f.statut !== "Payée" && (
                    <Infobulle
                      contenu="Envoyer un rappel courtois au client car la facture n'est pas encore réglée, avec la facture en pièce jointe."
                      position="haut"
                      largeur={260}
                    >
                      <button
                        type="button"
                        onClick={() => handleRelance(f)}
                        disabled={relancingId === f.id}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60"
                        aria-label="Programmer une relance"
                        title="Programmer une relance liée au devis"
                      >
                        {relancingId === f.id ? (
                          <i className="ri-loader-4-line animate-spin"></i>
                        ) : (
                          <i className="ri-notification-3-line"></i>
                        )}
                        Relancer
                      </button>
                    </Infobulle>
                  )}
                  <Infobulle
                    contenu="Envoyer la facture au client par email, avec le PDF en pièce jointe."
                    position="haut"
                    largeur={240}
                  >
                    <button
                      type="button"
                      onClick={() => handleEmail(f)}
                      disabled={emailingId === f.id}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-accent-100 text-accent-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-60"
                      aria-label="Envoyer la facture par email"
                      title="Envoyer par email avec le PDF en pièce jointe"
                    >
                      {emailingId === f.id ? (
                        <i className="ri-loader-4-line animate-spin"></i>
                      ) : (
                        <i className="ri-mail-send-line"></i>
                      )}
                      Envoyer
                    </button>
                  </Infobulle>
                  <Infobulle
                    contenu="Créer une copie de cette facture (facture similaire) ou un avoir pour créditer le client."
                    position="haut"
                    largeur={250}
                  >
                    <button
                      type="button"
                      onClick={() => setDuplicateTarget(f)}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-300 transition-colors"
                      aria-label="Dupliquer la facture"
                      title="Dupliquer en facture similaire ou en avoir"
                    >
                      <i className="ri-file-copy-line"></i>
                      Dupliquer
                    </button>
                  </Infobulle>
                  <button
                    type="button"
                    onClick={() => setLignesFacture(f)}
                    className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-accent-700 cursor-pointer"
                    aria-label="Voir les lignes et les enregistrer dans la bibliothèque"
                    title="Voir les lignes · enregistrer dans ma bibliothèque"
                  >
                    <i className="ri-list-check-2"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFacture(f)}
                    className="relative w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-secondary-700 cursor-pointer"
                    aria-label="Historique des envois"
                    title="Historique des envois"
                  >
                    <i className="ri-history-line"></i>
                    {(envoiCountByFacture.get(f.id) ?? 0) > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-secondary-500 text-background-50 text-[10px] font-semibold">
                        {envoiCountByFacture.get(f.id)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(f)}
                    className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-primary-700 cursor-pointer"
                    aria-label="Aperçu puis téléchargement de la facture en PDF"
                    title="Aperçu du PDF avant téléchargement"
                  >
                    <i className="ri-eye-line"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionNotice(null);
                      setModeleError(null);
                      setModeleSaveTarget(f);
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-accent-700 cursor-pointer"
                    aria-label="Enregistrer comme modèle de facture"
                    title="Enregistrer comme modèle réutilisable"
                  >
                    <i className="ri-bookmark-line"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(f)}
                    className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-red-600 cursor-pointer"
                    aria-label="Supprimer la facture"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </span>
              </div>
            ))
          )}
        </div>

        {genOpen && (
          <GenererFactureModal devis={generatable} busy={busy} onGenerate={handleGenerate} onClose={() => setGenOpen(false)} />
        )}

        {/* Rappel discret en bas d'écran : les astuces de cet écran vivent dans le panneau Aide. */}
        <RappelAstucePage />

        {previewFacture && (
          <ApercuPdfModal
            title={`Aperçu · ${previewFacture.numero}`}
            filename={`${previewFacture.numero}.pdf`}
            docBuilder={() => buildFacturePdf(previewFacture)}
            note="Le document reprend votre logo, vos mentions légales et la signature du client si le devis est signé."
            onClose={() => setPreviewFacture(null)}
          />
        )}

        {pendingDelete && (
          <Modal title="Supprimer cette facture ?" onClose={() => setPendingDelete(null)}>
            <p className="text-sm text-foreground-600">
              La facture <strong className="text-foreground-900">{pendingDelete.numero}</strong> sera définitivement supprimée. Le
              devis d'origine reste intact.
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
        {historyFacture && (
          <Modal
            title={`Historique d'envoi · ${historyFacture.numero}`}
            subtitle="Tous les emails envoyés pour cette facture."
            onClose={() => setHistoryFacture(null)}
            wide
          >
            {historyEnvois.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="w-12 h-12 flex items-center justify-center rounded-full bg-background-100 text-foreground-300">
                  <i className="ri-history-line text-xl"></i>
                </span>
                <p className="text-sm text-foreground-500">Aucun email n'a encore été envoyé pour cette facture.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {historyEnvois.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start gap-3 p-3 rounded-md bg-background-100 border border-background-200"
                  >
                    <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
                      <i className={e.type === "relance" ? "ri-notification-3-line" : "ri-mail-send-line"}></i>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-700 font-semibold">
                          {envoiTypeLabel(e.type)}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-background-200 text-foreground-600 font-semibold inline-flex items-center gap-1">
                          <i className={canalIcon(e.canal)}></i>
                          {e.canal}
                        </span>
                        <span className="text-xs font-medium text-foreground-800">{e.destinataire ?? "—"}</span>
                      </div>
                      {e.sujet && <p className="text-xs text-foreground-600 mt-1 break-words">{e.sujet}</p>}
                      <p className="text-[11px] text-foreground-400 mt-1 inline-flex items-center gap-1">
                        <i className="ri-time-line"></i>
                        {formatDateTime(e.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Modal>
        )}
        {lignesFacture && (
          <FactureLignesModal facture={lignesFacture} userId={user?.id ?? null} onClose={() => setLignesFacture(null)} />
        )}
        {genModeleOpen && (
          <GenererFactureModeleModal
            modeles={modelesFacture}
            clients={clients}
            loading={loadingModelesFacture}
            busy={busy}
            error={modeleError}
            onClose={() => setGenModeleOpen(false)}
            onGenerate={handleGenerateFromModele}
            onDelete={handleDeleteModele}
            onArchive={handleArchiveModele}
            onRenommer={handleRenommerModele}
          />
        )}
        {modeleSaveTarget && (
          <EnregistrerFactureModeleModal
            defaultNom={modeleSaveTarget.objet?.trim() || modeleSaveTarget.numero}
            busy={savingModele}
            error={modeleError}
            onClose={() => {
              setModeleSaveTarget(null);
              setModeleError(null);
            }}
            onSubmit={handleSaveFactureModele}
          />
        )}
        {duplicateTarget && (
          <Modal
            title={`Dupliquer ${duplicateTarget.numero}`}
            subtitle="Choisissez le document à générer à partir de cette facture."
            onClose={() => setDuplicateTarget(null)}
          >
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => handleDuplicate(duplicateTarget, "facture")}
                disabled={duplicating}
                className="flex items-start gap-3 p-4 rounded-lg bg-background-100 border border-background-200 hover:border-primary-400 text-left cursor-pointer transition-colors disabled:opacity-60"
              >
                <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
                  <i className="ri-file-copy-line text-lg"></i>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground-950">Facture similaire</span>
                  <span className="block text-xs text-foreground-500 mt-0.5">
                    Nouvelle facture{duplicateTarget.clientNom ? ` pour ${duplicateTarget.clientNom}` : ""} avec les
                    mêmes lignes. Nouveau numéro FAC, statut Émise, dates du jour.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleDuplicate(duplicateTarget, "avoir")}
                disabled={duplicating}
                className="flex items-start gap-3 p-4 rounded-lg bg-background-100 border border-background-200 hover:border-accent-400 text-left cursor-pointer transition-colors disabled:opacity-60"
              >
                <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
                  <i className="ri-refund-2-line text-lg"></i>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground-950">Avoir (note de crédit)</span>
                  <span className="block text-xs text-foreground-500 mt-0.5">
                    Document avec montants négatifs et préfixe AV-, pour annuler ou créditer tout ou partie de la
                    facture.
                  </span>
                </span>
              </button>
            </div>
            {duplicating && (
              <p className="mt-4 text-xs text-foreground-500 inline-flex items-center gap-1.5">
                <i className="ri-loader-4-line animate-spin"></i>
                Génération en cours…
              </p>
            )}
          </Modal>
        )}
      </div>
    </DataState>
  );
}