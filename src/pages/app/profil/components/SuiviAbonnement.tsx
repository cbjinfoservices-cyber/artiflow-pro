import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMonAbonnement } from "@/hooks/useMonAbonnement";
import { confirmerAbonnement, type ModePaiement } from "@/lib/abonnementPaiement";
import DataState from "@/pages/app/components/DataState";
import OffreActuelleCard from "@/pages/app/abonnement/components/OffreActuelleCard";
import ComparaisonOffres from "@/pages/app/abonnement/components/ComparaisonOffres";
import HistoriqueOffresCard from "@/pages/app/abonnement/components/HistoriqueOffresCard";
import FacturesAbonnementCard from "@/pages/app/abonnement/components/FacturesAbonnementCard";
import RappelOffreBanner from "@/pages/app/abonnement/components/RappelOffreBanner";
import AbonnementCheckoutModal from "@/pages/tarifs/components/AbonnementCheckoutModal";
import ResilierAbonnementCard from "@/pages/app/profil/components/ResilierAbonnementCard";
import EncartPaiementIndisponible from "@/pages/app/components/EncartPaiementIndisponible";
import { useDiagnosticPaiementEur } from "@/hooks/useDiagnosticPaiementEur";

type Onglet = "situation" | "historique";

/** Encart affiché quand aucun abonnement n'est rattaché au compte. */
function VideAucunAbonnement() {
  return (
    <div className="flex flex-col items-center text-center px-6 py-16 rounded-lg bg-background-100 border border-background-200">
      <span className="w-14 h-14 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700 text-2xl">
        <i className="ri-vip-crown-line"></i>
      </span>
      <h3 className="mt-4 font-heading font-semibold text-base text-foreground-950">
        Aucun abonnement rattaché à votre compte
      </h3>
      <p className="mt-2 text-sm text-foreground-500 max-w-md">
        Nous n'avons pas trouvé d'abonnement associé à votre compte. Découvrez les offres ArtiFlow-pro, ou
        contactez-nous et nous l'activons pour vous.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/tarifs"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
        >
          <i className="ri-price-tag-3-line"></i>
          Voir les offres
        </Link>
        <Link
          to="/#contact"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
        >
          <i className="ri-customer-service-2-line"></i>
          Nous contacter
        </Link>
      </div>
    </div>
  );
}

/**
 * Suivi de l'abonnement de l'artisan (offre en cours, statut, prochaines échéances,
 * factures et comparatif d'offres). Intégré comme onglet de la page Profil, il
 * regroupe tout ce qui était auparavant sur une page dédiée « Mon abonnement ».
 */
