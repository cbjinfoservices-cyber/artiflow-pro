import { supabase } from "@/lib/supabase";

/** Aperçu du rappel hebdomadaire des congés, tel qu'il sera envoyé au responsable. */
export interface ApercuRappelConges {
  /** HTML complet de l'email, affichable tel quel dans un cadre isolé. */
  html: string;
  /** Objet de l'email. */
  subject: string;
  /** Adresse du responsable qui recevra le rappel, si connue. */
  destinataire: string | null;
  /** Nombre d'absences qui démarrent la semaine prochaine. */
  conges: number;
  /** Lundi de la semaine concernée (AAAA-MM-JJ). */
  lundi: string;
  /** Dimanche de la semaine concernée (AAAA-MM-JJ). */
  dimanche: string;
}

/** Demande au Backend le rendu exact du rappel hebdo, sans rien envoyer. */
export async function apercuRappelConges(userId: string): Promise<ApercuRappelConges> {
  const { data, error } = await supabase.functions.invoke("rappel-conges-semaine", {
    body: { preview: true, userId },
  });
  if (error) throw new Error(error.message || "L'aperçu n'a pas pu être généré.");
  const payload = data as
    | {
        ok?: boolean;
        error?: string;
        html?: string;
        subject?: string;
        destinataire?: string | null;
        conges?: number;
        lundi?: string;
        dimanche?: string;
      }
    | null;
  if (!payload || payload.ok === false || !payload.html) {
    throw new Error(payload?.error || "Aperçu indisponible pour l'instant.");
  }
  return {
    html: payload.html,
    subject: payload.subject ?? "Congés de la semaine prochaine",
    destinataire: payload.destinataire ?? null,
    conges: payload.conges ?? 0,
    lundi: payload.lundi ?? "",
    dimanche: payload.dimanche ?? "",
  };
}

/** Résultat d'un envoi manuel (« Tester maintenant »). */
export interface ResultatEnvoiRappelConges {
  /** Vrai si au moins un email est réellement parti. */
  envoye: boolean;
  /** Message lisible à afficher sous les yeux du responsable. */
  message: string;
}

/**
 * Déclenche immédiatement le rappel hebdomadaire pour le responsable connecté,
 * sans attendre le lundi matin. Le garde-fou anti-doublon est volontairement ignoré
 * (c'est un test), mais aucune autre entreprise n'est concernée.
 */
export async function envoyerRappelConges(userId: string): Promise<ResultatEnvoiRappelConges> {
  const { data, error } = await supabase.functions.invoke("rappel-conges-semaine", {
    body: { force: true, userId },
  });
  if (error) throw new Error(error.message || "L'envoi a échoué.");
  const payload = data as
    | {
        ok?: boolean;
        error?: string;
        sent?: number;
        details?: Array<{ sent?: boolean; reason?: string; conges?: number }>;
      }
    | null;
  if (!payload || payload.ok === false) {
    throw new Error(payload?.error || "L'envoi a échoué.");
  }
  const detail = payload.details?.[0];
  if ((payload.sent ?? 0) > 0) {
    return { envoye: true, message: "Rappel envoyé au responsable par email." };
  }
  return {
    envoye: false,
    message: detail?.reason || "Aucun email envoyé (aucune absence concernée ou adresse manquante).",
  };
}