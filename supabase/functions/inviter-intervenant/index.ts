import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

type EnvoiEmailOptions = {
  nom: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string }>;
};

type ResultatEnvoiEmail = {
  ok: boolean;
  fournisseur: "brevo" | "resend" | "aucun";
  repli: boolean;
  id?: string;
  error?: string;
};

/**
 * Expédie un email en essayant Brevo, puis bascule automatiquement sur Resend si Brevo
 * refuse l'envoi ou ne répond pas : une invitation ne doit jamais rester bloquée.
 */
async function envoyerEmailAvecRepli(
  fonction: string,
  opts: EnvoiEmailOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<ResultatEnvoiEmail> {
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
          sender: { name: opts.nom, email: brevoFrom },
          to: opts.to.map((email) => ({ email })),
          cc: opts.cc && opts.cc.length ? opts.cc.map((email) => ({ email })) : undefined,
          subject: opts.subject,
          htmlContent: opts.html,
          attachment:
            opts.attachments && opts.attachments.length
              ? opts.attachments.map((a) => ({ name: a.filename, content: a.content }))
              : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { messageId?: string; message?: string } | null;
      if (res.ok) {
        await tracer("brevo", "succes", false);
        return { ok: true, fournisseur: "brevo", repli: false, id: data?.messageId };
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
          from: `${opts.nom} <noreply@${fromDomain}>`,
          to: opts.to,
          cc: opts.cc && opts.cc.length ? opts.cc : undefined,
          subject: opts.subject,
          html: opts.html,
          attachments: opts.attachments && opts.attachments.length ? opts.attachments : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (res.ok) {
        await tracer("resend", "succes", false);
        return { ok: true, fournisseur: "resend", repli: true, id: data?.id };
      }
      const erreur = data?.message || `Resend a refusé l'envoi (code ${res.status}).`;
      await tracer("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    } catch (e) {
      const erreur = e instanceof Error ? e.message : "Resend est injoignable.";
      await tracer("resend", "echec", false, erreur);
      return { ok: false, fournisseur: "resend", repli: false, error: erreur };
    }
  }

  return {
    ok: false,
    fournisseur: "aucun",
    repli: true,
    error: "Aucun service d'envoi configuré (Resend non paramétré).",
  };
}

/** Validation minimale mais suffisante d'une adresse email. */
function emailValide(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const ALPHABET_CODE_INVITATION = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Durée de validité (en jours) d'un code d'invitation après chaque envoi. */
const DUREE_CODE_INVITATION_JOURS = 7;

/** Génère un code d'invitation court et lisible (8 caractères, sans caractères ambigus). */
function genererCodeInvitation(): string {
  const octets = new Uint8Array(8);
  crypto.getRandomValues(octets);
  let code = "";
  for (let i = 0; i < octets.length; i += 1) {
    code += ALPHABET_CODE_INVITATION[octets[i] % ALPHABET_CODE_INVITATION.length];
  }
  return code;
}

/**
 * Envoie a un intervenant une invitation par email contenant le lien de creation de
 * compte. Reserve aux utilisateurs connectes (le responsable de l'entreprise).
 * La configuration Resend (cle + domaine) est lue depuis les secrets du Backend.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const brevoKey = ""; // Resend est le canal principal : Brevo n'est plus sollicité.
    const brevoFrom = (Deno.env.get("BREVO_FROM_EMAIL") ?? "").trim() || "contact@artiflow-pro.com";
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();

    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);
    if (!brevoKey && !(resendKey && fromDomain)) {
      return json(
        {
          ok: false,
          error:
            "L'envoi d'email n'est pas encore configuré. Renseignez la clé API Brevo (ou, à défaut, Resend) puis réessayez.",
        },
        400,
      );
    }

    // Authentification obligatoire : seul un compte connecté peut envoyer une invitation.
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const payload = await req.json().catch(() => null);
    const nom = String(payload?.nom ?? "").trim() || "votre équipe";
    const to = String(payload?.email ?? "").trim().toLowerCase();
    const lien = String(payload?.lienInscription ?? "").trim();

    if (!emailValide(to)) {
      return json({ ok: false, error: "Renseignez une adresse email valide pour l'invitation." }, 400);
    }
    if (!lien) return json({ ok: false, error: "Le lien d'inscription est manquant." }, 400);

    // Client service-role reserve a la lecture du profil (nom d'emetteur).
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null;

    if (!admin) return json({ ok: false, error: "Configuration incomplète pour l'invitation." }, 500);

    let emetteurNom = "ArtiFlow-pro";
    try {
      const { data: profile } = await admin
        .from("profiles")
        .select("entreprise, metier")
        .eq("id", user.id)
        .maybeSingle();
      const candidat = String(profile?.entreprise || profile?.metier || "").trim();
      if (candidat) emetteurNom = candidat;
    } catch {
      /* le nom d'emetteur n'est pas bloquant */
    }

    // Le code d'invitation est propre à la fiche : il doit exister pour pouvoir être vérifié
    // lors d'un rattachement. On conserve le code déjà présent, sinon on en crée un nouveau.
    const { data: ficheRow } = await admin
      .from("intervenants")
      .select("id, code_invitation")
      .eq("compte_email", to)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!ficheRow) {
      return json(
        { ok: false, error: "Enregistrez d'abord la fiche de l'intervenant, puis envoyez l'invitation." },
        400,
      );
    }
    const ficheId = Number((ficheRow as { id?: unknown }).id);
    const codeExistant = (ficheRow as { code_invitation?: unknown }).code_invitation;
    const codeInvitation = codeExistant ? String(codeExistant) : genererCodeInvitation();

    // Le code est (re)validé à chaque envoi : il devient inutilisable après quelques jours,
    // ce qui limite l'exploitation d'un email égaré ou d'un code qui aurait fuité.
    const expireLe = new Date(Date.now() + DUREE_CODE_INVITATION_JOURS * 86_400_000);
    const expireIso = expireLe.toISOString();
    const expireLabel = expireLe.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const fromAddress = fromDomain
      ? `${emetteurNom} <noreply@${fromDomain}>`
      : `${emetteurNom} <${brevoFrom}>`;
    const subject = `${emetteurNom} vous invite à rejoindre son planning`;
    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Invitation à rejoindre le planning</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;">Bonjour ${escapeHtml(nom)},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
          ${escapeHtml(emetteurNom)} vous invite à accéder à votre planning d'interventions.
          Créez votre compte personnel pour consulter vos missions, signaler un imprévu et suivre
          ce qui vous est confié, où que vous soyez.
        </p>
        <p style="margin:0 0 24px;">
          <a href="${escapeHtml(lien)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#0f766e;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
            Créer mon compte
          </a>
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#71717a;line-height:1.6;">
          Utilisez bien l'adresse <strong>${escapeHtml(to)}</strong> lors de la création du compte :
          c'est elle qui relie votre compte à votre fiche dans le planning.
        </p>
        <div style="margin:0 0 16px;padding:14px 16px;border:1px dashed #d4d4d8;border-radius:10px;background:#fafafa;">
          <p style="margin:0 0 6px;font-size:12px;color:#71717a;">Votre code d'invitation personnel</p>
          <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:3px;color:#18181b;">${escapeHtml(codeInvitation)}</p>
          <p style="margin:8px 0 0;font-size:12px;color:#71717a;line-height:1.6;">
            Si votre planning ne s'affiche pas automatiquement après connexion, ouvrez « Rattacher mon compte »
            et saisissez ce code : il relie votre compte à votre fiche.
          </p>
          <p style="margin:8px 0 0;font-size:12px;color:#b45309;line-height:1.6;">
            Ce code est valable jusqu'au <strong>${escapeHtml(expireLabel)}</strong>.
          </p>
        </div>
        <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">
          Si vous n'êtes pas concerné, vous pouvez ignorer cet email.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Invitation envoyée via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;

    const envoi = await envoyerEmailAvecRepli(
      "inviter-intervenant",
      { nom: emetteurNom, to: [to], subject, html },
      admin,
    );
    if (!envoi.ok) {
      return json({ ok: false, error: envoi.error || "L'envoi de l'invitation a échoué." }, 502);
    }

    // Trace du dernier envoi + conservation du code d'invitation sur la fiche.
    const invitationEnvoyeeLe: string | null = new Date().toISOString();
    try {
      await admin
        .from("intervenants")
        .update({
          invitation_envoyee_le: invitationEnvoyeeLe,
          code_invitation: codeInvitation,
          code_invitation_expire_le: expireIso,
        })
        .eq("id", ficheId)
        .eq("user_id", user.id);
    } catch {
      /* la trace n'est pas bloquante : l'invitation est bien partie */
    }

    return json({
      ok: true,
      id: envoi.id ?? null,
      to,
      fromAddress,
      fournisseur: envoi.fournisseur,
      invitationEnvoyeeLe,
      code: codeInvitation,
      expire: expireIso,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
