import { useMemo, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import ApercuFactureRapide from "@/pages/app/components/ApercuFactureRapide";
import { useAuth } from "@/hooks/useAuth";
import type { EcheancesDuJour, FactureAEcheance } from "@/hooks/useEcheancesDuJour";
import { construirePdfFactureEcheance } from "@/lib/factureEcheancePdf";
import { pdfToBase64 } from "@/lib/pdf";
import { sendFactureRelanceEmail } from "@/lib/email";
import { formatEuros } from "@/lib/format";
import { formatDateHeureCourte, formatShortDate, todayISO } from "@/lib/dates";

/** Nombre maximum de rappels envoyés en une seule fois par « Tout relancer ». */
const PLAFOND_RELANCE_GROUPE = 5;

/** Bilan d'un envoi groupé, affiché sous la synthèse. */
interface BilanGroupe {
  envoyes: number;
  echecs: number;
  restants: number;
}

/**
 * Fenêtre « À encaisser aujourd'hui », ouverte depuis la pastille d'échéances du menu.
 *
 * Elle liste les factures impayées dont l'échéance est passée ou tombe aujourd'hui, avec un
 * bouton « Voir la facture » par ligne : l'aperçu s'ouvre par-dessus, sans quitter la page
 * où l'on se trouve, et sans rien enregistrer.
 *
 * Une seconde action, « Relancer », envoie au client un email de rappel avec le PDF de la
 * facture en pièce jointe. Chaque ligne rappelle la date du dernier rappel réellement envoyé,
 * pour éviter de relancer deux fois le même client. Un bouton « Tout relancer » traite les
 * factures en retard par petits lots plafonnés.
 */
export default function ModaleEcheancesJour({
  echeances,
  onOuvrirListe,
  onClose,
}: {
  /** Compteurs et liste fournis par `useEcheancesDuJour`. */
  echeances: EcheancesDuJour;
  /** Ouvre la page Factures déjà filtrée sur les encaissements du jour. */
  onOuvrirListe: () => void;
  onClose: () => void;
}) {
  const today = todayISO();
  const [factureOuverte, setFactureOuverte] = useState<FactureAEcheance | null>(null);
  const { profile, user } = useAuth();
  const [relanceEnCours, setRelanceEnCours] = useState<number | null>(null);
  const [envoiGroupe, setEnvoiGroupe] = useState(false);
  const [relanceOk, setRelanceOk] = useState<string | null>(null);
  const [relanceErreur, setRelanceErreur] = useState<string | null>(null);
  const [bilanGroupe, setBilanGroupe] = useState<BilanGroupe | null>(null);
  // Rappels envoyés pendant cette ouverture : met à jour la date affichée sans recharger la page.
  const [rappelsLocaux, setRappelsLocaux] = useState<Record<number, string>>({});

  /** Vrai si l'échéance de la facture est déjà dépassée. */
  const estEnRetard = (f: FactureAEcheance) =>
    Boolean(f.dateEcheance) && String(f.dateEcheance) < today;

  /** Date (et heure) du dernier rappel, en tenant compte de ceux envoyés à l'instant. */
  const dernierRappelDe = (f: FactureAEcheance): string | null =>
    rappelsLocaux[f.id] ?? f.dernierRappel;

  /** Vrai si le client a déjà été relancé aujourd'hui : signalé en clair sur la ligne. */
  const relanceAujourdhui = (f: FactureAEcheance): boolean => {
    const dernier = dernierRappelDe(f);
    return Boolean(dernier) && String(dernier).slice(0, 10) === today;
  };

  const facturesEnRetard = useMemo(
    () => echeances.factures.filter(estEnRetard),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [echeances.factures, today],
  );

  // Lot du prochain clic : uniquement les retards, avec email, pas déjà relancés aujourd'hui.
  const lotSuivant = useMemo(() => {
    const eligibles = facturesEnRetard.filter(
      (f) => Boolean(f.clientEmail) && !relanceAujourdhui(f),
    );
    return eligibles.slice(0, PLAFOND_RELANCE_GROUPE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturesEnRetard, rappelsLocaux, today]);

  const restantsApresLot = useMemo(() => {
    const eligibles = facturesEnRetard.filter(
      (f) => Boolean(f.clientEmail) && !relanceAujourdhui(f),
    );
    return Math.max(0, eligibles.length - PLAFOND_RELANCE_GROUPE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturesEnRetard, rappelsLocaux, today]);

  const sansEmail = useMemo(
    () => facturesEnRetard.filter((f) => !f.clientEmail).length,
    [facturesEnRetard],
  );

  const dejaRelanceesAujourdhui = useMemo(
    () => facturesEnRetard.filter((f) => relanceAujourdhui(f)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facturesEnRetard, rappelsLocaux, today],
  );

  /** Construit le PDF de la facture et envoie le rappel. Lève une erreur si l'envoi échoue. */
  const envoyerRelance = async (facture: FactureAEcheance) => {
    const doc = await construirePdfFactureEcheance(facture, profile, user?.email ?? "");
    await sendFactureRelanceEmail(facture.id, pdfToBase64(doc), `${facture.numero}.pdf`);
    setRappelsLocaux((prev) => ({ ...prev, [facture.id]: new Date().toISOString() }));
  };

  /** Envoie un rappel au client, avec le PDF de la facture en pièce jointe. */
  const handleRelancer = async (facture: FactureAEcheance) => {
    setRelanceOk(null);
    setRelanceErreur(null);
    setBilanGroupe(null);
    if (!facture.clientEmail) {
      setRelanceErreur(
        `Impossible de relancer ${facture.numero} : ce client n'a pas d'adresse email. Ajoutez-la dans sa fiche.`,
      );
      return;
    }
    setRelanceEnCours(facture.id);
    try {
      await envoyerRelance(facture);
      setRelanceOk(
        `Relance envoyée à ${facture.clientEmail} avec la facture ${facture.numero} en pièce jointe.`,
      );
    } catch (e) {
      setRelanceErreur(
        e instanceof Error
          ? e.message
          : `L'envoi de la relance pour ${facture.numero} a échoué. Réessayez.`,
      );
    } finally {
      setRelanceEnCours(null);
    }
  };

  /** Envoie le lot de rappels (factures en retard uniquement), dans la limite du plafond. */
  const handleToutRelancer = async () => {
    if (envoiGroupe || lotSuivant.length === 0) return;
    setRelanceOk(null);
    setRelanceErreur(null);
    setBilanGroupe(null);
    setEnvoiGroupe(true);
    const lot = [...lotSuivant];
    const restants = restantsApresLot;
    let envoyes = 0;
    let echecs = 0;
    for (const facture of lot) {
      setRelanceEnCours(facture.id);
      try {
        await envoyerRelance(facture);
        envoyes += 1;
      } catch {
        echecs += 1;
      }
    }
    setRelanceEnCours(null);
    setEnvoiGroupe(false);
    setBilanGroupe({ envoyes, echecs, restants });
  };

  // L'aperçu PDF prend la place de la liste : une seule fenêtre à la fois, aucun empilement.
  if (factureOuverte) {
    return <ApercuFactureRapide facture={factureOuverte} onClose={() => setFactureOuverte(null)} />;
  }

  const total = echeances.facturesJour + echeances.facturesRetard;
  const occupe = envoiGroupe || relanceEnCours !== null;

  return (
    <Modal
      title="À encaisser aujourd'hui"
      subtitle="Factures encore impayées dont l'échéance est aujourd'hui ou déjà dépassée."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={onOuvrirListe}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-filter-3-line"></i>
            Ouvrir la liste filtrée
          </button>
        </>
      }
    >
      {/* Synthèse : combien, et combien ça représente. */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-accent-50 border border-accent-200">
        <span className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <i className="ri-money-euro-circle-line text-lg"></i>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground-950">
            {total} facture{total > 1 ? "s" : ""} à encaisser · {formatEuros(echeances.montant)}
          </p>
          <p className="text-xs text-foreground-600 mt-0.5">
            {echeances.facturesJour} au titre d&apos;aujourd&apos;hui
            {echeances.facturesRetard > 0 ? ` · ${echeances.facturesRetard} déjà en retard` : ""}
            {echeances.relancesJour > 0
              ? ` · ${echeances.relancesJour} relance${echeances.relancesJour > 1 ? "s" : ""} au départ`
              : ""}
          </p>
        </div>
      </div>

      {/* Envoi groupé : uniquement les retards, par lots plafonnés. */}
      {facturesEnRetard.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 p-3 rounded-lg bg-background-100 border border-background-200">
          <span className="w-9 h-9 shrink-0 flex items-center justify-center rounded-md bg-red-500/10 text-red-600">
            <i className="ri-alarm-warning-line text-sm"></i>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground-900">
              {facturesEnRetard.length} facture{facturesEnRetard.length > 1 ? "s" : ""} en retard
            </p>
            <p className="text-[11px] text-foreground-500 mt-0.5">
              {lotSuivant.length > 0
                ? `Prochain clic : ${lotSuivant.length} rappel${lotSuivant.length > 1 ? "s" : ""} (plafond ${PLAFOND_RELANCE_GROUPE})`
                : "Aucune relance à envoyer : les retards ont déjà été rappelés aujourd'hui."}
              {restantsApresLot > 0 ? ` · ${restantsApresLot} resteront pour le clic suivant` : ""}
              {dejaRelanceesAujourdhui > 0 ? ` · ${dejaRelanceesAujourdhui} déjà relancée${dejaRelanceesAujourdhui > 1 ? "s" : ""} aujourd'hui` : ""}
              {sansEmail > 0 ? ` · ${sansEmail} sans email` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleToutRelancer}
            disabled={lotSuivant.length === 0 || occupe}
            title={
              lotSuivant.length === 0
                ? "Aucune facture en retard à relancer pour l'instant"
                : `Envoyer ${lotSuivant.length} rappel${lotSuivant.length > 1 ? "s" : ""} avec la facture en pièce jointe (plafond de ${PLAFOND_RELANCE_GROUPE} par clic)`
            }
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-red-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {envoiGroupe ? (
              <i className="ri-loader-4-line animate-spin"></i>
            ) : (
              <i className="ri-send-plane-2-line"></i>
            )}
            {envoiGroupe ? "Envoi groupé…" : `Tout relancer (${lotSuivant.length})`}
          </button>
        </div>
      )}

      {bilanGroupe && (
        <p
          className={`mt-3 text-xs flex items-start gap-1.5 ${
            bilanGroupe.echecs > 0 ? "text-red-600" : "text-accent-700"
          }`}
        >
          <i
            className={
              bilanGroupe.echecs > 0 ? "ri-error-warning-line mt-0.5" : "ri-checkbox-circle-line mt-0.5"
            }
          ></i>
          <span>
            <strong>
              {bilanGroupe.envoyes} relance{bilanGroupe.envoyes > 1 ? "s" : ""} envoyée
              {bilanGroupe.envoyes > 1 ? "s" : ""}
            </strong>
            {bilanGroupe.echecs > 0
              ? ` · ${bilanGroupe.echecs} échec${bilanGroupe.echecs > 1 ? "s" : ""} à réessayer à la main`
              : " avec la facture en pièce jointe"}
            .
            {bilanGroupe.restants > 0
              ? ` ${bilanGroupe.restants} autre${bilanGroupe.restants > 1 ? "s" : ""} facture${
                  bilanGroupe.restants > 1 ? "s" : ""
                } en retard : relancez le lot suivant quand vous voulez.`
              : ""}
          </span>
        </p>
      )}

      {relanceOk && (
        <p className="mt-3 text-xs text-accent-700 flex items-start gap-1.5">
          <i className="ri-checkbox-circle-line mt-0.5"></i>
          {relanceOk}
        </p>
      )}
      {relanceErreur && (
        <p className="mt-3 text-xs text-red-600 flex items-start gap-1.5">
          <i className="ri-error-warning-line mt-0.5"></i>
          {relanceErreur}
        </p>
      )}

      {echeances.factures.length === 0 ? (
        <p className="py-8 text-center text-sm text-foreground-500">
          Aucune facture à encaisser aujourd&apos;hui : tout est réglé.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2 max-h-[46vh] overflow-y-auto pr-1">
          {echeances.factures.map((f) => {
            const enRetard = estEnRetard(f);
            const dernier = dernierRappelDe(f);
            const relanceeAujourdhui = relanceAujourdhui(f);
            return (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-background-100 border border-background-200"
              >
                <span
                  className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-md ${
                    enRetard ? "bg-red-500/10 text-red-600" : "bg-accent-100 text-accent-700"
                  }`}
                >
                  <i className={`text-sm ${enRetard ? "ri-alarm-warning-line" : "ri-calendar-check-line"}`}></i>
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground-950 flex items-center gap-2 flex-wrap">
                    {f.numero}
                    <span
                      className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                        enRetard
                          ? "bg-red-500 text-background-50"
                          : "bg-accent-100 text-accent-800 border border-accent-200"
                      }`}
                    >
                      {enRetard ? "En retard" : "Échéance du jour"}
                    </span>
                  </p>
                  <p className="text-[11px] text-foreground-500 mt-0.5 truncate">
                    {f.clientNom ?? "Sans client"} · échéance {f.dateEcheance ? formatShortDate(f.dateEcheance) : "—"}
                  </p>
                  {/* Dernier rappel : le repère qui évite de relancer deux fois le même client. */}
                  <p className="text-[11px] mt-1 flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 whitespace-nowrap ${
                        relanceeAujourdhui
                          ? "text-secondary-800 font-semibold"
                          : dernier
                            ? "text-foreground-600"
                            : "text-foreground-400"
                      }`}
                    >
                      <i className={dernier ? "ri-mail-check-line" : "ri-mail-line"}></i>
                      {dernier ? `Dernier rappel : ${formatDateHeureCourte(dernier)}` : "Jamais relancée"}
                    </span>
                    {relanceeAujourdhui && (
                      <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-secondary-100 text-secondary-900 text-[10px] font-semibold whitespace-nowrap">
                        <i className="ri-repeat-line"></i>
                        déjà relancée aujourd&apos;hui
                      </span>
                    )}
                  </p>
                </div>

                <span className="text-sm font-semibold text-foreground-950 tabular-nums whitespace-nowrap">
                  {formatEuros(f.totalTtc)}
                </span>

                <button
                  type="button"
                  onClick={() => handleRelancer(f)}
                  disabled={occupe}
                  title={
                    !f.clientEmail
                      ? "Ce client n'a pas d'adresse email"
                      : relanceeAujourdhui
                        ? `Déjà relancée aujourd'hui — vérifiez avant de renvoyer (dernier rappel ${formatDateHeureCourte(dernier)})`
                        : `Envoyer un rappel à ${f.clientEmail}, avec la facture en pièce jointe`
                  }
                  className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    relanceeAujourdhui
                      ? "bg-background-50 border border-secondary-200 text-secondary-800 hover:bg-secondary-50"
                      : "bg-accent-500 text-background-50 hover:bg-accent-600"
                  }`}
                >
                  {relanceEnCours === f.id ? (
                    <i className="ri-loader-4-line animate-spin"></i>
                  ) : (
                    <i className={relanceeAujourdhui ? "ri-repeat-line" : "ri-send-plane-line"}></i>
                  )}
                  {relanceEnCours === f.id ? "Envoi…" : relanceeAujourdhui ? "Relancer encore" : "Relancer"}
                </button>

                <button
                  type="button"
                  onClick={() => setFactureOuverte(f)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-background-50 border border-background-200 text-foreground-700 text-xs font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-800 transition-colors"
                  title="Aperçu rapide de la facture, sans quitter cette page"
                >
                  <i className="ri-eye-line"></i>
                  Voir la facture
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-[11px] text-foreground-400 flex items-start gap-1.5">
        <i className="ri-information-line mt-0.5"></i>
        « Voir la facture » ouvre un aperçu sans rien envoyer ni enregistrer. « Relancer » envoie un email de rappel au
        client, avec le PDF de la facture en pièce jointe. « Tout relancer » ne traite que les factures en retard,
        {` ${PLAFOND_RELANCE_GROUPE} au maximum par clic`}, et ignore celles déjà rappelées aujourd&apos;hui.
      </p>
    </Modal>
  );
}