import { useEffect, useState } from "react";
import {
  fetchAbonnementHistorique,
  type AbonnementHistoriqueItem,
  type AbonnementItem,
} from "@/lib/abonnementsApi";
import { formatEuros } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import { statutJuridiqueLabel, tailleEntrepriseLabel } from "@/lib/entreprise";
import ProActionsRapides from "@/pages/app/pros-inscrits/components/ProActionsRapides";

interface ProInscritDetailPanelProps {
  abonnement: AbonnementItem;
  onClose: () => void;
  /** Notifie le parent qu'un pro a été modifié (ex. changement d'offre) pour rafraîchir la liste. */
  onChanged?: (updated: AbonnementItem) => void;
}

/** Pastille de statut colorée selon l'état de l'abonnement. */
function statutTone(statut: string): string {
  if (statut === "Actif") return "bg-accent-100 text-accent-800";
  if (statut === "Essai") return "bg-secondary-100 text-secondary-800";
  if (statut === "Impayé") return "bg-red-100 text-red-700";
  return "bg-background-200 text-foreground-600";
}

/** Pastille d'offre colorée selon la gamme. */
function offreTone(offre: string): string {
  if (offre === "Entreprise") return "bg-accent-100 text-accent-800";
  if (offre === "Pro") return "bg-primary-100 text-primary-800";
  return "bg-secondary-100 text-secondary-800";
}

/** Ligne « libellé / valeur » d'une information d'inscription. */
function LigneInfo({ icon, label, valeur }: { icon: string; label: string; valeur: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-background-200 last:border-b-0">
      <span className="inline-flex items-center gap-2 text-[12px] font-medium text-foreground-500 shrink-0">
        <i className={`${icon} text-foreground-400`}></i>
        {label}
      </span>
      <span className="text-[13px] font-semibold text-foreground-900 text-right break-words min-w-0">{valeur}</span>
    </div>
  );
}

/**
 * Panneau latéral détaillant l'inscription d'un professionnel : toutes les informations
 * recueillies au moment de son inscription (identité, coordonnées, offre, paiement,
 * échéances) et l'historique des changements d'offre et de statut.
 */
