import { useEffect, useState } from "react";
import { useDureeEssai } from "@/hooks/useDureeEssai";
import { DUREE_ESSAI_MAX, DUREE_ESSAI_MIN } from "@/lib/parametresEssai";

const PRESETS = [0, 7, 14, 30];

/**
 * Réglage back-office de la durée de la période d'essai offerte à la prise
 * d'abonnement (valeur globale, partagée par tout le site). Cette durée pilote :
 *   • le véritable essai Stripe (aucun débit tant que l'essai court) ;
 *   • le compte à rebours « il vous reste X jours d'essai » du tableau de bord artisan ;
 *   • l'information de fin d'essai affichée avant et après la souscription.
 * Une valeur de 0 désactive l'essai (le premier prélèvement a lieu immédiatement).
 */
export default function DureeEssaiCard() {
  const { jours, loading, saving, save } = useDureeEssai();
  const [valeur, setValeur] = useState(String(jours));
  const [message, setMessage] = useState<string | null>(null);

  // Le champ suit la valeur enregistrée tant que l'on n'a pas de modification en cours.
  useEffect(() => {
    setValeur(String(jours));
  }, [jours]);

  const enregistrer = async () => {
    const res = await save(Number(valeur));
    if (res.error) {
      setMessage(res.error);
    } else {
      setValeur(String(res.jours));
      setMessage("Durée d'essai enregistrée");
      window.setTimeout(() => setMessage(null), 2500);
    }
  };

  const valeurNum = Number(valeur);
  const modifie = Number.isFinite(valeurNum) && valeurNum !== jours && valeur !== "";

  return (
    <div className="flex flex-col rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <i className="ri-timer-flash-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">Période d'essai des abonnements</h3>
            <p className="text-[11px] text-foreground-500">
              Durée offerte à la souscription : aucun débit avant la fin de l'essai, puis premier prélèvement.
            </p>
          </div>
        </div>
        {message && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground-600">
            <i className="ri-checkbox-circle-line text-accent-600"></i>
            {message}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-foreground-500">
            <i className="ri-loader-4-line animate-spin"></i>
            Chargement du réglage…
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="duree-essai-jours" className="text-xs font-semibold text-foreground-700">
                  Durée d'essai (jours)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="duree-essai-jours"
                    type="number"
                    min={DUREE_ESSAI_MIN}
                    max={DUREE_ESSAI_MAX}
                    step={1}
                    value={valeur}
                    onChange={(e) => setValeur(e.target.value)}
                    className="w-28 h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-colors"
                  />
                  <span className="text-sm text-foreground-500">jours</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setValeur(String(p))}
                    className={`inline-flex items-center h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      jours === p
                        ? "bg-primary-500 text-background-50"
                        : "bg-background-50 border border-background-200 text-foreground-600 hover:border-primary-300"
                    }`}
                  >
                    {p === 0 ? "Aucun essai" : `${p} j`}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={enregistrer}
                disabled={saving || !modifie}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
                Enregistrer
              </button>
            </div>

            <p className="text-xs text-foreground-500 leading-relaxed">
              La durée s'applique aux <strong className="font-semibold text-foreground-700">nouvelles souscriptions</strong>{" "}
              reconductibles (un paiement unique est réglé immédiatement). Actuelle : <strong className="font-semibold text-foreground-700">{jours} jours</strong>.
              Mettre 0 désactive l'essai.
            </p>
          </>
        )}
      </div>
    </div>
  );
}