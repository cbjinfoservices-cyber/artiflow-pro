import { useMemo, useState } from "react";
import type { ChantierItem } from "@/hooks/useArtisanData";
import { useAuth } from "@/hooks/useAuth";
import { useSuiviEmailsClients } from "@/hooks/useSuiviEmailsClients";
import { useRecapMensuelEnvoisGroupees } from "@/hooks/useRecapMensuelEnvoisGroupees";
import { useRecapsGroupeesHistorique } from "@/hooks/useRecapsGroupeesHistorique";
import type { EchecEnvoiClient } from "@/hooks/useEchecsEnvoisClients";
import { buildRecapEnvoisGroupeesPdf } from "@/lib/recapEnvoisGroupeesPdf";
import { savePdf } from "@/lib/pdf";
import ComparerRecapsGroupeesModal from "@/pages/app/chantiers/components/ComparerRecapsGroupeesModal";
import RecapAutoMensuelBloc from "@/pages/app/chantiers/components/RecapAutoMensuelBloc";
import {
  chantierSansNouvelles,
  joursSansEmailClient,
  libellePeriodeSuivi,
  SEUIL_SANS_NOUVELLES_JOURS,
  type PeriodeSuiviEmails,
} from "@/lib/chantiers";
import { formatDateHeureCourte } from "@/lib/dates";
import { libelleMoisCourt } from "@/lib/recapEnvoisGroupeesStats";

/**
 * Suivi des emails clients : combien d'emails sont réellement partis cette semaine / ce mois-ci,
 * et quels chantiers sont les plus silencieux. Le filtre « Semaine / Mois » ne change pas la
 * règle des 14 jours (elle reste la même partout) : il change la période observée du compteur.
 */
