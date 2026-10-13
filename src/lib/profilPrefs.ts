/**
 * Préférences d'affichage de la page « Mon profil » (espace artisan).
 *
 * On y mémorise uniquement **l'onglet actif** de la page : au retour, l'artisan
 * retombe directement sur la section qu'il consultait (Entreprise, Automatismes,
 * Emails, Sécurité ou Historique) au lieu de revenir systématiquement au premier onglet.
 *
 * Aucune donnée métier ici : c'est un simple réglage d'interface, propre au poste et
 * au navigateur. La lecture / écriture passe exclusivement par `@/lib/stockageLocal`.
 */

import { cleArtiflow, v } from "@/lib/stockageLocal";

/** Liste fermée des onglets de la page Profil. */
export const ONGLETS_PROFIL = ["entreprise", "automatismes", "emails", "abonnement", "securite", "historique"] as const;

/** Onglet de la page Profil. */
export type OngletProfil = (typeof ONGLETS_PROFIL)[number];

/** Clé de mémorisation de l'onglet actif. */
export const CLE_ONGLET_PROFIL = cleArtiflow("profil", "onglet");

/**
 * Validateur stable de l'onglet actif. Défini au niveau du module (et non dans le rendu)
 * pour garder une identité constante : `usePersistedState` en dépend. Une valeur inconnue
 * (ou corrompue) retombe proprement sur « entreprise ».
 */
export const VALIDER_ONGLET_PROFIL = v.enumeration(ONGLETS_PROFIL, "entreprise");