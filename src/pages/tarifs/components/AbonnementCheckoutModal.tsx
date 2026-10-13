import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { plans } from "@/mocks/landing";
import {
  demarrerAbonnement,
  economieAnnuelle,
  prixMensuel,
  totalAnnuel,
  type Facturation,
  type ModePaiement,
} from "@/lib/abonnementPaiement";
import NoteFinEssai from "@/components/feature/NoteFinEssai";
import { useDureeEssai } from "@/hooks/useDureeEssai";

type AbonnementCheckoutModalProps = {
  open: boolean;
  plan?: string | null;
  period?: Facturation;
  /** Type de paiement présélectionné à l'ouverture (abonnement reconductible ou paiement unique). */
  modePaiement?: ModePaiement;
  onClose: () => void;
};

const OFFRES = ["Essentiel", "Pro", "Entreprise"];

/**
 * Détecte les erreurs qui relèvent d'une mauvaise configuration du compte Stripe
 * (moyens de paiement, devise, clé…), par opposition à une erreur passagère.
 * Sert à afficher une aide ciblée pour les gestionnaires.
 */
function estErreurConfigPaiement(message: string): boolean {
  const m = message.toLowerCase();
  return [
    "payment method",
    "payment_method_types",
    "no valid payment",
    "currency",
    "stripe",
    "clé",
    "api key",
    "permissions",
    "not configured",
    "pas encore configuré",
  ].some((motif) => m.includes(motif));
}