export default function SuiviEmailsClientsCard({
  chantiers,
  refreshKey,
  onVoirSilencieux,
  onVoirEchecs,
  echecsParChantier,
  onOuvrirChantier,
}: {
  chantiers: ChantierItem[];
  refreshKey?: string;
  onVoirSilencieux: () => void;
  onVoirEchecs: () => void;
  /** Dernier email client en échec, par chantier (adresse refusée, boîte pleine…). */
  echecsParChantier?: Record<number, EchecEnvoiClient>;
  onOuvrirChantier: (id: number) => void;
}) {
  const [periode, setPeriode] = useState<PeriodeSuiviEmails>("semaine");
  // N'afficher que les chantiers dont le dernier email client n'a pas pu partir.
  const [echecSeulement, setEchecSeulement] = useState(false);
  const [comparerOpen, setComparerOpen] = useState(false);
  const { user, profile } = useAuth();
  const [exportBusy, setExportBusy] = useState(false);
  const [exportErreur, setExportErreur] = useState<string | null>(null);
  const suivi = useSuiviEmailsClients(periode, refreshKey);
  const recap = useRecapMensuelEnvoisGroupees(refreshKey);
  // Historique des douze derniers mois : alimente la courbe de tendance du PDF.
  const historique = useRecapsGroupeesHistorique(refreshKey);

  const serieTendance = useMemo(() => {
    const distincts = (ids: number[]): number => {
      const cles = new Set<number>();
      ids.forEach((chantierId) => {
        const chantier = chantiers.find((c) => c.id === chantierId);
        cles.add(chantier?.client_id ?? -chantierId);
      });
      return cles.size;
    };
    return [...historique.mois].reverse().map((m) => ({
      moisLabel: libelleMoisCourt(m.cle),
      emailsGroupees: m.stats.emailsGroupees,
      clientsRelances: distincts(m.stats.chantiersRelances),
    }));
  }, [historique.mois, chantiers]);

  // Un client n'est compté qu'une fois, même si plusieurs de ses chantiers ont été relancés.
  const clientsRelances = useMemo(() => {
    const cles = new Set<number>();
    recap.chantiersRelances.forEach((chantierId) => {
      const chantier = chantiers.find((c) => c.id === chantierId);
      cles.add(chantier?.client_id ?? -chantierId);
    });
    return cles.size;
  }, [recap.chantiersRelances, chantiers]);

  const moisLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  /** Exporte le récap du mois en cours en PDF, à archiver avec les dossiers clients. */
  const exporterRecapPdf = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    setExportErreur(null);
    try {
      const doc = await buildRecapEnvoisGroupeesPdf({
        emetteur: {
          entreprise: profile?.entreprise?.trim() || "Mon entreprise",
          email: profile?.email ?? user?.email ?? null,
        },
        moisLabel,
        stats: {
          clientsRelances,
          emailsGroupees: recap.emailsGroupees,
          chantiersRelances: recap.chantiersRelances.length,
          delaiMoyenJours: recap.delaiMoyenJours,
          enAttente: recap.enAttente,
          attenteMoyenneJours: recap.attenteMoyenneJours,
        },
        rows: recap.details.map((d) => {
          const chantier = chantiers.find((c) => c.id === d.chantierId);
          const date = new Date(d.at);
          return {
            dateLabel: Number.isNaN(date.getTime())
              ? "—"
              : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
            chantier: chantier?.libelle ?? "Chantier",
            client: chantier?.clientNom ?? "Client",
            destinataire: d.destinataire ?? "—",
          };
        }),
        serie: serieTendance,
      });
      const maintenant = new Date();
      const cle = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;
      savePdf(doc, `recap-envois-groupees-${cle}.pdf`);
    } catch {
      setExportErreur("L'export PDF du récap n'a pas pu être généré. Réessayez.");
    } finally {
      setExportBusy(false);
    }
  };

  // Classement des chantiers les plus silencieux (les plus anciens sans email en premier).
  const silencieux = useMemo(
    () =>
      chantiers
        .filter((c) => chantierSansNouvelles(c))
        .map((c) => ({ chantier: c, jours: joursSansEmailClient(c) ?? 0 }))
        .sort((a, b) => b.jours - a.jours),
    [chantiers],
  );

  const echecs = echecsParChantier ?? {};
  const nbEchecs = useMemo(
    () => silencieux.filter(({ chantier }) => Boolean(echecs[chantier.id])).length,
    [silencieux, echecs],
  );
  const silencieuxAffiches = useMemo(
    () => (echecSeulement ? silencieux.filter(({ chantier }) => Boolean(echecs[chantier.id])) : silencieux),
    [silencieux, echecs, echecSeulement],
  );

  const palier = (jours: number) => {
    if (jours >= 60) return { libelle: "Critique", classe: "bg-red-100 text-red-800" };
    if (jours >= 30) return { libelle: "Très silencieux", classe: "bg-secondary-200 text-secondary-900" };
    return { libelle: "À relancer", classe: "bg-accent-100 text-accent-900" };
  };

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 p-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-800">
            <i className="ri-mail-open-line text-base"></i>
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground-950">Suivi des emails clients</h2>
            <p className="text-[11px] text-foreground-600">
              Ce qui est réellement parti {libellePeriodeSuivi(periode)}, et les chantiers les plus silencieux.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full bg-background-50 border border-background-200 w-fit shrink-0">
          {(["semaine", "mois"] as PeriodeSuiviEmails[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriode(p)}
              aria-pressed={periode === p}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                periode === p
                  ? "bg-primary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {p === "semaine" ? "Cette semaine" : "Ce mois-ci"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-md bg-background-50 border border-background-200 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Emails envoyés</p>
          <p className="mt-0.5 text-xl font-heading font-bold text-foreground-950 tabular-nums">
            {suivi.loading ? "—" : suivi.total}
          </p>
          <p className="text-[10px] text-foreground-500">{libellePeriodeSuivi(periode)}</p>
        </div>
        <div className="rounded-md bg-background-50 border border-background-200 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Chantiers contactés</p>
          <p className="mt-0.5 text-xl font-heading font-bold text-foreground-950 tabular-nums">
            {suivi.loading ? "—" : suivi.chantiers}
          </p>
          <p className="text-[10px] text-foreground-500">
            sur {chantiers.length} chantier{chantiers.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-md bg-primary-50 border border-primary-200 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-700">
            Clients silencieux
          </p>
          <p className="mt-0.5 text-xl font-heading font-bold text-foreground-950 tabular-nums">
            {silencieux.length}
          </p>
          <p className="text-[10px] text-foreground-600">sans email depuis {SEUIL_SANS_NOUVELLES_JOURS} jours</p>
        </div>
      </div>

      {suivi.error && (
        <p className="mt-2.5 text-[11px] text-red-600 inline-flex items-center gap-1.5">
          <i className="ri-error-warning-line"></i>
          {suivi.error}
        </p>
      )}

      <div className="mt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-foreground-700">
            Les plus silencieux
            {silencieux.length > 0 && (
              <span className="ml-1.5 font-normal text-foreground-500">({silencieux.length} au total)</span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {(nbEchecs > 0 || echecSeulement) && (
              <button
                type="button"
                onClick={() => setEchecSeulement((v) => !v)}
                aria-pressed={echecSeulement}
                title="Ne garder que les clients dont le dernier email n'a pas pu partir (adresse refusée, boîte pleine…)"
                className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  echecSeulement
                    ? "bg-red-600 text-white"
                    : "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
                }`}
              >
                <i className="ri-error-warning-line"></i>
                Envois en échec
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums ${
                    echecSeulement ? "bg-background-50/25 text-background-50" : "bg-red-600 text-white"
                  }`}
                >
                  {nbEchecs}
                </span>
              </button>
            )}
            {silencieux.length > 0 && (
              <button
                type="button"
                onClick={echecSeulement ? onVoirEchecs : onVoirSilencieux}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-800 transition-colors"
              >
                <i className="ri-filter-3-line"></i>
                Filtrer la liste{echecSeulement ? " (échecs)" : ""}
              </button>
            )}
          </div>
        </div>

        {silencieuxAffiches.length === 0 ? (
          <p className="mt-2 rounded-md bg-accent-50 border border-accent-100 px-3 py-2.5 text-[11px] text-accent-900 inline-flex items-start gap-1.5">
            <i className={echecSeulement ? "ri-mail-check-line mt-px" : "ri-checkbox-circle-line mt-px"}></i>
            <span>
              {echecSeulement
                ? "Aucun email en échec parmi les clients silencieux : toutes les dernières tentatives sont bien parties."
                : `Aucun client en attente : tous vos chantiers en cours ont reçu un email dans les ${SEUIL_SANS_NOUVELLES_JOURS} derniers jours.`}
              {!echecSeulement && !suivi.loading && suivi.total === 0
                ? ` Rien n'est encore parti ${libellePeriodeSuivi(periode)}.`
                : ""}
            </span>
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {silencieuxAffiches.slice(0, 5).map(({ chantier, jours }) => {
              const tone = palier(jours);
              const detail = suivi.parChantier[chantier.id];
              const echec = echecs[chantier.id];
              return (
                <li
                  key={chantier.id}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-background-50 border border-background-200 px-2.5 py-1.5"
                >
                  <button
                    type="button"
                    onClick={() => onOuvrirChantier(chantier.id)}
                    className="min-w-0 flex-1 text-left cursor-pointer group"
                    title="Ouvrir la fiche du chantier"
                  >
                    <span className="block text-xs font-semibold text-foreground-900 truncate group-hover:text-primary-800">
                      {chantier.libelle ?? "Chantier"}
                    </span>
                    <span className="block text-[10px] text-foreground-500 truncate">
                      {chantier.clientNom ?? "Sans client"} ·{" "}
                      {chantier.suivi_dernier_email_at
                        ? `dernier email ${formatDateHeureCourte(chantier.suivi_dernier_email_at)}`
                        : "aucun email envoyé"}
                      {detail ? ` · ${detail.total} envoi${detail.total > 1 ? "s" : ""} ${libellePeriodeSuivi(periode)}` : ""}
                    </span>
                  </button>
                  {echec && (
                    <span
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold whitespace-nowrap"
                      title={`Dernier envoi refusé${echec.destinataire ? ` pour ${echec.destinataire}` : ""}${echec.erreur ? ` : ${echec.erreur}` : ""}`}
                    >
                      <i className="ri-mail-close-line"></i>
                      En échec
                    </span>
                  )}
                  <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold whitespace-nowrap ${tone.classe}`}>
                    {tone.libelle}
                  </span>
                  <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-primary-100 text-primary-900 text-[11px] font-bold whitespace-nowrap tabular-nums">
                    <i className="ri-time-line"></i>
                    {jours} j
                  </span>
                  {echec?.erreur && (
                    <span className="w-full min-w-0 text-[10px] text-red-600 truncate" title={echec.erreur}>
                      <i className="ri-error-warning-line mr-1"></i>
                      {echec.erreur}
                    </span>
                  )}
                </li>
              );
            })}
            {silencieuxAffiches.length > 5 && (
              <li className="text-[10px] text-foreground-500 pl-1">+ {silencieuxAffiches.length - 5} autre(s) à relancer</li>
            )}
          </ul>
        )}
      </div>

      {/* Récap du mois en cours : ce que les envois groupés ont réellement changé pour les
          clients silencieux, et le délai avant qu'ils ne reçoivent un nouvel email. */}
      <div className="mt-3 border-t border-background-200 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-foreground-700 inline-flex items-center gap-1.5 flex-wrap">
            <i className="ri-calendar-check-line text-secondary-700"></i>
            Récap mensuel des envois groupés
            <span className="font-normal text-foreground-400 capitalize">· {moisLabel}</span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setComparerOpen(true)}
              title="Comparer deux mois d'envois groupés et télécharger la progression en PDF"
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-800 transition-colors"
            >
              <i className="ri-scales-3-line"></i>
              Comparer deux mois
            </button>
            <button
              type="button"
              onClick={() => void exporterRecapPdf()}
              disabled={exportBusy || recap.loading}
              title="Enregistrer le récap du mois en PDF pour vos archives clients"
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:border-secondary-300 hover:text-secondary-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className={exportBusy ? "ri-loader-4-line animate-spin" : "ri-file-pdf-2-line"}></i>
              {exportBusy ? "Génération…" : "Exporter en PDF"}
            </button>
          </div>
        </div>

        {exportErreur && (
          <p className="mt-1.5 text-[11px] text-red-600 inline-flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {exportErreur}
          </p>
        )}

        {recap.error ? (
          <p className="mt-2 text-[11px] text-red-600 inline-flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>
            {recap.error}
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-md bg-background-50 border border-background-200 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                Clients relancés
              </p>
              <p className="mt-0.5 text-xl font-heading font-bold text-foreground-950 tabular-nums">
                {recap.loading ? "—" : clientsRelances}
              </p>
              <p className="text-[10px] text-foreground-500">par un envoi groupé ce mois-ci</p>
            </div>
            <div className="rounded-md bg-background-50 border border-background-200 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                Emails groupés
              </p>
              <p className="mt-0.5 text-xl font-heading font-bold text-foreground-950 tabular-nums">
                {recap.loading ? "—" : recap.emailsGroupees}
              </p>
              <p className="text-[10px] text-foreground-500">à la demande ou automatiques</p>
            </div>
            <div className="rounded-md bg-secondary-50 border border-secondary-200 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-800">
                Délai avant le prochain email
              </p>
              <p className="mt-0.5 text-xl font-heading font-bold text-foreground-950 tabular-nums">
                {recap.loading
                  ? "—"
                  : recap.delaiMoyenJours !== null
                    ? `${recap.delaiMoyenJours} j`
                    : "—"}
              </p>
              <p className="text-[10px] text-foreground-600">
                {recap.enAttente > 0
                  ? `moyenne · ${recap.enAttente} en attente de suite${
                      recap.attenteMoyenneJours !== null ? ` (${recap.attenteMoyenneJours} j)` : ""
                    }`
                  : "en moyenne, sur le même chantier"}
              </p>
            </div>
          </div>
        )}
        <p className="mt-2 text-[10px] text-foreground-500 leading-relaxed">
          Le délai mesure le temps écoulé entre un envoi groupé et l&apos;email suivant sur le même chantier. Un envoi
          encore sans réponse de votre part est compté comme « en attente de suite ».
        </p>

        <RecapAutoMensuelBloc chantiers={chantiers} refreshKey={refreshKey} />
      </div>

      {comparerOpen && (
        <ComparerRecapsGroupeesModal chantiers={chantiers} onClose={() => setComparerOpen(false)} />
      )}
    </section>
  );
}