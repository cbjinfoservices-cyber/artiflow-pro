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

/** Validation minimale mais suffisante d'une adresse email. */
function emailValide(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Envoie a l'artisan un email d'alerte lorsqu'un test d'envoi a echoue, afin qu'il
 * soit prevenu meme s'il a ferme l'application. Best-effort : ne doit jamais faire
 * echouer la fonction appelante.
 */
async function envoyerAlerteEchec(opts: {
  resendKey: string;
  fromDomain: string;
  emetteurNom: string;
  emailArtisan: string;
  destinataire: string;
  erreur: string;
}): Promise<void> {
  const { resendKey, fromDomain, emetteurNom, emailArtisan, destinataire, erreur } = opts;
  if (!emailArtisan) return;
  const sujet = "Alerte ArtiFlow-pro : un email de test a échoué";
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Alerte d'envoi ArtiFlow-pro</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:700;">Envoi échoué</div>
        <p style="margin:16px 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Un email de test vers <strong>${escapeHtml(destinataire)}</strong> n'a pas pu être envoyé.
          Tant que ce n'est pas réglé, vos devis, factures, relances et récaps risquent de ne pas partir.
        </p>
        <div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:10px;padding:14px;font-size:13px;color:#b91c1c;line-height:1.6;">
          Motif renvoyé : ${escapeHtml(erreur)}
        </div>
        <p style="margin:16px 0 0;font-size:13px;color:#71717a;line-height:1.6;">
          Relancez un test depuis ArtiFlow-pro une fois la configuration d'envoi vérifiée.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Alerte automatique envoyée par ArtiFlow-pro.
      </div>
    </div>
  </div>
</body></html>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${emetteurNom} <noreply@${fromDomain}>`, to: [emailArtisan], subject: sujet, html }),
    });
  } catch {
    /* une alerte qui échoue ne doit jamais remonter */
  }
}

/**
 * Envoie un email de test de l'alerte a une adresse donnee, afin que l'artisan
 * verifie que son adresse de reception recoit bien les alertes d'echec. Renvoie un
 * resultat explicite (contrairement a l'alerte automatique, best-effort).
 */
async function envoyerTestAlerte(opts: {
  resendKey: string;
  fromDomain: string;
  emetteurNom: string;
  to: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { resendKey, fromDomain, emetteurNom, to } = opts;
  const sujet = "[Test] Alerte ArtiFlow-pro : vérification de l'adresse de réception";
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Test de l'alerte d'échec ArtiFlow-pro</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;">Email de test</div>
        <p style="margin:16px 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Ceci est un email de test de l'alerte d'échec. Vous le recevez car un test a été lancé
          depuis ArtiFlow-pro.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Si ce message arrive bien dans cette boîte, votre adresse de réception est correcte : vous serez
          prévenu automatiquement si un envoi d'email venait à échouer.
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">
          Email de test envoyé le ${escapeHtml(new Date().toLocaleString("fr-FR"))}.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;
  const fromAddress = `${emetteurNom} <noreply@${fromDomain}>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress, to: [to], subject: sujet, html }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, error: body?.message || `L'API Resend a refusé l'envoi du test (code ${res.status}).` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Le service d'envoi est injoignable." };
  }
}

/**
 * Envoi d'un email de test, de bout en bout, via Resend.
 * Sert a valider que la cle API et le domaine d'envoi fonctionnent reellement.
 * Reserve aux utilisateurs connectes.
 */
/**
 * Envoie un email de test de l'alerte de taux de reussite : il montre a l'artisan a quoi
 * ressemble l'alerte (son taux actuel compare a son seuil), sans attendre une baisse reelle.
 */
