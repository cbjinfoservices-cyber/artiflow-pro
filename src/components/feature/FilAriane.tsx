import { Link } from "react-router-dom";
import { useBreadcrumbSchema, type BreadcrumbItem } from "@/hooks/useBreadcrumbSchema";

/**
 * Fil d'Ariane visible, partagé par les pages Métiers, Villes et Guides.
 *
 * Point important : le fil affiché et le bloc Schema.org BreadcrumbList sont
 * construits à partir de la **même** liste `items`. Une page ne peut donc plus
 * afficher un chemin différent de celui qu'elle déclare aux moteurs de
 * recherche (le cas typique : un maillon « Connexion » ajouté à la main dans le
 * visuel mais absent des données structurées).
 */
type VarianteFil = "clair" | "sombre";

type FilArianeProps = {
  /** Chemin complet, du plus général au plus précis. Le dernier est la page courante. */
  items: BreadcrumbItem[];
  /** « clair » sur fond clair, « sombre » sur une image héros sombre. */
  variante?: VarianteFil;
  /** Marges et alignement, par défaut une marge basse de section. */
  className?: string;
  /** Identifiant du script JSON-LD, pour conserver les identifiants déjà en place. */
  schemaId?: string;
};

const STYLE: Record<VarianteFil, { nav: string; lien: string; courant: string }> = {
  clair: {
    nav: "text-foreground-500",
    lien: "hover:text-foreground-900",
    courant: "text-foreground-800",
  },
  sombre: {
    nav: "text-background-100/75",
    lien: "hover:text-background-50",
    courant: "text-background-50",
  },
};

export default function FilAriane({
  items,
  variante = "clair",
  className = "mb-6",
  schemaId = "artiflow-breadcrumb-schema",
}: FilArianeProps) {
  const style = STYLE[variante];

  // Le même tableau alimente le visible et le BreadcrumbList.
  useBreadcrumbSchema(items, schemaId);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Fil d'Ariane"
      className={`flex flex-wrap items-center gap-2 text-xs ${style.nav} ${className}`}
    >
      {items.map((item, index) => {
        const estCourant = index === items.length - 1;
        return (
          <span key={`${item.path}-${item.name}`} className="inline-flex items-center gap-2">
            {index > 0 && <i className="ri-arrow-right-s-line" aria-hidden="true"></i>}
            {estCourant ? (
              <span className={style.courant} aria-current="page">
                {item.name}
              </span>
            ) : (
              <Link to={item.path} className={`${style.lien} cursor-pointer transition-colors`}>
                {item.name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}