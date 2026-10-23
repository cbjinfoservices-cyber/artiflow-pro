import ExportDonneesCard from "@/pages/app/components/ExportDonneesCard";

/** Les quatre droits mis en avant, avec l'action concrète correspondante. */
const DROITS: { icone: string; titre: string; texte: string }[] = [
  {
    icone: "ri-eye-line",
    titre: "Accès",
    texte: "Consultez à tout moment les informations enregistrées sur votre compte.",
  },
  {
    icone: "ri-edit-line",
    titre: "Rectification",
    texte: "Corrigez vos coordonnées et mentions légales depuis l'onglet Entreprise.",
  },
  {
    icone: "ri-download-cloud-2-line",
    titre: "Portabilité",
    texte: "Récupérez toute votre activité dans une archive, quand vous le souhaitez.",
  },
  {
    icone: "ri-delete-bin-6-line",
    titre: "Effacement",
    texte: "Programmez la fermeture de votre compte, avec 30 jours pour changer d'avis.",
  },
];

/**
 * Section « Mes droits RGPD » de l'onglet Sécurité.
 *
 * Elle rend les droits concrets : chaque droit renvoie à un geste possible dans l'espace.
 * Le bloc d'export (déjà utilisé dans les Préférences) est réintégré ici pour que l'artisan
 * puisse récupérer ses données **juste avant** de programmer une suppression de compte.
 */
export default function MesDroitsRgpdCard() {
  return (
    <section className="p-5 md:p-6 rounded-lg bg-background-100 border border-background-200">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700">
          <i className="ri-shield-check-line"></i>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-heading font-semibold text-base text-foreground-950">Mes droits RGPD</h3>
          <p className="text-xs text-foreground-500 mt-0.5 leading-relaxed">
            Vous gardez la main sur vos données : les consulter, les corriger, les emporter ou les faire effacer.
            Aucune démarche par courrier n'est nécessaire, tout se fait ici.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {DROITS.map((d) => (
          <div key={d.titre} className="flex items-start gap-2.5 p-3 rounded-md bg-background-50 border border-background-200">
            <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-700 text-sm">
              <i className={d.icone}></i>
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground-900">{d.titre}</p>
              <p className="text-[11px] text-foreground-500 mt-0.5 leading-relaxed">{d.texte}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Export intégré : c'est le geste « portabilité », disponible avant toute suppression. */}
      <div className="mt-4 p-4 rounded-md bg-background-50 border border-background-200">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 flex items-center justify-center rounded-md bg-primary-100 text-primary-700 text-sm">
            <i className="ri-download-cloud-2-line"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-950">Exporter toutes mes données</p>
            <p className="text-[11px] text-foreground-500">
              Archive ZIP de votre activité, générée à la demande — à faire avant de supprimer votre compte.
            </p>
          </div>
        </div>
        <ExportDonneesCard sansCadre />
      </div>

      <p className="mt-3 text-[11px] text-foreground-400 inline-flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5"></i>
        <span>
          Pour faire valoir un autre droit ou poser une question sur vos données, écrivez-nous depuis la page
          Contact : nous répondons sous 30 jours, comme le prévoit le RGPD.
        </span>
      </p>
    </section>
  );
}