export default function AbonnementCheckoutModal({ open, plan, period, modePaiement: modeInitial, onClose }: AbonnementCheckoutModalProps) {
  const { user, isGestionnaire } = useAuth();
  const { jours: dureeEssai } = useDureeEssai();
  const [offre, setOffre] = useState(plan ?? "");
  const [facturation, setFacturation] = useState<Facturation>(period ?? "mensuel");
  const [modePaiement, setModePaiement] = useState<ModePaiement>(modeInitial ?? "recurrent");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    if (!open) return;
    setStatus("idle");
    setErreur("");
    setOffre(plan ?? "");
    setFacturation(period ?? "mensuel");
    setModePaiement(modeInitial ?? "recurrent");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, plan, period, modeInitial]);

  if (!open) return null;

  const planData = plans.find((p) => p.name === offre);
  const mensuel = planData ? Number(planData.price) : 0;
  const prixAffiche = offre ? prixMensuel(offre, facturation) : 0;
  const total = offre ? totalAnnuel(offre, facturation) : 0;
  const economie = offre ? economieAnnuelle(offre) : 0;

  const handlePayer = async () => {
    if (!offre) {
      setStatus("error");
      setErreur("Choisissez une offre pour continuer.");
      return;
    }
    setStatus("loading");
    setErreur("");
    try {
      const { url } = await demarrerAbonnement(offre, facturation, modePaiement);
      window.location.assign(url);
    } catch (e) {
      setStatus("error");
      setErreur(e instanceof Error ? e.message : "Le paiement n'a pas pu être ouvert.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Souscrire à un abonnement ArtiFlow-pro"
    >
      <div className="fixed inset-0 bg-foreground-950/60 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative w-full max-w-lg my-auto rounded-lg bg-background-50 border border-background-200 p-6 md:p-8 animate-fade-up">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-background-100 text-foreground-600 hover:bg-background-200 cursor-pointer transition-colors"
        >
          <i className="ri-close-line text-xl"></i>
        </button>

        <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
          <i className="ri-bank-card-line"></i>
          Paiement sécurisé
        </span>
        <h2 className="mt-3 font-heading font-bold text-2xl text-foreground-950 tracking-tight">
          Activer mon abonnement
        </h2>
        <p className="mt-2 text-sm text-foreground-600 leading-relaxed">
          Vous serez redirigé vers le paiement sécurisé Stripe.{" "}
          {modePaiement === "unique"
            ? "Paiement unique, sans reconduction automatique."
            : dureeEssai > 0
              ? `Aucun débit aujourd'hui : votre essai de ${dureeEssai} jours démarre maintenant, premier prélèvement à la fin de l'essai.`
              : `Prélèvement ${facturation === "annuel" ? "annuel" : "mensuel"}, sans engagement.`}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
            <i className="ri-shield-check-line"></i>
            Carte bancaire chiffrée
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-semibold whitespace-nowrap">
            <i className={modePaiement === "unique" ? "ri-hand-coin-line" : "ri-repeat-line"}></i>
            {modePaiement === "unique" ? "Paiement unique · non reconductible" : "Sans engagement · résiliable"}
          </span>
        </div>

        {modePaiement === "recurrent" && dureeEssai > 0 ? (
          <NoteFinEssai className="mt-4" variant="souscription" masquerSiTerminee={false} />
        ) : null}

        <div className="mt-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="af-co-offre" className="text-xs font-semibold text-foreground-700">
                Offre souhaitée
              </label>
              <select
                id="af-co-offre"
                value={offre}
                onChange={(e) => setOffre(e.target.value)}
                className="h-11 px-3.5 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors cursor-pointer"
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {OFFRES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="af-co-facturation" className="text-xs font-semibold text-foreground-700">
                Facturation
              </label>
              <select
                id="af-co-facturation"
                value={facturation}
                onChange={(e) => setFacturation(e.target.value === "annuel" ? "annuel" : "mensuel")}
                className="h-11 px-3.5 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors cursor-pointer"
              >
                <option value="mensuel">Mensuelle</option>
                <option value="annuel">Annuelle (−20 %)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground-700">Type de paiement</span>
            <div className="flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200">
              <button
                type="button"
                onClick={() => setModePaiement("recurrent")}
                aria-pressed={modePaiement === "recurrent"}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  modePaiement === "recurrent" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className="ri-loop-right-line"></i>
                Abonnement
              </button>
              <button
                type="button"
                onClick={() => setModePaiement("unique")}
                aria-pressed={modePaiement === "unique"}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  modePaiement === "unique" ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className="ri-hand-coin-line"></i>
                Paiement unique
              </button>
            </div>
            <p className="text-[11px] text-foreground-500 leading-relaxed">
              {modePaiement === "unique"
                ? `Vous payez une seule fois pour ${facturation === "annuel" ? "12 mois" : "1 mois"}, sans reconduction automatique : rien n'est prélevé ensuite.`
                : `Prélèvement automatique ${facturation === "annuel" ? "annuel" : "mensuel"} jusqu'à résiliation, sans engagement.`}
            </p>
          </div>

          {planData ? (
            <div className="rounded-lg border border-accent-300/60 bg-accent-100/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-800">Votre choix</p>
                  <p className="mt-1 font-heading font-semibold text-sm text-foreground-950">
                    Offre {planData.name} · facturation {facturation === "annuel" ? "annuelle" : "mensuelle"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-heading font-extrabold text-2xl text-foreground-950">{prixAffiche} €</p>
                  <p className="text-[11px] text-foreground-500">/ mois</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-accent-300/50 flex items-start gap-2 text-xs">
                <i className="ri-gift-line text-accent-700 mt-0.5"></i>
                {facturation === "annuel" ? (
                  <span className="text-accent-800">
                    Facturé <strong className="font-semibold">{total} €</strong> par an ({mensuel * 12} € au mensuel) — vous
                    économisez <strong className="font-semibold">{economie} €</strong>.
                  </span>
                ) : (
                  <span className="text-accent-800">
                    Soit <strong className="font-semibold">{total} €</strong> par an. Passez à l'annuel pour économiser{" "}
                    <strong className="font-semibold">{economie} €</strong>.
                    <button
                      type="button"
                      onClick={() => setFacturation("annuel")}
                      className="ml-1 underline font-semibold cursor-pointer hover:text-accent-950"
                    >
                      Choisir l'annuel
                    </button>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-background-300 bg-background-100 px-4 py-3 text-xs text-foreground-500">
              Choisissez une offre pour voir le récapitulatif détaillé.
            </div>
          )}

          {erreur && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3.5 flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-red-800">Le paiement n'a pas pu démarrer</p>
                  <p className="mt-0.5 text-xs text-red-700 leading-relaxed break-words">{erreur}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePayer}
                  disabled={status === "loading" || !offre}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <i className="ri-refresh-line"></i>
                  Réessayer
                </button>
                <Link
                  to="/#contact"
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
                >
                  <i className="ri-customer-service-2-line"></i>
                  Nous contacter
                </Link>
              </div>
              <p className="text-[11px] text-foreground-500 leading-relaxed">
                Votre compte n'est pas débité tant que le paiement n'aboutit pas. Vous pouvez réessayer sans risque.
              </p>

              {isGestionnaire && estErreurConfigPaiement(erreur) && (
                <div className="rounded-md border border-accent-300/70 bg-accent-100/70 px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-accent-800">
                    <i className="ri-tools-line"></i>
                    Alerte configuration paiement (gestionnaire)
                  </p>
                  <p className="mt-1 text-xs text-accent-900 leading-relaxed">
                    Cette erreur vient de la configuration du compte Stripe, pas de votre site. Vérifiez la connexion
                    Stripe et que des moyens de paiement compatibles avec l'euro (EUR) sont bien activés, puis
                    réessayez.
                  </p>
                </div>
              )}
            </div>
          )}

          {user ? (
            <>
              <button
                type="button"
                onClick={handlePayer}
                disabled={status === "loading" || !offre}
                className="inline-flex items-center justify-center gap-2 h-12 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {status === "loading" ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    Ouverture du paiement…
                  </>
                ) : (
                  <>
                    <i className="ri-lock-2-line"></i>
                    {modePaiement === "unique"
                      ? `Payer ${facturation === "annuel" ? total : prixAffiche} € une fois avec Stripe`
                      : dureeEssai > 0
                        ? `Démarrer mon essai de ${dureeEssai} jours`
                        : `Payer ${facturation === "annuel" ? total : prixAffiche} € ${
                            facturation === "annuel" ? "/ an" : "/ mois"
                          } avec Stripe`}
                  </>
                )}
              </button>
              <p className="text-center text-[11px] text-foreground-400">
                {modePaiement === "unique"
                  ? "Paiement unique, sans reconduction automatique. En continuant, vous acceptez nos"
                  : dureeEssai > 0
                    ? `Aucun débit avant la fin de l'essai. Vous pourrez résilier à tout moment depuis « Mon abonnement ». En continuant, vous acceptez nos`
                    : "Vous pourrez résilier à tout moment depuis « Mon abonnement ». En continuant, vous acceptez nos"}{" "}
                <Link to="/cgv" className="font-semibold text-primary-700 hover:underline cursor-pointer">
                  conditions générales
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-secondary-200 bg-secondary-100/70 px-4 py-3 flex items-start gap-2.5">
                <i className="ri-user-line text-secondary-700 mt-0.5"></i>
                <p className="text-xs text-secondary-900">
                  Connectez-vous (ou créez votre espace) pour rattacher l'abonnement à votre compte ArtiFlow-pro.
                </p>
              </div>
              <Link
                to="/app/auth"
                state={{ from: "/tarifs" }}
                className="inline-flex items-center justify-center gap-2 h-12 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-login-box-line"></i>
                Se connecter pour continuer
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}