import { NavLink } from "react-router-dom";
import { useQuoiDeNeuf } from "@/hooks/useQuoiDeNeuf";

/**
 * Entrée « Quoi de neuf » de la barre latérale de l'espace artisan.
 *
 * Elle pointe vers le journal public et porte exactement la même pastille que le compteur
 * de l'en-tête : les deux lisent la même mémoire, donc ils s'accordent instantanément.
 * Ouvrir le lien vaut lecture : la pastille retombe aussitôt, et reviendra à la prochaine
 * livraison publiée.
 */
export default function LienQuoiDeNeufNav() {
  const { nombreNonLues, nonLues, marquerToutVu } = useQuoiDeNeuf();

  const apercu = nonLues
    .slice(0, 4)
    .map((n) => `v${n.version} — ${n.title}`)
    .join("\n");
  const reste = nombreNonLues - Math.min(nombreNonLues, 4);

  const infobulle =
    nombreNonLues > 0
      ? `${nombreNonLues} nouveauté${nombreNonLues > 1 ? "s" : ""} non lue${nombreNonLues > 1 ? "s" : ""} depuis votre dernière visite :\n${apercu}${
          reste > 0 ? `\n+ ${reste} autre${reste > 1 ? "s" : ""}` : ""
        }`
      : "Le journal des mises à jour : tout est à jour, rien à rattraper.";

  return (
    <NavLink
      to="/nouveautes"
      onClick={marquerToutVu}
      title={infobulle}
      aria-label={
        nombreNonLues > 0
          ? `Quoi de neuf — ${nombreNonLues} nouveauté(s) non lue(s), ouvrir le journal`
          : "Quoi de neuf — ouvrir le journal des mises à jour"
      }
      className={({ isActive }) =>
        `relative flex items-center gap-3 h-11 px-3 rounded-md text-sm font-medium cursor-pointer transition-colors ${
          isActive
            ? "bg-accent-100 text-accent-900"
            : "text-foreground-600 hover:bg-background-200 hover:text-foreground-950"
        }`
      }
    >
      <i className="ri-megaphone-line text-lg"></i>
      <span className="truncate">Quoi de neuf</span>
      {nombreNonLues > 0 ? (
        <span
          className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold tabular-nums whitespace-nowrap"
          aria-hidden="true"
        >
          {nombreNonLues > 9 ? "9+" : nombreNonLues}
        </span>
      ) : (
        <i
          className="ri-check-line ml-auto text-foreground-300 text-sm"
          title="Vous avez tout lu"
          aria-hidden="true"
        ></i>
      )}
    </NavLink>
  );
}