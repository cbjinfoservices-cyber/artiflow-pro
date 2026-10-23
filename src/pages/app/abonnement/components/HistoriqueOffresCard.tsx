import { useMemo, useState } from "react";
import { formatEuros } from "@/lib/format";
import { statutMeta } from "@/lib/monAbonnement";
import { todayISO } from "@/lib/dates";
import { buildHistoriqueAbonnementPdf } from "@/lib/pdf";
import ApercuPdfModal from "@/components/feature/ApercuPdfModal";
import useApercuPdf from "@/hooks/useApercuPdf";
import { useHistoriqueAbonnement } from "@/hooks/useHistoriqueAbonnement";
import type { MonAbonnement } from "@/hooks/useMonAbonnement";
import type { AbonnementHistoriqueItem } from "@/lib/abonnementsApi";
import Toast from "@/components/base/Toast";
import ComparerOffresModal from "@/components/feature/ComparerOffresModal";
import RechercheRepliable from "@/components/feature/RechercheRepliable";

type FiltreType = "Tous" | "offres" | "statuts";
type FiltrePeriode = "tout" | "3" | "6" | "12";

interface VueHistorique {
  titre: string;
  detail: string;
  icone: string;
  tone: string;
  date: string;
  montant: string | null;
}

const PERIODES: { value: FiltrePeriode; label: string }[] = [
  { value: "tout", label: "Tout" },
  { value: "3", label: "3 mois" },
  { value: "6", label: "6 mois" },
  { value: "12", label: "12 mois" },
];

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function presenter(item: AbonnementHistoriqueItem): VueHistorique {
  const date = formatDateFr(item.created_at);

  if (item.type === "statut") {
    const meta = statutMeta(item.nouvelle_valeur ?? "");
    return {
      titre: `Statut : ${item.ancienne_valeur ?? "—"} → ${meta.label}`,
      detail: item.motif ?? "Mise à jour du statut de l'abonnement",
      icone: meta.icon,
      tone: meta.tone,
      date,
      montant: null,
    };
  }

  const nouvelle = item.nouvelle_valeur ?? "—";
  if (!item.ancienne_valeur) {
    return {
      titre: `Activation de l'offre ${nouvelle}`,
      detail: item.motif ?? "Ouverture du compte",
      icone: "ri-rocket-2-line",
      tone: "bg-secondary-100 text-secondary-800",
      date,
      montant: item.nouveau_montant ? `${formatEuros(item.nouveau_montant)}/mois` : null,
    };
  }

  const monteEnGamme = (item.nouveau_montant ?? 0) >= (item.ancien_montant ?? 0);
  return {
    titre: `${item.ancienne_valeur} → ${nouvelle}`,
    detail: item.motif ?? "Changement d'offre",
    icone: monteEnGamme ? "ri-arrow-up-circle-line" : "ri-arrow-down-circle-line",
    tone: monteEnGamme ? "bg-accent-100 text-accent-800" : "bg-primary-100 text-primary-700",
    date,
    montant: item.nouveau_montant ? `${formatEuros(item.nouveau_montant)}/mois` : null,
  };
}

