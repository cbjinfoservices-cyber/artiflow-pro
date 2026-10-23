/**
 * Liste des fonctions Backend à appeler périodiquement (tâches planifiées / cron).
 * Chaque fonction vérifie elle-même l'heure et ses réglages avant d'envoyer, on peut
 * donc l'appeler « toutes les heures » sans risque de doublon.
 */
export interface TachePlanifiee {
  /** Nom technique de la fonction (utilisé dans l'URL). */
  slug: string;
  /** Nom lisible affiché dans l'écran de diagnostic. */
  nom: string;
  /** Rôle en une phrase. */
  role: string;
  /** Cadence conseillée au format cron. */
  cron: string;
}

/** Les automatisations à brancher sur un service de cron. */
export const TACHES_PLANIFIEES: TachePlanifiee[] = [
  { slug: "recap-quotidien", nom: "Récap quotidien", role: "Récapitulatif quotidien à l'artisan", cron: "0 * * * *" },
  {
    slug: "envoi-journal-mensuel",
    nom: "Journal comptable mensuel",
    role: "Journal du mois + régularité au comptable",
    cron: "0 * * * *",
  },
  {
    slug: "relance-envoi-manquant",
    nom: "Alerte mois sans envoi",
    role: "Prévient si un mois attendu reste sans envoi",
    cron: "0 8 * * *",
  },
  {
    slug: "relancer-factures-retard",
    nom: "Relances factures en retard",
    role: "Relance groupée des factures en retard",
    cron: "0 9 * * *",
  },
  {
    slug: "escalade-relances",
    nom: "Escalade des relances",
    role: "Escalade des relances clients sans réponse",
    cron: "0 9 * * *",
  },
  {
    slug: "rappel-prelevement-abonnement",
    nom: "Rappel de prélèvement (J-3)",
    role: "Rappel J-3 avant prélèvement Stripe",
    cron: "0 10 * * *",
  },
  {
    slug: "rappel-echeance-paiement-unique",
    nom: "Rappel fin de période (paiement unique)",
    role: "Rappel J-7 avant la fin d'une période payée en paiement unique",
    cron: "0 10 * * *",
  },
  {
    slug: "recap-recontact-volatils",
    nom: "Récap hebdo des recontacts",
    role: "Récap des comptes à recontacter",
    cron: "0 * * * *",
  },
  {
    slug: "rappel-conges-semaine",
    nom: "Rappel hebdo des congés à venir",
    role: "Prévient le responsable, chaque lundi, des congés qui démarrent la semaine suivante",
    cron: "0 * * * *",
  },
  {
    slug: "rappel-conflits-conge-veille",
    nom: "Rappel des conflits de congé la veille",
    role: "Envoie la liste des conflits (CSV joint) au responsable la veille de la réunion d'équipe, à l'heure choisie (7 h par défaut)",
    cron: "0 * * * *",
  },
  {
    slug: "recap-hebdo-envois-auto",
    nom: "Récap hebdo des envois auto",
    role: "Synthèse hebdo des envois automatiques",
    cron: "0 * * * *",
  },
  {
    slug: "recap-hebdo-alertes-taux",
    nom: "Récap hebdo des alertes de taux",
    role: "Synthèse hebdo des alertes de taux de réussite",
    cron: "0 * * * *",
  },
  {
    slug: "recap-hebdo-echecs-blanc",
    nom: "Récap hebdo des échecs test à blanc",
    role: "Envoi hebdo du récap d'échecs des rejeux à blanc (CSV)",
    cron: "0 * * * *",
  },
  {
    slug: "recap-hebdo-echecs-paiement",
    nom: "Récap hebdo des échecs de paiement",
    role: "Synthèse hebdo des échecs de paiement Stripe aux gestionnaires",
    cron: "0 * * * *",
  },
  {
    slug: "recap-hebdo-alertes-stripe-non-traitees",
    nom: "Récap hebdo des alertes Stripe non traitées",
    role: "Rappel hebdo aux gestionnaires des alertes de configuration Stripe encore à traiter",
    cron: "0 * * * *",
  },
  {
    slug: "recap-invitations-intervenants",
    nom: "Récap invitations intervenants",
    role: "Récap hebdo des fiches invitées sans compte à relancer",
    cron: "0 * * * *",
  },
  {
    slug: "envoi-bilan-annuel",
    nom: "Bilan d'archivage annuel",
    role: "Bilan annuel d'archivage au comptable",
    cron: "0 7 * * *",
  },
  {
    slug: "alerte-mot-de-passe-ancien",
    nom: "Alerte mot de passe ancien",
    role: "Prévient l'artisan quand son mot de passe dépasse 6 mois",
    cron: "0 8 * * *",
  },
  {
    slug: "recap-mensuel-mot-de-passe",
    nom: "Récap mensuel alertes mot de passe",
    role: "Récap mensuel du nombre d'alertes mot de passe envoyées",
    cron: "0 * * * *",
  },
  {
    slug: "recap-trimestriel-mot-de-passe",
    nom: "Récap trimestriel alertes mot de passe",
    role: "Listing trimestriel des récaps mensuels au comptable",
    cron: "0 * * * *",
  },
  {
    slug: "envoi-recap-mensuel-annuel",
    nom: "Historique annuel des récaps mot de passe",
    role: "Envoi annuel du PDF d'historique des récaps au comptable",
    cron: "0 7 * * *",
  },
  {
    slug: "envoi-comparatif-cadence-annuel",
    nom: "Comparatif de cadence annuel",
    role: "Envoi annuel du comparatif de cadence des récaps au comptable",
    cron: "0 7 * * *",
  },
  {
    slug: "envoi-recap-echecs-annuel",
    nom: "Régularité annuelle d'archivage des échecs",
    role: "Envoi annuel (date réglable) du PDF de régularité d'archivage des récaps d'échecs",
    cron: "0 * * * *",
  },
  {
    slug: "export-csv-mensuel",
    nom: "Export CSV mensuel par email",
    role: "Envoie par email les exports CSV (réessais + journal d'escalade)",
    cron: "0 * * * *",
  },
  {
    slug: "envoi-bienvenue-nouveaux-pros",
    nom: "Email de bienvenue aux nouveaux pros",
    role: "Accueille automatiquement chaque nouvelle inscription (une seule fois par pro)",
    cron: "0 * * * *",
  },
  {
    slug: "alerte-taux-brevo",
    nom: "Alerte taux de réussite des emails",
    role: "Prévient les gestionnaires si les envois Resend passent sous 95 % de réussite sur 24 h (une alerte par 24 h)",
    cron: "0 * * * *",
  },
];

