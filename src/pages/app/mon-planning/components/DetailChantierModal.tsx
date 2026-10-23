import { useEffect, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import type { CreneauPerso } from "@/lib/planningIntervenant";
import { fetchChantierIntervenant, lienItineraire, type ChantierIntervenant } from "@/lib/chantierIntervenant";
import { MODE_TERRAIN } from "@/lib/modeTerrain";

// Dans l'application mobile, un lien sans cible ouvre Maps / le téléphone ; sur le web, un nouvel onglet.
const CIBLE_EXTERNE = MODE_TERRAIN ? undefined : "_blank";

/**
 * Ce dont l'intervenant a besoin pour se rendre sur le chantier et y travailler : adresse avec
 * itinéraire, client à appeler, note et étapes. Sans détail disponible (chantier non rattaché ou
 * fonction Backend absente), on affiche ce que porte l'intervention elle-même.
 */
export default function DetailChantierModal({ creneau, onClose }: { creneau: CreneauPerso; onClose: () => void }) {
  const [chantier, setChantier] = useState<ChantierIntervenant | null>(null);
  const [chargement, setChargement] = useState(Boolean(creneau.chantier_id));

  useEffect(() => {
    if (!creneau.chantier_id) return;
    let actif = true;
    fetchChantierIntervenant(creneau.chantier_id)
      .then((c) => {
        if (actif) setChantier(c);
      })
      .finally(() => {
        if (actif) setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, [creneau.chantier_id]);

  const adresse = chantier?.adresse || chantier?.clientAdresse || creneau.ville;
  const telephone = chantier?.clientTelephone ?? null;
  const etapesFaites = chantier ? chantier.etapes.filter((e) => e.fait).length : 0;

  return (
    <Modal title={chantier?.libelle || creneau.libelle} subtitle="Détail du chantier" onClose={onClose}>
      {chargement ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-foreground-500">
          <i className="ri-loader-4-line animate-spin text-primary-600"></i>
          Chargement du chantier…
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <section className="p-3 rounded-lg bg-background-100 border border-background-200">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Adresse</p>
            <p className="mt-1 text-sm text-foreground-900">{adresse || "Adresse non renseignée"}</p>
            {adresse && (
              <a
                href={lienItineraire(adresse)}
                target={CIBLE_EXTERNE}
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary-500 text-background-50 text-xs font-semibold cursor-pointer hover:bg-primary-600"
              >
                <i className="ri-route-line"></i>
                Itinéraire
              </a>
            )}
          </section>

          {chantier?.clientNom && (
            <section className="p-3 rounded-lg bg-background-100 border border-background-200">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Client</p>
              <p className="mt-1 text-sm font-semibold text-foreground-900">{chantier.clientNom}</p>
              {chantier.clientContact && <p className="text-xs text-foreground-500">Contact : {chantier.clientContact}</p>}
              {telephone && (
                <a
                  href={`tel:${telephone.replace(/\s+/g, "")}`}
                  className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-800 text-xs font-semibold cursor-pointer hover:border-primary-300"
                >
                  <i className="ri-phone-line"></i>
                  Appeler {telephone}
                </a>
              )}
            </section>
          )}

          {(chantier?.note || creneau.note) && (
            <section className="p-3 rounded-lg bg-background-100 border border-background-200">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">Notes</p>
              {chantier?.note && <p className="mt-1 text-sm text-foreground-800 whitespace-pre-line">{chantier.note}</p>}
              {creneau.note && (
                <p className="mt-1 text-sm text-foreground-800 whitespace-pre-line">
                  <span className="text-foreground-500">Intervention : </span>
                  {creneau.note}
                </p>
              )}
            </section>
          )}

          {chantier && chantier.etapes.length > 0 && (
            <section className="p-3 rounded-lg bg-background-100 border border-background-200">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-400">
                Étapes · {etapesFaites}/{chantier.etapes.length}
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {chantier.etapes.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <i
                      className={`mt-0.5 ${e.fait ? "ri-checkbox-circle-fill text-primary-600" : "ri-checkbox-blank-circle-line text-foreground-300"}`}
                    ></i>
                    <span className={e.fait ? "text-foreground-500 line-through" : "text-foreground-800"}>{e.libelle}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!chantier && (
            <p className="text-xs text-foreground-500">
              {creneau.chantier_id
                ? "Le détail du chantier n'est pas disponible pour le moment : seules les informations de l'intervention sont affichées."
                : "Cette intervention n'est rattachée à aucun chantier."}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
