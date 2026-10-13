import { supabase } from "@/lib/supabase";
import { viderCacheDiagnosticPaiement } from "@/lib/diagnosticPaiementCache";

export type Facturation = "mensuel" | "annuel";

/** Mode de règlement : reconduction automatique (abonnement) ou paiement unique. */
export type ModePaiement = "recurrent" | "unique";

/** Tarif mensuel de référence de chaque offre (en euros). */
export const OFFRE_PRIX_PAIEMENT: Record<string, number> = { Essentiel: 29, Pro: 59, Entreprise: 99 };

/** Remise appliquée à la facturation annuelle (paiement de 12 mois −20 %). */
export const REMISE_ANNUELLE = 0.8;

/** Prix mensuel affiché selon l'offre et le mode de facturation. */
export function prixMensuel(offre: string, facturation: Facturation): number {
  const base = OFFRE_PRIX_PAIEMENT[offre];
  if (!base) return 0;
  return facturation === "annuel" ? Math.round(base * REMISE_ANNUELLE) : base;
}

/** Total facturé sur un an (12 mois) selon le mode de facturation. */
export function totalAnnuel(offre: string, facturation: Facturation): number {
  return prixMensuel(offre, facturation) * 12;
}

/** Économie annuelle réalisée par rapport au paiement mensuel. */
export function economieAnnuelle(offre: string): number {
  return totalAnnuel(offre, "mensuel") - totalAnnuel(offre, "annuel");
}

/** Construit l'URL de retour (succès / annulation) en tenant compte du basePath. */
function urlRetour(chemin: string): string {
  const basePath = (__BASE_PATH__ || "").split("/").filter(Boolean).join("/");
  const prefix = basePath ? `/${basePath}` : "";
  return `${window.location.origin}${prefix}${chemin}`;
}

/** URL de retour vers le suivi d'abonnement (onglet du profil), utilisée par le portail client Stripe. */
export function urlRetourMonAbonnement(): string {
  return urlRetour("/app/profil?onglet=abonnement");
}

/**
 * Extrait le message d'erreur réel renvoyé par une fonction Backend quand elle
 * répond avec un statut non-2xx (ex. « Le paiement n'est pas encore configuré. »,
 * une erreur Stripe, un défaut de permissions…). Évite de masquer la cause par un
 * message générique et rend l'erreur exploitable.
 */
async function messageErreurBackend(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = (await ctx.json()) as { error?: string; meta?: { message?: string; detail?: string } } | null;
      const message = body?.error || body?.meta?.message || body?.meta?.detail;
      if (message) return message;
    } catch {
      /* corps non JSON : on garde le message de repli */
    }
  }
  return fallback;
}

/**
 * Traduit un message d'erreur brut (souvent en anglais) renvoyé par Stripe ou par la
 * configuration du compte en un message clair et rassurant pour l'artisan.
 * But : ne jamais exposer un texte technique anglais devant un client.
 * Si le message n'est pas reconnu, il est renvoyé tel quel (souvent déjà en français).
 */
export function messagePaiementLisible(message: string): string {
  const brut = String(message ?? "").trim();
  if (!brut) return "Le paiement n'a pas pu être ouvert pour le moment. Réessayez dans un instant.";
  const m = brut.toLowerCase();

  const aucunMoyen =
    m.includes("no valid payment method") ||
    m.includes("payment method type") ||
    m.includes("payment_method_types") ||
    m.includes("payment method configuration") ||
    m.includes("moyen de paiement") ||
    (m.includes("currency") && m.includes("not supported"));
  if (aucunMoyen) {
    return "Aucun moyen de paiement n'est disponible pour le moment (paiement par carte en euros). Contactez le support : nous activons votre abonnement avec vous.";
  }

  if (m.includes("not configured") || m.includes("n'est pas encore configuré") || m.includes("pas encore configuré")) {
    return "Le paiement en ligne n'est pas encore disponible. Contactez le support pour activer votre abonnement.";
  }

  if (m.includes("api key") || m.includes("no such api key") || m.includes("clé")) {
    return "Le paiement en ligne n'est pas correctement configuré de notre côté. Contactez le support : nous régularisons rapidement.";
  }

  if (m.includes("permission") || m.includes("not allowed") || m.includes("forbidden")) {
    return "Le paiement en ligne est momentanément indisponible. Contactez le support pour finaliser votre abonnement.";
  }

  if (m.includes("currency") || m.includes("devise")) {
    return "La devise demandée (EUR) n'est pas acceptée par notre solution de paiement. Contactez le support pour finaliser votre abonnement.";
  }

  // Message non reconnu : on le laisse passer (il est probablement déjà exploitable).
  return brut;
}

