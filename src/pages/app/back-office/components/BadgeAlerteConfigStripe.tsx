import { useAlertesConfigStripe } from "@/hooks/useAlertesConfigStripe";
import { useAuth } from "@/hooks/useAuth";
import { formatDepuis } from "@/lib/diagnosticUi";

/** Fenêtre pendant laquelle une alerte de configuration Stripe reste « allumée ». */
const SEUIL_24H_MS = 24 * 60 * 60 * 1000;

function estRecente(iso: string): boolean {
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && Date.now() - t < SEUIL_24H_MS;
}

/**
 * Badge d'état de configuration Stripe affiché en tête du back-office.
 *
 * Il s'« allume » (rouge, point clignotant) dès qu'une alerte de configuration Stripe
 * a été détectée dans les dernières 24 heures, et reste discret (vert) sinon. Un clic
 * n'est pas nécessaire : il sert de signal visuel immédiat pour les gestionnaires.
 */
export default function BadgeAlerteConfigStripe() {
  const { isGestionnaire } = useAuth();
  const { items, loading, error } = useAlertesConfigStripe(20);

  if (!isGestionnaire) return null;
  if (loading || error) return null;

  const recentes = items.filter(
    (it) => it.created_at && estRecente(it.created_at) && it.statut !== "traitee",
  );

  if (recentes.length === 0) {
    const derniere = items[0];
    return (
      <span
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap"
        title={
          derniere
            ? `Aucune alerte de configuration Stripe dans les dernières 24 h (dernière : ${formatDepuis(derniere.created_at)}).`
            : "Aucune alerte de configuration Stripe enregistrée : le paiement carte en euros fonctionne normalement."
        }
      >
        <i className="ri-shield-check-line"></i>
        Paiement OK
      </span>
    );
  }

  const derniere = recentes[0];
  return (
    <span
      className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-red-100 text-red-700 text-xs font-semibold whitespace-nowrap"
      title={`${recentes.length} alerte${recentes.length > 1 ? "s" : ""} de configuration Stripe dans les dernières 24 h — voir le guide de dépannage plus bas.`}
    >
      <span className="relative flex w-2 h-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping"></span>
        <span className="relative inline-flex rounded-full w-2 h-2 bg-red-500"></span>
      </span>
      <i className="ri-alarm-warning-line"></i>
      Alerte paiement
      {recentes.length > 1 && <span className="tabular-nums">· {recentes.length}</span>}
      <span className="font-medium text-red-600/80">{formatDepuis(derniere.created_at)}</span>
    </span>
  );
}