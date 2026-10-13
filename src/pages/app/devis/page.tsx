import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useArtisanData } from "@/hooks/useArtisanData";
import { createClient, createDevis, createDevisModeleFromDevis, deleteDevis, duplicateDevis, duplicateDevisForClient, updateDevisStatut, type ClientPayload, type LigneInput } from "@/lib/artisanApi";
import { ensureDevisSignToken, buildSignUrl } from "@/lib/signature";
import { sendDevisEmail } from "@/lib/email";
import { DEVIS_STATUTS, DEVIS_STATUTS_FORM, devisStatusTone } from "@/lib/statuts";
import { formatEuros } from "@/lib/format";
import { formatShortDate, todayISO } from "@/lib/dates";
import { toCsv, downloadCsv } from "@/lib/csv";
import { type TriDevis, parseTri, triLabel } from "@/lib/devisTri";
import { memoriserDernierDevis } from "@/lib/devisDernierOuvert";
import { lireFiltresDevis, memoriserFiltresDevis } from "@/lib/devisFiltresMemoire";
import { ajouterLienCopie } from "@/lib/liensCopiesMemoire";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import SampleDataButton from "@/pages/app/components/SampleDataButton";
import Modal from "@/pages/app/components/Modal";
import Toast from "@/components/base/Toast";
import Infobulle from "@/components/base/Infobulle";
import StatutBadge from "@/pages/app/components/StatutBadge";
import DevisFormModal from "@/pages/app/devis/components/DevisFormModal";
import DevisDetailModal from "@/pages/app/devis/components/DevisDetailModal";
import EnregistrerModeleModal from "@/pages/app/devis/components/EnregistrerModeleModal";
import BroadcastDevisModal from "@/pages/app/devis/components/BroadcastDevisModal";
import DevisSortBar from "@/pages/app/devis/components/DevisSortBar";
import SignatureBadge from "@/pages/app/devis/components/SignatureBadge";
import DevisToRelance from "@/pages/app/dashboard/components/DevisToRelance";
import BadgeVuePartagee from "@/pages/app/components/BadgeVuePartagee";
import BoutonEpinglerVue from "@/pages/app/components/BoutonEpinglerVue";
import BoutonPartager from "@/pages/app/components/BoutonPartager";
import MenuVuesPartageesRecentes from "@/pages/app/components/MenuVuesPartageesRecentes";
import RechercheRepliable from "@/components/feature/RechercheRepliable";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import { guidePremiereVisiteVu, marquerGuidePremiereVisiteVu } from "@/lib/guidePremiereVisite";

type PendingDelete = { id: number; numero: string } | null;
type PendingModele = { id: number; numero: string; objet: string } | null;

const PERIODES = ["Tout", "Ce mois", "Ce trimestre", "Cette année", "Personnalisé"] as const;

/** Clé de préférence locale où sont mémorisés les modèles épinglés « favoris » (partagée avec le tableau de bord). */
const PINNED_KEY = "artiflow_modeles_pinned";

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

/** Libellé lisible d'un mois au format « YYYY-MM » (ex. « septembre 2026 »). */
function moisLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** Groupe de statuts d'un devis : « signes » (signé/accepté), « attente » (envoyé/à relancer) ou « autre » (brouillon…). */
function groupeDeStatut(statut: string): "signes" | "attente" | "autre" {
  if (statut === "Signé" || statut === "Accepté") return "signes";
  if (statut === "Envoyé" || statut === "À relancer") return "attente";
  return "autre";
}