export interface DiagnosticPaiementEur {
  /** `true` si une carte en euros peut a priori être encaissée. */
  eurDisponible: boolean;
  /** Origine du blocage détecté : "pays" ou "carte". */
  motif: "pays" | "carte" | "";
  /** Pays déclaré du compte Stripe (code ISO minuscule), quand disponible. */
  pays: string;
  /** Mode de la clé Stripe branchée : "test" (sk_test_…), "live" (sk_live_…) ou inconnu (""). */
  mode: "test" | "live" | "";
  /** Décomposition de chaque contrôle, pour expliquer précisément un blocage. */
  detail?: DiagnosticPaiementEurDetail | null;
}

/** Résultat détaillé de chaque vérification Stripe effectuée par le diagnostic. */
export interface DiagnosticPaiementEurDetail {
  /** La devise EUR est acceptée par le pays du compte Stripe. */
  eurSupportee: boolean;
  /** La carte bancaire est supportée dans le pays du compte Stripe. */
  carteSupporteePays: boolean;
  /** La carte est activée dans la configuration des moyens de paiement. */
  carteActive: boolean;
  /** Stripe marque la carte comme « disponible » (false si le compte n'est pas activé). */
  carteDisponible: boolean;
  /** Préférence d'affichage de la carte : "on", "off", "none" ou "". */
  cartePreference: string;
  /** Le compte Stripe peut encaisser (charges activées). */
  chargesActives: boolean;
  /** Pays du compte Stripe (code ISO minuscule). */
  pays: string;
  /** Identifiant du compte Stripe interrogé (acct_…), pour vérifier qu'on configure le bon compte. */
  compteId: string;
  /** Nom commercial du compte Stripe interrogé (boutique / entreprise), quand Stripe le fournit. */
  compteNom: string;
}

/**
 * Traduit le détail du diagnostic en CAUSES EXACTES, lisibles côté client.
 * But : quand le blocage vient réellement d'un moyen de paiement non activé (plutôt
 * que d'une erreur générique), afficher précisément ce qui manque — compte non activé,
 * carte désactivée, devise non acceptée — au lieu du message passe-partout.
 *
 * Renvoie une liste ordonnée de causes ; si aucun détail n'est disponible, une cause
 * de repli est renvoyée d'après le motif détecté.
 */
export function causesBlocagePaiement(diagnostic: DiagnosticPaiementEur | null): string[] {
  const detail = diagnostic?.detail ?? null;
  const causes: string[] = [];
  if (detail) {
    const pays = detail.pays ? ` (${detail.pays.toUpperCase()})` : "";
    if (!detail.chargesActives) {
      causes.push(
        "Le compte de paiement n'est pas encore entièrement activé : les encaissements ne sont pas encore autorisés.",
      );
    }
    if (!detail.eurSupportee) {
      causes.push(`La devise euro (EUR) n'est pas acceptée pour le pays du compte de paiement${pays}.`);
    } else if (!detail.carteSupporteePays) {
      causes.push(`La carte bancaire n'est pas disponible pour le pays du compte de paiement${pays}.`);
    }
    // On n'ajoute cette cause que si le compte encaisse déjà : sinon elle découle de
    // l'activation ci-dessus et ferait doublon.
    if (detail.chargesActives && !detail.carteDisponible) {
      causes.push("Le moyen de paiement « Carte » n'est pas encore disponible dans la configuration du compte.");
    }
    if (!detail.carteActive) {
      causes.push(
        `Le moyen de paiement « Carte » est désactivé à l'affichage${
          detail.cartePreference ? ` (préférence : ${detail.cartePreference})` : ""
        }.`,
      );
    }
  }
  if (causes.length === 0) {
    if (diagnostic?.motif === "pays") {
      causes.push("Notre solution de paiement n'accepte pas encore la carte en euros pour le pays du compte.");
    } else {
      causes.push("Le paiement par carte en euros n'est pas encore activé sur notre compte.");
    }
  }
  return causes;
}

/**
 * Interroge le Backend (lecture seule) pour savoir si le compte Stripe peut encaisser
 * une carte en euros, AVANT que le client ne clique sur « S'abonner ». Sert à afficher
 * un bandeau d'information en amont plutôt qu'une erreur au moment du paiement.
 */
