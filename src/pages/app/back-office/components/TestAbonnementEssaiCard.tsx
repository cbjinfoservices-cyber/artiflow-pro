import { useState } from "react";
import { useHistoriqueTestAbonnementEssai } from "@/hooks/useHistoriqueTestAbonnementEssai";
import { useDureeEssai } from "@/hooks/useDureeEssai";
import { lancerTestAbonnementEssai } from "@/lib/testAbonnementEssaiApi";
import { formatDepuis, formatHorodatage } from "@/lib/diagnosticUi";

/**
 * Carte back-office : VRAI TEST du tunnel d'abonnement reconductible avec période d'essai.
 *
 * Le bouton « Lancer le test d'essai » exécute côté Backend un test réel en MODE TEST Stripe :
 * il crée un abonnement avec la durée d'essai réglée, puis vérifie qu'aucun débit n'est
 * enregistré avant la fin (facture à 0 €, sans prélèvement). Toutes les ressources de test
 * sont supprimées aussitôt. L'historique des tests est affiché ci-dessous pour traçabilité.
 */
export default function TestAbonnementEssaiCard() {
  const { jours: dureeEssai } = useDureeEssai();
  const { items, loading, error, reload } = useHistoriqueTestAbonnementEssai(40);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<{ etat: "succes" | "alerte" | "erreur"; message: string } | null>(null);

  const lancer = async () => {
    setEnCours(true);
    setResultat(null);
    try {
      const r = await lancerTestAbonnementEssai();
      setResultat({
        etat: r.verifie ? "succes" : "alerte",
        message: r.message,
      });
      await reload();
    } catch (e) {
      setResultat({
        etat: "erreur",
        message: e instanceof Error ? e.message : "Le test d'essai n'a pas pu être lancé.",
      });
    } finally {
      setEnCours(false);
    }
  };

  const dernier = items[0] ?? null;

  return (
    <section className="rounded-lg bg-background-100 border border-background-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-background-200/50">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <i className="ri-timer-flash-line"></i>
          </span>
          <div>
            <h3 className="font-heading font-bold text-sm text-foreground-950">
              Test de l'essai reconductible
            </h3>
            <p className="text-[11px] text-foreground-500">
              Vérifie en vrai (mode test Stripe) qu'une souscription démarre en essai sans aucun débit avant la fin.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap">
            <i className="ri-timer-line"></i>
            Essai réglé : {dureeEssai > 0 ? `${dureeEssai} j` : "désactivé"}
          </span>
          <button
            type="button"
            onClick={lancer}
            disabled={enCours}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <i className={enCours ? "ri-loader-4-line animate-spin" : "ri-play-circle-line"}></i>
            {enCours ? "Test en cours…" : "Lancer le test d'essai"}
          </button>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            title="Rafraîchir l'historique des tests d'essai"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-xs font-medium text-foreground-700 whitespace-nowrap cursor-pointer hover:border-primary-300 transition-colors disabled:opacity-60"
          >
            <i className={loading ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
            Rafraîchir
          </button>
        </div>
      </div>

      {resultat && (
        <div
          className={`flex items-start gap-2 px-5 py-2.5 border-b border-background-200 ${
            resultat.etat === "succes"
              ? "bg-accent-100/60"
              : resultat.etat === "alerte"
                ? "bg-secondary-100/60"
                : "bg-background-50"
          }`}
        >
          <i
            className={`mt-0.5 ${
              resultat.etat === "succes"
                ? "ri-checkbox-circle-line text-accent-600"
                : resultat.etat === "alerte"
                  ? "ri-alert-line text-secondary-700"
                  : "ri-error-warning-line text-red-500"
            }`}
          ></i>
          <span className="text-xs text-foreground-700 leading-relaxed">{resultat.message}</span>
        </div>
      )}

      {!loading && !error && dernier && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 border-b border-background-200 bg-background-50">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
            <i className="ri-history-line"></i>
            Dernier test
          </span>
          <span className="text-[11px] text-foreground-600">
            {formatHorodatage(dernier.created_at)}
            <span className="text-foreground-400"> · {formatDepuis(dernier.created_at)}</span>
          </span>
          <span
            className={`ml-auto inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
              dernier.ok ? "bg-accent-100 text-accent-800" : "bg-red-100 text-red-700"
            }`}
          >
            <i className={dernier.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
            {dernier.ok ? "Essai sans débit vérifié" : "À revoir"}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2 p-5">
          {Array.from({ length: 2 }).map((_, i) => (
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
          <i className="ri-timer-flash-line text-foreground-400 text-lg"></i>
          Aucun test d'essai lancé pour l'instant. Cliquez sur « Lancer le test d'essai » pour vérifier le tunnel.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-background-200">
          {items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3">
              <span
                className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-lg ${
                  it.ok ? "bg-accent-100 text-accent-700" : "bg-red-100 text-red-700"
                }`}
              >
                <i className={it.ok ? "ri-check-line" : "ri-close-line"}></i>
              </span>
              <span
                className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                  it.ok ? "bg-accent-100 text-accent-800" : "bg-red-100 text-red-700"
                }`}
              >
                <i className={it.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
                {it.ok ? "Validé" : "À revoir"}
              </span>
              <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-secondary-100 text-secondary-800 text-[11px] font-medium whitespace-nowrap">
                Essai {it.essai_jours > 0 ? `${it.essai_jours} j` : "désactivé"}
              </span>
              {it.statut && (
                <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-background-200 text-foreground-600 text-[11px] font-medium whitespace-nowrap uppercase">
                  {it.statut}
                </span>
              )}
              <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-background-200 text-foreground-600 text-[11px] font-medium whitespace-nowrap tabular-nums">
                Débit : {it.montant_facture.toFixed(2)} €
              </span>
              <span className="min-w-0 flex-1 text-xs text-foreground-600 truncate" title={it.message}>
                {it.message || "—"}
              </span>
              <span className="text-[11px] text-foreground-400 whitespace-nowrap">
                {formatHorodatage(it.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}