import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

// Instance unique partagée dans toute l'application (pattern singleton).
// Ne jamais créer un second client ailleurs : on importe toujours celui-ci.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);