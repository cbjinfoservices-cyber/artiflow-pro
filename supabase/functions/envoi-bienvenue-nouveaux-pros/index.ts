import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fonction « Email de bienvenue aux nouveaux pros ».
// Prévue pour tourner SANS session utilisateur : appelée par une tâche planifiée
// (voir le guide de configuration des tâches planifiées), idéalement toutes les heures.
//
// Elle repère les pros inscrits récemment (par défaut les 7 derniers jours) qui n'ont
// pas encore reçu d'email de bienvenue, leur envoie le message de bienvenue via Resend,
// puis mémorise l'envoi (colonne abonnements.bienvenue_envoyee_le) pour ne JAMAIS
// envoyer deux fois le même accueil.
//
// Paramètres optionnels (POST) :
//   - { preview: true }  → renvoie le HTML de l'email sans rien envoyer (aperçu)
//   - { jours: 30 }      → élargit la fenêtre de recherche des inscriptions (1 à 90 jours)

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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Montant mensuel formaté en euros, ou chaîne vide si l'offre est gratuite / non renseignée. */
function montantLabel(montant: number): string {
  if (!Number.isFinite(montant) || montant <= 0) return "";
  try {
    return ` (${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(montant)} / mois)`;
  } catch {
    return ` (${montant.toFixed(2)} € / mois)`;
  }
}

/** Corps HTML du message de bienvenue, personnalisé avec l'entreprise et son offre. */
function corpsBienvenue(entreprise: string, offre: string, montant: number): string {
  const montantTxt = montantLabel(montant);
  return `
    <div style="background:#eef7f3;border:1px solid #cfe8dd;border-radius:10px;padding:14px 16px;margin:0 0 18px;">
      <p style="margin:0;font-size:13px;font-weight:bold;color:#0f6b58;">Bienvenue chez ArtiFlow-pro</p>
    </div>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#3c3c38;">
      Bonjour l'équipe de ${escapeHtml(entreprise)},
    </p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#3c3c38;">
      Nous sommes ravis de compter <strong>${escapeHtml(entreprise)}</strong> parmi nos pros inscrits.
      Votre compte est actif avec l'offre <strong>${escapeHtml(offre)}</strong>${escapeHtml(montantTxt)}.
    </p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#3c3c38;">
      Tout est prêt pour créer vos devis, vos factures et suivre vos chantiers en quelques clics.
    </p>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#3c3c38;">
      Si vous avez la moindre question, répondez simplement à cet email : nous vous répondons rapidement.
    </p>
    <p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:#3c3c38;">
      Bon démarrage,<br>L'équipe ArtiFlow-pro
    </p>`;
}

/** Gabarit HTML complet de l'email de bienvenue. */
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
        Cet email vous est envoyé automatiquement par ArtiFlow-pro à l'ouverture de votre compte.
      </p>
    </div>
  </body>
