/**
 * Envoi d'emails partagé par toutes les fonctions : Brevo en priorité, Resend en repli.
 *
 * Les fonctions ont été écrites pour l'API Resend. Plutôt que de réécrire chacune, elles appellent
 * `envoyerEmail(url, init)` exactement comme elles appelaient `fetch` vers Resend : la requête
 * (format Resend) est traduite pour Brevo, et la réponse renvoyée garde la forme Resend
 * (`{ id }` en cas de succès, `{ message }` en cas d'échec). L'en-tête `x-fournisseur` indique
 * le service qui a réellement envoyé.
 *
 * Réglages (secrets Supabase) :
 *   - BREVO_API_KEY, BREVO_FROM_EMAIL : Brevo (prioritaire dès que la clé est présente) ;
 *   - RESEND_API_KEY, RESEND_FROM_DOMAIN : Resend (repli si Brevo échoue, ou seul service).
 */

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

const lire = (nom: string): string => (Deno.env.get(nom) ?? "").trim();

/**
 * Clé du service d'envoi disponible (Brevo ou Resend). Remplace la lecture directe de
 * RESEND_API_KEY dans les contrôles « un service d'envoi est-il configuré ? ».
 */
export function cleEnvoiEmail(): string | undefined {
  return lire("BREVO_API_KEY") || lire("RESEND_API_KEY") || undefined;
}

/**
 * Domaine des adresses d'expédition (noreply@…) : RESEND_FROM_DOMAIN, sinon le domaine de
 * BREVO_FROM_EMAIL. Remplace la lecture directe de RESEND_FROM_DOMAIN.
 */
export function domaineEnvoiEmail(): string | undefined {
  return lire("RESEND_FROM_DOMAIN") || lire("BREVO_FROM_EMAIL").split("@")[1] || undefined;
}

type Adresse = { email: string; name?: string };

/** « Nom <adresse@domaine> » ou « adresse@domaine » → { email, name }. */
function adresse(valeur: string): Adresse {
  const m = valeur.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return m[1] ? { email: m[2].trim(), name: m[1].trim() } : { email: m[2].trim() };
  return { email: valeur.trim() };
}

function adresses(valeur: unknown): Adresse[] | undefined {
  if (valeur === undefined || valeur === null || valeur === "") return undefined;
  const liste = (Array.isArray(valeur) ? valeur : [valeur]).map(String).filter(Boolean).map(adresse);
  return liste.length ? liste : undefined;
}

type PieceJointeResend = { filename?: string; content?: string; path?: string };

/** Traduit le corps d'une requête Resend en corps de requête Brevo. */
function versBrevo(corps: Record<string, unknown>): Record<string, unknown> {
  const expediteur = adresse(String(corps.from ?? lire("BREVO_FROM_EMAIL")));
  const reponseA = adresses(corps.reply_to ?? corps.replyTo);
  const pieces = (corps.attachments as PieceJointeResend[] | undefined)?.filter((p) => p.content || p.path);
  return {
    sender: expediteur.name ? expediteur : { email: expediteur.email, name: "ArtiFlow-pro" },
    to: adresses(corps.to),
    cc: adresses(corps.cc),
    bcc: adresses(corps.bcc),
    replyTo: reponseA?.[0],
    subject: corps.subject,
    htmlContent: corps.html,
    textContent: corps.text,
    headers: corps.headers,
    tags: Array.isArray(corps.tags)
      ? (corps.tags as Array<{ value?: string; name?: string } | string>).map((t) => (typeof t === "string" ? t : t.value ?? t.name ?? ""))
      : undefined,
    attachment: pieces?.length
      ? pieces.map((p) => (p.content ? { name: p.filename ?? "piece-jointe", content: p.content } : { name: p.filename, url: p.path }))
      : undefined,
  };
}

function reponse(statut: number, corps: Record<string, unknown>, fournisseur: string): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "Content-Type": "application/json", "x-fournisseur": fournisseur },
  });
}

/**
 * Remplaçant de `fetch("https://api.resend.com/emails", init)`.
 * Brevo d'abord (si BREVO_API_KEY est défini), puis Resend en repli (si RESEND_API_KEY est défini).
 */
export async function envoyerEmail(url: string, init: RequestInit): Promise<Response> {
  const cleBrevo = lire("BREVO_API_KEY");
  const cleResend = lire("RESEND_API_KEY");
  const versResend = () => {
    const entetes = new Headers(init.headers);
    if (cleResend) entetes.set("Authorization", `Bearer ${cleResend}`);
    return fetch(url, { ...init, headers: entetes });
  };
  if (!cleBrevo) return versResend();

  let corps: Record<string, unknown>;
  try {
    corps = JSON.parse(String(init.body ?? "{}"));
  } catch {
    return versResend();
  }

  let echecBrevo: Response;
  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": cleBrevo, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(versBrevo(corps)),
    });
    const data = (await res.json().catch(() => null)) as { messageId?: string; message?: string } | null;
    if (res.ok) return reponse(200, { id: data?.messageId ?? null }, "brevo");
    echecBrevo = reponse(res.status, { message: data?.message || `Brevo a refusé l'envoi (code ${res.status}).` }, "brevo");
  } catch (e) {
    echecBrevo = reponse(502, { message: e instanceof Error ? e.message : "Brevo est injoignable." }, "brevo");
  }

  return cleResend ? versResend() : echecBrevo;
}
