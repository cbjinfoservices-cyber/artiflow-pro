import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/hooks/useAuth";
import { useArtisanData } from "@/hooks/useArtisanData";
import { createChantier, type ChantierPayload } from "@/lib/artisanApi";
import {
  chantierProgress,
  chantierSansNouvelles,
  joursSansEmailClient,
  SEUIL_SANS_NOUVELLES_JOURS,
} from "@/lib/chantiers";
import { couleurIntervenant, type Intervenant } from "@/lib/intervenants";
import { CHANTIER_STATUTS, chantierStatusTone } from "@/lib/statuts";
import { formatEuros } from "@/lib/format";
import { formatShortDate, formatDateHeureCourte } from "@/lib/dates";
import {
  fetchDerniersEmailsClients,
  lienSuiviChantier,
  type DernierEmailClient,
} from "@/lib/suiviChantier";
import { useEchecsEnvoisClients } from "@/hooks/useEchecsEnvoisClients";
import DataState from "@/pages/app/components/DataState";
import EmptyState from "@/pages/app/components/EmptyState";
import SampleDataButton from "@/pages/app/components/SampleDataButton";
import StatutBadge from "@/pages/app/components/StatutBadge";
import ChantierFormModal from "@/pages/app/chantiers/components/ChantierFormModal";
import ChantierDetailModal from "@/pages/app/chantiers/components/ChantierDetailModal";
import ApercuEmailClientModal from "@/pages/app/chantiers/components/ApercuEmailClientModal";
import EnvoyerNouvellesGroupeesModal, {
  type ChantierNouvellesCible,
} from "@/pages/app/chantiers/components/EnvoyerNouvellesGroupeesModal";
import RecapHebdoChantiersCard from "@/pages/app/chantiers/components/RecapHebdoChantiersCard";
import SuiviEmailsClientsCard from "@/pages/app/chantiers/components/SuiviEmailsClientsCard";
import EnvoiAutoNouvellesGroupeesCard from "@/pages/app/chantiers/components/EnvoiAutoNouvellesGroupeesCard";
import GuidePremiereVisite from "@/components/base/GuidePremiereVisite";
import Infobulle from "@/components/base/Infobulle";
import RappelAstucePage from "@/components/base/RappelAstucePage";
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
  const [searchParams] = useSearchParams();

  const [statut, setStatut] = useState("Tous");
  const [periode, setPeriode] = useState<string>("Tout");
  // Filtre rapide : n'afficher que les chantiers portant une consigne (note renseignée).
  const [avecNote, setAvecNote] = useState(false);
  // Filtre rapide : n'afficher que les clients sans nouvelles depuis 14 jours ou plus.
  // Activé directement depuis la cloche d'alertes (`?sans-nouvelles=1`).
  const [sansNouvelles, setSansNouvelles] = useState(() => searchParams.get("sans-nouvelles") === "1");
  // Filtre rapide : ne garder que les chantiers dont un email client a échoué récemment.
  const [envoiEchec, setEnvoiEchec] = useState(() => searchParams.get("envoi-echec") === "1");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Dernier email réellement parti au client, par chantier (métadonnées seulement).
  const [derniersEmails, setDerniersEmails] = useState<Record<number, DernierEmailClient>>({});
  const [apercuEmail, setApercuEmail] = useState<{ libelle: string; email: DernierEmailClient } | null>(null);
  // Envoi groupé des nouvelles aux clients silencieux (ouvert par « ?nouvelles-groupees=1 »
  // depuis le rappel du tableau de bord, ou par le bouton de la barre de filtres).
  const [nouvellesOpen, setNouvellesOpen] = useState(() => searchParams.get("nouvelles-groupees") === "1");

  // Les liens de la cloche (?sans-nouvelles=1, ?envoi-echec=1) doivent aussi agir quand on
  // est déjà sur la page Chantiers : on resynchronise les filtres à chaque navigation.
  useEffect(() => {
    if (searchParams.get("sans-nouvelles") === "1") setSansNouvelles(true);
    if (searchParams.get("envoi-echec") === "1") setEnvoiEchec(true);
  }, [searchParams]);

  // Guide de première visite : ouvert au premier passage sur la page Chantiers, puis
  // mémorisé une fois fermé par l'artisan. Réouvrable à tout moment via « Revoir le guide ».
  const [guideVisible, setGuideVisible] = useState(() => !guidePremiereVisiteVu("chantiers"));
  const fermerGuide = () => {
    marquerGuidePremiereVisiteVu("chantiers");
    setGuideVisible(false);
  };

  // Clé de rafraîchissement des emails clients : change à chaque envoi.
  const emailsKey = chantiers.map((c) => `${c.id}:${c.suivi_dernier_email_at ?? ""}`).join("|");
  // Emails clients refusés récemment : permet de ne relancer que les clients non joignables.
  const echecsClients = useEchecsEnvoisClients(emailsKey);
  const nbEchecs = useMemo(() => Object.keys(echecsClients.parChantier).length, [echecsClients.parChantier]);

  const filtered = useMemo(() => {
    const range = periodRange(periode);
    return chantiers.filter((c) => {
      const matchStatut = statut === "Tous" || c.statut === statut;
      const matchNote = !avecNote || Boolean(c.note && c.note.trim());
      const matchNouvelles = !sansNouvelles || chantierSansNouvelles(c);
      const matchEchec = !envoiEchec || Boolean(echecsClients.parChantier[c.id]);
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
      return matchStatut && matchPeriode && matchNote && matchNouvelles && matchEchec;
    });
  }, [chantiers, statut, periode, avecNote, sansNouvelles, envoiEchec, echecsClients.parChantier, customStart, customEnd]);

  // Nombre de chantiers dont le client est sans nouvelles depuis 14 jours (pour la pastille du filtre).
  const nbSansNouvelles = useMemo(() => chantiers.filter((c) => chantierSansNouvelles(c)).length, [chantiers]);

  // Adresse email du client, pour préparer l'envoi groupé (et écarter les fiches sans email).
  const emailClientParId = useMemo(() => {
    const map = new Map<number, string | null>();
    clients.forEach((c) => map.set(c.id, c.email));
    return map;
  }, [clients]);

  // Clients silencieux prêts à recevoir un email : l'adresse vient de la fiche client,
  // le lien de suivi seulement si le partage est activé sur le chantier.
  const ciblesNouvelles = useMemo<ChantierNouvellesCible[]>(() =>
    chantiers
      .filter((c) => chantierSansNouvelles(c))
      .filter((c) => !envoiEchec || Boolean(echecsClients.parChantier[c.id]))
      .map((c) => ({
        id: c.id,
        libelle: c.libelle ?? "Chantier",
        clientNom: c.clientNom,
        email: c.client_id !== null ? emailClientParId.get(c.client_id) ?? null : null,
        token: c.suivi_actif ? c.suivi_token : null,
      })),
  [chantiers, emailClientParId, envoiEchec, echecsClients.parChantier]);
  const current = chantiers.find((c) => c.id === openId) ?? null;

  // Recharge la liste dès qu'un envoi a lieu (la date du dernier email change).
  useEffect(() => {
    let actif = true;
    const ids = emailsKey
      .split("|")
      .filter(Boolean)
      .map((part) => Number(part.split(":")[0]))
      .filter((id) => Number.isFinite(id));
    if (ids.length === 0) {
      setDerniersEmails({});
      return;
    }
    fetchDerniersEmailsClients(ids)
      .then((resultat) => {
        if (actif) setDerniersEmails(resultat);
      })
      .catch(() => {
        if (actif) setDerniersEmails({});
      });
    return () => {
      actif = false;
    };
  }, [emailsKey]);

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

        <RecapHebdoChantiersCard />

        <SuiviEmailsClientsCard
          chantiers={chantiers}
          refreshKey={emailsKey}
          onVoirSilencieux={() => setSansNouvelles(true)}
          onVoirEchecs={() => {
            setSansNouvelles(true);
            setEnvoiEchec(true);
          }}
          echecsParChantier={echecsClients.parChantier}
          onOuvrirChantier={(id) => setOpenId(id)}
        />

        <EnvoiAutoNouvellesGroupeesCard nbSilencieux={nbSansNouvelles} />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              onClick={() => setAvecNote((v) => !v)}
              aria-pressed={avecNote}
              title={avecNote ? "Afficher tous les chantiers" : "N'afficher que les chantiers ayant une consigne (note)"}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                avecNote
                  ? "bg-accent-500 text-background-50"
                  : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200 hover:text-accent-700"
              }`}
            >
              <i className="ri-sticky-note-line"></i>
              Avec note
            </button>
            <button
              type="button"
              onClick={() => setSansNouvelles((v) => !v)}
              aria-pressed={sansNouvelles}
              title={
                sansNouvelles
                  ? "Afficher tous les chantiers"
                  : "N'afficher que les chantiers dont le client n'a plus de nouvelles depuis 14 jours"
              }
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                sansNouvelles
                  ? "bg-primary-500 text-background-50"
                  : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200 hover:text-primary-700"
              }`}
            >
              <i className="ri-alarm-warning-line"></i>
              Sans nouvelles 14 j
              {nbSansNouvelles > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums ${
                    sansNouvelles ? "bg-background-50 text-primary-700" : "bg-primary-500 text-background-50"
                  }`}
                >
                  {nbSansNouvelles > 99 ? "99+" : nbSansNouvelles}
                </span>
              )}
            </button>
            {(nbEchecs > 0 || envoiEchec) && (
              <button
                type="button"
                onClick={() => setEnvoiEchec((v) => !v)}
                aria-pressed={envoiEchec}
                title={
                  envoiEchec
                    ? "Afficher tous les chantiers"
                    : "N'afficher que les chantiers dont un email client a échoué (client non joignable)"
                }
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  envoiEchec
                    ? "bg-red-600 text-white"
                    : "bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-200 hover:text-red-700"
                }`}
              >
                <i className="ri-mail-close-line"></i>
                Envois en échec
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums ${
                    envoiEchec ? "bg-background-50/25 text-background-50" : "bg-red-600 text-white"
                  }`}
                >
                  {nbEchecs > 99 ? "99+" : nbEchecs}
                </span>
              </button>
            )}
            {nbSansNouvelles > 0 && (
              <button
                type="button"
                onClick={() => setNouvellesOpen(true)}
                title="Envoyer un email personnalisé à tous les clients sans nouvelles depuis 14 jours"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-send-plane-line"></i>
                Nouvelles groupées
              </button>
            )}
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
            {sansNouvelles && envoiEchec
              ? "Aucun email en échec : tous les clients de ces chantiers ont bien été joints à la dernière tentative."
              : sansNouvelles
                ? "Aucun client sans nouvelles : chacun de vos chantiers en cours a reçu un email dans les 14 derniers jours."
                : "Aucun chantier ne correspond à ces filtres."}
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
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {c.intervenant_id !== null && piloteParId.get(c.intervenant_id) ? (
                          <span className="inline-flex items-center gap-1.5 px-2 h-6 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: couleurIntervenant(piloteParId.get(c.intervenant_id)?.couleur) }}
                            />
                            Pilote : {piloteParId.get(c.intervenant_id)?.nom}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-foreground-400">
                            <i className="ri-user-star-line"></i> Pilote à définir
                          </span>
                        )}
                        {c.note && c.note.trim() ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap"
                            title={c.note}
                          >
                            <i className="ri-sticky-note-line"></i>
                            Note
                          </span>
                        ) : null}
                        {c.suivi_actif && c.suivi_token ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap"
                            title="Le client peut consulter l'avancement de son chantier en ligne"
                          >
                            <i className="ri-share-circle-line"></i>
                            Suivi partagé
                          </span>
                        ) : null}
                      </div>
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

                  <div className="mt-3 pt-3 border-t border-background-200 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className="text-[11px] text-foreground-500 inline-flex items-center gap-1 min-w-0"
                        title="Date du dernier email de suivi réellement envoyé au client"
                      >
                        <i className={c.suivi_dernier_email_at ? "ri-mail-check-line" : "ri-mail-line"}></i>
                        {c.suivi_dernier_email_at ? (
                          <span className="truncate">
                            Dernier email client : {formatDateHeureCourte(c.suivi_dernier_email_at)}
                          </span>
                        ) : (
                          <span className="truncate">Aucun email envoyé au client</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const dernier = derniersEmails[c.id];
                            if (dernier) setApercuEmail({ libelle: c.libelle ?? "Chantier", email: dernier });
                          }}
                          disabled={!derniersEmails[c.id]}
                          title={
                            derniersEmails[c.id]
                              ? "Voir le dernier email réellement envoyé à ce client"
                              : "Aucun email n'a encore été envoyé à ce client"
                          }
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <i className="ri-mail-open-line"></i>
                          Aperçu
                        </button>
                        {c.suivi_actif && c.suivi_token ? (
                          <a
                            href={lienSuiviChantier(c.suivi_token)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ouvrir la page de suivi que voit le client"
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                          >
                            <i className="ri-external-link-line"></i>
                            Voir la page client
                          </a>
                        ) : null}
                      </div>
                    </div>
                    {(() => {
                      const jours = joursSansEmailClient(c);
                      if (jours === null || jours < SEUIL_SANS_NOUVELLES_JOURS) return null;
                      return (
                        <p
                          className="inline-flex items-center gap-1.5 self-start px-2.5 h-6 rounded-full bg-red-50 border border-red-100 text-red-700 text-[11px] font-semibold whitespace-nowrap"
                          title="Ce client n'a reçu aucune nouvelle depuis plus de deux semaines"
                        >
                          <i className="ri-alarm-warning-line"></i>
                          Aucun email au client depuis {jours} jours
                        </p>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Rappel discret en bas d'écran : les astuces de cet écran vivent dans le panneau Aide. */}
        <RappelAstucePage />

        {formOpen && <ChantierFormModal clients={clients} intervenants={intervenantsActifs} busy={busy} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />}

        {apercuEmail && (
          <ApercuEmailClientModal
            chantierLibelle={apercuEmail.libelle}
            email={apercuEmail.email}
            onClose={() => setApercuEmail(null)}
          />
        )}

        {nouvellesOpen && (
          <EnvoyerNouvellesGroupeesModal
            chantiers={ciblesNouvelles}
            onClose={() => setNouvellesOpen(false)}
            onTermine={reload}
          />
        )}

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