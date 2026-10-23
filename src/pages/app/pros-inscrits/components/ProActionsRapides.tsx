import { useState } from "react";
import {
  OFFRES,
  OFFRE_PRIX,
  marquerBienvenueEnvoyee,
  updateAbonnementOffre,
  type AbonnementItem,
} from "@/lib/abonnementsApi";
import { formatEuros } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import EmailBienvenueModal from "@/pages/app/pros-inscrits/components/EmailBienvenueModal";

interface ProActionsRapidesProps {
  abonnement: AbonnementItem;
  /** Notifie le parent qu'un pro a été modifié (offre changée) pour rafraîchir l'affichage. */
  onChanged?: (updated: AbonnementItem) => void;
}

/** Pastille d'offre colorée selon la gamme (aligné sur le reste de la page). */
function offreTone(offre: string): string {
  if (offre === "Entreprise") return "bg-accent-100 text-accent-800";
  if (offre === "Pro") return "bg-primary-100 text-primary-800";
  return "bg-secondary-100 text-secondary-800";
}

/**
 * Actions rapides de la fiche d'un pro : envoyer un email de bienvenue (message prérempli) et
 * changer directement son offre (montant mensuel réaligné automatiquement sur le tarif de l'offre).
 * Pensé pour traiter un nouveau compte en un clic sans passer par la page Abonnements.
 */
export default function ProActionsRapides({ abonnement, onChanged }: ProActionsRapidesProps) {
  const [offreCible, setOffreCible] = useState(abonnement.offre);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  const changementOffre = offreCible !== abonnement.offre;
  const nouveauMontant = OFFRE_PRIX[offreCible] ?? 0;

  const handleChangerOffre = async () => {
    if (!changementOffre) return;
    setSaving(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await updateAbonnementOffre(abonnement.id, offreCible);
      onChanged?.({ ...abonnement, offre: offreCible, montant_mensuel: nouveauMontant });
      setConfirmation(`Offre passée à ${offreCible} · ${formatEuros(nouveauMontant)}/mois.`);
    } catch {
      setErreur("Le changement d'offre a échoué. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Après un envoi MANUEL de l'email de bienvenue (renvoi de secours), on mémorise la date
   * d'envoi et on prévient le parent pour rafraîchir la liste et la fiche. Best-effort : si la
   * mémorisation échoue, l'email est malgré tout parti et on reflète quand même l'envoi.
   */
  const handleBienvenueEnvoyee = async () => {
    const iso = new Date().toISOString();
    try {
      await marquerBienvenueEnvoyee(abonnement.id);
    } catch {
      /* best-effort : l'email a déjà été expédié */
    }
    onChanged?.({ ...abonnement, bienvenue_envoyee_le: iso });
  };

  return (
    <section className="flex flex-col gap-3 p-4 rounded-lg bg-background-100 border border-background-200">
      <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
        <i className="ri-flashlight-line text-accent-600"></i>
        Actions rapides
      </h3>

      {/* Changer l'offre */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium text-foreground-600">Changer l'offre directement</span>
        <div className="flex flex-wrap gap-1.5">
          {OFFRES.map((o) => {
            const actif = offreCible === o;
            const estOffreActuelle = o === abonnement.offre;
            return (
              <button
                key={o}
                type="button"
                onClick={() => {
                  setOffreCible(o);
                  setConfirmation(null);
                  setErreur(null);
                }}
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors border ${
                  actif
                    ? "bg-primary-500 text-background-50 border-primary-500"
                    : "bg-background-50 text-foreground-700 border-background-200 hover:border-primary-300"
                }`}
                title={estOffreActuelle ? "Offre actuelle" : `Passer à ${o} · ${formatEuros(OFFRE_PRIX[o] ?? 0)}/mois`}
              >
                {o}
                {estOffreActuelle && (
                  <span className={actif ? "text-background-50/80" : "text-foreground-400"}>
                    <i className="ri-check-line text-[11px]"></i>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {changementOffre && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-md bg-secondary-100 border border-secondary-200">
            <span className="text-[11px] text-foreground-700">
              Passer de <span className={`inline-flex h-5 px-1.5 rounded-full text-[10px] font-bold ${offreTone(abonnement.offre)}`}>{abonnement.offre}</span>{" "}
              à <span className={`inline-flex h-5 px-1.5 rounded-full text-[10px] font-bold ${offreTone(offreCible)}`}>{offreCible}</span>{" "}
              · nouveau montant <strong className="text-foreground-900">{formatEuros(nouveauMontant)}/mois</strong>
            </span>
            <button
              type="button"
              onClick={handleChangerOffre}
              disabled={saving}
              className="ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-check-line"></i>}
              Appliquer
            </button>
          </div>
        )}
      </div>

      {/* Email de bienvenue */}
      <div className="flex flex-col gap-2 pt-3 border-t border-background-200">
        <span className="text-[11px] font-medium text-foreground-600">Accueillir ce pro</span>

        {/* Statut de l'email de bienvenue (auto ou manuel) */}
        {abonnement.bienvenue_envoyee_le ? (
          <span className="self-start inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold">
            <i className="ri-mail-check-line text-[11px]"></i>
            Bienvenue envoyée · {formatShortDate(abonnement.bienvenue_envoyee_le)}
          </span>
        ) : (
          <span className="self-start inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-background-200 text-foreground-500 text-[10px] font-bold">
            <i className="ri-time-line text-[11px]"></i>
            Pas encore envoyée
          </span>
        )}

        <button
          type="button"
          onClick={() => setEmailOpen(true)}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent-100 text-accent-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
        >
          <i className="ri-mail-star-line"></i>
          {abonnement.bienvenue_envoyee_le ? "Renvoyer l'email de bienvenue" : "Envoyer l'email de bienvenue"}
        </button>

        {!abonnement.bienvenue_envoyee_le && (
          <p className="text-[11px] text-foreground-400 inline-flex items-start gap-1.5">
            <i className="ri-information-line mt-px"></i>
            En secours : si l'envoi automatique a échoué, envoyez l'accueil ici en un clic.
          </p>
        )}
      </div>

      {erreur && (
        <p className="flex items-start gap-1.5 text-xs text-red-600">
          <i className="ri-error-warning-line mt-px"></i>
          {erreur}
        </p>
      )}
      {confirmation && (
        <p className="flex items-start gap-1.5 text-xs text-accent-700">
          <i className="ri-checkbox-circle-line mt-px"></i>
          {confirmation}
        </p>
      )}

      {emailOpen && (
        <EmailBienvenueModal
          abonnement={abonnement}
          onClose={() => setEmailOpen(false)}
          onSent={handleBienvenueEnvoyee}
        />
      )}
    </section>
  );
}