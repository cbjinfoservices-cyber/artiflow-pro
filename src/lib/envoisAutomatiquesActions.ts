import { supabase } from "@/lib/supabase";
import {
  previewRecap,
  previewRecapHebdoEnvois,
  previewRecapRapport,
  runRecapNow,
  runRelanceManquanteNow,
} from "@/lib/artisanApi";
import { previsualiserRappelPrelevement } from "@/lib/abonnementPaiement";
import { declencherRecapHebdoMaintenant } from "@/lib/recontactSeuil";
import { enregistrerTestEnvoiAuto } from "@/lib/envoisAutomatiquesHistorique";
import { envoyerEmailBlanc } from "@/lib/diagnosticEmail";
import { previewTauxAlerteRecapHebdo, runTauxAlerteRecapHebdoNow } from "@/lib/tauxAlerteRecapHebdo";
import { ajouterRejeuBlanc } from "@/lib/testABlancHistorique";

/** Capacités d'action (aperçu / test) d'une automatisation, selon son destinataire réel. */
export interface AutoActionCapabilities {
  /** Un aperçu de l'email est disponible (aucun envoi). */
  apercu: boolean;
  /** Un envoi de test réel vers l'artisan lui-même est possible. */
  test: boolean;
  /** Explication affichée quand le test est désactivé (destinataire tiers). */
  raisonSansTest?: string;
  /** Explication affichée quand l'aperçu est indisponible. */
  raisonSansApercu?: string;
}

/**
 * Les automatisations qui envoient à un tiers (comptable, clients) n'autorisent jamais
 * de test réel : on ne veut pas expédier un faux message à un vrai destinataire.
 * Les autres peuvent envoyer un vrai email de test à l'artisan lui-même.
 */
const CAPACITES: Record<string, AutoActionCapabilities> = {
  "recap-hebdo": { apercu: true, test: true },
  "relance-manquant": {
    apercu: false,
    test: true,
    raisonSansApercu: "Email à l'artisan : le test en envoie le contenu exact à votre adresse.",
  },
  "journal-mensuel": {
    apercu: true,
    test: false,
    raisonSansTest: "Ce journal part chez votre comptable : le test est désactivé pour ne rien lui envoyer.",
  },
  "bilan-annuel": {
    apercu: false,
    test: false,
    raisonSansTest: "Ce bilan part chez votre comptable : le test est désactivé pour ne rien lui envoyer.",
  },
  "rappel-prelevement": { apercu: true, test: true },
  "escalade-relances": {
    apercu: false,
    test: false,
    raisonSansTest: "L'escalade écrit à vos clients : le test est désactivé pour ne rien leur envoyer.",
  },
  "recap-quotidien": { apercu: true, test: true },
  "recap-hebdo-envois-auto": { apercu: true, test: true },
  "recap-hebdo-alertes-taux": { apercu: true, test: true },
};

/** Renvoie les capacités d'action d'une automatisation (test/aperçu indisponibles par défaut). */
export function capacitesEnvoiAuto(id: string): AutoActionCapabilities {
  return CAPACITES[id] ?? { apercu: false, test: false };
}

/**
 * Les automatisations rejouables en « test à blanc » : celles dont le contenu peut être
 * reconstruit (elles disposent d'un aperçu). Sert au rejeu global lancé depuis le Diagnostic,
 * sans dépendre du chargement de l'état des automatisations.
 */
export const AUTOMATISATIONS_REJOUABLES: ReadonlyArray<{ id: string; nom: string; icone: string }> = [
  { id: "recap-hebdo", nom: "Récap hebdo des recontacts", icone: "ri-mail-star-line" },
  { id: "journal-mensuel", nom: "Journal comptable mensuel", icone: "ri-file-chart-line" },
  { id: "rappel-prelevement", nom: "Rappel de prélèvement (J-3)", icone: "ri-bank-card-line" },
  { id: "recap-quotidien", nom: "Récapitulatif quotidien", icone: "ri-mail-line" },
  { id: "recap-hebdo-envois-auto", nom: "Récap hebdo des envois automatiques", icone: "ri-calendar-schedule-line" },
  { id: "recap-hebdo-alertes-taux", nom: "Récap hebdo des alertes de taux", icone: "ri-mail-star-line" },
];

