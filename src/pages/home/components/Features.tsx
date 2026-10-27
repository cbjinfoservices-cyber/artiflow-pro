import { Link } from "react-router-dom";

/**
 * Ce que l'application apporte, formulé en bénéfices (et non selon l'organisation du menu).
 * `badge` met en avant les fonctions récentes ou d'actualité.
 */
const benefices = [
  {
    icon: "ri-mic-line",
    titre: "Un devis propre en quelques minutes",
    texte: "Dictez ou photographiez les travaux : l'IA rédige avec vos tarifs, vos unités et les modèles de votre métier.",
    details: ["Bibliothèque de lignes et de prix", "Devis en plusieurs lots", "À vos couleurs et votre logo"],
  },
  {
    icon: "ri-repeat-line",
    titre: "Plus aucun devis ni facture oublié",
    texte: "Les relances partent seules par email, SMS ou WhatsApp, et s'arrêtent dès que le client répond ou paie.",
    details: ["Relances programmables", "Escalade des impayés", "Vous savez si un email n'est pas arrivé"],
  },
  {
    icon: "ri-team-line",
    titre: "Votre équipe organisée depuis son téléphone",
    texte: "Chacun voit son planning et pointe ses heures. Vous suivez qui est où, et les congés ne se chevauchent plus.",
    details: ["Application Android", "Pointage et export pour la paie", "Alertes de conflits de congés"],
    badge: "Nouveau",
  },
  {
    icon: "ri-shake-hands-line",
    titre: "Des clients rassurés, sans coups de fil",
    texte: "Le client signe le devis en ligne et suit son chantier par un simple lien : étapes, photos, prochaines dates.",
    details: ["Signature électronique", "Lien de suivi de chantier", "Procès-verbal de réception signé"],
    badge: "Nouveau",
  },
  {
    icon: "ri-file-shield-2-line",
    titre: "Prêt pour la facture électronique",
    texte: "La facture électronique devient obligatoire pour toutes les entreprises entre 2026 et 2027. Vos factures sont déjà au bon format.",
    details: ["Format Factur-X", "Suivi de chaque transmission", "Mentions obligatoires ajoutées d'office"],
    badge: "Obligatoire 2026-2027",
  },
  {
    icon: "ri-calculator-line",
    titre: "La comptabilité part toute seule",
    texte: "Chaque mois, votre comptable reçoit le journal des ventes. Vous repérez d'un coup d'œil ce qui reste à encaisser.",
    details: ["Envoi automatique au comptable", "TVA multi-taux", "Export à tout moment"],
  },
];

export default function Features() {
  return (
    <section id="fonctionnalites" className="w-full bg-background-100 border-y border-background-200">
      <div className="w-full px-4 md:px-8 lg:px-12 py-14 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-700">
            <i className="ri-apps-2-line"></i>
            Ce que l'application fait pour vous
          </span>
          <h2 className="mt-3 font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-foreground-950 tracking-tight">
            Du premier devis au dernier euro encaissé
          </h2>
          <p className="mt-4 text-foreground-600 text-base md:text-lg leading-relaxed">
            Un seul outil pour tout ce qui se passe autour du chantier. Une information saisie une fois sert partout :
            devis, facture, planning et relances.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 max-w-6xl mx-auto">
          {benefices.map((b) => (
            <article
              key={b.titre}
              className="group flex flex-col p-6 rounded-lg bg-background-50 border border-background-200 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="w-12 h-12 flex items-center justify-center rounded-lg bg-primary-100 text-primary-700 text-2xl group-hover:bg-primary-500 group-hover:text-background-50 transition-colors">
                  <i className={b.icon}></i>
                </span>
                {b.badge && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-accent-100 text-accent-800 text-[11px] font-bold whitespace-nowrap">
                    {b.badge}
                  </span>
                )}
              </div>
              <h3 className="mt-5 font-heading font-semibold text-lg text-foreground-950 leading-snug">{b.titre}</h3>
              <p className="mt-2 text-sm text-foreground-600 leading-relaxed flex-1">{b.texte}</p>
              <ul className="mt-5 flex flex-col gap-1.5">
                {b.details.map((d) => (
                  <li key={d} className="flex items-center gap-2 text-sm text-foreground-700">
                    <i className="ri-check-line text-accent-600"></i>
                    {d}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/app/auth?mode=inscription"
            className="inline-flex items-center justify-center gap-2 min-h-12 py-3 px-6 rounded-md bg-primary-500 text-background-50 font-semibold text-center cursor-pointer hover:bg-primary-600 transition-colors"
          >
            Tout essayer gratuitement pendant 14 jours
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </div>
    </section>
  );
}
