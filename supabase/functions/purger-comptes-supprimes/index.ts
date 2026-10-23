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

/** Nombre maximum de comptes traités par appel (sécurité si le cron n'a pas tourné). */
const LOT_MAX = 20;

/** Tables rattachées au compte par `user_id`. */
const TABLES_USER_ID = [
  "chantiers",
  "clients",
  "comptable_remplacements",
  "devis",
  "devis_modele_usage_events",
  "devis_modele_usages",
  "devis_modeles",
  "email_test_historique",
  "envois_auto_tests",
  "envois_email",
  "escalade_journal",
  "export_csv_mensuel_historique",
  "facture_modeles",
  "factures",
  "intervenants",
  "lignes_bibliotheque",
  "mot_de_passe_alerte_historique",
  "mot_de_passe_recap_historique",
  "planning_creneaux",
  "preferences_affichage",
  "recap_alertes_artisan",
  "recap_echecs_annuel_relances",
  "recap_echecs_blanc_envois",
  "recap_envois",
  "recap_recontact_envois",
  "reessais_envoi_historique",
  "rejeux_blanc_historique",
  "relance_facture_envois",
  "relances_client",
  "sante_scores",
  "taux_alerte_historique",
];

/** Tables rattachées au compte par `artisan_id`. */
const TABLES_ARTISAN_ID = ["abonnement_historique", "abonnements", "paiements_echecs", "recontacts_artisans"];

