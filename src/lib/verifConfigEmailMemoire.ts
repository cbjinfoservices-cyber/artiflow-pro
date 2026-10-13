/**
 * Mémoire locale de la dernière vérification de la configuration d'envoi des emails.
 *
 * On retient la date de la dernière vérification RÉUSSIE de la config email (clé Resend +
 * domaine d'envoi), ainsi que le verdict de cette vérification (« prête » ou « à finaliser »).
 * Cela permet d'afficher ce repère dans le rappel mensuel du tableau de bord sans avoir à
 * rappeler le Backend à chaque visite, et de faire vivre le petit badge d'alerte du menu du compte.
 *
 * Purement un réglage d'affichage, sans aucune donnée métier. Passe par le module central
 * `stockageLocal` (jamais d'accès direct à `localStorage`).
 */

import { cleArtiflow, ecrireJson, lireJson, v } from "@/lib/stockageLocal";

/** Clé de stockage de la mémoire (utile pour écouter les changements ciblés). */
export const CLE_VERIF_CONFIG_EMAIL = cleArtiflow("email", "verif-config");

/** État mémorisé de la dernière vérification de la config email. */
interface EtatVerifConfigEmail {
  /** Horodatage ISO de la dernière vérification réussie. Vide = jamais vérifié. */
  date: string;
  /** La configuration était prête (clé + domaine vérifiés) au moment de cette vérification. */
  pret: boolean;
}

const DEFAUT: EtatVerifConfigEmail = { date: "", pret: false };

const valider = v.objetPartiel<EtatVerifConfigEmail>(
  {
    date: v.chaine("", { videOk: true }),
    pret: v.booleen(false),
  },
  DEFAUT,
);

/**
 * Mémorise la date de la dernière vérification réussie de la config email et son verdict.
 * Ignorée si la date est vide (on ne conserve alors que l'état précédent).
 */
export function noterVerificationConfigEmail(iso: string, pret: boolean): void {
  const propre = typeof iso === "string" ? iso : "";
  if (!propre) return;
  ecrireJson(CLE_VERIF_CONFIG_EMAIL, { date: propre, pret: pret === true });
}

/** Lit la mémoire de vérification, ou `null` si aucune vérification n'a encore été faite. */
export function lireVerifConfigEmail(): EtatVerifConfigEmail | null {
  const etat = lireJson(CLE_VERIF_CONFIG_EMAIL, valider);
  return etat.date ? etat : null;
}

/** Date ISO de la dernière vérification de la config email, ou `null`. */
export function derniereVerificationConfigEmail(): string | null {
  return lireVerifConfigEmail()?.date ?? null;
}