async function envoyerTestAlerteTaux(opts: {
  resendKey: string;
  fromDomain: string;
  emetteurNom: string;
  to: string;
  taux: number;
  seuil: number;
  jours: number;
  total: number;
  echecs: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { resendKey, fromDomain, emetteurNom, to, taux, seuil, jours, total, echecs } = opts;
  const sousSeuil = taux < seuil;
  const couleur = sousSeuil ? "#b91c1c" : "#0f766e";
  const fond = sousSeuil ? "#fee2e2" : "#ccfbf1";
  const sujet = "[Test] Alerte ArtiFlow-pro : taux de réussite";
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:18px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Test de l'alerte de taux de réussite ArtiFlow-pro</p>
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12px;font-weight:700;">Email de test</div>
        <p style="margin:16px 0 12px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Voici à quoi ressemblerait l'alerte si votre taux de réussite passait sous le seuil que vous avez défini.
          C'est un email de démonstration : il montre votre taux <strong>actuel</strong>.
        </p>
        <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:${fond};color:${couleur};font-size:12px;font-weight:700;">
          ${sousSeuil ? "Sous le seuil" : "Au-dessus du seuil"}
        </div>
        <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:16px;font-size:13px;margin:16px 0 18px;">
          <p style="margin:0 0 6px;color:#71717a;">Taux de réussite (${jours} j) : <strong style="color:${couleur};">${taux}%</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Seuil réglé : <strong style="color:#18181b;">${seuil}%</strong></p>
          <p style="margin:0 0 6px;color:#71717a;">Emails de test sur la période : <strong style="color:#18181b;">${total}</strong></p>
          <p style="margin:0;color:${couleur};">Échecs : <strong>${echecs}</strong></p>
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;line-height:1.6;">
          Dans la vraie alerte, ce message vous est envoyé automatiquement une seule fois par période,
          quand votre taux reste sous le seuil sur ${jours} jours.
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">
          Email de test envoyé le ${escapeHtml(new Date().toLocaleString("fr-FR"))}.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;
  const fromAddress = `${emetteurNom} <noreply@${fromDomain}>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress, to: [to], subject: sujet, html }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, error: body?.message || `L'API Resend a refusé l'envoi du test (code ${res.status}).` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Le service d'envoi est injoignable." };
  }
}

/**
 * Ajoute un bandeau visible en tete d'un email rejoue en « test a blanc », pour bien
 * marquer qu'il ne s'adresse a aucun destinataire reel (c'est une copie de validation).
 */
function avecBandeauBlanc(html: string, emetteurNom: string): string {
  const bandeau = `<div style="max-width:640px;margin:0 auto;padding:12px 24px 0;">
  <div style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;border-radius:10px;padding:12px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;line-height:1.5;">
    TEST A BLANC (ArtiFlow-pro) - Ce message reproduit un envoi automatique de ${escapeHtml(emetteurNom)}, mais n'a ete adresse a aucun destinataire reel (client, comptable ou artisan cible).
  </div>
</div>`;
  const m = /<body[^>]*>/i.exec(html);
  if (!m) return bandeau + html;
  const fin = (m.index ?? 0) + m[0].length;
  return html.slice(0, fin) + bandeau + html.slice(fin);
}

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

    // Authentification obligatoire (l'outil reste interne a l'application).
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
    if (!emailValide(to)) {
      return json({ ok: false, error: "Renseignez une adresse email valide pour le test." }, 400);
    }

    // Client service-role reserve a la lecture du profil et a l'historisation.
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null;

    // Consigne chaque tentative d'envoi (adresse, resultat, message) pour garder
    // une trace des validations. Ne doit jamais faire echouer l'envoi.
    const journaliser = async (
      destinataire: string,
      expediteur: string | null,
      resultat: "succes" | "echec",
      message: string | null,
    ) => {
      if (!admin) return;
      try {
        await admin.from("email_test_historique").insert({
          user_id: user.id,
          destinataire,
          expediteur,
          resultat,
          message,
        });
      } catch {
        /* l'historisation ne doit jamais faire echouer l'envoi */
      }
    };

    // Nom d'emetteur : l'entreprise du profil si disponible, sinon un libelle generique.
    // On recupere aussi le reglage d'alerte (interrupteur + adresse de reception) pour
    // prevenir l'artisan en cas d'echec, uniquement s'il l'a active.
    let emetteurNom = "ArtiFlow-pro";
    let emailAlerte = "";
    let alerteActive = true;
    // Reglages de l'alerte de taux (seuil + fenetre) : utilises par le mode « test alerte de taux ».
    let tauxSeuil = 70;
    let tauxJours = 7;
    if (admin) {
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select(
            "entreprise, metier, email, alerte_echec_test_actif, alerte_echec_test_email, taux_alerte_seuil, taux_alerte_jours",
          )
          .eq("id", user.id)
          .maybeSingle();
        const nom = (profile?.entreprise || profile?.metier || "").trim();
        if (nom) emetteurNom = nom;
        // L'interrupteur est actif par defaut ; l'adresse personnalisee prime sur celle du compte.
        alerteActive = profile?.alerte_echec_test_actif !== false;
        emailAlerte = String(profile?.alerte_echec_test_email ?? "").trim() || String(profile?.email ?? "").trim();
        if (Number.isFinite(Number(profile?.taux_alerte_seuil))) tauxSeuil = Number(profile?.taux_alerte_seuil);
        if (Number.isFinite(Number(profile?.taux_alerte_jours))) tauxJours = Number(profile?.taux_alerte_jours);
      } catch {
        /* le nom d'emetteur n'est pas bloquant */
      }
    }

    // Mode « test de l'alerte » : on expédie volontairement un email à l'adresse de
    // réception pour vérifier qu'elle reçoit bien les alertes, sans journaliser de test.
    if (payload?.alerteTest === true) {
      const resultat = await envoyerTestAlerte({ resendKey, fromDomain, emetteurNom, to });
      if (!resultat.ok) return json({ ok: false, error: resultat.error }, 502);
      // Consigne la reussite du test d'alerte : permet de conserver la date du dernier test
      // reussi comme preuve que l'adresse recoit bien les alertes.
      if (admin) {
        try {
          await admin
            .from("profiles")
            .update({ alerte_echec_test_dernier_ok_at: new Date().toISOString() })
            .eq("id", user.id);
        } catch {
          /* l'horodatage ne doit jamais faire echouer le test */
        }
      }
      return json({ ok: true, to, fromAddress: `${emetteurNom} <noreply@${fromDomain}>` });
    }

    // Mode « test de l'alerte de taux » : on expédie une alerte de démonstration avec le
    // taux de réussite actuel de l'artisan et son seuil réglé, afin qu'il vérifie le rendu
    // et la réception de l'alerte, sans attendre une baisse réelle du taux.
    if (payload?.tauxTest === true) {
      const seuil = Math.min(100, Math.max(1, Math.round(Number(tauxSeuil) || 70)));
      const jours = Math.min(60, Math.max(1, Math.round(Number(tauxJours) || 7)));
      const depuis = new Date(Date.now() - jours * 86400000).toISOString();
      let taux = 0;
      let total = 0;
      let echecs = 0;
      if (admin) {
        try {
          const { data: tests } = await admin
            .from("email_test_historique")
            .select("resultat")
            .eq("user_id", user.id)
            .gte("created_at", depuis);
          const rows = (tests ?? []) as Array<{ resultat?: string }>;
          total = rows.length;
          const succes = rows.filter((r) => String(r.resultat ?? "") === "succes").length;
          echecs = total - succes;
          taux = total > 0 ? Math.round((succes / total) * 100) : 0;
        } catch {
          /* le taux n'est pas bloquant pour un test */
        }
      }
      const resultat = await envoyerTestAlerteTaux({
        resendKey,
        fromDomain,
        emetteurNom,
        to,
        taux,
        seuil,
        jours,
        total,
        echecs,
      });
      if (!resultat.ok) return json({ ok: false, error: resultat.error }, 502);
      // Journalise l'envoi (marque « test ») pour qu'il apparaisse dans l'historique des alertes.
      if (admin) {
        try {
          await admin.from("taux_alerte_historique").insert({
            user_id: user.id,
            taux,
            seuil,
            jours,
            total,
            echecs,
            manuel: true,
          });
        } catch {
          /* l'historisation ne doit jamais faire echouer l'envoi */
        }
      }
      return json({ ok: true, to, fromAddress: `${emetteurNom} <noreply@${fromDomain}>` });
    }

    // Mode « test a blanc » : on rejoue le contenu EXACT d'une automatisation (construit en
    // amont par son apercu) vers un destinataire de test. Aucun destinataire reel n'est touche ;
    // l'envoi est journalise comme test pour ne pas fausser l'historique des envois metier.
    if (payload?.blanc === true) {
      const sujet = String(payload?.subject ?? "").trim() || "[Test a blanc] Envoi automatique ArtiFlow-pro";
      const htmlRejoue = String(payload?.html ?? "").trim();
      if (!htmlRejoue) return json({ ok: false, error: "Aucun contenu a rejouer pour ce test a blanc." }, 400);
      const fromAddressBlanc = `${emetteurNom} <noreply@${fromDomain}>`;
      const htmlBlanc = avecBandeauBlanc(htmlRejoue, emetteurNom);
      let resBlanc: Response;
      let dataBlanc: { id?: string; message?: string } | null;
      try {
        resBlanc = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: fromAddressBlanc, to: [to], subject: sujet, html: htmlBlanc }),
        });
        dataBlanc = (await resBlanc.json().catch(() => null)) as { id?: string; message?: string } | null;
      } catch (netErr) {
        const erreur = netErr instanceof Error ? netErr.message : "Le service d'envoi est injoignable.";
        await journaliser(to, fromAddressBlanc, "echec", `[Test a blanc] ${erreur}`);
        return json({ ok: false, error: erreur }, 502);
      }
      if (!resBlanc.ok) {
        const erreur =
          dataBlanc?.message || `L'API Resend a refuse l'envoi du test a blanc (code ${resBlanc.status}).`;
        await journaliser(to, fromAddressBlanc, "echec", `[Test a blanc] ${erreur}`);
        return json({ ok: false, error: erreur }, 502);
      }
      await journaliser(to, fromAddressBlanc, "succes", "[Test a blanc] Envoi rejoue vers un destinataire de test.");
      return json({ ok: true, id: dataBlanc?.id ?? null, to, fromAddress: fromAddressBlanc });
    }

    // Envoi de l'alerte seulement si l'artisan l'a activee et qu'une adresse est disponible.
    const alerterSiBesoin = async (destinataire: string, erreur: string) => {
      if (!alerteActive || !emailAlerte) return;
      await envoyerAlerteEchec({
        resendKey,
        fromDomain,
        emetteurNom,
        emailArtisan: emailAlerte,
        destinataire,
        erreur,
      });
    };

    const fromAddress = `${emetteurNom} <noreply@${fromDomain}>`;
    const subject = "Test d'envoi ArtiFlow-pro — configuration email validée";
    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="padding:24px;border-bottom:1px solid #eee;">
        <p style="margin:0;font-size:20px;font-weight:700;">${escapeHtml(emetteurNom)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Test d'envoi via ArtiFlow-pro</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;">Bonjour,</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">
          Cet email confirme que votre configuration d'envoi fonctionne de bout en bout :
          la clé API Resend est valide et le domaine <strong>${escapeHtml(fromDomain)}</strong> expédie correctement.
        </p>
        <p style="margin:0;font-size:13px;color:#71717a;">
          Vos devis, factures, relances et récaps partenaires pourront bien partir depuis cette adresse.
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">
          Email de test envoyé à ${escapeHtml(to)} le ${escapeHtml(new Date().toLocaleString("fr-FR"))}.
        </p>
      </div>
      <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#a1a1aa;text-align:center;">
        Email envoyé via ArtiFlow-pro pour ${escapeHtml(emetteurNom)}.
      </div>
    </div>
  </div>
</body></html>`;

    // On tente l'envoi : le service peut refuser (reponse non-ok) ou etre injoignable.
    let res: Response;
    let resendData: { id?: string; message?: string } | null;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromAddress, to: [to], subject, html }),
      });
      resendData = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    } catch (netErr) {
      const erreur =
        netErr instanceof Error ? netErr.message : "Le service d'envoi est injoignable.";
      await journaliser(to, fromAddress, "echec", erreur);
      await alerterSiBesoin(to, erreur);
      return json({ ok: false, error: erreur }, 502);
    }

    if (!res.ok) {
      const erreur =
        resendData?.message || `L'API Resend a refusé l'envoi du test (code ${res.status}).`;
      await journaliser(to, fromAddress, "echec", erreur);
      // Alerte l'artisan par email : il est ainsi prevenu meme s'il ferme l'application.
      await alerterSiBesoin(to, erreur);
      return json({ ok: false, error: erreur }, 502);
    }

    await journaliser(to, fromAddress, "succes", null);
    return json({ ok: true, id: resendData?.id ?? null, to, fromAddress });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
