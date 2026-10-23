import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Fonction d'escalade automatique des relances en retard.
// Elle est prévue pour tourner SANS session utilisateur : elle est appelée
// par une tâche planifiée (voir Agents → Tâches planifiées) toutes les heures,
// 24/7, même si personne n'ouvre l'application.
//
// À chaque passage, elle journalise son action (heure + nombre d'envois) dans
// la table `escalade_journal` (visible dans la page Relances) et envoie un
// email récapitulatif à l'artisan avec la liste des clients relancés.

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

interface DocIdentite {
  accent: string;
  logoHtml: string;
  piedHtml: string;
}

/**
 * Identité visuelle des documents reprise du profil de l'artisan : couleur d'accent,
 * logo (optionnel) et message de pied de page. Reprise dans les relances automatiques
 * et les emails récapitulatifs pour une identité cohérente avec les PDF et les devis.
 */
function docIdentite(p: Record<string, unknown>): DocIdentite {
  const nom = String(p?.entreprise ?? p?.metier ?? "Votre artisan");
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(p?.doc_couleur ?? "")) ? String(p?.doc_couleur) : "#C4783A";
  const logoUrl = p?.doc_afficher_logo !== false ? String(p?.logo_url ?? "").trim() : "";
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(nom)}" style="max-height:44px;max-width:180px;display:block;margin:0 0 10px;">`
    : "";
  const pied = String(p?.doc_pied_page ?? "").trim();
  const piedHtml = pied
    ? `<p style="margin:10px 0 0;font-size:11px;color:#a1a1aa;">${escapeHtml(pied).replace(/\n/g, "<br>")}</p>`
    : "";
  return { accent, logoHtml, piedHtml };
}

function isoTodayUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Nombre de jours entiers écoulés depuis une date prévue (0 si non dépassée). */
function joursDeRetard(datePrevue: string): number {
  const d = Date.parse(`${String(datePrevue).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d)) return 0;
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((todayUTC - d) / 86400000));
}

/** Une relance est active sauf si son statut indique une mise en pause. */
function isActive(statut: string): boolean {
  const v = String(statut ?? "").trim().toLowerCase();
  return !(v.includes("pause") || v.includes("inactif") || v.includes("désactiv") || v.includes("desactiv"));
}

function normalizeCanal(raw: unknown): "Email" | "SMS" | "WhatsApp" {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v.includes("sms")) return "SMS";
  if (v.includes("whats")) return "WhatsApp";
  return "Email";
}

/** Normalise un numéro français vers le format E.164 attendu par Twilio. */
function toE164(raw: unknown, defaultCountry = "+33"): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (hasPlus) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `${defaultCountry}${digits.slice(1)}`;
  return `+${digits}`;
}

/** Applique un modèle de sujet contenant des variables type {{client}}. */
function applyTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => values[key.toLowerCase()] ?? "");
}

/** Construit l'email récapitulatif envoyé à l'artisan après un passage d'escalade. */
function buildRecapHtml(
  nom: string,
  envoye: number,
  echoue: number,
  clients: Array<{ nom: string; canal: string; numero: string; jours: number }>,
  echoues: Array<{ nom: string; canal: string; numero: string; jours: number; erreur: string }> = [],
  identite: DocIdentite,
): string {
  const lignes = clients
    .map(
      (c) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#18181b;">${escapeHtml(
          c.nom || "Client",
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#52525b;">${escapeHtml(
          c.numero || "—",
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#52525b;">${escapeHtml(
          c.canal,
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right;color:${
          c.jours >= 30 ? "#b91c1c" : "#52525b"
        };">${c.jours} j</td>
      </tr>`,
    )
    .join("");

  // Détail des clients non envoyés, avec le motif d'échec (email/téléphone manquant, service non configuré…).
  const blocEchecs =
    echoues.length > 0
      ? `<p style="margin:18px 0 8px;font-size:13px;font-weight:700;color:#b91c1c;">Non envoyés (${echoues.length})</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Client</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Dossier</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Canal</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Motif</th>
          </tr>
        </thead>
        <tbody>
          ${echoues
            .map(
              (c) => `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid #fee2e2;font-size:13px;color:#b91c1c;">${escapeHtml(
              c.nom || "Client",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #fee2e2;font-size:13px;color:#52525b;">${escapeHtml(
              c.numero || "—",
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #fee2e2;font-size:13px;color:#52525b;">${escapeHtml(
              c.canal,
            )}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #fee2e2;font-size:12px;color:#b91c1c;">${escapeHtml(
              c.erreur || "Envoi impossible.",
            )}</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>`
      : "";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="height:6px;background:${identite.accent};"></div>
      <div style="padding:24px;">
      ${identite.logoHtml}
      <p style="margin:0 0 4px;font-size:18px;font-weight:700;">${escapeHtml(nom)}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#71717a;">Escalade automatique des relances en retard</p>
      <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:13px;font-weight:700;">
        ${envoye} relance${envoye > 1 ? "s" : ""} envoyée${envoye > 1 ? "s" : ""} automatiquement
      </div>
      ${
        echoue > 0
          ? `<p style="margin:12px 0 0;font-size:13px;color:#b91c1c;">${echoue} envoi${
              echoue > 1 ? "s" : ""
            } a échoué (voir le détail ci-dessous).</p>`
          : ""
      }
      ${blocEchecs}
      ${lignes ? `<p style="margin:18px 0 8px;font-size:13px;font-weight:700;color:#18181b;">Clients relancés</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Client</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Dossier</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Canal</th>
            <th style="text-align:right;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Retard</th>
          </tr>
        </thead>
        <tbody>${lignes}</tbody>
      </table>` : ""}
      <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">Email automatique envoyé par ArtiFlow-pro après un passage d'escalade planifié.</p>
      ${identite.piedHtml}
      </div>
    </div>
  </div>
</body></html>`;
}

