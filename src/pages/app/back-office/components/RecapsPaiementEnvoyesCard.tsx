import { useState } from "react";
import { useRecapsPaiement } from "@/hooks/useRecapsPaiement";
import { previewRecapPaiement, testerRecapPaiement, type RecapPaiementFamille } from "@/lib/recapsPaiementApi";
import { metaFamilleEchec } from "@/lib/paiementsEchecsApi";
import { formatHorodatage } from "@/lib/diagnosticUi";

type EtatAction = "idle" | "chargement" | "succes" | "erreur";

/**
 * Carte back-office du RÉCAP HEBDOMADAIRE des échecs de paiement.
 *
 * Deux volets :
 * - un historique des récaps déjà envoyés aux gestionnaires (date, nombre d'échecs,
 *   destinataires), alimenté par la table `recap_echecs_paiement_envois` ;
 * - des boutons « Aperçu » (rendu exact de l'email, aucun envoi) et « Tester maintenant »
 *   (envoi immédiat aux gestionnaires) branchés sur la fonction Backend du récap.
 */
export default function RecapsPaiementEnvoyesCard() {
  const { items, loading, error, reload } = useRecapsPaiement(50);

  const [apercuOuvert, setApercuOuvert] = useState(false);
  const [apercuHtml, setApercuHtml] = useState<string | null>(null);
  const [apercuFamilles, setApercuFamilles] = useState<RecapPaiementFamille[]>([]);
  const [apercuTotal, setApercuTotal] = useState(0);
  const [apercuEtat, setApercuEtat] = useState<EtatAction>("idle");

  const [testEtat, setTestEtat] = useState<EtatAction>("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const ouvrirApercu = async () => {
    setApercuOuvert(true);
    setApercuEtat("chargement");
    setApercuHtml(null);
    setApercuFamilles([]);
    setApercuTotal(0);
    try {
      const res = await previewRecapPaiement();
      setApercuHtml(res.html);
      setApercuFamilles(res.familles);
      setApercuTotal(res.total);
      setApercuEtat("succes");
    } catch {
      setApercuEtat("erreur");
    }
  };

  const lancerTest = async () => {
    setTestEtat("chargement");
    setTestMessage(null);
    try {
      const res = await testerRecapPaiement();
      if (res.sent > 0) {
        setTestEtat("succes");
        setTestMessage("Le récap hebdo vient d'être envoyé aux gestionnaires.");
        await reload();
      } else {
        setTestEtat("erreur");
        setTestMessage(
          res.reason || "L'envoi n'a pas abouti (aucun échec sur la période ou email non configuré).",
        );
      }
    } catch (e) {
      setTestEtat("erreur");
      setTestMessage(e instanceof Error ? e.message : "L'envoi du récap a échoué.");
    }
  };

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-secondary-100 text-secondary-700">
            <i className="ri-mail-send-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">
              Récap hebdo des échecs de paiement
            </h3>
            <p className="text-[11px] text-foreground-500">
              Synthèse envoyée chaque semaine aux gestionnaires — historique et test manuel.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!loading && !error && items.length > 0 && (
            <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
              {items.length} envoi{items.length > 1 ? "s" : ""}
            </span>
          )}
          <button
            type="button"
            onClick={ouvrirApercu}
            disabled={apercuEtat === "chargement"}
            title="Voir le rendu exact de l'email avant tout envoi"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={apercuEtat === "chargement" ? "ri-loader-4-line animate-spin" : "ri-eye-line"}></i>
            Aperçu
          </button>
          <button
            type="button"
            onClick={lancerTest}
            disabled={testEtat === "chargement"}
            title="Envoyer tout de suite le récap aux gestionnaires"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={testEtat === "chargement" ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
            {testEtat === "chargement" ? "Envoi…" : "Tester maintenant"}
          </button>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            title="Rafraîchir l'historique"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60"
          >
            <i className={loading ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
            Rafraîchir
          </button>
        </div>
      </div>

      {testEtat === "succes" && testMessage && (
        <p className="px-5 py-2 text-xs text-accent-700 flex items-center gap-1.5 bg-accent-50/60 border-b border-background-200 animate-fade-in">
          <i className="ri-checkbox-circle-line"></i>
          {testMessage}
        </p>
      )}
      {testEtat === "erreur" && testMessage && (
        <p className="px-5 py-2 text-xs text-red-700 flex items-center gap-1.5 bg-red-50/60 border-b border-background-200">
          <i className="ri-error-warning-line"></i>
          {testMessage}
        </p>
      )}

      {apercuOuvert && (
        <div className="flex flex-col gap-2 p-4 border-b border-background-200 bg-background-50 animate-fade-in">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              <i className="ri-mail-line"></i>
              Aperçu de l'email (aucun envoi)
            </span>
            <button
              type="button"
              onClick={() => setApercuOuvert(false)}
              aria-label="Fermer l'aperçu"
              className="w-6 h-6 flex items-center justify-center rounded-md text-foreground-400 hover:text-foreground-700 hover:bg-background-200 cursor-pointer transition-colors"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
          {apercuEtat === "chargement" && (
            <p className="text-xs text-foreground-500 flex items-center gap-1.5 py-3">
              <i className="ri-loader-4-line animate-spin"></i>
              Construction de l'aperçu…
            </p>
          )}
          {apercuEtat === "erreur" && (
            <p className="text-xs text-red-700 flex items-center gap-1.5 py-3">
              <i className="ri-error-warning-line"></i>
              L'aperçu n'a pas pu être généré.
            </p>
          )}
          {apercuEtat === "succes" && apercuHtml && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
                  <i className="ri-pie-chart-2-line"></i>
                  Répartition par famille
                </span>
                <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold whitespace-nowrap">
                  <i className="ri-bank-card-line"></i>
                  {apercuTotal} échec{apercuTotal > 1 ? "s" : ""}
                </span>
                {apercuFamilles
                  .filter((f) => f.count > 0)
                  .map((f) => {
                    const meta = metaFamilleEchec(f.famille);
                    return (
                      <span
                        key={f.famille}
                        title={`${meta.label} — ${f.count} échec${f.count > 1 ? "s" : ""}`}
                        className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${meta.tone}`}
                      >
                        <i className={meta.icon}></i>
                        <span className="tabular-nums font-bold">{f.count}</span>
                        <span>{meta.label}</span>
                      </span>
                    );
                  })}
                {apercuFamilles.filter((f) => f.count > 0).length === 0 && (
                  <span className="text-[11px] text-foreground-400">
                    Aucun échec sur la période — l'email ne détaille alors pas de familles.
                  </span>
                )}
              </div>
              <iframe
                title="Aperçu du récap hebdomadaire des échecs de paiement"
                srcDoc={apercuHtml}
                sandbox=""
                className="w-full h-96 rounded-md border border-background-200 bg-background-50"
              />
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-background-200/50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="inline-flex items-center gap-2 text-sm text-foreground-600">
            <i className="ri-error-warning-line text-red-500"></i>
            {error}
          </span>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-refresh-line"></i>
            Réessayer
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center gap-2.5 px-5 py-6 text-sm text-foreground-500">
          <i className="ri-mail-line text-foreground-400 text-lg"></i>
          Aucun récap hebdo de paiement envoyé pour l'instant. Le premier envoi apparaîtra ici.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-background-200">
          {items.map((it) => (
            <li key={it.id} className="flex flex-col gap-1.5 px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-red-100 text-red-700 text-[11px] font-semibold whitespace-nowrap">
                  <i className="ri-bank-card-line"></i>
                  {it.nb_echecs} échec{it.nb_echecs > 1 ? "s" : ""}
                </span>
                {it.periode_jours !== null && (
                  <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-background-200 text-foreground-600 text-[11px] font-medium whitespace-nowrap">
                    fenêtre {it.periode_jours} j
                  </span>
                )}
                <span className="ml-auto text-[11px] text-foreground-400 whitespace-nowrap">
                  {formatHorodatage(it.created_at)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] text-foreground-500">
                  <i className="ri-group-line"></i>
                  Destinataires
                </span>
                {it.destinataires.length === 0 ? (
                  <span className="text-[11px] text-foreground-400">—</span>
                ) : (
                  it.destinataires.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center h-5 px-2 rounded-full bg-secondary-100 text-secondary-800 text-[10px] font-medium whitespace-nowrap"
                    >
                      {email}
                    </span>
                  ))
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}