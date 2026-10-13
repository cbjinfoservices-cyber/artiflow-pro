import { useMemo, useState } from "react";
import { devisTemplates } from "@/mocks/app";
import type { DevisModele, LigneInput, ModeleUsage, ModeleUsageEvent } from "@/lib/artisanApi";
import { formatEuros } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import Modal from "@/pages/app/components/Modal";
import EvolutionModelesChart from "@/pages/app/dashboard/components/EvolutionModelesChart";
import ModelSparkline from "@/pages/app/dashboard/components/ModelSparkline";
import RechercheRepliable from "@/components/feature/RechercheRepliable";

interface TemplateOption {
  key: string;
  icon: string;
  label: string;
  lines: number;
  montant: string;
  objet: string;
  lignes: LigneInput[];
  custom: boolean;
  modeleId?: number;
  modele?: DevisModele;
  /** Modèle perso archivé : masqué de la liste active mais conservé pour l'historique. */
  archived: boolean;
}

type Scope = "all" | "custom" | "builtin";
type SortMode = "rentabilite" | "montant_ht" | "tendance" | "recette" | "regularite";

/** Seuils (en jours) proposés pour proposer l'archivage automatique des modèles dormants. */
const STALE_DAY_OPTIONS = [60, 90, 120];
const DEFAULT_STALE_DAYS = 90;
const STALE_DAYS_KEY = "artiflow_stale_days";
const SORT_MODE_KEY = "artiflow_modeles_sort";
const PINNED_KEY = "artiflow_modeles_pinned";

// Styles des médailles du Top 3 : or (accent), argent (secondary), bronze (primary).
const MEDAL_STYLES = [
  { badge: "bg-accent-500 text-background-50", card: "border-accent-300 bg-accent-50", icon: "ri-trophy-line", caption: "Champion" },
  { badge: "bg-secondary-500 text-background-50", card: "border-secondary-200 bg-secondary-50", icon: "ri-medal-line", caption: "2ᵉ place" },
  { badge: "bg-primary-500 text-background-50", card: "border-primary-200 bg-primary-50", icon: "ri-medal-2-line", caption: "3ᵉ place" },
];

// Options de tri de la liste des modèles : rentabilité (usages), montant HT généré
// ou tendance (dynamisme du mois : devis créés ce mois-ci vs le mois dernier).
const SORT_OPTIONS: { id: SortMode; label: string; icon: string }[] = [
  { id: "rentabilite", label: "Rentabilité", icon: "ri-sort-desc" },
  { id: "montant_ht", label: "Montant HT", icon: "ri-money-euro-circle-line" },
  { id: "tendance", label: "Tendance", icon: "ri-line-chart-line" },
  { id: "recette", label: "Recette", icon: "ri-pie-chart-2-line" },
  { id: "regularite", label: "Régularité", icon: "ri-calendar-check-line" },
];

