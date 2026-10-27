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

function dateFr(valeur: string | Date | null | undefined): string {
  if (!valeur) return "—";
  const date = typeof valeur === "string" ? new Date(valeur) : valeur;
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Paris",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function joursRestants(prevueLe: string, maintenant: Date): number {
  const cible = new Date(prevueLe).getTime();
  if (Number.isNaN(cible)) return 0;
  return Math.max(0, Math.ceil((cible - maintenant.getTime()) / (24 * 60 * 60 * 1000)));
}

async function envoyerEmail(destinataire: string, sujet: string, html: string): Promise<boolean> {
  const apiKey = cleEnvoiEmail();
  const domain = domaineEnvoiEmail();
  if (!apiKey || !domain) return false;
  try {
    const res = await envoyerEmail("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `ArtiFlow-pro <noreply@${domain}>`,
        to: [destinataire],
        subject: sujet,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

interface DemandeRow {
  id: number;
  email: string | null;
  entreprise: string | null;
  demandee_le: string;
  prevue_le: string;
  details: Record<string, unknown> | null;
  statut: string;
}

function gabaritRelance(demande: DemandeRow, jours: number, maintenant: Date): string {
  const urgence = jours <= 0 ? "aujourd'hui" : jours === 1 ? "demain" : `dans ${jours} jours`;
  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="font-size:14px;font-weight:bold;letter-spacing:0.4px;color:#0f6b58;margin-bottom:16px;">ArtiFlow-pro</div>
      <div style="background:#ffffff;border:1px solid #e6e4df;border-radius:12px;padding:28px;">
        <div style="display:inline-block;background:#b45309;color:#ffffff;font-size:11px;font-weight:bold;letter-spacing:0.5px;padding:4px 9px;border-radius:999px;margin-bottom:14px;">
          RAPPEL — SUPPRESSION ${urgence.toUpperCase()}
        </div>
        <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">
          Votre compte sera supprimé ${urgence}
        </h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3c3c38;">
          Bonjour ${escapeHtml(demande.entreprise || "à vous")}, notre équipe vous relance au sujet de votre
          demande de suppression de compte. Nous préférons vérifier avec vous avant d'effacer quoi que ce soit.
        </p>
        <div style="background:#f7f6f2;border:1px solid #e6e4df;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.7;margin-bottom:18px;">
          <strong>Demande reçue le :</strong> ${dateFr(demande.demandee_le)}<br />
          <strong>Suppression définitive le :</strong> ${dateFr(demande.prevue_le)}<br />
          <strong>Il vous reste :</strong> ${jours} jour${jours > 1 ? "s" : ""}
        </div>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3c3c38;">
          <strong>Vous voulez conserver votre compte ?</strong> C'est encore possible, et c'est immédiat :
        </p>
        <ul style="margin:0 0 18px;padding-left:18px;font-size:14px;line-height:1.8;color:#3c3c38;">
          <li>Connectez-vous à votre espace : la demande est annulée automatiquement, ou</li>
          <li>ouvrez <em>Mon profil → Sécurité</em> et cliquez sur « Annuler la suppression ».</li>
        </ul>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3c3c38;">
          Si vous partez vraiment, pensez à <strong>exporter vos données</strong> avant l'échéance :
          <em>Mon profil → Sécurité → Mes droits RGPD → Exporter mes données</em>.
        </p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#6a6a64;">
          Sans action de votre part, votre compte et toutes vos données (devis, factures, clients, chantiers)
          seront définitivement effacés le ${dateFr(demande.prevue_le)}. Un email de confirmation vous sera
          envoyé le jour même, avec la liste de ce qui a été effacé.
        </p>
        <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#3c3c38;">
          Une question ? Répondez simplement à cet email, nous vous répondons personnellement.
        </p>
      </div>
      <p style="margin:18px 0 0;font-size:11px;line-height:1.6;color:#8a8a84;text-align:center;">
        Email envoyé par notre équipe le ${dateFr(maintenant)}. Conservez-le : il fait foi de nos échanges.
      </p>
    </div>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ ok: false, error: "La relance n'est pas encore configurée." }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user?.email) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: gestionnaire } = await admin
      .from("gestionnaires")
      .select("email")
      .ilike("email", user.email)
      .maybeSingle();
    if (!gestionnaire) {
      return json({ ok: false, error: "Cette action est réservée aux gestionnaires." }, 403);
    }

    const body = await req.json().catch(() => null);
    const demandeId = Number(body?.demandeId);
    if (!Number.isFinite(demandeId) || demandeId <= 0) {
      return json({ ok: false, error: "Demande introuvable." }, 400);
    }

    // Motif facultatif : note interne du gestionnaire, conservée dans la trace d'audit
    // mais JAMAIS insérée dans l'email envoyé à l'artisan.
    const motif = String(body?.motif ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    const { data: demandeData } = await admin
      .from("suppressions_compte")
      .select("id, email, entreprise, demandee_le, prevue_le, details, statut")
      .eq("id", demandeId)
      .maybeSingle();
    const demande = demandeData as DemandeRow | null;
    if (!demande) return json({ ok: false, error: "Cette demande n'existe plus." }, 404);
    if (demande.statut !== "programmee") {
      return json({ ok: false, error: "Cette demande n'est plus en attente : elle a déjà été traitée." }, 409);
    }
    if (!demande.email) {
      return json({ ok: false, error: "Ce compte n'a pas d'adresse email : impossible de le relancer." }, 400);
    }

    const maintenant = new Date();
    const jours = joursRestants(demande.prevue_le, maintenant);
    if (jours < 1) {
      return json(
        { ok: false, error: "L'échéance est passée : la demande est en attente de purge, la relance n'a plus lieu d'être." },
        409,
      );
    }

    const sujet =
      jours === 1
        ? "Votre compte ArtiFlow-pro sera supprimé demain — dernier rappel"
        : `Votre compte ArtiFlow-pro sera supprimé dans ${jours} jours`;

    const envoye = await envoyerEmail(demande.email, sujet, gabaritRelance(demande, jours, maintenant));
    if (!envoye) {
      return json(
        { ok: false, error: "L'email n'a pas pu être envoyé. Vérifiez la configuration email puis réessayez." },
        502,
      );
    }

    const details = (demande.details ?? {}) as Record<string, unknown>;
    const precedentes = Number(details.relances_manuelles);
    const nbRelances = Number.isFinite(precedentes) && precedentes > 0 ? Math.floor(precedentes) + 1 : 1;

    // Journal court des relances (date + motif) pour la trace d'audit : on garde les 8 dernières.
    const historiqueExistant = Array.isArray(details.relances_historique)
      ? (details.relances_historique as unknown[])
      : [];
    const historique = [...historiqueExistant, { le: maintenant.toISOString(), motif }]
      .filter((entree) => entree && typeof entree === "object")
      .slice(-8);

    await admin
      .from("suppressions_compte")
      .update({
        details: {
          ...details,
          relance_manuelle_le: maintenant.toISOString(),
          relances_manuelles: nbRelances,
          relance_motif: motif || null,
          relances_historique: historique,
        },
        updated_at: maintenant.toISOString(),
      })
      .eq("id", demande.id)
      .eq("statut", "programmee");

    return json({
      ok: true,
      envoyeLe: maintenant.toISOString(),
      email: demande.email,
      jours,
      motif,
      relancesManuelles: nbRelances,
      message: `Rappel envoyé à ${demande.entreprise || demande.email} (${demande.email}).`,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});