/** Rendu d'un email d'aperçu : objet + corps HTML isolé. */
export interface ApercuEnvoiEmail {
  /** Objet de l'email. */
  sujet: string;
  /** Corps HTML complet de l'email. */
  html: string;
  /** Nombre de destinataires concernés, quand l'information est disponible. */
  destinataires?: number;
}

/** Charge l'aperçu (aucun envoi) de l'email d'une automatisation. */
export async function chargerApercuEnvoiAuto(id: string, userId: string): Promise<ApercuEnvoiEmail> {
  if (id === "recap-hebdo") {
    const { data, error } = await supabase.functions.invoke("recap-recontact-volatils", {
      body: { preview: true, userId },
    });
    if (error) throw new Error("L'aperçu n'a pas pu être généré. Réessayez.");
    const p = data as { ok?: boolean; error?: string; html?: string; subject?: string; count?: number } | null;
    if (!p || p.ok === false || !p.html) throw new Error(p?.error || "Aperçu indisponible pour l'instant.");
    return {
      sujet: p.subject || "Récap hebdomadaire des recontacts · ArtiFlow-pro",
      html: p.html,
      destinataires: p.count ?? 0,
    };
  }
  if (id === "journal-mensuel") {
    const res = await previewRecapRapport(userId, "comptable");
    return {
      sujet: res.subject || "Régularité des envois comptables · ArtiFlow-pro",
      html: res.html,
      destinataires: res.mois,
    };
  }
  if (id === "rappel-prelevement") {
    const res = await previsualiserRappelPrelevement(userId);
    return { sujet: "Prélèvement prévu dans 3 jours — abonnement ArtiFlow-pro", html: res.html };
  }
  if (id === "recap-quotidien") {
    const res = await previewRecap(userId);
    return { sujet: res.subject || "Récapitulatif quotidien · ArtiFlow-pro", html: res.html };
  }
  if (id === "recap-hebdo-envois-auto") {
    const res = await previewRecapHebdoEnvois(userId);
    return {
      sujet: res.subject || "Récap hebdo des envois automatiques · ArtiFlow-pro",
      html: res.html,
      destinataires: res.destinataires,
    };
  }
  if (id === "recap-hebdo-alertes-taux") {
    const res = await previewTauxAlerteRecapHebdo(userId);
    return {
      sujet: res.subject || "Récap hebdo des alertes de taux · ArtiFlow-pro",
      html: res.html,
      destinataires: res.alertes,
    };
  }
  throw new Error("Aperçu indisponible pour cette automatisation.");
}

/**
 * Déclenche un envoi de test réel, TOUJOURS vers l'adresse de l'artisan connecté
 * (jamais vers le comptable ni les clients). Renvoie un message de résultat prêt à afficher.
 */
export async function testerEnvoiAuto(id: string, userId: string): Promise<string> {
  if (id === "recap-hebdo") {
    const res = await declencherRecapHebdoMaintenant(userId);
    return res.envoye
      ? `Email de test envoyé à votre adresse (${res.nbComptes} compte(s) concerné(s)). Vérifiez votre boîte mail.`
      : "Test journalisé, mais aucun email n'a pu partir (envoi d'emails non configuré ou adresse manquante).";
  }
  if (id === "relance-manquant") {
    const res = await runRelanceManquanteNow(userId);
    if (res.sent > 0) return "Email d'alerte de test envoyé à votre adresse. Vérifiez la réception et le rendu.";
    if (!res.configured) return "L'envoi d'emails n'est pas encore configuré : le test n'a rien pu expédier.";
    return res.reason || "Le test n'a rien expédié. Vérifiez l'email de votre profil.";
  }
  if (id === "rappel-prelevement") {
    const { data, error } = await supabase.functions.invoke("rappel-prelevement-abonnement", {
      body: { force: true, userId },
    });
    if (error) throw new Error("Le test du rappel a échoué. Réessayez.");
    const p = data as { ok?: boolean; error?: string; configured?: boolean; envois?: number } | null;
    if (!p || p.ok === false) throw new Error(p?.error || "Le test du rappel a échoué.");
    if ((p.envois ?? 0) > 0) return "Rappel de test envoyé à votre adresse. Vérifiez la réception et le rendu.";
    if (!p.configured) return "L'envoi d'emails n'est pas encore configuré : le test n'a rien pu expédier.";
    return "Aucun rappel de test n'a pu partir (abonnement payé par carte actif requis ou email manquant).";
  }
  if (id === "recap-quotidien") {
    const res = await runRecapNow(userId);
    if (res.sent > 0) return "Récapitulatif de test envoyé à votre adresse. Vérifiez votre boîte mail.";
    if (!res.configured) return "L'envoi d'emails n'est pas encore configuré : le test n'a rien pu expédier.";
    return "Aucun récapitulatif de test n'a pu partir (adresse email manquante ou envoi refusé).";
  }
  if (id === "recap-hebdo-alertes-taux") {
    const res = await runTauxAlerteRecapHebdoNow(userId);
    if (res.sent > 0) return "Récap hebdo des alertes de taux envoyé à votre adresse. Vérifiez votre boîte mail.";
    if (!res.configured) return "L'envoi d'emails n'est pas encore configuré : le test n'a rien pu expédier.";
    return res.reason || "Le test n'a rien expédié (adresse manquante ou aucune alerte à résumer).";
  }
  throw new Error("Le test n'est pas disponible pour cette automatisation.");
}

