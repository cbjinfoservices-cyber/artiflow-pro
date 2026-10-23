import { Link } from "react-router-dom";
import { metiers } from "@/mocks/metiers";

/** Ce qu'ArtiFlow-pro change concrètement pour chaque corps d'état, et le gain typique. */
const GAIN_PAR_METIER: Record<string, { fait: string; gain: string }> = {
  "plombier-chauffagiste": {
    fait: "Devis de chaudière et de dépannage dictés depuis le chantier, urgences relancées en priorité.",
    gain: "6 min pour un devis de chaudière",
  },
  electricien: {
    fait: "Devis de mise aux normes détaillés, sans oubli de poste, relancés jusqu'à la signature.",
    gain: "+24 % de devis signés",
  },
  macon: {
    fait: "Métrés dictés et quantités calculées, chantiers regroupés par zone pour limiter les trajets.",
    gain: "−1 h 20 de trajet par semaine",
  },
  "peintre-finitions": {
    fait: "Surfaces calculées par pièce, ouvertures déduites, prix par finition appliqués automatiquement.",
    gain: "1 h gagnée par devis",
  },
  menuisier: {
    fait: "Variantes de matériaux chiffrées dans un seul devis, du croquis à la pose.",
    gain: "3 min pour un devis de fenêtres",
  },
  carreleur: {
    fait: "Surfaces au m² avec réserve de chutes, fourniture et pose séparées, gros devis relancés.",
    gain: "−45 min de métré par devis",
  },
  couvreur: {
    fait: "Urgences priorisées au planning et devis de sinistre clairs, prêts pour l'assurance.",
    gain: "8 min pour une réfection",
  },
  platrier: {
    fait: "Chiffrage pièce par pièce, murs et plafonds additionnés, tous les postes réunis.",
    gain: "+21 % de devis signés",
  },
  "installateur-climatisation": {
    fait: "Poses de splits et de pompes à chaleur dictées, entretiens annuels ressortis et relancés.",
    gain: "+26 % de devis signés",
  },
};

/**
 * Section « Ce qui change selon votre métier » de la page Tarifs : un tableau qui décline,
 * pour chaque corps d'état, l'apport d'ArtiFlow-pro et le gain typique, avec un lien vers
 * la fiche métier correspondante (maillage interne).
 */
export default function MetiersGains() {
  return (
    <section id="metiers" className="w-full bg-background-100 scroll-mt-32">
      <div className="w-full px-4 md:px-8 lg:px-12 py-16 md:py-20">
        <div className="max-w-2xl mb-10">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
            <i className="ri-hammer-line"></i>
            Adapté à votre corps d'état
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl text-foreground-950 tracking-tight">
            Ce qui change selon votre métier
          </h2>
          <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
            Chaque corps d'état a ses unités, ses postes et ses réflexes de chiffrage. ArtiFlow-pro part de votre métier,
            pas d'un devis générique.
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-background-200 bg-background-50">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="bg-background-100">
                <th className="text-left px-5 py-4 text-sm font-semibold text-foreground-700 w-[22%]">Métier</th>
                <th className="text-left px-5 py-4 text-sm font-semibold text-foreground-700">Ce qu'ArtiFlow-pro fait pour vous</th>
                <th className="text-left px-5 py-4 text-sm font-semibold text-foreground-700 w-[28%]">Le gain</th>
              </tr>
            </thead>
            <tbody>
              {metiers.map((m) => {
                const gain = GAIN_PAR_METIER[m.slug];
                if (!gain) return null;
                return (
                  <tr key={m.slug} className="border-t border-background-200">
                    <td className="px-5 py-4 align-top">
                      <Link
                        to={`/metiers/${m.slug}`}
                        className="inline-flex items-center gap-1.5 font-heading font-semibold text-sm text-foreground-900 hover:text-primary-700 cursor-pointer"
                      >
                        {m.shortName}
                        <i className="ri-arrow-right-up-line text-xs text-foreground-400"></i>
                      </Link>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-foreground-600">{gain.fait}</td>
                    <td className="px-5 py-4 align-top">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-100 text-accent-900 text-xs font-semibold">
                        <i className="ri-line-chart-line"></i>
                        {gain.gain}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm text-foreground-500">
          Et si votre corps d'état n'est pas listé, ArtiFlow-pro s'adapte : partez d'un modèle proche, ajustez vos postes
          et vos prix.{" "}
          <Link to="/metiers" className="font-semibold text-primary-700 hover:text-primary-800 cursor-pointer underline-offset-2 hover:underline">
            Voir toutes les fiches métiers
          </Link>
          .
        </p>
      </div>
    </section>
  );
}