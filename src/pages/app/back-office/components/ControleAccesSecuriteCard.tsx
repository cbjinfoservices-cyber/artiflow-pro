import { useVerificationAcces, type ViolationAcces } from "@/hooks/useVerificationAcces";

/** Libellé lisible d'une nature de problème. */
function libelleProbleme(probleme: string): string {
  if (probleme === "rls_desactivee") return "RLS désactivé";
  if (probleme === "policy_ouverte") return "Policy ouverte";
  return "Anomalie";
}

/** Date/heure lisible d'un contrôle, pour l'horodatage. */
function dateHeure(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "à l'instant";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * Carte « Contrôle des accès (non-régression) » du back-office.
 *
 * Un bouton lance la fonction Backend `verifier_acces_ouverts()` : elle vérifie qu'aucune table
 * n'est repassée en accès ouvert — soit RLS désactivé, soit une policy `USING true` ajoutée hors
 * liste blanche (catalogue produit, commandes plateforme, diagnostic global). En vert : tout est
 * verrouillé comme prévu ; sinon les tables fautives sont listées avec le détail.
 */
export default function ControleAccesSecuriteCard() {
  const { violations, loading, error, derniereVerif, verifier } = useVerificationAcces();

  const sain = violations !== null && violations.length === 0;

  return (
    <section className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-shield-keyhole-line"></i>
          </span>
          <div className="min-w-0">
            <h3 className="font-heading font-semibold text-base text-foreground-950">
              Contrôle des accès (non-régression)
            </h3>
            <p className="text-xs text-foreground-500 mt-0.5 leading-relaxed max-w-xl">
              Vérifie qu'aucune table n'est repassée en accès ouvert : RLS désactivé, ou policy
              <span className="whitespace-nowrap"> « true »</span> ajoutée hors liste blanche (catalogue,
              commandes, diagnostic global). À lancer après chaque évolution de la base.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void verifier()}
          disabled={loading}
          title="Lancer le contrôle des règles d'accès"
          className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <i className={`${loading ? "ri-loader-4-line animate-spin" : "ri-shield-check-line"}`}></i>
          {loading ? "Contrôle en cours…" : "Lancer le contrôle"}
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
          <i className="ri-error-warning-line mt-0.5 shrink-0"></i>
          <span>{error}</span>
        </div>
      )}

      {sain && (
        <div className="mt-4 flex items-start gap-2.5 p-3 rounded-md bg-accent-50 border border-accent-200 text-foreground-800 text-xs">
          <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <i className="ri-checkbox-circle-line"></i>
          </span>
          <span>
            <strong className="font-semibold text-foreground-950">Aucun accès ouvert inattendu.</strong> Toutes les
            tables sensibles restent verrouillées par leurs règles.
            {derniereVerif && <span className="text-foreground-500"> Vérifié {dateHeure(derniereVerif)}.</span>}
          </span>
        </div>
      )}

      {violations && violations.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-700">
            <i className="ri-alarm-warning-line"></i>
            {violations.length} anomalie{violations.length > 1 ? "s" : ""} détectée{violations.length > 1 ? "s" : ""}
            {derniereVerif && <span className="font-normal text-foreground-500">· vérifié {dateHeure(derniereVerif)}</span>}
          </div>
          <ul className="flex flex-col gap-1.5">
            {violations.map((v: ViolationAcces, i) => (
              <li
                key={`${v.table_name ?? "global"}-${i}`}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 p-2.5 rounded-md bg-red-50 border border-red-200 text-xs"
              >
                <span className="font-semibold text-red-800 font-mono">{v.table_name ?? "—"}</span>
                <span className="inline-flex items-center h-5 px-2 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold whitespace-nowrap">
                  {libelleProbleme(v.probleme)}
                </span>
                <span className="text-foreground-600 w-full">{v.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}