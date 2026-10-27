/**
 * Envoi de SMS et de messages WhatsApp partagé par les fonctions : Brevo en priorité,
 * Twilio en repli. Même principe que l'envoi d'emails (_shared/envoiEmail.ts).
 *
 * Réglages (secrets Supabase) :
 *   - Brevo   : BREVO_API_KEY (droits d'envoi SMS / WhatsApp), BREVO_SMS_SENDER (nom affiché,
 *               11 caractères max), BREVO_WHATSAPP_NUMBER (numéro WhatsApp Business relié à Brevo) ;
 *   - Twilio  : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM, TWILIO_WHATSAPP_FROM.
 *
 * WhatsApp : quand l'entreprise écrit la première (relances), WhatsApp n'accepte que des modèles
 * validés par Meta. L'envoi en texte libre ne passe que dans les 24 h qui suivent un message du
 * client. Les modèles seront branchés ici dès qu'ils seront validés.
 */

export type CanalMessage = "sms" | "whatsapp";

export type ResultatMessage = {
  ok: boolean;
  fournisseur: "brevo" | "twilio" | "aucun";
  id?: string;
  error?: string;
};

const lire = (nom: string): string => (Deno.env.get(nom) ?? "").trim();

function brevoPret(canal: CanalMessage): boolean {
  return Boolean(lire("BREVO_API_KEY") && (canal === "sms" ? lire("BREVO_SMS_SENDER") : lire("BREVO_WHATSAPP_NUMBER")));
}

function twilioPret(canal: CanalMessage): boolean {
  return Boolean(
    lire("TWILIO_ACCOUNT_SID") && lire("TWILIO_AUTH_TOKEN") &&
      (canal === "sms" ? lire("TWILIO_SMS_FROM") : lire("TWILIO_WHATSAPP_FROM")),
  );
}

/** Vrai si au moins un service sait envoyer sur ce canal. */
export function messagerieConfiguree(canal: CanalMessage): boolean {
  return brevoPret(canal) || twilioPret(canal);
}

/** Message d'erreur lisible quand aucun service n'est configuré pour ce canal. */
export function messageNonConfigure(canal: CanalMessage): string {
  return canal === "sms"
    ? "L'envoi de SMS n'est pas encore configuré (Brevo : clé API et nom d'expéditeur, ou Twilio)."
    : "L'envoi WhatsApp n'est pas encore configuré (Brevo : clé API et numéro WhatsApp Business, ou Twilio).";
}

/** Caractères de l'alphabet SMS standard (GSM 03.38) : au-delà, le SMS doit partir en Unicode. */
const GSM =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€";
const besoinUnicode = (texte: string) => [...texte].some((c) => !GSM.includes(c));

async function viaBrevo(canal: CanalMessage, to: string, texte: string): Promise<ResultatMessage> {
  const cle = lire("BREVO_API_KEY");
  const numero = to.replace(/^\+/, "");
  const [url, corps] = canal === "sms"
    ? [
      "https://api.brevo.com/v3/transactionalSMS/sms",
      { sender: lire("BREVO_SMS_SENDER"), recipient: numero, content: texte, type: "transactional", unicodeEnabled: besoinUnicode(texte) },
    ]
    : [
      "https://api.brevo.com/v3/whatsapp/sendMessage",
      { senderNumber: lire("BREVO_WHATSAPP_NUMBER").replace(/^\+/, ""), contactNumbers: [numero], text: texte },
    ];
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "api-key": cle, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(corps),
    });
    const data = (await res.json().catch(() => null)) as { messageId?: string | number; reference?: string; message?: string } | null;
    if (res.ok) return { ok: true, fournisseur: "brevo", id: String(data?.messageId ?? data?.reference ?? "") || undefined };
    return { ok: false, fournisseur: "brevo", error: data?.message || `Brevo a refusé l'envoi (code ${res.status}).` };
  } catch (e) {
    return { ok: false, fournisseur: "brevo", error: e instanceof Error ? e.message : "Brevo est injoignable." };
  }
}

async function viaTwilio(canal: CanalMessage, to: string, texte: string): Promise<ResultatMessage> {
  const sid = lire("TWILIO_ACCOUNT_SID");
  const depuis = canal === "sms" ? lire("TWILIO_SMS_FROM") : lire("TWILIO_WHATSAPP_FROM");
  const form = new URLSearchParams();
  form.set("To", canal === "whatsapp" ? `whatsapp:${to}` : to);
  form.set("From", canal === "whatsapp" ? `whatsapp:${depuis}` : depuis);
  form.set("Body", texte);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${lire("TWILIO_AUTH_TOKEN")}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => null)) as { sid?: string; message?: string } | null;
    if (res.ok) return { ok: true, fournisseur: "twilio", id: data?.sid };
    return { ok: false, fournisseur: "twilio", error: data?.message || `Twilio a refusé l'envoi (code ${res.status}).` };
  } catch (e) {
    return { ok: false, fournisseur: "twilio", error: e instanceof Error ? e.message : "Twilio est injoignable." };
  }
}

/**
 * Envoie un SMS ou un WhatsApp au numéro `to` (format international, ex. +33612345678).
 * Brevo d'abord s'il est configuré pour ce canal, puis Twilio en repli.
 */
export async function envoyerMessage(canal: CanalMessage, to: string, texte: string): Promise<ResultatMessage> {
  let echec: ResultatMessage | null = null;
  if (brevoPret(canal)) {
    const r = await viaBrevo(canal, to, texte);
    if (r.ok) return r;
    echec = r;
  }
  if (twilioPret(canal)) {
    const r = await viaTwilio(canal, to, texte);
    if (r.ok || !echec) return r;
    return { ...r, error: `${echec.error} — repli Twilio : ${r.error}` };
  }
  return echec ?? { ok: false, fournisseur: "aucun", error: messageNonConfigure(canal) };
}
