import { Link } from "react-router-dom";
import { useQuoiDeNeuf } from "@/hooks/useQuoiDeNeuf";

interface CompteurQuoiDeNeufTiroirProps {
  /** Appelé juste avant d'ouvrir le journal : le tiroir mobile se referme proprement. */
  onNavigate?: () => void;
}

/**
 * Compteur de nouveautés non lues du tiroir mobile.
 *
 * Il lit exactement la même mémoire que le lien « Quoi de neuf » de la barre latérale
 * et que la pastille de l'en-tête : le chiffre affiché est donc toujours identique partout.
 * Ouvrir le journal vaut lecture, la pastille retombe immédiatement.
 */
export default function CompteurQuoiDeNeufTiroir({ onNavigate }: CompteurQuoiDeNeufTiroirProps) {
  const { nombreNonLues, nonLues, marquerToutVu } = useQuoiDeNeuf();

  if (nombreNonLues === 0) return null;

  const apercu = nonLues
    .slice(0, 3)
    .map((n) => `v${n.version} — ${n.title}`)
    .join("\n");
  const reste = nombreNonLues - Math.min(nombreNonLues, 3);

  return (
    <Link
      to="/nouveautes"
      onClick={() => {
        marquerToutVu();
        onNavigate?.();
      }}
      title={`${nombreNonLues} nouveauté${nombreNonLues > 1 ? "s" : ""} non lue${nombreNonLues > 1 ? "s" : ""} :\n${apercu}${
        reste > 0 ? `\n+ ${reste} autre${reste > 1 ? "s" : ""}` : ""
      }`}
      aria-label={`Quoi de neuf — ${nombreNonLues} nouveauté(s) non lue(s), ouvrir le journal`}
      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-accent-100 border border-accent-300 text-accent-900 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
    >
      <i className="ri-megaphone-line text-sm"></i>
      <span className="hidden sm:inline">Nouveautés</span>
      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold tabular-nums">
        {nombreNonLues > 9 ? "9+" : nombreNonLues}
      </span>
    </Link>
  );
}