import { useMemo, useState } from "react";
import { useAlertesConfigStripe } from "@/hooks/useAlertesConfigStripe";
import { useAuth } from "@/hooks/useAuth";
import { formatDuree, formatHorodatage } from "@/lib/diagnosticUi";
import { delaiMoyenTraitement, pointsAlertesParJour } from "@/lib/alertesConfigStripeStats";
import ExportAlertesStripeCsvBouton from "@/pages/app/back-office/components/ExportAlertesStripeCsvBouton";
import SparklineAlertesStripe30j from "@/pages/app/back-office/components/SparklineAlertesStripe30j";

/** Libellé lisible et tonalité associés à la cause détectée par le diagnostic. */
function causeMeta(motif: string): { label: string; icon: string; tone: string } {
  if (motif === "pays") {
    return {
      label: "Pays / devise non supporté",
      icon: "ri-earth-line",
      tone: "bg-secondary-100 text-secondary-800",
    };
  }
  if (motif === "carte") {
    return {
      label: "Carte non activée",
      icon: "ri-bank-card-line",
      tone: "bg-red-100 text-red-700",
    };
  }
  return {
    label: "Configuration incomplète",
    icon: "ri-error-warning-line",
    tone: "bg-red-100 text-red-700",
  };
}

/** Filtres par cause proposés au-dessus de l'historique. */
type Filtre = "tout" | "carte" | "pays" | "configuration";

const FILTRES: { cle: Filtre; label: string; icon: string }[] = [
  { cle: "tout", label: "Tout", icon: "ri-list-check-2" },
  { cle: "carte", label: "Carte", icon: "ri-bank-card-line" },
  { cle: "pays", label: "Pays", icon: "ri-earth-line" },
  { cle: "configuration", label: "Configuration", icon: "ri-settings-3-line" },
];

/** Filtres par statut de traitement. */
type FiltreStatut = "tout" | "a_traiter" | "traitees";

const FILTRES_STATUT: { cle: FiltreStatut; label: string; icon: string }[] = [
  { cle: "tout", label: "Toutes", icon: "ri-list-check" },
  { cle: "a_traiter", label: "À traiter", icon: "ri-time-line" },
  { cle: "traitees", label: "Traitées", icon: "ri-checkbox-circle-line" },
];

/** Classe un motif d'alerte dans l'un des filtres proposés. */
function filtreDeMotif(motif: string): Filtre {
  if (motif === "carte") return "carte";
  if (motif === "pays") return "pays";
  return "configuration";
}

