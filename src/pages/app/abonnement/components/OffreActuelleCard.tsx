import { useState } from "react";
import { formatEuros } from "@/lib/format";
import { formatShortDate } from "@/lib/dates";
import { offreDetail, statutMeta, joursAvant, modeAbonnement, modeMeta } from "@/lib/monAbonnement";
import { ouvrirPortailAbonnement, urlRetourMonAbonnement, type ModePaiement } from "@/lib/abonnementPaiement";
import type { MonAbonnement } from "@/hooks/useMonAbonnement";
import NoteFinEssai from "@/components/feature/NoteFinEssai";

function AlerteStatut({ abonnement }: { abonnement: MonAbonnement }) {
  const jours = joursAvant(abonnement.date_echeance);

  if (abonnement.statut === "Impayé") {
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-red-100 text-red-600">
          <i className="ri-error-warning-line"></i>
        </span>
        <div>
          <p className="text-sm font-semibold text-red-800">Paiement en attente</p>
          <p className="text-xs text-red-700 mt-0.5">
            Votre dernier paiement n'a pas abouti. Régularisez-le pour conserver l'accès à toutes vos
            fonctionnalités.
          </p>
        </div>
      </div>
    );
  }

  if (abonnement.statut === "Essai") {
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary-100 border border-secondary-200">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-secondary-200 text-secondary-800">
          <i className="ri-timer-line"></i>
        </span>
        <div>
          <p className="text-sm font-semibold text-secondary-900">Période d'essai en cours</p>
          <p className="text-xs text-secondary-800 mt-0.5">
            {jours !== null && jours >= 0
              ? `Votre essai se termine dans ${jours} jour${jours > 1 ? "s" : ""}${
                  abonnement.date_echeance ? `, le ${formatShortDate(abonnement.date_echeance)}` : ""
                }.`
              : "Profitez de toutes les fonctionnalités pendant votre essai."}
          </p>
        </div>
      </div>
    );
  }

  if (abonnement.statut === "Résilié") {
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg bg-background-200 border border-background-300">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-background-300 text-foreground-600">
          <i className="ri-close-circle-line"></i>
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground-800">Abonnement résilié</p>
          <p className="text-xs text-foreground-600 mt-0.5">
            Votre abonnement n'est plus actif. Réactivez une offre depuis la comparaison ci-dessous pour retrouver
            l'espace complet.
          </p>
        </div>
      </div>
    );
  }

  if (jours !== null && jours >= 0 && jours <= 14) {
    const unique = modeAbonnement(abonnement.canal_paiement) === "unique";
    return (
      <div className="flex items-start gap-3 p-4 rounded-lg bg-accent-100 border border-accent-300">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-accent-200 text-accent-800">
          <i className="ri-calendar-check-line"></i>
        </span>
        <div>
          <p className="text-sm font-semibold text-accent-900">
            {unique ? "Fin de période proche" : "Renouvellement proche"}
          </p>
          <p className="text-xs text-accent-800 mt-0.5">
            {unique
              ? `Votre période payée se termine dans ${jours} jour${jours > 1 ? "s" : ""}${
                  abonnement.date_echeance ? ` (le ${formatShortDate(abonnement.date_echeance)})` : ""
                }. Pensez à prolonger votre accès pour éviter toute interruption.`
              : `Votre abonnement sera renouvelé dans ${jours} jour${jours > 1 ? "s" : ""}${
                  abonnement.date_echeance ? ` (le ${formatShortDate(abonnement.date_echeance)})` : ""
                }.`}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

function Metrique({ icone, label, valeur, sous }: { icone: string; label: string; valeur: string; sous?: string }) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-lg bg-background-50 border border-background-200">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
        <i className={`${icone} text-foreground-400`}></i> {label}
      </span>
      <span className="font-heading font-bold text-lg text-foreground-950">{valeur}</span>
      {sous ? <span className="text-[11px] text-foreground-500">{sous}</span> : null}
    </div>
  );
}

