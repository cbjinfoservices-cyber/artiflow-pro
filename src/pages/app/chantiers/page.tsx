import { useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useArtisanData } from "@/hooks/useArtisanData";
import { createChantier, type ChantierPayload } from "@/lib/artisanApi";
import { chantierProgress } from "@/lib/chantiers";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import { CHANTIER_STATUTS, chantierStatusTone } from "@/lib/statuts";
import { formatEuros } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import SampleDataButton from "@/pages/app/components/SampleDataButton";
import StatutBadge from "@/pages/app/components/StatutBadge";
import ChantierFormModal from "@/pages/app/chantiers/components/ChantierFormModal";
import ChantierDetailModal from "@/pages/app/chantiers/components/ChantierDetailModal";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import Infobulle from "@/components/base/Infobulle";
import { guidePremiereVisiteVu, marquerGuidePremiereVisiteVu } from "@/lib/guidePremiereVisite";

/** Périodes proposées pour filtrer les chantiers selon leur date de début. */
const PERIODES = ["Tout", "Ce mois", "Ce trimestre", "Cette année", "Personnalisé"] as const;

/** Bornes [début, fin[ d'une période prédéfinie, ou null pour « Tout » / « Personnalisé ». */
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

export default function AppChantiers() {
  usePageMeta("Chantiers · ArtiFlow-pro", "Suivez l'avancement de chaque chantier étape par étape.");
  const { user } = useAuth();
  const { loading, error, chantiers, clients, intervenants, reload } = useArtisanData();

  const [statut, setStatut] = useState("Tous");
  const [periode, setPeriode] = useState<string>("Tout");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Guide de première visite : ouvert au premier passage sur la page Chantiers, puis
  // mémorisé une fois fermé par l'artisan. Réouvrable à tout moment via « Revoir le guide ».
  const [guideVisible, setGuideVisible] = useState(() => !guidePremiereVisiteVu("chantiers"));
  const fermerGuide = () => {
    marquerGuidePremiereVisiteVu("chantiers");
    setGuideVisible(false);
  };

  const filtered = useMemo(() => {
    const range = periodRange(periode);
    return chantiers.filter((c) => {
      const matchStatut = statut === "Tous" || c.statut === statut;
      let matchPeriode = true;
      if (periode === "Personnalisé") {
        const d = c.date_debut ? new Date(c.date_debut) : null;
        const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
        const end = customEnd ? new Date(`${customEnd}T23:59:59`) : null;
        matchPeriode =
          d !== null && !Number.isNaN(d.getTime()) && (start === null || d >= start) && (end === null || d <= end);
      } else if (range) {
        const d = c.date_debut ? new Date(c.date_debut) : null;
        matchPeriode = d !== null && !Number.isNaN(d.getTime()) && d >= range.start && d < range.end;
      }
      return matchStatut && matchPeriode;
    });
  }, [chantiers, statut, periode, customStart, customEnd]);
  const current = chantiers.find((c) => c.id === openId) ?? null;

  // Intervenants actifs (pilotes possibles) + accès rapide pour afficher le pilote d'un chantier.
  const intervenantsActifs = useMemo(() => intervenants.filter((i) => i.actif), [intervenants]);
  const piloteParId = useMemo(() => {
    const map = new Map<number, Intervenant>();
    intervenants.forEach((i) => map.set(i.id, i));
    return map;
  }, [intervenants]);

  const handleCreate = async (payload: ChantierPayload) => {
    if (!user) return;
    setBusy(true);
    setActionError(null);
    try {
      await createChantier(user.id, payload);
      setFormOpen(false);
      await reload();
    } catch {
      setActionError("La création du chantier a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  if (!loading && !error && chantiers.length === 0) {
    return (
      <div className="flex flex-col gap-5 animate-fade-in">
        {guideVisible && (
          <GuidePremiereVisite
            titre="Bienvenue : suivez vos chantiers"
            sousTitre="Voici, en 4 étapes, comment suivre l'avancement de chaque chantier. Vous ne pouvez rien casser : tout se modifie et s'annule facilement."
            etapes={[
              {
                icone: "ri-add-line",
                titre: "Créez le chantier",
                texte:
                  "Cliquez « Nouveau chantier », rattachez-le à un client, indiquez l'adresse et le montant. C'est votre point de départ.",
              },
              {
                icone: "ri-list-check-2",
                titre: "Détaillez les étapes",
                texte:
                  "Ouvrez le chantier et cochez les étapes au fur et à mesure (préparation, gros œuvre, finitions…). Chaque case validée compte.",
              },
              {
                icone: "ri-line-chart-line",
                titre: "Suivez l'avancement",
                texte:
                  "La barre de progression se remplit toute seule au fil des étapes cochées : un coup d'œil suffit pour voir où en est le chantier.",
              },
              {
                icone: "ri-filter-3-line",
                titre: "Filtrez par statut",
                texte:
                  "Utilisez les onglets en haut (Planifié, En cours, Terminé) pour ne voir que les chantiers qui vous intéressent sur le moment.",
              },
            ]}
            note="Ce guide ne s'affiche qu'une seule fois. Vous pouvez le revoir à tout moment avec « Revoir le guide des chantiers »."
            onFermer={fermerGuide}
          />
        )}
        <EmptyState
          icon="ri-building-2-line"
          title="Aucun chantier à suivre"
          text="Créez un chantier pour suivre son avancement étape par étape, ou chargez un jeu de données d'exemple."
        >
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-add-line"></i> Créer un chantier
            </button>
            <SampleDataButton onSeeded={reload} />
          </div>
        </EmptyState>
        {formOpen && <ChantierFormModal clients={clients} intervenants={intervenantsActifs} busy={busy} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />}
      </div>
    );
  }

  return (
    <DataState loading={loading} error={error} onRetry={reload}>
      <div className="flex flex-col gap-5 animate-fade-in">
        {guideVisible && (
          <GuidePremiereVisite
            titre="Bienvenue : suivez vos chantiers"
            sousTitre="Voici, en 4 étapes, comment suivre l'avancement de chaque chantier. Vous ne pouvez rien casser : tout se modifie et s'annule facilement."
            etapes={[
              {
                icone: "ri-add-line",
                titre: "Créez le chantier",
                texte:
                  "Cliquez « Nouveau chantier », rattachez-le à un client, indiquez l'adresse et le montant. C'est votre point de départ.",
              },
              {
                icone: "ri-list-check-2",
                titre: "Détaillez les étapes",
                texte:
                  "Ouvrez le chantier et cochez les étapes au fur et à mesure (préparation, gros œuvre, finitions…). Chaque case validée compte.",
              },
              {
                icone: "ri-line-chart-line",
                titre: "Suivez l'avancement",
                texte:
                  "La barre de progression se remplit toute seule au fil des étapes cochées : un coup d'œil suffit pour voir où en est le chantier.",
              },
              {
                icone: "ri-filter-3-line",
                titre: "Filtrez par statut",
                texte:
                  "Utilisez les onglets en haut (Planifié, En cours, Terminé) pour ne voir que les chantiers qui vous intéressent sur le moment.",
              },
            ]}
            note="Ce guide ne s'affiche qu'une seule fois. Vous pouvez le revoir à tout moment avec « Revoir le guide des chantiers »."
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
            Revoir le guide des chantiers
          </button>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Infobulle
              contenu="Filtrer par avancement : « Planifié » = pas encore commencé, « En cours » = travaux commencés, « Terminé » = chantier bouclé. « Tous » les affiche tous."
              position="bas"
              largeur={310}
            >
              <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-foreground-400 hover:text-accent-700 cursor-help">
                <i className="ri-information-line text-sm"></i>
              </span>
            </Infobulle>
            <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
              {CHANTIER_STATUTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatut(s)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    statut === s ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-add-line"></i>
            Nouveau chantier
          </button>
        </div>

        {/* Filtre par période : porte sur la date de début du chantier. */}
        <div className="flex flex-wrap items-center gap-2">
          <Infobulle
            contenu="Limiter la liste selon la date de début du chantier : ce mois-ci, ce trimestre, cette année, ou des dates précises (« Personnalisé »). Les chantiers sans date de début n'apparaissent que dans « Tout »."
            position="bas"
            largeur={330}
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
              <label htmlFor="chantiers-date-start" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Du
              </label>
              <input
                id="chantiers-date-start"
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="chantiers-date-end" className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                Au
              </label>
              <input
                id="chantiers-date-end"
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
            <p className="sm:ml-auto text-xs text-foreground-500">
              {customStart || customEnd
                ? `Sélection : ${filtered.length} chantier${filtered.length > 1 ? "s" : ""}`
                : "Choisissez une date de début et/ou de fin pour délimiter la période."}
            </p>
          </div>
        )}

        {actionError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {actionError}
          </p>
        )}

        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-foreground-500 rounded-lg bg-background-100 border border-background-200">
            Aucun chantier ne correspond à ces filtres.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => {
              const progress = chantierProgress(c);
              return (
                <div key={c.id} className="p-5 rounded-lg bg-background-100 border border-background-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-heading font-semibold text-base text-foreground-950 truncate">{c.libelle ?? "Chantier"}</h3>
                      <p className="text-xs text-foreground-500 mt-0.5 inline-flex items-center gap-1">
                        <i className="ri-map-pin-line"></i>
                        {c.adresse ?? "Adresse à définir"}
                        {c.clientNom ? ` · ${c.clientNom}` : ""}
                      </p>
                      {c.intervenant_id !== null && piloteParId.get(c.intervenant_id) ? (
                        <span className="mt-1.5 inline-flex items-center gap-1.5 px-2 h-6 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: couleurIntervenant(piloteParId.get(c.intervenant_id)?.couleur) }}
                          />
                          Pilote : {piloteParId.get(c.intervenant_id)?.nom}
                        </span>
                      ) : (
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-foreground-400">
                          <i className="ri-user-star-line"></i> Pilote à définir
                        </span>
                      )}
                    </div>
                    <StatutBadge label={c.statut} tone={chantierStatusTone(c.statut)} />
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-foreground-500">
                        Avancement{c.etapes.length > 0 ? ` (${c.etapes.filter((e) => e.fait).length}/${c.etapes.length})` : ""}
                      </span>
                      <span className="font-semibold text-foreground-900">{progress} %</span>
                    </div>
                    <div className="h-2 rounded-full bg-background-200 overflow-hidden">
                      <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${progress}%` }}></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-foreground-500 inline-flex items-center gap-1">
                      <i className="ri-calendar-line"></i>
                      {c.date_debut ? `Début ${formatShortDate(c.date_debut)}` : "Date à définir"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground-950">{formatEuros(c.montant)}</span>
                      <button
                        type="button"
                        onClick={() => setOpenId(c.id)}
                        className="h-9 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold cursor-pointer hover:bg-secondary-200 whitespace-nowrap transition-colors"
                      >
                        Détails
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {formOpen && <ChantierFormModal clients={clients} intervenants={intervenantsActifs} busy={busy} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />}

        {current && (
          <ChantierDetailModal
            chantier={current}
            pilote={current.intervenant_id !== null ? piloteParId.get(current.intervenant_id) ?? null : null}
            onClose={() => setOpenId(null)}
            onReload={reload}
            onDeleted={() => setOpenId(null)}
          />
        )}
      </div>
    </DataState>
  );
}