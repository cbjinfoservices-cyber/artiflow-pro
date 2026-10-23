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
 * refuse l'envoi ou ne répond pas. Le repli évite de perdre une relance, une facture ou
 * un récapitulatif. Chaque tentative est tracée pour la carte « Suivi des envois ».
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

  // Resend est le canal principal : Brevo n'est plus sollicité (plus de validation d'expéditeur).
  const brevoKey = "";
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
        return { ok: true, fournisseur: "resend", repli: false, id: data?.id };
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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function euros(value: unknown): string {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function applyTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => values[key.toLowerCase()] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    const repliConfigure = Boolean(Deno.env.get("RESEND_API_KEY") && Deno.env.get("RESEND_FROM_DOMAIN"));

    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);
    if (!brevoKey && !repliConfigure) {
      return json(
        {
          ok: false,
          error: "L'envoi d'email n'est pas encore configuré. Paramétrez Resend pour l'utiliser.",
        },
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
    const devisId = Number(payload?.devisId);
    const signUrl = String(payload?.signUrl ?? "").trim();
    if (!devisId) return json({ ok: false, error: "Devis introuvable." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: devis, error: devisError } = await admin
      .from("devis")
      .select("id, user_id, client_id, numero, objet, statut, total_ht, total_ttc, created_at")
      .eq("id", devisId)
      .maybeSingle();
    if (devisError) return json({ ok: false, error: devisError.message }, 500);
    if (!devis || devis.user_id !== user.id) return json({ ok: false, error: "Devis introuvable." }, 404);

    const [clientRes, profileRes, lignesRes] = await Promise.all([
      devis.client_id
        ? admin.from("clients").select("nom, email").eq("id", devis.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("profiles")
        .select("entreprise, metier, telephone, email, email_sujet_devis, email_corps_devis, logo_url, doc_couleur, doc_afficher_logo, doc_pied_page")
        .eq("id", devis.user_id)
        .maybeSingle(),
      admin
        .from("lignes_devis")
        .select("designation, unite, quantite, prix_unitaire")
        .eq("devis_id", devis.id)
        .order("id", { ascending: true }),
    ]);

    const client = clientRes.data as { nom?: string; email?: string } | null;
    const profile = profileRes.data as
      | {
          entreprise?: string;
          metier?: string;
          telephone?: string;
          email?: string;
          email_sujet_devis?: string | null;
          email_corps_devis?: string | null;
          logo_url?: string | null;
          doc_couleur?: string | null;
          doc_afficher_logo?: boolean | null;
          doc_pied_page?: string | null;
        }
      | null;
    if (!client?.email) {
      return json({ ok: false, error: "Ce client n'a pas d'adresse email. Ajoutez-la dans sa fiche." }, 400);
    }

    const emetteurNom = profile?.entreprise || profile?.metier || "Votre artisan";
    // Identité visuelle : couleur d'accent + logo repris du profil, pour un rendu cohérent avec les documents.
    const accent = /^#[0-9a-fA-F]{6}$/.test(String(profile?.doc_couleur ?? "")) ? String(profile?.doc_couleur) : "#C4783A";
    const logoUrl = profile?.doc_afficher_logo !== false ? String(profile?.logo_url ?? "") : "";
    const logoHtml = logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(emetteurNom)}" style="max-height:48px;max-width:180px;display:block;margin:0 0 12px;">`
      : "";
    const piedDePage = String(profile?.doc_pied_page ?? "").trim();
    const piedHtml = piedDePage
      ? `<p style="margin:8px 0 0;font-size:11px;color:#a1a1aa;">${escapeHtml(piedDePage).replace(/\n/g, "<br>")}</p>`
      : "";
    const lignes = (lignesRes.data ?? []) as Array<Record<string, unknown>>;

    const lignesHtml = lignes
      .map(
        (l) =>
          `<tr><td style="padding:8px 10px;border-bottom:1px solid #eee;">${escapeHtml(
            l.designation,
          )}</td><td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${escapeHtml(
            l.quantite,
          )} ${escapeHtml(l.unite ?? "")}</td><td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${euros(
            l.prix_unitaire,
          )}</td></tr>`,
      )
      .join("");

    const contactLine = [profile?.telephone, profile?.email].filter(Boolean).map((v) => escapeHtml(v)).join(" · ");

    const templateValues: Record<string, string> = {
      client: client.nom ?? "",
      entreprise: emetteurNom,
      numero: devis.numero ?? "",
      objet: devis.objet ?? "",
      montant: euros(devis.total_ttc),
      lien: signUrl,
    };

    const customSubject = String(profile?.email_sujet_devis ?? "").trim();
    const subject = customSubject
      ? applyTemplate(customSubject, templateValues)
      : `Votre devis ${devis.numero}${devis.objet ? ` · ${devis.objet}` : ""}`;

    const customBody = String(profile?.email_corps_devis ?? "").trim();
    const introHtml = customBody
      ? escapeHtml(applyTemplate(customBody, templateValues)).replace(/\n/g, "<br>")
      : `Veuillez trouver ci-dessous votre devis <strong>${escapeHtml(devis.numero)}</strong>${
          devis.objet ? ` concernant « ${escapeHtml(devis.objet)} »` : ""
        }. Vous pouvez le consulter et le signer directement en ligne.`;

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="height:6px;background:${accent};"></div>
      <div style="padding:24px;border-bottom:1px solid #eee;">
        ${logoHtml}
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        ${contactLine ? `<p style="margin:6px 0 0;font-size:13px;color:#71717a;">${contactLine}</p>` : ""}
      </div>
      <div style="padding:24px;">
        ${
          customBody
            ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">${introHtml}</p>`
            : `<p style="margin:0 0 12px;font-size:15px;">Bonjour ${escapeHtml(client.nom ?? "")},</p>
               <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">${introHtml}</p>`
        }
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 16px;">
          <thead><tr>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e5e5;text-align:left;color:#71717a;font-weight:600;">Désignation</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e5e5;text-align:right;color:#71717a;font-weight:600;">Qté</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e5e5;text-align:right;color:#71717a;font-weight:600;">P.U.</th>
          </tr></thead>
          <tbody>${lignesHtml}</tbody>
        </table>
        <div style="text-align:right;font-size:14px;margin:0 0 20px;">
          <p style="margin:0;color:#71717a;">Total HT : <strong style="color:#18181b;">${euros(devis.total_ht)}</strong></p>
          <p style="margin:4px 0 0;color:#71717a;">Total TTC : <strong style="color:#18181b;">${euros(devis.total_ttc)}</strong></p>
        </div>
        ${
          signUrl
            ? `<div style="text-align:center;margin:24px 0;">
                 <a href="${escapeHtml(signUrl)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:8px;font-size:14px;font-weight:600;">Consulter et signer le devis</a>
               </div>
               <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;word-break:break-all;">Ou copiez ce lien : ${escapeHtml(
                 signUrl,
               )}</p>`
            : ""
        }
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        <p style="margin:0;">Email envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.</p>
        ${piedHtml}
      </div>
    </div>
  </div>
</body></html>`;

    const envoi = await envoyerEmailAvecRepli(
      "send-devis-email",
      { nom: emetteurNom, to: [client.email], subject, html },
      admin,
    );
    if (!envoi.ok) return json({ ok: false, error: envoi.error || "L'envoi de l'email a échoué." }, 502);

    if (devis.statut !== "Signé") {
      await admin.from("devis").update({ statut: "Envoyé" }).eq("id", devis.id);
    }
    await admin.from("envois_email").insert({
      user_id: user.id,
      devis_id: devis.id,
      type: "devis",
      mode: "reel",
      destinataire: client.email,
      sujet: subject,
    });

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
