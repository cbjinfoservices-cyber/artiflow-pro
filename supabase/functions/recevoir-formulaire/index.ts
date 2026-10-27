import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { domaineEnvoiEmail, envoyerEmail } from "../_shared/envoiEmail.ts";

/**
 * Réception des formulaires publics du site (démo, contact, candidature, alerte podcast).
 *
 * Remplace le service de formulaires de Readdy : la demande est enregistrée dans
 * demandes_formulaires (purgée automatiquement, voir purger_donnees_expirees), puis notifiée par
 * email à l'équipe (FORMULAIRES_DESTINATAIRE, contact@artiflow-pro.com par défaut). L'email porte
 * l'adresse du visiteur en « répondre à » : on lui répond directement depuis sa messagerie.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

type TypeFormulaire = "demo" | "contact" | "candidature" | "podcast";

/** Libellés des formulaires et de leurs champs, dans l'ordre d'affichage de l'email. */
const FORMULAIRES: Record<TypeFormulaire, { titre: string; champs: Record<string, string> }> = {
  demo: {
    titre: "Demande de démonstration",
    champs: { nom: "Nom", metier: "Métier", email: "Email", telephone: "Téléphone", utilisateurs: "Taille d'équipe", message: "Message", source: "Page d'origine" },
  },
  contact: {
    titre: "Message de contact",
    champs: { nom: "Nom", entreprise: "Entreprise", email: "Email", telephone: "Téléphone", sujet: "Sujet", message: "Message", origine: "Origine", source: "Page d'origine" },
  },
  candidature: {
    titre: "Candidature",
    champs: { nom: "Nom", email: "Email", telephone: "Téléphone", poste: "Poste visé", lien_profil: "Profil en ligne", message: "Message", source: "Page d'origine" },
  },
  podcast: {
    titre: "Inscription à l'alerte podcast",
    champs: { email: "Email", plateforme: "Plateforme d'écoute", source: "Page d'origine" },
  },
};

const LONGUEUR_MAX = { message: 5000, autre: 300 };
const ENVOIS_MAX_PAR_HEURE = 5;

function echapper(valeur: unknown): string {
  return String(valeur ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function emailValide(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Méthode non autorisée." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const corps = (await req.json().catch(() => null)) as { type?: string; champs?: Record<string, unknown> } | null;
    const type = String(corps?.type ?? "") as TypeFormulaire;
    const definition = FORMULAIRES[type];
    if (!definition) return json({ ok: false, error: "Formulaire inconnu." }, 400);

    // On ne garde que les champs attendus pour ce formulaire, nettoyés et tronqués.
    const champs: Record<string, string> = {};
    for (const cle of Object.keys(definition.champs)) {
      const brut = String(corps?.champs?.[cle] ?? "").trim();
      if (brut) champs[cle] = brut.slice(0, cle === "message" ? LONGUEUR_MAX.message : LONGUEUR_MAX.autre);
    }
    const email = (champs.email ?? "").toLowerCase();
    if (!emailValide(email)) return json({ ok: false, error: "Indiquez une adresse email valide." }, 400);
    champs.email = email;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Anti-abus : au plus quelques envois par heure pour une même adresse.
    const { count } = await admin
      .from("demandes_formulaires")
      .select("id", { count: "exact", head: true })
      .ilike("email", email)
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= ENVOIS_MAX_PAR_HEURE) {
      return json({ ok: false, error: "Vous avez déjà envoyé plusieurs demandes. Réessayez un peu plus tard." }, 429);
    }

    const { error: erreurInsertion } = await admin.from("demandes_formulaires").insert({
      type,
      email,
      nom: champs.nom ?? null,
      telephone: champs.telephone ?? null,
      champs,
    });
    if (erreurInsertion) return json({ ok: false, error: "L'envoi n'a pas abouti. Réessayez dans un instant." }, 500);

    // Notification à l'équipe (l'enregistrement fait foi même si l'email échoue).
    const destinataire = (Deno.env.get("FORMULAIRES_DESTINATAIRE") ?? "").trim() || "contact@artiflow-pro.com";
    const lignes = Object.entries(definition.champs)
      .filter(([cle]) => champs[cle])
      .map(
        ([cle, libelle]) =>
          `<tr><td style="padding:8px 12px;border-top:1px solid #eee;font-size:13px;color:#71717a;white-space:nowrap;vertical-align:top;">${echapper(libelle)}</td><td style="padding:8px 12px;border-top:1px solid #eee;font-size:14px;color:#18181b;white-space:pre-wrap;">${echapper(champs[cle])}</td></tr>`,
      )
      .join("");
    const qui = champs.nom || email;
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:20px 24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:12px;font-weight:700;color:#ea580c;text-transform:uppercase;letter-spacing:.04em;">${echapper(definition.titre)}</p>
        <p style="margin:6px 0 0;font-size:18px;font-weight:700;">${echapper(qui)}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">${lignes}</table>
      <div style="padding:14px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;">
        Répondez directement à cet email pour écrire à ${echapper(email)}. Demande conservée dans ArtiFlow-pro.
      </div>
    </div>
  </div>
</body></html>`;
    const domaine = domaineEnvoiEmail() ?? "artiflow-pro.com";
    const envoi = await envoyerEmail("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Site ArtiFlow-pro <noreply@${domaine}>`,
        to: [destinataire],
        reply_to: email,
        subject: `${definition.titre} — ${qui}`,
        html,
      }),
    }).catch(() => null);

    return json({ ok: true, notifie: Boolean(envoi?.ok) });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
