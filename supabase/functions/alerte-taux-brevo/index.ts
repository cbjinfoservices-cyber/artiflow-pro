import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleEnvoiEmail, domaineEnvoiEmail, envoyerEmail } from "../_shared/envoiEmail.ts";

// Tâche planifiée : surveille le taux de réussite RÉEL des emails envoyés (Brevo et Resend)
// sur les 24 dernières heures. Si le taux passe sous 95 % (avec un échantillon minimum
// de 5 envois), l'alerte part par email aux gestionnaires. Anti-doublon : une seule
// alerte par tranche de 24 h, sauf appel `force: true`.
// Les envois de test, les démonstrations et les alertes elles-mêmes sont exclus du
// calcul, sinon ils fausseraient le taux à la baisse.
//
// Le slug de la fonction et la table d'historique gardent leur nom d'origine pour ne pas
// casser la planification déjà en place : elle ne contient plus que des mesures Resend.

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
const SEUIL = 95;
const MIN_ECHANTILLON = 5;
const FENETRE_MS = 24 * 60 * 60 * 1000;
const FONCTIONS_EXCLUES = ["test-repli", "alerte-taux-brevo", "alerte-taux-brevo-demo"];

type EnvoiOptions = {
  nom: string;
  to: string[];
  subject: string;
  html: string;
};

/**
 * Expédie l'email d'alerte via Resend, seul canal d'envoi du produit, et consigne la
 * tentative dans l'historique des envois. La trace ne doit jamais bloquer l'envoi.
 */
