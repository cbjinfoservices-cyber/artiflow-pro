import { useMemo, useState } from "react";
import { usePaiementsEchecs } from "@/hooks/usePaiementsEchecs";
import { downloadCsv, toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import { derniereRelanceImpaye, classifierEchecPaiement, type FamilleEchecPaiement, type PaiementEchecItem } from "@/lib/paiementsEchecsApi";
import LigneEchecPaiement, { identite } from "@/pages/app/back-office/components/LigneEchecPaiement";

/** Bornes de période proposées (en jours). 0 = tout l'historique. */
type Periode = 30 | 90 | 0;

const PERIODES: { valeur: Periode; label: string }[] = [
  { valeur: 30, label: "30 j" },
  { valeur: 90, label: "90 j" },
  { valeur: 0, label: "Tout" },
];

/** Filtre d'état de relance : tous, restant à relancer ou déjà relancés. */
type FiltreRelance = "tous" | "aRelancer" | "dejaRelances";

const FILTRES_RELANCE: { valeur: FiltreRelance; label: string }[] = [
  { valeur: "tous", label: "Tous" },
  { valeur: "aRelancer", label: "À relancer" },
  { valeur: "dejaRelances", label: "Déjà relancés" },
];

/** Filtre par famille d'échec : toutes, configuration Stripe, carte refusée ou autre. */
type FiltreFamille = "toutes" | FamilleEchecPaiement;

const FILTRES_FAMILLE: { valeur: FiltreFamille; label: string; icon: string }[] = [
  { valeur: "configuration", label: "Configuration Stripe", icon: "ri-settings-3-line" },
  { valeur: "carte", label: "Carte refusée", icon: "ri-bank-card-line" },
  { valeur: "autre", label: "Autre", icon: "ri-question-line" },
];

/** Format CSV d'un montant (virgule décimale, convention FR). */
function montantCsv(v: number | null): string {
  if (v === null || v === undefined) return "";
  return v.toFixed(2).replace(".", ",");
}

/** Format CSV d'une date (date + heure locales). */
function dateCsv(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR");
}

/**
 * Carte « Échecs de paiement » du back-office.
 *
 * Liste les tentatives d'ouverture de paiement Stripe qui ont échoué, avec :
 * - un filtre par offre, par période (30 / 90 jours) et par état de relance
 *   (« à relancer » / « déjà relancés ») pour resserrer le suivi,
 * - un export CSV du périmètre affiché, pour archiver les incidents,
 * - une relance artisan en un clic depuis chaque échec.
 *
 * Chaque échec est journalisé automatiquement par la fonction de paiement ;
 * aucun montant n'est débité puisqu'aucun abonnement n'est créé.
 */
export default function HistoriquePaiementsEchecsCard() {
  const { items, relances, loading, error, reload } = usePaiementsEchecs(200);
  const [offre, setOffre] = useState("toutes");
  const [periode, setPeriode] = useState<Periode>(30);
  const [filtreRelance, setFiltreRelance] = useState<FiltreRelance>("tous");
  const [famille, setFamille] = useState<FiltreFamille>("toutes");

  const offres = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.offre) set.add(it.offre);
    });
    return Array.from(set).sort();
  }, [items]);

  /** Échecs du périmètre offre + période (sans le filtre d'état de relance). */
  const itemsScope = useMemo(() => {
    const seuil = periode === 0 ? 0 : Date.now() - periode * 86_400_000;
    return items.filter((it) => {
      if (offre !== "toutes" && (it.offre ?? "") !== offre) return false;
      if (periode !== 0 && new Date(it.created_at).getTime() < seuil) return false;
      return true;
    });
  }, [items, offre, periode]);

  /** Compteurs du filtre d'état de relance, calculés sur le périmètre courant. */
  const compteRelance = useMemo(() => {
    let dejaRelances = 0;
    itemsScope.forEach((it) => {
      if (derniereRelanceImpaye(it, relances)) dejaRelances += 1;
    });
    return {
      tous: itemsScope.length,
      aRelancer: itemsScope.length - dejaRelances,
      dejaRelances,
    };
  }, [itemsScope, relances]);

  /** Liste affichée : périmètre courant filtré par l'état de relance. */
  const itemsFiltres = useMemo(
    () =>
      itemsScope.filter((it) => {
        if (famille !== "toutes" && classifierEchecPaiement(it).famille !== famille) return false;
        if (filtreRelance === "tous") return true;
        const relance = Boolean(derniereRelanceImpaye(it, relances));
        return filtreRelance === "dejaRelances" ? relance : !relance;
      }),
    [itemsScope, filtreRelance, relances, famille],
  );

  /** Répartition du périmètre courant par famille d'échec, pour l'en-tête de filtre. */
  const compteFamille = useMemo(() => {
    const base: Record<FamilleEchecPaiement, number> = { configuration: 0, carte: 0, autre: 0 };
    itemsScope.forEach((it) => {
      base[classifierEchecPaiement(it).famille] += 1;
    });
    return base;
  }, [itemsScope]);

  /** Échecs de la période affichée, sans le filtre d'offre : sert au mini-récap par offre. */
  const itemsPeriode = useMemo(() => {
    if (periode === 0) return items;
    const seuil = Date.now() - periode * 86_400_000;
    return items.filter((it) => new Date(it.created_at).getTime() >= seuil);
  }, [items, periode]);

  /** Répartition du nombre d'échecs par offre, du plus touché au moins touché. */
  const repartition = useMemo(() => {
    const map = new Map<string, number>();
    itemsPeriode.forEach((it) => {
      const cle = (it.offre ?? "").trim();
      map.set(cle, (map.get(cle) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([valeur, count]) => ({ valeur, label: valeur || "Sans offre", count }))
      .sort((a, b) => b.count - a.count);
  }, [itemsPeriode]);

  const exporterCsv = () => {
    const headers = [
      "Date",
      "Entreprise",
      "Email artisan",
      "Offre",
      "Facturation",
      "Montant mensuel (EUR)",
      "Montant total (EUR)",
      "Message",
      "Famille",
      "Source",
    ];
    const rows = itemsFiltres.map((it: PaiementEchecItem) => [
      dateCsv(it.created_at),
      identite(it),
      it.artisan_email ?? "",
      it.offre ?? "",
      it.facturation ?? "",
      montantCsv(it.montant_mensuel),
      montantCsv(it.montant_total),
      it.message ?? "",
      classifierEchecPaiement(it).label,
      it.source ?? "",
    ]);
    downloadCsv(`echecs-paiement_${todayISO()}.csv`, toCsv(headers, rows));
  };

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-red-100 text-red-600">
            <i className="ri-bank-card-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">Échecs de paiement (Stripe)</h3>
            <p className="text-[11px] text-foreground-500">
              Tentatives d'ouverture de paiement qui n'ont pas abouti — aucun montant débité.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!loading && !error && itemsFiltres.length > 0 && (
            <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold whitespace-nowrap">
              {itemsFiltres.length} incident{itemsFiltres.length > 1 ? "s" : ""}
            </span>
          )}
          <button
            type="button"
            onClick={exporterCsv}
            disabled={itemsFiltres.length === 0}
            title="Exporter le périmètre affiché au format CSV"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-download-2-line"></i>
            Exporter CSV
          </button>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            title="Rafraîchir l'historique"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60"
          >
            <i className={`${loading ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}`}></i>
            Rafraîchir
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5 border-b border-background-200 bg-background-50">
        <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-background-200">
          <i className="ri-filter-3-line text-sm text-foreground-400"></i>
          <select
            aria-label="Filtrer par offre"
            value={offre}
            onChange={(e) => setOffre(e.target.value)}
            className="bg-transparent text-xs text-foreground-700 outline-none cursor-pointer"
          >
            <option value="toutes">Toutes les offres</option>
            {offres.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-200">
          {PERIODES.map((p) => (
            <button
              key={p.valeur}
              type="button"
              onClick={() => setPeriode(p.valeur)}
              className={`inline-flex items-center h-6 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                periode === p.valeur
                  ? "bg-background-50 text-foreground-900"
                  : "text-foreground-500 hover:text-foreground-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-200">
          {FILTRES_RELANCE.map((f) => (
            <button
              key={f.valeur}
              type="button"
              onClick={() => setFiltreRelance(f.valeur)}
              title={
                f.valeur === "tous"
                  ? "Tous les échecs"
                  : f.valeur === "aRelancer"
                  ? "Échecs dont l'artisan n'a pas encore été relancé"
                  : "Échecs dont l'artisan a déjà reçu une relance"
              }
              className={`inline-flex items-center gap-1 h-6 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filtreRelance === f.valeur
                  ? "bg-background-50 text-foreground-900"
                  : "text-foreground-500 hover:text-foreground-800"
              }`}
            >
              {f.label}
              <span
                className={`inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold ${
                  filtreRelance === f.valeur
                    ? "bg-secondary-100 text-secondary-800"
                    : "bg-background-300/60 text-foreground-600"
                }`}
              >
                {compteRelance[f.valeur]}
              </span>
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-background-200">
          {FILTRES_FAMILLE.map((f) => (
            <button
              key={f.valeur}
              type="button"
              onClick={() => setFamille(famille === f.valeur ? "toutes" : f.valeur)}
              title={famille === f.valeur ? `Retirer le filtre « ${f.label} »` : `Filtrer sur « ${f.label} »`}
              className={`inline-flex items-center gap-1 h-6 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                famille === f.valeur
                  ? "bg-background-50 text-foreground-900"
                  : "text-foreground-500 hover:text-foreground-800"
              }`}
            >
              <i className={`${f.icon} text-sm text-foreground-400`}></i>
              <span className="text-[11px]">{f.label}</span>
              <span
                className={`inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold ${
                  famille === f.valeur
                    ? "bg-secondary-100 text-secondary-800"
                    : "bg-background-300/60 text-foreground-600"
                }`}
              >
                {compteFamille[f.valeur]}
              </span>
            </button>
          ))}
        </div>

        {(offre !== "toutes" || periode !== 30 || filtreRelance !== "tous" || famille !== "toutes") && (
          <button
            type="button"
            onClick={() => {
              setOffre("toutes");
              setPeriode(30);
              setFiltreRelance("tous");
              setFamille("toutes");
            }}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-[11px] font-medium text-foreground-500 whitespace-nowrap cursor-pointer hover:text-foreground-800 transition-colors"
          >
            <i className="ri-close-line"></i>
            Réinitialiser
          </button>
        )}
      </div>

      {!loading && !error && repartition.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-background-200 bg-secondary-50">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
            <i className="ri-pie-chart-2-line text-sm"></i>
            Échecs par offre
          </span>
          {repartition.map((r) => {
            const actif = offre === r.valeur;
            const cliquable = r.valeur !== "";
            return (
              <button
                key={r.label}
                type="button"
                disabled={!cliquable}
                onClick={() => setOffre(actif ? "toutes" : r.valeur)}
                title={
                  cliquable
                    ? actif
                      ? "Retirer ce filtre"
                      : `Filtrer sur l'offre ${r.label}`
                    : "Offre non renseignée"
                }
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  actif
                    ? "bg-secondary-500 text-background-50 border-secondary-500 cursor-pointer"
                    : cliquable
                    ? "bg-background-50 text-foreground-700 border-background-200 cursor-pointer hover:border-secondary-300"
                    : "bg-background-50 text-foreground-400 border-background-200 cursor-default"
                }`}
              >
                {r.label}
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                    actif ? "bg-background-50/25 text-background-50" : "bg-secondary-100 text-secondary-800"
                  }`}
                >
                  {r.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-md bg-background-200/50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="inline-flex items-center gap-2 text-sm text-foreground-600">
            <i className="ri-error-warning-line text-red-500"></i>
            {error}
          </span>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2.5 px-5 py-6 text-sm text-foreground-500">
          <i className="ri-checkbox-circle-line text-accent-600 text-lg"></i>
          Aucun échec de paiement enregistré. Tout roule côté Stripe.
        </div>
      ) : itemsFiltres.length === 0 ? (
        <div className="flex items-center gap-2.5 px-5 py-6 text-sm text-foreground-500">
          <i className="ri-filter-off-line text-foreground-400 text-lg"></i>
          Aucun échec ne correspond à ce filtre. Élargissez la période ou changez d'offre et d'état de relance.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-background-200">
          {itemsFiltres.map((it) => {
            const relanceLe = derniereRelanceImpaye(it, relances);
            return (
              <LigneEchecPaiement
                key={it.id}
                it={it}
                dejaRelance={Boolean(relanceLe)}
                relanceLe={relanceLe}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}