import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Permet de faire défiler vers une section de la page d'accueil,
 * même depuis une autre page du site.
 *
 * Quand on vient d'une autre page, la section n'existe pas encore dans le DOM :
 * on attend donc qu'elle soit montée (polling court) avant de défiler, sinon le
 * défilement se perd dans le vide.
 */
export function useSectionNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const pollRef = useRef<number | null>(null);

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  };

  useEffect(() => {
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    };
  }, []);

  const goSection = useCallback(
    (id: string) => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }

      if (location.pathname === "/") {
        scrollToId(id);
        return;
      }

      navigate("/");
      let attempts = 0;
      pollRef.current = window.setInterval(() => {
        attempts += 1;
        if (scrollToId(id) || attempts >= 40) {
          if (pollRef.current !== null) window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 80);
    },
    [location.pathname, navigate]
  );

  return goSection;
}