async function envoyerEmail(
  fonction: string,
  opts: EnvoiOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<{ ok: boolean; fournisseur: string; error?: string }> {
  // Service réellement utilisé : Brevo s'il est configuré, sinon Resend (voir _shared/envoiEmail.ts).
  const fournisseur = (Deno.env.get("BREVO_API_KEY") ?? "").trim() ? "brevo" : "resend";
  const tracer = async (statut: string, message?: string, utilise = fournisseur) => {
    if (!admin) return;
    try {
      await admin
        .from("envoi_fournisseur_historique")
        .insert({ fonction, fournisseur: utilise, statut, repli: false, message: message ?? null });
    } catch {
      /* la trace ne doit jamais bloquer un envoi */
    }
  };

  const resendKey = (cleEnvoiEmail() ?? "").trim();
  const fromDomain = (domaineEnvoiEmail() ?? "").trim();
  if (!resendKey || !fromDomain) {
    const erreur = "Envoi non configuré : clé API (Brevo ou Resend) ou domaine d'envoi manquant.";
    await tracer("echec", erreur);
    return { ok: false, fournisseur, error: erreur };
  }

  try {
    const res = await envoyerEmail("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${opts.nom} <contact@${fromDomain}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    const utilise = res.headers.get("x-fournisseur") ?? fournisseur;
    if (res.ok) {
      await tracer("succes", undefined, utilise);
      return { ok: true, fournisseur: utilise };
    }
    const erreur = data?.message || `L'envoi a été refusé (code ${res.status}).`;
    await tracer("echec", erreur, utilise);
    return { ok: false, fournisseur: utilise, error: erreur };
  } catch (e) {
    const erreur = e instanceof Error ? e.message : "Le service d'envoi est injoignable.";
    await tracer("echec", erreur);
    return { ok: false, fournisseur, error: erreur };
  }
}

function buildEmailHtml(params: {
  taux: number;
  total: number;
  succes: number;
  echecs: number;
  motifs: string[];
  demo?: boolean;
}): string {
  const { taux, total, succes, echecs, motifs, demo = false } = params;
  const bandeauDemo = demo
    ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;font-size:13px;color:#92400e;line-height:1.6;margin:0 0 18px;">
        <p style="margin:0 0 6px;font-weight:700;">Ceci est une démonstration</p>
        <p style="margin:0;">Aucun incident réel n'a été détecté. Cet email montre exactement ce que vous recevrez si le taux de réussite des emails descend sous ${SEUIL} % sur 24 h.</p>
      </div>`
    : "";
  const motifsHtml = motifs.length
    ? `<div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:10px;padding:14px;font-size:13px;color:#b91c1c;line-height:1.6;">
        <p style="margin:0 0 6px;font-weight:700;">Derniers motifs renvoyés par Resend</p>
        ${motifs.map((m) => `<p style="margin:0 0 4px;">• ${escapeHtml(m)}</p>`).join("")}
      </div>`
    : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">ArtiFlow-pro</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Alerte automatique — taux de réussite des emails</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:700;">Sous ${SEUIL} % sur 24 h</div>
        <div style="height:14px;"></div>
        ${bandeauDemo}
        <p style="margin:16px 0 12px;font-size:14px;line-height:1.7;color:#3f3f46;">
          Le taux de réussite des emails est descendu à <strong style="color:#b91c1c;">${taux} %</strong>
          sur les 24 dernières heures. Le seuil d'alerte est fixé à ${SEUIL} %.
        </p>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:0 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Envois tentés : <strong style="color:#18181b;">${total}</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Réussis : <strong style="color:#18181b;">${succes}</strong></p>
          <p style="margin:0;color:#b91c1c;">Échecs : <strong>${echecs}</strong></p>
        </div>
        ${motifsHtml}
        <p style="margin:16px 0 0;font-size:13px;color:#71717a;line-height:1.6;">
          Les envois passent tous par Resend. Vérifiez d'abord la carte « Envoi des emails » : clé API
          présente, domaine vérifié et enregistrements DNS validés. Le motif exact de chaque échec est
          lisible dans la carte « Suivi des envois » du back-office.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        ${demo ? "Email de démonstration envoyé manuellement depuis le back-office." : "Alerte automatique envoyée par ArtiFlow-pro. Une seule alerte par 24 h."}
      </div>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const preview = body?.preview === true;
    const force = body?.force === true;
    const demo = body?.demo === true;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const depuis = new Date(Date.now() - FENETRE_MS).toISOString();

    const { data, error } = await admin
      .from("envoi_fournisseur_historique")
      .select("fonction, statut, message, created_at")
      .in("fournisseur", ["brevo", "resend"])
      .gte("created_at", depuis)
      .order("created_at", { ascending: false });
    if (error) return json({ ok: false, error: error.message }, 500);

    const rows = ((data ?? []) as Array<Record<string, unknown>>).filter(
      (r) => !FONCTIONS_EXCLUES.includes(String(r.fonction ?? "")),
    );
    const total = rows.length;
    const succes = rows.filter((r) => String(r.statut ?? "") === "succes").length;
    const echecs = total - succes;
    const taux = total > 0 ? Math.round((succes / total) * 100) : 100;
    const motifs = [
      ...new Set(
        rows
          .filter((r) => String(r.statut ?? "") !== "succes" && String(r.message ?? "").trim())
          .map((r) => String(r.message)),
      ),
    ].slice(0, 3);

    const resume = { taux, total, succes, echecs, seuil: SEUIL };

    // Démonstration à la demande : envoie aux gestionnaires un aperçu fidèle de l'alerte,
    // sans jamais écrire dans l'historique des incidents (ce n'est pas un vrai incident).
    if (demo) {
      const { data: gestionnairesDemo } = await admin.from("gestionnaires").select("email");
      const destinatairesDemo = [
        ...new Set(
          ((gestionnairesDemo ?? []) as Array<Record<string, unknown>>)
            .map((g) => String(g.email ?? "").trim())
            .filter((e) => EMAIL_RE.test(e)),
        ),
      ];
      if (!destinatairesDemo.length) {
        return json(
          {
            ok: false,
            ...resume,
            error: "Aucun gestionnaire avec une adresse email valide : impossible d'envoyer la démonstration.",
          },
          400,
        );
      }

      const envoiDemo = await envoyerEmail(
        "alerte-taux-brevo-demo",
        {
          nom: "ArtiFlow-pro",
          to: destinatairesDemo,
          subject: `[Démo] Alerte ArtiFlow-pro : taux de réussite des emails à ${Math.min(taux, 92)} % sur 24 h`,
          html: buildEmailHtml({
            taux: Math.min(taux, 92),
            total: total > 0 ? total : 12,
            succes: total > 0 ? succes : 11,
            echecs: echecs > 0 ? echecs : 1,
            motifs: motifs.length ? motifs : ["Exemple de motif : quota journalier Resend atteint."],
            demo: true,
          }),
        },
        admin,
      );
      if (!envoiDemo.ok) {
        return json({ ok: false, ...resume, error: envoiDemo.error || "La démonstration n'a pas pu être envoyée." }, 502);
      }
      return json({
        ok: true,
        ...resume,
        demo: true,
        sent: 1,
        destinataires: destinatairesDemo.length,
        fournisseur: envoiDemo.fournisseur,
      });
    }

    if (preview) return json({ ok: true, ...resume, alerte: total >= MIN_ECHANTILLON && taux < SEUIL });

    if (total < MIN_ECHANTILLON) {
      return json({
        ok: true,
        ...resume,
        skipped: `Échantillon insuffisant (${total} envoi(s), minimum ${MIN_ECHANTILLON}).`,
      });
    }
    if (taux >= SEUIL) {
      return json({ ok: true, ...resume, skipped: "Taux au-dessus du seuil, aucune alerte." });
    }

    if (!force) {
      const { data: dernieres } = await admin
        .from("brevo_taux_alerte_historique")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      const derniere = (dernieres ?? [])[0] as { created_at?: string } | undefined;
      if (derniere?.created_at && Date.now() - new Date(derniere.created_at).getTime() < FENETRE_MS) {
        return json({ ok: true, ...resume, skipped: "Une alerte a déjà été envoyée dans les 24 dernières heures." });
      }
    }

    const { data: gestionnaires } = await admin.from("gestionnaires").select("email");
    const destinataires = [
      ...new Set(
        ((gestionnaires ?? []) as Array<Record<string, unknown>>)
          .map((g) => String(g.email ?? "").trim())
          .filter((e) => EMAIL_RE.test(e)),
      ),
    ];
    if (!destinataires.length) {
      return json({ ok: true, ...resume, sent: 0, reason: "Aucun gestionnaire avec une adresse email valide." });
    }

    const envoi = await envoyerEmail(
      "alerte-taux-brevo",
      {
        nom: "ArtiFlow-pro",
        to: destinataires,
        subject: `Alerte ArtiFlow-pro : taux de réussite des emails à ${taux} % sur 24 h`,
        html: buildEmailHtml({ taux, total, succes, echecs, motifs }),
      },
      admin,
    );
    if (!envoi.ok) {
      return json({ ok: false, ...resume, error: envoi.error || "L'envoi de l'alerte a échoué." }, 502);
    }

    await admin.from("brevo_taux_alerte_historique").insert({
      taux,
      total,
      succes,
      echecs,
      seuil: SEUIL,
      destinataires: destinataires.length,
    });

    return json({ ok: true, ...resume, sent: 1, destinataires: destinataires.length, fournisseur: envoi.fournisseur });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
