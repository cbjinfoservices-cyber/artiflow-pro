import { Link } from "react-router-dom";
import { useQuoiDeNeuf } from "@/hooks/useQuoiDeNeuf";

/**
 * Compteur de nouveautés non lues, posé juste à côté du bouton d'aide de l'en-tête.
 *
 * Il répond à une question simple : « qu'est-ce que je n'ai pas encore vu depuis ma dernière
 * visite ? ». Le clic ouvre le journal public et marque tout comme lu ; le compteur disparaît
 * alors de lui-même, et revient à la prochaine livraison.
 *
 * Tant que rien n'est publié de neuf, il ne s'affiche pas du tout : pas de pastille décorative.
 */
export default function CompteurQuoiDeNeuf() {
  const { nombreNonLues, nonLues, marquerToutVu } = useQuoiDeNeuf();

  if (nombreNonLues === 0) return null;

  const libelle = `${nombreNonLues} nouveauté${nombreNonLues > 1 ? "s" : ""} non lue${nombreNonLues > 1 ? "s" : ""}`;
  const apercu = nonLues
    .slice(0, 4)
    .map((n) => `v${n.version} — ${n.title}`)
    .join("\n");
  const reste = nombreNonLues - Math.min(nombreNonLues, 4);

  return (
    <Link
      to="/nouveautes"
      onClick={marquerToutVu}
      title={`${libelle} depuis votre dernière visite :\n${apercu}${reste > 0 ? `\n+ ${reste} autre${reste > 1 ? "s" : ""}` : ""}`}
      aria-label={`${libelle} — ouvrir le journal des nouveautés`}
      className="inline-flex items-center gap-1.5 h-10 px-2.5 rounded-md bg-accent-100 border border-accent-300 text-accent-900 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-accent-200 transition-colors"
    >
      <i className="ri-megaphone-line text-base"></i>
      <span className="hidden sm:inline">Nouveautés</span>
      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold tabular-nums">
        {nombreNonLues > 9 ? "9+" : nombreNonLues}
      </span>
    </Link>
  );
}