export async function verifierPaiementEur(): Promise<DiagnosticPaiementEur> {
  const { data, error } = await supabase.functions.invoke("verifier-paiement-eur", { body: {} });
  if (error) {
    throw new Error(
      await messageErreurBackend(error, "Impossible de vérifier la configuration du paiement pour l'instant."),
    );
  }
  const result = data as (Partial<DiagnosticPaiementEur> & { ok?: boolean }) | null;
  if (!result?.ok) {
    throw new Error("Impossible de vérifier la configuration du paiement pour l'instant.");
  }
  const detail =
    result.detail && typeof result.detail === "object" ? (result.detail as DiagnosticPaiementEurDetail) : null;
  const mode = result.mode === "test" || result.mode === "live" ? result.mode : "";
  return {
    eurDisponible: result.eurDisponible !== false,
    motif: result.motif === "pays" || result.motif === "carte" ? result.motif : "",
    pays: typeof result.pays === "string" ? result.pays : "",
    mode,
    detail,
  };
}

export interface CheckoutDemarrage {
  url: string;
  sessionId: string;
}

/**
 * Démarre le tunnel de paiement : demande une session Stripe Checkout
 * (abonnement récurrent) au Backend, puis renvoie l'URL de paiement.
 */
export async function demarrerAbonnement(
  offre: string,
  facturation: Facturation,
  modePaiement: ModePaiement = "recurrent",
): Promise<CheckoutDemarrage> {
  const successUrl = urlRetour("/app/profil?onglet=abonnement&checkout=success&session_id={CHECKOUT_SESSION_ID}");
  // On mémorise l'offre et la facturation dans l'URL d'annulation : au retour,
  // le bandeau peut proposer de reprendre exactement le même paiement.
  const cancelUrl = urlRetour(
    `/tarifs?checkout=cancel&offre=${encodeURIComponent(offre)}&facturation=${encodeURIComponent(facturation)}`,
  );

  const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
    body: { offre, facturation, modePaiement, successUrl, cancelUrl },
  });

  if (error) {
    throw new Error(
      messagePaiementLisible(
        await messageErreurBackend(error, "Impossible de démarrer le paiement pour le moment. Réessayez dans un instant."),
      ),
    );
  }
  const result = data as { ok?: boolean; url?: string; sessionId?: string; error?: string } | null;
  if (!result?.ok || !result.url) {
    throw new Error(messagePaiementLisible(result?.error || "Le paiement n'a pas pu être ouvert."));
  }
  return { url: result.url, sessionId: result.sessionId ?? "" };
}

export interface TestPaiementBlanc {
  url: string;
  sessionId: string;
}

/**
 * Lance un « test à blanc » du tunnel de paiement : demande au Backend une session
 * Stripe Checkout en MODE TEST (clé sk_test_...). Aucune somme réelle n'est engagée ;
 * sert aux gestionnaires à valider de bout en bout que le paiement fonctionne.
 */
export async function testerPaiementBlanc(): Promise<TestPaiementBlanc> {
  const basePath = (__BASE_PATH__ || "").split("/").filter(Boolean).join("/");
  const prefix = basePath ? `/${basePath}` : "";
  const origine = window.location.origin;
  const { data, error } = await supabase.functions.invoke("tester-paiement-blanc", {
    body: {
      successUrl: `${origine}${prefix}/app/back-office?test-paiement=ok`,
      cancelUrl: `${origine}${prefix}/app/back-office?test-paiement=annule`,
    },
  });
  if (error) {
    throw new Error(
      await messageErreurBackend(
        error,
        "Impossible de lancer le test à blanc pour l'instant. Réessayez dans un instant.",
      ),
    );
  }
  const result = data as { ok?: boolean; url?: string; sessionId?: string; error?: string } | null;
  if (!result?.ok || !result.url) {
    throw new Error(result?.error || "Le test à blanc n'a pas pu être lancé.");
  }
  return { url: result.url, sessionId: result.sessionId ?? "" };
}

export interface ConfirmationAbonnement {
  id: number;
  offre: string;
  statut: string;
  montant_mensuel: number;
  date_echeance: string | null;
}

/**
 * Confirme auprès du Backend qu'un paiement Stripe a bien abouti,
 * puis active l'abonnement de l'artisan connecté.
 */
export async function confirmerAbonnement(sessionId: string): Promise<ConfirmationAbonnement> {
  const { data, error } = await supabase.functions.invoke("confirm-stripe-subscription", {
    body: { sessionId },
  });
  if (error) {
    throw new Error(
      messagePaiementLisible(
        await messageErreurBackend(
          error,
          "Impossible de confirmer le paiement. Contactez-nous si la somme a bien été débitée.",
        ),
      ),
    );
  }
  const result = data as { ok?: boolean; abonnement?: ConfirmationAbonnement; error?: string } | null;
  if (!result?.ok || !result.abonnement) {
    throw new Error(messagePaiementLisible(result?.error || "Le paiement n'a pas pu être confirmé."));
  }
  // Paiement réussi : on vide le cache du diagnostic pour que le bandeau « paiement
  // indisponible » de la page Tarifs disparaisse sans attendre l'expiration (10 min).
  viderCacheDiagnosticPaiement();
  return result.abonnement;
}

