import { useMemo, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { formatShortDate } from "@/lib/dates";
import { toCsv, downloadCsv } from "@/lib/csv";
import type { RecapRecontactEnvoi } from "@/lib/recontactSeuil";
import type { AbonnementItem, RecontactArtisanItem } from "@/lib/abonnementsApi";
import RecontacterTousModal, { type CibleRecontact } from "@/pages/app/abonnements/components/RecontacterTousModal";

interface Props {
  /** Envoi de récap affiché en détail. */
  recap: RecapRecontactEnvoi;
  /** Parc d'abonnements, pour résoudre les comptes listés à partir de leurs identifiants. */
  abos: AbonnementItem[];
  /** Tous les recontacts envoyés, pour savoir quels comptes listés ont déjà été relancés après cet envoi. */
  recontacts: RecontactArtisanItem[];
  /** Libellé du seuil de volatilité (repris dans l'envoi groupé). */
  seuilLabel: string;
  /** Seuil d'alerte du taux de recontact (%), pour marquer les envois inefficaces. */
  seuilAlerte: number;
  onClose: () => void;
  /** Notifie le parent qu'un recontact a été envoyé (rafraîchit le journal). */
  onRecontactSent?: () => void;
}

/** Portée du recontact : uniquement les comptes oubliés, ou bien tous les comptes listés. */
type Portee = "oublies" | "tous";

/**
 * Détail d'un récap hebdomadaire : liste les comptes qui y étaient listés (la fonction Backend
 * mémorise leurs identifiants) et indique, pour chacun, s'il a déjà été recontacté depuis l'envoi.
 * On peut ainsi relancer en un clic seulement les comptes oubliés, sans repasser par la liste.
 */
export default function DetailRecapModal({
  recap,
  abos,
  recontacts,
  seuilLabel,
  seuilAlerte,
  onClose,
  onRecontactSent,
}: Props) {
  const [recontactOpen, setRecontactOpen] = useState(false);
  const [portee, setPortee] = useState<Portee>("oublies");

  // Comptes listés dans ce récap, résolus depuis le parc (ordre de la liste d'origine).
  const comptes = useMemo(() => {
    const parId = new Map(abos.map((a) => [a.id, a]));
    return recap.abonnementIds
      .map((id) => parId.get(id))
      .filter((a): a is AbonnementItem => a !== undefined);
  }, [recap.abonnementIds, abos]);

  // Comptes disparus du parc depuis l'envoi (résiliés/supprimés) : on les signale sans les cacher.
  const nbManquants = recap.abonnementIds.length - comptes.length;

  // Identifiants des comptes listés ayant reçu un recontact RÉUSSI après la date d'envoi du récap.
  const dejaRecontactes = useMemo(() => {
    const envoyesLeMs = new Date(recap.envoyeLe).getTime();
    const ids = new Set<number>();
    if (Number.isNaN(envoyesLeMs)) return ids;
    recontacts.forEach((r) => {
      if (r.statut !== "envoye") return;
      if (r.abonnement_id === null) return;
      const t = new Date(r.created_at).getTime();
      if (!Number.isNaN(t) && t > envoyesLeMs) ids.add(r.abonnement_id);
    });
    return ids;
  }, [recontacts, recap.envoyeLe]);

  // Comptes oubliés : listés dans ce récap et pas (encore) recontactés depuis cet envoi.
  const oublies = useMemo(() => comptes.filter((a) => !dejaRecontactes.has(a.id)), [comptes, dejaRecontactes]);

  // Comptes affichés et ciblés par le recontact, selon la portée choisie.
  const affiches = portee === "oublies" ? oublies : comptes;

  const cibles: CibleRecontact[] = useMemo(
    () =>
      affiches.map((a) => ({
        abonnementId: a.id,
        entreprise: a.entreprise,
        email: a.email,
        // Volatilité inconnue à cet endroit : affichage neutre dans l'envoi groupé.
        nbChangements: 0,
      })),
    [affiches],
  );

  const sousSeuil = recap.tauxApres !== null && recap.tauxApres < seuilAlerte;
  const avecEmail = comptes.filter((a) => !!a.email).length;
  const nbDeja = comptes.length - oublies.length;
  const nbAffichesAvecEmail = affiches.filter((a) => !!a.email).length;

  const portees: { key: Portee; label: string; count: number }[] = [
    { key: "oublies", label: "À relancer", count: oublies.length },
    { key: "tous", label: "Tous", count: comptes.length },
  ];

  // Export de la liste des oubliés (comptes jamais relancés depuis cet envoi) au format CSV,
  // pour les relancer hors de l'application ou les transmettre à un collaborateur.
  const handleExportOubliesCsv = () => {
    const rows = oublies.map((a) => [a.entreprise, a.email ?? "", a.offre, "À relancer"]);
    downloadCsv(
      `oublies-recap-${formatShortDate(recap.envoyeLe).replace(/\s/g, "-")}.csv`,
      toCsv(["Entreprise", "Email", "Offre", "Statut"], rows),
    );
  };

  return (
    <>
      <Modal
        title="Détail du récap hebdomadaire"
        subtitle={`Envoi du ${formatShortDate(recap.envoyeLe)} · ${recap.origine === "test" ? "test manuel" : "automatique"}`}
        onClose={onClose}
        wide
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRecontactOpen(true)}
              disabled={cibles.length === 0}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-mail-send-line"></i>
              {portee === "oublies"
                ? `Relancer ${oublies.length} compte${oublies.length > 1 ? "s" : ""} oublié${oublies.length > 1 ? "s" : ""}`
                : `Recontacter ${comptes.length} compte${comptes.length > 1 ? "s" : ""}`}
            </button>
            <button
              type="button"
              onClick={handleExportOubliesCsv}
              disabled={oublies.length === 0}
              title="Exporter la liste des comptes oubliés de ce récap (entreprise, email, offre) au format CSV"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary-100 text-secondary-800 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-file-excel-2-line"></i>
              Exporter les oubliés (CSV)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
            >
              Fermer
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-background-100 border border-background-200">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Comptes concernés</span>
              <span className="font-heading font-bold text-xl text-foreground-950">{recap.nbComptes}</span>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-background-100 border border-background-200">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Recontactés après</span>
              <span className="font-heading font-bold text-xl text-foreground-950">{nbDeja}</span>
            </div>
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-accent-100 border border-accent-300">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-800">Oubliés</span>
              <span className="font-heading font-bold text-xl text-accent-800">{oublies.length}</span>
            </div>
            <div
              className={`flex flex-col gap-1 p-3 rounded-lg border ${
                sousSeuil ? "bg-red-50 border-red-200" : "bg-background-100 border-background-200"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">Taux de recontact</span>
              <span className={`font-heading font-bold text-xl ${sousSeuil ? "text-red-600" : "text-foreground-950"}`}>
                {recap.tauxApres === null ? "— %" : `${recap.tauxApres} %`}
              </span>
            </div>
          </div>

          {sousSeuil && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <i className="ri-alert-line mt-px"></i>
              <span>
                Ce récap est sous votre seuil d'alerte ({seuilAlerte} %) : peu de comptes listés ont été recontactés depuis.
                Vous pouvez relancer les comptes oubliés ci-dessous.
              </span>
            </div>
          )}

          {recap.autoRelancesApres > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-accent-100 border border-accent-300 text-sm text-foreground-800">
              <i className="ri-robot-2-line mt-px text-accent-700"></i>
              <span>
                {recap.autoRelancesApres} compte{recap.autoRelancesApres > 1 ? "s" : ""} listé
                {recap.autoRelancesApres > 1 ? "s" : ""} dans ce récap {recap.autoRelancesApres > 1 ? "ont" : "a"} bénéficié
                d'une relance automatique après l'envoi.
              </span>
            </div>
          )}

          {comptes.length > 0 && oublies.length === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-accent-100 border border-accent-300 text-sm text-foreground-800">
              <i className="ri-checkbox-circle-line mt-px text-accent-700"></i>
              <span>
                Tous les comptes listés dans ce récap ont déjà été recontactés depuis l'envoi. Rien à relancer.
              </span>
            </div>
          )}

          {recap.abonnementIds.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-8 px-4 text-center rounded-lg bg-background-50 border border-background-200">
              <span className="w-11 h-11 flex items-center justify-center rounded-full bg-background-200 text-foreground-400">
                <i className="ri-list-check-2 text-xl"></i>
              </span>
              <p className="text-sm font-medium text-foreground-700">Liste des comptes non disponible</p>
              <p className="text-xs text-foreground-500 max-w-md">
                Cet envoi est antérieur à la mesure d'efficacité : la liste des comptes n'a pas été conservée. Les prochains
                envois permettront d'afficher et de recontacter les comptes listés ici.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                  Statut des comptes listés
                </span>
                <div className="flex flex-wrap gap-1 p-1 rounded-full bg-background-100 border border-background-200 w-fit">
                  {portees.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPortee(p.key)}
                      aria-pressed={portee === p.key}
                      title={
                        p.key === "oublies"
                          ? "Afficher et relancer uniquement les comptes pas encore recontactés depuis cet envoi"
                          : "Afficher tous les comptes listés dans ce récap"
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                        portee === p.key ? "bg-primary-500 text-background-50" : "text-foreground-600 hover:bg-background-200"
                      }`}
                    >
                      {p.key === "oublies" && <i className="ri-mail-add-line"></i>}
                      {p.label}
                      <span className={portee === p.key ? "text-background-50/80" : "text-foreground-400"}>{p.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-[11px] text-foreground-500">
                {nbAffichesAvecEmail} avec email · {affiches.length} affiché{affiches.length > 1 ? "s" : ""}
                {nbManquants > 0
                  ? ` · ${nbManquants} compte${nbManquants > 1 ? "s" : ""} introuvable${nbManquants > 1 ? "s" : ""}`
                  : ""}
              </span>

              {affiches.length === 0 ? (
                <p className="py-6 text-center text-sm text-foreground-500">
                  Aucun compte {portee === "oublies" ? "à relancer" : "à afficher"} pour ce récap.
                </p>
              ) : (
                <ul className="max-h-80 overflow-y-auto rounded-lg border border-background-200 divide-y divide-background-200">
                  {affiches.map((a) => {
                    const deja = dejaRecontactes.has(a.id);
                    return (
                      <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex items-start gap-2">
                          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
                            <i className="ri-store-2-line"></i>
                          </span>
                          <div className="min-w-0">
                            <span className="block text-xs font-semibold text-foreground-900 truncate">{a.entreprise}</span>
                            <span className={`block text-[10px] truncate ${a.email ? "text-foreground-500" : "text-red-600"}`}>
                              {a.email ?? "Email non renseigné"}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {deja ? (
                            <span
                              className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-accent-100 text-accent-800 text-[10px] font-bold whitespace-nowrap"
                              title="Un recontact a été envoyé à ce compte après cet envoi"
                            >
                              <i className="ri-check-line"></i>
                              Déjà recontacté
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-bold whitespace-nowrap"
                              title="Aucun recontact envoyé à ce compte depuis cet envoi"
                            >
                              <i className="ri-mail-add-line"></i>
                              À relancer
                            </span>
                          )}
                          <span className="inline-flex items-center h-5 px-2 rounded-full bg-primary-100 text-primary-800 text-[10px] font-bold whitespace-nowrap">
                            {a.offre}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </Modal>

      {recontactOpen && (
        <RecontacterTousModal
          cibles={cibles}
          seuilLabel={seuilLabel}
          onClose={() => setRecontactOpen(false)}
          onSent={onRecontactSent}
        />
      )}
    </>
  );
}