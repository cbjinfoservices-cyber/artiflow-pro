import { useJournalErreursChargement } from "@/hooks/useJournalErreursChargement";

/**
 * Indicateur clé du back-office : le nombre de BLOCAGES consignés dans le journal des erreurs
 * de chargement. Un « blocage » = un écran qui n'a pas pu afficher ses données (colonne, table
 * ou liaison en cause). Affiché en vert quand tout va bien, en rouge dès qu'un écran est cassé.
 *
 * Un clic fait défiler la page jusqu'au journal des erreurs pour en voir le détail.
 */
export default function KpiBlocagesChargement() {
  const { erreurs } = useJournalErreursChargement();
  // On ne compte que les blocages encore OUVERTS : un incident marqué « résolu » ne doit plus
  // allumer l'alerte, sinon on finirait par ignorer une pastille rouge permanente.
  const blocages = erreurs.filter((e) => e.gravite === "blocage" && !e.resolu).length;
  const ok = blocages === 0;

  const faireDefiler = () => {
    const cible = document.getElementById("journal-erreurs");
    if (cible) cible.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <button
      type="button"
      onClick={faireDefiler}
      title={
        ok
          ? "Aucun blocage : tous les écrans consultés sur ce navigateur ont chargé leurs données."
          : `${blocages} écran${blocages > 1 ? "s" : ""} en erreur de chargement. Cliquez pour voir le détail dans le journal.`
      }
      className={`group flex flex-col gap-1 p-4 rounded-lg border text-left cursor-pointer transition-colors ${
        ok
          ? "bg-background-100 border-background-200 hover:border-primary-300"
          : "bg-red-50 border-red-200 hover:border-red-400"
      }`}
    >
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
        <i className={`${ok ? "ri-shield-check-line text-accent-600" : "ri-close-circle-line text-red-500"}`}></i>
        Blocages
        <i className="ri-arrow-right-up-line ml-auto text-foreground-300 group-hover:text-primary-600 transition-colors"></i>
      </span>
      <span className={`font-heading font-bold text-2xl ${ok ? "text-foreground-950" : "text-red-700"}`}>
        {blocages}
      </span>
      <span className="text-[11px] text-foreground-500">
        {ok ? "aucun écran cassé" : `écran${blocages > 1 ? "s" : ""} en erreur de chargement`}
      </span>
    </button>
  );
}