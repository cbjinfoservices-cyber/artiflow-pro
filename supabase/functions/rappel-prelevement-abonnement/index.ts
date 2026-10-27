import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleEnvoiEmail, domaineEnvoiEmail, envoyerEmail } from "../_shared/envoiEmail.ts";

// Fonction de rappel « J-3 avant prélèvement ».
// Prévue pour tourner SANS session utilisateur : appelée par une tâche planifiée
// (voir Agents → Tâches planifiées), idéalement une fois par jour.
//
// Pour chaque abonnement payé par carte Stripe et toujours actif, elle interroge
// Stripe pour connaître la date du prochain prélèvement, puis envoie UN email de
// rappel à l'artisan 3 jours avant, afin d'éviter les mauvaises surprises.
// L'envoi réel nécessite Resend configuré : RESEND_API_KEY + RESEND_FROM_DOMAIN.
//
// Paramètres optionnels (POST) :
//   - { preview: true }  → renvoie le HTML de l'email sans rien envoyer (aperçu)
//   - { force: true }    → envoie le rappel même hors de la fenêtre J-3 (test)
//   - { userId: "..." }  → ne traite qu'un seul artisan (test ciblé)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Convertit un horodatage Unix Stripe en date AAAA-MM-JJ (UTC). */
function toDateISO(unix: number | null | undefined): string | null {
  if (!unix || !Number.isFinite(unix)) return null;
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

/** Date du jour (AAAA-MM-JJ). */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Nombre de jours entiers entre aujourd'hui et une date AAAA-MM-JJ (positif = futur). */
function joursAvant(dateISO: string): number {
  const cible = new Date(`${dateISO}T00:00:00Z`).getTime();
  const today = new Date(`${todayISO()}T00:00:00Z`).getTime();
  return Math.round((cible - today) / 86400000);
}

/** Date lisible « 12 octobre 2026 ». */
function frDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** Montant formaté dans la devise indiquée (Stripe renvoie des centimes). */
function montantLabel(cents: number | undefined, currency: string | undefined): string {
  const devise = (currency ?? "eur").toUpperCase();
  const valeur = (Number(cents) || 0) / 100;
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise }).format(valeur);
  } catch {
    return `${valeur.toFixed(2)} ${devise}`;
  }
}

interface EmailParams {
  to: string;
  sujet: string;
  html: string;
}

