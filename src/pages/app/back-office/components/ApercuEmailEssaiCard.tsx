import { useEffect, useState } from "react";
import { previsualiserEmailDernierJourEssai, previsualiserEmailEssaiJ1 } from "@/lib/abonnementPaiement";

/** Variantes d'aperçu : le message du dernier jour, ou le rappel préventif de la veille (J-1). */
export type VarianteApercuEssai = "essai-fin" | "essai-j1";

interface ConfigApercu {
  badgeIcon: string;
  titre: string;
  sousTitre: string;
  dialogLabel: string;
  dialogTitre: string;
  dialogIntro: string;
  iframeTitle: string;
  charger: () => Promise<{ html: string }>;
}

const CONFIG: Record<VarianteApercuEssai, ConfigApercu> = {
  "essai-fin": {
    badgeIcon: "ri-mail-open-line",
    titre: "Aperçu de l'email « dernier jour d'essai »",
    sousTitre: "Relisez le message envoyé le jour même de la fin de l'essai, avant le tout premier prélèvement.",
    dialogLabel: "Aperçu de l'email « dernier jour d'essai »",
    dialogTitre: "Email « dernier jour d'essai »",
    dialogIntro: "Voici exactement l'email que recevra l'artisan le dernier jour de son essai.",
    iframeTitle: "Aperçu de l'email « dernier jour d'essai »",
    charger: previsualiserEmailDernierJourEssai,
  },
  "essai-j1": {
    badgeIcon: "ri-mail-send-line",
    titre: "Aperçu de l'email « J-1 avant la fin d'essai »",
    sousTitre: "Relisez le rappel préventif envoyé la veille de la fin de l'essai, en amont du dernier jour.",
    dialogLabel: "Aperçu de l'email « J-1 avant la fin d'essai »",
    dialogTitre: "Email « J-1 avant la fin d'essai »",
    dialogIntro: "Voici exactement l'email préventif que recevra l'artisan la veille de la fin de son essai.",
    iframeTitle: "Aperçu de l'email « J-1 avant la fin d'essai »",
    charger: previsualiserEmailEssaiJ1,
  },
};

/**
 * Carte back-office : aperçu du rendu EXACT d'un email d'essai.
 *
 * `essai-fin` : l'email envoyé le jour même de la fin de l'essai, pour maximiser les
 * conversions avant le tout premier prélèvement.
 * `essai-j1` : le rappel préventif envoyé la veille de la fin de l'essai, en amont.
 *
 * Le bouton récupère le rendu auprès du Backend (mode aperçu, sans aucun envoi réel)
 * et l'affiche dans une fenêtre isolée.
 */
export default function ApercuEmailEssaiCard({
  variant = "essai-fin",
}: {
  variant?: VarianteApercuEssai;
}) {
  const cfg = CONFIG[variant];
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const ouvrir = async () => {
    setOpen(true);
    if (html) return;
    setLoading(true);
    setError(null);
    try {
      const res = await cfg.charger();
      setHtml(res.html);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger l'aperçu pour l'instant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <i className={cfg.badgeIcon}></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">{cfg.titre}</h3>
            <p className="text-[11px] text-foreground-500">{cfg.sousTitre}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={ouvrir}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
        >
          <i className="ri-eye-line"></i>
          Voir l'aperçu
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3 text-xs text-foreground-500">
        <i className="ri-information-line text-foreground-400"></i>
        Aperçu avec des données d'exemple (entreprise, offre, montant) — aucun email n'est envoyé.
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={cfg.dialogLabel}
        >
          <div className="fixed inset-0 bg-foreground-950/60 backdrop-blur-sm" onClick={() => setOpen(false)}></div>

          <div className="relative w-full sm:max-w-2xl max-h-[90vh] flex flex-col rounded-t-lg sm:rounded-lg bg-background-50 border border-background-200 overflow-hidden">
            <div className="flex items-start justify-between gap-3 p-5 border-b border-background-200">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700 text-xl">
                  <i className={cfg.badgeIcon}></i>
                </span>
                <div>
                  <h2 className="font-heading font-bold text-base text-foreground-950">{cfg.dialogTitre}</h2>
                  <p className="text-xs text-foreground-500 mt-0.5">{cfg.dialogIntro}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md hover:bg-background-200 cursor-pointer"
              >
                <i className="ri-close-line text-foreground-500"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-background-100 p-3">
              {loading ? (
                <div className="flex items-center justify-center gap-2 h-[560px] text-sm text-foreground-500">
                  <i className="ri-loader-4-line animate-spin text-lg"></i>
                  Chargement de l'aperçu…
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center gap-3 h-[560px] text-center px-6">
                  <i className="ri-error-warning-line text-2xl text-red-500"></i>
                  <p className="text-sm text-foreground-600">{error}</p>
                  <button
                    type="button"
                    onClick={ouvrir}
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                  >
                    <i className="ri-refresh-line"></i>
                    Réessayer
                  </button>
                </div>
              ) : (
                <iframe
                  title={cfg.iframeTitle}
                  srcDoc={html}
                  sandbox=""
                  className="w-full h-[560px] rounded-lg border border-background-200 bg-white"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-t border-background-200">
              <p className="text-[11px] text-foreground-500 flex items-center gap-1.5">
                <i className="ri-information-line text-foreground-400"></i>
                Aperçu sans envoi réel — rien n'est expédié à l'artisan.
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors"
              >
                <i className="ri-close-line"></i>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}