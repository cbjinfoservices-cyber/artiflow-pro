import { useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useSuppressionProgrammee } from "@/hooks/useSuppressionProgrammee";
import {
  demanderSuppressionCompte,
  formaterDateFr,
  joursRestantsAvant,
  JOURS_GRACE_SUPPRESSION,
} from "@/lib/compte";

/**
 * Zone sensible « Supprimer mon compte », affichée dans l'onglet Sécurité du profil artisan.
 *
 * Principe retenu : la fermeture du compte n'est **jamais immédiate**. La demande est
 * programmée à J+30, ce qui laisse une période de grâce. Pendant ces 30 jours :
 *  — l'espace reste entièrement utilisable ;
 *  — se reconnecter annule la demande automatiquement ;
 *  — un clic sur « Annuler la suppression » suffit aussi.
 *
 * Double garde-fou à la demande : mot de passe ressaisi (vérifié côté serveur) et saisie
 * manuelle de « SUPPRIMER ». L'abonnement, lui, n'est plus renouvelé : il s'arrête à la fin
 * de la période déjà réglée.
 */
export default function SupprimerCompteCard() {
  const { user } = useAuth();
  const { demande, annulationEnCours, annuler, erreur: erreurAnnulation, rafraichir } = useSuppressionProgrammee();
  const [ouvert, setOuvert] = useState(false);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [voirMotDePasse, setVoirMotDePasse] = useState(false);
  const [etat, setEtat] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [message, setMessage] = useState("");
  const [dateObtenue, setDateObtenue] = useState<string | null>(null);

  const pret = motDePasse.length > 0 && confirmation.trim() === "SUPPRIMER";
  const jours = joursRestantsAvant(demande?.prevue_le);

  const fermer = () => {
    if (etat === "loading") return;
    setOuvert(false);
    if (etat !== "ok") {
      setMotDePasse("");
      setConfirmation("");
      setMessage("");
      setEtat("idle");
    }
  };

  const lancer = async () => {
    if (!pret) return;
    setEtat("loading");
    setMessage("");
    try {
      const resultat = await demanderSuppressionCompte(motDePasse, confirmation.trim());
      setMessage(resultat.message);
      setDateObtenue(resultat.dateSuppression);
      setEtat("ok");
      setMotDePasse("");
      setConfirmation("");
      await rafraichir();
    } catch (e) {
      setEtat("error");
      setMessage(e instanceof Error ? e.message : "La demande a échoué.");
    }
  };

  const champ =
    "h-11 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 transition-colors";

  return (
    <>
      <div className="p-5 md:p-6 rounded-lg bg-background-100 border border-red-200">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-9 h-9 flex items-center justify-center rounded-md bg-red-100 text-red-700">
            <i className="ri-delete-bin-6-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-semibold text-base text-foreground-950">Supprimer mon compte</h3>
            <p className="text-xs text-foreground-500">
              La suppression est programmée avec {JOURS_GRACE_SUPPRESSION} jours de réflexion. Elle reste annulable
              jusqu'au dernier moment.
            </p>
          </div>
        </div>

        {demande ? (
          /* Une suppression est déjà programmée : on affiche l'échéance et le recours. */
          <div className="flex flex-col gap-3">
            <div className="p-4 rounded-md bg-accent-100 border border-accent-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold whitespace-nowrap">
                  <i className="ri-timer-line"></i>
                  Suppression programmée
                </span>
                <span className="text-[11px] text-accent-900">
                  {jours > 0 ? `Encore ${jours} jour${jours > 1 ? "s" : ""} pour changer d'avis` : "Échéance imminente"}
                </span>
              </div>
              <p className="mt-2 text-sm text-foreground-900">
                Votre compte sera définitivement supprimé le{" "}
                <strong className="font-semibold">{formaterDateFr(demande.prevue_le)}</strong>.
              </p>
              <p className="text-[11px] text-foreground-600 mt-1.5 leading-relaxed">
                D'ici là, votre espace reste entièrement utilisable. Le simple fait de vous reconnecter annule la
                demande. Votre abonnement, lui, n'est plus renouvelé
                {demande.fin_de_periode_le ? ` (arrêt le ${formaterDateFr(demande.fin_de_periode_le)})` : ""}.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-[11px] text-foreground-500 inline-flex items-start gap-1.5 min-w-0">
                <i className="ri-information-line mt-0.5"></i>
                <span>
                  Pensez à récupérer vos données dès maintenant :{" "}
                  <strong className="font-medium text-foreground-700">Mes droits RGPD → Exporter mes données</strong>,
                  juste au-dessus.
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  void annuler("action-manuelle");
                }}
                disabled={annulationEnCours}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
              >
                {annulationEnCours ? (
                  <i className="ri-loader-4-line animate-spin"></i>
                ) : (
                  <i className="ri-arrow-go-back-line"></i>
                )}
                Annuler la suppression
              </button>
            </div>

            {erreurAnnulation && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
                <i className="ri-error-warning-line mt-0.5"></i>
                <span>{erreurAnnulation}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md bg-background-50 border border-background-200">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-900">Fermer définitivement mon espace</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">
                Votre demande est enregistrée aujourd'hui, la suppression réelle a lieu dans{" "}
                {JOURS_GRACE_SUPPRESSION} jours. Devis, factures, clients, chantiers, modèles et réglages seront alors
                effacés.
              </p>
              <p className="text-[11px] text-foreground-500 mt-1.5 inline-flex items-start gap-1.5">
                <i className="ri-shield-check-line mt-0.5"></i>
                <span>
                  Vous gardez l'accès complet pendant toute la période de grâce. Pour arrêter seulement l'abonnement en
                  gardant vos données, utilisez l'onglet
                  <strong className="font-medium text-foreground-700"> Abonnement</strong> → « Résilier mon abonnement ».
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEtat("idle");
                setMessage("");
                setDateObtenue(null);
                setMotDePasse("");
                setConfirmation("");
                setOuvert(true);
              }}
              disabled={!user}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-background-50 border border-red-300 text-red-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
            >
              <i className="ri-user-unfollow-line"></i>
              Supprimer mon compte
            </button>
          </div>
        )}
      </div>

      {ouvert ? (
        <Modal
          title="Programmer la suppression de mon compte ?"
          subtitle={user?.email ?? undefined}
          onClose={fermer}
          footer={
            etat === "ok" ? (
              <button
                type="button"
                onClick={fermer}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
              >
                <i className="ri-check-line"></i>
                J'ai compris
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={fermer}
                  disabled={etat === "loading"}
                  className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void lancer();
                  }}
                  disabled={!pret || etat === "loading"}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-red-600 text-white text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {etat === "loading" ? (
                    <>
                      <i className="ri-loader-4-line animate-spin"></i>
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      <i className="ri-calendar-check-line"></i>
                      Programmer la suppression
                    </>
                  )}
                </button>
              </>
            )
          }
        >
          {etat === "ok" ? (
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <span className="w-14 h-14 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-2xl">
                <i className="ri-calendar-check-line"></i>
              </span>
              <p className="font-heading font-semibold text-base text-foreground-950">Demande enregistrée</p>
              <p className="text-sm text-foreground-500 max-w-sm">{message}</p>
              {dateObtenue && (
                <p className="text-xs text-foreground-700">
                  Suppression réelle le <strong className="font-semibold">{formaterDateFr(dateObtenue)}</strong>.
                </p>
              )}
              <p className="text-[11px] text-foreground-400 max-w-sm">
                Un email de confirmation vient de vous être envoyé. Il rappelle la date et la marche à suivre pour
                annuler.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 p-3 rounded-md bg-accent-100 border border-accent-200">
                <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-accent-500 text-background-50">
                  <i className="ri-timer-line"></i>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-accent-900">
                    Rien n'est supprimé aujourd'hui
                  </p>
                  <p className="text-xs text-foreground-700 mt-0.5 leading-relaxed">
                    Nous attendons <strong className="font-semibold">{JOURS_GRACE_SUPPRESSION} jours</strong> avant
                    d'effacer quoi que ce soit. Pendant cette période, votre espace fonctionne normalement et vous
                    pouvez annuler d'un simple clic — ou même en vous reconnectant.
                  </p>
                </div>
              </div>

              <ul className="flex flex-col gap-2 text-xs text-foreground-600">
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-accent-700 mt-0.5"></i>
                  <span>
                    <strong className="font-medium text-foreground-900">Abonnement :</strong> plus aucun prélèvement.
                    Il s'arrête à la fin de la période déjà réglée, sans remboursement.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-accent-700 mt-0.5"></i>
                  <span>
                    <strong className="font-medium text-foreground-900">Vos données :</strong> intactes jusqu'à
                    l'échéance, puis effacées définitivement.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-accent-700 mt-0.5"></i>
                  <span>
                    <strong className="font-medium text-foreground-900">À la suppression :</strong> un email
                    récapitulera la date et la liste de ce qui a été effacé, comme preuve.
                  </span>
                </li>
              </ul>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">Votre mot de passe</span>
                <div className="relative">
                  <input
                    type={voirMotDePasse ? "text" : "password"}
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Mot de passe de connexion"
                    className={`${champ} w-full pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setVoirMotDePasse((v) => !v)}
                    aria-label={voirMotDePasse ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute right-1 top-1 w-9 h-9 flex items-center justify-center rounded-md text-foreground-500 cursor-pointer hover:bg-background-200 transition-colors"
                  >
                    <i className={voirMotDePasse ? "ri-eye-off-line" : "ri-eye-line"}></i>
                  </button>
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground-700">
                  Tapez <strong className="font-bold text-foreground-900">SUPPRIMER</strong> pour confirmer
                </span>
                <input
                  type="text"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="SUPPRIMER"
                  className={`${champ} w-full font-semibold tracking-wide`}
                />
              </label>

              {etat === "error" ? (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
                  <i className="ri-error-warning-line mt-0.5"></i>
                  <span>{message}</span>
                </p>
              ) : null}
            </div>
          )}
        </Modal>
      ) : null}
    </>
  );
}