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

/** Un domaine d'envoi tel que renvoye par l'API Resend. */
interface ResendDomaineApi {
  id?: string;
  name?: string;
  status?: string;
  region?: string;
}

/** Un enregistrement DNS conseille par Resend pour un domaine. */
interface ResendRecordApi {
  record?: string;
  name?: string;
  type?: string;
  value?: string;
  status?: string;
  ttl?: string;
  priority?: number;
}

/** Un enregistrement DNS attendu, avec son verdict. */
export interface VerifEnregistrementDns {
  cle: string;
  libelle: string;
  type: string;
  nom: string;
  attendu: string;
  trouve: string | null;
  ok: boolean;
  divergent?: boolean;
  detail: string;
}

/** Resultat complet de la verification DNS d'un domaine d'envoi. */
export interface VerificationDnsEmail {
  domaine: string;
  serveursNoms: string[];
  hebergeur: string;
  spf: { present: boolean; valeurs: string[]; doublon: boolean; resendInclus: boolean };
  dmarc: { present: boolean; valeurs: string[]; doublon: boolean };
  enregistrements: VerifEnregistrementDns[];
  avertissements: string[];
  complet: boolean;
}

const TYPE_DNS = { TXT: 16, CNAME: 5, NS: 2 } as const;

interface ReponseDns {
  status: number;
  answers: Array<{ type?: number; data?: string }>;
}

/** Interroge DNS-over-HTTPS (Google) pour un nom et un type donnes. */
async function resoudreDns(nom: string, type: keyof typeof TYPE_DNS): Promise<ReponseDns> {
  try {
    const reponse = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(nom)}&type=${type}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    const body = (await reponse.json().catch(() => null)) as
      | { Status?: number; Answer?: Array<{ type?: number; data?: string }> }
      | null;
    const answers = (body?.Answer ?? []).filter((a) => a.type === TYPE_DNS[type]);
    return { status: body?.Status ?? 2, answers };
  } catch {
    return { status: 2, answers: [] };
  }
}

