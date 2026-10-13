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

/** Un groupe d'échecs rattaché à une automatisation, tel que transmis par l'interface. */
interface GroupeEchecs {
  nom: string;
  echecs: number;
  dernier: string;
}

/**
 * Envoie a l'artisan connecte un recapitulatif d'ECHECS avec un fichier CSV en piece jointe,
 * regroupant les echecs par automatisation : permet d'archiver tout l'historique des rejeux
 * d'un seul geste. Le destinataire est TOUJOURS l'adresse de l'artisan lui-meme (issue de son
 * profil) : jamais un tiers. Reserve aux connectes.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();

    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);
    if (!resendKey || !fromDomain) {
      return json(
        {
          ok: false,
          error:
            "L'envoi d'email n'est pas encore configuré. Activez Resend (clé API + domaine vérifié) puis relancez le diagnostic.",
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
    const contentBase64 = typeof payload?.contentBase64 === "string" ? payload.contentBase64 : "";
    const filename =
      String(payload?.filename ?? "").trim() || `echecs-rejeux-${new Date().toISOString().slice(0, 10)}.csv`;
    const dateExporte = String(payload?.dateExporte ?? "").trim() || new Date().toISOString();

    const brut = Array.isArray(payload?.groupes) ? payload.groupes : [];
    const groupes: GroupeEchecs[] = brut
      .map((g: unknown) => {
        const o = (g ?? {}) as Record<string, unknown>;
        return {
          nom: String(o.nom ?? "").trim() || "Automatisation",
          echecs: Number.isFinite(Number(o.echecs)) ? Number(o.echecs) : 0,
          dernier: String(o.dernier ?? "").trim(),
        };
      })
      .filter((g: GroupeEchecs) => g.nom.length > 0);

    if (!contentBase64) {
      return json({ ok: false, error: "Le fichier CSV à joindre est manquant." }, 400);
    }
    if (groupes.length === 0) {
      return json({ ok: false, error: "Aucune automatisation en échec à récapituler." }, 400);
    }
    const total = Number.isFinite(Number(payload?.total)) ? Number(payload.total) : groupes.length;

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

    const lignes = groupes
      .map(
        (g) => `<tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:13px;color:#18181b;">${escapeHtml(g.nom)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:13px;color:#b91c1c;font-weight:700;text-align:center;">${g.echecs}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#71717a;">${escapeHtml(g.dernier || "—")}</td>
        </tr>`,
      )
      .join("");

    const fromAddress = `${emetteurNom} <noreply@${fromDomain}>`;
    const subject = `Rejeux test à blanc — échecs par automatisation (CSV)`;
    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Échecs des rejeux test à blanc, par automatisation</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:700;">
          ${groupes.length} automatisation${groupes.length > 1 ? "s" : ""} en échec sur ${total} rejeu${total > 1 ? "x" : ""}
        </div>
        <p style="margin:16px 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Voici les échecs regroupés par automatisation. Le fichier <strong>CSV</strong> en pièce jointe
          contient le détail complet à archiver.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#f4f4f5;">
              <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Automatisation</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;color:#71717a;">Échecs</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Dernier échec</th>
            </tr>
          </thead>
          <tbody>${lignes}</tbody>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">
          Récap généré le ${escapeHtml(new Date(dateExporte).toLocaleString("fr-FR"))} et envoyé à ${escapeHtml(destinataire)}.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;

    let res: Response;
    let resendData: { id?: string; message?: string } | null;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAddress,
          to: [destinataire],
          subject,
          html,
          attachments: [{ filename, content: contentBase64 }],
        }),
      });
      resendData = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    } catch (netErr) {
      const erreur = netErr instanceof Error ? netErr.message : "Le service d'envoi est injoignable.";
      return json({ ok: false, error: erreur }, 502);
    }

    if (!res.ok) {
      const erreur = resendData?.message || `L'API Resend a refusé l'envoi (code ${res.status}).`;
      return json({ ok: false, error: erreur }, 502);
    }

    return json({ ok: true, id: resendData?.id ?? null, to: destinataire });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
