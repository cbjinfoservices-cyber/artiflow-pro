import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { STOCKAGE_LOCAL_EVENT } from "@/lib/stockageLocal";
import { lireVerifConfigEmail } from "@/lib/verifConfigEmailMemoire";

/**
 * Bandeau permanent « dernière vérification de la config email » du tableau de bord.
 *
 * Contrairement au rappel d'export mensuel (qui disparaît une fois l'export fait), ce repère
 * reste visible en permanence : il rappelle la date de la dernière vérification réussie du
 * canal d'envoi (clé Resend + domaine) et son verdict, avec un accès direct à la carte des
 * Préférences. Il se met à jour tout seul dès qu'une vérification est relancée ailleurs.
 */
export default function BandeauVerifConfigEmail() {
  const [verif, setVerif] = useState(() => lireVerifConfigEmail());

  // Se resynchronise si une vérification est (re)lancée depuis les Préférences ou un autre onglet.
  useEffect(() => {
    const rafraichir = () => setVerif(lireVerifConfigEmail());
    window.addEventListener(STOCKAGE_LOCAL_EVENT, rafraichir);
    window.addEventListener("storage", rafraichir);
    return () => {
      window.removeEventListener(STOCKAGE_LOCAL_EVENT, rafraichir);
      window.removeEventListener("storage", rafraichir);
    };
  }, []);

  /** Date + heure lisibles de la dernière vérification de la config email. */
  const dateVerif = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "date inconnue";
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pret = verif?.pret === true;

  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 rounded-lg bg-background-100 border border-background-200">
      <span
        className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-md ${
          verif ? (pret ? "bg-accent-100 text-accent-700" : "bg-primary-100 text-primary-700") : "bg-background-200 text-foreground-500"
        }`}
      >
        <i className="ri-mail-send-line"></i>
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground-950 flex flex-wrap items-center gap-2">
          Configuration d'envoi des emails
          {verif && (
            <span
              className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                pret ? "bg-accent-100 text-accent-700" : "bg-primary-100 text-primary-700"
              }`}
            >
              <i className={pret ? "ri-shield-check-line" : "ri-alert-line"}></i>
              {pret ? "prête" : "à finaliser"}
            </span>
          )}
        </p>
        <p className="text-xs text-foreground-600 mt-0.5">
          {verif
            ? `Dernière vérification : ${dateVerif(verif.date)}.`
            : "Pas encore vérifiée : assurez-vous que vos devis, factures et relances peuvent bien partir."}
        </p>
      </div>

      <Link
        to="/app/preferences#section-envoi-emails"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-background-300 text-foreground-700 text-sm font-medium whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
      >
        <i className="ri-settings-3-line"></i>
        Vérifier
      </Link>
    </section>
  );
}