export interface FactureAbonnement {
  id: string;
  numero: string;
  date: string | null;
  montant: number;
  devise: string;
  statut: string;
  statutLabel: string;
  url: string | null;
  pdf: string | null;
}

export interface ProchainPrelevement {
  montant: number;
  devise: string;
  date: string | null;
}

export interface FacturationAbonnement {
  prochain: ProchainPrelevement | null;
  factures: FactureAbonnement[];
}

/**
 * Récupère auprès du Backend la liste des factures Stripe de l'artisan connecté
 * et le prochain prélèvement prévu. Lecture seule.
 */
export async function chargerFacturationAbonnement(): Promise<FacturationAbonnement> {
  const { data, error } = await supabase.functions.invoke("stripe-subscription-billing", {
    body: {},
  });
  if (error) {
    throw new Error(await messageErreurBackend(error, "Impossible de charger vos factures pour l'instant."));
  }
  const result = data as
    | { ok?: boolean; factures?: FactureAbonnement[]; prochain?: ProchainPrelevement | null; error?: string }
    | null;
  if (!result?.ok) {
    throw new Error(result?.error || "Impossible de charger vos factures pour l'instant.");
  }
  return { factures: result.factures ?? [], prochain: result.prochain ?? null };
}

/**
 * Ouvre le portail client Stripe (changer de moyen de paiement, télécharger les
 * factures, résilier). Renvoie la page sécurisée vers laquelle rediriger l'artisan.
 */
export interface ApercuRappel {
  html: string;
}

/**
 * Demande au Backend le rendu exact de l'email de rappel « J-3 avant prélèvement »
 * pour l'artisan connecté, SANS l'envoyer. Sert à prévisualiser le message.
 */
export async function previsualiserRappelPrelevement(userId: string): Promise<ApercuRappel> {
  const { data, error } = await supabase.functions.invoke("rappel-prelevement-abonnement", {
    body: { preview: true, force: true, userId },
  });
  if (error) {
    throw new Error(
      await messageErreurBackend(error, "Impossible de générer l'aperçu du rappel pour l'instant. Réessayez dans un instant."),
    );
  }
  const result = data as { ok?: boolean; html?: string; error?: string } | null;
  if (!result?.ok || !result.html) {
    throw new Error(result?.error || "L'aperçu du rappel est indisponible pour l'instant.");
  }
  return { html: result.html };
}

/**
 * Demande au Backend le rendu exact de l'email « dernier jour d'essai » (celui envoyé
 * automatiquement le jour même de la fin de l'essai), SANS l'envoyer. Utilisé par le
 * bouton « Aperçu » du back-office pour relire le message avant qu'il ne parte.
 */
export async function previsualiserEmailDernierJourEssai(): Promise<ApercuRappel> {
  const { data, error } = await supabase.functions.invoke("rappel-prelevement-abonnement", {
    body: { previewEssai: true },
  });
  if (error) {
    throw new Error(
      await messageErreurBackend(
        error,
        "Impossible de générer l'aperçu de l'email d'essai pour l'instant. Réessayez dans un instant.",
      ),
    );
  }
  const result = data as { ok?: boolean; html?: string; error?: string } | null;
  if (!result?.ok || !result.html) {
    throw new Error(result?.error || "L'aperçu de l'email d'essai est indisponible pour l'instant.");
  }
  return { html: result.html };
}

/**
 * Demande au Backend le rendu exact de l'email « J-1 avant la fin de l'essai » (le rappel
 * préventif envoyé automatiquement la veille de la fin de l'essai), SANS l'envoyer.
 * Utilisé par le bouton « Aperçu » du back-office pour relire le message avant qu'il ne parte.
 */
export async function previsualiserEmailEssaiJ1(): Promise<ApercuRappel> {
  const { data, error } = await supabase.functions.invoke("rappel-prelevement-abonnement", {
    body: { previewEssaiJ1: true },
  });
  if (error) {
    throw new Error(
      await messageErreurBackend(
        error,
        "Impossible de générer l'aperçu de l'email J-1 pour l'instant. Réessayez dans un instant.",
      ),
    );
  }
  const result = data as { ok?: boolean; html?: string; error?: string } | null;
  if (!result?.ok || !result.html) {
    throw new Error(result?.error || "L'aperçu de l'email J-1 est indisponible pour l'instant.");
  }
  return { html: result.html };
}