/** Envoi d'un email via Resend (best-effort, secrets lus à l'exécution). */
async function envoyerEmail(params: EmailParams): Promise<boolean> {
  const apiKey = cleEnvoiEmail();
  const domain = domaineEnvoiEmail();
  if (!apiKey || !domain) return false;
  try {
    const res = await envoyerEmail("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `ArtiFlow-pro <noreply@${domain}>`,
        to: [params.to],
        subject: params.sujet,
        html: params.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function gabarit(titre: string, intro: string, corps: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="font-size:14px;font-weight:bold;letter-spacing:0.4px;color:#0f6b58;margin-bottom:16px;">ArtiFlow-pro</div>
      <div style="background:#ffffff;border:1px solid #e6e4df;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">${titre}</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3c3c38;">${intro}</p>
        ${corps}
      </div>
      <p style="margin:18px 0 0;font-size:11px;line-height:1.6;color:#8a8a84;text-align:center;">
        Cet email vous est envoyé automatiquement par ArtiFlow-pro. Vos paiements sont traités de façon sécurisée par Stripe.
      </p>
    </div>
  </body>
</html>`;
}

function ligneRecap(label: string, valeur: string): string {
  return `<tr>
    <td style="padding:9px 0;font-size:13px;color:#6a6a64;border-bottom:1px solid #efede8;">${label}</td>
    <td style="padding:9px 0;font-size:13px;font-weight:bold;text-align:right;border-bottom:1px solid #efede8;">${valeur}</td>
  </tr>`;
}

interface RappelData {
  entreprise: string;
  offre: string;
  montant: string;
  date: string;
}

/** Construit le corps HTML du rappel de prélèvement. */
function corpsRappel(r: RappelData): string {
  return `
    <div style="background:#fdf6ec;border:1px solid #f0dcbf;border-radius:10px;padding:14px 16px;margin:0 0 16px;">
      <p style="margin:0;font-size:13px;font-weight:bold;color:#a35b12;">Prélèvement prévu dans 3 jours</p>
    </div>
    <div style="background:#f7f6f2;border:1px solid #e6e4df;border-radius:10px;padding:6px 16px;">
      <table style="width:100%;border-collapse:collapse;">
        ${ligneRecap("Entreprise", r.entreprise)}
        ${ligneRecap("Offre", `ArtiFlow-pro ${r.offre}`)}
        ${ligneRecap("Montant", r.montant)}
        ${ligneRecap("Date du prélèvement", r.date)}
      </table>
    </div>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#3c3c38;">
      Aucune action n'est nécessaire si tout est en ordre : le montant sera automatiquement prélevé sur la carte
      enregistrée. Vous pouvez à tout moment changer de moyen de paiement, télécharger vos factures ou résilier
      depuis la rubrique <strong>Mon abonnement</strong> de votre espace ArtiFlow-pro.
    </p>`;
}

/**
 * Corps HTML de l'email « dernier jour d'essai » : envoyé le jour même de la fin de
 * l'essai, pour maximiser les conversions avant le tout premier prélèvement.
 */
function corpsDernierJourEssai(r: RappelData): string {
  return `
    <div style="background:#fdf1e7;border:1px solid #f2d3b3;border-radius:10px;padding:14px 16px;margin:0 0 16px;">
      <p style="margin:0;font-size:13px;font-weight:bold;color:#b25e0d;">Dernier jour d'essai — premier prélèvement demain</p>
    </div>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3c3c38;">
      Aujourd'hui marque le dernier jour de votre essai ArtiFlow-pro. À partir de demain, votre abonnement se
      poursuit automatiquement et le premier prélèvement est effectué sur la carte enregistrée — sauf si vous
      résiliez avant la fin de la journée.
    </p>
    <div style="background:#f7f6f2;border:1px solid #e6e4df;border-radius:10px;padding:6px 16px;">
      <table style="width:100%;border-collapse:collapse;">
        ${ligneRecap("Entreprise", r.entreprise)}
        ${ligneRecap("Offre", `ArtiFlow-pro ${r.offre}`)}
        ${ligneRecap("Premier prélèvement", r.montant)}
        ${ligneRecap("Date du prélèvement", r.date)}
      </table>
    </div>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#3c3c38;">
      Vous profitez de toutes les fonctionnalités pendant votre essai : devis assistés par IA, relances email et SMS,
      suivi des chantiers et comptabilité. Pour continuer sans interruption, aucune action n'est nécessaire.
      Pour résilier avant le premier prélèvement, rendez-vous dans la rubrique <strong>Mon abonnement</strong>.
    </p>`;
}

/**
 * Corps HTML de l'email « J-1 avant la fin de l'essai » : envoyé la veille de la fin de
 * l'essai, en complément du rappel J-3 et du dernier jour, pour doubler la dernière chance
 * de conversion avant le tout premier prélèvement.
 */
function corpsEssaiJ1(r: RappelData): string {
  return `
    <div style="background:#fdf6ec;border:1px solid #f0dcbf;border-radius:10px;padding:14px 16px;margin:0 0 16px;">
      <p style="margin:0;font-size:13px;font-weight:bold;color:#a35b12;">Plus qu'un jour d'essai — premier prélèvement dans 2 jours</p>
    </div>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3c3c38;">
      Votre essai ArtiFlow-pro se termine demain. Après-demain, votre abonnement se poursuit automatiquement et
      le premier prélèvement est effectué sur la carte enregistrée — sauf si vous résiliez avant la fin de l'essai.
    </p>
    <div style="background:#f7f6f2;border:1px solid #e6e4df;border-radius:10px;padding:6px 16px;">
      <table style="width:100%;border-collapse:collapse;">
        ${ligneRecap("Entreprise", r.entreprise)}
        ${ligneRecap("Offre", `ArtiFlow-pro ${r.offre}`)}
        ${ligneRecap("Premier prélèvement", r.montant)}
        ${ligneRecap("Fin de l'essai", r.date)}
      </table>
    </div>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#3c3c38;">
      Il vous reste une journée pour en profiter. Pour continuer sans interruption, aucune action n'est nécessaire :
      votre offre prend le relais automatiquement. Pour résilier avant le premier prélèvement, rendez-vous dans la
      rubrique <strong>Mon abonnement</strong>.
    </p>`;
}

interface StripeInvoice {
  id?: string;
  amount_due?: number;
  amount_remaining?: number;
  currency?: string;
  next_payment_attempt?: number | null;
  period_end?: number | null;
  error?: { message?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;

    // Aperçu statique de l'email « dernier jour d'essai » : rendu fidèle avec des données
    // d'exemple, sans dépendre d'un abonnement réel ni de la configuration Stripe/Resend.
    // Alimente le bouton « Aperçu » du back-office.
    if (body?.previewEssai === true) {
      const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      return json({
        ok: true,
        configured: false,
        abonnements: 0,
        envois: 0,
        ignores: 0,
        html: gabarit(
          "Dernier jour de votre essai ArtiFlow-pro",
          "C'est aujourd'hui le dernier jour de votre essai. Voici ce qui se passe à partir de demain, pour Atelier Dupont.",
          corpsDernierJourEssai({ entreprise: "Atelier Dupont", offre: "Pro", montant: "59,00 €", date: frDate(demain) }),
        ),
        details: [],
      });
    }

    // Aperçu statique de l'email « J-1 avant la fin de l'essai » (relance préventive envoyée
    // la veille de la fin de l'essai) : rendu fidèle avec des données d'exemple, sans dépendre
    // d'un abonnement réel ni de la configuration Stripe/Resend. Alimente le bouton « Aperçu »
    // du back-office.
    if (body?.previewEssaiJ1 === true) {
      const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      return json({
        ok: true,
        configured: false,
        abonnements: 0,
        envois: 0,
        ignores: 0,
        html: gabarit(
          "Votre essai ArtiFlow-pro se termine demain",
          "Il ne reste qu'un jour d'essai avant le premier prélèvement, pour Atelier Dupont.",
          corpsEssaiJ1({ entreprise: "Atelier Dupont", offre: "Pro", montant: "59,00 €", date: frDate(demain) }),
        ),
        details: [],
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!supabaseUrl || !serviceKey || !stripeKey) {
      return json({ ok: false, error: "Les rappels de prélèvement ne sont pas encore configurés." }, 500);
    }

    const preview = body?.preview === true;
    const force = body?.force === true;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;

    const canSend = Boolean(cleEnvoiEmail() && domaineEnvoiEmail());

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Abonnements payés par carte Stripe et toujours actifs (y compris en essai :
    // le rappel J-3 prévient alors du tout premier prélèvement, à la fin de l'essai).
    let query = admin
      .from("abonnements")
      .select("id, artisan_id, entreprise, email, offre, statut, canal_paiement, stripe_customer_id, stripe_subscription_id, rappel_prelevement_charge, rappel_essai_fin, rappel_essai_j1")
      .in("statut", ["Actif", "Essai"])
      .not("stripe_customer_id", "is", null);
    if (scopeUserId) query = query.eq("artisan_id", scopeUserId);
    const { data: abos, error: aboError } = await query;
    if (aboError) return json({ ok: false, error: aboError.message }, 500);

    let envois = 0;
    let ignores = 0;
    let previewHtml: string | null = null;
    const details: Array<{ abonnementId: number; charge: string | null; jours: number | null; envoye: boolean; raison?: string }> = [];

    for (const raw of abos ?? []) {
      const abo = raw as Record<string, unknown>;
      const abonnementId = Number(abo.id);
      const customer = abo.stripe_customer_id ? String(abo.stripe_customer_id) : null;
      const subscription = abo.stripe_subscription_id ? String(abo.stripe_subscription_id) : null;
      const email = abo.email ? String(abo.email).trim() : null;
      if (!customer) {
        ignores += 1;
        details.push({ abonnementId, charge: null, jours: null, envoye: false, raison: "Aucun client Stripe." });
        continue;
      }

      // Prochain prélèvement côté Stripe.
      let charge: string | null = null;
      let montant = "";
      try {
        const params = new URLSearchParams();
        params.append("customer", customer);
        if (subscription) params.append("subscription", subscription);
        const res = await fetch(`https://api.stripe.com/v1/invoices/upcoming?${params.toString()}`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        const upcoming = (await res.json().catch(() => null)) as StripeInvoice | null;
        if (res.ok && upcoming) {
          charge = toDateISO(upcoming.next_payment_attempt ?? upcoming.period_end);
          montant = montantLabel(upcoming.amount_due ?? upcoming.amount_remaining, upcoming.currency);
        }
      } catch {
        /* on passe cet abonnement si Stripe ne répond pas */
      }

      // Aperçu : on renvoie le rendu de l'email sans rien envoyer, même si la
      // date du prochain prélèvement n'est pas encore connue de Stripe.
      if (preview) {
        const entrepriseApercu = abo.entreprise ? String(abo.entreprise) : "votre entreprise";
        const offreApercu = abo.offre ? String(abo.offre) : "Pro";
        previewHtml = gabarit(
          "Votre abonnement sera bientôt prélevé",
          "Petit rappel : votre abonnement ArtiFlow-pro arrive à échéance. Voici le récapitulatif du prochain prélèvement.",
          corpsRappel({
            entreprise: entrepriseApercu,
            offre: offreApercu,
            montant: montant || "Montant à venir",
            date: charge ? frDate(charge) : "date à venir",
          }),
        );
        details.push({
          abonnementId,
          charge,
          jours: charge ? joursAvant(charge) : null,
          envoye: false,
          raison: "Aperçu.",
        });
        continue;
      }

      if (!charge) {
        ignores += 1;
        details.push({ abonnementId, charge: null, jours: null, envoye: false, raison: "Date de prélèvement indisponible." });
        continue;
      }

      const jours = joursAvant(charge);
      const estEssai = String(abo.statut) === "Essai";
      // « Dernier jour d'essai » : l'essai se termine aujourd'hui (jours = 0), le tout
      // premier prélèvement ayant lieu demain. On accepte aussi jours < 0 pour rattraper
      // un passage manqué le jour même.
      const dernierJourEssai = estEssai && jours <= 0;
      // « J-1 avant la fin de l'essai » : la veille de la fin (jours = 1), en complément des
      // rappels J-3 et dernier jour, pour doubler la dernière chance de conversion.
      const avantDernierJourEssai = estEssai && jours === 1;
      const dejaRappel3 = abo.rappel_prelevement_charge
        ? String(abo.rappel_prelevement_charge).slice(0, 10) === charge
        : false;
      const dejaRappelEssai = abo.rappel_essai_fin ? String(abo.rappel_essai_fin).slice(0, 10) === charge : false;
      const dejaRappelEssaiJ1 = abo.rappel_essai_j1 ? String(abo.rappel_essai_j1).slice(0, 10) === charge : false;
      const dansFenetre3 = jours === 3;

      // On n'envoie que dans la fenêtre J-3, à J-1 ou le jour même de la fin d'essai (ou en test forcé).
      if (!force && !dansFenetre3 && !dernierJourEssai && !avantDernierJourEssai) {
        ignores += 1;
        details.push({ abonnementId, charge, jours, envoye: false, raison: `Hors fenêtre (J${jours >= 0 ? "-" : "+"}${Math.abs(jours)}).` });
        continue;
      }

      const entreprise = abo.entreprise ? String(abo.entreprise) : "votre entreprise";
      const offre = abo.offre ? String(abo.offre) : "Pro";

      // Cas 1 : dernier jour d'essai → email renforcé (bandeau dédié) pour maximiser la
      // conversion avant le tout premier prélèvement. Mémorisé à part pour ne pas doublonner.
      if (dernierJourEssai) {
        if (!force && dejaRappelEssai) {
          ignores += 1;
          details.push({ abonnementId, charge, jours, envoye: false, raison: "Rappel de fin d'essai déjà envoyé." });
          continue;
        }
        if (!canSend || !email) {
          ignores += 1;
          details.push({ abonnementId, charge, jours, envoye: false, raison: !email ? "Email manquant." : "Resend non configuré." });
          continue;
        }
        const htmlEssai = gabarit(
          "Dernier jour de votre essai ArtiFlow-pro",
          `C'est aujourd'hui le dernier jour de votre essai. Voici ce qui se passe à partir de demain, pour ${entreprise}.`,
          corpsDernierJourEssai({ entreprise, offre, montant: montant || "Montant à venir", date: frDate(charge) }),
        );
        const sujetEssai = `Dernier jour d'essai — votre offre ${offre} démarre demain`;
        const okEssai = await envoyerEmail({ to: email, sujet: sujetEssai, html: htmlEssai });
        if (okEssai) {
          await admin
            .from("abonnements")
            .update({ rappel_essai_fin: charge, updated_at: new Date().toISOString() })
            .eq("id", abonnementId);
          envois += 1;
          details.push({ abonnementId, charge, jours, envoye: true });
        } else {
          ignores += 1;
          details.push({ abonnementId, charge, jours, envoye: false, raison: "Refus de Resend." });
        }
        continue;
      }

      // Cas 1 bis : J-1 avant la fin de l'essai → email dédié (en complément du J-3 et du
      // dernier jour), mémorisé à part pour ne pas doublonner.
      if (avantDernierJourEssai) {
        if (!force && dejaRappelEssaiJ1) {
          ignores += 1;
          details.push({ abonnementId, charge, jours, envoye: false, raison: "Rappel J-1 d'essai déjà envoyé." });
          continue;
        }
        if (!canSend || !email) {
          ignores += 1;
          details.push({ abonnementId, charge, jours, envoye: false, raison: !email ? "Email manquant." : "Resend non configuré." });
          continue;
        }
        const htmlJ1 = gabarit(
          "Votre essai ArtiFlow-pro se termine demain",
          `Il ne reste qu'un jour d'essai avant le premier prélèvement de votre offre ${offre}, pour ${entreprise}.`,
          corpsEssaiJ1({ entreprise, offre, montant: montant || "Montant à venir", date: frDate(charge) }),
        );
        const sujetJ1 = `Votre essai ${offre} se termine demain — premier prélèvement dans 2 jours`;
        const okJ1 = await envoyerEmail({ to: email, sujet: sujetJ1, html: htmlJ1 });
        if (okJ1) {
          await admin
            .from("abonnements")
            .update({ rappel_essai_j1: charge, updated_at: new Date().toISOString() })
            .eq("id", abonnementId);
          envois += 1;
          details.push({ abonnementId, charge, jours, envoye: true });
        } else {
          ignores += 1;
          details.push({ abonnementId, charge, jours, envoye: false, raison: "Refus de Resend." });
        }
        continue;
      }

      // Cas 2 : rappel J-3 classique (jamais deux fois pour le même prélèvement).
      if (!force && dejaRappel3) {
        ignores += 1;
        details.push({ abonnementId, charge, jours, envoye: false, raison: "Rappel déjà envoyé pour ce prélèvement." });
        continue;
      }
      const html = gabarit(
        "Votre abonnement sera bientôt prélevé",
        "Petit rappel : votre abonnement ArtiFlow-pro arrive à échéance. Voici le récapitulatif du prochain prélèvement.",
        corpsRappel({ entreprise, offre, montant: montant || "Montant à venir", date: frDate(charge) }),
      );
      const sujet = `Prélèvement prévu dans 3 jours — abonnement ${offre}`;

      if (!canSend || !email) {
        ignores += 1;
        details.push({ abonnementId, charge, jours, envoye: false, raison: !email ? "Email manquant." : "Resend non configuré." });
        continue;
      }

      const ok = await envoyerEmail({ to: email, sujet, html });
      if (ok) {
        // On mémorise le prélèvement déjà annoncé pour ne pas relancer le même.
        await admin
          .from("abonnements")
          .update({ rappel_prelevement_charge: charge, updated_at: new Date().toISOString() })
          .eq("id", abonnementId);
        envois += 1;
        details.push({ abonnementId, charge, jours, envoye: true });
      } else {
        ignores += 1;
        details.push({ abonnementId, charge, jours, envoye: false, raison: "Refus de Resend." });
      }
    }

    return json({
      ok: true,
      configured: canSend,
      abonnements: (abos ?? []).length,
      envois,
      ignores,
      html: previewHtml ?? undefined,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
