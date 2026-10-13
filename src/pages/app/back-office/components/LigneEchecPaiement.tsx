import { useState } from "react";
import { formatEuros } from "@/lib/format";
import { classifierEchecPaiement, type PaiementEchecItem } from "@/lib/paiementsEchecsApi";
import { emailRelanceValide, relancerArtisanApresEchec } from "@/lib/paiementEchecRelance";

/** Date/heure courte et lisible d'un incident. */
function dateHeure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Identité affichée d'un artisan (entreprise sinon email). */
export function identite(it: PaiementEchecItem): string {
  return it.entreprise?.trim() || it.artisan_email?.trim() || "Artisan inconnu";
}

type EtatRelance = "idle" | "sending" | "sent" | "error";

/**
 * Ligne d'un échec de paiement, avec relance artisan en un clic : un bouton envoie
 * l'email « votre paiement n'a pas abouti, on réessaie ? » (via le Backend), puis
 * affiche l'état de l'envoi directement dans la ligne.
 *
 * Un badge « déjà relancé » signale les artisans qui ont déjà reçu une relance de
 * paiement, pour éviter les doublons d'envoi ; le bouton devient alors secondaire.
 */
export default function LigneEchecPaiement({
  it,
  dejaRelance = false,
  relanceLe = null,
}: {
  it: PaiementEchecItem;
  dejaRelance?: boolean;
  relanceLe?: string | null;
}) {
  const [etat, setEtat] = useState<EtatRelance>("idle");
  const [erreur, setErreur] = useState<string | null>(null);

  const famille = classifierEchecPaiement(it);
  const email = emailRelanceValide(it);
  const relancer = async () => {
    if (etat === "sending") return;
    setEtat("sending");
    setErreur(null);
    const res = await relancerArtisanApresEchec(it);
    if (res.ok) {
      setEtat("sent");
    } else {
      setEtat("error");
      setErreur(res.erreur ?? "L'envoi a échoué.");
    }
  };

  return (
    <li className="flex flex-col gap-1.5 px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-semibold text-foreground-950">{identite(it)}</span>
        <span
          title={
            famille.famille === "configuration"
              ? "Échec de configuration Stripe : le tunnel n'a pas pu s'ouvrir (moyen de paiement non activé, clé ou compte à vérifier). Correction de notre côté."
              : famille.famille === "carte"
              ? "Carte refusée par la banque de l'artisan : le tunnel s'est bien ouvert, le paiement a échoué côté client."
              : "Cause non reconnue automatiquement, à examiner."
          }
          className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${famille.tone}`}
        >
          <i className={famille.icon}></i>
          {famille.label}
        </span>
        {it.offre && (
          <span className="inline-flex items-center h-5 px-2 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-semibold whitespace-nowrap">
            {it.offre}
          </span>
        )}
        {it.facturation && (
          <span className="inline-flex items-center h-5 px-2 rounded-full bg-background-200 text-foreground-600 text-[10px] font-medium whitespace-nowrap">
            {it.facturation}
          </span>
        )}
        {dejaRelance && (
          <span
            title={relanceLe ? `Relance déjà envoyée le ${dateHeure(relanceLe)}` : "Cet artisan a déjà reçu une relance"}
            className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-semibold whitespace-nowrap"
          >
            <i className="ri-checkbox-circle-line"></i>
            Déjà relancé
          </span>
        )}
        <span className="ml-auto text-[11px] text-foreground-400 whitespace-nowrap">{dateHeure(it.created_at)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-500">
        {it.artisan_email && (
          <span className="inline-flex items-center gap-1">
            <i className="ri-mail-line"></i>
            {it.artisan_email}
          </span>
        )}
        {it.montant_mensuel !== null && (
          <span className="inline-flex items-center gap-1">
            <i className="ri-price-tag-3-line"></i>
            {formatEuros(it.montant_mensuel)} / mois
          </span>
        )}
        {it.montant_total !== null && (
          <span className="inline-flex items-center gap-1">
            <i className="ri-money-euro-circle-line"></i>
            {formatEuros(it.montant_total)} attendu
          </span>
        )}
      </div>

      {it.message && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-red-700 bg-red-50 border border-red-100 rounded-md px-2.5 py-1.5">
          <i className="ri-error-warning-line mt-0.5 shrink-0"></i>
          <span>{it.message}</span>
        </p>
      )}

      {erreur && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-red-700">
          <i className="ri-error-warning-line mt-0.5 shrink-0"></i>
          <span>{erreur}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-0.5">
        {etat === "sent" ? (
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-100 text-accent-800 text-xs font-semibold whitespace-nowrap">
            <i className="ri-checkbox-circle-line"></i>
            Relance envoyée
          </span>
        ) : (
          <button
            type="button"
            onClick={relancer}
            disabled={!email || etat === "sending"}
            title={
              email
                ? "Envoyer un email « votre paiement n'a pas abouti, on réessaie ? »"
                : "Aucune adresse email valide pour cet artisan"
            }
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              dejaRelance
                ? "bg-background-100 border border-background-200 text-foreground-700 hover:border-primary-300"
                : "bg-primary-500 text-background-50 hover:bg-primary-600"
            }`}
          >
            {etat === "sending" ? (
              <i className="ri-loader-4-line animate-spin"></i>
            ) : (
              <i className="ri-mail-send-line"></i>
            )}
            {etat === "sending"
              ? "Envoi…"
              : etat === "error"
              ? "Réessayer"
              : dejaRelance
              ? "Relancer à nouveau"
              : "Relancer l'artisan"}
          </button>
        )}
        {etat === "sent" && (
          <button
            type="button"
            onClick={relancer}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-background-100 border border-background-200 text-[11px] font-medium text-foreground-600 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Renvoyer
          </button>
        )}
      </div>
    </li>
  );
}