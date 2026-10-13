import { OFFRE_PRIX } from "@/lib/abonnementsApi";
import { toISODate } from "@/lib/dates";

export interface OffreDetail {
  nom: string;
  prix: number;
  accroche: string;
  inclus: string[];
}

/** Contenu de présentation de chaque offre (texte statique, sans logique de paiement). */
export const OFFRES_DETAILS: OffreDetail[] = [
  {
    nom: "Essentiel",
    prix: OFFRE_PRIX.Essentiel,
    accroche: "L'indispensable pour démarrer sereinement.",
    inclus: [
      "Devis et factures illimités",
      "Relances automatiques par email",
      "Suivi des chantiers et du planning",
      "Export comptable et PDF",
      "1 utilisateur",
    ],
  },
  {
    nom: "Pro",
    prix: OFFRE_PRIX.Pro,
    accroche: "Pour les artisans qui veulent aller vite.",
    inclus: [
      "Tout l'Essentiel, sans limite",
      "Génération de devis assistée par IA",
      "Relances email + SMS / WhatsApp",
      "Comptabilité avancée (TVA, bilan)",
      "Support prioritaire",
    ],
  },
  {
    nom: "Entreprise",
    prix: OFFRE_PRIX.Entreprise,
    accroche: "Pour les équipes et les gros volumes.",
    inclus: [
      "Tout le Pro, sans limite",
      "Multi-utilisateurs et collaborateurs",
      "Envoi automatique au comptable",
      "Modèles de devis partagés",
      "Accompagnement dédié",
    ],
  },
];

export function offreDetail(offre: string): OffreDetail | null {
  return OFFRES_DETAILS.find((o) => o.nom === offre) ?? null;
}

export interface StatutMeta {
  label: string;
  tone: string;
  icon: string;
}

export const STATUT_META: Record<string, StatutMeta> = {
  Actif: { label: "Actif", tone: "bg-accent-100 text-accent-800", icon: "ri-checkbox-circle-line" },
  Essai: { label: "Période d'essai", tone: "bg-secondary-100 text-secondary-800", icon: "ri-timer-line" },
  Impayé: { label: "Impayé", tone: "bg-red-100 text-red-700", icon: "ri-error-warning-line" },
  Résilié: { label: "Résilié", tone: "bg-background-200 text-foreground-600", icon: "ri-close-circle-line" },
};

export function statutMeta(statut: string): StatutMeta {
  return STATUT_META[statut] ?? STATUT_META.Actif;
}

/** Formule de règlement : reconduction automatique (abonnement) ou paiement unique (ponctuel). */
export type ModeAbonnement = "recurrent" | "unique";

/**
 * Déduit la formule de règlement depuis le libellé du moyen de paiement enregistré.
 * Le canal contient par exemple « Carte (Stripe · paiement unique mensuel) » ou
 * « Carte (Stripe · abonnement mensuel) ».
 */
export function modeAbonnement(canalPaiement: string | null | undefined): ModeAbonnement {
  return (canalPaiement ?? "").toLowerCase().includes("paiement unique") ? "unique" : "recurrent";
}

export interface ModeMeta {
  label: string;
  court: string;
  description: string;
  tone: string;
  icone: string;
}

export const MODE_META: Record<ModeAbonnement, ModeMeta> = {
  recurrent: {
    label: "Abonnement reconductible",
    court: "Reconductible",
    description: "Prélèvement automatique à chaque échéance, jusqu'à résiliation.",
    tone: "bg-accent-100 text-accent-800",
    icone: "ri-loop-right-line",
  },
  unique: {
    label: "Paiement unique (ponctuel)",
    court: "Paiement unique",
    description: "Période réglée en une fois, sans reconduction automatique.",
    tone: "bg-secondary-100 text-secondary-800",
    icone: "ri-hand-coin-line",
  },
};

export function modeMeta(mode: ModeAbonnement): ModeMeta {
  return MODE_META[mode];
}

/** Nombre de jours (positif = dans le futur) entre aujourd'hui et une date AAAA-MM-JJ. */
export function joursAvant(dateISO: string | null): number | null {
  if (!dateISO) return null;
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

/** Durée de la période d'essai par défaut (en jours), si le réglage global est indisponible. */
export const DUREE_ESSAI_JOURS = 14;

/**
 * Date de fin de la période d'essai calculée depuis la date de début de l'abonnement
 * (ISO AAAA-MM-JJ). La durée peut être fournie (réglage global modifiable depuis le
 * back-office) ; à défaut, la valeur par défaut est utilisée. Renvoie null si la date
 * de début est absente ou invalide.
 */
export function finPeriodeEssai(
  dateDebut: string | null | undefined,
  dureeJours: number = DUREE_ESSAI_JOURS,
): string | null {
  if (!dateDebut) return null;
  const d = new Date(`${String(dateDebut).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + dureeJours);
  return toISODate(d);
}

/**
 * Date de fin d'essai si l'abonnement démarre maintenant : sert à afficher l'information
 * AVANT la souscription, quand le tunnel de paiement n'a pas encore créé l'abonnement.
 * La durée peut être fournie (réglage global) ; à défaut, la valeur par défaut s'applique.
 */
export function finPeriodeEssaiProchaine(
  base: Date = new Date(),
  dureeJours: number = DUREE_ESSAI_JOURS,
): string {
  const d = new Date(base);
  d.setDate(d.getDate() + dureeJours);
  return toISODate(d);
}