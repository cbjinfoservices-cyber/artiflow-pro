import { useCallback, useEffect, useState } from "react";
import { verifierPaiementEur, type DiagnosticPaiementEur } from "@/lib/abonnementPaiement";
import {
  ecrireCacheDiagnosticPaiement,
  lireCacheDiagnosticPaiement,
} from "@/lib/diagnosticPaiementCache";

/**
 * Vérifie, au chargement de la page Tarifs, si le compte de paiement peut bien
 * encaisser une carte en euros. Permet d'afficher un bandeau d'information AVANT
 * que le client ne clique sur « S'abonner », plutôt que de le laisser buter sur une
 * erreur au moment du paiement.
 *
 * Le résultat est mis en cache 10 minutes pour éviter d'appeler le Backend à chaque
 * navigation. En cas d'échec du diagnostic, on considère le paiement disponible
 * (fail-safe) : on n'inquiète pas l'utilisateur sans certitude.
 */
export function useDiagnosticPaiementEur() {
  const [diagnostic, setDiagnostic] = useState<DiagnosticPaiementEur | null>(() =>
    lireCacheDiagnosticPaiement(),
  );
  const [chargement, setChargement] = useState(false);

  const reverifier = useCallback(async () => {
    setChargement(true);
    try {
      const resultat = await verifierPaiementEur();
      setDiagnostic(resultat);
      ecrireCacheDiagnosticPaiement(resultat);
    } catch {
      setDiagnostic(null);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (lireCacheDiagnosticPaiement()) return;
    reverifier();
  }, [reverifier]);

  const indisponible = diagnostic !== null && diagnostic.eurDisponible === false;

  return { diagnostic, indisponible, chargement, reverifier };
}