interface CompteSuppression {
  id: number;
  user_id: string;
  email: string | null;
  entreprise: string | null;
  demandee_le: string;
  prevue_le: string;
  details: Record<string, unknown> | null;
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

async function envoyerEmail(destinataire: string, sujet: string, html: string): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const domain = Deno.env.get("RESEND_FROM_DOMAIN");
  if (!apiKey || !domain) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
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

/** Compte les lignes d'une table pour une valeur de colonne donnée. */
async function compter(
  admin: { from: (table: string) => any },
  table: string,
  colonne: string,
  valeur: string,
): Promise<number> {
  try {
    const { count } = await admin.from(table).select("id", { count: "exact", head: true }).eq(colonne, valeur);
    return Number(count) || 0;
  } catch {
    return 0;
  }
}

/** Lit tous les identifiants d'une table pour un porteur donné. */
async function idsDe(
  admin: { from: (table: string) => any },
  table: string,
  colonne: string,
  valeur: string,
): Promise<string[]> {
  try {
    const { data, error } = await admin.from(table).select("id").eq(colonne, valeur);
    if (error || !Array.isArray(data)) return [];
    return data.map((row: { id: string | number }) => String(row.id));
  } catch {
    return [];
  }
}

/** Compte les lignes rattachées à une liste d'identifiants parents. */
async function compterDans(
  admin: { from: (table: string) => any },
  table: string,
  colonne: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  try {
    const { count } = await admin.from(table).select("id", { count: "exact", head: true }).in(colonne, ids);
    return Number(count) || 0;
  } catch {
    return 0;
  }
}

/**
 * Supprime définitivement les comptes dont la période de grâce de 30 jours est écoulée.
 *
 * Appelée par une tâche planifiée (cron), sans authentification utilisateur — comme les
 * autres fonctions d'automatisation. La fonction ne traite QUE les demandes explicites
 * enregistrées par l'artisan lui-même (`statut = 'programmee'` + `prevue_le` atteinte).
 *
 * Pour chaque compte :
 *  1. recompte tout ce qui va être effacé (pour le récapitulatif de preuve) ;
 *  2. supprime les données rattachées, enfants d'abord ;
 *  3. supprime le compte de connexion ;
 *  4. envoie l'email de preuve : date d'effacement + liste chiffrée de ce qui a été effacé ;
 *  5. marque la demande comme `supprimee`.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: "La purge des comptes n'est pas configurée." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const maintenant = new Date();

    const { data: dues, error: lectureError } = await admin
      .from("suppressions_compte")
      .select("id, user_id, email, entreprise, demandee_le, prevue_le, details")
      .eq("statut", "programmee")
      .lte("prevue_le", maintenant.toISOString())
      .order("prevue_le", { ascending: true })
      .limit(LOT_MAX);
    if (lectureError) {
      return json({ ok: false, error: "Impossible de lire les demandes arrivées à échéance." }, 500);
    }

    const liste = (dues ?? []) as CompteSuppression[];
    const resultats: Array<{ id: number; email: string | null; statut: string; erreur?: string }> = [];

    for (const demande of liste) {
      try {
        const userId = demande.user_id;

        // 1) Inventaire de ce qui va être effacé.
        const relancesIds = await idsDe(admin, "relances", "user_id", userId);
        const devisIds = await idsDe(admin, "devis", "user_id", userId);
        const chantiersIds = await idsDe(admin, "chantiers", "user_id", userId);
        const ordersIds = await idsDe(admin, "order_headers", "customer_id", userId);

        const inventaire: Array<{ libelle: string; nombre: number }> = [
          { libelle: "Profil, coordonnées et réglages du compte", nombre: 1 },
          { libelle: "Clients", nombre: await compter(admin, "clients", "user_id", userId) },
          { libelle: "Devis", nombre: devisIds.length },
          { libelle: "Lignes de devis", nombre: await compterDans(admin, "lignes_devis", "devis_id", devisIds) },
          { libelle: "Modèles de devis", nombre: await compter(admin, "devis_modeles", "user_id", userId) },
          { libelle: "Factures", nombre: await compter(admin, "factures", "user_id", userId) },
          { libelle: "Modèles de factures", nombre: await compter(admin, "facture_modeles", "user_id", userId) },
          { libelle: "Chantiers", nombre: chantiersIds.length },
          {
            libelle: "Étapes de chantier",
            nombre: await compterDans(admin, "etapes_chantier", "chantier_id", chantiersIds),
          },
          { libelle: "Relances", nombre: relancesIds.length },
          {
            libelle: "Reprogrammations de relances",
            nombre: await compterDans(admin, "relance_reprogrammations", "relance_id", relancesIds),
          },
          { libelle: "Relances client programmées", nombre: await compter(admin, "relances_client", "user_id", userId) },
          { libelle: "Créneaux de planning", nombre: await compter(admin, "planning_creneaux", "user_id", userId) },
          { libelle: "Intervenants", nombre: await compter(admin, "intervenants", "user_id", userId) },
          {
            libelle: "Bibliothèque de lignes",
            nombre: await compter(admin, "lignes_bibliotheque", "user_id", userId),
          },
          { libelle: "Historique des envois", nombre: await compter(admin, "envois_email", "user_id", userId) },
          { libelle: "Abonnement et historique d'abonnement", nombre: await compter(admin, "abonnements", "artisan_id", userId) },
          { libelle: "Commandes passées sur le site", nombre: ordersIds.length },
          { libelle: "Compte de connexion (adresse email et mot de passe)", nombre: 1 },
        ];
        const inventaireComplet = inventaire.filter((l) => l.nombre > 0);

        // 2) Suppression des données rattachées (les tables enfants d'abord).
        if (relancesIds.length) {
          await admin.from("relance_reprogrammations").delete().in("relance_id", relancesIds);
        }
        if (devisIds.length) {
          await admin.from("lignes_devis").delete().in("devis_id", devisIds);
        }
        if (chantiersIds.length) {
          await admin.from("etapes_chantier").delete().in("chantier_id", chantiersIds);
        }
        if (ordersIds.length) {
          await admin.from("order_items").delete().in("order_id", ordersIds);
          await admin.from("order_headers").delete().in("id", ordersIds);
        }

        for (const table of TABLES_USER_ID) {
          try {
            await admin.from(table).delete().eq("user_id", userId);
          } catch {
            /* table absente : on continue */
          }
        }
        for (const table of TABLES_ARTISAN_ID) {
          try {
            await admin.from(table).delete().eq("artisan_id", userId);
          } catch {
            /* table absente : on continue */
          }
        }

        try {
          await admin.from("profiles").delete().eq("id", userId);
        } catch {
          /* silencieux */
        }
        if (demande.email) {
          try {
            await admin.from("gestionnaires").delete().ilike("email", demande.email);
          } catch {
            /* silencieux */
          }
        }

        // 3) Suppression du compte de connexion (dernière étape, indispensable).
        let suppressionAuth = await admin.auth.admin.deleteUser(userId);
        if (suppressionAuth.error) {
          suppressionAuth = await admin.auth.admin.deleteUser(userId);
        }
        if (suppressionAuth.error) {
          // Les données sont parties mais la connexion subsiste : on garde la demande
          // ouverte pour retenter, en mémorisant l'inventaire déjà calculé.
          await admin
            .from("suppressions_compte")
            .update({
              details: {
                ...(demande.details ?? {}),
                compteurs: inventaireComplet,
                derniere_erreur: suppressionAuth.error.message ?? "suppression de la connexion impossible",
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", demande.id);
          resultats.push({ id: demande.id, email: demande.email, statut: "erreur", erreur: "connexion non supprimée" });
          continue;
        }

        // 4) Email de preuve (date + liste chiffrée de ce qui a été effacé).
        const lignes = inventaireComplet
          .map(
            (l) =>
              `<tr>
                 <td style="padding:6px 0;font-size:13px;color:#3c3c38;">${l.libelle}</td>
                 <td style="padding:6px 0;font-size:13px;color:#1c1c1a;text-align:right;font-weight:bold;">${l.nombre}</td>
               </tr>`,
          )
          .join("");
        const totalLignes = inventaireComplet.reduce((somme, l) => somme + l.nombre, 0);

        if (demande.email) {
          await envoyerEmail(
            demande.email,
            "Votre compte ArtiFlow-pro a été supprimé — confirmation",
            `<!DOCTYPE html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px;">
      <div style="font-size:14px;font-weight:bold;letter-spacing:0.4px;color:#0f6b58;margin-bottom:16px;">ArtiFlow-pro</div>
      <div style="background:#ffffff;border:1px solid #e6e4df;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;">Votre compte a été supprimé</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#3c3c38;">
          Bonjour ${demande.entreprise || "à vous"}, la suppression définitive de votre compte ArtiFlow-pro
          a été exécutée. Ce message vaut confirmation et peut servir de preuve en cas de contestation.
        </p>
        <div style="background:#f7f6f2;border:1px solid #e6e4df;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.7;margin-bottom:18px;">
          <strong>Demande reçue le :</strong> ${dateFr(demande.demandee_le)}<br />
          <strong>Période de grâce de 30 jours respectée jusqu'au :</strong> ${dateFr(demande.prevue_le)}<br />
          <strong>Suppression effectuée le :</strong> ${dateFr(maintenant)}
        </div>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3c3c38;">
          <strong>Données effacées (${totalLignes} enregistrements) :</strong>
        </p>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #e6e4df;">
          ${lignes}
        </table>
        <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6a6a64;">
          Votre compte de connexion a été supprimé : cette adresse email n'est plus associée à un espace ArtiFlow-pro.
          Aucun prélèvement ne sera plus effectué. Les documents que vous avez déjà transmis à votre comptable ou
          à vos clients restent bien entendu entre leurs mains.
        </p>
      </div>
      <p style="margin:18px 0 0;font-size:11px;line-height:1.6;color:#8a8a84;text-align:center;">
        Conservez cet email : il constitue la preuve de la date et du périmètre de la suppression.
      </p>
    </div>
  </body>
</html>`,
          );
        }

        // 5) Clôture de la demande (la ligne d'audit reste, sans aucune donnée métier).
        await admin
          .from("suppressions_compte")
          .update({
            statut: "supprimee",
            supprimee_le: maintenant.toISOString(),
            email: null,
            entreprise: null,
            details: {
              jours_grace: 30,
              compteurs: inventaireComplet,
              total_enregistrements: totalLignes,
              email_preuve_envoye: !!demande.email,
            },
            updated_at: maintenant.toISOString(),
          })
          .eq("id", demande.id);

        resultats.push({ id: demande.id, email: demande.email, statut: "supprimee" });
      } catch (e) {
        resultats.push({
          id: demande.id,
          email: demande.email,
          statut: "erreur",
          erreur: e instanceof Error ? e.message : "erreur inconnue",
        });
      }
    }

    return json({
      ok: true,
      traites: resultats.length,
      supprimes: resultats.filter((r) => r.statut === "supprimee").length,
      erreurs: resultats.filter((r) => r.statut === "erreur").length,
      resultats,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
