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
 * refuse l'envoi ou ne répond pas. Chaque tentative est tracée pour la carte « Suivi des envois ».
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
  const brevoFrom = (Deno.env.get("BREVO_FROM_EMAIL") ?? "").trim() || "contact@artiflow-pro.fr";
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

/** Une automatisation rejouee en echec, telle que transmise par l'interface. */
interface EchecBlanc {
  /** Nom affiche de l'automatisation. */
  nom: string;
  /** Message d'erreur renvoye par le rejeu. */
  message: string;
}

/**
 * Envoie a l'artisan connecte un recapitulatif listant UNIQUEMENT les automatisations
 * qui ont echoue lors d'un rejeu global « test a blanc ». Sert de trace datee des rendus
 * restant a corriger avant publication. Le destinataire est TOUJOURS l'adresse de
 * l'artisan lui-meme (issue de son profil) : jamais un tiers. Reserve aux connectes.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const brevoKey = ""; // Resend est le canal principal : Brevo n'est plus sollicité.
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();

    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);
    if (!brevoKey && !(resendKey && fromDomain)) {
      return json(
        {
          ok: false,
          error:
            "L'envoi d'email n'est pas encore configuré. Renseignez la clé API Brevo (ou, à défaut, Resend) puis relancez le diagnostic.",
        },
        400,
      );
    }

    // Authentification obligatoire (l'outil reste interne a l'application).
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const payload = await req.json().catch(() => null);
    const brut = Array.isArray(payload?.echecs) ? payload.echecs : [];
    const echecs: EchecBlanc[] = brut
      .map((e: unknown) => {
        const o = (e ?? {}) as Record<string, unknown>;
        return {
          nom: String(o.nom ?? "").trim() || "Automatisation",
          message: String(o.message ?? "").trim(),
        };
      })
      .filter((e: EchecBlanc) => e.nom.length > 0);

    if (echecs.length === 0) {
      return json({ ok: false, error: "Aucune automatisation en échec à récapituler." }, 400);
    }
    const total = Number.isFinite(Number(payload?.total)) ? Number(payload.total) : echecs.length;
    const dateRejeu = String(payload?.dateRejeu ?? "").trim() || new Date().toISOString();

    // Client service-role : lecture du profil (nom d'emetteur + adresse de destination).
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null;

    let emetteurNom = "ArtiFlow-pro";
    let destinataire = String(user.email ?? "").trim();
    if (admin) {
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("entreprise, metier, email")
          .eq("id", user.id)
          .maybeSingle();
        const nom = (profile?.entreprise || profile?.metier || "").trim();
        if (nom) emetteurNom = nom;
        destinataire = String(profile?.email ?? "").trim() || destinataire;
      } catch {
        /* le nom d'emetteur n'est pas bloquant */
      }
    }

    if (!destinataire) {
      return json(
        { ok: false, error: "Aucune adresse email n'est renseignée sur votre profil : impossible d'envoyer le récap." },
        400,
      );
    }

    const lignes = echecs
      .map(
        (e) => `<li style="margin:0 0 12px;padding:12px 14px;background:#fef2f2;border:1px solid #fee2e2;border-radius:10px;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#b91c1c;">${escapeHtml(e.nom)}</p>
          ${
            e.message
              ? `<p style="margin:6px 0 0;font-size:12px;color:#7f1d1d;line-height:1.6;">${escapeHtml(e.message)}</p>`
              : ""
          }
        </li>`,
      )
      .join("");

    const subject = `Rejeux test à blanc — ${echecs.length} automatisation${echecs.length > 1 ? "s" : ""} en échec`;
    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Récap des rejeux test à blanc en échec</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:700;">
          ${echecs.length} échec${echecs.length > 1 ? "s" : ""} sur ${total} rejeu${total > 1 ? "x" : ""}
        </div>
        <p style="margin:16px 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Voici uniquement les automatisations dont le rejeu en test à blanc a échoué. Corrigez ces rendus
          avant de publier.
        </p>
        <ul style="margin:0;padding:0;list-style:none;">${lignes}</ul>
        <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">
          Récap généré le ${escapeHtml(new Date(dateRejeu).toLocaleString("fr-FR"))} et envoyé à ${escapeHtml(destinataire)}.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;

    const envoi = await envoyerEmailAvecRepli(
      "send-recap-echecs-blanc",
      { nom: emetteurNom, to: [destinataire], subject, html },
      admin,
    );
    if (!envoi.ok) {
      return json({ ok: false, error: envoi.error || "L'envoi du récap a échoué." }, 502);
    }

    return json({ ok: true, id: envoi.id ?? null, to: destinataire, fournisseur: envoi.fournisseur });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
