import { useEffect } from "react";

/**
 * Mémorise la position de défilement d'une page et la restaure au retour,
 * pour retrouver sa lecture exactement là où on l'avait laissée.
 *
 * La position est stockée par session (sessionStorage) : elle est restaurée
 * quand l'utilisateur revient sur la page dans le même onglet. `enabled = false`
 * désactive la mémorisation (utile quand la page redirige aussitôt, pour ne pas
 * écraser la position déjà enregistrée).
 */
export function useScrollMemory(key: string, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    // Restaure la position mémorisée après le montage du contenu.
    let restoreTimer = 0;
    try {
      const saved = window.sessionStorage.getItem(key);
      const y = saved === null ? 0 : Number(saved);
      if (Number.isFinite(y) && y > 0) {
        restoreTimer = window.setTimeout(() => {
          window.scrollTo({ top: y, behavior: "auto" });
        }, 80);
      }
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }

    // Enregistre la position au fil du défilement.
    let raf = 0;
    const onScroll = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        try {
          window.sessionStorage.setItem(key, String(Math.round(window.scrollY)));
        } catch {
          // Stockage indisponible : on ignore silencieusement.
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.clearTimeout(restoreTimer);
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(raf);
      try {
        window.sessionStorage.setItem(key, String(Math.round(window.scrollY)));
      } catch {
        // Stockage indisponible : on ignore silencieusement.
      }
    };
  }, [key, enabled]);
}