/** Niveau d'un point de contrôle du diagnostic. */
export type Niveau = "ok" | "attention" | "ko";

/** Métadonnées d'affichage associées à chaque niveau. */
export const NIVEAU_META: Record<
  Niveau,
  { label: string; icon: string; tone: string; bubble: string; dot: string }
> = {
  ok: {
    label: "OK",
    icon: "ri-checkbox-circle-line",
    tone: "bg-accent-100 text-accent-800",
    bubble: "bg-accent-100 text-accent-700",
    dot: "bg-accent-500",
  },
  attention: {
    label: "À vérifier",
    icon: "ri-error-warning-line",
    tone: "bg-secondary-100 text-secondary-800",
    bubble: "bg-secondary-100 text-secondary-700",
    dot: "bg-secondary-500",
  },
  ko: {
    label: "Bloquant",
    icon: "ri-close-circle-line",
    tone: "bg-red-100 text-red-700",
    bubble: "bg-red-100 text-red-700",
    dot: "bg-red-500",
  },
};

/** Un point de contrôle du diagnostic de configuration email. */
export interface DiagnosticCheck {
  id: string;
  titre: string;
  niveau: Niveau;
  detail: string;
  /** Conseil d'action affiché quand le point n'est pas « ok ». */
  action?: string;
}

/** Formate un horodatage ISO en date + heure locale lisible. */
export function formatHorodatage(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formate un horodatage ISO en délai relatif court (« à l'instant », « il y a 12 min »,
 * « il y a 3 h », « il y a 5 j »…). Sert de repère « vu récemment » de la configuration.
 */
export function formatDepuis(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  if (diff <= 0) return "à l'instant";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 30) return `il y a ${j} j`;
  const mois = Math.floor(j / 30);
  if (mois < 12) return `il y a ${mois} mois`;
  return `il y a ${Math.floor(mois / 12)} an${Math.floor(mois / 12) > 1 ? "s" : ""}`;
}

/**
 * Formate une durée (en millisecondes) en libellé court et lisible : « moins d'1 min »,
 * « 45 min », « 3,2 h » ou « 2,5 j ». Renvoie « — » si la durée est absente ou invalide.
 * Sert à afficher le délai moyen de traitement d'une alerte de configuration Stripe.
 */
export function formatDuree(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "—";
  const min = ms / 60000;
  if (min < 1) return "moins d'1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 24) return `${h < 10 ? h.toFixed(1).replace(".", ",") : Math.round(h)} h`;
  const j = h / 24;
  return `${j < 10 ? j.toFixed(1).replace(".", ",") : Math.round(j)} j`;
}