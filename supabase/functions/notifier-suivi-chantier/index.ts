import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleEnvoiEmail, domaineEnvoiEmail, envoyerEmail } from "../_shared/envoiEmail.ts";

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

function euros(value: unknown): string {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function dateFr(value: unknown): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function statutLabel(statut: unknown): string {
  const s = String(statut ?? "");
  const map: Record<string, string> = {
    a_venir: "Planifié",
    "a venir": "Planifié",
    planifie: "Planifié",
    "en cours": "En cours",
    en_cours: "En cours",
    termine: "Terminé",
  };
  return map[s.toLowerCase()] ?? (s || "En cours");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const payload = await req.json().catch(() => null);
    const chantierId = Number(payload?.chantierId);
    const motif = String(payload?.motif ?? "").trim();
    const lien = String(payload?.lien ?? "").trim();
    const origineBrute = String(payload?.origine ?? "manuel").trim();
    const origine = origineBrute === "groupe" || origineBrute === "auto" ? origineBrute : "manuel";
    if (!chantierId) return json({ ok: false, error: "Chantier introuvable." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    /** Trace chaque tentative d'envoi : qui, quand, quel motif, succès ou échec. */
    const journaliser = async (
      statut: "envoye" | "echec",
      destinataire: string,
      texte: string,
      erreur?: string,
      archive?: { sujet: string; html: string },
    ) => {
      try {
        await admin.from("suivi_notifications").insert({
          user_id: user.id,
          chantier_id: chantierId,
          destinataire: destinataire || null,
          motif: texte || null,
          statut,
          erreur: erreur ?? null,
          sujet: archive?.sujet ?? null,
          html: archive?.html ?? null,
          origine,
        });
      } catch {
        /* la trace ne doit jamais bloquer l'envoi */
      }
    };

    const { data: chantier } = await admin
      .from("chantiers")
      .select("id, user_id, client_id, libelle, adresse, statut, date_debut, montant, message_client, suivi_token, suivi_actif")
      .eq("id", chantierId)
      .maybeSingle();
    if (!chantier || chantier.user_id !== user.id) return json({ ok: false, error: "Chantier introuvable." }, 404);
    if (!chantier.suivi_actif) {
      await journaliser("echec", "", motif, "Le partage du suivi est désactivé pour ce chantier.");
      return json({ ok: false, error: "Le partage du suivi est désactivé pour ce chantier." }, 400);
    }

    const [clientRes, profileRes, etapesRes] = await Promise.all([
      chantier.client_id
        ? admin.from("clients").select("nom, email").eq("id", chantier.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("profiles")
        .select("entreprise, metier, telephone, email, logo_url, doc_couleur, doc_afficher_logo, doc_pied_page")
        .eq("id", chantier.user_id)
        .maybeSingle(),
      admin
        .from("etapes_chantier")
        .select("id, libelle, fait, visible_client")
        .eq("chantier_id", chantier.id)
        .eq("visible_client", true)
        .order("id", { ascending: true }),
    ]);

    const client = (clientRes.data ?? null) as { nom?: string; email?: string } | null;
    const profile = (profileRes.data ?? null) as Record<string, unknown> | null;
    if (!client?.email) {
      await journaliser("echec", "", motif, "Ce client n'a pas d'adresse email dans sa fiche.");
      return json({ ok: false, error: "Ce client n'a pas d'adresse email. Ajoutez-la dans sa fiche." }, 400);
    }

    const etapes = (etapesRes.data ?? []) as Array<Record<string, unknown>>;
    const faites = etapes.filter((e) => e.fait).length;
    const progression = etapes.length === 0 ? 0 : Math.round((faites / etapes.length) * 100);
    const emetteur = String(profile?.entreprise ?? "").trim() || "Votre artisan";
    const accent = /^#[0-9a-fA-F]{6}$/.test(String(profile?.doc_couleur ?? "")) ? String(profile?.doc_couleur) : "#C4783A";
    const logo = profile?.doc_afficher_logo === false ? "" : String(profile?.logo_url ?? "").trim();
    const pied = String(profile?.doc_pied_page ?? "").trim();
    const message = String(chantier.message_client ?? "").trim();
    const lienSuivi = lien || "";

    const etapesHtml = etapes
      .map((e) => {
        const ok = Boolean(e.fait);
        return `<tr>
          <td style="padding:7px 0;width:24px;vertical-align:top;"><span style="display:inline-block;width:16px;height:16px;line-height:16px;border-radius:50%;text-align:center;font-size:11px;background:${
            ok ? accent : "#e4e4e7"
          };color:${ok ? "#ffffff" : "#a1a1aa"};">${ok ? "&#10003;" : ""}</span></td>
          <td style="padding:7px 0;font-size:13px;color:${ok ? "#71717a" : "#3f3f46"};${
            ok ? "text-decoration:line-through;" : ""
          }">${escapeHtml(e.libelle)}</td>
        </tr>`;
      })
      .join("");

    const subject = `Suivi de chantier · ${String(chantier.libelle ?? "Votre chantier")}${progression ? ` — ${progression} %` : ""}`;

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="height:6px;background:${accent};"></div>
      <div style="padding:24px 24px 18px;border-bottom:1px solid #eee;">
        ${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(emetteur)}" style="max-height:44px;max-width:170px;display:block;margin:0 0 10px;">` : ""}
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(emetteur)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#71717a;">Suivi de votre chantier</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 6px;font-size:15px;">Bonjour ${escapeHtml(client.nom ?? "")},</p>
        <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:#3f3f46;">
          ${motif ? escapeHtml(motif) : "Le suivi de votre chantier vient d'être mis à jour."}
        </p>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Voici où en est <strong>${escapeHtml(chantier.libelle ?? "votre chantier")}</strong>${
            chantier.adresse ? ` (${escapeHtml(chantier.adresse)})` : ""
          }.
        </p>

        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:14px 16px;margin:0 0 18px;">
          <div style="font-size:12px;color:#71717a;margin:0 0 6px;">
            <span>Avancement</span><span style="font-weight:700;color:#18181b;float:right;">${progression} %</span>
          </div>
          <div style="height:8px;background:#e4e4e7;border-radius:99px;overflow:hidden;clear:both;">
            <div style="height:8px;width:${progression}%;background:${accent};border-radius:99px;"></div>
          </div>
          <p style="margin:8px 0 0;font-size:12px;color:#71717a;">
            ${faites} étape${faites > 1 ? "s" : ""} sur ${etapes.length} terminée${faites > 1 ? "s" : ""}
          </p>
        </div>

        ${
          etapes.length
            ? `<table style="width:100%;border-collapse:collapse;margin:0 0 16px;">${etapesHtml}</table>`
            : `<p style="margin:0 0 16px;font-size:13px;color:#71717a;">Les étapes détaillées seront affichées dès qu'elles seront renseignées.</p>`
        }

        ${
          message
            ? `<div style="border-left:3px solid ${accent};background:#fafafa;padding:12px 14px;margin:0 0 18px;">
                 <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#a1a1aa;font-weight:700;">Message de ${escapeHtml(
                   emetteur,
                 )}</p>
                 <p style="margin:0;font-size:13px;line-height:1.6;color:#3f3f46;white-space:pre-line;">${escapeHtml(message)}</p>
               </div>`
            : ""
        }

        <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 20px;">
          ${
            chantier.date_debut
              ? `<tr><td style="padding:4px 0;color:#71717a;">Début des travaux</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(
                  dateFr(chantier.date_debut),
                )}</td></tr>`
              : ""
          }
          <tr><td style="padding:4px 0;color:#71717a;">Statut</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(
            statutLabel(chantier.statut),
          )}</td></tr>
          <tr><td style="padding:4px 0;color:#71717a;">Montant des travaux</td><td style="padding:4px 0;text-align:right;font-weight:600;">${euros(
            chantier.montant,
          )}</td></tr>
        </table>

        ${
          lienSuivi
            ? `<div style="text-align:center;margin:0 0 12px;">
                 <a href="${escapeHtml(lienSuivi)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:8px;font-size:14px;font-weight:600;">Voir le suivi en ligne</a>
               </div>
               <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center;word-break:break-all;">Ou copiez ce lien : ${escapeHtml(
                 lienSuivi,
               )}</p>`
            : ""
        }
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        <p style="margin:0;">${escapeHtml(emetteur)}${
          profile?.telephone ? ` · ${escapeHtml(profile.telephone)}` : ""
        }</p>
        ${pied ? `<p style="margin:6px 0 0;">${escapeHtml(pied).replace(/\n/g, "<br>")}</p>` : ""}
      </div>
    </div>
  </div>
</body></html>`;

    const resendKey = (cleEnvoiEmail() ?? "").trim();
    const fromDomain = (domaineEnvoiEmail() ?? "").trim();
    if (!resendKey || !fromDomain) {
      await journaliser("echec", client.email, motif, "L'envoi d'email n'est pas configuré (Resend).");
      return json({ ok: false, error: "L'envoi d'email n'est pas encore configuré (Resend)." }, 400);
    }

    const res = await envoyerEmail("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${emetteur} <noreply@${fromDomain}>`,
        to: [client.email],
        reply_to: String(profile?.email ?? "").trim() || undefined,
        subject,
        html,
      }),
    });
    const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) {
      const erreur = data?.message || "L'envoi de l'email a échoué.";
      await journaliser("echec", client.email, motif, erreur);
      return json({ ok: false, error: erreur }, 502);
    }

    const maintenant = new Date().toISOString();
    await admin
      .from("chantiers")
      .update({ suivi_dernier_email_at: maintenant, suivi_maj_at: maintenant })
      .eq("id", chantier.id);

    // On conserve le contenu réellement envoyé : il sert à l'aperçu visible depuis la carte du chantier.
    await journaliser("envoye", client.email, motif || "Mise à jour du suivi de chantier.", undefined, {
      sujet: subject,
      html,
    });

    return json({ ok: true, destinataire: client.email, id: data?.id ?? null });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