/** Nettoie une valeur TXT publiee (guillemets, morceaux concatenes, espaces). */
function nettoyerTxt(valeur: string): string {
  return valeur.replace(/"/g, "").replace(/\s+/g, " ").trim();
}

const FOURNISSEURS_DNS: Array<{ motif: string; nom: string }> = [
  { motif: "cloudflare.com", nom: "Cloudflare" },
  { motif: "ovh.net", nom: "OVHcloud" },
  { motif: "ovh.com", nom: "OVHcloud" },
  { motif: "gandi.net", nom: "Gandi" },
  { motif: "domaincontrol.com", nom: "GoDaddy" },
  { motif: "registrar-servers.com", nom: "Namecheap" },
  { motif: "awsdns", nom: "Amazon Route 53" },
  { motif: "azure-dns", nom: "Microsoft Azure DNS" },
  { motif: "googledomains.com", nom: "Google Cloud DNS" },
  { motif: "nsone.net", nom: "NS1" },
  { motif: "kundenserver.de", nom: "IONOS (1&1)" },
  { motif: "ui-dns", nom: "IONOS (1&1)" },
  { motif: "dns-parking.com", nom: "Hostinger" },
  { motif: "hostinger", nom: "Hostinger" },
  { motif: "wixdns.net", nom: "Wix" },
  { motif: "squarespace.com", nom: "Squarespace" },
  { motif: "vercel-dns.com", nom: "Vercel" },
  { motif: "netlify.com", nom: "Netlify" },
  { motif: "o2switch.net", nom: "o2switch" },
  { motif: "planethoster.net", nom: "PlanetHoster" },
  { motif: "lws.fr", nom: "LWS" },
  { motif: "lws-dns", nom: "LWS" },
  { motif: "ikoula.com", nom: "Ikoula" },
  { motif: "amen.fr", nom: "Amen.fr" },
  { motif: "phpnet.org", nom: "PHPNET" },
  { motif: "alwaysdata.net", nom: "Alwaysdata" },
  { motif: "porkbun.com", nom: "Porkbun" },
  { motif: "dnsimple.com", nom: "DNSimple" },
  { motif: "hosteur.com", nom: "Hosteur" },
  { motif: "celeonet", nom: "Celeonet" },
  { motif: "infomaniak", nom: "Infomaniak" },
  { motif: "hostpoint.ch", nom: "Hostpoint" },
];

/** Deduit le nom de l'hebergeur DNS a partir de la liste des serveurs de noms. */
function devinerHebergeur(serveursNoms: string[]): string {
  const liste = serveursNoms.map((n) => n.toLowerCase());
  for (const f of FOURNISSEURS_DNS) {
    if (liste.some((n) => n.includes(f.motif))) return f.nom;
  }
  return serveursNoms.length > 0 ? "Hebergeur non reconnu" : "Inconnu";
}

/** Libelle humain d'un type d'enregistrement conseille par Resend. */
function libelleEnregistrement(record: ResendRecordApi): string {
  const nom = String(record.record ?? "").toUpperCase();
  const type = String(record.type ?? "").toUpperCase();
  if (nom.includes("DKIM")) return "Clé DKIM (signature des emails)";
  if (nom.includes("SPF")) return "Enregistrement SPF (autorisation d'envoi)";
  if (nom.includes("DMARC")) return "Politique DMARC";
  if (nom.includes("MX") || type === "MX") return "Enregistrement MX (retours et rebonds)";
  return `${nom || "Enregistrement"}${type ? ` (${type})` : ""}`;
}

/** Explication lisible du statut d'un enregistrement DNS renvoye par Resend. */
function detailEnregistrement(statut: string): string {
  switch (statut.toLowerCase()) {
    case "verified":
      return "Enregistrement publié et validé par Resend.";
    case "pending":
      return "Enregistrement détecté mais pas encore validé : la propagation DNS peut prendre quelques heures.";
    case "not_started":
      return "Enregistrement absent du DNS : il reste à créer chez votre hébergeur.";
    case "failed":
      return "Resend n'a pas pu valider cet enregistrement : vérifiez la valeur saisie.";
    case "temporary_failure":
      return "Vérification momentanément impossible chez Resend : réessayez dans quelques minutes.";
    default:
      return "Statut de l'enregistrement encore inconnu.";
  }
}

/**
 * Construit l'etat DNS d'un domaine d'envoi a partir des enregistrements conseilles par
 * Resend (source de verite) et d'une lecture en direct du SPF / DMARC publies.
 */
async function construireVerificationDns(
  domaine: string,
  records: ResendRecordApi[],
): Promise<VerificationDnsEmail> {
  const [txtRacine, txtDmarc, repNs] = await Promise.all([
    resoudreDns(domaine, "TXT"),
    resoudreDns(`_dmarc.${domaine}`, "TXT"),
    resoudreDns(domaine, "NS"),
  ]);

  const txtsRacine = txtRacine.answers.map((a) => nettoyerTxt(String(a.data ?? "")));
  const txtsDmarc = txtDmarc.answers.map((a) => nettoyerTxt(String(a.data ?? "")));
  const serveursNoms = repNs.answers.map((a) => String(a.data ?? "").replace(/\.$/, ""));

  const spfValeurs = txtsRacine.filter((t) => t.toLowerCase().startsWith("v=spf1"));
  const dmarcValeurs = txtsDmarc.filter((t) => t.toUpperCase().includes("V=DMARC1"));

  const enregistrements: VerifEnregistrementDns[] = records.map((r, index) => {
    const statut = String(r.status ?? "").toLowerCase();
    return {
      cle: `resend-${index}`,
      libelle: libelleEnregistrement(r),
      type: String(r.type ?? "").toUpperCase() || "TXT",
      nom: String(r.name ?? ""),
      attendu: String(r.value ?? ""),
      trouve: String(r.value ?? "") || null,
      ok: statut === "verified",
      divergent: statut === "failed",
      detail: detailEnregistrement(statut),
    };
  });

  const avertissements: string[] = [];
  const nonValides = enregistrements.filter((e) => !e.ok).length;
  if (enregistrements.length === 0) {
    avertissements.push(
      "Aucun enregistrement DNS n'a été renvoyé par Resend pour ce domaine : ouvrez la fiche du domaine dans Resend pour afficher les enregistrements à publier.",
    );
  } else if (nonValides > 0) {
    avertissements.push(
      `${nonValides} enregistrement(s) DNS ne sont pas encore validés par Resend. Tant que ce n'est pas le cas, les emails peuvent être refusés ou classés en spam.`,
    );
  }
  if (spfValeurs.length > 1) {
    avertissements.push(
      `Doublon SPF détecté : ${spfValeurs.length} enregistrements TXT commencent par « v=spf1 » à la racine. Il ne peut en exister qu'un seul — fusionnez-les, sinon les emails Resend seront rejetés ou classés en spam.`,
    );
  }
  if (dmarcValeurs.length > 1) {
    avertissements.push(
      `Doublon DMARC détecté : ${dmarcValeurs.length} enregistrements « v=DMARC1 » existent sur _dmarc. Un seul est autorisé — les autres doivent être supprimés.`,
    );
  }
  if (spfValeurs.length === 1 && !spfValeurs[0].toLowerCase().includes("amazonses")) {
    avertissements.push(
      "Le SPF publié ne semble pas inclure le service d'envoi de Resend (amazonses) : vérifiez que l'enregistrement SPF fourni par Resend est bien repris tel quel.",
    );
  }

  const complet =
    enregistrements.length > 0 &&
    enregistrements.every((e) => e.ok) &&
    spfValeurs.length <= 1 &&
    dmarcValeurs.length <= 1;

  return {
    domaine,
    serveursNoms,
    hebergeur: devinerHebergeur(serveursNoms),
    spf: {
      present: spfValeurs.length > 0,
      valeurs: spfValeurs,
      doublon: spfValeurs.length > 1,
      resendInclus: spfValeurs.some((v) => v.toLowerCase().includes("amazonses")),
    },
    dmarc: {
      present: dmarcValeurs.length > 0,
      valeurs: dmarcValeurs,
      doublon: dmarcValeurs.length > 1,
    },
    enregistrements,
    avertissements,
    complet,
  };
}

/**
 * Diagnostic de la configuration d'envoi d'emails (Resend).
 * Ne renvoie JAMAIS la valeur de la cle : seulement sa presence, le domaine
 * d'envoi configure, son etat reel chez Resend et l'etat des enregistrements DNS.
 * Reserve aux utilisateurs connectes.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
    const fromDomain = (Deno.env.get("RESEND_FROM_DOMAIN") ?? "").trim();

    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);

    // Authentification obligatoire (le diagnostic reste interne a l'application).
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) return json({ ok: false, error: "Vous devez etre connecte." }, 401);

    const keyPresent = resendKey.length > 0;
    const domainPresent = fromDomain.length > 0;
    const fromAddress = domainPresent ? `contact@${fromDomain}` : null;

    let apiReachable = false;
    let apiError: string | null = null;
    const domains: Array<{ id: string; name: string; status: string; region?: string }> = [];
    let domainStatus: string | null = null;
    let records: ResendRecordApi[] = [];

    if (keyPresent) {
      try {
        const res = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${resendKey}`, Accept: "application/json" },
        });
        if (res.ok) {
          apiReachable = true;
          const body = (await res.json().catch(() => null)) as
            | { data?: ResendDomaineApi[] }
            | ResendDomaineApi[]
            | null;
          const liste = Array.isArray(body) ? body : (body?.data ?? []);
          for (const d of liste) {
            const name = String(d.name ?? "").trim();
            if (!name) continue;
            domains.push({
              id: String(d.id ?? name),
              name,
              status: String(d.status ?? "not_started"),
              region: d.region,
            });
          }
          const match = domains.find((d) => d.name.toLowerCase() === fromDomain.toLowerCase());
          domainStatus = match ? match.status : "not_found";

          // Les enregistrements DNS detailles ne sont renvoyes que par la fiche du domaine.
          if (match) {
            const detail = await fetch(`https://api.resend.com/domains/${encodeURIComponent(match.id)}`, {
              headers: { Authorization: `Bearer ${resendKey}`, Accept: "application/json" },
            });
            if (detail.ok) {
              const bodyDetail = (await detail.json().catch(() => null)) as
                | { records?: ResendRecordApi[] }
                | null;
              records = bodyDetail?.records ?? [];
            }
          }
        } else {
          const b = (await res.json().catch(() => null)) as { message?: string } | null;
          apiError = b?.message || `L'API Resend a repondu avec le code ${res.status}.`;
        }
      } catch (e) {
        apiError = e instanceof Error ? e.message : "Impossible de joindre l'API Resend.";
      }
    }

    const verificationDns = domainPresent ? await construireVerificationDns(fromDomain, records) : null;
    const dmarcPresent = verificationDns?.dmarc.present === true;
    const dmarcValue = verificationDns?.dmarc.valeurs[0] ?? null;

    const ready = keyPresent && domainPresent && domainStatus === "verified";

    // Historisation : on ne consigne une nouvelle entree que lorsque l'etat change.
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (serviceKey) {
      try {
        const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
        const current = {
          ready,
          key_present: keyPresent,
          domain_present: domainPresent,
          domain_name: fromDomain || null,
          domain_status: domainStatus,
          api_reachable: apiReachable,
        };
        const { data: last } = await admin
          .from("diagnostic_email_historique")
          .select("ready, key_present, domain_present, domain_name, domain_status, api_reachable")
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const signature = (r: Record<string, unknown>) =>
          [
            r.ready ? "1" : "0",
            r.key_present ? "1" : "0",
            r.domain_present ? "1" : "0",
            r.domain_name ?? "",
            r.domain_status ?? "",
            r.api_reachable ? "1" : "0",
          ].join("|");
        if (!last || signature(last as Record<string, unknown>) !== signature(current)) {
          await admin.from("diagnostic_email_historique").insert({
            ...current,
            api_error: apiError,
            checked_at: new Date().toISOString(),
          });
        }
      } catch {
        /* l'historisation ne doit jamais faire echouer le diagnostic */
      }
    }

    return json({
      ok: true,
      keyPresent,
      domainPresent,
      domainName: fromDomain || null,
      fromAddress,
      apiReachable,
      apiError,
      domainStatus,
      domains,
      expediteurs: [],
      expediteur: null,
      ready,
      dmarcPresent,
      dmarcValue,
      dns: verificationDns,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