export default function OffreActuelleCard({
  abonnement,
  onChangerMode,
}: {
  abonnement: MonAbonnement;
  /** Ouvre le tunnel de paiement pour basculer entre abonnement reconductible et paiement unique. */
  onChangerMode?: (mode: ModePaiement) => void;
}) {
  const meta = statutMeta(abonnement.statut);
  const detail = offreDetail(abonnement.offre);
  const mode = modeAbonnement(abonnement.canal_paiement);
  const modeInfo = modeMeta(mode);
  const jours = joursAvant(abonnement.date_echeance);
  const gratuit = abonnement.montant_mensuel <= 0;
  const gestionStripe = (abonnement.canal_paiement ?? "").includes("Stripe");
  const mention = abonnement.montants_ttc ? "TTC" : "HT";

  const [gestion, setGestion] = useState<{ etat: "idle" | "loading" | "error"; message: string }>({
    etat: "idle",
    message: "",
  });

  const ouvrirGestion = async () => {
    setGestion({ etat: "loading", message: "" });
    try {
      const { url } = await ouvrirPortailAbonnement(urlRetourMonAbonnement());
      window.location.assign(url);
    } catch (e) {
      setGestion({
        etat: "error",
        message: e instanceof Error ? e.message : "La gestion de l'abonnement n'a pas pu être ouverte.",
      });
    }
  };

  return (
    <section className="flex flex-col gap-4 p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="w-12 h-12 shrink-0 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700 text-2xl">
            <i className="ri-vip-crown-2-line"></i>
          </span>
          <div>
            <p className="text-[11px] font-semibold text-foreground-400 uppercase tracking-wide">Offre en cours</p>
            <h3 className="font-heading font-bold text-xl text-foreground-950">
              ArtiFlow-pro {abonnement.offre}
            </h3>
            {detail ? <p className="text-sm text-foreground-500 mt-0.5">{detail.accroche}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold ${modeInfo.tone}`}>
            <i className={modeInfo.icone}></i>
            {modeInfo.court}
          </span>
          <span className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold ${meta.tone}`}>
            <i className={meta.icon}></i>
            {meta.label}
          </span>
          <div className="text-right">
            <p className="flex items-baseline justify-end gap-1.5">
              <span className="font-heading font-bold text-2xl text-foreground-950">
                {gratuit ? "Offert" : formatEuros(abonnement.montant_mensuel)}
              </span>
              {!gratuit ? (
                <span className="text-[10px] font-bold text-foreground-400 uppercase tracking-wide">
                  {mention}
                </span>
              ) : null}
            </p>
            {!gratuit ? <p className="text-[11px] text-foreground-500">par mois</p> : null}
          </div>
        </div>
      </div>

      <AlerteStatut abonnement={abonnement} />

      {abonnement.statut !== "Essai" ? <NoteFinEssai dateDebut={abonnement.date_debut} /> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metrique
          icone="ri-play-circle-line"
          label="Début de l'abonnement"
          valeur={abonnement.date_debut ? formatShortDate(abonnement.date_debut) : "—"}
        />
        <Metrique
          icone="ri-calendar-event-line"
          label="Prochaine échéance"
          valeur={abonnement.date_echeance ? formatShortDate(abonnement.date_echeance) : "—"}
          sous={jours !== null && jours >= 0 ? `dans ${jours} jour${jours > 1 ? "s" : ""}` : undefined}
        />
        <Metrique
          icone="ri-bank-card-line"
          label="Moyen de paiement"
          valeur={abonnement.canal_paiement ?? "—"}
        />
        <Metrique
          icone="ri-building-line"
          label="Entreprise"
          valeur={abonnement.entreprise}
          sous={[abonnement.metier, abonnement.ville].filter(Boolean).join(" · ") || undefined}
        />
      </div>

      {detail ? (
        <div className="flex flex-col gap-2 pt-1">
          <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
            Inclus dans votre offre
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {detail.inclus.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-foreground-700">
                <i className="ri-checkbox-circle-fill text-accent-600"></i>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 pt-4 border-t border-background-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-base ${modeInfo.tone}`}>
              <i className={modeInfo.icone}></i>
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground-900">Formule de paiement</p>
              <p className="text-xs text-foreground-500 mt-0.5">
                <span className="font-medium text-foreground-700">{modeInfo.label}.</span> {modeInfo.description}
              </p>
            </div>
          </div>
          {onChangerMode ? (
            <button
              type="button"
              onClick={() => onChangerMode(mode === "unique" ? "recurrent" : "unique")}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
            >
              <i className={mode === "unique" ? "ri-loop-right-line" : "ri-hand-coin-line"}></i>
              {mode === "unique" ? "Passer en abonnement reconductible" : "Passer en paiement unique"}
            </button>
          ) : null}
        </div>
      </div>

      {gestionStripe ? (
        <div className="flex flex-col gap-2 pt-4 border-t border-background-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
                <i className="ri-bank-card-line"></i>
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground-900">Gérer mon abonnement</p>
                <p className="text-xs text-foreground-500 mt-0.5">
                  Changez votre moyen de paiement, téléchargez vos factures ou résiliez à tout moment.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={ouvrirGestion}
              disabled={gestion.etat === "loading"}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-secondary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {gestion.etat === "loading" ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  Ouverture…
                </>
              ) : (
                <>
                  <i className="ri-settings-3-line"></i>
                  Gérer / résilier
                </>
              )}
            </button>
          </div>
          {gestion.etat === "error" ? (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {gestion.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}