/** Résultat d'un test manuel exécuté pour une automatisation. */
export interface ResultatTestAuto {
  /** Vrai si l'envoi de test a abouti. */
  ok: boolean;
  /** Message de résultat prêt à afficher. */
  message: string;
}

/**
 * Exécute un test réel (toujours vers l'adresse de l'artisan connecté) et le journalise
 * dans l'historique. C'est ce helper qui est utilisé aussi bien par le bouton d'une carte
 * que par le bouton « Re-tester les automatisations à vérifier » de la page, pour lancer
 * plusieurs tests à la suite de façon identique.
 */
export async function executerTestEnvoiAuto(
  id: string,
  nom: string,
  userId: string,
): Promise<ResultatTestAuto> {
  try {
    const message = await testerEnvoiAuto(id, userId);
    await enregistrerTestEnvoiAuto({
      userId,
      automatisationId: id,
      automatisationNom: nom,
      resultat: "succes",
      message,
    });
    return { ok: true, message };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Le test a échoué. Réessayez.";
    await enregistrerTestEnvoiAuto({
      userId,
      automatisationId: id,
      automatisationNom: nom,
      resultat: "echec",
      message,
    });
    return { ok: false, message };
  }
}

/** Résultat d'un rejeu « test à blanc » d'une automatisation. */
export interface ResultatBlanc {
  /** Identifiant de l'automatisation rejouée. */
  id: string;
  /** Nom affiché de l'automatisation. */
  nom: string;
  /** Vrai si la copie de test a bien été expédiée. */
  ok: boolean;
  /** Message de résultat prêt à afficher. */
  message: string;
}

/**
 * Rejoue une automatisation en « test à blanc » : on reconstruit le contenu EXACT de son
 * email (via son aperçu, sans rien envoyer) puis on en expédie une copie au destinataire de
 * test. Aucun vrai destinataire (client, comptable) n'est jamais touché.
 *
 * Les automatisations dont le contenu ne peut pas être reconstruit (destinataire tiers sans
 * aperçu) ne sont pas rejouables à blanc : on le signale sans rien envoyer.
 */
export async function rejouerEnBlanc(
  id: string,
  nom: string,
  userId: string,
  destinataire: string,
): Promise<ResultatBlanc> {
  if (!capacitesEnvoiAuto(id).apercu) {
    return {
      id,
      nom,
      ok: false,
      message:
        "Cette automatisation n'a pas d'aperçu : le test à blanc est indisponible (envoi vers un destinataire tiers).",
    };
  }
  try {
    const apercu = await chargerApercuEnvoiAuto(id, userId);
    await envoyerEmailBlanc({
      to: destinataire,
      subject: `[Test à blanc] ${apercu.sujet}`,
      html: apercu.html,
    });
    ajouterRejeuBlanc({ id, nom, destinataire, ok: true, date: new Date().toISOString(), userId });
    return { id, nom, ok: true, message: `Copie de test à blanc envoyée à ${destinataire}.` };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Le test à blanc a échoué. Réessayez.";
    ajouterRejeuBlanc({ id, nom, destinataire, ok: false, date: new Date().toISOString(), userId });
    return {
      id,
      nom,
      ok: false,
      message,
    };
  }
}