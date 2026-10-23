import { useMemo, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import { marquerBienvenueEnvoyee, type AbonnementItem } from "@/lib/abonnementsApi";
import { emailBienvenueValide, envoyerBienvenue } from "@/lib/bienvenue";

interface RenvoyerBienvenueGroupeModalProps {
  /** Pros en attente d'accueil (bienvenue_envoyee_le vide). */
  items: AbonnementItem[];
  onClose: () => void;
  /** Appelé une fois l'action terminée, pour rafraîchir la liste et la fiche. */
  onDone: () => void;
}

type Phase = "idle" | "envoi" | "fini";

/**
 * Action groupée : envoie l'email de bienvenue à TOUS les pros en attente d'accueil en un
 * seul geste (secours après un échec de la tâche planifiée, ou rattrapage). Les pros sans
 * adresse email joignable sont ignorés et signalés. Chaque envoi réussi mémorise la date
 * d'envoi pour ne pas repartir dans le circuit automatique.
 */
export default function RenvoyerBienvenueGroupeModal({
  items,
  onClose,
  onDone,
}: RenvoyerBienvenueGroupeModalProps) {
  const joignables = useMemo(() => items.filter(emailBienvenueValide), [items]);
  const ignores = items.length - joignables.length;

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [succes, setSucces] = useState(0);
  const [echecs, setEchecs] = useState<string[]>([]);

  const enCours = phase === "envoi";
  const total = joignables.length;

  const lancer = async () => {
    setPhase("envoi");
    setProgress(0);
    setSucces(0);
    setEchecs([]);

    let ok = 0;
    const rates: string[] = [];
    for (let i = 0; i < joignables.length; i += 1) {
      const a = joignables[i];
      try {
        await envoyerBienvenue(a);
        await marquerBienvenueEnvoyee(a.id).catch(() => {
          /* best-effort : l'email est parti même si la date n'a pas pu être mémorisée */
        });
        ok += 1;
      } catch {
        rates.push(a.entreprise);
      }
      setProgress(i + 1);
    }
    setSucces(ok);
    setEchecs(rates);
    setPhase("fini");
    onDone();
  };

  return (
    <Modal
      title="Renvoyer l'accueil aux non-envoyés"
      subtitle={`${total} pro${total > 1 ? "s" : ""} en attente d'un premier email de bienvenue`}
      onClose={enCours ? () => undefined : onClose}
      wide
      footer={
        phase === "fini" ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
          >
            Fermer
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={enCours}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={lancer}
              disabled={enCours || total === 0}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enCours ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-mail-send-line"></i>}
              {enCours ? `Envoi… ${progress}/${total}` : `Envoyer à ${total} pro${total > 1 ? "s" : ""}`}
            </button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-accent-100 border border-accent-300">
          <i className="ri-mail-star-line text-accent-700"></i>
          <span className="text-sm font-semibold text-foreground-900">Accueil groupé</span>
          <span className="text-xs text-foreground-600">
            Le message de bienvenue par défaut sera envoyé à chaque pro, en un clic.
          </span>
        </div>

        {phase === "envoi" && (
          <div className="flex flex-col gap-2">
            <div className="h-2 w-full rounded-full bg-background-200 overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all"
                style={{ width: `${total === 0 ? 0 : (progress / total) * 100}%` }}
              ></div>
            </div>
            <span className="text-xs text-foreground-500">
              Envoi en cours… {progress} sur {total}
            </span>
          </div>
        )}

        {phase === "fini" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-accent-100 border border-accent-300">
              <i className="ri-checkbox-circle-line text-accent-700 mt-px"></i>
              <span className="text-sm text-foreground-900">
                <strong className="font-semibold">{succes}</strong> email{succes > 1 ? "s" : ""} de bienvenue envoyé
                {succes > 1 ? "s" : ""}.
              </span>
            </div>
            {echecs.length > 0 && (
              <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-red-50 border border-red-200">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                  <i className="ri-error-warning-line"></i>
                  {echecs.length} envoi{echecs.length > 1 ? "s" : ""} en échec
                </span>
                <span className="text-xs text-red-700 break-words">{echecs.join(", ")}</span>
              </div>
            )}
          </div>
        )}

        {phase === "idle" && (
          <>
            {ignores > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary-100 border border-secondary-200">
                <i className="ri-information-line text-secondary-700 mt-px"></i>
                <span className="text-xs text-foreground-700">
                  {ignores} pro{ignores > 1 ? "s" : ""} sans adresse email joignable {ignores > 1 ? "seront" : "sera"}{" "}
                  ignoré{ignores > 1 ? "s" : ""}.
                </span>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400">
                Pros concernés ({total})
              </span>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-background-200 divide-y divide-background-200">
                {joignables.length === 0 ? (
                  <p className="p-4 text-center text-xs text-foreground-500">
                    Aucun pro joignable par email dans la sélection.
                  </p>
                ) : (
                  joignables.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
                        <i className="ri-store-2-line text-sm"></i>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground-900 truncate">{a.entreprise}</p>
                        <p className="text-[11px] text-foreground-500 truncate">{a.email}</p>
                      </div>
                      <span className="text-[10px] font-bold text-foreground-500 shrink-0">{a.offre}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}