/** Construit l'email d'alerte immédiat envoyé à l'artisan dès qu'un échec d'envoi est détecté. */
function buildAlerteHtml(
  nom: string,
  echoue: number,
  echoues: Array<{ nom: string; canal: string; numero: string; jours: number; erreur: string }>,
  identite: DocIdentite,
): string {
  const lignes = echoues
    .map(
      (c) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #fee2e2;font-size:13px;color:#b91c1c;">${escapeHtml(
          c.nom || "Client",
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #fee2e2;font-size:13px;color:#52525b;">${escapeHtml(
          c.numero || "—",
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #fee2e2;font-size:13px;color:#52525b;">${escapeHtml(
          c.canal,
        )}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #fee2e2;font-size:12px;color:#b91c1c;">${escapeHtml(
          c.erreur || "Envoi impossible.",
        )}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #fecaca;">
      <div style="height:6px;background:${identite.accent};"></div>
      <div style="padding:24px;">
      ${identite.logoHtml}
      <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#b91c1c;">Échec d'envoi détecté</p>
      <p style="margin:0 0 16px;font-size:13px;color:#71717a;">${escapeHtml(
        nom,
      )} · alerte automatique ArtiFlow-pro</p>
      <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:13px;font-weight:700;">
        ${echoue} envoi${echoue > 1 ? "s" : ""} en échec
      </div>
      <p style="margin:14px 0 0;font-size:13px;line-height:1.7;color:#3f3f46;">
        Un passage d'escalade vient d'enregistrer un nouvel échec. Une fois le problème réglé (souvent Resend ou Twilio non configuré, ou une coordonnée client manquante), vous pouvez relancer les envois ratés en un clic depuis la page Relances.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Client</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Dossier</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Canal</th>
            <th style="text-align:left;padding:6px 10px;font-size:11px;color:#71717a;text-transform:uppercase;">Motif</th>
          </tr>
        </thead>
        <tbody>${lignes}</tbody>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#a1a1aa;">Email automatique envoyé par ArtiFlow-pro après un passage d'escalade planifié.</p>
      ${identite.piedHtml}
      </div>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // `userId` optionnel : passé par le bouton « Lancer maintenant » de l'app
    // pour ne traiter QUE les relances de l'artisan concerné. Quand il est absent
    // (appel de la tâche planifiée), la fonction traite tous les artisans.
    const parsed = req.method === "POST" ? await req.json().catch(() => null) : null;
    const body = (parsed ?? Object.create(null)) as Record<string, unknown>;
    const scopeUserId = typeof body?.userId === "string" && body.userId ? String(body.userId) : null;
    // Mode « Réessayer les échecs » : liste d'ids de relances à retraiter en priorité (court-circuite le seuil).
    const retryIds = new Set<number>(
      Array.isArray(body?.retryIds)
        ? (body.retryIds as unknown[])
            .map((v) => Number(v))
            .filter((v) => Number.isFinite(v))
        : [],
    );
    const retryMode = retryIds.size > 0;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const smsFrom = Deno.env.get("TWILIO_SMS_FROM");
    const whatsappFrom = Deno.env.get("TWILIO_WHATSAPP_FROM");

    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const today = isoTodayUTC();

    // 1) Réglages par utilisateur (escalade activée, seuil de reprogrammations, seuil de retard).
    let profilesQuery = admin
      .from("profiles")
      .select(
        "id, entreprise, metier, telephone, email, logo_url, doc_couleur, doc_afficher_logo, doc_pied_page, email_sujet_relance, relance_auto_actif, relance_seuil, relance_escalade_retard, pause_jusqu_au",
      );
    if (scopeUserId) profilesQuery = profilesQuery.eq("id", scopeUserId);
    const { data: profiles, error: profError } = await profilesQuery;
    if (profError) return json({ ok: false, error: profError.message }, 500);

    const settingsByUser = new Map<
      string,
      { seuil: number; retardSeuil: number; nom: string; sujet: string; email: string; auto: boolean; paused: boolean; identite: DocIdentite }
    >();
    const todayPause = new Date().toISOString().slice(0, 10);
    (profiles ?? []).forEach((p) => {
      const row = p as Record<string, unknown>;
      // Pause vacances : coupe les relances automatiques planifiées (mais un
      // déclenchement manuel depuis l'app reste possible).
      const enPause = row.pause_jusqu_au ? String(row.pause_jusqu_au).slice(0, 10) >= todayPause : false;
      settingsByUser.set(String(row.id), {
        seuil: Number(row.relance_seuil ?? 3) || 3,
        retardSeuil: Number(row.relance_escalade_retard ?? 30) || 30,
        nom: String(row.entreprise ?? row.metier ?? "Votre artisan"),
        sujet: String(row.email_sujet_relance ?? ""),
        email: String(row.email ?? ""),
        auto: row.relance_auto_actif !== false,
        paused: enPause && !scopeUserId,
        identite: docIdentite(row),
      });
    });

    // 2) Relances non envoyées dont la date prévue est dépassée.
    const { data: relances, error: relError } = await admin
      .from("relances")
      .select("id, devis_id, canal, statut, message, date_prevue, reprogrammations, devis(id, user_id, numero, client_id)")
      .neq("statut", "Envoyée")
      .lt("date_prevue", today);
    if (relError) return json({ ok: false, error: relError.message }, 500);

    // 3) Sélection des candidats selon les réglages de chaque artisan.
    const candidates: Array<{
      id: number;
      devisId: number;
      userId: string;
      canal: "Email" | "SMS" | "WhatsApp";
      message: string;
      numero: string;
      clientId: number | null;
      jours: number;
      config: { seuil: number; retardSeuil: number; nom: string; sujet: string; email: string; identite: DocIdentite };
    }> = [];

    // Nombre de relances en retard par artisan (sert à savoir si un passage les a concernés).
    const lateByUser = new Map<string, number>();

    for (const raw of relances ?? []) {
      const r = raw as Record<string, unknown>;
      const devisRow = Array.isArray(r.devis) ? (r.devis[0] as Record<string, unknown> | undefined) : (r.devis as Record<string, unknown> | null);
      const userId = devisRow?.user_id ? String(devisRow.user_id) : null;
      if (!userId) continue;
      // Mode « Lancer maintenant » : on ignore les autres artisans.
      if (scopeUserId && userId !== scopeUserId) continue;
      const config = settingsByUser.get(userId);
      if (!config || !config.auto || config.paused) continue;
      if (!isActive(String(r.statut ?? ""))) continue;
      const jours = joursDeRetard(String(r.date_prevue));
      if (jours < 1) continue;
      const relanceId = Number(r.id);
      // En mode réessai, on ne traite que les relances explicitement demandées,
      // sans re-appliquer le seuil (on relance justement ce qui avait échoué).
      if (retryMode && !retryIds.has(relanceId)) continue;
      lateByUser.set(userId, (lateByUser.get(userId) ?? 0) + 1);
      if (!retryMode && Number(r.reprogrammations ?? 0) < config.seuil && jours < config.retardSeuil) continue;
      candidates.push({
        id: Number(r.id),
        devisId: Number(devisRow?.id ?? r.devis_id),
        userId,
        canal: normalizeCanal(r.canal),
        message: String(r.message ?? "").trim(),
        numero: String(devisRow?.numero ?? ""),
        clientId: devisRow?.client_id != null ? Number(devisRow.client_id) : null,
        jours,
        config,
      });
    }

    let envoye = 0;
    let echoue = 0;
    const erreurs: Array<{ relanceId: number; error: string }> = [];

    // Résultats cumulés par artisan, pour le journal et l'email récapitulatif.
    const resultsByUser = new Map<
      string,
      {
        examined: number;
        envoye: number;
        echoue: number;
        clients: Array<{ nom: string; canal: string; numero: string; jours: number }>;
        echoues: Array<{ nom: string; canal: string; numero: string; jours: number; erreur: string }>;
        relancesEchouees: number[];
        config: { nom: string; email: string; identite: DocIdentite };
      }
    >();
    const resultFor = (c: (typeof candidates)[number]) => {
      let res = resultsByUser.get(c.userId);
      if (!res) {
        res = {
          examined: 0,
          envoye: 0,
          echoue: 0,
          clients: [],
          echoues: [],
          relancesEchouees: [],
          config: { nom: c.config.nom, email: c.config.email, identite: c.config.identite },
        };
        resultsByUser.set(c.userId, res);
      }
      return res;
    };

    for (const c of candidates) {
      const res = resultFor(c);
      res.examined += 1;
      // Nom conservé hors du try pour pouvoir tracer le client même en cas d'échec.
      let clientNom = "Client";
      try {
        const { data: clientData } = c.clientId
          ? await admin.from("clients").select("nom, email, telephone").eq("id", c.clientId).maybeSingle()
          : { data: null };
        const client = clientData as { nom?: string; email?: string; telephone?: string } | null;
        clientNom = String(client?.nom ?? "Client");
        const message =
          c.message || `Bonjour ${client?.nom ?? ""}, un rappel concernant votre dossier ${c.numero}.`;
        let destinataire = "";

        if (c.canal === "Email") {
          if (!resendKey || !fromDomain) throw new Error("Resend non configuré (clé API + domaine).");
          if (!client?.email) throw new Error("Ce client n'a pas d'adresse email.");
          const subject = c.config.sujet
            ? applyTemplate(c.config.sujet, {
                client: client.nom ?? "",
                entreprise: c.config.nom,
                numero: c.numero,
              })
            : `Relance · Dossier ${c.numero}`;
          const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
      <div style="height:6px;background:${c.config.identite.accent};"></div>
      <div style="padding:24px;">
      ${c.config.identite.logoHtml}
      <p style="margin:0 0 12px;font-size:18px;font-weight:700;">${escapeHtml(c.config.nom)}</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#3f3f46;">${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      <p style="margin:0;font-size:12px;color:#a1a1aa;">Relance automatique envoyée via ArtiFlow-pro.</p>
      ${c.config.identite.piedHtml}
      </div>
    </div>
  </div>
</body></html>`;
          const resMail = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `${c.config.nom} <noreply@${fromDomain}>`,
              to: [client.email],
              subject,
              html,
            }),
          });
          if (!resMail.ok) throw new Error("L'envoi de l'email automatique a échoué.");
          destinataire = client.email;
        } else {
          if (!twilioSid || !twilioToken) throw new Error("Twilio non configuré (Account SID + Auth Token).");
          const fromNumber = c.canal === "WhatsApp" ? whatsappFrom : smsFrom;
          if (!fromNumber) throw new Error("Numéro d'envoi Twilio manquant pour ce canal.");
          const to = toE164(client?.telephone);
          if (!to) throw new Error("Ce client n'a pas de numéro de téléphone valide.");
          const isWhatsapp = c.canal === "WhatsApp";
          const form = new URLSearchParams();
          form.set("To", isWhatsapp ? `whatsapp:${to}` : to);
          form.set("From", isWhatsapp ? `whatsapp:${fromNumber}` : fromNumber);
          form.set("Body", message);
          const resSms = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
          });
          if (!resSms.ok) throw new Error("L'envoi automatique du message a échoué.");
          destinataire = to;
        }

        await admin
          .from("relances")
          .update({ statut: "Envoyée", escalade_auto: true, escalade_le: new Date().toISOString() })
          .eq("id", c.id);
        await admin.from("envois_email").insert({
          user_id: c.userId,
          facture_id: null,
          devis_id: c.devisId,
          relance_id: c.id,
          type: "relance",
          canal: c.canal.toLowerCase(),
          groupe: true,
          destinataire,
          sujet: message.slice(0, 120),
        });
        envoye += 1;
        res.envoye += 1;
        res.clients.push({ nom: clientNom, canal: c.canal, numero: c.numero, jours: c.jours });
      } catch (e) {
        echoue += 1;
        res.echoue += 1;
        const msg = e instanceof Error ? e.message : "Erreur inconnue.";
        erreurs.push({ relanceId: c.id, error: msg });
        res.echoues.push({ nom: clientNom, canal: c.canal, numero: c.numero, jours: c.jours, erreur: msg });
        res.relancesEchouees.push(c.id);
      }
    }

    // 4) Journal de chaque passage : on enregistre un passage par artisan concerné,
    //    avec le nombre d'envois du passage.
    let journalises = 0;
    let recapEmails = 0;
    let alertEmails = 0;
    for (const [userId, res] of resultsByUser.entries()) {
      try {
        await admin.from("escalade_journal").insert({
          user_id: userId,
          examined: res.examined,
          envoye: res.envoye,
          echoue: res.echoue,
          clients: res.clients,
          clients_echoues: res.echoues,
          relances_echouees: res.relancesEchouees,
        });
        journalises += 1;
      } catch {
        /* le journal est best-effort : il ne doit pas faire échouer l'escalade */
      }

      // Alerte email immédiate à l'artisan dès qu'un échec est enregistré (en plus du
      // bandeau in-app), même si aucun envoi n'a réussi lors de ce passage.
      if (res.echoue > 0 && res.config.email && resendKey && fromDomain) {
        try {
          const html = buildAlerteHtml(res.config.nom, res.echoue, res.echoues, res.config.identite);
          const resAlert = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `${res.config.nom} <noreply@${fromDomain}>`,
              to: [res.config.email],
              subject: `Échec d'envoi détecté · ${res.echoue} relance${res.echoue > 1 ? "s" : ""} non envoyée${
                res.echoue > 1 ? "s" : ""
              }`,
              html,
            }),
          });
          if (resAlert.ok) alertEmails += 1;
        } catch {
          /* l'alerte email est best-effort : elle ne doit pas faire échouer l'escalade */
        }
      }

      // Email récapitulatif à l'artisan (uniquement s'il y a eu au moins un envoi).
      if (res.envoye > 0 && res.config.email && resendKey && fromDomain) {
        try {
          const html = buildRecapHtml(res.config.nom, res.envoye, res.echoue, res.clients, res.echoues, res.config.identite);
          const resRecap = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `${res.config.nom} <noreply@${fromDomain}>`,
              to: [res.config.email],
              subject: `Escalade automatique · ${res.envoye} relance${res.envoye > 1 ? "s" : ""} envoyée${
                res.envoye > 1 ? "s" : ""
              }`,
              html,
            }),
          });
          if (resRecap.ok) recapEmails += 1;
        } catch {
          /* l'email récap est best-effort : il ne doit pas faire échouer l'escalade */
        }
      }
    }

    // Passages sans envoi mais avec des retards examinés : on les journalise quand même
    // pour garder une trace du passage même s'il n'y avait rien à escalader.
    for (const [userId, count] of lateByUser.entries()) {
      if (resultsByUser.has(userId)) continue;
      if (count <= 0) continue;
      try {
        await admin.from("escalade_journal").insert({
          user_id: userId,
          examined: 0,
          envoye: 0,
          echoue: 0,
          clients: [],
          relances_echouees: [],
        });
        journalises += 1;
      } catch {
        /* best-effort */
      }
    }

    return json({ ok: true, examined: candidates.length, envoye, echoue, journalises, recapEmails, alertEmails, erreurs });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