/** URL publique d'appel d'une fonction Backend (les tâches planifiées ont verify_jwt = false). */
export function urlFonction(slug: string): string {
  const base = String(import.meta.env.VITE_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/functions/v1/${slug}`;
}

/** Résultat d'un appel manuel d'une fonction planifiée (utilisé pour le diagnostic « branché / non branché »). */
export interface ResultatDeclenchement {
  /** Slug de la fonction appelée. */
  slug: string;
  /** Date/heure (ISO) de l'appel. */
  quand: string;
  /** Vrai si la fonction a répondu correctement (2xx). */
  ok: boolean;
  /** Code HTTP renvoyé, ou null si l'appel n'a pas abouti. */
  http: number | null;
  /** Message court (renvoyé par la fonction, ou raison de l'échec). */
  message: string;
  /** Vrai si l'appel était un simple « ping » (aucune logique exécutée, donc aucun email). */
  silencieux?: boolean;
}

/**
 * Déclenche une fonction planifiée immédiatement, sans attendre le passage du cron.
 * Les tâches ont `verify_jwt = false` : elles peuvent être appelées depuis le navigateur.
 * Chaque fonction revérifie elle-même ses réglages avant d'envoyer, donc un appel manuel
 * est sans risque de doublon (mais peut réellement envoyer si l'heure correspond).
 */
export async function declencherFonction(slug: string, timeoutMs = 30000): Promise<ResultatDeclenchement> {
  const url = urlFonction(slug);
  const quand = new Date().toISOString();
  try {
    const controleur = new AbortController();
    const minuteur = window.setTimeout(() => controleur.abort(), timeoutMs);
    const reponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
      signal: controleur.signal,
    });
    window.clearTimeout(minuteur);
    const ok = reponse.ok;
    let message = `Réponse HTTP ${reponse.status}`;
    try {
      const texte = await reponse.text();
      if (texte) {
        try {
          const data = JSON.parse(texte) as Record<string, unknown>;
          const msg = data.message ?? data.error ?? data.detail;
          if (typeof msg === "string" && msg.trim()) message = msg.trim();
        } catch {
          message = texte.slice(0, 140);
        }
      }
    } catch {
      /* corps illisible : on garde le message HTTP */
    }
    return { slug, quand, ok, http: reponse.status, message };
  } catch (e) {
    const nom = e instanceof Error ? e.name : "";
    return {
      slug,
      quand,
      ok: false,
      http: null,
      message:
        nom === "AbortError"
          ? "Délai dépassé : aucune réponse de la fonction."
          : "Appel impossible : fonction absente ou réseau indisponible.",
    };
  }
}

/** Déclenche toutes les tâches planifiées en parallèle et renvoie le résultat de chacune. */
export async function declencherToutesFonctions(timeoutMs = 30000): Promise<ResultatDeclenchement[]> {
  return Promise.all(TACHES_PLANIFIEES.map((t) => declencherFonction(t.slug, timeoutMs)));
}

/**
 * Déclenche uniquement les fonctions demandées (par leur slug), en parallèle.
 * Sert au bouton « Re-tester uniquement les fonctions non branchées » : on ne relance
 * que celles qui ont échoué (ou jamais répondu), sans rappeler celles déjà au vert.
 */
export async function declencherFonctions(
  slugs: string[],
  timeoutMs = 30000,
): Promise<ResultatDeclenchement[]> {
  return Promise.all(slugs.map((slug) => declencherFonction(slug, timeoutMs)));
}

/**
 * Vérification « silencieuse » d'une fonction : on envoie une simple requête OPTIONS,
 * à laquelle toutes les tâches planifiées répondent immédiatement (garde CORS) SANS
 * exécuter leur logique. C'est le moyen de rafraîchir l'état « branché / non branché »
 * sans jamais envoyer d'email ni rien déclencher.
 */
export async function verifierFonctionSilencieuse(slug: string, timeoutMs = 12000): Promise<ResultatDeclenchement> {
  const url = urlFonction(slug);
  const quand = new Date().toISOString();
  try {
    const controleur = new AbortController();
    const minuteur = window.setTimeout(() => controleur.abort(), timeoutMs);
    const reponse = await fetch(url, { method: "OPTIONS", signal: controleur.signal });
    window.clearTimeout(minuteur);
    return {
      slug,
      quand,
      ok: reponse.ok,
      http: reponse.status,
      message: reponse.ok
        ? "Ping silencieux : fonction joignable (aucun email envoyé)."
        : `Réponse HTTP ${reponse.status}`,
      silencieux: true,
    };
  } catch (e) {
    const nom = e instanceof Error ? e.name : "";
    return {
      slug,
      quand,
      ok: false,
      http: null,
      message: nom === "AbortError" ? "Ping silencieux : délai dépassé." : "Ping silencieux : appel impossible.",
      silencieux: true,
    };
  }
}

/**
 * Vérifie silencieusement TOUTES les tâches planifiées en parallèle (ping OPTIONS),
 * sans jamais exécuter leur logique ni envoyer d'email.
 */
export async function verifierToutesFonctionsSilencieusement(timeoutMs = 12000): Promise<ResultatDeclenchement[]> {
  return Promise.all(TACHES_PLANIFIEES.map((t) => verifierFonctionSilencieuse(t.slug, timeoutMs)));
}