/**
 * Ouvre le portail client Stripe (changer de moyen de paiement, télécharger les
 * factures, résilier). Renvoie la page sécurisée vers laquelle rediriger l'artisan.
 */
export async function ouvrirPortailAbonnement(returnUrl: string): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke("stripe-billing-portal", {
    body: { returnUrl },
  });
  if (error) {
    throw new Error(
      await messageErreurBackend(
        error,
        "Impossible d'ouvrir la gestion de l'abonnement pour l'instant. Réessayez dans un instant.",
      ),
    );
  }
  const result = data as { ok?: boolean; url?: string; error?: string } | null;
  if (!result?.ok || !result.url) {
    throw new Error(result?.error || "La gestion de l'abonnement n'a pas pu être ouverte.");
  }
  return { url: result.url };
}

/**
 * Envoie au comptable la page de garde du pack comptable (PDF en pièce jointe) via le
 * Backend, en récapitulant le périmètre de la sélection. Lève une erreur lisible en cas d'échec.
 */
export async function envoyerPackComptableAuComptable(params: {
  to: string;
  /** Adresse secondaire mise en copie (Cc), mémorisée sur le profil. Facultative. */
  cc?: string;
  /** Nature de l'envoi : « pack » (page de garde + relevé + ZIP) ou « releve » (relevé seul). */
  mode?: "pack" | "releve";
  /** Page de garde (PDF base64). Requise uniquement en mode « pack ». */
  pdfBase64?: string;
  filename?: string;
  /** Relevé des prélèvements seul (PDF) encodé en base64. */
  releveBase64?: string;
  releveFilename?: string;
  /** Pack comptable complet (ZIP) encodé en base64 (mode « pack »). */
  zipBase64?: string;
  zipFilename?: string;
  filtreLabel: string;
  offre: string;
  mention: "HT" | "TTC";
  totalLabel: string;
  nombreFactures: number;
  /** Message d'accompagnement saisi par l'artisan (facultatif). */
  message?: string;
  /**
   * Envoi de test : l'email part réellement vers `to` (l'artisan lui-même) avec les mêmes
   * pièces, mais il n'est pas tracé comme un envoi au comptable dans l'historique.
   */
  test?: boolean;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("send-pack-comptable", { body: params });
  if (error) {
    throw new Error(
      await messageErreurBackend(error, "Impossible d'envoyer le pack au comptable pour l'instant. Réessayez dans un instant."),
    );
  }
  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) {
    throw new Error(result?.error || "L'envoi au comptable a échoué.");
  }
}

export interface ApercuEmailComptable {
  /** Objet exact de l'email qui sera expédié. */
  subject: string;
  /** Corps HTML exact de l'email, tel qu'il apparaîtra au comptable. */
  html: string;
  /** Pièces jointes annoncées dans le corps de l'email. */
  pieces: string[];
  /** Adresse du destinataire. */
  destinataire: string;
  /** Adresse secondaire en copie (Cc), ou null s'il n'y en a pas. */
  cc?: string | null;
}

/**
 * Demande au Backend le rendu exact de l'email du pack comptable (ou du relevé seul),
 * SANS rien expédier. Sert au bouton « Aperçu de l'email » pour valider avant l'envoi.
 */
export async function previsualiserPackComptable(params: {
  to: string;
  /** Adresse secondaire mise en copie (Cc), mémorisée sur le profil. Facultative. */
  cc?: string;
  mode: "pack" | "releve";
  filtreLabel: string;
  offre: string;
  mention: "HT" | "TTC";
  totalLabel: string;
  nombreFactures: number;
  message?: string;
  filename: string;
  releveFilename: string;
  zipFilename: string;
}): Promise<ApercuEmailComptable> {
  const { data, error } = await supabase.functions.invoke("send-pack-comptable", {
    body: { ...params, preview: true },
  });
  if (error) {
    throw new Error(
      await messageErreurBackend(error, "Impossible de préparer l'aperçu de l'email pour l'instant. Réessayez dans un instant."),
    );
  }
  const result = data as { ok?: boolean; preview?: ApercuEmailComptable; error?: string } | null;
  if (!result?.ok || !result.preview) {
    throw new Error(result?.error || "L'aperçu de l'email est indisponible pour l'instant.");
  }
  return result.preview;
}