export default function ProInscritDetailPanel({ abonnement, onClose, onChanged }: ProInscritDetailPanelProps) {
  const [historique, setHistorique] = useState<AbonnementHistoriqueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchAbonnementHistorique(abonnement.id)
      .then((data) => {
        if (active) setHistorique(data);
      })
      .catch(() => {
        if (active) setError("Impossible de charger l'historique de ce compte.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [abonnement.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canalLabel = abonnement.canal_paiement ?? "Non renseigné";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground-950/40" onClick={onClose}>
      <aside
        className="w-full sm:max-w-md h-full bg-background-50 border-l border-background-200 flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <header className="flex items-start justify-between gap-3 p-5 border-b border-background-200">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
              <i className="ri-store-2-line text-xl"></i>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-bold text-base text-foreground-950 truncate">{abonnement.entreprise}</h2>
                <span className="shrink-0 inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold">
                  <i className="ri-verified-badge-line text-[10px]"></i> INSCRIT
                </span>
              </div>
              <p className="text-[11px] text-foreground-500 truncate">
                {abonnement.metier ?? "Métier non renseigné"}
                {abonnement.ville ? ` · ${abonnement.ville}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md hover:bg-background-200 cursor-pointer"
            aria-label="Fermer la fiche"
          >
            <i className="ri-close-line text-foreground-500"></i>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Bandeau offre + statut */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-background-100 border border-background-200">
              <span className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Offre</span>
              <span className={`self-start inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold ${offreTone(abonnement.offre)}`}>
                {abonnement.offre}
              </span>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-background-100 border border-background-200">
              <span className="text-[10px] font-semibold text-foreground-500 uppercase tracking-wide">Statut</span>
              <span className={`self-start inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold ${statutTone(abonnement.statut)}`}>
                {abonnement.statut}
              </span>
            </div>
          </div>

          {/* Actions rapides : email de bienvenue + changement d'offre */}
          <ProActionsRapides abonnement={abonnement} onChanged={onChanged} />

          {/* Détails de l'inscription */}
          <section className="rounded-lg bg-background-100 border border-background-200 px-4 py-2">
            <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide py-2">
              <i className="ri-file-user-line"></i>
              Détails de l'inscription
            </h3>
            <LigneInfo icon="ri-calendar-line" label="Date d'inscription" valeur={formatShortDate(abonnement.created_at)} />
            <LigneInfo icon="ri-building-2-line" label="Entreprise" valeur={abonnement.entreprise} />
            <LigneInfo icon="ri-tools-line" label="Métier" valeur={abonnement.metier ?? "Non renseigné"} />
            <LigneInfo
              icon="ri-briefcase-4-line"
              label="Statut juridique"
              valeur={
                abonnement.statut_juridique ? statutJuridiqueLabel(abonnement.statut_juridique) : "Non renseigné"
              }
            />
            <LigneInfo
              icon="ri-group-line"
              label="Taille de l'entreprise"
              valeur={
                abonnement.taille_entreprise ? tailleEntrepriseLabel(abonnement.taille_entreprise) : "Non renseignée"
              }
            />
            <LigneInfo icon="ri-map-pin-line" label="Ville" valeur={abonnement.ville ?? "Non renseignée"} />
            <LigneInfo icon="ri-mail-line" label="Email" valeur={abonnement.email ?? "Non renseigné"} />
            <LigneInfo
              icon="ri-mail-star-line"
              label="Email de bienvenue"
              valeur={
                abonnement.bienvenue_envoyee_le
                  ? `Envoyé le ${formatShortDate(abonnement.bienvenue_envoyee_le)}`
                  : "Pas encore envoyé"
              }
            />
          </section>

          {/* Abonnement & paiement */}
          <section className="rounded-lg bg-background-100 border border-background-200 px-4 py-2">
            <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide py-2">
              <i className="ri-bank-card-line"></i>
              Abonnement &amp; paiement
            </h3>
            <LigneInfo icon="ri-vip-crown-2-line" label="Offre" valeur={abonnement.offre} />
            <LigneInfo icon="ri-money-euro-circle-line" label="Montant mensuel" valeur={`${formatEuros(abonnement.montant_mensuel)}/mois`} />
            <LigneInfo icon="ri-wallet-3-line" label="Moyen de paiement" valeur={canalLabel} />
            <LigneInfo icon="ri-bank-line" label="IBAN" valeur={abonnement.iban ?? "Non renseigné"} />
            <LigneInfo icon="ri-file-shield-2-line" label="Mandat SEPA" valeur={abonnement.mandat_sepa ?? "Non renseigné"} />
          </section>

          {/* Échéances */}
          <section className="rounded-lg bg-background-100 border border-background-200 px-4 py-2">
            <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide py-2">
              <i className="ri-calendar-event-line"></i>
              Échéances
            </h3>
            <LigneInfo icon="ri-play-circle-line" label="Début de l'abonnement" valeur={abonnement.date_debut ? formatShortDate(abonnement.date_debut) : "Non renseigné"} />
            <LigneInfo icon="ri-timer-line" label="Prochaine échéance" valeur={abonnement.date_echeance ? formatShortDate(abonnement.date_echeance) : "Non renseignée"} />
          </section>

          {/* Historique */}
          <section className="flex flex-col gap-2">
            <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-history-line"></i>
              Historique du compte
            </h3>
            {loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-md bg-background-200/50 animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <p className="text-xs text-red-600 inline-flex items-center gap-1.5 py-2">
                <i className="ri-error-warning-line"></i>
                {error}
              </p>
            ) : historique.length === 0 ? (
              <p className="text-xs text-foreground-500 py-2">Aucun changement enregistré depuis l'inscription.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {historique.map((h) => {
                  const isOffre = h.type === "offre";
                  return (
                    <li key={h.id} className="flex items-start gap-3 p-3 rounded-lg bg-background-100 border border-background-200">
                      <span className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg ${isOffre ? "bg-primary-100 text-primary-700" : "bg-secondary-100 text-secondary-700"}`}>
                        <i className={isOffre ? "ri-vip-crown-2-line" : "ri-refresh-line"}></i>
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-foreground-900">
                          {isOffre
                            ? h.ancienne_valeur
                              ? `${h.ancienne_valeur} → ${h.nouvelle_valeur ?? ""}`
                              : `Ouverture · ${h.nouvelle_valeur ?? ""}`
                            : `${h.ancienne_valeur ?? "—"} → ${h.nouvelle_valeur ?? "—"}`}
                        </p>
                        <p className="text-[11px] text-foreground-500">
                          {formatShortDate(h.created_at)}
                          {h.motif ? ` · ${h.motif}` : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}