export default function HistoriqueOffresCard({ abonnement }: { abonnement: MonAbonnement }) {
  const { historique, loading, error, reload } = useHistoriqueAbonnement(abonnement.id);
  const [filtre, setFiltre] = useState<FiltreType>("Tous");
  const [periode, setPeriode] = useState<FiltrePeriode>("tout");
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { apercu: apercuPdf, ouvrirApercuPdf, fermerApercuPdf } = useApercuPdf();
  const [compare, setCompare] = useState<{ a: string; b: string; abonnementId: number } | null>(null);

  const nbOffres = useMemo(() => historique.filter((h) => h.type === "offre").length, [historique]);
  const nbStatuts = useMemo(() => historique.filter((h) => h.type === "statut").length, [historique]);

  const depuis = useMemo(() => {
    if (periode === "tout") return null;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - (Number(periode) - 1), 1);
  }, [periode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return historique.filter((item) => {
      const matchType =
        filtre === "Tous" || (filtre === "offres" ? item.type === "offre" : item.type === "statut");
      if (!matchType) return false;
      if (depuis) {
        const d = new Date(item.created_at);
        if (Number.isNaN(d.getTime()) || d < depuis) return false;
      }
      if (!q) return true;
      const v = presenter(item);
      return (
        v.titre.toLowerCase().includes(q) ||
        v.detail.toLowerCase().includes(q) ||
        (item.ancienne_valeur ?? "").toLowerCase().includes(q) ||
        (item.nouvelle_valeur ?? "").toLowerCase().includes(q) ||
        (item.motif ?? "").toLowerCase().includes(q)
      );
    });
  }, [historique, filtre, depuis, query]);

  const filtreLabel = useMemo(() => {
    const parts: string[] = [];
    if (filtre === "offres") parts.push("Offres uniquement");
    else if (filtre === "statuts") parts.push("Statuts uniquement");
    if (periode !== "tout") parts.push(`Période : ${periode} derniers mois`);
    if (query.trim()) parts.push(`Recherche : « ${query.trim()} »`);
    return parts.length ? parts.join(" · ") : "Toutes les étapes";
  }, [filtre, periode, query]);

  const handleExport = async () => {
    if (filtered.length === 0) {
      setToast("Aucune étape à exporter pour ce filtre.");
      return;
    }
    setExporting(true);
    try {
      const filename = `historique-abonnement-${todayISO()}.pdf`;
      ouvrirApercuPdf({
        title: "Aperçu · Historique de l'abonnement",
        filename,
        note: `${filtered.length} étape${filtered.length > 1 ? "s" : ""} · ${filtreLabel}`,
        build: () =>
          buildHistoriqueAbonnementPdf({
            emetteur: {
              entreprise: abonnement.entreprise,
              email: abonnement.email,
              metier: abonnement.metier,
              ville: abonnement.ville,
            },
            offre: abonnement.offre,
            statut: statutMeta(abonnement.statut).label,
            montantMensuel: abonnement.montant_mensuel,
            dateDebut: abonnement.date_debut,
            dateEcheance: abonnement.date_echeance,
            entrees: filtered.map((item) => {
              const v = presenter(item);
              return { dateLabel: v.date, titre: v.titre, detail: v.detail, montant: v.montant };
            }),
            filtreLabel,
          }),
      });
    } catch {
      setToast("L'export PDF a échoué. Réessayez.");
    } finally {
      setExporting(false);
    }
  };

  const chip = (key: FiltreType, label: string, count: number) => (
    <button
      key={key}
      type="button"
      onClick={() => setFiltre(key)}
      aria-pressed={filtre === key}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
        filtre === key ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
      }`}
    >
      {label}
      <span className={filtre === key ? "text-background-50/80" : "text-foreground-400"}>{count}</span>
    </button>
  );

  return (
    <section className="flex flex-col gap-4 p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700 text-xl">
            <i className="ri-history-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-base text-foreground-950">
              Historique de votre abonnement
            </h3>
            <p className="text-xs text-foreground-500">
              Toutes les évolutions de votre offre et de votre statut, dans l'ordre.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || loading || historique.length === 0}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Exporter l'historique affiché en PDF"
        >
          {exporting ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-file-pdf-2-line"></i>}
          Exporter en PDF
        </button>
      </div>

      {!loading && !error && historique.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-50 border border-background-200 w-fit">
              {chip("Tous", "Tout", historique.length)}
              {chip("offres", "Offres seules", nbOffres)}
              {chip("statuts", "Statuts seuls", nbStatuts)}
            </div>
            <RechercheRepliable
              carteId="historique-offres"
              carteLabel="Historique des offres"
              value={query}
              onChange={setQuery}
              placeholder="Rechercher une étape…"
              conteneurClassName="w-full sm:w-64"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-calendar-line text-foreground-400"></i>
              Période
            </span>
            <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-50 border border-background-200 w-fit">
              {PERIODES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriode(p.value)}
                  aria-pressed={periode === p.value}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    periode === p.value
                      ? "bg-accent-500 text-background-50"
                      : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-foreground-500">
          <i className="ri-loader-4-line animate-spin"></i>
          Chargement de l'historique…
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-background-50 border border-background-200">
          <i className="ri-error-warning-line text-primary-600 text-lg"></i>
          <p className="text-sm text-foreground-600 flex-1 min-w-[180px]">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : historique.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8 px-4 rounded-lg bg-background-50 border border-background-200">
          <span className="w-11 h-11 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-xl">
            <i className="ri-time-line"></i>
          </span>
          <p className="mt-3 text-sm font-medium text-foreground-800">Aucun changement pour l'instant</p>
          <p className="mt-1 text-xs text-foreground-500 max-w-sm">
            Dès que votre offre ou votre statut évoluera, vous retrouverez ici le détail daté de chaque étape.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8 px-4 rounded-lg bg-background-50 border border-background-200">
          <span className="w-11 h-11 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-xl">
            <i className="ri-search-eye-line"></i>
          </span>
          <p className="mt-3 text-sm font-medium text-foreground-800">Aucune étape ne correspond</p>
          <p className="mt-1 text-xs text-foreground-500 max-w-sm">
            Essayez un autre filtre, une autre période ou modifiez votre recherche.
          </p>
          <button
            type="button"
            onClick={() => {
              setFiltre("Tous");
              setPeriode("tout");
              setQuery("");
            }}
            className="mt-3 inline-flex items-center gap-2 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réinitialiser les filtres
          </button>
        </div>
      ) : (
        <>
          <ol className="relative flex flex-col gap-4 pt-1">
            <span className="absolute left-[17px] top-4 bottom-4 w-px bg-background-300/70" aria-hidden="true"></span>
            {filtered.map((item) => {
              const v = presenter(item);
              const comparable = item.type === "offre" && item.ancienne_valeur && item.nouvelle_valeur;
              return (
                <li key={item.id} className="relative flex items-start gap-3">
                  <span className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-base ${v.tone}`}>
                    <i className={v.icone}></i>
                  </span>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-foreground-950">{v.titre}</p>
                      {v.montant ? (
                        <span className="inline-flex items-center h-5 px-2 rounded-full bg-background-200 text-[10px] font-semibold text-foreground-600">
                          {v.montant}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-foreground-500 mt-0.5">{v.detail}</p>
                    <p className="text-[11px] text-foreground-400 mt-1 inline-flex items-center gap-1">
                      <i className="ri-calendar-line"></i>
                      {v.date}
                    </p>
                  </div>
                  {comparable && (
                    <button
                      type="button"
                      onClick={() =>
                        setCompare({ a: item.ancienne_valeur ?? "", b: item.nouvelle_valeur ?? "", abonnementId: abonnement.id })
                      }
                      className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-secondary-300 transition-colors"
                      title="Comparer ces deux offres côte à côte"
                    >
                      <i className="ri-arrow-left-right-line"></i>
                      Comparer
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="text-[11px] text-foreground-400">
            {filtered.length} étape{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
            {filtered.length !== historique.length ? ` sur ${historique.length}` : ""}.
          </p>
        </>
      )}

      {compare && (
        <ComparerOffresModal
          offreA={compare.a}
          offreB={compare.b}
          abonnementId={compare.abonnementId}
          onClose={() => setCompare(null)}
        />
      )}
      {apercuPdf && (
        <ApercuPdfModal
          title={apercuPdf.title}
          subtitle={apercuPdf.subtitle}
          filename={apercuPdf.filename}
          docBuilder={apercuPdf.build}
          note={apercuPdf.note}
          onClose={fermerApercuPdf}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </section>
  );
}