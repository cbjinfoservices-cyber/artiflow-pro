import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleEnvoiEmail, domaineEnvoiEmail } from "../_shared/envoiEmail.ts";

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
  const brevoKey = (Deno.env.get("BREVO_API_KEY") ?? "").trim();
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

function frDate(value: unknown): string {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
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
    const repliConfigure = Boolean(cleEnvoiEmail() && domaineEnvoiEmail());

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
    const factureId = Number(payload?.factureId);
    const pdfBase64 = typeof payload?.pdfBase64 === "string" ? payload.pdfBase64 : "";
    const filename = typeof payload?.filename === "string" && payload.filename ? payload.filename : "facture.pdf";
    // Mode « relance » : même email que l'envoi de facture, mais avec un objet et un texte
    // de rappel, et une trace dans l'historique des relances de factures.
    const relance = payload?.relance === true;
    if (!factureId) return json({ ok: false, error: "Facture introuvable." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: facture, error: factureError } = await admin
      .from("factures")
      .select("id, user_id, devis_id, client_id, numero, statut, total_ht, total_ttc, date_emission, date_echeance")
      .eq("id", factureId)
      .maybeSingle();
    if (factureError) return json({ ok: false, error: factureError.message }, 500);
    if (!facture || facture.user_id !== user.id) return json({ ok: false, error: "Facture introuvable." }, 404);

    const [clientRes, profileRes, devisRes] = await Promise.all([
      facture.client_id
        ? admin.from("clients").select("nom, email").eq("id", facture.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("profiles")
        .select("entreprise, metier, telephone, email, email_sujet_facture, email_corps_facture, email_sujet_relance, logo_url, doc_couleur, doc_afficher_logo, doc_pied_page")
        .eq("id", facture.user_id)
        .maybeSingle(),
      facture.devis_id
        ? admin.from("devis").select("numero, objet").eq("id", facture.devis_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const client = clientRes.data as { nom?: string; email?: string } | null;
    const profile = profileRes.data as
      | {
          entreprise?: string;
          metier?: string;
          telephone?: string;
          email?: string;
          email_sujet_facture?: string | null;
          email_corps_facture?: string | null;
          email_sujet_relance?: string | null;
          logo_url?: string | null;
          doc_couleur?: string | null;
          doc_afficher_logo?: boolean | null;
          doc_pied_page?: string | null;
        }
      | null;
    const devis = devisRes.data as { numero?: string; objet?: string } | null;
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
    const contactLine = [profile?.telephone, profile?.email].filter(Boolean).map((v) => escapeHtml(v)).join(" · ");

    const templateValues: Record<string, string> = {
      client: client.nom ?? "",
      entreprise: emetteurNom,
      numero: facture.numero ?? "",
      objet: devis?.objet ?? "",
      montant: euros(facture.total_ttc),
      echeance: frDate(facture.date_echeance),
    };

    const customSubject = String(
      (relance ? profile?.email_sujet_relance : profile?.email_sujet_facture) ?? "",
    ).trim();
    const subject = customSubject
      ? applyTemplate(customSubject, templateValues)
      : relance
        ? `Rappel : facture ${facture.numero} en attente de règlement`
        : `Votre facture ${facture.numero}`;

    // Nombre de jours entiers écoulés depuis l'échéance (0 si elle n'est pas dépassée).
    const echeanceMs = facture.date_echeance ? new Date(String(facture.date_echeance)).getTime() : NaN;
    const joursRetard = Number.isFinite(echeanceMs)
      ? Math.max(0, Math.floor((Date.now() - echeanceMs) / 86400000))
      : 0;

    const customBody = relance ? "" : String(profile?.email_corps_facture ?? "").trim();
    const introHtml = relance
      ? `Nous vous rappelons que la facture <strong>${escapeHtml(facture.numero)}</strong> d'un montant de <strong>${euros(
          facture.total_ttc,
        )}</strong> reste en attente de règlement (échéance du ${frDate(facture.date_echeance)}${
          joursRetard > 0 ? `, soit ${joursRetard} jour${joursRetard > 1 ? "s" : ""} de retard` : ""
        }). Vous trouverez la facture en pièce jointe de cet email.`
      : customBody
        ? escapeHtml(applyTemplate(customBody, templateValues)).replace(/\n/g, "<br>")
        : `Veuillez trouver ci-joint votre facture <strong>${escapeHtml(facture.numero)}</strong>${
            devis?.objet ? ` au titre de « ${escapeHtml(devis.objet)} »` : ""
          }. Le document PDF est en pièce jointe de cet email.`;

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
        <div style="background:#fafafa;border:1px solid #eee;border-left:4px solid ${accent};border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Numéro : <strong style="color:#18181b;">${escapeHtml(facture.numero)}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Émise le : <strong style="color:#18181b;">${frDate(facture.date_emission)}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Échéance : <strong style="color:#18181b;">${frDate(facture.date_echeance)}</strong></p>
          <p style="margin:0;color:#71717a;">Montant total TTC : <strong style="color:#18181b;">${euros(facture.total_ttc)}</strong></p>
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Nous restons à votre disposition pour toute question. Merci de votre confiance.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        <p style="margin:0;">Email envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.</p>
        ${piedHtml}
      </div>
    </div>
  </div>
</body></html>`;

    const envoi = await envoyerEmailAvecRepli(
      "send-facture-email",
      {
        nom: emetteurNom,
        to: [client.email],
        subject,
        html,
        attachments: pdfBase64 ? [{ filename, content: pdfBase64 }] : undefined,
      },
      admin,
    );
    if (!envoi.ok) return json({ ok: false, error: envoi.error || "L'envoi de l'email a échoué." }, 502);

    await admin.from("envois_email").insert({
      user_id: user.id,
      facture_id: facture.id,
      devis_id: facture.devis_id ?? null,
      type: relance ? "relance" : "facture",
      mode: "reel",
      destinataire: client.email,
      sujet: subject,
    });

    // Trace dédiée : alimente l'historique des relances de factures et le garde-fou
    // anti-doublon (une facture relancée récemment est ignorée par les relances groupées).
    if (relance) {
      await admin.from("relance_facture_envois").insert({
        user_id: user.id,
        facture_id: facture.id,
        client_id: facture.client_id ?? null,
        client_nom: client.nom || "Client",
        numero: facture.numero ?? "",
        montant: Number(facture.total_ttc ?? 0),
        jours_retard: joursRetard,
        palier: 0,
        auto: false,
      });
    }

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
