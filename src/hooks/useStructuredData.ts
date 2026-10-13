import { useEffect } from "react";

/**
 * Injecte (ou remplace) un bloc de données structurées JSON-LD dans le <head>.
 * Le bloc est retiré automatiquement quand le composant est démonté, ce qui
 * évite de laisser une balise orpheline lors du changement de page.
 */
export function useStructuredData(id: string, data: Record<string, unknown> | null) {
  const serialized = data ? JSON.stringify(data) : null;

  useEffect(() => {
    if (!serialized) return undefined;

    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = id;
      document.head.appendChild(script);
    }
    script.textContent = serialized;

    return () => {
      const existing = document.getElementById(id);
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
    };
  }, [id, serialized]);
}