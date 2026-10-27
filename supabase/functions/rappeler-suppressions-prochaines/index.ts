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

/** Fenêtre de lecture : on ne regarde que les demandes proches de leur échéance. */
const FENETRE_JOURS = 9;

/** Compte gestionnaire principal : toujours prévenu de l'alerte interne J-1. */
const GESTIONNAIRE_PRINCIPAL_EMAIL = "cbj.infoservices@gmail.com";

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

/** Nombre de jours restants (arrondi au jour supérieur, jamais négatif). */
function joursRestants(prevueLe: string, maintenant: Date): number {
  const cible = new Date(prevueLe).getTime();
  if (Number.isNaN(cible)) return 0;
  return Math.max(0, Math.ceil((cible - maintenant.getTime()) / (24 * 60 * 60 * 1000)));
}

async function envoyerEmail(destinataires: string | string[], sujet: string, html: string): Promise<boolean> {
  const apiKey = cleEnvoiEmail();
  const domain = domaineEnvoiEmail();
  if (!apiKey || !domain) return false;
  const to = Array.isArray(destinataires) ? destinataires : [destinataires];
  if (to.length === 0) return false;
  try {
    const res = await envoyerEmail("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `ArtiFlow-pro <noreply@${domain}>`,
        to,
        subject: sujet,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Adresses des gestionnaires à prévenir (principal + table gestionnaires). */
// deno-lint-ignore no-explicit-any
async function adressesGestionnaires(admin: any): Promise<string[]> {
  const set = new Set<string>();
  set.add(GESTIONNAIRE_PRINCIPAL_EMAIL);
  try {
    const { data } = await admin.from("gestionnaires").select("email");
    (data ?? []).forEach((row: { email?: string }) => {
      const email = String(row?.email ?? "").trim();
      if (email) set.add(email);
    });
  } catch {
    /* best-effort : on garde au minimum le gestionnaire principal */
  }
  return Array.from(set);
}

/**
 * Alerte interne : une demande arrive à échéance sans avoir été annulée.
 * Sert de dernier filet côté équipe : rappeler à l'artisan, ou annuler si nécessaire.
 */
function gabaritAlerteInterne(demandes: DemandeRow[], maintenant: Date): string {
  const lignes = demandes
    .map((d) => {
      const jours = joursRestants(d.prevue_le, maintenant);
      const details = (d.details ?? {}) as Record<string, unknown>;
      const rappels = [
        typeof details.rappel_j7_envoye_le === "string" ? "J-7" : null,
        typeof details.rappel_j1_envoye_le === "string" ? "J-1" : null,
      ]
        .filter(Boolean)
        .join(" + ");
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:13px;color:#18181b;font-weight:600;">${escapeHtml(
          d.entreprise || "Non renseignée",
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#52525b;">${escapeHtml(
          d.email || "—",
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#18181b;">${escapeHtml(
          dateFr(d.prevue_le),
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#b45309;font-weight:700;text-align:center;">${jours > 0 ? `J-${jours}` : "Jour J"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f1f1f1;font-size:12px;color:#52525b;">${escapeHtml(
          rappels || "aucun",
        )}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;">
    <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
      <div style="font-size:14px;font-weight:bold;letter-spacing:0.4px;color:#0f6b58;margin-bottom:16px;">ArtiFlow-pro · Alerte interne</div>
      <div style="background:#ffffff;border:1px solid #e6e4df;border-radius:12px;padding:26px;">
        <div style="display:inline-block;background:#b45309;color:#ffffff;font-size:11px;font-weight:bold;letter-spacing:0.5px;padding:4px 9px;border-radius:999px;margin-bottom:14px;">
          ÉCHÉANCE IMMINENTE
        </div>
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">
          ${demandes.length} suppression${demandes.length > 1 ? "s" : ""} de compte arrive${demandes.length > 1 ? "nt" : ""} à échéance
        </h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3c3c38;">
          Ces demandes n'ont pas été annulées et arrivent au terme de leur période de grâce :
          le compte sera réellement effacé à la prochaine purge. Si l'artisan s'est rétracté,
          annulez la suppression depuis le back-office avant l'échéance.
        </p>
        <table style="width:100%;border-collapse:collapse;background:#faf9f6;border-radius:10px;overflow:hidden;">
          <thead>
            <tr style="background:#f4f4f2;">
              <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Entreprise</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Email</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Échéance</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;color:#71717a;">Reste</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#71717a;">Rappels artisan</th>
            </tr>
          </thead>
          <tbody>${lignes}</tbody>
        </table>
        <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#3c3c38;">
          <strong>Que faire ?</strong> Contacter l'artisan si un doute subsiste, ou annuler la suppression
          dans le back-office (encart « Suppressions en attente »). Une annulation est immédiate et prévient
          l'artisan par email.
        </p>
        <p style="margin:14px 0 0;font-size:11px;line-height:1.6;color:#8a8a84;">
          Alerte générée automatiquement le ${dateFr(maintenant)}. Une seule alerte par demande.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

interface DemandeRow {
  id: number;
  user_id: string;
  email: string | null;
  entreprise: string | null;
  demandee_le: string;
  prevue_le: string;
  details: Record<string, unknown> | null;
}

/** Construit le rappel : lisible, avec la date exacte et le geste pour annuler. */
function gabaritRappel(demande: DemandeRow, jours: number, maintenant: Date): string {
  const urgence = jours <= 1 ? "demain" : `dans ${jours} jours`;
  const accent = jours <= 1 ? "#b45309" : "#0f6b58";
  const entreprise = demande.entreprise || "à vous";
  return `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="font-size:14px;font-weight:bold;letter-spacing:0.4px;color:#0f6b58;margin-bottom:16px;">ArtiFlow-pro</div>
      <div style="background:#ffffff;border:1px solid #e6e4df;border-radius:12px;padding:28px;">
        <div style="display:inline-block;background:${accent};color:#ffffff;font-size:11px;font-weight:bold;letter-spacing:0.5px;padding:4px 9px;border-radius:999px;margin-bottom:14px;">
          RAPPEL — SUPPRESSION ${urgence.toUpperCase()}
        </div>
        <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">
          Votre compte sera supprimé ${urgence}
        </h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3c3c38;">
          Bonjour ${entreprise}, vous avez demandé la suppression de votre compte ArtiFlow-pro.
          Nous vous prévenons ${jours <= 1 ? "une dernière fois" : "à l'avance"} pour éviter toute surprise.
        </p>
        <div style="background:#f7f6f2;border:1px solid #e6e4df;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.7;margin-bottom:18px;">
          <strong>Demande reçue le :</strong> ${dateFr(demande.demandee_le)}<br />
          <strong>Suppression définitive le :</strong> ${dateFr(demande.prevue_le)}<br />
          <strong>Il vous reste :</strong> ${jours} jour${jours > 1 ? "s" : ""}
        </div>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3c3c38;">
          <strong>Vous voulez revenir en arrière ?</strong> C'est encore possible, et c'est immédiat :
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
      </div>
      <p style="margin:18px 0 0;font-size:11px;line-height:1.6;color:#8a8a84;text-align:center;">
        Email automatique envoyé par ArtiFlow-pro le ${dateFr(maintenant)}. Conservez-le : il fait foi de nos échanges.
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Envoie des rappels par email avant la suppression réelle d'un compte.
 *
 * Appelée par une tâche planifiée **quotidienne** (cron), sans authentification utilisateur.
 * Deux rappels au maximum par demande :
 *  — **J-7** : première piqûre de rappel, pour laisser le temps de réagir ;
 *  — **J-1** : dernier avertissement, la veille de l'effacement.
 *
 * L'idempotence est assurée par deux marqueurs stockés dans `details`
 * (`rappel_j7_envoye_le`, `rappel_j1_envoye_le`) : même si le cron tourne plusieurs fois
 * par jour, un artisan ne reçoit jamais deux fois le même rappel.
 *
 * Seules les demandes au statut `programmee` sont concernées : une demande annulée ou déjà
 * purgée ne génère aucun envoi.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: "La tâche de rappel n'est pas configurée." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const maintenant = new Date();
    const limite = new Date(maintenant.getTime() + FENETRE_JOURS * 24 * 60 * 60 * 1000);

    const { data, error } = await admin
      .from("suppressions_compte")
      .select("id, user_id, email, entreprise, demandee_le, prevue_le, details")
      .eq("statut", "programmee")
      .lte("prevue_le", limite.toISOString())
      .order("prevue_le", { ascending: true })
      .limit(200);
    if (error) {
      return json({ ok: false, error: "Impossible de lire les demandes de suppression." }, 500);
    }

    const demandes = (data ?? []) as DemandeRow[];
    const resultats: Array<{
      id: number;
      email: string | null;
      rappel: "j7" | "j1" | "aucun";
      envoye: boolean;
      jours: number;
      motif?: string;
    }> = [];

    for (const demande of demandes) {
      const jours = joursRestants(demande.prevue_le, maintenant);

      // Échéance déjà passée : la purge s'en occupe, on n'envoie plus de rappel.
      if (jours < 1) {
        resultats.push({ id: demande.id, email: demande.email, rappel: "aucun", envoye: false, jours, motif: "echeance passee" });
        continue;
      }

      const details = (demande.details ?? {}) as Record<string, unknown>;
      const dejaJ7 = typeof details.rappel_j7_envoye_le === "string";
      const dejaJ1 = typeof details.rappel_j1_envoye_le === "string";

      // Jour J-1 : dernier avertissement. Il tient aussi lieu de J-7 si celui-ci n'est jamais parti.
      const doitEnvoyerJ1 = jours <= 1 && !dejaJ1;
      const doitEnvoyerJ7 = !doitEnvoyerJ1 && jours > 1 && jours <= 7 && !dejaJ7;

      if (!doitEnvoyerJ1 && !doitEnvoyerJ7) {
        resultats.push({ id: demande.id, email: demande.email, rappel: "aucun", envoye: false, jours, motif: "deja envoye" });
        continue;
      }

      if (!demande.email) {
        resultats.push({ id: demande.id, email: null, rappel: doitEnvoyerJ1 ? "j1" : "j7", envoye: false, jours, motif: "sans email" });
        continue;
      }

      const rappel: "j7" | "j1" = doitEnvoyerJ1 ? "j1" : "j7";
      const sujet =
        rappel === "j1"
          ? "Dernier rappel : votre compte ArtiFlow-pro sera supprimé demain"
          : `Votre compte ArtiFlow-pro sera supprimé dans ${jours} jours`;

      const envoye = await envoyerEmail(demande.email, sujet, gabaritRappel(demande, jours, maintenant));

      // On ne marque comme envoyé que si l'email est réellement parti : sinon on retentera demain.
      if (envoye) {
        const marqueurs: Record<string, unknown> = {};
        if (!dejaJ7) marqueurs.rappel_j7_envoye_le = maintenant.toISOString();
        if (rappel === "j1" && !dejaJ1) marqueurs.rappel_j1_envoye_le = maintenant.toISOString();
        await admin
          .from("suppressions_compte")
          .update({
            details: { ...details, ...marqueurs },
            updated_at: maintenant.toISOString(),
          })
          .eq("id", demande.id)
          .eq("statut", "programmee");
      }

      resultats.push({ id: demande.id, email: demande.email, rappel, envoye, jours });
    }

    // 2) Alerte interne aux gestionnaires : toute demande arrivée à J-1 sans annulation.
    //    Une seule alerte par demande, grâce au marqueur `alerte_interne_j1_envoye_le`.
    const { data: proches } = await admin
      .from("suppressions_compte")
      .select("id, user_id, email, entreprise, demandee_le, prevue_le, details")
      .eq("statut", "programmee")
      .lte("prevue_le", new Date(maintenant.getTime() + 26 * 60 * 60 * 1000).toISOString())
      .order("prevue_le", { ascending: true })
      .limit(100);

    const aAlerter = ((proches ?? []) as DemandeRow[]).filter((d) => {
      const details = (d.details ?? {}) as Record<string, unknown>;
      if (typeof details.alerte_interne_j1_envoye_le === "string") return false;
      return joursRestants(d.prevue_le, maintenant) <= 1;
    });

    let alerteInterne = 0;
    if (aAlerter.length > 0) {
      const destinataires = await adressesGestionnaires(admin);
      if (destinataires.length > 0) {
        const sujet = `Alerte interne · ${aAlerter.length} suppression${aAlerter.length > 1 ? "s" : ""} de compte ${
          aAlerter.length > 1 ? "arrivent" : "arrive"
        } à échéance`;
        const envoye = await envoyerEmail(destinataires, sujet, gabaritAlerteInterne(aAlerter, maintenant));
        if (envoye) {
          alerteInterne = aAlerter.length;
          for (const demande of aAlerter) {
            const details = (demande.details ?? {}) as Record<string, unknown>;
            await admin
              .from("suppressions_compte")
              .update({
                details: { ...details, alerte_interne_j1_envoye_le: maintenant.toISOString() },
                updated_at: maintenant.toISOString(),
              })
              .eq("id", demande.id)
              .eq("statut", "programmee");
          }
        }
      }
    }

    return json({
      ok: true,
      examinees: demandes.length,
      j7: resultats.filter((r) => r.rappel === "j7" && r.envoye).length,
      j1: resultats.filter((r) => r.rappel === "j1" && r.envoye).length,
      echecs: resultats.filter((r) => r.rappel !== "aucun" && !r.envoye).length,
      alerteInterne,
      resultats,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