export default function AppDevis() {
  usePageMeta("Devis · ArtiFlow-pro", "Créez, suivez et relancez vos devis d'artisan.");
  const { user } = useAuth();
  const { loading, error, devis, clients, envois, relances, reload } = useArtisanData();

  // Trace de contact réelle : un devis est « suivi » dès qu'un envoi ou une relance lui est rattaché.
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

  // Dernière vue mémorisée (statut, modèle, mois, période, tri) : valeur par défaut quand l'URL ne porte aucun filtre.
  const memoFiltres = useMemo(lireFiltresDevis, []);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Indicateur « vue partagée » : vrai quand l'adresse contient des filtres (vue reçue via un lien partagé).
  const aFiltresUrl = useMemo(
    () =>
      ["modele", "mois", "favoris", "groupe", "tri", "statut", "periode", "debut", "fin"].some((k) =>
        searchParams.has(k),
      ),
    [searchParams],
  );
  const [statut, setStatut] = useState(() => {
    // L'URL (lien partagé) prime ; sinon on restaure le statut de la dernière vue.
    const m = searchParams.get("statut") ?? memoFiltres.statut;
    return m && ["Tous", ...DEVIS_STATUTS, "À suivre"].includes(m) ? m : "Tous";
  });
  const [periode, setPeriode] = useState<string>(() => {
    const m = searchParams.get("periode") ?? memoFiltres.periode ?? "";
    return (PERIODES as readonly string[]).includes(m) ? m : "Tout";
  });
  const [customStart, setCustomStart] = useState(() => searchParams.get("debut") ?? "");
  const [customEnd, setCustomEnd] = useState(() => searchParams.get("fin") ?? "");
  /** Recherche texte, mémorisée dans l'URL (?q=) pour la rendre partageable et la restituer au rechargement. */
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  /** Filtre « issu d'un modèle » : clé(s) de modèle séparées par des virgules, « __any__ » pour tous, « » pour aucun filtre. */
  const [modeleFilter, setModeleFilter] = useState(() => searchParams.get("modele") ?? memoFiltres.modele ?? "");
  /** Filtre « mois précis » (format « YYYY-MM ») : appliqué quand on clique un mois d'une mini-courbe. */
  const [moisFilter, setMoisFilter] = useState(() => searchParams.get("mois") ?? memoFiltres.mois ?? "");
  /** Filtre « favoris seulement » : n'affiche que les devis nés des modèles épinglés en favoris (mémorisé dans l'URL via ?favoris=1). */
  const [onlyFavoris, setOnlyFavoris] = useState(() => searchParams.get("favoris") === "1");
  /** Filtre « groupe de statuts » appliqué en cliquant un segment de la répartition (signés / en attente), mémorisé dans l'URL via ?groupe=. */
  const [groupeStatut, setGroupeStatut] = useState<"" | "signes" | "attente">(() => {
    const g = searchParams.get("groupe");
    return g === "signes" || g === "attente" ? g : "";
  });
  /** Tri actif de la liste, piloté depuis l'en-tête du tableau et mémorisé dans l'URL via ?tri=. */
  const [tri, setTri] = useState<TriDevis>(() => {
    // L'URL (lien partagé) prime ; sinon on restaure le tri de la dernière vue.
    const fromUrl = parseTri(searchParams.get("tri"));
    return fromUrl || parseTri(memoFiltres.tri ?? null);
  });
  /** Clés des modèles épinglés « favoris » (préférence locale partagée avec le tableau de bord). */
  const [pinnedKeys, setPinnedKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(PINNED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
    } catch {
      return [];
    }
  });
  /** Petit toast de confirmation quand un filtre modèle est appliqué depuis un badge. */
  const [toast, setToast] = useState<string | null>(null);
  /** Évite de rejouer le toast quand le paramètre d'URL est déjà appliqué. */
  const appliedFromUrlRef = useRef<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  /** Évite de rouvrir sans cesse le devis ciblé par l'URL (?devis=) après sa fermeture. */
  const devisParamAppliedRef = useRef(false);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [broadcastDevisId, setBroadcastDevisId] = useState<number | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [pendingModele, setPendingModele] = useState<PendingModele>(null);
  const [savingModele, setSavingModele] = useState(false);
  const [modeleError, setModeleError] = useState<string | null>(null);

  // Guide de première visite : ouvert au premier passage, puis mémorisé une fois fermé par l'artisan.
  // Il ne réapparaît plus ensuite, sauf si l'on clique « Revoir le guide du devis ».
  const [guideVisible, setGuideVisible] = useState(() => !guidePremiereVisiteVu("devis"));
  const fermerGuide = () => {
    marquerGuidePremiereVisiteVu("devis");
    setGuideVisible(false);
  };

  // Clés de modèles sélectionnées (peut en contenir plusieurs pour une comparaison).
  const modeleKeys = useMemo(
    () => (modeleFilter && modeleFilter !== "__any__" ? modeleFilter.split(",").map((s) => s.trim()).filter(Boolean) : []),
    [modeleFilter],
  );

  const filteredBase = useMemo(() => {
    const q = query.trim().toLowerCase();
    const range = periodRange(periode);
    return devis.filter((d) => {
      const matchStatut =
        statut === "Tous" ||
        (statut === "À suivre"
          ? d.statut !== "Signé" && d.statut !== "Accepté"
          : d.statut === statut);
      let matchPeriode = true;
      if (periode === "Personnalisé") {
        const dt = new Date(d.created_at);
        const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
        const end = customEnd ? new Date(`${customEnd}T23:59:59`) : null;
        matchPeriode =
          !Number.isNaN(dt.getTime()) && (start === null || dt >= start) && (end === null || dt <= end);
      } else if (range) {
        const dt = new Date(d.created_at);
        matchPeriode = !Number.isNaN(dt.getTime()) && dt >= range.start && dt < range.end;
      }
      const matchQuery =
        !q ||
        d.numero.toLowerCase().includes(q) ||
        (d.objet ?? "").toLowerCase().includes(q) ||
        (d.clientNom ?? "").toLowerCase().includes(q);
      // Filtre « issu d'un modèle » : tous les devis nés d'un modèle, ou un ou plusieurs modèles précis.
      let matchModele = true;
      if (modeleFilter === "__any__") matchModele = d.modeleCle !== null;
      else if (modeleKeys.length > 0) matchModele = d.modeleCle !== null && modeleKeys.includes(d.modeleCle);
      // Filtre « mois précis » : restreint aux devis créés sur le mois choisi (clique sur une mini-courbe).
      let matchMois = true;
      if (moisFilter) {
        const dt = new Date(d.created_at);
        const ym = Number.isNaN(dt.getTime())
          ? ""
          : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        matchMois = ym === moisFilter;
      }
      // Filtre « favoris seulement » : uniquement les devis issus d'un modèle épinglé en favori.
      let matchFavoris = true;
      if (onlyFavoris) matchFavoris = d.modeleCle !== null && pinnedKeys.includes(d.modeleCle);
      return matchStatut && matchPeriode && matchQuery && matchModele && matchMois && matchFavoris;
    });
  }, [devis, statut, query, periode, customStart, customEnd, modeleFilter, modeleKeys, moisFilter, onlyFavoris, pinnedKeys]);

  // Filtre « groupe de statuts » : appliqué en cliquant un segment de la répartition (signés / en attente).
  // On filtre à partir de la base (déjà filtrée par modèle/mois/favoris) pour que la répartition reste stable.
  const filtered = useMemo(() => {
    if (!groupeStatut) return filteredBase;
    if (groupeStatut === "signes") return filteredBase.filter((d) => d.statut === "Signé" || d.statut === "Accepté");
    return filteredBase.filter((d) => d.statut === "Envoyé" || d.statut === "À relancer");
  }, [filteredBase, groupeStatut]);

  // Liste affichée : même contenu que `filtered`, mais réordonné selon le tri actif
  // choisi depuis l'en-tête du tableau (groupe de statuts, client ou montant).
  const devisAffiches = useMemo(() => {
    if (!tri) return filtered;
    const arr = [...filtered];
    if (tri === "signes" || tri === "attente") {
      const rang = (s: string) => {
        const g = groupeDeStatut(s);
        if (g === tri) return 0;
        if (g === "autre") return 2;
        return 1;
      };
      arr.sort((a, b) => rang(a.statut) - rang(b.statut));
    } else if (tri === "client-asc" || tri === "client-desc") {
      arr.sort((a, b) => {
        const cmp = (a.clientNom ?? "").localeCompare(b.clientNom ?? "", "fr", { sensitivity: "base" });
        return tri === "client-asc" ? cmp : -cmp;
      });
    } else if (tri === "montant-asc" || tri === "montant-desc") {
      arr.sort((a, b) => {
        const diff = Number(a.total_ht || 0) - Number(b.total_ht || 0);
        return tri === "montant-asc" ? diff : -diff;
      });
    }
    return arr;
  }, [filtered, tri]);

  // Liste des modèles réellement utilisés pour générer des devis (clé + nom + nombre de devis),
  // pour alimenter le filtre « issu d'un modèle ».
  const modeleOptions = useMemo(() => {
    const map = new Map<string, { cle: string; nom: string; count: number }>();
    devis.forEach((d) => {
      if (!d.modeleCle) return;
      const existing = map.get(d.modeleCle);
      if (existing) existing.count += 1;
      else map.set(d.modeleCle, { cle: d.modeleCle, nom: d.modeleNom ?? "Modèle supprimé", count: 1 });
    });
    return [...map.values()].sort((a, b) => b.count - a.count || a.nom.localeCompare(b.nom, "fr"));
  }, [devis]);

  // Options du menu « mois » de la page Devis : les 12 derniers mois, du plus récent au plus ancien,
  // pour filtrer directement ici sans dépendre du tableau de bord.
  const moisOptions = useMemo(() => {
    const now = new Date();
    const arr: { value: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
      });
    }
    return arr;
  }, []);

  // Applique le filtre demandé depuis l'URL (ex. depuis un badge « N devis » du tableau de bord),
  // avec une petite confirmation visuelle.
  useEffect(() => {
    const fromUrl = searchParams.get("modele") ?? "";
    const moisUrl = searchParams.get("mois") ?? "";
    if (!fromUrl && !moisUrl) return;
    const keys = fromUrl && fromUrl !== "__any__" ? fromUrl.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const isAll = fromUrl === "__any__";
    const refKey = `${fromUrl}|${moisUrl}`;
    // On ne rejoue pas le toast si les filtres d'URL sont déjà appliqués.
    if (appliedFromUrlRef.current === refKey) return;
    appliedFromUrlRef.current = refKey;
    setModeleFilter(fromUrl);
    setMoisFilter(moisUrl);
    const parts: string[] = [];
    if (isAll) parts.push("tous les modèles");
    else if (keys.length > 1) parts.push(`${keys.length} modèles`);
    else if (keys.length === 1) {
      const nom = modeleOptions.find((m) => m.cle === keys[0])?.nom;
      parts.push(nom ? `le modèle « ${nom} »` : "ce modèle");
    }
    if (moisUrl) parts.push(`le mois de ${moisLabel(moisUrl)}`);
    setToast(parts.length ? `Devis filtrés sur ${parts.join(" · ")}` : "Filtres appliqués");
  }, [searchParams, modeleOptions]);

  // Mémorise la vue courante (statut, modèle, mois, période, tri) pour la restaurer automatiquement au retour sur la page.
  useEffect(() => {
    memoriserFiltresDevis({ statut, modele: modeleFilter, mois: moisFilter, periode, tri });
  }, [statut, modeleFilter, moisFilter, periode, tri]);

  // Ouvre directement le formulaire de devis quand on arrive avec le paramètre « ?nouveau=1 »
  // (lancement d'un nouveau devis). Le paramètre est consommé puis retiré.
  const appliedNouveauRef = useRef(false);
  useEffect(() => {
    if (appliedNouveauRef.current) return;
    if (searchParams.get("nouveau") !== "1") return;
    appliedNouveauRef.current = true;
    setFormOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("nouveau");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Au premier chargement, prévient discrètement lorsque la dernière vue a été restaurée depuis la mémoire locale.
  useEffect(() => {
    const aFiltreMemoire = Boolean(
      memoFiltres.modele ||
        memoFiltres.mois ||
        (memoFiltres.statut && memoFiltres.statut !== "Tous") ||
        (memoFiltres.periode && memoFiltres.periode !== "Tout") ||
        memoFiltres.tri,
    );
    const aFiltreUrl = Boolean(
      searchParams.get("modele") ||
        searchParams.get("mois") ||
        searchParams.get("tri") ||
        searchParams.get("statut") ||
        searchParams.get("periode"),
    );
    if (!aFiltreMemoire || aFiltreUrl) return;
    const parts: string[] = [];
    if (memoFiltres.modele) parts.push("modèle");
    if (memoFiltres.mois) parts.push("mois");
    if (memoFiltres.statut && memoFiltres.statut !== "Tous") parts.push("statut");
    if (memoFiltres.periode && memoFiltres.periode !== "Tout") parts.push("période");
    if (memoFiltres.tri) parts.push("tri");
    if (parts.length) setToast(`Dernière vue restaurée : ${parts.join(", ")}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ouvre le devis ciblé par l'URL (?devis=) : utilisé par le raccourci « Reprendre » du menu.
  // On ne l'applique qu'une fois, pour ne pas réouvrir la fenêtre après une fermeture volontaire.
  useEffect(() => {
    if (devisParamAppliedRef.current || devis.length === 0) return;
    const paramId = Number(searchParams.get("devis"));
    if (!Number.isFinite(paramId) || paramId <= 0) return;
    if (devis.some((d) => d.id === paramId)) {
      devisParamAppliedRef.current = true;
      setDetailId(paramId);
    }
  }, [searchParams, devis]);

  // Mémorise le devis ouvert pour alimenter le raccourci « Reprendre » du menu.
  const ouvrirDetail = (d: { id: number; numero: string; objet: string | null }) => {
    memoriserDernierDevis({ id: d.id, numero: d.numero, objet: d.objet });
    setDetailId(d.id);
  };

  // Synchronise la recherche texte avec l'URL (?q=) : utile au retour arrière/navigation dans l'historique.
  useEffect(() => {
    const qUrl = searchParams.get("q") ?? "";
    setQuery((prev) => (prev === qUrl ? prev : qUrl));
  }, [searchParams]);

  // Construit les paramètres d'URL de la vue filtrée courante (filtres + tri actif + recherche), avec surcharge ponctuelle.
  const buildParams = (
    override: Partial<{ modele: string; mois: string; favoris: boolean; groupe: "" | "signes" | "attente"; tri: TriDevis; q: string; statut: string; periode: string }> = {},
  ) => {
    const modele = override.modele ?? modeleFilter;
    const mois = override.mois ?? moisFilter;
    const favoris = override.favoris ?? onlyFavoris;
    const groupe = override.groupe ?? groupeStatut;
    const t = override.tri ?? tri;
    const q = override.q ?? query;
    const st = override.statut ?? statut;
    const pe = override.periode ?? periode;
    const p = new URLSearchParams();
    if (modele) p.set("modele", modele);
    if (mois) p.set("mois", mois);
    if (favoris) p.set("favoris", "1");
    if (groupe) p.set("groupe", groupe);
    if (t) p.set("tri", t);
    // Statut et période font partie de la vue : on les inclut pour pouvoir la partager à l'identique.
    if (st && st !== "Tous") p.set("statut", st);
    if (pe === "Personnalisé") {
      p.set("periode", pe);
      if (customStart) p.set("debut", customStart);
      if (customEnd) p.set("fin", customEnd);
    } else if (pe && pe !== "Tout") {
      p.set("periode", pe);
    }
    if (q.trim()) p.set("q", q);
    return p;
  };

  // Chemin interne de la vue courante (filtres + recherche), pour le bouton « Partager » de l'en-tête.
  const qsPartage = buildParams().toString();
  const cheminPartage = `${location.pathname}${qsPartage ? `?${qsPartage}` : ""}`;

  // Applique le tri actif, le mémorise dans l'URL (?tri=) pour le conserver au rechargement et le partager.
  const applyTri = (next: TriDevis) => {
    setTri(next);
    appliedFromUrlRef.current = `${modeleFilter}|${moisFilter}`;
    setSearchParams(buildParams({ tri: next }), { replace: true });
    const messages: Record<TriDevis, string> = {
      "": "Tri retiré",
      signes: "Liste triée par groupe · Signés d'abord",
      attente: "Liste triée par groupe · En attente d'abord",
      "client-asc": "Liste triée par client · A → Z",
      "client-desc": "Liste triée par client · Z → A",
      "montant-asc": "Liste triée par montant · croissant",
      "montant-desc": "Liste triée par montant · décroissant",
    };
    setToast(messages[next]);
  };

  // Bascule le tri d'une colonne depuis l'en-tête du tableau : ascendant → descendant → aucun.
  const toggleColTri = (col: "client" | "montant") => {
    const asc: TriDevis = col === "client" ? "client-asc" : "montant-asc";
    const desc: TriDevis = col === "client" ? "client-desc" : "montant-desc";
    applyTri(tri === asc ? desc : tri === desc ? "" : asc);
  };

  // Applique (ou retire) le filtre modèle depuis un badge : met aussi l'URL à jour + confirmation.
  const applyModelFilter = (cle: string, nom: string) => {
    const next = modeleFilter === cle ? "" : cle;
    appliedFromUrlRef.current = `${next}|${moisFilter}`;
    setModeleFilter(next);
    setSearchParams(buildParams({ modele: next }), { replace: true });
    setToast(next ? `Filtré sur le modèle « ${nom} »` : "Filtre modèle retiré");
  };

  // Construit et copie le lien filtré (statut + période + modèle + mois + favoris + groupe + tri) pour partager la vue telle quelle.
  // L'URL reflète toujours les filtres actifs : on la reconstruit depuis l'état pour être sûr.
  const copyFilterLink = async () => {
    const qs = buildParams().toString();
    const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      ajouterLienCopie("Vue filtrée · devis", url);
      setToast("Lien filtré copié : partagez-le pour ouvrir la même vue");
    } catch {
      setToast("Copie automatique impossible : l'adresse de la page contient déjà vos filtres");
    }
  };

  // Réinitialise d'un coup tous les filtres « vue filtrée » (modèle + mois + favoris) et nettoie l'URL.
  const resetFilters = () => {
    appliedFromUrlRef.current = "|";
    setModeleFilter("");
    setMoisFilter("");
    setOnlyFavoris(false);
    setGroupeStatut("");
    setTri("");
    setStatut("Tous");
    setPeriode("Tout");
    setCustomStart("");
    setCustomEnd("");
    // On conserve la recherche texte (?q=) : elle possède son propre bouton d'effacement.
    setSearchParams(
      buildParams({ modele: "", mois: "", favoris: false, groupe: "", tri: "", statut: "Tous", periode: "Tout" }),
      { replace: true },
    );
    setToast("Filtres réinitialisés");
  };


  // Active/désactive le filtre « groupe de statuts » en cliquant un segment de la répartition.
  const toggleGroupe = (g: "signes" | "attente") => {
    const next = groupeStatut === g ? "" : g;
    setGroupeStatut(next);
    // Synchronise l'URL pour rendre le filtre groupe partageable (?groupe=signes|attente).
    appliedFromUrlRef.current = `${modeleFilter}|${moisFilter}`;
    setSearchParams(buildParams({ groupe: next }), { replace: true });
    setToast(
      next === "signes"
        ? "Filtré sur les devis signés / acceptés"
        : next === "attente"
          ? "Filtré sur les devis en attente"
          : "Filtre de statut retiré",
    );
  };

  // Bascule le filtre « Favoris seulement » en mémorisant son état dans l'URL (?favoris=1),
  // pour le conserver au rechargement de la page et dans un lien partagé.
  const toggleFavoris = () => {
    const next = !onlyFavoris;
    setOnlyFavoris(next);
    appliedFromUrlRef.current = `${modeleFilter}|${moisFilter}`;
    setSearchParams(buildParams({ favoris: next }), { replace: true });
    setToast(next ? "Affichage limité aux devis issus de vos modèles favoris" : "Filtre favoris retiré");
  };

  // Désépingle d'un coup tous les modèles favoris depuis la page Devis,
  // et relâche le filtre « Favoris seulement » pour ne pas laisser une liste vide.
  const clearPins = () => {
    setPinnedKeys([]);
    try {
      localStorage.setItem(PINNED_KEY, JSON.stringify([]));
    } catch {
      /* préférence non persistée */
    }
    setOnlyFavoris(false);
    appliedFromUrlRef.current = `${modeleFilter}|${moisFilter}`;
    setSearchParams(buildParams({ favoris: false }), { replace: true });
    setToast("Favoris réinitialisés : plus aucun modèle épinglé");
  };

  const total = filtered.reduce((sum, d) => sum + Number(d.total_ht || 0), 0);
  // Total HT de l'ensemble des devis (tous filtres confondus) : sert à mesurer le poids de la vue filtrée.
  const totalGlobal = useMemo(() => devis.reduce((sum, d) => sum + Number(d.total_ht || 0), 0), [devis]);
  // Nombre de devis issus de modèles épinglés en favoris (compteur de la bannière « Favoris seulement »).
  const favorisCount = useMemo(
    () => devis.filter((d) => d.modeleCle !== null && pinnedKeys.includes(d.modeleCle)).length,
    [devis, pinnedKeys],
  );
  const ecart = total - totalGlobal;
  const ecartPct = totalGlobal > 0 ? Math.round((ecart / totalGlobal) * 100) : 0;
  const suivant = statut === "À suivre";
  // Mini-répartition par statut de la vue filtrée : devis signés/acceptés vs encore en attente.
  const repSignes = filteredBase.filter((d) => d.statut === "Signé" || d.statut === "Accepté").length;
  const repAttente = filteredBase.filter((d) => d.statut === "Envoyé" || d.statut === "À relancer").length;
  const repTotal = repSignes + repAttente;
  const repSignesPct = repTotal > 0 ? Math.round((repSignes / repTotal) * 100) : 0;
  const aRelancer = useMemo(
    () => (suivant ? filtered.filter((d) => contactedDevisIds.has(d.id)) : []),
    [suivant, filtered, contactedDevisIds],
  );
  const jamaisContactes = useMemo(
    () => (suivant ? filtered.filter((d) => !contactedDevisIds.has(d.id)) : []),
    [suivant, filtered, contactedDevisIds],
  );
  const detailDevis = devis.find((d) => d.id === detailId) ?? null;
  const broadcastDevis = devis.find((d) => d.id === broadcastDevisId) ?? null;

  const handleCreate = async (payload: { clientId: number | null; objet: string; statut: string; lignes: LigneInput[] }) => {
    if (!user) return;
    setBusy(true);
    setActionError(null);
    try {
      await createDevis(user.id, payload);
      setFormOpen(false);
      await reload();
    } catch {
      setActionError("La création du devis a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  // Création d'un client directement depuis la fenêtre de devis (quand la liste est vide).
  const handleQuickCreateClient = async (payload: ClientPayload) => {
    if (!user) return null;
    const created = await createClient(user.id, payload);
    await reload();
    return created;
  };

  const handleStatut = async (id: number, value: string) => {
    setActionError(null);
    try {
      await updateDevisStatut(id, value);
      await reload();
    } catch {
      setActionError("La mise à jour du statut a échoué.");
    }
  };

  const handleDuplicate = async (id: number) => {
    if (!user) return;
    setActionError(null);
    setDuplicatingId(id);
    try {
      await duplicateDevis(user.id, id);
      await reload();
    } catch {
      setActionError("La duplication du devis a échoué.");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleBroadcast = async (devisId: number, clientIds: number[]) => {
    if (!user) return;
    setActionError(null);
    setActionNotice(null);
    setBroadcasting(true);
    let crees = 0;
    let envoyes = 0;
    try {
      for (const clientId of clientIds) {
        const client = clients.find((c) => c.id === clientId);
        const newId = await duplicateDevisForClient(user.id, devisId, clientId);
        crees += 1;
        if (client?.email) {
          try {
            const token = await ensureDevisSignToken(newId);
            await sendDevisEmail(newId, buildSignUrl(token));
            envoyes += 1;
          } catch {
            /* copie créée : l'envoi partira dès que Resend sera activé */
          }
        }
      }
      setBroadcastDevisId(null);
      await reload();
      setActionNotice(
        `Envoi groupé : ${crees} copie(s) créée(s) · ${envoyes} email(s) envoyé(s).${
          envoyes < crees ? " Les envois restants partiront dès qu'un email est renseigné et Resend activé." : ""
        }`,
      );
    } catch {
      setActionError("L'envoi groupé a échoué. Réessayez.");
    } finally {
      setBroadcasting(false);
    }
  };

  const handleExportCsv = () => {
    // Groupe de statuts : signés/acceptés vs en attente, pour trier l'export par état d'avancement.
    const groupeDe = (s: string) => {
      const g = groupeDeStatut(s);
      return g === "signes" ? "Signés" : g === "attente" ? "En attente" : "—";
    };
    const rows = filtered.map((d) => [
      d.numero,
      d.clientNom ?? "",
      d.objet ?? "",
      Number(d.total_ht || 0).toFixed(2).replace(".", ","),
      Number(d.total_ttc || 0).toFixed(2).replace(".", ","),
      d.statut,
      groupeDe(d.statut),
      formatShortDate(d.created_at),
      d.modeleNom ?? "",
    ]);
    // Récapitulatif en bas de fichier : totaux HT / TTC, puis taux de signature de la vue filtrée
    // (même définition que la bannière : signés/acceptés vs en attente).
    const totalHT = filtered.reduce((sum, d) => sum + Number(d.total_ht || 0), 0);
    const totalTTC = filtered.reduce((sum, d) => sum + Number(d.total_ttc || 0), 0);
    const signesVue = filtered.filter((d) => d.statut === "Signé" || d.statut === "Accepté").length;
    const attenteVue = filtered.filter((d) => d.statut === "Envoyé" || d.statut === "À relancer").length;
    const assietteVue = signesVue + attenteVue;
    const taux = assietteVue ? Math.round((signesVue / assietteVue) * 100) : 0;
    const resume: (string | number)[][] = [
      ["", "", "", "", "", "", "", "", ""],
      ["Récapitulatif", "", "", "", "", "", "", "", ""],
      // La colonne de tri active est mémorisée dans le fichier pour retrouver la vue telle quelle.
      ["Tri appliqué", "", "", triLabel(tri) || "Aucun (ordre par défaut)", "", "", "", "", ""],
      ["Total HT", "", "", totalHT.toFixed(2).replace(".", ","), "", "", "", "", ""],
      ["Total TTC", "", "", "", totalTTC.toFixed(2).replace(".", ","), "", "", "", ""],
      ["Taux de signature", "", "", `${taux} %`, "", "", "", "", ""],
      ["Dont signés / acceptés", "", "", `${signesVue} / ${assietteVue}`, "", "", "", "", ""],
      ["Dont en attente", "", "", `${attenteVue}`, "", "", "", "", ""],
    ];
    const csv = toCsv(
      ["Numéro", "Client", "Objet", "Montant HT", "Montant TTC", "Statut", "Groupe de statuts", "Date", "Modèle d'origine"],
      [...rows, ...resume],
    );
    const suffixe = periode === "Tout" ? "" : `-${periode.toLowerCase().replace(/\s+/g, "-")}`;
    // Tri actif ajouté au nom du fichier pour retrouver la vue dans les archives.
    const suffixeTri = tri ? `-tri-${tri}` : "";
    downloadCsv(`devis-artiflow-${todayISO()}${suffixe}${suffixeTri}.csv`, csv);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setActionError(null);
    try {
      await deleteDevis(pendingDelete.id);
      setPendingDelete(null);
      await reload();
    } catch {
      setActionError("La suppression a échoué.");
    }
  };

  // Enregistre un devis comme modèle réutilisable, directement depuis la liste.
  const handleSaveModele = async (nom: string) => {
    if (!user || !pendingModele) return;
    setSavingModele(true);
    setModeleError(null);
    try {
      await createDevisModeleFromDevis(user.id, pendingModele.id, nom);
      setActionNotice(`Modèle « ${nom} » enregistré. Réutilisez-le en un clic depuis le tableau de bord.`);
      setPendingModele(null);
    } catch {
      setModeleError("L'enregistrement du modèle a échoué. Réessayez.");
    } finally {
      setSavingModele(false);
    }
  };

  if (!loading && !error && devis.length === 0 && clients.length === 0) {
    return (
      <div className="animate-fade-in">
        <EmptyState
          icon="ri-file-text-line"
          title="Aucun devis pour l'instant"
          text="Créez votre premier devis, ou chargez un jeu de données d'exemple pour découvrir la gestion des devis d'ArtiFlow-pro."
        >
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-add-line"></i> Créer un devis
            </button>
            <SampleDataButton onSeeded={reload} />
          </div>
        </EmptyState>
        {formOpen && (
          <DevisFormModal
            clients={clients}
            busy={busy}
            onClose={() => setFormOpen(false)}
            onSubmit={handleCreate}
            onQuickCreateClient={handleQuickCreateClient}
          />
        )}
      </div>
    );
  }

  return (
    <DataState loading={loading} error={error} onRetry={reload}>
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 w-full md:w-auto">
          <RechercheRepliable
            carteId="devis"
            carteLabel="Devis"
            value={query}
            onChange={(value) => {
              setQuery(value);
              setSearchParams(buildParams({ q: value }), { replace: true });
            }}
            onEffacer={() => {
              setQuery("");
              setSearchParams(buildParams({ q: "" }), { replace: true });
            }}
            placeholder="Rechercher un client, un devis…"
            conteneurClassName="w-full md:w-72"
          />
          {aFiltresUrl && (
            <>
              <BadgeVuePartagee />
              <BoutonEpinglerVue label="Devis · vue partagée" />
            </>
          )}
          <MenuVuesPartageesRecentes basePath="/app/devis" />
          <BoutonPartager
            label="Vue filtrée · devis"
            chemin={cheminPartage}
            title="Partager la vue courante des devis"
            align="left"
          />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-foreground-500 whitespace-nowrap">
              Total filtré : <strong className="text-foreground-900">{formatEuros(total)}</strong>
            </span>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exporter les devis affichés au format CSV"
            >
              <i className="ri-file-excel-2-line"></i>
              Exporter CSV
            </button>
            <Infobulle
              contenu="Créer un nouveau devis : choisissez un client, ajoutez vos lignes, le total se calcule tout seul."
              position="bas"
              largeur={280}
            >
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-add-line"></i>
                Nouveau devis
              </button>
            </Infobulle>
          </div>
        </div>

        {guideVisible && (
          <GuidePremiereVisite
            titre="Bienvenue dans vos devis"
            sousTitre="Voici, en 4 étapes, comment créer et envoyer votre premier devis. Vous ne pouvez rien casser : tant qu'un devis n'est pas signé, rien n'est engagé."
            etapes={[
              {
                icone: "ri-add-line",
                titre: "Créez le devis",
                texte:
                  "Cliquez « Nouveau devis », choisissez le client (ou créez-le au passage), puis ajoutez vos lignes. Le total se calcule tout seul.",
              },
              {
                icone: "ri-mail-send-line",
                titre: "Envoyez-le",
                texte:
                  "Ouvrez le devis et cliquez « Envoyer par email ». Votre client reçoit un lien pour le consulter en ligne.",
              },
              {
                icone: "ri-pen-nib-line",
                titre: "Faites-le signer",
                texte:
                  "Votre client signe sur son téléphone ou son ordinateur. Le devis passe alors tout seul au statut « Signé ».",
              },
              {
                icone: "ri-receipt-line",
                titre: "Facturez, puis relancez",
                texte:
                  "Une fois signé, générez la facture en un clic. Sans réponse ? L'onglet « À suivre » vous montre qui relancer.",
              },
            ]}
            note="Ce guide ne s'affiche qu'une seule fois. Pour le revoir, cliquez « Revoir le guide du devis » sous l'en-tête."
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
            Revoir le guide du devis
          </button>
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

        <div className="flex flex-wrap items-center gap-2">
          <Infobulle
            contenu="Filtrer la liste par statut. Brouillon = pas encore envoyé ; Envoyé = parti chez le client ; À relancer = sans réponse ; Accepté = le client est d'accord ; Signé = accepté et signé. « À suivre » regroupe tout ce qui attend une action de votre part."
            position="bas"
            largeur={320}
          >
            <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:text-accent-700 cursor-help">
              <i className="ri-information-line text-sm"></i>
            </span>
          </Infobulle>
          <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
            {[...DEVIS_STATUTS, "À suivre"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatut(s);
                  // On reflète la vue (statut) dans l'URL pour la partager à l'identique.
                  setSearchParams(buildParams({ statut: s }), { replace: true });
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  statut === s ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <Infobulle
            contenu="Limiter la liste à la date de création du devis : ce mois-ci, ce trimestre, cette année, ou une période précise (« Personnalisé »)."
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
                  // On reflète la période dans l'URL pour rendre la vue partageable telle quelle.
                  setSearchParams(buildParams({ periode: p }), { replace: true });
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  periode === p ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {modeleOptions.length > 0 && (
            <>
            <Infobulle
              contenu="N'afficher que les devis créés depuis un modèle, c'est-à-dire une trame que vous réutilisez. Choisissez un modèle précis, ou « Issus d'un modèle » pour les voir tous."
              position="bas"
              largeur={300}
            >
              <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:text-accent-700 cursor-help">
                <i className="ri-information-line text-sm"></i>
              </span>
            </Infobulle>
            <div className="relative">
              <i className="ri-bookmark-3-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
              <select
                value={modeleFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  appliedFromUrlRef.current = `${value}|${moisFilter}`;
                  setModeleFilter(value);
                  setSearchParams(buildParams({ modele: value }), { replace: true });
                }}
                className="h-9 pl-9 pr-16 rounded-full bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 outline-none focus:border-primary-400 cursor-pointer appearance-none"
                title="Afficher les devis créés depuis un modèle"
                aria-label="Filtrer les devis issus d'un modèle"
              >
                <option value="">Issu d'un modèle : tous</option>
                <option value="__any__">Issus d'un modèle (tous)</option>
                {modeleKeys.length > 1 && (
                  <option value={modeleFilter}>{modeleKeys.length} modèles sélectionnés</option>
                )}
                {modeleOptions.map((m) => {
                  const estFavori = pinnedKeys.includes(m.cle);
                  return (
                    <option key={m.cle} value={m.cle}>
                      {estFavori ? `★ ${m.nom} (${m.count} favoris)` : `${m.nom} (${m.count})`}
                    </option>
                  );
                })}
              </select>
              <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
              {favorisCount > 0 && (
                <span
                  className="absolute right-7 top-1/2 -translate-y-1/2 inline-flex items-center gap-0.5 h-5 px-1.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold pointer-events-none"
                  title={`${favorisCount} devis issus de vos modèles épinglés en favoris`}
                >
                  <i className="ri-star-fill text-[9px]"></i>
                  {favorisCount}
                </span>
              )}
            </div>
            </>
          )}
          <Infobulle
            contenu="N'afficher que les devis créés sur un mois précis — pratique pour retrouver, par exemple, tout ce que vous avez chiffré en septembre."
            position="bas"
            largeur={300}
          >
            <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:text-accent-700 cursor-help">
              <i className="ri-information-line text-sm"></i>
            </span>
          </Infobulle>
          <div className="relative">
            <i className="ri-calendar-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
            <select
              value={moisFilter}
              onChange={(e) => {
                const value = e.target.value;
                appliedFromUrlRef.current = `${modeleFilter}|${value}`;
                setMoisFilter(value);
                setSearchParams(buildParams({ mois: value }), { replace: true });
                setToast(value ? `Devis filtrés sur ${moisLabel(value)}` : "Filtre mois retiré");
              }}
              className="h-9 pl-9 pr-9 rounded-full bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 outline-none focus:border-primary-400 cursor-pointer appearance-none"
              title="Afficher les devis créés sur un mois précis"
              aria-label="Filtrer les devis sur un mois"
            >
              <option value="">Mois : tous</option>
              {moisOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
          </div>
          {pinnedKeys.length > 0 && (
            <button
              type="button"
              onClick={toggleFavoris}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                onlyFavoris
                  ? "bg-accent-500 text-background-50"
                  : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200"
              }`}
              title="N'afficher que les devis nés de vos modèles épinglés en favoris"
            >
              <i className={onlyFavoris ? "ri-star-fill" : "ri-star-line"}></i>
              Favoris seulement
              <span
                className={onlyFavoris ? "text-background-50/80" : "text-foreground-400"}
                title="Devis issus de vos modèles épinglés"
              >
                {favorisCount}
              </span>
            </button>
          )}
          {pinnedKeys.length > 0 && (
            <button
              type="button"
              onClick={clearPins}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-background-100 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 hover:text-accent-700 transition-colors"
              title={`Désépingler d'un coup vos ${pinnedKeys.length} modèle${pinnedKeys.length > 1 ? "s" : ""} favori${pinnedKeys.length > 1 ? "s" : ""}`}
              aria-label="Réinitialiser tous les favoris"
            >
              <i className="ri-star-off-line"></i>
              Réinitialiser les favoris
            </button>
          )}
        </div>

        {tri && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-600">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <i className="ri-sort-asc text-accent-600"></i>
              <strong className="text-foreground-900">{filtered.length}</strong> devis · {triLabel(tri)}
            </span>
            <button
              type="button"
              onClick={() => applyTri("")}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:bg-background-200 hover:text-accent-700 transition-colors"
              title="Retirer le tri actif"
            >
              <i className="ri-close-line"></i>
              Retirer le tri
            </button>
          </div>
        )}

        {/* Vue empilée mobile : l'en-tête de tableau n'est pas visible, on expose donc une barre de tri
            réutilisable avec les mêmes colonnes (client, montant, groupe) et la flèche de sens actif. */}
        <div className="lg:hidden">
          <DevisSortBar tri={tri} onSort={applyTri} />
        </div>

        {(modeleFilter || moisFilter || onlyFavoris || groupeStatut || tri || statut !== "Tous" || periode !== "Tout") && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-lg bg-accent-50 border border-accent-200 animate-fade-in">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-800 whitespace-nowrap">
              <i className="ri-filter-3-line"></i>
              Vue filtrée · partageable
            </span>
            {aFiltresUrl && (
              <>
                <BadgeVuePartagee />
                <BoutonEpinglerVue label="Devis · vue partagée" />
              </>
            )}
            <span className="hidden sm:block w-px h-4 bg-accent-200" aria-hidden="true"></span>
            {modeleFilter && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className="ri-bookmark-3-line text-accent-600"></i>
                {modeleFilter === "__any__"
                  ? "Issus d'un modèle"
                  : modeleKeys.length > 1
                    ? `${modeleKeys.length} modèles`
                    : modeleOptions.find((m) => m.cle === modeleKeys[0])?.nom ?? "1 modèle"}
              </span>
            )}
            {moisFilter && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className="ri-calendar-line text-accent-600"></i>
                <span className="capitalize">{moisLabel(moisFilter)}</span>
              </span>
            )}
            {statut !== "Tous" && (
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
            {onlyFavoris && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className="ri-star-fill text-accent-600"></i>
                Favoris seulement
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent-100 text-accent-800 text-[10px]" title="Devis issus de vos modèles épinglés">
                  {favorisCount}
                </span>
              </span>
            )}
            {groupeStatut && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap">
                <i className={groupeStatut === "signes" ? "ri-checkbox-circle-line text-accent-600" : "ri-time-line text-secondary-600"}></i>
                {groupeStatut === "signes" ? "Signés / acceptés" : "En attente"}
              </span>
            )}
            <span className="text-[11px] text-foreground-500 whitespace-nowrap">
              {filtered.length} devis · {formatEuros(total)} HT
            </span>
            {totalGlobal > 0 && (
              <span
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap"
                title="Écart entre le total HT de la vue filtrée et l'ensemble des devis"
              >
                <i
                  className={
                    ecart < 0 ? "ri-arrow-down-line text-secondary-600" : ecart > 0 ? "ri-arrow-up-line text-accent-600" : "ri-subtract-line text-foreground-400"
                  }
                ></i>
                Écart : {ecart > 0 ? "+" : ecart < 0 ? "−" : ""}
                {formatEuros(Math.abs(ecart))}
                {ecartPct !== 0 && <span className="text-foreground-500">({ecartPct > 0 ? "+" : ""}{ecartPct} %)</span>}
              </span>
            )}
            {repTotal > 0 && (
              <div className="relative group">
                <div
                  className="inline-flex items-center gap-2 h-7 px-2.5 rounded-full bg-background-50 border border-accent-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap"
                  title="Répartition par statut de la vue filtrée : cliquez un groupe pour filtrer la liste"
                >
                  <span className="flex h-1.5 w-16 rounded-full overflow-hidden bg-background-200" aria-hidden="true">
                    <span className="bg-accent-500" style={{ width: `${repSignesPct}%` }}></span>
                    <span className="bg-secondary-500" style={{ width: `${100 - repSignesPct}%` }}></span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleGroupe("signes")}
                    className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full cursor-pointer transition-colors ${
                      groupeStatut === "signes" ? "bg-accent-100 text-accent-800" : "hover:bg-background-200"
                    }`}
                    title="Afficher uniquement les devis signés / acceptés"
                  >
                    <span className="w-2 h-2 rounded-full bg-accent-500" aria-hidden="true"></span>
                    Signés {repSignes}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleGroupe("attente")}
                    className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-full cursor-pointer transition-colors ${
                      groupeStatut === "attente" ? "bg-secondary-100 text-secondary-800" : "hover:bg-background-200"
                    }`}
                    title="Afficher uniquement les devis en attente"
                  >
                    <span className="w-2 h-2 rounded-full bg-secondary-500" aria-hidden="true"></span>
                    En attente {repAttente}
                  </button>
                </div>
                {/* Résumé au survol : taux de signature de la vue filtrée. */}
                <div className="pointer-events-none absolute left-0 bottom-full mb-2 z-20 hidden group-hover:block w-56 p-3 rounded-lg bg-background-50 border border-background-200 text-left">
                  <p className="text-[11px] font-semibold text-foreground-900 mb-1.5 flex items-center gap-1.5">
                    <i className="ri-pie-chart-2-line text-accent-600"></i>
                    Résumé de la vue filtrée
                  </p>
                  <p className="text-[11px] text-foreground-500 mb-2">
                    Taux de signature : <strong className="text-accent-700">{repSignesPct} %</strong>
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-foreground-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-accent-500" aria-hidden="true"></span>
                      Signés / acceptés
                    </span>
                    <span className="font-semibold text-foreground-900">{repSignes}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-foreground-600 mt-1">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-secondary-500" aria-hidden="true"></span>
                      En attente
                    </span>
                    <span className="font-semibold text-foreground-900">{repAttente}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-foreground-500 mt-2 pt-2 border-t border-background-200">
                    <span>Total vue filtrée</span>
                    <span className="font-semibold text-foreground-900">{repTotal}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={copyFilterLink}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                title="Copier un lien partageable contenant le statut, la période, le tri, les filtres modèle + mois + favoris + groupe de statuts"
              >
                <i className="ri-link"></i>
                Copier le lien
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                title="Retirer tous les filtres statut, période, modèle, mois, favoris, groupe de statuts et le tri"
              >
                <i className="ri-filter-off-line"></i>
                Réinitialiser tous les filtres
              </button>
            </div>
          </div>
        )}

        {periode === "Personnalisé" && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 p-4 rounded-lg bg-background-100 border border-background-200 animate-fade-in">
            <div className="flex flex-col gap-1">
              <label htmlFor="devis-date-start" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Du
              </label>
              <input
                id="devis-date-start"
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="devis-date-end" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Au
              </label>
              <input
                id="devis-date-end"
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setCustomEnd(e.target.value)}
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
                ? `Sélection : ${filtered.length} devis · ${formatEuros(total)} HT`
                : "Choisissez une date de début et/ou de fin pour délimiter la période."}
            </p>
          </div>
        )}

        {suivant ? (
          <DevisToRelance aRelancer={aRelancer} jamaisContactes={jamaisContactes} hideLink />
        ) : (
        <div className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
          <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-3 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide bg-background-200/50">
            <span className="col-span-2">Référence</span>
            <span className="col-span-2">
              <button
                type="button"
                onClick={() => toggleColTri("client")}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  tri === "client-asc" || tri === "client-desc" ? "bg-accent-100 text-accent-800" : "hover:bg-background-200 hover:text-foreground-800"
                }`}
                title="Trier la liste par nom de client"
                aria-label="Trier par client"
              >
                Client
                <i className={tri === "client-asc" ? "ri-sort-asc" : tri === "client-desc" ? "ri-sort-desc" : "ri-arrow-up-down-line"}></i>
              </button>
            </span>
            <span className="col-span-3">Objet</span>
            <span className="col-span-2 flex justify-end">
              <button
                type="button"
                onClick={() => toggleColTri("montant")}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  tri === "montant-asc" || tri === "montant-desc" ? "bg-accent-100 text-accent-800" : "hover:bg-background-200 hover:text-foreground-800"
                }`}
                title="Trier la liste par montant HT"
                aria-label="Trier par montant"
              >
                Montant
                <i className={tri === "montant-asc" ? "ri-sort-asc" : tri === "montant-desc" ? "ri-sort-desc" : "ri-arrow-up-down-line"}></i>
              </button>
            </span>
            <span className="col-span-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => applyTri(tri === "signes" ? "attente" : tri === "attente" ? "" : "signes")}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  tri === "signes" || tri === "attente" ? "bg-accent-100 text-accent-800" : "hover:bg-background-200 hover:text-foreground-800"
                }`}
                title="Trier la liste par groupe de statuts (Signés / En attente)"
                aria-label="Trier par groupe de statuts"
              >
                <i
                  className={
                    tri === "signes" ? "ri-sort-asc" : tri === "attente" ? "ri-sort-desc" : "ri-arrow-up-down-line"
                  }
                ></i>
                Groupe
              </button>
              <span>Statut / actions</span>
            </span>
          </div>
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-foreground-500">Aucun devis ne correspond à votre recherche.</p>
          ) : (
            devisAffiches.map((d) => (
              <div
                key={d.id}
                onClick={() => ouvrirDetail(d)}
                className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-3 px-5 py-4 border-t border-background-200 hover:bg-background-50 transition-colors cursor-pointer"
              >
                <span className="lg:col-span-2 flex flex-col items-start gap-1.5 text-sm font-semibold text-foreground-900">
                  <span className="flex items-center gap-2">
                    <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                      Référence
                    </span>
                    <span className="w-7 h-7 flex items-center justify-center rounded-md bg-background-200 text-foreground-600">
                      <i className="ri-file-text-line text-sm"></i>
                    </span>
                    {d.numero}
                  </span>
                  <SignatureBadge signed={Boolean(d.signedAt)} />
                </span>
                <span className="lg:col-span-2 text-sm text-foreground-800">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    Client
                  </span>
                  {d.clientNom ?? "Sans client"}
                </span>
                <span className="lg:col-span-3 text-sm text-foreground-600">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                      Objet
                    </span>
                    <span>{d.objet ?? "—"}</span>
                    {d.modeleNom && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            applyModelFilter(d.modeleCle as string, d.modeleNom as string);
                          }}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold max-w-full cursor-pointer transition-colors ${
                            modeleFilter === d.modeleCle
                              ? "bg-accent-500 text-background-50"
                              : d.modeleCle && pinnedKeys.includes(d.modeleCle)
                                ? "bg-accent-100 text-accent-800 ring-1 ring-accent-300 hover:bg-accent-200"
                                : "bg-accent-100 text-accent-800 hover:bg-accent-200"
                          }`}
                          title={
                            modeleFilter === d.modeleCle
                              ? "Retirer le filtre sur ce modèle"
                              : `Filtrer les devis créés depuis le modèle « ${d.modeleNom} »`
                          }
                          aria-label={`Filtrer les devis créés depuis le modèle ${d.modeleNom}`}
                        >
                          <i className="ri-bookmark-3-line"></i>
                          <span className="truncate">{d.modeleNom}</span>
                        </button>
                        {d.modeleCle && pinnedKeys.includes(d.modeleCle) && (
                          <i
                            className="ri-star-fill text-accent-500 text-[11px]"
                            title="Modèle épinglé en favori"
                            aria-label="Modèle favori"
                          ></i>
                        )}
                      </>
                    )}
                  </span>
                  <span className="block text-[11px] text-foreground-400 mt-0.5">{formatShortDate(d.created_at)}</span>
                </span>
                <span className="lg:col-span-2 text-sm font-semibold text-foreground-950 lg:text-right">
                  <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5">
                    Montant HT
                  </span>
                  {formatEuros(d.total_ht)}
                </span>
                <span className="lg:col-span-3 flex flex-wrap items-center gap-2 lg:justify-end" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={d.statut}
                    onChange={(e) => handleStatut(d.id, e.target.value)}
                    className="h-9 px-2.5 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-700 outline-none focus:border-primary-400 cursor-pointer min-w-0 flex-1 sm:flex-none"
                    title="Changer le statut"
                  >
                    {DEVIS_STATUTS_FORM.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <span className="hidden sm:inline-flex">
                    <StatutBadge label={d.statut} tone={devisStatusTone(d.statut)} />
                  </span>
                  <Infobulle
                    contenu="Envoyer ce devis à plusieurs clients d'un coup : l'outil crée une copie adaptée à chacun et l'expédie."
                    position="haut"
                    largeur={240}
                  >
                    <button
                      type="button"
                      onClick={() => setBroadcastDevisId(d.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-accent-700 cursor-pointer"
                      aria-label="Envoyer le devis à plusieurs clients"
                      title="Envoyer à plusieurs clients"
                    >
                      <i className="ri-mail-add-line"></i>
                    </button>
                  </Infobulle>
                  <Infobulle
                    contenu="Créer une copie de ce devis pour repartir du même contenu, sans tout ressaisir."
                    position="haut"
                    largeur={240}
                  >
                    <button
                      type="button"
                      onClick={() => handleDuplicate(d.id)}
                      disabled={duplicatingId === d.id}
                      className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-primary-700 cursor-pointer disabled:opacity-60"
                      aria-label="Dupliquer le devis"
                      title="Dupliquer ce devis"
                    >
                      {duplicatingId === d.id ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-copy-line"></i>}
                    </button>
                  </Infobulle>
                  <button
                    type="button"
                    onClick={() => {
                      setActionNotice(null);
                      setModeleError(null);
                      setPendingModele({ id: d.id, numero: d.numero, objet: d.objet?.trim() || d.numero });
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-accent-700 cursor-pointer"
                    aria-label="Enregistrer comme modèle"
                    title="Enregistrer comme modèle réutilisable"
                  >
                    <i className="ri-bookmark-line"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ id: d.id, numero: d.numero })}
                    className="w-9 h-9 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-red-600 cursor-pointer"
                    aria-label="Supprimer le devis"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
        )}

        {formOpen && (
          <DevisFormModal
            clients={clients}
            busy={busy}
            onClose={() => setFormOpen(false)}
            onSubmit={handleCreate}
            onQuickCreateClient={handleQuickCreateClient}
          />
        )}

        {detailDevis && (
          <DevisDetailModal
            devis={detailDevis}
            client={clients.find((c) => c.id === detailDevis.client_id) ?? null}
            clients={clients}
            onBroadcast={() => setBroadcastDevisId(detailDevis.id)}
            onClose={() => setDetailId(null)}
            onChanged={reload}
          />
        )}

        {broadcastDevis && (
          <BroadcastDevisModal
            devis={broadcastDevis}
            clients={clients}
            busy={broadcasting}
            onClose={() => setBroadcastDevisId(null)}
            onSubmit={(ids) => handleBroadcast(broadcastDevis.id, ids)}
          />
        )}

        {pendingModele && (
          <EnregistrerModeleModal
            defaultNom={pendingModele.objet}
            busy={savingModele}
            error={modeleError}
            onClose={() => {
              setPendingModele(null);
              setModeleError(null);
            }}
            onSubmit={handleSaveModele}
          />
        )}

        {pendingDelete && (
          <Modal title="Supprimer ce devis ?" onClose={() => setPendingDelete(null)}>
            <p className="text-sm text-foreground-600">
              Le devis <strong className="text-foreground-900">{pendingDelete.numero}</strong> et ses lignes seront définitivement
              supprimés.
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

        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    </DataState>
  );
}