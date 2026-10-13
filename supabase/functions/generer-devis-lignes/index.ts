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

interface LigneIa {
  designation: string;
  unite: string;
  quantite: number;
  prix_unitaire: number;
}

/** Extrait et nettoie le JSON renvoyé par le modèle (tolérant aux fences markdown). */
function parseModelJson(raw: string): { objet?: string; lignes?: unknown } | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as { objet?: string; lignes?: unknown };
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as { objet?: string; lignes?: unknown };
    } catch {
      return null;
    }
  }
}

function sanitizeLignes(input: unknown): LigneIa[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const l = item as Record<string, unknown>;
      const designation = String(l?.designation ?? "").trim();
      if (!designation) return null;
      const unite = String(l?.unite ?? "u").trim() || "u";
      const quantite = Number(l?.quantite);
      const prix = Number(l?.prix_unitaire ?? l?.prix);
      return {
        designation,
        unite,
        quantite: Number.isFinite(quantite) && quantite > 0 ? Math.round(quantite * 100) / 100 : 1,
        prix_unitaire: Number.isFinite(prix) && prix >= 0 ? Math.round(prix * 100) / 100 : 0,
      };
    })
    .filter((l): l is LigneIa => l !== null)
    .slice(0, 25);
}

/**
 * Génère les lignes d'un devis à partir d'une description libre du chantier.
 * L'artisan décrit ce qu'il doit faire (ou dicte son constat), l'IA propose
 * un objet + des lignes chiffrées (désignation, unité, quantité, prix unitaire HT)
 * adaptées à son corps de métier. Rien n'est enregistré : la proposition est
 * renvoyée à l'app qui la présente dans le formulaire, à charge pour l'artisan
 * de la corriger avant d'enregistrer.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !anonKey) return json({ ok: false, error: "Configuration manquante." }, 500);
    if (!openaiKey) {
      return json(
        { ok: false, error: "La génération de devis par IA n'est pas encore configurée. Ajoutez la clé OpenAI pour l'activer." },
        400,
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "Vous devez être connecté." }, 401);

    const payload = await req.json().catch(() => null);
    const description = String(payload?.description ?? "").trim();
    if (description.length < 5) {
      return json({ ok: false, error: "Décrivez le chantier pour générer un devis." }, 400);
    }

    const { data: profile } = await authClient
      .from("profiles")
      .select("metier, entreprise")
      .eq("id", user.id)
      .maybeSingle();
    const metier = String((profile as { metier?: string } | null)?.metier ?? "").trim();

    const system = [
      "Tu es un expert en chiffrage de devis pour les artisans du bâtiment en France.",
      "À partir d'une description de chantier, tu produis un devis réaliste et détaillé.",
      "Règles :",
      "- Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, au format :",
      '  {"objet": "intitulé court du devis", "lignes": [{"designation": "poste", "unite": "u", "quantite": 1, "prix_unitaire": 0}]}',
      "- Utilise des unités françaises courantes : u, m2, m3, ml, h, forfait, kg, ens.",
      "- Fournis entre 3 et 10 lignes pertinentes (fourniture et/ou main d'œuvre).",
      "- Les prix_unitaire sont en euros HT, réalistes pour le marché français.",
      "- Les quantités sont des nombres (pas de texte).",
      "- Ne mets aucun accent dans les clés JSON, seulement dans les valeurs.",
      "- N'ajoute aucune ligne de TVA ni de total : uniquement les postes.",
    ].join("\n");

    const userPrompt = `${metier ? `Corps de métier de l'artisan : ${metier}.\n` : ""}Décris le devis pour ce chantier :\n"""${description}"""`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const aiData = (await aiRes.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
      | null;
    if (!aiRes.ok) {
      return json({ ok: false, error: aiData?.error?.message || "Le service IA a refusé la demande." }, 502);
    }

    const raw = aiData?.choices?.[0]?.message?.content ?? "";
    const parsed = parseModelJson(raw);
    if (!parsed) return json({ ok: false, error: "L'IA a renvoyé une réponse illisible. Réessayez." }, 502);

    const lignes = sanitizeLignes(parsed.lignes);
    if (lignes.length === 0) {
      return json({ ok: false, error: "L'IA n'a pas réussi à proposer de lignes. Précisez un peu la demande." }, 422);
    }

    const objet = String(parsed.objet ?? "").trim().slice(0, 120);

    return json({ ok: true, objet, lignes });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Erreur inconnue." }, 500);
  }
});
