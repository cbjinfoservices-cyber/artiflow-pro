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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PieceJointe = { filename: string; content: string };

/**
 * Expédie un email en essayant Brevo, puis bascule automatiquement sur Resend si Brevo
 * refuse l'envoi ou ne répond pas. Les pièces jointes (page de garde, relevé, ZIP) suivent
 * dans les deux cas. Chaque tentative est tracée pour la carte « Suivi des envois ».
 */
async function envoyerEmailAvecRepli(
  fonction: string,
  opts: {
    nom: string;
    to: string[];
    cc?: string[];
    subject: string;
    html: string;
    attachments?: PieceJointe[];
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<{ ok: boolean; fournisseur: string; repli: boolean; error?: string }> {
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
          attachment: opts.attachments && opts.attachments.length
            ? opts.attachments.map((a) => ({ name: a.filename, content: a.content }))
            : undefined,
        }),
      });
      if (res.ok) {
        await tracer("brevo", "succes", false);
        return { ok: true, fournisseur: "brevo", repli: false };
      }
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      erreurBrevo = data?.message || `Brevo a refusé l'envoi (code ${res.status}).`;
      await tracer("brevo", "echec", false, erreurBrevo);
    } catch (e) {
      erreurBrevo = e instanceof Error ? e.message : "Brevo est injoignable.";
      await tracer("brevo", "echec", false, erreurBrevo);
    }
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
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (res.ok) {
        await tracer("resend", "succes", false);
        return { ok: true, fournisseur: "resend", repli: false };
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

  return { ok: false, fournisseur: "aucun", repli: false, error: "Aucun service d'envoi configuré (Resend non paramétré)." };
}