/** Pastille du détail brut : verte quand le contrôle passe, rouge quand il échoue. */
function PuceDetail({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${
        ok ? "bg-accent-100 text-accent-800" : "bg-red-100 text-red-700"
      }`}
    >
      <i className={ok ? "ri-check-line" : "ri-close-line"}></i>
      {label}
    </span>
  );
}

/**
 * Carte back-office de l'HISTORIQUE DES ALERTES DE CONFIGURATION STRIPE.
 *
 * Chaque fois que le diagnostic détecte qu'un client ne peut pas ouvrir la page de paiement
 * (carte en euros indisponible), la fonction Backend journalise une alerte dans la table
 * `alerte_config_stripe` (au maximum une toutes les 6 heures) et prévient les gestionnaires
 * par email. Cette carte liste ces alertes — date, cause, destinataires — avec :
 *   · un mini-graphe de fréquence sur 30 jours,
 *   · un filtre par cause et par statut de traitement,
 *   · la possibilité de marquer une alerte « traitée » (statut + auteur) pour ne pas y revenir,
 *   · un export CSV (période + cause).
 */
export default function HistoriqueAlertesConfigStripeCard() {
  const { profile } = useAuth();
  const { items, loading, error, reload, marquerTraitee, marquerToutTraitee, rouvrir } =
    useAlertesConfigStripe(120);
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>("tout");
  const [enCours, setEnCours] = useState<number | null>(null);
  const [enCoursLot, setEnCoursLot] = useState(false);
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  const auteur = (profile?.email ?? "").trim();

  const compteurs = useMemo(() => {
    const base: Record<Filtre, number> = { tout: items.length, carte: 0, pays: 0, configuration: 0 };
    items.forEach((it) => {
      base[filtreDeMotif(it.motif)] += 1;
    });
    return base;
  }, [items]);

  const compteursStatut = useMemo(() => {
    let aTraiter = 0;
    items.forEach((it) => {
      if (it.statut !== "traitee") aTraiter += 1;
    });
    return { tout: items.length, a_traiter: aTraiter, traitees: items.length - aTraiter };
  }, [items]);

  const graphique = useMemo(() => pointsAlertesParJour(items, 30), [items]);

  // Délai moyen entre la détection et le marquage « traitée » (indicateur de réactivité).
  const delai = useMemo(() => delaiMoyenTraitement(items), [items]);

  const visibles = useMemo(
    () =>
      items.filter((it) => {
        if (filtre !== "tout" && filtreDeMotif(it.motif) !== filtre) return false;
        if (filtreStatut === "a_traiter" && it.statut === "traitee") return false;
        if (filtreStatut === "traitees" && it.statut !== "traitee") return false;
        return true;
      }),
    [items, filtre, filtreStatut],
  );

  // Alertes de la vue filtrée qui restent à traiter (cible de l'action groupée).
  const aTraiterVisibles = useMemo(
    () => visibles.filter((it) => it.statut !== "traitee"),
    [visibles],
  );

  const traiter = async (id: number) => {
    setEnCours(id);
    setErreurAction(null);
    try {
      await marquerTraitee(id, auteur);
    } catch {
      setErreurAction("Le marquage a échoué. Vérifiez que vous êtes bien gestionnaire et réessayez.");
    } finally {
      setEnCours(null);
    }
  };

  const rouvrirAlerte = async (id: number) => {
    setEnCours(id);
    setErreurAction(null);
    try {
      await rouvrir(id);
    } catch {
      setErreurAction("La réouverture a échoué. Réessayez dans un instant.");
    } finally {
      setEnCours(null);
    }
  };

  // Action groupée : marque comme traitées toutes les alertes encore à traiter de la vue filtrée.
  const marquerToutVisible = async () => {
    const ids = aTraiterVisibles.map((it) => it.id);
    if (ids.length === 0) return;
    setEnCoursLot(true);
    setErreurAction(null);
    try {
      await marquerToutTraitee(ids, auteur);
    } catch {
      setErreurAction(
        "Le marquage groupé a échoué. Vérifiez que vous êtes bien gestionnaire et réessayez.",
      );
    } finally {
      setEnCoursLot(false);
    }
  };

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <i className="ri-bank-card-2-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">
              Alertes de configuration Stripe
            </h3>
            <p className="text-[11px] text-foreground-500">
              Détections automatiques d'une config de paiement incomplète — suivi et export.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!loading && !error && items.length > 0 && (
            <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
              {compteursStatut.a_traiter > 0
                ? `${compteursStatut.a_traiter} à traiter`
                : "Tout est traité"}
            </span>
          )}
          {!loading && !error && delai.nb > 0 && (
            <span
              className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap"
              title={`Délai moyen entre la détection et le marquage « traitée », calculé sur ${delai.nb} alerte${delai.nb > 1 ? "s" : ""} traitée${delai.nb > 1 ? "s" : ""} — la plus rapide : ${formatDuree(delai.minMs)}, la plus lente : ${formatDuree(delai.maxMs)}.`}
            >
              <i className="ri-timer-line text-accent-600"></i>
              Délai moyen
              <span className="tabular-nums text-foreground-950">{formatDuree(delai.moyenneMs)}</span>
            </span>
          )}
          {!loading && !error && items.length > 0 && (
            <ExportAlertesStripeCsvBouton items={items} />
          )}
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            title="Rafraîchir l'historique"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60"
          >
            <i className={loading ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
            Rafraîchir
          </button>
        </div>
      </div>

      {!loading && !error && items.length > 0 && (
        <div className="px-5 py-4 border-b border-background-200 bg-background-50">
          <SparklineAlertesStripe30j points={graphique} />
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-background-200">
          <div className="flex items-center gap-1">
            {FILTRES.map((f) => {
              const actif = filtre === f.cle;
              return (
                <button
                  key={f.cle}
                  type="button"
                  onClick={() => setFiltre(f.cle)}
                  aria-pressed={actif}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    actif
                      ? "bg-primary-500 text-background-50"
                      : "bg-background-100 text-foreground-600 border border-background-200 hover:border-primary-300 hover:text-primary-700"
                  }`}
                >
                  <i className={f.icon}></i>
                  {f.label}
                  <span
                    className={`tabular-nums text-[11px] font-bold ${
                      actif ? "text-background-50/80" : "text-foreground-400"
                    }`}
                  >
                    {compteurs[f.cle]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {aTraiterVisibles.length > 0 && (
              <button
                type="button"
                onClick={marquerToutVisible}
                disabled={enCoursLot}
                title={`Marquer comme traitées les ${aTraiterVisibles.length} alerte(s) encore à traiter dans la vue filtrée.`}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-secondary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-60"
              >
                <i className={enCoursLot ? "ri-loader-4-line animate-spin" : "ri-check-double-line"}></i>
                Tout marquer traité ({aTraiterVisibles.length})
              </button>
            )}
            <div className="flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200">
            {FILTRES_STATUT.map((f) => {
              const actif = filtreStatut === f.cle;
              return (
                <button
                  key={f.cle}
                  type="button"
                  onClick={() => setFiltreStatut(f.cle)}
                  aria-pressed={actif}
                  className={`inline-flex items-center gap-1.5 h-6 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    actif
                      ? "bg-secondary-500 text-background-50"
                      : "text-foreground-600 hover:text-foreground-900"
                  }`}
                >
                  <i className={f.icon}></i>
                  {f.label}
                  <span
                    className={`tabular-nums font-bold ${
                      actif ? "text-background-50/80" : "text-foreground-400"
                    }`}
                  >
                    {compteursStatut[f.cle]}
                  </span>
                </button>
              );
            })}
            </div>
          </div>
        </div>
      )}

      {erreurAction && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-background-50 border-b border-background-200">
          <i className="ri-error-warning-line text-red-500"></i>
          <span className="text-xs text-foreground-600">{erreurAction}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-background-200/50 animate-pulse" />
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
          Aucune alerte de configuration enregistrée. Le paiement carte en euros fonctionne normalement.
        </div>
      ) : visibles.length === 0 ? (
        <div className="flex items-center gap-2.5 px-5 py-6 text-sm text-foreground-500">
          <i className="ri-filter-off-line text-foreground-400 text-lg"></i>
          Aucune alerte ne correspond à ces filtres.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-background-200">
          {visibles.map((it) => {
            const cause = causeMeta(it.motif);
            const traitee = it.statut === "traitee";
            const enTraitement = enCours === it.id;
            return (
              <li key={it.id} className="flex flex-col gap-2 px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cause.tone}`}
                  >
                    <i className={cause.icon}></i>
                    {cause.label}
                  </span>
                  {it.pays && (
                    <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-background-200 text-foreground-600 text-[11px] font-medium whitespace-nowrap uppercase">
                      {it.pays}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                      traitee
                        ? "bg-secondary-100 text-secondary-800"
                        : "bg-primary-100 text-primary-800"
                    }`}
                  >
                    <i className={traitee ? "ri-checkbox-circle-line" : "ri-time-line"}></i>
                    {traitee ? "Traitée" : "À traiter"}
                  </span>
                  <span className="ml-auto text-[11px] text-foreground-400 whitespace-nowrap">
                    {formatHorodatage(it.created_at)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] text-foreground-500">
                    <i className="ri-mail-send-line"></i>
                    Destinataires
                  </span>
                  {it.destinataires.length === 0 ? (
                    <span className="text-[11px] text-foreground-400">—</span>
                  ) : (
                    it.destinataires.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center h-5 px-2 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-medium whitespace-nowrap"
                      >
                        {email}
                      </span>
                    ))
                  )}
                </div>

                {it.detail && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-foreground-500">
                      <i className="ri-list-check-2"></i>
                      Détail brut
                    </span>
                    <PuceDetail label="Compte activé" ok={it.detail.chargesActives} />
                    <PuceDetail label="Carte disponible" ok={it.detail.carteDisponible} />
                    <PuceDetail label="EUR supporté" ok={it.detail.eurSupportee} />
                    <span className="inline-flex items-center h-5 px-2 rounded-full bg-background-200 text-foreground-600 text-[10px] font-medium whitespace-nowrap">
                      Affichage carte : {it.detail.cartePreference || "—"}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {traitee ? (
                    <span className="inline-flex flex-wrap items-center gap-1 text-[11px] text-foreground-500">
                      <i className="ri-check-double-line text-accent-600"></i>
                      Traitée par
                      <span className="font-semibold text-foreground-800">
                        {it.traite_par || "gestionnaire"}
                      </span>
                      {it.traite_at && (
                        <span className="text-foreground-400">· {formatHorodatage(it.traite_at)}</span>
                      )}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-foreground-400">
                      <i className="ri-mail-line"></i>
                      En attente de traitement
                    </span>
                  )}

                  <div className="ml-auto">
                    {traitee ? (
                      <button
                        type="button"
                        onClick={() => rouvrirAlerte(it.id)}
                        disabled={enTraitement}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-50 border border-background-200 text-[11px] font-medium text-foreground-600 whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-700 transition-colors disabled:opacity-60"
                      >
                        <i className={enTraitement ? "ri-loader-4-line animate-spin" : "ri-arrow-go-back-line"}></i>
                        Rouvrir
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => traiter(it.id)}
                        disabled={enTraitement}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-secondary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-60"
                      >
                        <i className={enTraitement ? "ri-loader-4-line animate-spin" : "ri-check-line"}></i>
                        Marquer comme traitée
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}