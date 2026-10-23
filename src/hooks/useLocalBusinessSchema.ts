import { useStructuredData } from "@/hooks/useStructuredData";
import { construireLocalBusiness } from "@/lib/coordonnees";

/**
 * Injecte un balisage Schema.org LocalBusiness sur la page Contact.
 *
 * Le bloc n'est produit que si l'adresse postale réelle est renseignée dans
 * `src/lib/coordonnees.ts` : tant qu'elle manque, aucun LocalBusiness n'est
 * déclaré (on n'invente jamais de fausses coordonnées). Dès que l'adresse et
 * les horaires sont complétés, le balisage apparaît automatiquement.
 */
export function useLocalBusinessSchema(id = "artiflow-localbusiness-schema") {
  const data = construireLocalBusiness();
  useStructuredData(data ? id : `${id}-disabled`, data);
}