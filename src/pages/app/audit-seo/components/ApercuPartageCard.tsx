import { getSiteOrigin } from "@/lib/site";
import type { EntreeAudit } from "@/lib/auditSeo";

/** Réseaux pour lesquels un aperçu de partage est simulé dans l'audit. */
export type ReseauApercu = "linkedin" | "whatsapp";

/** Réseaux disponibles, dans l'ordre d'affichage du sélecteur. */
export const RESEAUX_APERCU: { key: ReseauApercu; label: string; icon: string }[] = [
  { key: "linkedin", label: "LinkedIn", icon: "ri-linkedin-fill" },
  { key: "whatsapp", label: "WhatsApp", icon: "ri-whatsapp-fill" },
];

/** Nom de domaine affiché sur la carte (sans protocole). */
function nomDomaine(): string {
  return getSiteOrigin().replace(/^https?:\/\//, "");
}

/**
 * Aperçu du partage social d'une page publique, façon LinkedIn ou WhatsApp :
 * visuel de partage, domaine, titre et description, exactement comme les verront
 * les destinataires d'un lien. Sert à contrôler le rendu réel plutôt qu'une
 * simple vignette d'image.
 */
export default function ApercuPartageCard({
  entree,
  reseau,
}: {
  entree: EntreeAudit;
  reseau: ReseauApercu;
}) {
  const domaine = nomDomaine();
  const url = entree.path === "/" ? domaine : `${domaine}${entree.path}`;

  if (reseau === "whatsapp") {
    return (
      <div className="rounded-lg overflow-hidden border border-background-200 bg-background-50">
        <div className="flex gap-3 p-3">
          <div className="w-20 h-20 shrink-0 rounded-md overflow-hidden bg-background-100 border border-background-200">
            <img
              src={entree.image}
              alt={`Aperçu du partage WhatsApp — ${entree.label}`}
              title={`Aperçu WhatsApp · ${entree.label}`}
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400 truncate">
              {domaine}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground-950 line-clamp-2 leading-snug">
              {entree.title}
            </p>
            <p className="mt-1 text-xs text-foreground-500 line-clamp-2 leading-relaxed">
              {entree.description}
            </p>
          </div>
        </div>
        <p className="px-3 pb-2.5 text-[10px] text-foreground-400 truncate">{url}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border border-background-200 bg-background-50">
      <div className="w-full aspect-[1.91/1] bg-background-100">
        <img
          src={entree.image}
          alt={`Aperçu du partage LinkedIn — ${entree.label}`}
          title={`Aperçu LinkedIn · ${entree.label}`}
          className="w-full h-full object-cover object-top"
        />
      </div>
      <div className="p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-400 truncate">
          {domaine}
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground-950 line-clamp-2 leading-snug">
          {entree.title}
        </p>
        <p className="mt-1 text-xs text-foreground-500 line-clamp-2 leading-relaxed">
          {entree.description}
        </p>
      </div>
    </div>
  );
}