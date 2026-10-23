import { Link } from "react-router-dom";
import { PHONE_HREF, WHATSAPP_HREF } from "@/components/feature/MobileActionBar";
import PastilleOuverture from "@/components/base/PastilleOuverture";
import { useStatutOuverture } from "@/hooks/useStatutOuverture";

type Variante = "sombre" | "clair";

/** Horaires de disponibilité de l'équipe support, alignés sur la page Contact. */
const HORAIRES_EQUIPE = "Lundi – Vendredi · 9 h – 18 h";
const DELAI_REPONSE = "Réponse sous 24 h ouvrées";

/**
 * Encart « Besoin d'aide ? » : accès direct au contact sans passer par le menu, complété des
 * horaires de disponibilité de l'équipe et d'un statut « Ouvert maintenant / Fermé » calculé en
 * direct sur l'heure courante, pour un repère immédiat.
 *
 * Réutilisé à plusieurs endroits :
 * - dans le footer (variante « sombre »), présent sur toutes les pages ;
 * - en bas des pages Tarifs, Métiers et de l'accueil (variante « clair »), là où les visiteurs
 *   hésitent avant de choisir une offre.
 */
export default function EncartBesoinAide({
  variante = "sombre",
  className = "",
}: {
  /** Fond d'accueil de l'encart : « sombre » pour le footer, « clair » pour les pages claires. */
  variante?: Variante;
  /** Classes additionnelles pour ajuster l'emplacement. */
  className?: string;
}) {
  const sombre = variante === "sombre";
  const statut = useStatutOuverture();

  const bloc = sombre
    ? "border-background-50/15 bg-background-50/[0.06]"
    : "border-background-200 bg-background-100";
  const pastille = sombre ? "bg-primary-500 text-background-50" : "bg-primary-100 text-primary-700";
  const titre = sombre ? "text-background-50" : "text-foreground-950";
  const texte = sombre ? "text-background-200/80" : "text-foreground-600";
  const horairesBloc = sombre
    ? "border-background-50/15 bg-background-50/[0.04]"
    : "border-background-200 bg-background-50";
  const horairesIcone = sombre ? "text-accent-400" : "text-accent-600";
  const horairesTitre = sombre ? "text-background-100" : "text-foreground-800";
  const horairesTexte = sombre ? "text-background-200/80" : "text-foreground-600";
  const boutonPrincipal = "bg-primary-500 text-background-50 hover:bg-primary-600";
  const boutonWhatsapp = "bg-accent-500 text-background-50 hover:bg-accent-600";
  const boutonSecondaire = sombre
    ? "border border-background-50/20 text-background-100 hover:bg-background-50/10"
    : "border border-background-300 text-foreground-800 hover:bg-background-200";

  return (
    <div className={`rounded-lg border p-4 ${bloc} ${className}`}>
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-lg ${pastille}`}>
          <i className="ri-customer-service-2-line"></i>
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-heading font-semibold text-sm ${titre}`}>Besoin d'aide ?</p>
          <p className={`mt-1 text-xs leading-relaxed ${texte}`}>
            Une question sur l'outil, votre compte ou une offre ? Notre équipe vous répond.
          </p>

          {/* Horaires de disponibilité + statut d'ouverture calculé en direct. */}
          <div className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 ${horairesBloc}`}>
            <i className={`ri-time-line mt-0.5 ${horairesIcone}`}></i>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className={`text-[11px] font-semibold ${horairesTitre}`}>{HORAIRES_EQUIPE}</p>
                <PastilleOuverture variante={sombre ? "sombre" : "clair"} />
              </div>
              <p className={`text-[11px] ${horairesTexte}`}>{statut.detail}</p>
              <p className={`text-[11px] ${horairesTexte}`}>{DELAI_REPONSE}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              to="/contact"
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${boutonPrincipal}`}
            >
              <i className="ri-mail-send-line"></i>
              Nous contacter
            </Link>
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${boutonWhatsapp}`}
            >
              <i className="ri-whatsapp-line"></i>
              WhatsApp
            </a>
            <a
              href={PHONE_HREF}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${boutonSecondaire}`}
            >
              <i className="ri-phone-line"></i>
              Appeler
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}