import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEnvoisAutomatiques } from "@/hooks/useEnvoisAutomatiques";
import { formatJour, type AutoStatut } from "@/lib/envoisAutomatiques";
import { toCsv, downloadCsv, textToBase64 } from "@/lib/csv";
import { sendSyntheseEnvoisAutoEmail } from "@/lib/email";
import RecapHebdoEnvoisAutoModal from "@/pages/app/dashboard/components/RecapHebdoEnvoisAutoModal";
import ErreurChargementInline from "@/pages/app/components/ErreurChargementInline";
import Infobulle from "@/components/base/Infobulle";

/** Libellés lisibles des statuts d'automatisation, pour l'export CSV. */
const STATUT_LABEL: Record<AutoStatut, string> = {
  ok: "À jour",
  attention: "À vérifier",
  inactif: "Inactive",
  inconnu: "À confirmer",
};

/** Filtre de période du bandeau : sur quoi porte l'ensemble (compteurs, liste, export, email). */
type Periode = "tout" | "30" | "90";

const PERIODES: { value: Periode; label: string; suffixe: string }[] = [
  { value: "tout", label: "Tout", suffixe: "" },
  { value: "30", label: "30 j", suffixe: "-30j" },
  { value: "90", label: "90 j", suffixe: "-90j" },
];

/**
 * Bandeau de synthèse des envois automatiques sur le tableau de bord : nombre à jour,
 * à vérifier et inactifs, la liste des automatisations qui demandent une vérification
 * (avec un raccourci vers la page de suivi), un filtre par période (tout / 30 / 90 jours),
 * l'export CSV, l'envoi par email de la synthèse et le récap hebdomadaire automatique.
 */