export default function ModelesRapidesPanel({
  modeles,
  loadingModeles,
  usages,
  devisCounts,
  devisTotals,
  devisTrends,
  devisStreaks,
  devisMonthly,
  events,
  loadingEvents,
  notice,
  error,
  onOpen,
  onViewDevis,
  onViewDevisMonth,
  onEditModele,
  onRenameModele,
  onDuplicateModele,
  onDeleteModele,
  onArchiveModele,
  onAutoArchiveStale,
  onArchiveModeles,
}: {
  modeles: DevisModele[];
  loadingModeles: boolean;
  usages: Record<string, ModeleUsage>;
  /** Nombre de devis existants générés depuis chaque modèle (clé de modèle → total). */
  devisCounts: Record<string, number>;
  /** Montant HT total des devis existants générés depuis chaque modèle (clé → somme HT). */
  devisTotals: Record<string, number>;
  /** Tendance : devis créés ce mois-ci vs le mois dernier (clé → { current, previous }). */
  devisTrends: Record<string, { current: number; previous: number }>;
  /** Nombre de mois consécutifs de croissance des devis, ce mois inclus (clé → nb de mois). */
  devisStreaks: Record<string, number>;
  /** Série mensuelle des devis créés sur 12 mois (clé → tableau de 12 valeurs, ancien → récent). */
  devisMonthly: Record<string, number[]>;
  events: ModeleUsageEvent[];
  loadingEvents: boolean;
  notice: string | null;
  error: string | null;
  onOpen: (tpl: { cle: string; objet: string; lignes: LigneInput[]; modeleId?: number; modeleNom: string }) => void;
  /** Ouvre la page Devis déjà filtrée sur un modèle donné (cle + libellé). */
  onViewDevis: (cle: string, nom: string) => void;
  /** Ouvre la page Devis filtrée sur un modèle ET un mois précis (clé mois au format « YYYY-MM »). */
  onViewDevisMonth: (cle: string, nom: string, ym: string) => void;
  onEditModele: (modele: DevisModele) => void;
  onRenameModele: (modele: DevisModele, nom: string) => Promise<void>;
  onDuplicateModele: (modele: DevisModele) => void;
  onDeleteModele: (id: number, nom: string) => void;
  onArchiveModele: (modele: DevisModele, archive: boolean) => void;
  onAutoArchiveStale: (modeles: DevisModele[]) => void;
  /** Archive en une fois la liste de modèles fournie (action groupée). */
  onArchiveModeles: (modeles: DevisModele[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  // Tri choisi (rentabilité ou montant HT), mémorisé comme préférence.
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    try {
      const saved = localStorage.getItem(SORT_MODE_KEY);
      return saved === "montant_ht" || saved === "rentabilite" || saved === "tendance" || saved === "recette" || saved === "regularite" ? saved : "rentabilite";
    } catch {
      return "rentabilite";
    }
  });
  const [showArchived, setShowArchived] = useState(false);
  // Filtre rapide : n'afficher que les modèles qui n'ont généré aucun devis.
  const [onlyNoDevis, setOnlyNoDevis] = useState(false);
  // Filtre rapide : n'afficher que les modèles épinglés en favoris.
  const [onlyPinned, setOnlyPinned] = useState(false);
  // Confirmation de l'archivage groupé des modèles sans aucun devis.
  const [noDevisConfirmOpen, setNoDevisConfirmOpen] = useState(false);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [staleConfirmOpen, setStaleConfirmOpen] = useState(false);
  // Seuil d'archivage automatique réglable (60 / 90 / 120 jours), mémorisé comme préférence.
  const [staleDays, setStaleDays] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(STALE_DAYS_KEY));
      return STALE_DAY_OPTIONS.includes(saved) ? saved : DEFAULT_STALE_DAYS;
    } catch {
      return DEFAULT_STALE_DAYS;
    }
  });

  // Mode comparaison : sélectionner deux modèles pour confronter leurs courbes.
  const [compareMode, setCompareMode] = useState(false);
  const [compareKeys, setCompareKeys] = useState<string[]>([]);
  const [compareNotice, setCompareNotice] = useState<string | null>(null);
  // Clé du modèle dont la mini-courbe est survolée : masque l'infobulle des lignes pour éviter le chevauchement.
  const [sparkHoverKey, setSparkHoverKey] = useState<string | null>(null);

  // Modèles épinglés « favoris » : remontent en tête de liste quel que soit le tri choisi (préférence locale).
  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(PINNED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
    } catch {
      return [];
    }
  });

  // Libellés des 12 derniers mois (du plus ancien au plus récent), alignés sur devisMonthly.
  const monthLong = useMemo(() => {
    const now = new Date();
    const arr: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push(d.toLocaleDateString("fr-FR", { month: "long" }));
    }
    return arr;
  }, []);

  // Clés des 12 derniers mois au format « YYYY-MM », alignées sur devisMonthly et monthLong :
  // servent à filtrer la page Devis sur le mois exact quand on clique une barre de la mini-courbe.
  const monthKeys = useMemo(() => {
    const now = new Date();
    const arr: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return arr;
  }, []);

  // Sélectionne / désélectionne un modèle pour la comparaison (deux modèles au maximum).
  const toggleCompare = (key: string) => {
    setCompareNotice(null);
    setCompareKeys((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 2) {
        setCompareNotice("Deux modèles maximum : retirez-en un pour en comparer un autre.");
        return prev;
      }
      return [...prev, key];
    });
  };

  const exitCompare = () => {
    setCompareMode(false);
    setCompareKeys([]);
    setCompareNotice(null);
  };

  // Copie un lien partageable vers la page Devis, filtrée sur les modèles comparés,
  // pour partager la sélection sans passer par la page Devis.
  const copyCompareLink = async () => {
    if (compareEntries.length === 0) return;
    const keys = compareEntries.map((e) => e.opt.key).join(",");
    const path = window.location.pathname.replace(/\/app\/dashboard\/?$/, "/app/devis");
    const url = `${window.location.origin}${path}?modele=${encodeURIComponent(keys)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCompareNotice("Lien de la sélection copié : partagez-le pour ouvrir la même vue filtrée.");
    } catch {
      setCompareNotice("Copie automatique impossible : ouvrez la page Devis pour copier le lien manuellement.");
    }
  };

  const changeSortMode = (value: SortMode) => {
    setSortMode(value);
    try {
      localStorage.setItem(SORT_MODE_KEY, value);
    } catch {
      /* préférence non persistée */
    }
  };

  // Épingle / désépingle un modèle favori : il remonte en tête de liste indépendamment du tri.
  const togglePin = (key: string) => {
    setPinned((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem(PINNED_KEY, JSON.stringify(next));
      } catch {
        /* préférence non persistée */
      }
      return next;
    });
  };

  // Désépingle tous les modèles favoris d'un seul coup (action groupée du compteur « X favoris »).
  const clearPins = () => {
    setPinned([]);
    setOnlyPinned(false);
    try {
      localStorage.setItem(PINNED_KEY, JSON.stringify([]));
    } catch {
      /* préférence non persistée */
    }
  };

  const changeStaleDays = (value: number) => {
    setStaleDays(value);
    try {
      localStorage.setItem(STALE_DAYS_KEY, String(value));
    } catch {
      /* préférence non persistée */
    }
  };

  const options = useMemo<TemplateOption[]>(() => {
    const builtIn: TemplateOption[] = devisTemplates
      .filter((tpl) => tpl.lignes.length > 0)
      .map((tpl) => ({
        key: `builtin-${tpl.label}`,
        icon: tpl.icon,
        label: tpl.label,
        lines: tpl.lines,
        montant: tpl.montant,
        objet: tpl.objet,
        lignes: tpl.lignes,
        custom: false,
        archived: false,
      }));
    const perso: TemplateOption[] = modeles.map((m) => {
      const ht = m.lignes.reduce((sum, l) => sum + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
      return {
        key: `custom-${m.id}`,
        icon: "ri-bookmark-3-line",
        label: m.nom,
        lines: m.lignes.length,
        montant: `${formatEuros(ht)} HT`,
        objet: m.objet,
        lignes: m.lignes,
        custom: true,
        modeleId: m.id,
        modele: m,
        archived: m.archive,
      };
    });
    // Tri automatique : les modèles les plus utilisés (donc les plus rentables) remontent en haut.
    // À usage égal, on classe par CA cumulé, puis les modèles perso avant les modèles métier.
    return [...perso, ...builtIn].sort((a, b) => {
      const ua = usages[a.key]?.utilisations ?? 0;
      const ub = usages[b.key]?.utilisations ?? 0;
      if (ua !== ub) return ub - ua;
      const ma = usages[a.key]?.montantTotal ?? 0;
      const mb = usages[b.key]?.montantTotal ?? 0;
      if (ma !== mb) return mb - ma;
      if (a.custom !== b.custom) return a.custom ? -1 : 1;
      return a.label.localeCompare(b.label, "fr");
    });
  }, [modeles, usages]);

  // Top 3 des modèles réellement utilisés (au moins un devis créé), classés par usages puis CA.
  const top3 = useMemo(
    () => options.filter((o) => !o.archived && (usages[o.key]?.utilisations ?? 0) > 0).slice(0, 3),
    [options, usages],
  );

  // Compteur global : nombre de modèles actifs et montant HT total généré (tous devis confondus).
  const activeCount = useMemo(() => options.filter((o) => !o.archived).length, [options]);
  const totalHt = useMemo(
    () => Object.values(devisTotals).reduce((sum, v) => sum + (Number(v) || 0), 0),
    [devisTotals],
  );

  // Comparatif Perso vs Métier : part des usages et part du CA généré par chaque camp.
  const comparison = useMemo(() => {
    const aggregate = (custom: boolean) => {
      const list = options.filter((o) => o.custom === custom && !o.archived);
      return {
        count: list.length,
        utilisations: list.reduce((s, o) => s + (usages[o.key]?.utilisations ?? 0), 0),
        ca: list.reduce((s, o) => s + (usages[o.key]?.montantTotal ?? 0), 0),
      };
    };
    const perso = aggregate(true);
    const metier = aggregate(false);
    const totalU = perso.utilisations + metier.utilisations;
    const totalCa = perso.ca + metier.ca;
    return {
      perso,
      metier,
      totalU,
      totalCa,
      persoPctU: totalU ? Math.round((perso.utilisations / totalU) * 100) : 0,
      persoPctCa: totalCa ? Math.round((perso.ca / totalCa) * 100) : 0,
    };
  }, [options, usages]);

  // Modèles perso actifs non utilisés (ou jamais utilisés) au-delà du seuil choisi :
  // proposés à l'archivage automatique pour désencombrer la liste, sans rien supprimer.
  const staleModeles = useMemo(() => {
    const seuil = Date.now() - staleDays * 24 * 60 * 60 * 1000;
    return modeles.filter((m) => {
      if (m.archive) return false;
      const derniere = usages[`custom-${m.id}`]?.derniere;
      const reference = derniere ? new Date(derniere).getTime() : new Date(m.created_at).getTime();
      return Number.isFinite(reference) && reference < seuil;
    });
  }, [modeles, usages, staleDays]);

  // Filtre (vue actifs/archives + recherche + onglet + filtre sans devis) puis tri selon le mode choisi.
  const listForView = (view: "active" | "archived") => {
    const q = query.trim().toLowerCase();
    const list = options.filter((opt) => {
      // Vue « actifs » ou vue « archives » : jamais mélangées.
      if (view === "archived" ? !opt.archived : opt.archived) return false;
      if (scope === "custom" && !opt.custom) return false;
      if (scope === "builtin" && opt.custom) return false;
      if (view === "active" && onlyNoDevis && (devisCounts[opt.key] ?? 0) > 0) return false;
      if (onlyPinned && !pinned.includes(opt.key)) return false;
      if (!q) return true;
      const haystack = [opt.label, opt.objet, ...opt.lignes.map((l) => l.designation)].join(" ").toLowerCase();
      return haystack.includes(q);
    });
    // Tri explicite par montant HT réellement généré (les devis existants, pas le cumul d'usage).
    let sorted: TemplateOption[] = list;
    if (sortMode === "montant_ht") {
      sorted = [...list].sort((a, b) => (devisTotals[b.key] ?? 0) - (devisTotals[a.key] ?? 0));
    } else if (sortMode === "tendance") {
      // Tri par tendance : dynamisme du mois = progression des devis créés ce mois-ci vs le mois dernier.
      const score = (key: string) => {
        const t = devisTrends[key];
        const current = t?.current ?? 0;
        const previous = t?.previous ?? 0;
        return { delta: current - previous, current };
      };
      sorted = [...list].sort((a, b) => {
        const sa = score(a.key);
        const sb = score(b.key);
        if (sb.delta !== sa.delta) return sb.delta - sa.delta;
        return sb.current - sa.current;
      });
    } else if (sortMode === "recette") {
      // Tri par recette : contribution au CA total généré (part du CA), du plus fort au plus faible.
      sorted = [...list].sort((a, b) => (devisTotals[b.key] ?? 0) - (devisTotals[a.key] ?? 0));
    } else if (sortMode === "regularite") {
      // Tri par régularité : modèles générant des devis de façon stable mois après mois.
      // Score = nombre de mois actifs sur les 12 derniers, départagé par le volume total.
      const score = (key: string) => {
        const series = devisMonthly[key] ?? [];
        return { active: series.filter((v) => v > 0).length, total: series.reduce((a, b) => a + b, 0) };
      };
      sorted = [...list].sort((a, b) => {
        const sa = score(a.key);
        const sb = score(b.key);
        if (sb.active !== sa.active) return sb.active - sa.active;
        return sb.total - sa.total;
      });
    }
    // Les modèles épinglés « favoris » remontent en tête quel que soit le tri (tri stable).
    if (pinned.length > 0) {
      sorted = [...sorted].sort((a, b) => {
        const pa = pinned.includes(a.key) ? 0 : 1;
        const pb = pinned.includes(b.key) ? 0 : 1;
        return pa - pb;
      });
    }
    return sorted;
  };

  const filtered = useMemo(
    () => listForView(showArchived ? "archived" : "active"),
    [options, query, scope, showArchived, sortMode, devisTotals, devisCounts, onlyNoDevis, onlyPinned, devisTrends, devisMonthly, pinned],
  );

  // Compteurs des onglets, calculés sur la vue courante (actifs ou archives).
  const archivedCount = options.filter((o) => o.archived).length;
  const viewOptions = options.filter((o) => (showArchived ? o.archived : !o.archived));
  const persoCount = viewOptions.filter((o) => o.custom).length;
  const builtinCount = viewOptions.length - persoCount;
  const noDevisCount = viewOptions.filter((o) => (devisCounts[o.key] ?? 0) === 0).length;
  // Modèles épinglés favoris présents dans la vue courante (actifs ou archives).
  const pinnedCount = viewOptions.filter((o) => pinned.includes(o.key)).length;
  // Modèles perso actifs sans aucun devis : cibles de l'archivage groupé en un clic.
  const noDevisModeles = useMemo(
    () => viewOptions.filter((o) => o.custom && o.modele && (devisCounts[o.key] ?? 0) === 0).map((o) => o.modele as DevisModele),
    [viewOptions, devisCounts],
  );

  // Données des modèles sélectionnés pour le mode comparaison (séries, dynamisme, meilleur mois).
  const compareEntries = useMemo(
    () =>
      compareKeys
        .map((k) => options.find((o) => o.key === k))
        .filter((o): o is TemplateOption => Boolean(o))
        .map((o) => {
          const monthly = devisMonthly[o.key] ?? [];
          const trend = devisTrends[o.key] ?? { current: 0, previous: 0 };
          const total12 = monthly.reduce((a, b) => a + b, 0);
          const bestIndex = monthly.length ? monthly.reduce((bi, v, i) => (v > monthly[bi] ? i : bi), 0) : 0;
          const best = monthly[bestIndex] ?? 0;
          return { opt: o, monthly, trend, total12, delta: trend.current - trend.previous, bestIndex, best };
        }),
    [compareKeys, options, devisMonthly, devisTrends],
  );

  // Export CSV d'une vue donnée (actifs ou archives), avec recherche / onglet / filtre / tri appliqués.
  const exportView = (view: "active" | "archived") => {
    const list = listForView(view);
    if (list.length === 0) {
      setExportNotice(view === "archived" ? "Aucun modèle archivé à exporter." : "Aucun modèle actif à exporter.");
      return;
    }
    const headers = ["Modèle", "Type", "Vue", "Nb de lignes", "Utilisations", "CA généré (€ HT)", "Montant HT devis (€)", "Objet"];
    const rows = list.map((o) => {
      const u = usages[o.key];
      return [
        o.label,
        o.custom ? "Perso" : "Métier",
        view === "archived" ? "Archivé" : "Actif",
        o.lines,
        u?.utilisations ?? 0,
        Number(u?.montantTotal ?? 0).toFixed(2),
        Number(devisTotals[o.key] ?? 0).toFixed(2),
        o.objet,
      ];
    });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`modeles-devis_${view === "archived" ? "archives" : "actifs"}_${stamp}.csv`, toCsv(headers, rows));
    setExportNotice(`${list.length} modèle(s) ${view === "archived" ? "archivé(s)" : "actif(s)"} exporté(s) au format CSV.`);
  };

  const startRename = (opt: TemplateOption) => {
    if (!opt.modele) return;
    setRenameValue(opt.label);
    setRenamingKey(opt.key);
  };

  const cancelRename = () => {
    setRenamingKey(null);
    setRenameValue("");
  };

  const submitRename = async (opt: TemplateOption) => {
    if (!opt.modele) return;
    const nom = renameValue.trim();
    if (!nom || nom === opt.label) {
      cancelRename();
      return;
    }
    cancelRename();
    await onRenameModele(opt.modele, nom);
  };

  const scopes: { id: Scope; label: string; count: number }[] = [
    { id: "all", label: "Tous", count: viewOptions.length },
    { id: "custom", label: "Perso", count: persoCount },
    { id: "builtin", label: "Métier", count: builtinCount },
  ];

  return (
    <div className="p-5 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h2 className="font-heading font-semibold text-base text-foreground-950">Modèles de devis rapides</h2>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowArchived((v) => !v);
                setScope("all");
              }}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                showArchived
                  ? "bg-accent-500 text-background-50 hover:bg-accent-600"
                  : "bg-background-200 text-foreground-700 hover:bg-background-300"
              }`}
              title="Afficher ou masquer les modèles archivés"
            >
              <i className={showArchived ? "ri-arrow-left-line" : "ri-archive-line"}></i>
              {showArchived ? "Modèles actifs" : `Archives (${archivedCount})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => exportView("active")}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              !showArchived
                ? "bg-primary-500 text-background-50 hover:bg-primary-600"
                : "bg-background-200 text-foreground-700 hover:bg-background-300"
            }`}
            title="Exporter la liste des modèles actifs (recherche et filtres appliqués) au format CSV"
          >
            <i className="ri-download-2-line"></i>
            Exporter les actifs
          </button>
          <button
            type="button"
            onClick={() => exportView("archived")}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              showArchived
                ? "bg-primary-500 text-background-50 hover:bg-primary-600"
                : "bg-background-200 text-foreground-700 hover:bg-background-300"
            }`}
            title="Exporter la liste des modèles archivés (recherche et filtres appliqués) au format CSV"
          >
            <i className="ri-archive-line"></i>
            Exporter les archives
          </button>
        </div>
      </div>
      <p className="text-xs text-foreground-500 mb-3">
        Générez un devis à partir d'un modèle métier ou de vos propres modèles. Triez-les par rentabilité, montant HT, tendance du mois,
        recette ou régularité, puis exportez en CSV les actifs ou les archives séparément.
      </p>

      {/* Compteur global cliquable : nombre de modèles et montant HT total, ouvre les devis issus d'un modèle. */}
      <button
        type="button"
        onClick={() => onViewDevis("__any__", "tous les modèles")}
        className="group/counter mb-3 flex flex-wrap items-center gap-2 text-xs text-left cursor-pointer"
        title="Voir tous les devis créés depuis un modèle"
      >
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background-50 border border-background-200 text-foreground-700 font-semibold group-hover/counter:border-primary-300 transition-colors">
          <i className="ri-layout-grid-line text-primary-600"></i>
          {activeCount} modèle{activeCount > 1 ? "s" : ""}
        </span>
        <span className="text-foreground-400">·</span>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-100 text-accent-800 font-semibold group-hover/counter:bg-accent-200 transition-colors"
          title="Somme des montants HT des devis issus de l'ensemble des modèles"
        >
          <i className="ri-money-euro-circle-line"></i>
          {formatEuros(totalHt)} HT générés au total
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 group-hover/counter:underline">
          <i className="ri-arrow-right-line"></i>
          Voir les devis
        </span>
      </button>

      {/* Réglage du seuil d'archivage automatique des modèles dormants. */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-500">
          <i className="ri-timer-line"></i>
          Suggérer l'archivage auto après
        </span>
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-50 border border-background-200">
          {STALE_DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => changeStaleDays(d)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                staleDays === d ? "bg-secondary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
              title={`Proposer l'archivage des modèles non utilisés depuis plus de ${d} jours`}
            >
              {d} j
            </button>
          ))}
        </div>
      </div>

      {/* Suggestion d'archivage automatique : modèles dormants au-delà du seuil choisi. */}
      {staleModeles.length > 0 && !showArchived && (
        <div className="mb-4 p-3 rounded-md bg-secondary-50 border border-secondary-200 flex items-start gap-3">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
            <i className="ri-archive-line"></i>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground-950">
              {staleModeles.length} modèle{staleModeles.length > 1 ? "s" : ""} non utilisé{staleModeles.length > 1 ? "s" : ""} depuis
              plus de {staleDays} jours
            </p>
            <p className="text-xs text-foreground-600 mt-0.5">
              Un coup d'œil, un clic : les archiver les retire de la liste active sans rien supprimer (restaurables à tout moment).
            </p>
            <button
              type="button"
              onClick={() => setStaleConfirmOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors"
            >
              <i className="ri-archive-2-line"></i>
              Proposer l'archivage
            </button>
          </div>
        </div>
      )}

      {/* Top 3 mis en avant avec médailles pour repérer les champions d'un coup d'œil. */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 h-6 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
            <i className="ri-trophy-line text-sm"></i>
          </span>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-700">Top 3 des modèles</h3>
        </div>
        {top3.length === 0 ? (
          <p className="text-xs text-foreground-500 flex items-center gap-1.5 px-3 py-3 rounded-md bg-background-50 border border-dashed border-background-200">
            <i className="ri-medal-line"></i>
            Créez un devis depuis un modèle pour voir votre podium se remplir.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {top3.map((opt, i) => {
              const style = MEDAL_STYLES[i];
              const u = usages[opt.key];
              const count = u?.utilisations ?? 0;
              const htGenere = devisTotals[opt.key] ?? 0;
              return (
                <div
                  key={opt.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => onViewDevis(opt.key, opt.label)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onViewDevis(opt.key, opt.label);
                    }
                  }}
                  className={`relative flex flex-col items-start text-left p-3 rounded-md border ${style.card} cursor-pointer hover:brightness-[0.98] transition-all`}
                  title={`${opt.label} · ${count} utilisation(s) · ${formatEuros(htGenere)} HT générés · voir les devis`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen({ cle: opt.key, objet: opt.objet, lignes: opt.lignes, modeleId: opt.modeleId, modeleNom: opt.label });
                    }}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-background-50 text-foreground-500 hover:bg-primary-100 hover:text-primary-700 cursor-pointer"
                    aria-label={`Créer un devis depuis le modèle ${opt.label}`}
                    title="Créer un devis depuis ce modèle"
                  >
                    <i className="ri-add-line text-sm"></i>
                  </button>
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full ${style.badge}`}>
                    <i className={`${style.icon} text-sm`}></i>
                  </span>
                  <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-500">{style.caption}</span>
                  <span className="mt-0.5 text-sm font-semibold text-foreground-950 truncate w-full" title={opt.label}>
                    {opt.label}
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-background-50 text-foreground-800 text-[10px] font-semibold">
                      <i className="ri-repeat-line"></i>
                      {count}×
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-background-50 text-foreground-800 text-[10px] font-semibold"
                      title="Montant HT total généré par les devis issus de ce modèle"
                    >
                      <i className="ri-money-euro-circle-line"></i>
                      {formatEuros(htGenere)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparatif Perso vs Métier : petit résumé du taux d'utilisation. */}
      <div className="mb-4 p-3 rounded-md bg-background-50 border border-background-200">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-700">Perso vs Métier</h3>
          <span className="text-[10px] text-foreground-500">{comparison.totalU} utilisation(s) au total</span>
        </div>
        {comparison.totalU === 0 ? (
          <p className="text-xs text-foreground-500">Aucune utilisation encore enregistrée pour comparer vos deux familles de modèles.</p>
        ) : (
          <>
            <div className="flex h-2 rounded-full overflow-hidden bg-background-200 mb-3">
              <span className="bg-accent-500" style={{ width: `${comparison.persoPctU}%` }}></span>
              <span className="bg-primary-500" style={{ width: `${100 - comparison.persoPctU}%` }}></span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent-500"></span>
                  Perso
                </span>
                <span className="text-[11px] text-foreground-500">
                  {comparison.perso.count} modèle(s) · {comparison.perso.utilisations} usage(s) · {comparison.persoPctU}% des usages
                </span>
                <span className="text-[11px] text-foreground-700 font-medium">{formatEuros(comparison.perso.ca)} générés</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-900">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary-500"></span>
                  Métier
                </span>
                <span className="text-[11px] text-foreground-500">
                  {comparison.metier.count} modèle(s) · {comparison.metier.utilisations} usage(s) · {100 - comparison.persoPctU}% des usages
                </span>
                <span className="text-[11px] text-foreground-700 font-medium">{formatEuros(comparison.metier.ca)} générés</span>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-foreground-600">
              {comparison.perso.utilisations >= comparison.metier.utilisations
                ? `Vos modèles perso tirent l'activité : ${comparison.persoPctU}% des usages et ${comparison.persoPctCa}% du CA généré.`
                : `Les modèles métier restent les plus utilisés : ${100 - comparison.persoPctU}% des usages, contre ${comparison.persoPctU}% pour vos modèles perso.`}
            </p>
          </>
        )}
      </div>

      {/* Évolution mensuelle des usages : tendance dans le temps, modèle par modèle. */}
      <EvolutionModelesChart
        events={events}
        loading={loadingEvents}
        series={options.filter((o) => !o.archived).map((o) => ({ key: o.key, label: o.label }))}
      />

      {/* Recherche + filtre perso / métier */}
      <div className="flex flex-wrap flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <RechercheRepliable
          carteId="modeles-rapides"
          carteLabel="Modèles rapides"
          value={query}
          onChange={setQuery}
          placeholder="Rechercher un modèle…"
          conteneurClassName="flex-1 min-w-0"
        />
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-50 border border-background-200 shrink-0">
          {scopes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScope(s.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                scope === s.id ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {s.label}
              <span className={scope === s.id ? "text-background-50/80" : "text-foreground-400"}>{s.count}</span>
            </button>
          ))}
        </div>
        <div
          className="inline-flex items-center gap-1 p-1 rounded-full bg-background-50 border border-background-200 shrink-0"
          title="Choisir le tri des modèles"
        >
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => changeSortMode(s.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                sortMode === s.id ? "bg-accent-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              <i className={s.icon}></i>
              {s.label}
            </button>
          ))}
        </div>
        {pinned.length > 0 && (
          <button
            type="button"
            onClick={clearPins}
            className="group/pins inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-accent-100 text-accent-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors shrink-0"
            title={`Désépingler d'un coup les ${pinned.length} modèle${pinned.length > 1 ? "s" : ""} favori${pinned.length > 1 ? "s" : ""}`}
            aria-label="Désépingler tous les modèles favoris"
          >
            <i className="ri-star-fill"></i>
            {pinned.length} favori{pinned.length > 1 ? "s" : ""}
            <i className="ri-close-line opacity-60 group-hover/pins:opacity-100"></i>
          </button>
        )}
        <button
          type="button"
          onClick={() => (compareMode ? exitCompare() : setCompareMode(true))}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
            compareMode
              ? "bg-primary-500 text-background-50"
              : "bg-background-50 border border-background-200 text-foreground-600 hover:bg-background-200"
          }`}
          title="Comparer deux modèles côte à côte"
        >
          <i className="ri-arrow-left-right-line"></i>
          Comparer
          <span className={compareMode ? "text-background-50/80" : "text-foreground-400"}>{compareKeys.length}/2</span>
        </button>
        <button
          type="button"
          onClick={() => setOnlyPinned((v) => !v)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
            onlyPinned
              ? "bg-accent-500 text-background-50"
              : "bg-background-50 border border-background-200 text-foreground-600 hover:bg-background-200"
          }`}
          title="N'afficher que les modèles épinglés en favoris"
        >
          <i className={onlyPinned ? "ri-star-fill" : "ri-star-line"}></i>
          Favoris seulement
          <span className={onlyPinned ? "text-background-50/80" : "text-foreground-400"}>{pinnedCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setOnlyNoDevis((v) => !v)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
            onlyNoDevis
              ? "bg-primary-500 text-background-50"
              : "bg-background-50 border border-background-200 text-foreground-600 hover:bg-background-200"
          }`}
          title="N'afficher que les modèles qui n'ont généré aucun devis"
        >
          <i className="ri-filter-off-line"></i>
          Sans devis
          <span className={onlyNoDevis ? "text-background-50/80" : "text-foreground-400"}>{noDevisCount}</span>
        </button>
        {!showArchived && onlyNoDevis && noDevisModeles.length > 0 && (
          <button
            type="button"
            onClick={() => setNoDevisConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors shrink-0"
            title="Archiver d'un coup tous vos modèles sans aucun devis"
          >
            <i className="ri-archive-2-line"></i>
            Archiver les {noDevisModeles.length}
          </button>
        )}
      </div>

      {notice && (
        <p className="mb-3 text-xs text-accent-700 flex items-center gap-1.5">
          <i className="ri-checkbox-circle-line"></i>
          {notice}
        </p>
      )}
      {exportNotice && (
        <p className="mb-3 text-xs text-primary-700 flex items-center gap-1.5">
          <i className="ri-download-2-line"></i>
          {exportNotice}
        </p>
      )}
      {error && (
        <p className="mb-3 text-xs text-red-600 flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {error}
        </p>
      )}

      {/* Mode comparaison : deux modèles côte à côte avec l'écart de dynamisme. */}
      {compareMode && (
        <div className="mb-4 p-4 rounded-md bg-background-50 border border-primary-200">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
                <i className="ri-arrow-left-right-line"></i>
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground-950">Comparaison de dynamisme</h3>
                <p className="text-[11px] text-foreground-500">
                  {compareEntries.length === 0
                    ? "Sélectionnez deux modèles dans la liste pour confronter leurs courbes."
                    : compareEntries.length === 1
                      ? "Sélectionnez un second modèle pour lancer la comparaison."
                      : "Deux modèles comparés côte à côte."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {compareEntries.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onViewDevis(
                        compareEntries.map((e) => e.opt.key).join(","),
                        compareEntries.map((e) => e.opt.label).join(" et "),
                      )
                    }
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                    title="Ouvrir la page Devis filtrée sur les modèles comparés"
                  >
                    <i className="ri-file-text-line"></i>
                    Voir les devis
                  </button>
                  <button
                    type="button"
                    onClick={copyCompareLink}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors"
                    title="Copier un lien partageable vers les devis de cette sélection"
                  >
                    <i className="ri-link"></i>
                    Copier le lien
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={exitCompare}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-300 transition-colors shrink-0"
              >
                <i className="ri-close-line"></i>
                Quitter
              </button>
            </div>
          </div>

          {compareEntries.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {compareEntries.map((e) => (
                <div key={e.opt.key} className="p-3 rounded-md bg-background-100 border border-background-200">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-md ${
                          e.opt.custom ? "bg-accent-100 text-accent-700" : "bg-primary-100 text-primary-700"
                        }`}
                      >
                        <i className={e.opt.icon}></i>
                      </span>
                      <span className="text-sm font-semibold text-foreground-950 truncate" title={e.opt.label}>
                        {e.opt.label}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleCompare(e.opt.key)}
                      className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:bg-background-200 hover:text-foreground-700 cursor-pointer"
                      aria-label={`Retirer ${e.opt.label} de la comparaison`}
                      title="Retirer de la comparaison"
                    >
                      <i className="ri-close-line text-sm"></i>
                    </button>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <ModelSparkline
                      values={e.monthly}
                      labels={monthLong}
                      size="lg"
                      tone={e.opt.custom ? "accent" : "primary"}
                      peakIndex={e.bestIndex}
                      onBarClick={(i) => onViewDevisMonth(e.opt.key, e.opt.label, monthKeys[i])}
                    />
                    <span className="text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          e.delta >= 0 ? "bg-accent-100 text-accent-800" : "bg-background-200 text-red-600"
                        }`}
                      >
                        <i className={e.delta >= 0 ? "ri-arrow-up-line" : "ri-arrow-down-line"}></i>
                        {e.delta > 0 ? "+" : ""}
                        {e.delta} ce mois
                      </span>
                      <span className="block mt-1 text-[11px] text-foreground-500 whitespace-nowrap">
                        {e.trend.current} ce mois · {e.trend.previous} le mois dernier
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-background-200 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                    <span className="text-foreground-500">Devis (12 mois)</span>
                    <span className="text-right font-semibold text-foreground-900">{e.total12}</span>
                    <span className="text-foreground-500">Meilleur mois</span>
                    <span className="text-right font-semibold text-foreground-900">
                      {e.best > 0 ? (
                        <>
                          <span className="capitalize">{monthLong[e.bestIndex]}</span> ({e.best})
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="text-foreground-500">Part du CA</span>
                    <span className="text-right font-semibold text-foreground-900">
                      {totalHt > 0 ? Math.round(((devisTotals[e.opt.key] ?? 0) / totalHt) * 100) : 0} %
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {compareEntries.length === 2 && (
            <div className="mt-3 p-3 rounded-md bg-primary-50 border border-primary-200 flex items-center gap-3">
              <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <i className="ri-scales-3-line"></i>
              </span>
              <p className="text-xs text-foreground-700">
                {(() => {
                  const [a, b] = compareEntries;
                  const gap = a.delta - b.delta;
                  if (gap === 0) {
                    return "Les deux modèles affichent exactement le même dynamisme ce mois-ci.";
                  }
                  const lead = gap > 0 ? a : b;
                  const behind = gap > 0 ? b : a;
                  return (
                    <>
                      <strong className="text-foreground-950">{lead.opt.label}</strong> mène avec un dynamisme de{" "}
                      <strong className="text-primary-700">
                        {lead.delta > 0 ? "+" : ""}
                        {lead.delta} devis
                      </strong>{" "}
                      ce mois-ci, soit un écart de <strong className="text-primary-700">{Math.abs(gap)} devis</strong> devant{" "}
                      <strong className="text-foreground-950">{behind.opt.label}</strong>.
                    </>
                  );
                })()}
              </p>
            </div>
          )}

          {compareNotice && (
            <p className="mt-3 text-[11px] text-secondary-800 flex items-center gap-1.5">
              <i className="ri-information-line"></i>
              {compareNotice}
            </p>
          )}
        </div>
      )}

      {loadingModeles && (
        <p className="mb-3 text-xs text-foreground-500 flex items-center gap-1.5">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement de vos modèles…
        </p>
      )}

      <div className="flex flex-col gap-2">
        {filtered.length === 0 && !loadingModeles && (
          <div className="flex flex-col items-center text-center py-8 rounded-md bg-background-50 border border-dashed border-background-200">
            <span className="w-10 h-10 flex items-center justify-center rounded-full bg-background-200 text-foreground-500">
              <i className={showArchived ? "ri-archive-line" : "ri-search-eye-line"}></i>
            </span>
            <p className="mt-3 text-sm text-foreground-600">
              {showArchived
                ? "Aucun modèle archivé pour l'instant."
                : "Aucun modèle ne correspond à votre recherche."}
            </p>
            {(query || scope !== "all" || showArchived || onlyPinned || onlyNoDevis) && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setScope("all");
                  setShowArchived(false);
                  setOnlyPinned(false);
                  setOnlyNoDevis(false);
                }}
                className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold cursor-pointer hover:bg-secondary-200 whitespace-nowrap"
              >
                <i className="ri-refresh-line"></i> Réinitialiser les filtres
              </button>
            )}
          </div>
        )}

        {filtered.map((opt) => {
          const usage = usages[opt.key];
          const count = usage?.utilisations ?? 0;
          const ca = usage?.montantTotal ?? 0;
          const nbDevis = devisCounts[opt.key] ?? 0;
          const nbDevisHt = devisTotals[opt.key] ?? 0;
          const trend = devisTrends[opt.key];
          const monthly = devisMonthly[opt.key] ?? [];
          const activeMonths = monthly.filter((v) => v > 0).length;
          const isRenaming = renamingKey === opt.key;
          const isSelected = compareKeys.includes(opt.key);
          const hasMonthlyActivity = monthly.some((v) => v > 0);
          const bestIndex = monthly.length ? monthly.reduce((bi, v, i) => (v > monthly[bi] ? i : bi), 0) : 0;
          const bestValue = monthly[bestIndex] ?? 0;
          const bestMonthLabel = monthLong[bestIndex] ?? "";
          const activate = () => {
            if (compareMode) {
              toggleCompare(opt.key);
            } else {
              onOpen({ cle: opt.key, objet: opt.objet, lignes: opt.lignes, modeleId: opt.modeleId, modeleNom: opt.label });
            }
          };
          return (
            <div key={opt.key} className="relative group">
              <div className="flex items-center gap-2">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={activate}
                  onKeyDown={(e) => {
                    if (isRenaming) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      activate();
                    }
                  }}
                  aria-pressed={compareMode ? isSelected : undefined}
                  className={`flex-1 flex items-center gap-3 p-3 rounded-md border text-left cursor-pointer transition-colors ${
                    compareMode && isSelected
                      ? "border-primary-400 bg-primary-50"
                      : "bg-background-50 border-background-200 hover:border-primary-300"
                  }`}
                >
                  {compareMode ? (
                    <span
                      className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-md border transition-colors ${
                        isSelected
                          ? "bg-primary-500 border-primary-500 text-background-50"
                          : "bg-background-50 border-background-300 text-foreground-400"
                      }`}
                      aria-hidden="true"
                    >
                      <i className={isSelected ? "ri-checkbox-circle-fill" : "ri-checkbox-blank-circle-line"}></i>
                    </span>
                  ) : (
                    <span
                      className={`w-9 h-9 flex items-center justify-center rounded-md ${
                        opt.custom ? "bg-accent-100 text-accent-700" : "bg-primary-100 text-primary-700"
                      }`}
                    >
                      <i className={opt.icon}></i>
                    </span>
                  )}
                  <span className="flex-1 min-w-0">
                    {isRenaming ? (
                      <span
                        className="flex items-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              submitRename(opt);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              cancelRename();
                            }
                          }}
                          maxLength={120}
                          className="flex-1 min-w-0 h-8 px-2 rounded-md bg-background-50 border border-primary-400 text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            submitRename(opt);
                          }}
                          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-primary-500 text-background-50 cursor-pointer hover:bg-primary-600"
                          aria-label="Valider le nouveau nom"
                        >
                          <i className="ri-check-line text-sm"></i>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelRename();
                          }}
                          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-foreground-500 hover:bg-background-200 cursor-pointer"
                          aria-label="Annuler le renommage"
                        >
                          <i className="ri-close-line text-sm"></i>
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 flex-wrap">
                        {opt.custom && opt.modele ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(opt);
                            }}
                            className="text-sm font-medium text-foreground-900 truncate text-left cursor-text hover:text-primary-700 hover:underline decoration-dotted decoration-foreground-300 underline-offset-2"
                            title="Cliquer pour renommer ce modèle"
                          >
                            {opt.label}
                          </button>
                        ) : (
                          <span className="block text-sm font-medium text-foreground-900 truncate">{opt.label}</span>
                        )}
                        {opt.custom && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold uppercase tracking-wide">
                            Perso
                          </span>
                        )}
                        {pinned.includes(opt.key) && (
                          <span
                            className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-semibold uppercase tracking-wide"
                            title="Modèle épinglé : il reste en haut de la liste quel que soit le tri"
                          >
                            <i className="ri-star-fill"></i>
                            Favori
                          </span>
                        )}
                        {nbDevis > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewDevis(opt.key, opt.label);
                            }}
                            className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-background-200 text-foreground-700 text-[10px] font-semibold cursor-pointer hover:bg-primary-100 hover:text-primary-800 transition-colors"
                            title={`Voir les ${nbDevis} devis créés depuis ce modèle${nbDevisHt > 0 ? ` · ${formatEuros(nbDevisHt)} HT au total` : ""}`}
                          >
                            <i className="ri-file-text-line"></i>
                            {nbDevis} devis
                            {nbDevisHt > 0 && <span className="text-foreground-500">· {formatEuros(nbDevisHt)} HT</span>}
                          </button>
                        )}
                        {nbDevisHt > 0 && totalHt > 0 && (
                          <span
                            className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold"
                            title={`Ce modèle représente ${Math.round((nbDevisHt / totalHt) * 100)} % du CA total généré par l'ensemble des modèles`}
                          >
                            <i className="ri-pie-chart-2-line"></i>
                            {Math.round((nbDevisHt / totalHt) * 100)} % du CA
                          </span>
                        )}
                        {count > 0 && (
                          <span
                            className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold"
                            title={`${count} utilisation(s) cumulée(s) de ce modèle`}
                          >
                            <i className="ri-repeat-line"></i>
                            {count}×
                          </span>
                        )}
                        {trend && trend.current + trend.previous > 0 && (
                          <span
                            className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              trend.current === trend.previous
                                ? "bg-background-200 text-foreground-600"
                                : trend.current > trend.previous
                                  ? "bg-accent-100 text-accent-800"
                                  : "bg-background-200 text-red-600"
                            }`}
                            title={`${trend.current} devis créé(s) ce mois-ci · ${trend.previous} le mois dernier`}
                          >
                            <i
                              className={
                                trend.current === trend.previous
                                  ? "ri-arrow-right-line"
                                  : trend.current > trend.previous
                                    ? "ri-arrow-up-line"
                                    : "ri-arrow-down-line"
                              }
                            ></i>
                            {trend.current === trend.previous ? "=" : `${trend.current - trend.previous > 0 ? "+" : ""}${trend.current - trend.previous}`}
                          </span>
                        )}
                        {trend && trend.previous === 0 && trend.current > 0 && (
                          <span
                            className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-semibold uppercase tracking-wide"
                            title={`Ce modèle décolle pour la première fois : ${trend.current} devis créé(s) ce mois-ci, aucun le mois dernier`}
                          >
                            <i className="ri-sparkling-2-line"></i>
                            Nouveau ce mois
                          </span>
                        )}
                        {(devisStreaks[opt.key] ?? 0) >= 2 && (
                          <span
                            className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-accent-600 text-background-50 text-[10px] font-semibold uppercase tracking-wide"
                            title={`Croissance confirmée : le nombre de devis augmente depuis ${devisStreaks[opt.key]} mois consécutifs`}
                          >
                            <i className="ri-fire-line"></i>
                            En croissance · {devisStreaks[opt.key]} mois
                          </span>
                        )}
                        {activeMonths >= 2 && (
                          <span
                            className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold"
                            title={`Modèle régulier : génère des devis sur ${activeMonths} des 12 derniers mois`}
                          >
                            <i className="ri-calendar-check-line"></i>
                            Régulier · {activeMonths}/12
                          </span>
                        )}
                        {hasMonthlyActivity && (
                          <span
                            className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-background-50 border border-primary-200 text-primary-800 text-[10px] font-semibold"
                            title={`Meilleur mois : ${bestValue} devis créés en ${bestMonthLabel}`}
                          >
                            <i className="ri-bar-chart-2-line"></i>
                            Pic · <span className="capitalize">{bestMonthLabel}</span> ({bestValue})
                          </span>
                        )}
                        {ca > 0 && (
                          <span
                            className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-800 text-[10px] font-semibold"
                            title="CA total généré par les devis créés depuis ce modèle"
                          >
                            <i className="ri-money-euro-circle-line"></i>
                            {formatEuros(ca)}
                          </span>
                        )}
                      </span>
                    )}
                    <span className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[11px] text-foreground-500 truncate min-w-0">
                        {opt.lines} ligne{opt.lines > 1 ? "s" : ""} · {opt.montant}
                        {count > 0 ? ` · utilisé ${count} fois · ${formatEuros(ca)} générés` : " · jamais utilisé"}
                      </span>
                      {hasMonthlyActivity && (
                        <span
                          className="shrink-0 inline-flex"
                          onMouseEnter={() => setSparkHoverKey(opt.key)}
                          onMouseLeave={() => setSparkHoverKey((k) => (k === opt.key ? null : k))}
                        >
                          <ModelSparkline
                            values={monthly}
                            labels={monthLong}
                            tone={opt.custom ? "accent" : "primary"}
                            peakIndex={bestIndex}
                            onBarClick={(i) => onViewDevisMonth(opt.key, opt.label, monthKeys[i])}
                          />
                        </span>
                      )}
                    </span>
                  </span>
                  <i className="ri-arrow-right-line text-foreground-400"></i>
                </div>
                <button
                  type="button"
                  onClick={() => togglePin(opt.key)}
                  className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-md cursor-pointer ${
                    pinned.includes(opt.key)
                      ? "text-accent-600 hover:bg-accent-100"
                      : "text-foreground-400 hover:bg-background-200 hover:text-accent-700"
                  }`}
                  aria-label={pinned.includes(opt.key) ? `Retirer ${opt.label} des favoris` : `Épingler ${opt.label} en haut de la liste`}
                  title={
                    pinned.includes(opt.key)
                      ? "Retirer des favoris (ne plus épingler en haut)"
                      : "Épingler ce modèle favori en haut de la liste"
                  }
                >
                  <i className={pinned.includes(opt.key) ? "ri-star-fill" : "ri-star-line"}></i>
                </button>
                {opt.custom && opt.modele !== undefined && (
                  <>
                    <button
                      type="button"
                      onClick={() => onArchiveModele(opt.modele as DevisModele, !opt.archived)}
                      className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-md cursor-pointer ${
                        opt.archived
                          ? "text-accent-600 hover:bg-accent-100"
                          : "text-foreground-400 hover:bg-background-200 hover:text-accent-700"
                      }`}
                      aria-label={opt.archived ? `Restaurer le modèle ${opt.label}` : `Archiver le modèle ${opt.label}`}
                      title={opt.archived ? "Restaurer ce modèle" : "Archiver ce modèle (masqué, conservé pour l'historique)"}
                    >
                      <i className={opt.archived ? "ri-inbox-unarchive-line" : "ri-archive-line"}></i>
                    </button>
                    {!opt.archived && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditModele(opt.modele as DevisModele)}
                          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-primary-700 cursor-pointer"
                          aria-label={`Modifier le modèle ${opt.label}`}
                          title="Modifier les lignes de ce modèle"
                        >
                          <i className="ri-edit-line"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDuplicateModele(opt.modele as DevisModele)}
                          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-accent-700 cursor-pointer"
                          aria-label={`Dupliquer le modèle ${opt.label}`}
                          title="Dupliquer ce modèle pour créer une variante"
                        >
                          <i className="ri-file-copy-line"></i>
                        </button>
                      </>
                    )}
                  </>
                )}
                {opt.custom && opt.modeleId !== undefined && (
                  <button
                    type="button"
                    onClick={() => onDeleteModele(opt.modeleId as number, opt.label)}
                    className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md text-foreground-400 hover:bg-background-200 hover:text-red-600 cursor-pointer"
                    aria-label={`Supprimer le modèle ${opt.label}`}
                    title="Supprimer ce modèle"
                  >
                    <i className="ri-delete-bin-line"></i>
                  </button>
                )}
              </div>

              {/* Infobulle : aperçu des lignes du modèle au survol, avant de cliquer. */}
              {!isRenaming && !compareMode && (
                <div
                  className={`pointer-events-none absolute z-30 bottom-full left-0 right-0 mb-2 transition-all duration-150 ${
                    sparkHoverKey === opt.key
                      ? "opacity-0 translate-y-1"
                      : "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0"
                  }`}
                >
                  <div className="rounded-md bg-foreground-950 text-background-50 p-3 shadow-none">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-background-50/70 mb-2">
                      {opt.lines > 0 ? `${opt.lines} ligne${opt.lines > 1 ? "s" : ""} du modèle` : "Modèle vierge"}
                    </p>
                    {opt.lignes.length === 0 ? (
                      <p className="text-xs text-background-50/80">Aucune ligne pré-remplie.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {opt.lignes.slice(0, 6).map((l, i) => (
                          <li key={i} className="flex items-start justify-between gap-3 text-xs">
                            <span className="text-background-50/90">{l.designation}</span>
                            <span className="shrink-0 text-background-50/60 whitespace-nowrap">
                              {l.quantite} {l.unite} × {formatEuros(l.prix_unitaire)}
                            </span>
                          </li>
                        ))}
                        {opt.lignes.length > 6 && (
                          <li className="text-[11px] text-background-50/60">+ {opt.lignes.length - 6} autre(s) ligne(s)…</li>
                        )}
                      </ul>
                    )}
                    <p className="mt-2 pt-2 border-t border-background-50/15 text-[11px] text-background-50/60 flex items-center gap-1.5">
                      <i className="ri-repeat-line"></i>
                      {count > 0 ? `Utilisé ${count} fois · ${formatEuros(ca)} générés` : "Jamais utilisé pour l'instant"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation en un clic : archivage groupé des modèles dormants. */}
      {staleConfirmOpen && (
        <Modal title="Archiver les modèles inutilisés ?" onClose={() => setStaleConfirmOpen(false)}>
          <p className="text-sm text-foreground-600">
            Ces {staleModeles.length} modèle{staleModeles.length > 1 ? "s" : ""} n'ont pas été utilisés depuis plus de {staleDays} jours :
          </p>
          <ul className="mt-3 flex flex-col gap-1.5 max-h-52 overflow-auto pr-1">
            {staleModeles.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm text-foreground-800">
                <i className="ri-bookmark-3-line text-foreground-400"></i>
                <span className="truncate">{m.nom}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-foreground-500">
            Ils seront masqués de la liste active mais conservés pour l'historique, avec leurs statistiques d'usage. Vous pourrez les
            restaurer à tout moment depuis « Archives ».
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setStaleConfirmOpen(false)}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                const list = staleModeles;
                setStaleConfirmOpen(false);
                onAutoArchiveStale(list);
              }}
              className="h-10 px-5 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-secondary-600 whitespace-nowrap"
            >
              Archiver {staleModeles.length > 1 ? "ces modèles" : "ce modèle"}
            </button>
          </div>
        </Modal>
      )}

      {/* Confirmation en un clic : archivage groupé de tous les modèles sans aucun devis. */}
      {noDevisConfirmOpen && (
        <Modal title="Archiver les modèles sans devis ?" onClose={() => setNoDevisConfirmOpen(false)}>
          <p className="text-sm text-foreground-600">
            Ces {noDevisModeles.length} modèle{noDevisModeles.length > 1 ? "s" : ""} n'ont généré aucun devis :
          </p>
          <ul className="mt-3 flex flex-col gap-1.5 max-h-52 overflow-auto pr-1">
            {noDevisModeles.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm text-foreground-800">
                <i className="ri-bookmark-3-line text-foreground-400"></i>
                <span className="truncate">{m.nom}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-foreground-500">
            Ils seront masqués de la liste active mais conservés pour l'historique. Vous pourrez les restaurer à tout moment depuis
            « Archives ».
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={() => setNoDevisConfirmOpen(false)}
              className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                const list = noDevisModeles;
                setNoDevisConfirmOpen(false);
                onArchiveModeles(list);
              }}
              className="h-10 px-5 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-secondary-600 whitespace-nowrap"
            >
              Archiver {noDevisModeles.length > 1 ? "ces modèles" : "ce modèle"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}