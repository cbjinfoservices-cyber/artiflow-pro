import { useCallback, useEffect, useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  fetchAbonnements,
  OFFRES,
  STATUTS_ABO,
  type AbonnementItem,
} from "@/lib/abonnementsApi";
import { formatEuros } from "@/lib/format";
import { formatShortDate, todayISO } from "@/lib/dates";
import { toCsv, downloadCsv } from "@/lib/csv";
import {
  STATUTS_JURIDIQUES,
  TAILLES_ENTREPRISE,
  statutJuridiqueLabel,
  tailleEntrepriseLabel,
} from "@/lib/entreprise";
import { repartitionParChamp } from "@/lib/repartition";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import RechercheRepliable from "@/components/feature/RechercheRepliable";
import ProInscritDetailPanel from "@/pages/app/pros-inscrits/components/ProInscritDetailPanel";
import InscriptionsParMoisChart from "@/pages/app/pros-inscrits/components/InscriptionsParMoisChart";
import RepartitionEntreprise from "@/pages/app/pros-inscrits/components/RepartitionEntreprise";
import RenvoyerBienvenueGroupeModal from "@/pages/app/pros-inscrits/components/RenvoyerBienvenueGroupeModal";

/** Vrai si l'abonnement a été créé durant le mois calendaire courant. */
function inscrItsCeMois(item: AbonnementItem): boolean {
  const d = new Date(item.created_at);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function offreTone(offre: string): string {
  if (offre === "Entreprise") return "bg-accent-100 text-accent-800";
  if (offre === "Pro") return "bg-primary-100 text-primary-800";
  return "bg-secondary-100 text-secondary-800";
}

function statutTone(statut: string): string {
  if (statut === "Actif") return "bg-accent-100 text-accent-800";
  if (statut === "Essai") return "bg-secondary-100 text-secondary-800";
  if (statut === "Impayé") return "bg-red-100 text-red-700";
  return "bg-background-200 text-foreground-600";
}

/** Rang d'une offre dans la gamme, pour un tri par ordre de référence plutôt qu'alphabétique. */
function rangOffre(offre: string): number {
  const i = (OFFRES as readonly string[]).indexOf(offre);
  return i === -1 ? OFFRES.length : i;
}

/** Rang d'un statut dans la liste de référence, pour un tri cohérent. */
function rangStatut(statut: string): number {
  const i = (STATUTS_ABO as readonly string[]).indexOf(statut);
  return i === -1 ? STATUTS_ABO.length : i;
}

/** Clés de tri disponibles pour les colonnes de la liste. */
type TriCle = "offre" | "statut" | "created_at";

/** En-tête de colonne cliquable qui pilote le tri de la liste (ascendant / descendant). */
function EnteteTriable({
  label,
  className,
  actif,
  dir,
  onClick,
}: {
  label: string;
  className: string;
  actif: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Trier par ${label.toLowerCase()}`}
      className={`${className} inline-flex items-center gap-1 font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer transition-colors ${
        actif ? "text-primary-700" : "text-foreground-500 hover:text-foreground-800"
      }`}
    >
      {label}
      <i className={actif ? (dir === "asc" ? "ri-sort-asc" : "ri-sort-desc") : "ri-arrow-up-down-line"}></i>
    </button>
  );
}

/**
 * Page « Pros inscrits » du Back-office.
 *
 * Elle récapitule les professionnels inscrits à la plateforme (les artisans abonnés)
 * avec les détails de leur inscription : identité de l'entreprise, coordonnées,
 * offre souscrite, statut, moyen de paiement, ainsi que les dates d'inscription et
 * d'échéance. Cliquer une ligne ouvre sa fiche détaillée (avec l'historique du compte).
 */
export default function AppProsInscrits() {
  usePageMeta(
    "Pros inscrits · ArtiFlow-pro",
    "Liste des professionnels inscrits à ArtiFlow-pro : entreprise, métier, ville, email, offre, statut, date d'inscription et moyen de paiement.",
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AbonnementItem[]>([]);
  const [detail, setDetail] = useState<AbonnementItem | null>(null);
  const [query, setQuery] = useState("");
  const [offreFilter, setOffreFilter] = useState("");
  const [statutJuridiqueFilter, setStatutJuridiqueFilter] = useState("");
  const [tailleFilter, setTailleFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("Tous");
  const [nouveauxSeulement, setNouveauxSeulement] = useState(false);
  const [bienvenueAEnvoyer, setBienvenueAEnvoyer] = useState(false);
  const [groupeOuvert, setGroupeOuvert] = useState(false);
  const [sortKey, setSortKey] = useState<TriCle | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchAbonnements());
    } catch {
      setError("Impossible de charger la liste des pros inscrits pour l'instant. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const countByStatut = (s: string) => items.filter((a) => a.statut === s).length;

  const actifs = countByStatut("Actif");
  const essais = countByStatut("Essai");
  const nouveauCeMois = useMemo(() => items.filter(inscrItsCeMois).length, [items]);
  const bienvenueEnAttente = useMemo(() => items.filter((a) => !a.bienvenue_envoyee_le), [items]);
  const mrr = useMemo(
    () => items.filter((a) => a.statut === "Actif").reduce((s, a) => s + a.montant_mensuel, 0),
    [items],
  );

  // Valeurs d'entreprise réellement présentes dans la liste : on n'affiche un filtre que s'il a
  // au moins une valeur à proposer, en gardant l'ordre de référence (statuts puis tailles).
  const statutsJuridiquesDispos = useMemo(
    () => STATUTS_JURIDIQUES.filter((s) => items.some((a) => a.statut_juridique === s.value)),
    [items],
  );
  const taillesDispos = useMemo(
    () => TAILLES_ENTREPRISE.filter((t) => items.some((a) => a.taille_entreprise === t.value)),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = items.filter((a) => {
      const matchQ =
        !q ||
        a.entreprise.toLowerCase().includes(q) ||
        (a.email ?? "").toLowerCase().includes(q) ||
        (a.metier ?? "").toLowerCase().includes(q) ||
        (a.ville ?? "").toLowerCase().includes(q);
      const matchOffre = !offreFilter || a.offre === offreFilter;
      const matchStatutJuridique = !statutJuridiqueFilter || a.statut_juridique === statutJuridiqueFilter;
      const matchTaille = !tailleFilter || a.taille_entreprise === tailleFilter;
      const matchStatut = statutFilter === "Tous" || a.statut === statutFilter;
      const matchNouveaux = !nouveauxSeulement || inscrItsCeMois(a);
      const matchBienvenue = !bienvenueAEnvoyer || !a.bienvenue_envoyee_le;
      return matchQ && matchOffre && matchStatutJuridique && matchTaille && matchStatut && matchNouveaux && matchBienvenue;
    });
    if (!sortKey) return base;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      if (sortKey === "created_at") {
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
      if (sortKey === "offre") {
        const d = rangOffre(a.offre) - rangOffre(b.offre);
        return d !== 0 ? d * dir : a.entreprise.localeCompare(b.entreprise) * dir;
      }
      const d = rangStatut(a.statut) - rangStatut(b.statut);
      return d !== 0 ? d * dir : a.entreprise.localeCompare(b.entreprise) * dir;
    });
  }, [items, query, offreFilter, statutJuridiqueFilter, tailleFilter, statutFilter, nouveauxSeulement, bienvenueAEnvoyer, sortKey, sortDir]);

  /** Bascule le tri d'une colonne : 1er clic ascendant, 2e clic descendant. */
  const toggleSort = (key: TriCle) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleExportCsv = () => {
    const rows = filtered.map((a) => [
      a.entreprise,
      a.metier ?? "",
      a.ville ?? "",
      a.email ?? "",
      a.offre,
      a.statut,
      a.statut_juridique ? statutJuridiqueLabel(a.statut_juridique) : "",
      a.taille_entreprise ? tailleEntrepriseLabel(a.taille_entreprise) : "",
      a.montant_mensuel.toFixed(2).replace(".", ","),
      a.canal_paiement ?? "",
      a.date_debut ? formatShortDate(a.date_debut) : "",
      formatShortDate(a.created_at),
      a.bienvenue_envoyee_le ? formatShortDate(a.bienvenue_envoyee_le) : "",
    ]);
    const csv = toCsv(
      ["Entreprise", "Métier", "Ville", "Email", "Offre", "Statut", "Statut juridique", "Taille", "Montant mensuel", "Paiement", "Début", "Inscrit le", "Bienvenue"],
      rows,
    );
    downloadCsv(`pros-inscrits-artiflow-${todayISO()}.csv`, csv);
  };

  /** Exporte le récap de répartition (métier, statut juridique, taille) de tous les pros inscrits. */
  const handleExportRepartitionCsv = () => {
    const rows: (string | number)[][] = [];
    const ajouter = (dimension: string, champ: "metier" | "statut_juridique" | "taille_entreprise") => {
      repartitionParChamp(items, champ).forEach((l) => {
        rows.push([dimension, l.label, l.count, `${l.pct} %`]);
      });
    };
    ajouter("Métier", "metier");
    ajouter("Statut juridique", "statut_juridique");
    ajouter("Taille de l'entreprise", "taille_entreprise");
    rows.push(["Total", "Pros inscrits", items.length, "100 %"]);
    const csv = toCsv(["Répartition", "Valeur", "Pros", "Part"], rows);
    downloadCsv(`repartition-pros-inscrits-artiflow-${todayISO()}.csv`, csv);
  };

  return (
    <DataState loading={loading} error={error} onRetry={load}>
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <i className="ri-user-star-line text-2xl"></i>
            </span>
            <div>
              <h2 className="font-heading font-bold text-xl text-foreground-950">Pros inscrits</h2>
              <p className="text-sm text-foreground-500">
                Les professionnels inscrits à la plateforme et les détails de leur inscription.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setGroupeOuvert(true)}
              disabled={bienvenueEnAttente.length === 0}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent-100 text-accent-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Envoyer l'accueil à tous les pros en attente d'un premier email de bienvenue"
            >
              <i className="ri-mail-send-line"></i>
              Renvoyer l'accueil aux non-envoyés
              <span className="inline-flex items-center justify-center min-w-[18px] h-5 px-1.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold">
                {bienvenueEnAttente.length}
              </span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exporter la liste affichée au format CSV"
            >
              <i className="ri-file-excel-2-line"></i>
              Exporter CSV
            </button>
            <button
              type="button"
              onClick={handleExportRepartitionCsv}
              disabled={items.length === 0}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exporter la répartition des pros inscrits (métier, statut juridique, taille) au format CSV"
            >
              <i className="ri-pie-chart-2-line"></i>
              Exporter la répartition
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon="ri-user-star-line"
            title="Aucun pro inscrit pour l'instant"
            text="Le registre est vide : aucun professionnel ne s'est encore inscrit à la plateforme. Dès qu'une première inscription est enregistrée, sa fiche et ses détails apparaîtront ici."
          />
        ) : (
          <>
            <RepartitionEntreprise items={items} />

            <InscriptionsParMoisChart items={items} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                  <i className="ri-user-star-line text-accent-600"></i> Pros inscrits
                </span>
                <span className="font-heading font-bold text-2xl text-foreground-950">{items.length}</span>
                <span className="text-[11px] text-foreground-500">{actifs} actifs · {essais} en essai</span>
              </div>
              <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                  <i className="ri-user-add-line text-primary-600"></i> Nouveaux ce mois-ci
                </span>
                <span className="font-heading font-bold text-2xl text-foreground-950">{nouveauCeMois}</span>
                <span className="text-[11px] text-foreground-500">inscriptions sur le mois en cours</span>
              </div>
              <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                  <i className="ri-line-chart-line text-accent-600"></i> MRR des inscrits
                </span>
                <span className="font-heading font-bold text-2xl text-foreground-950">{formatEuros(mrr)}</span>
                <span className="text-[11px] text-foreground-500">revenu récurrent des comptes actifs</span>
              </div>
              <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-100 border border-background-200">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                  <i className="ri-vip-crown-2-line text-secondary-600"></i> Offres souscrites
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {OFFRES.map((o) => (
                    <span key={o} className={`inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-bold ${offreTone(o)}`}>
                      {o} · {items.filter((a) => a.offre === o).length}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <RechercheRepliable
                carteId="pros-inscrits"
                carteLabel="Pros inscrits"
                value={query}
                onChange={setQuery}
                placeholder="Rechercher une entreprise, un métier, une ville…"
                conteneurClassName="w-full sm:w-72"
              />
              <div className="relative">
                <i className="ri-stack-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
                <select
                  value={offreFilter}
                  onChange={(e) => setOffreFilter(e.target.value)}
                  className="h-10 pl-9 pr-9 rounded-md bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 outline-none focus:border-primary-400 cursor-pointer appearance-none"
                  aria-label="Filtrer par offre"
                >
                  <option value="">Toutes les offres</option>
                  {OFFRES.map((o) => (
                    <option key={o} value={o}>
                      {o} ({items.filter((a) => a.offre === o).length})
                    </option>
                  ))}
                </select>
                <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
              </div>
              {statutsJuridiquesDispos.length > 0 && (
                <div className="relative">
                  <i className="ri-briefcase-4-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
                  <select
                    value={statutJuridiqueFilter}
                    onChange={(e) => setStatutJuridiqueFilter(e.target.value)}
                    className="h-10 pl-9 pr-9 rounded-md bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 outline-none focus:border-primary-400 cursor-pointer appearance-none"
                    aria-label="Filtrer par statut juridique"
                  >
                    <option value="">Tous les statuts juridiques</option>
                    {statutsJuridiquesDispos.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label} ({items.filter((a) => a.statut_juridique === s.value).length})
                      </option>
                    ))}
                  </select>
                  <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
                </div>
              )}
              {taillesDispos.length > 0 && (
                <div className="relative">
                  <i className="ri-group-line absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-400 text-sm pointer-events-none"></i>
                  <select
                    value={tailleFilter}
                    onChange={(e) => setTailleFilter(e.target.value)}
                    className="h-10 pl-9 pr-9 rounded-md bg-background-100 border border-background-200 text-xs font-medium text-foreground-700 outline-none focus:border-primary-400 cursor-pointer appearance-none"
                    aria-label="Filtrer par taille d'entreprise"
                  >
                    <option value="">Toutes les tailles</option>
                    {taillesDispos.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label} ({items.filter((a) => a.taille_entreprise === t.value).length})
                      </option>
                    ))}
                  </select>
                  <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-foreground-400 pointer-events-none"></i>
                </div>
              )}
              <button
                type="button"
                onClick={() => setNouveauxSeulement((v) => !v)}
                aria-pressed={nouveauxSeulement}
                title="Afficher uniquement les pros inscrits ce mois-ci"
                className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                  nouveauxSeulement
                    ? "bg-primary-500 text-background-50 border-primary-500"
                    : "bg-background-100 text-foreground-700 border-background-200 hover:border-primary-300"
                }`}
              >
                <i className="ri-user-add-line"></i>
                Nouveaux ce mois-ci
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold ${
                    nouveauxSeulement ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-600"
                  }`}
                >
                  {nouveauCeMois}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setBienvenueAEnvoyer((v) => !v)}
                aria-pressed={bienvenueAEnvoyer}
                title="Afficher uniquement les pros dont l'email de bienvenue n'a pas encore été envoyé"
                className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer border transition-colors ${
                  bienvenueAEnvoyer
                    ? "bg-accent-500 text-background-50 border-accent-500"
                    : "bg-background-100 text-foreground-700 border-background-200 hover:border-accent-300"
                }`}
              >
                <i className="ri-mail-line"></i>
                Bienvenue à envoyer
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold ${
                    bienvenueAEnvoyer ? "bg-background-50/25 text-background-50" : "bg-background-200 text-foreground-600"
                  }`}
                >
                  {bienvenueEnAttente.length}
                </span>
              </button>
              <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
                {["Tous", ...STATUTS_ABO].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatutFilter(s)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                      statutFilter === s ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                    }`}
                  >
                    {s}
                    {s !== "Tous" && (
                      <span className={statutFilter === s ? "text-background-50/80" : "text-foreground-400"}>
                        {countByStatut(s)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-xs text-foreground-500 whitespace-nowrap">
                <strong className="text-foreground-900">{filtered.length}</strong> pro{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
              <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-3 text-[11px] bg-background-200/50">
                <span className="col-span-3 font-semibold text-foreground-500 uppercase tracking-wide">Entreprise / pro</span>
                <EnteteTriable
                  label="Offre"
                  className="col-span-2"
                  actif={sortKey === "offre"}
                  dir={sortDir}
                  onClick={() => toggleSort("offre")}
                />
                <EnteteTriable
                  label="Statut"
                  className="col-span-2"
                  actif={sortKey === "statut"}
                  dir={sortDir}
                  onClick={() => toggleSort("statut")}
                />
                <span className="col-span-2 font-semibold text-foreground-500 uppercase tracking-wide">Contact</span>
                <EnteteTriable
                  label="Inscrit le"
                  className="col-span-2"
                  actif={sortKey === "created_at"}
                  dir={sortDir}
                  onClick={() => toggleSort("created_at")}
                />
                <span className="col-span-1 text-right font-semibold text-foreground-500 uppercase tracking-wide">Détail</span>
              </div>
              {filtered.length === 0 ? (
                <p className="p-8 text-center text-sm text-foreground-500">
                  {nouveauxSeulement
                    ? "Aucun pro ne s'est inscrit ce mois-ci."
                    : bienvenueAEnvoyer
                      ? "Tous les pros affichés ont déjà reçu leur email de bienvenue."
                      : "Aucun pro inscrit ne correspond à votre recherche."}
                </p>
              ) : (
                filtered.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setDetail(a)}
                    className="w-full text-left grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-3 px-5 py-4 border-t border-background-200 hover:bg-background-50 cursor-pointer transition-colors"
                  >
                    <div className="lg:col-span-3 flex items-start gap-3 min-w-0">
                      <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
                        <i className="ri-store-2-line"></i>
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground-950 truncate">{a.entreprise}</p>
                        <p className="text-[11px] text-foreground-500 truncate">
                          {a.metier ?? "Métier non renseigné"}
                          {a.ville ? ` · ${a.ville}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="lg:col-span-2 flex items-center">
                      <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5 shrink-0">
                        Offre
                      </span>
                      <span className={`inline-flex items-center h-6 px-2 rounded-full text-[10px] font-bold ${offreTone(a.offre)}`}>
                        {a.offre}
                      </span>
                      <span className="ml-2 text-[11px] text-foreground-500 whitespace-nowrap">
                        {a.montant_mensuel > 0 ? `${formatEuros(a.montant_mensuel)}/mois` : ""}
                      </span>
                    </div>
                    <div className="lg:col-span-2 flex items-center">
                      <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5 shrink-0">
                        Statut
                      </span>
                      <span className={`inline-flex items-center h-6 px-2 rounded-full text-[10px] font-bold ${statutTone(a.statut)}`}>
                        {a.statut}
                      </span>
                    </div>
                    <div className="lg:col-span-2 flex flex-col gap-1 justify-center min-w-0">
                      <div className="flex items-center min-w-0">
                        <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5 shrink-0">
                          Contact
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground-600 min-w-0">
                          <i className="ri-mail-line text-foreground-400"></i>
                          <span className="truncate">{a.email ?? "—"}</span>
                        </span>
                      </div>
                      {a.bienvenue_envoyee_le ? (
                        <span className="self-start inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-accent-100 text-accent-800 text-[9px] font-bold whitespace-nowrap">
                          <i className="ri-mail-check-line text-[10px]"></i>
                          Bienvenue envoyée
                        </span>
                      ) : (
                        <span className="self-start inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-background-200 text-foreground-500 text-[9px] font-bold whitespace-nowrap">
                          <i className="ri-mail-line text-[10px]"></i>
                          Bienvenue à envoyer
                        </span>
                      )}
                    </div>
                    <div className="lg:col-span-2 flex items-center">
                      <span className="lg:hidden text-[10px] font-semibold uppercase tracking-wide text-foreground-400 mr-1.5 shrink-0">
                        Inscrit le
                      </span>
                      <span className="text-[12px] text-foreground-700">{formatShortDate(a.created_at)}</span>
                      {inscrItsCeMois(a) && (
                        <span className="ml-1.5 inline-flex items-center h-4 px-1.5 rounded-full bg-accent-100 text-accent-800 text-[9px] font-bold uppercase tracking-wide whitespace-nowrap">
                          Nouveau
                        </span>
                      )}
                    </div>
                    <div className="lg:col-span-1 flex lg:justify-end items-center">
                      <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700">
                        Voir
                        <i className="ri-arrow-right-s-line"></i>
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {detail && (
          <ProInscritDetailPanel
            abonnement={detail}
            onClose={() => setDetail(null)}
            onChanged={(updated) => {
              setItems((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
              setDetail(updated);
            }}
          />
        )}

        {groupeOuvert && (
          <RenvoyerBienvenueGroupeModal
            items={bienvenueEnAttente}
            onClose={() => setGroupeOuvert(false)}
            onDone={load}
          />
        )}
      </div>
    </DataState>
  );
}