export default function BandeauEnvoisAuto() {
  const { items, loading, error, reload } = useEnvoisAutomatiques();
  const [periode, setPeriode] = useState<Periode>("tout");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoiMessage, setEnvoiMessage] = useState<string | null>(null);
  const [envoiError, setEnvoiError] = useState<string | null>(null);
  const [recapHebdoOpen, setRecapHebdoOpen] = useState(false);

  // Le filtre de période porte sur tout le bandeau : on ne garde que les automatisations
  // ayant eu un passage dans la fenêtre choisie. « Tout » conserve l'intégralité.
  const itemsPeriode = useMemo(() => {
    if (periode === "tout") return items;
    const jours = Number(periode);
    const seuil = Date.now() - jours * 86400000;
    return items.filter((i) => {
      if (!i.dernierPassage) return false;
      const t = new Date(i.dernierPassage).getTime();
      return Number.isFinite(t) && t >= seuil;
    });
  }, [items, periode]);

  // Tant que les données ne sont pas prêtes, on n'affiche rien : le bandeau n'est pas
  // indispensable et ne doit pas clignoter au chargement.
  if (loading) return null;

  // En cas d'échec du chargement, on n'avale plus l'erreur en silence : on propose de réessayer.
  if (error && items.length === 0) {
    return (
      <section className="rounded-lg bg-background-100 border border-background-200 p-4">
        <ErreurChargementInline titre="Envois automatiques" message={error} onRetry={reload} />
      </section>
    );
  }

  if (items.length === 0) return null;

  const suffixe = PERIODES.find((p) => p.value === periode)?.suffixe ?? "";
  const aJour = itemsPeriode.filter((i) => i.statut === "ok").length;
  const attention = itemsPeriode.filter((i) => i.statut === "attention");
  const inactifs = itemsPeriode.filter((i) => i.statut === "inactif").length;
  const vide = itemsPeriode.length === 0;

  /** Construit la synthèse CSV des automatisations (mêmes colonnes pour l'export et l'email). */
  const buildSyntheseCsv = () =>
    toCsv(
      ["Automatisation", "Statut", "Fréquence", "Dernier passage", "Détail du dernier passage", "Prochaine exécution", "Remarque"],
      itemsPeriode.map((i) => [
        i.nom,
        STATUT_LABEL[i.statut] ?? i.statut,
        i.frequence,
        formatJour(i.dernierPassage),
        i.dernierDetail ?? "",
        i.prochaineLibelle,
        i.note ?? "",
      ]),
    );

  const nomFichier = () => `envois-automatiques${suffixe}-${new Date().toISOString().slice(0, 10)}.csv`;

  const handleExport = () => {
    if (vide) return;
    downloadCsv(nomFichier(), buildSyntheseCsv());
  };

  const handleEnvoyer = async () => {
    if (envoiEnCours || vide) return;
    setEnvoiEnCours(true);
    setEnvoiMessage(null);
    setEnvoiError(null);
    try {
      await sendSyntheseEnvoisAutoEmail({
        csvBase64: textToBase64(buildSyntheseCsv()),
        filename: nomFichier(),
        nbItems: itemsPeriode.length,
        aJour,
        aVerifier: attention.length,
        inactifs,
      });
      setEnvoiMessage("Synthèse envoyée à votre adresse email.");
    } catch (e) {
      setEnvoiError(e instanceof Error ? e.message : "L'envoi de l'email a échoué.");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-background-200">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
          <i className="ri-robot-2-line text-lg"></i>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-semibold text-base text-foreground-950 inline-flex items-center gap-1.5">
            Envois automatiques
            <Infobulle
              contenu="Les envois qui partent tout seuls (relances, récaps…), avec leur dernier passage. Un bandeau rouge signale une automatisation à vérifier : ouvrez-la pour voir quoi faire."
              position="haut"
              largeur={260}
            >
              <i className="ri-information-line text-foreground-300 hover:text-foreground-600 cursor-help text-sm"></i>
            </Infobulle>
          </h3>
          <p className="text-xs text-foreground-500">Ce qui part tout seul, en un coup d'œil.</p>
        </div>
        <Link
          to="/app/envois-automatiques"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
        >
          <i className="ri-shield-check-line"></i>
          Vérifier les envois
        </Link>
        <button
          type="button"
          onClick={() => setRecapHebdoOpen(true)}
          title="Configurer le récap hebdomadaire par email (synthèse + CSV en pièce jointe)"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200/60 transition-colors"
        >
          <i className="ri-calendar-schedule-line"></i>
          Récap hebdo
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={vide}
          title="Télécharger la synthèse des envois automatiques au format CSV (selon la période choisie)"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <i className="ri-download-2-line"></i>
          Exporter en CSV
        </button>
        <button
          type="button"
          onClick={() => { void handleEnvoyer(); }}
          disabled={envoiEnCours || vide}
          title="Recevoir la synthèse des envois automatiques par email (CSV en pièce jointe)"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {envoiEnCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
          Envoyer par email
        </button>
      </div>

      {(envoiMessage || envoiError) && (
        <div className="px-5 py-2 border-b border-background-200">
          {envoiError ? (
            <p className="flex items-start gap-2 text-[11px] text-red-600 leading-relaxed">
              <i className="ri-error-warning-line mt-px shrink-0"></i>
              <span>{envoiError}</span>
            </p>
          ) : (
            <p className="flex items-start gap-2 text-[11px] text-accent-700 leading-relaxed">
              <i className="ri-checkbox-circle-line mt-px shrink-0"></i>
              <span>{envoiMessage}</span>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-background-200">
        <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap">
          <i className="ri-checkbox-circle-line"></i>
          {aJour} à jour
        </span>
        <span
          className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-bold whitespace-nowrap ${
            attention.length > 0 ? "bg-red-100 text-red-700" : "bg-background-200 text-foreground-500"
          }`}
        >
          <i className="ri-error-warning-line"></i>
          {attention.length} à vérifier
        </span>
        <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-bold whitespace-nowrap">
          <i className="ri-pause-circle-line"></i>
          {inactifs} inactive{inactifs > 1 ? "s" : ""}
        </span>

        {/* Filtre par période : porte sur les compteurs, la liste, l'export et l'email. */}
        <div className="ml-auto inline-flex items-center gap-2">
          <span className="text-[11px] text-foreground-500 inline-flex items-center gap-1">
            <i className="ri-filter-3-line"></i>
            Période
          </span>
          <div className="flex gap-0.5 p-0.5 rounded-full bg-background-50 border border-background-200">
            {PERIODES.map((p) => {
              const on = periode === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => setPeriode(p.value)}
                  title={
                    p.value === "tout"
                      ? "Toutes les automatisations, quelle que soit leur dernière exécution"
                      : `Ne prendre en compte que les automatisations ayant eu un passage sur les ${p.value} derniers jours`
                  }
                  className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    on ? "bg-secondary-500 text-background-50" : "text-foreground-500 hover:bg-background-200"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {vide ? (
        <p className="px-5 py-4 text-sm text-foreground-600 flex items-center gap-2">
          <i className="ri-filter-off-line text-foreground-400"></i>
          Aucune automatisation n'a eu de passage sur les {periode} derniers jours. Choisissez « Tout » pour voir
          l'ensemble.
        </p>
      ) : attention.length > 0 ? (
        <ul className="flex flex-col">
          {attention.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-background-200 first:border-t-0 bg-red-50/60"
            >
              <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-700">
                <i className={item.icone}></i>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground-950 truncate">{item.nom}</p>
                <p className="text-[11px] text-foreground-500">
                  {item.note || "Un passage récent semble manquer : vérifiez le dernier passage de cette automatisation."}
                </p>
              </div>
              <Link
                to={item.lien}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-red-300 transition-colors"
              >
                <i className="ri-arrow-right-line"></i>
                {item.lienLabel}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-foreground-600 flex items-center gap-2">
          <i className="ri-checkbox-circle-line text-accent-600"></i>
          Tout est à jour : aucune automatisation ne demande votre attention.
        </p>
      )}

      {periode !== "tout" && !vide && (
        <p className="px-5 py-2.5 text-[11px] text-foreground-400 border-t border-background-200 flex items-center gap-1.5">
          <i className="ri-information-line"></i>
          Compteurs, liste, export CSV et email portent sur les {periode} derniers jours.
        </p>
      )}

      <RecapHebdoEnvoisAutoModal open={recapHebdoOpen} onClose={() => setRecapHebdoOpen(false)} />
    </section>
  );
}