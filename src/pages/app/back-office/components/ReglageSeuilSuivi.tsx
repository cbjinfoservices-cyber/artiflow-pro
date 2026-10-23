import { useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { enregistrerSeuilSuiviAppel, normaliserSeuilSuivi, SEUILS_SUIVI_APPEL } from "@/lib/suppressionsAdmin";

interface ReglageSeuilSuiviProps {
  /** Seuil actuellement appliqué (24 / 48 / 72 h). */
  seuil: number;
  /** Appelé après un enregistrement réussi, avec le seuil retenu. */
  onSeuilChange: (seuil: number) => void;
  /** Remonte un retour lisible pour la bandeau de statut de l'encart. */
  onMessage?: (message: { type: "ok" | "erreur"; texte: string } | null) => void;
}

/**
 * Réglage du délai après lequel un appel resté sans réponse déclenche une proposition
 * de rappel de suivi (24 / 48 / 72 h).
 *
 * Le choix est enregistré côté Backend (`parametres_app`), donc le récap de lundi et
 * l'archive PDF appliquent exactement le même délai que l'encart.
 */
export default function ReglageSeuilSuivi({ seuil, onSeuilChange, onMessage }: ReglageSeuilSuiviProps) {
  const { user } = useAuth();
  const [enCours, setEnCours] = useState<number | null>(null);
  const valeur = normaliserSeuilSuivi(seuil);

  const choisir = useCallback(
    async (option: number) => {
      if (option === valeur || enCours !== null) return;
      setEnCours(option);
      onMessage?.(null);
      try {
        const retenu = await enregistrerSeuilSuiviAppel(option, user?.email ?? null);
        onSeuilChange(retenu);
        onMessage?.({
          type: "ok",
          texte: `Rappel de suivi réglé sur ${retenu} h : l'encart et l'archive du récap de lundi appliquent ce délai.`,
        });
      } catch {
        onMessage?.({
          type: "erreur",
          texte: "Le seuil n'a pas pu être enregistré. Réessayez dans un instant.",
        });
      } finally {
        setEnCours(null);
      }
    },
    [enCours, onMessage, onSeuilChange, user?.email, valeur],
  );

  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-background-200 bg-background-50 px-3 py-2">
      <div className="flex items-start gap-2 min-w-0">
        <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-800 mt-0.5">
          <i className="ri-notification-3-line text-[13px]"></i>
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground-900">
            Rappel de suivi proposé après {valeur} h sans réponse
          </p>
          <p className="text-[11px] text-foreground-500 mt-0.5">
            Délai commun à l'encart, aux exports et à l'archive du récap de lundi.
          </p>
        </div>
      </div>
      <div
        className="inline-flex items-center gap-1 p-1 rounded-full bg-background-100 border border-background-200"
        role="group"
        aria-label="Seuil du rappel de suivi"
      >
        {SEUILS_SUIVI_APPEL.map((option) => {
          const actif = option === valeur;
          const chargement = enCours === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => {
                void choisir(option);
              }}
              aria-pressed={actif}
              disabled={enCours !== null}
              title={`Proposer un rappel de suivi après ${option} h sans réponse au dernier appel`}
              className={`inline-flex items-center justify-center gap-1 h-6 min-w-[46px] px-2 rounded-full text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors disabled:cursor-not-allowed ${
                actif
                  ? "bg-secondary-500 text-background-50"
                  : "text-foreground-600 hover:bg-background-200"
              }`}
            >
              {chargement && <i className="ri-loader-4-line animate-spin"></i>}
              {option} h
            </button>
          );
        })}
      </div>
    </div>
  );
}