/**
 * Envoie au comptable la page de garde du « pack comptable » de l'abonnement, en
 * pièce jointe d'un email récapitulant le périmètre (filtres actifs, unité HT/TTC,
 * nombre de factures, total). Déclenché depuis le bloc « Factures » de Mon abonnement.
 * L'authentification et la clé Resend restent côté serveur.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const brevoKey = ""; // Resend est le canal principal : Brevo n'est plus sollicité.
    const repliConfigure = Boolean(Deno.env.get("RESEND_API_KEY") && Deno.env.get("RESEND_FROM_DOMAIN"));

    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);
    if (!brevoKey && !repliConfigure) {
      return json(
        { ok: false, error: "L'envoi d'email n'est pas encore configuré. Paramétrez Resend pour l'utiliser." },
        400,
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const payload = await req.json().catch(() => null);
    const to = String(payload?.to ?? "").trim();
    // Adresse secondaire mise en copie (Cc), mémorisée sur le profil de l'artisan.
    const cc = String(payload?.cc ?? "").trim();
    const pdfBase64 = typeof payload?.pdfBase64 === "string" ? payload.pdfBase64 : "";
    const filename =
      typeof payload?.filename === "string" && payload.filename ? payload.filename : "page-de-garde-pack-comptable.pdf";
    const zipBase64 = typeof payload?.zipBase64 === "string" ? payload.zipBase64 : "";
    const zipFilename =
      typeof payload?.zipFilename === "string" && payload.zipFilename ? payload.zipFilename : "pack-comptable-abonnement.zip";
    // Relevé des prélèvements seul (PDF), joint en plus du ZIP pour les comptables qui préfèrent les pièces séparées.
    const releveBase64 = typeof payload?.releveBase64 === "string" ? payload.releveBase64 : "";
    const releveFilename =
      typeof payload?.releveFilename === "string" && payload.releveFilename ? payload.releveFilename : "releve-prelevements-abonnement.pdf";
    const filtreLabel = String(payload?.filtreLabel ?? "Toutes les factures");
    const offre = typeof payload?.offre === "string" ? payload.offre.trim() : "";
    const mention = payload?.mention === "HT" ? "HT" : "TTC";
    const totalLabel = String(payload?.totalLabel ?? "—");
    const nombreFactures = Number.isFinite(Number(payload?.nombreFactures)) ? Math.max(0, Number(payload.nombreFactures)) : 0;
    const customMessage = typeof payload?.message === "string" ? payload.message.trim() : "";
    // Nature de l'envoi : « pack » (page de garde + relevé + ZIP) ou « releve » (relevé seul).
    const mode = payload?.mode === "releve" ? "releve" : "pack";
    // Mode aperçu : on construit l'email sans l'envoyer, pour valider avant d'expédier.
    const preview = payload?.preview === true;
    // Envoi de test : l'email part réellement, mais uniquement vers l'artisan lui-même
    // (adresse passée dans `to`), et n'est pas tracé comme un envoi au comptable.
    const test = payload?.test === true;

    if (!EMAIL_RE.test(to)) return json({ ok: false, error: "L'adresse du comptable est invalide." }, 400);
    if (cc && !EMAIL_RE.test(cc)) return json({ ok: false, error: "L'adresse en copie (Cc) est invalide." }, 400);
    if (!preview) {
      if (mode === "releve" && !releveBase64) {
        return json({ ok: false, error: "Le relevé des prélèvements à joindre est vide." }, 400);
      }
      if (mode === "pack" && !pdfBase64) {
        return json({ ok: false, error: "La page de garde à joindre est vide." }, 400);
      }
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: profile } = await admin
      .from("profiles")
      .select("entreprise, metier, telephone, email")
      .eq("id", user.id)
      .maybeSingle();

    const emetteurNom = String(profile?.entreprise || profile?.metier || "Votre artisan");
    const contactLine = [profile?.telephone, profile?.email]
      .filter(Boolean)
      .map((v) => escapeHtml(v))
      .join(" · ");

    const introTexte = customMessage
      ? escapeHtml(customMessage).replace(/\n/g, "<br>")
      : mode === "releve"
        ? `Veuillez trouver ci-joint le <strong>relevé des prélèvements</strong> de notre abonnement pour la période <strong>${escapeHtml(filtreLabel)}</strong>.`
        : `Veuillez trouver ci-joint le <strong>pack comptable de notre abonnement</strong> pour la période <strong>${escapeHtml(filtreLabel)}</strong> : page de garde, récapitulatif par exercice, relevé des prélèvements et export CSV.`;

    // Pièces jointes annoncées dans le corps, selon la nature de l'envoi (relevé seul ou pack complet).
    const nomsPieces = mode === "releve" ? [releveFilename] : [filename, releveFilename, zipFilename];
    const pieceJointeLabel = nomsPieces
      .map((n) => `<strong style="color:#18181b;">${escapeHtml(n)}</strong>`)
      .join(" + ");

    const subjectBase =
      mode === "releve"
        ? `Relevé des prélèvements de l'abonnement — ${filtreLabel}`
        : `Pack comptable de l'abonnement — ${filtreLabel}`;
    // Le test est balisé dans l'objet pour ne jamais le confondre avec un envoi réel.
    const subject = test ? `[Test] ${subjectBase}` : subjectBase;

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        ${contactLine ? `<p style="margin:6px 0 0;font-size:13px;color:#71717a;">${contactLine}</p>` : ""}
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">${introTexte}</p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Périmètre : <strong style="color:#18181b;">${escapeHtml(filtreLabel)}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Montants : <strong style="color:#18181b;">en ${escapeHtml(mention)}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Factures : <strong style="color:#18181b;">${nombreFactures}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Total ${escapeHtml(mention)} : <strong style="color:#18181b;">${escapeHtml(totalLabel)}</strong></p>
          <p style="margin:0;color:#71717a;">Pièce${nomsPieces.length > 1 ? "s" : ""} jointe${nomsPieces.length > 1 ? "s" : ""} : ${pieceJointeLabel}</p>
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Nous restons à votre disposition pour toute question. Merci de votre confiance.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.${offre ? ` Offre ${escapeHtml(offre)}.` : ""}
      </div>
    </div>
  </div>
</body></html>`;

    // Aperçu : on renvoie le rendu exact de l'email (corps + pièces annoncées) sans rien expédier.
    if (preview) {
      return json({ ok: true, preview: { subject, html, pieces: nomsPieces, destinataire: to, cc: cc || null } });
    }

    // Pièces réellement présentes, selon la nature de l'envoi.
    const attachments: { filename: string; content: string }[] = [];
    if (mode === "releve") {
      if (releveBase64) attachments.push({ filename: releveFilename, content: releveBase64 });
    } else {
      if (pdfBase64) attachments.push({ filename, content: pdfBase64 });
      if (releveBase64) attachments.push({ filename: releveFilename, content: releveBase64 });
      if (zipBase64) attachments.push({ filename: zipFilename, content: zipBase64 });
    }

    // Envoi Brevo d'abord, repli automatique sur Resend si Brevo refuse ou ne répond pas.
    const envoi = await envoyerEmailAvecRepli(
      "send-pack-comptable",
      { nom: emetteurNom, to: [to], cc: cc ? [cc] : undefined, subject, html, attachments },
      admin,
    );
    if (!envoi.ok) return json({ ok: false, error: envoi.error || "L'envoi de l'email a échoué." }, 502);

    // Chaque envoi est tracé : les envois de test sont marqués (est_test) pour être
    // clairement distingués des transmissions réelles au comptable dans l'historique.
    await admin.from("envois_email").insert({
      user_id: user.id,
      facture_id: null,
      devis_id: null,
      relance_id: null,
      type: "comptable",
      canal: "email",
      groupe: false,
      destinataire: to,
      sujet: subject,
      mode: "manuel",
      nb_lignes: nombreFactures,
      est_test: test,
      pieces:
        mode === "releve"
          ? "releve-prelevements (PDF seul)"
          : zipBase64
            ? "pack-comptable (page de garde + relevé + ZIP complet)"
            : "page-de-garde",
    });

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
