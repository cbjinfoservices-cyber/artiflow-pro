import { Link } from "react-router-dom";
import type { MonAbonnement } from "@/hooks/useMonAbonnement";
import { joursAvant, offreDetail, statutMeta } from "@/lib/monAbonnement";

function formatEuros(montant: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(montant);
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Récap affiché lorsque l'artisan connecté a déjà un abonnement actif
 * (page Tarifs et section Tarifs de l'accueil). Il rappelle l'offre en cours,
 * le montant, le statut et la prochaine échéance, puis l'oriente vers la
 * gestion de son abonnement pour éviter une double souscription.
 */
export default function BandeauDejaAbonne({ abonnement }: { abonnement: MonAbonnement }) {
  const meta = statutMeta(abonnement.statut);
  const detail = offreDetail(abonnement.offre);
  const echeance = formatDate(abonnement.date_echeance);
  const jours = joursAvant(abonnement.date_echeance);
  const mention = abonnement.montants_ttc ? "TTC" : "HT";

  return (
    <div className="mb-6 rounded-lg bg-accent-100 border border-accent-300/70 p-4 md:p-5 animate-fade-in text-left">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <span className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50 text-xl">
          <i className="ri-vip-crown-2-line"></i>
        </span>

        <div className="flex-1 min-w-0">
          <p className="inline-flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap">
              <i className="ri-checkbox-circle-line"></i>
              Vous êtes déjà abonné
            </span>
            <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-bold whitespace-nowrap ${meta.tone}`}>
              <i className={meta.icon}></i>
              {meta.label}
            </span>
          </p>

          <p className="mt-2 font-heading font-semibold text-sm md:text-base text-accent-900">
            Offre ArtiFlow-pro {abonnement.offre}
          </p>
          {detail ? (
            <p className="mt-0.5 text-xs md:text-sm text-accent-800/85">{detail.accroche}</p>
          ) : null}

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-md bg-background-50/80 border border-accent-300/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-500">Montant</p>
              <p className="mt-0.5 font-heading font-bold text-sm text-foreground-950">
                {formatEuros(abonnement.montant_mensuel)}{" "}
                <span className="text-[11px] font-medium text-foreground-500">/ mois {mention}</span>
              </p>
            </div>
            <div className="rounded-md bg-background-50/80 border border-accent-300/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-500">Statut</p>
              <p className="mt-0.5 font-heading font-bold text-sm text-foreground-950">{meta.label}</p>
            </div>
            <div className="rounded-md bg-background-50/80 border border-accent-300/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-500">Prochaine échéance</p>
              <p className="mt-0.5 font-heading font-bold text-sm text-foreground-950">
                {echeance ?? "—"}
                {jours !== null && jours >= 0 ? (
                  <span className="ml-1 text-[11px] font-medium text-foreground-500">
                    {jours === 0 ? "(aujourd'hui)" : `(dans ${jours} j)`}
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <p className="mt-3 text-xs md:text-sm text-accent-800/90 leading-relaxed">
            Inutile de souscrire une nouvelle fois : votre abonnement est bien actif. Vous pouvez changer
            d'offre, gérer votre moyen de paiement ou télécharger vos factures depuis votre espace.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
        <Link
          to="/app/profil?onglet=abonnement"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
        >
          <i className="ri-settings-3-line"></i>
          Gérer mon abonnement
        </Link>
        <Link
          to="/app"
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-background-50/80 border border-accent-300/60 text-accent-900 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-50 transition-colors"
        >
          <i className="ri-dashboard-3-line"></i>
          Retour à mon espace
        </Link>
      </div>
    </div>
  );
}