</html>`;
}

interface EmailParams {
  to: string;
  sujet: string;
  html: string;
}

/**
 * Expédie un email en essayant Brevo, puis bascule automatiquement sur Resend si Brevo
 * refuse l'envoi ou ne répond pas : un accueil ne doit jamais être perdu.
 * Chaque tentative est tracée pour la carte « Suivi des envois ».
 */
async function envoyerEmail(
  fonction: string,
  params: EmailParams,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<{ ok: boolean; fournisseur: string; error?: string }> {
  const tracer = async (fournisseur: string, statut: string, repli: boolean, message?: string) => {
    if (!admin) return;
    try {
      await admin
        .from("envoi_fournisseur_historique")
        .insert({ fonction, fournisseur, statut, repli, message: message ?? null });
    } catch {
      /* la trace ne doit jamais bloquer un envoi */
    }
  };

  const brevoKey = ""; // Resend est le canal principal : Brevo n'est plus sollicité.
  const brevoFrom = (Deno.env.get("BREVO_FROM_EMAIL") ?? "").trim() || "contact@artiflow-pro.com";
  let erreurBrevo = "";

  if (brevoKey) {
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": brevoKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: "ArtiFlow-pro", email: brevoFrom },
          to: [{ email: params.to }],
          subject: params.sujet,
          htmlContent: params.html,
        }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (res.ok) {
        await tracer("brevo", "succes", false);
        return { ok: true, fournisseur: "brevo" };
      }
      erreurBrevo = data?.message || `Brevo a refusé l'envoi (code ${res.status}).`;
      await tracer("brevo", "echec", false, erreurBrevo);
    } catch (e) {
      erreurBrevo = e instanceof Error ? e.message : "Brevo est injoignable.";
      await tracer("brevo", "echec", false, erreurBrevo);
    }
  } else {
    erreurBrevo = "Clé API Brevo absente.";
  }

  const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();

  if (resendKey && fromDomain) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `ArtiFlow-pro <noreply@${fromDomain}>`,
          to: [params.to],
          subject: params.sujet,
          html: params.html,
        }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (res.ok) {
        await tracer("resend", "succes", false);
        return { ok: true, fournisseur: "resend" };
      }
      const erreur = data?.message || `Resend a refusé l'envoi (code ${res.status}).`;
      await tracer("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", error: erreur };
    } catch (e) {
      const erreur = e instanceof Error ? e.message : "Resend est injoignable.";
      await tracer("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", error: erreur };
    }
  }

  return { ok: false, fournisseur: "aucun", error: "Aucun service d'envoi configuré (Resend non paramétré)." };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;

    // Aperçu statique : rendu fidèle du message de bienvenue, sans dépendre d'une
    // inscription réelle ni de la configuration email.
    if (body?.preview === true) {
      return json({
        ok: true,
        configured: false,
        examines: 0,
        envois: 0,
        html: gabarit(
          "Bienvenue chez ArtiFlow-pro !",
          "Nous sommes ravis de compter Atelier Dupont parmi nos pros inscrits.",
          corpsBienvenue("Atelier Dupont", "Pro", 59),
        ),
        details: [],
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: "L'envoi de bienvenue n'est pas encore configuré." }, 500);
    }

    const brevoKey = ""; // Resend est le canal principal : Brevo n'est plus sollicité.
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN");
    const canSend = Boolean(brevoKey || (resendKey && fromDomain));

    const joursBruts = Number(body?.jours);
    const jours = Number.isFinite(joursBruts) ? Math.min(90, Math.max(1, Math.round(joursBruts))) : 7;
    const seuil = new Date(Date.now() - jours * 86400000).toISOString();

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Pros inscrits récemment, pas encore accueillis, avec une adresse email exploitable.
    const { data: abos, error: aboError } = await admin
      .from("abonnements")
      .select("id, entreprise, email, offre, montant_mensuel, statut, created_at, bienvenue_envoyee_le")
      .is("bienvenue_envoyee_le", null)
      .not("email", "is", null)
      .gte("created_at", seuil)
      .order("created_at", { ascending: true });
    if (aboError) return json({ ok: false, error: aboError.message }, 500);

    let envois = 0;
    const details: Array<{ abonnementId: number; email: string | null; envoye: boolean; raison?: string }> = [];

    for (const raw of abos ?? []) {
      const abo = raw as Record<string, unknown>;
      const abonnementId = Number(abo.id);
      const email = abo.email ? String(abo.email).trim() : null;
      const entreprise = abo.entreprise ? String(abo.entreprise) : "votre entreprise";
      const offre = abo.offre ? String(abo.offre) : "Pro";
      const montant = Number(abo.montant_mensuel) || 0;

      if (!email || !EMAIL_RE.test(email)) {
        details.push({ abonnementId, email, envoye: false, raison: "Adresse email absente ou invalide." });
        continue;
      }

      const html = gabarit(
        "Bienvenue chez ArtiFlow-pro !",
        `Nous sommes ravis de compter ${entreprise} parmi nos pros inscrits.`,
        corpsBienvenue(entreprise, offre, montant),
      );
      const sujet = `Bienvenue chez ArtiFlow-pro, ${entreprise} !`;

      if (!canSend) {
        details.push({ abonnementId, email, envoye: false, raison: "Envoi d'emails non configuré." });
        continue;
      }

      const envoi = await envoyerEmail("envoi-bienvenue-nouveaux-pros", { to: email, sujet, html }, admin);
      if (envoi.ok) {
        // Mémorise l'accueil pour ne jamais renvoyer le même message à ce pro.
        await admin
          .from("abonnements")
          .update({ bienvenue_envoyee_le: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", abonnementId);
        envois += 1;
        details.push({ abonnementId, email, envoye: true });
      } else {
        details.push({ abonnementId, email, envoye: false, raison: envoi.error || "Envoi impossible." });
      }
    }

    return json({
      ok: true,
      configured: canSend,
      examines: (abos ?? []).length,
      envois,
      fenetreJours: jours,
      details,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
