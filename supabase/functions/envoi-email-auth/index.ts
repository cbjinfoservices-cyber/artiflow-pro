import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { domaineEnvoiEmail, envoyerEmail } from "../_shared/envoiEmail.ts";

/**
 * « Send Email Hook » de Supabase Auth : les emails de connexion (confirmation d'inscription,
 * mot de passe oublié, lien de connexion, invitation, changement d'adresse, code de sécurité)
 * sont envoyés par cette fonction, via le service d'envoi de l'application (Brevo), plutôt que
 * par le service intégré de Supabase (réservé aux tests, quelques emails par heure).
 *
 * Appelée uniquement par Supabase Auth : la requête est signée (Standard Webhooks) avec le secret
 * SEND_EMAIL_HOOK_SECRET, partagé avec la configuration [auth.hook.send_email] de config.toml.
 */

type DonneesEmail = {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new?: string;
  token_hash_new?: string;
};

type Utilisateur = { email: string; new_email?: string; user_metadata?: Record<string, unknown> };

const ORANGE = "#ea580c";

function echapper(valeur: unknown): string {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lienVerification(tokenHash: string, type: string, redirection: string): string {
  const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const params = new URLSearchParams({ token: tokenHash, type, redirect_to: redirection });
  return `${base}/auth/v1/verify?${params}`;
}

/** Gabarit commun, dans le style des autres emails d'ArtiFlow-pro. */
function gabarit(opts: { titre: string; intro: string; bouton?: { libelle: string; lien: string }; code?: string; note: string }): string {
  const bouton = opts.bouton
    ? `<p style="margin:24px 0;text-align:center;">
          <a href="${echapper(opts.bouton.lien)}" style="display:inline-block;padding:14px 26px;border-radius:8px;background:${ORANGE};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${echapper(opts.bouton.libelle)}</a>
        </p>
        <p style="margin:0 0 4px;font-size:12px;color:#71717a;line-height:1.6;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
        <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${echapper(opts.bouton.lien)}" style="color:${ORANGE};">${echapper(opts.bouton.lien)}</a></p>`
    : "";
  const code = opts.code
    ? `<p style="margin:24px 0;text-align:center;font-size:28px;font-weight:700;letter-spacing:6px;color:#18181b;">${echapper(opts.code)}</p>`
    : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">ArtiFlow-pro</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">L'assistant des artisans du bâtiment</p>
      </div>
      <div style="padding:24px;">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">${echapper(opts.titre)}</h1>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#3f3f46;">${opts.intro}</p>
        ${bouton}${code}
        <p style="margin:20px 0 0;font-size:13px;color:#71717a;line-height:1.6;">${echapper(opts.note)}</p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email automatique envoyé par ArtiFlow-pro · artiflow-pro.com
      </div>
    </div>
  </div>
</body></html>`;
}

const NOTE_SECURITE = "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email : rien ne sera modifié.";

/** Sujet et contenu selon le type d'email demandé par Supabase Auth. */
function composer(type: string, lien: string, code: string, nouvelleAdresse?: string): { sujet: string; html: string } {
  switch (type) {
    case "signup":
      return {
        sujet: "Confirmez votre adresse email — ArtiFlow-pro",
        html: gabarit({
          titre: "Bienvenue sur ArtiFlow-pro",
          intro: "Il ne reste qu'une étape : confirmez votre adresse email pour activer votre compte et commencer votre essai.",
          bouton: { libelle: "Confirmer mon adresse", lien },
          note: "Ce lien est valable 24 heures. " + NOTE_SECURITE,
        }),
      };
    case "recovery":
      return {
        sujet: "Réinitialisez votre mot de passe — ArtiFlow-pro",
        html: gabarit({
          titre: "Choisissez un nouveau mot de passe",
          intro: "Vous avez demandé à réinitialiser le mot de passe de votre compte ArtiFlow-pro. Cliquez sur le bouton pour en choisir un nouveau.",
          bouton: { libelle: "Choisir un nouveau mot de passe", lien },
          note: "Ce lien est valable 1 heure. " + NOTE_SECURITE,
        }),
      };
    case "magiclink":
      return {
        sujet: "Votre lien de connexion — ArtiFlow-pro",
        html: gabarit({
          titre: "Connectez-vous en un clic",
          intro: "Voici votre lien de connexion à ArtiFlow-pro.",
          bouton: { libelle: "Me connecter", lien },
          code,
          note: "Vous pouvez aussi saisir le code ci-dessus. " + NOTE_SECURITE,
        }),
      };
    case "invite":
      return {
        sujet: "Vous êtes invité sur ArtiFlow-pro",
        html: gabarit({
          titre: "Vous êtes invité à rejoindre ArtiFlow-pro",
          intro: "Un compte ArtiFlow-pro a été créé pour vous. Cliquez sur le bouton pour l'activer.",
          bouton: { libelle: "Activer mon compte", lien },
          note: NOTE_SECURITE,
        }),
      };
    case "email_change":
      return {
        sujet: "Confirmez le changement d'adresse email — ArtiFlow-pro",
        html: gabarit({
          titre: "Confirmez votre nouvelle adresse",
          intro: `Vous avez demandé à utiliser <strong>${echapper(nouvelleAdresse ?? "")}</strong> pour votre compte ArtiFlow-pro. Confirmez ce changement.`,
          bouton: { libelle: "Confirmer le changement", lien },
          note: NOTE_SECURITE,
        }),
      };
    case "reauthentication":
      return {
        sujet: "Votre code de sécurité — ArtiFlow-pro",
        html: gabarit({
          titre: "Votre code de sécurité",
          intro: "Saisissez ce code dans ArtiFlow-pro pour confirmer l'opération en cours.",
          code,
          note: NOTE_SECURITE,
        }),
      };
    default:
      return {
        sujet: "Action requise sur votre compte — ArtiFlow-pro",
        html: gabarit({
          titre: "Confirmez l'opération",
          intro: "Une action sur votre compte ArtiFlow-pro demande votre confirmation.",
          bouton: { libelle: "Confirmer", lien },
          code,
          note: NOTE_SECURITE,
        }),
      };
  }
}

async function envoyer(to: string, sujet: string, html: string): Promise<void> {
  const domaine = domaineEnvoiEmail() ?? "artiflow-pro.com";
  const res = await envoyerEmail("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: `ArtiFlow-pro <noreply@${domaine}>`, to: [to], subject: sujet, html }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message || `Envoi refusé (code ${res.status}).`);
  }
}

function erreur(message: string, statut: number): Response {
  return new Response(JSON.stringify({ error: { http_code: statut, message } }), {
    status: statut,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return erreur("Méthode non autorisée.", 405);
  const secret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace(/^v1,whsec_/, "");
  if (!secret) return erreur("Secret du hook d'envoi manquant.", 500);

  const corps = await req.text();
  let user: Utilisateur;
  let email: DonneesEmail;
  try {
    ({ user, email_data: email } = new Webhook(secret).verify(corps, Object.fromEntries(req.headers)) as {
      user: Utilisateur;
      email_data: DonneesEmail;
    });
  } catch {
    return erreur("Signature invalide.", 401);
  }

  try {
    const type = email.email_action_type;
    if (type === "email_change" && user.new_email) {
      // Changement d'adresse sécurisé : un lien vers l'adresse actuelle (token_hash_new) et un vers
      // la nouvelle (token_hash), comme le prévoit Supabase Auth.
      if (email.token_hash_new) {
        const m = composer(type, lienVerification(email.token_hash_new, type, email.redirect_to), email.token_new ?? "", user.new_email);
        await envoyer(user.email, m.sujet, m.html);
      }
      const m = composer(type, lienVerification(email.token_hash, type, email.redirect_to), email.token, user.new_email);
      await envoyer(user.new_email, m.sujet, m.html);
    } else {
      const m = composer(type, lienVerification(email.token_hash, type, email.redirect_to), email.token);
      await envoyer(user.email, m.sujet, m.html);
    }
    return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return erreur(e instanceof Error ? e.message : "Envoi impossible.", 500);
  }
});