export default function SuiviAbonnement() {
  const { abonnement, loading, error, reload } = useMonAbonnement();
  const [onglet, setOnglet] = useState<Onglet>("situation");
  const [aboModal, setAboModal] = useState<{ open: boolean; plan: string | null; mode: ModePaiement }>({
    open: false,
    plan: null,
    mode: "recurrent",
  });

  // Même bandeau que sur la page Tarifs : on prévient ici aussi si le paiement carte en
  // euros est indisponible, car cette section sert justement à gérer/reprendre le paiement.
  const {
    diagnostic: diagnosticPaiement,
    indisponible: paiementIndisponible,
    chargement: chargementPaiement,
    reverifier: reverifierPaiement,
  } = useDiagnosticPaiementEur();
  const [bandeauPaiementMasque, setBandeauPaiementMasque] = useState(false);
  const paiementBloque = paiementIndisponible && !bandeauPaiementMasque;

  const [searchParams, setSearchParams] = useSearchParams();
  const [paiement, setPaiement] = useState<{ etat: "idle" | "loading" | "success" | "error"; message: string }>({
    etat: "idle",
    message: "",
  });
  const confirmationFaite = useRef(false);

  // Retour de Stripe : on vérifie le paiement puis on active l'abonnement.
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (checkout !== "success" || !sessionId || confirmationFaite.current) return;
    confirmationFaite.current = true;
    setPaiement({ etat: "loading", message: "Nous vérifions votre paiement auprès de Stripe…" });
    confirmerAbonnement(sessionId)
      .then((abo) => {
        setPaiement({ etat: "success", message: `Votre abonnement ${abo.offre} est désormais actif. Merci !` });
        reload();
      })
      .catch((e) => {
        setPaiement({
          etat: "error",
          message: e instanceof Error ? e.message : "Le paiement n'a pas pu être confirmé.",
        });
      })
      .finally(() => {
        const next = new URLSearchParams(searchParams);
        next.delete("checkout");
        next.delete("session_id");
        setSearchParams(next, { replace: true });
      });
  }, [searchParams, setSearchParams, reload]);

  return (
    <div className="flex flex-col gap-5">
      {paiementIndisponible && !bandeauPaiementMasque ? (
        <EncartPaiementIndisponible
          motif={diagnosticPaiement?.motif}
          diagnostic={diagnosticPaiement}
          chargement={chargementPaiement}
          origine="mon-abonnement"
          onReverifier={reverifierPaiement}
          onClose={() => setBandeauPaiementMasque(true)}
        />
      ) : null}

      {paiement.etat !== "idle" && (
        <div
          className={`flex items-start gap-3 p-4 rounded-lg border ${
            paiement.etat === "success"
              ? "bg-accent-100 border-accent-300"
              : paiement.etat === "error"
                ? "bg-red-50 border-red-200"
                : "bg-secondary-100 border-secondary-200"
          }`}
        >
          <span
            className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full ${
              paiement.etat === "success"
                ? "bg-accent-500 text-background-50"
                : paiement.etat === "error"
                  ? "bg-red-500 text-background-50"
                  : "bg-secondary-500 text-background-50"
            }`}
          >
            <i
              className={
                paiement.etat === "success"
                  ? "ri-check-line"
                  : paiement.etat === "error"
                    ? "ri-error-warning-line"
                    : "ri-loader-4-line animate-spin"
              }
            ></i>
          </span>
          <div className="min-w-0">
            <p
              className={`font-heading font-semibold text-sm ${
                paiement.etat === "error" ? "text-red-800" : "text-foreground-950"
              }`}
            >
              {paiement.etat === "success"
                ? "Paiement confirmé"
                : paiement.etat === "error"
                  ? "Paiement non confirmé"
                  : "Confirmation en cours"}
            </p>
            <p
              className={`mt-0.5 text-xs ${
                paiement.etat === "error" ? "text-red-700" : "text-foreground-600"
              }`}
            >
              {paiement.message}
            </p>
          </div>
        </div>
      )}

      <RappelOffreBanner offreActuelle={abonnement?.offre} />

      <DataState loading={loading} error={error} onRetry={reload}>
        {abonnement ? (
          <>
            <div className="flex w-fit gap-1 p-1 rounded-full bg-background-100 border border-background-200">
              <button
                type="button"
                onClick={() => setOnglet("situation")}
                aria-pressed={onglet === "situation"}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  onglet === "situation"
                    ? "bg-primary-500 text-background-50"
                    : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className="ri-vip-crown-line"></i>
                Ma situation
              </button>
              <button
                type="button"
                onClick={() => setOnglet("historique")}
                aria-pressed={onglet === "historique"}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  onglet === "historique"
                    ? "bg-primary-500 text-background-50"
                    : "text-foreground-600 hover:bg-background-200"
                }`}
              >
                <i className="ri-history-line"></i>
                Historique
              </button>
            </div>

            {onglet === "situation" ? (
              <>
                <OffreActuelleCard
                  abonnement={abonnement}
                  onChangerMode={(mode) => setAboModal({ open: true, plan: abonnement.offre, mode })}
                />
                {abonnement.statut !== "Résilié" ? (
                  <ResilierAbonnementCard abonnement={abonnement} onResilie={reload} />
                ) : null}
                {(abonnement.canal_paiement ?? "").includes("Stripe") ? (
                  <FacturesAbonnementCard abonnement={abonnement} />
                ) : null}
                <ComparaisonOffres
                  offreActuelle={abonnement.offre}
                  onChoisir={(plan, mode) => setAboModal({ open: true, plan, mode })}
                  desactivePaiement={paiementBloque}
                />
              </>
            ) : (
              <HistoriqueOffresCard abonnement={abonnement} />
            )}
          </>
        ) : (
          <VideAucunAbonnement />
        )}
      </DataState>

      <AbonnementCheckoutModal
        open={aboModal.open}
        plan={aboModal.plan}
        modePaiement={aboModal.mode}
        onClose={() => setAboModal((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}