import { Link } from "react-router-dom";
import { useMonAbonnement } from "@/hooks/useMonAbonnement";
import { useDureeEssai } from "@/hooks/useDureeEssai";
import { formatEuros } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import { finPeriodeEssai, joursAvant } from "@/lib/monAbonnement";

/**
 * Bandeau d'alerte du tableau de bord sur l'abonnement de l'artisan. Il couvre trois
 * situations complémentaires, chacune avec son style et son message :
 *   • Impayé          → alerte rouge (régulariser sans délai) ;
 *   • Fin d'essai proche → alerte accent (choisir une offre avant la coupure) ;
 *   • Résilié         → rappel neutre (réactiver quand on veut).
 *
 * Il ne déclenche AUCUN paiement : tant que le règlement en ligne n'est pas branché,
 * il sert de signal visuel et renvoie vers la page « Mon abonnement ».
 */
export default function AlerteAbonnement() {
  const { abonnement, loading } = useMonAbonnement();
  const { jours: dureeEssai } = useDureeEssai();

  // Rien à afficher tant que l'abonnement n'est pas chargé ou s'il n'y en a pas.
  if (loading || !abonnement) return null;

  const { statut, offre, montant_mensuel, date_echeance, date_debut } = abonnement;
  // Date de fin d'essai : l'échéance enregistrée si elle existe, sinon date de début + 14 jours.
  const finEssai = date_echeance ?? finPeriodeEssai(date_debut);
  const jours = joursAvant(finEssai);
  const echeance = finEssai ? formatShortDate(finEssai) : null;
  const montantDu = montant_mensuel > 0 ? formatEuros(montant_mensuel) : null;

  const offreBadge = (tone: string) => (
    <span className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full ${tone} text-[11px] font-bold whitespace-nowrap`}>
      <i className="ri-vip-crown-2-line"></i>
      ArtiFlow-pro {offre}
    </span>
  );

  // 1) Abonnement impayé : la priorité absolue, message rouge.
  if (statut === "Impayé") {
    return (
      <div className="p-4 rounded-lg bg-red-50 border border-red-300 flex items-start gap-3 animate-fade-in">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-700 text-lg">
          <i className="ri-error-warning-line"></i>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-red-800">Alerte : abonnement impayé</p>
            {offreBadge("bg-red-100 text-red-700")}
          </div>
          <p className="mt-0.5 text-xs text-red-700">
            Votre dernier paiement{montantDu ? ` de ${montantDu}` : ""} n'a pas abouti.
            {echeance ? ` L'échéance du ${echeance} reste due.` : ""} Régularisez votre abonnement pour conserver
            l'accès complet à vos devis, relances et à votre espace comptable.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              to="/app/profil?onglet=abonnement"
              title="Consulter votre abonnement et régulariser"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-bank-card-line"></i>
              Régulariser mon abonnement
            </Link>
            <Link
              to="/#contact"
              title="Nous contacter au sujet de votre abonnement"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-red-200 text-red-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-red-100 transition-colors"
            >
              <i className="ri-customer-service-2-line"></i>
              Nous contacter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2) Période d'essai : compte à rebours « il vous reste X jours d'essai »,
  // affiché en permanence tant que l'essai est en cours (réel essai Stripe).
  // Le jour même de la fin (jours = 0), le bandeau est RENFORCÉ pour maximiser la
  // conversion avant le tout premier prélèvement.
  if (statut === "Essai") {
    const expire = jours !== null && jours < 0;
    const restants = jours === null ? null : Math.max(0, jours);
    const dernierJour = jours === 0;
    const renforce = dernierJour;
    return (
      <div
        className={`flex items-start gap-3 animate-fade-in rounded-lg ${
          renforce ? "p-4 md:p-5 bg-accent-100 border-2 border-accent-500" : "p-4 bg-accent-50 border border-accent-300"
        }`}
      >
        <span
          className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-full text-lg ${
            renforce ? "bg-accent-500 text-background-50" : "bg-accent-100 text-accent-700"
          }`}
        >
          <i className={expire ? "ri-close-circle-line" : renforce ? "ri-alarm-warning-line" : "ri-hourglass-line"}></i>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm font-bold ${renforce ? "text-accent-950" : "text-accent-900"}`}>
              {expire ? "Votre essai est terminé" : renforce ? "Dernier jour d'essai !" : "Période d'essai en cours"}
            </p>
            {offreBadge("bg-accent-100 text-accent-800")}
            {renforce && (
              <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-accent-500 text-background-50 text-[11px] font-bold whitespace-nowrap">
                <i className="ri-alarm-warning-line"></i>
                Premier prélèvement demain
              </span>
            )}
          </div>
          <p className={`mt-0.5 text-xs ${renforce ? "text-accent-900" : "text-accent-800"}`}>
            {expire
              ? `Votre période d'essai de ${dureeEssai} jours est arrivée à son terme. Choisissez votre offre pour continuer à profiter de toutes les fonctionnalités.`
              : dernierJour
                ? `C'est aujourd'hui le dernier jour de votre essai${echeance ? ` (fin le ${echeance})` : ""}. Dès demain, votre abonnement ${
                    offre
                  } se poursuit automatiquement${
                    montantDu ? ` — premier prélèvement de ${montantDu}` : " et le premier prélèvement sera effectué"
                  } : aucune action n'est nécessaire pour conserver vos devis, relances et votre espace comptable.`
                : `Il vous reste ${restants} jour${restants && restants > 1 ? "s" : ""} d'essai${
                    echeance ? ` (fin le ${echeance})` : ""
                  } — aucun débit n'a lieu pendant l'essai.`}
          </p>
          {!expire && restants !== null && dureeEssai > 0 ? (
            <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-accent-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-500 transition-all"
                style={{ width: renforce ? "100%" : `${Math.max(0, Math.min(100, (restants / dureeEssai) * 100))}%` }}
              />
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              to="/app/profil?onglet=abonnement"
              title="Choisir votre offre ArtiFlow-pro"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-vip-crown-line"></i>
              Choisir mon offre
            </Link>
            <Link
              to="/#contact"
              title="Parler à notre équipe de votre essai"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-accent-300 text-accent-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-100 transition-colors"
            >
              <i className="ri-customer-service-2-line"></i>
              Nous contacter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3) Abonnement résilié : rappel neutre, sans ton alarmant.
  if (statut === "Résilié") {
    return (
      <div className="p-4 rounded-lg bg-background-100 border border-background-300 flex items-start gap-3 animate-fade-in">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-background-200 text-foreground-600 text-lg">
          <i className="ri-close-circle-line"></i>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-foreground-900">Abonnement résilié</p>
            {offreBadge("bg-background-200 text-foreground-700")}
          </div>
          <p className="mt-0.5 text-xs text-foreground-600">
            Votre abonnement ArtiFlow-pro {offre} est résilié. Vos données restent conservées : réactivez votre offre quand vous
            le souhaitez pour retrouver l'accès complet à vos devis, relances et à votre espace comptable.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              to="/app/profil?onglet=abonnement"
              title="Réactiver votre abonnement ArtiFlow-pro"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className="ri-restart-line"></i>
              Réactiver mon abonnement
            </Link>
            <Link
              to="/#contact"
              title="Nous contacter au sujet de votre résiliation"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-300 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
            >
              <i className="ri-customer-service-2-line"></i>
              Nous contacter
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}