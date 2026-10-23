import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { FactureItem } from "@/hooks/useArtisanData";
import { formatEuros } from "@/lib/format";

interface Props {
  factures: FactureItem[];
}

/** Clé « AAAA-MM » d'une facture (date d'émission, sinon date de création). */
function cleMois(f: FactureItem): string {
  const base = f.date_emission ?? f.created_at.slice(0, 10);
  return base.slice(0, 7);
}

/**
 * Rappels de facturation électronique sur le tableau de bord :
 * — combien de factures du mois courant n'ont pas encore leur fichier structuré ;
 * — combien de factures sont rejetées et attendent une correction.
 * Chaque indicateur s'efface quand il n'a rien à signaler.
 */
export default function FacturesEfMoisCard({ factures }: Props) {
  const infos = useMemo(() => {
    const maintenant = new Date();
    const cle = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}`;
    const duMois = factures.filter((f) => cleMois(f) === cle);
    const aPreparer = duMois.filter((f) => f.efacture_statut === "non_preparee");
    return {
      libelle: maintenant.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
      total: duMois.length,
      aPreparer: aPreparer.length,
      montant: aPreparer.reduce((somme, f) => somme + Number(f.total_ttc || 0), 0),
    };
  }, [factures]);

  // Rejets : on ne les limite pas au mois courant, une facture rejetée doit être
  // corrigée quel que soit le mois de son émission.
  const rejets = useMemo(() => {
    const list = factures.filter((f) => f.efacture_statut === "rejetee");
    return {
      nombre: list.length,
      montant: list.reduce((somme, f) => somme + Number(f.total_ttc || 0), 0),
      dernierMotif: list.find((f) => (f.efacture_motif ?? "").trim())?.efacture_motif ?? null,
    };
  }, [factures]);

  const aSignaler = infos.total > 0 || rejets.nombre > 0;
  if (!aSignaler) return null;

  const reste = infos.aPreparer > 0;
  const aCorriger = rejets.nombre > 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {infos.total > 0 && (
        <section
          className={`rounded-lg border p-5 ${
            reste ? "bg-accent-50 border-accent-200" : "bg-background-100 border-background-200"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span
                className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-lg ${
                  reste ? "bg-accent-100 text-accent-700" : "bg-background-200 text-foreground-500"
                }`}
              >
                <i className={reste ? "ri-file-code-line" : "ri-checkbox-circle-line"}></i>
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
                  Facturation électronique · {infos.libelle}
                </p>
                <p className="mt-1 font-heading font-semibold text-sm text-foreground-950">
                  {reste
                    ? `${infos.aPreparer} facture${infos.aPreparer > 1 ? "s" : ""} du mois encore à préparer`
                    : "Toutes les factures du mois sont prêtes"}
                </p>
                <p className="mt-1 text-xs text-foreground-600 max-w-xl">
                  {reste
                    ? `Il reste ${formatEuros(infos.montant)} de factures sans fichier XML. Générez-les d'un bloc pour pouvoir tout déposer sur votre plateforme au même moment.`
                    : `${infos.total} facture${infos.total > 1 ? "s" : ""} du mois ${infos.total > 1 ? "ont" : "a"} déjà ${infos.total > 1 ? "leur" : "son"} fichier Factur-X. Il ne reste plus qu'à déposer l'archive sur votre plateforme.`}
                </p>
              </div>
            </div>
            <Link
              to="/app/facturation-electronique"
              className={`inline-flex items-center gap-2 h-9 px-4 rounded-md text-xs font-semibold whitespace-nowrap transition-colors self-start ${
                reste
                  ? "bg-primary-500 text-background-50 hover:bg-primary-600"
                  : "bg-secondary-100 text-secondary-800 hover:bg-secondary-200"
              }`}
            >
              <i className={reste ? "ri-magic-line" : "ri-eye-line"}></i>
              {reste ? "Préparer les XML" : "Voir le registre"}
            </Link>
          </div>
        </section>
      )}

      {aCorriger && (
        <section className="rounded-lg border p-5 bg-secondary-50 border-secondary-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-lg bg-secondary-100 text-secondary-800">
                <i className="ri-error-warning-line"></i>
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500">
                  Facturation électronique · à corriger
                </p>
                <p className="mt-1 font-heading font-semibold text-sm text-foreground-950">
                  {rejets.nombre} facture{rejets.nombre > 1 ? "s" : ""} rejetée{rejets.nombre > 1 ? "s" : ""} à corriger
                </p>
                <p className="mt-1 text-xs text-foreground-600 max-w-xl">
                  {formatEuros(rejets.montant)} TTC{" "}
                  {rejets.nombre > 1 ? "bloqués" : "bloqué"} en attente de retransmission.
                  {rejets.dernierMotif ? ` Dernier motif : ${rejets.dernierMotif}` : " Ouvrez le registre pour voir le motif de chaque rejet."}
                </p>
              </div>
            </div>
            <Link
              to="/app/facturation-electronique?statut=rejetee"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-secondary-500 text-background-50 text-xs font-semibold whitespace-nowrap hover:bg-secondary-600 transition-colors self-start"
            >
              <i className="ri-tools-line"></i>
              Corriger
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}