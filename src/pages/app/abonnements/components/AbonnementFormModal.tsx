import { useState } from "react";
import { toISODate, addDays } from "@/lib/dates";
import Modal from "@/pages/app/components/Modal";
import { OFFRE_PRIX, OFFRES, STATUTS_ABO, type AbonnementPayload } from "@/lib/abonnementsApi";

export default function AbonnementFormModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: AbonnementPayload) => void;
}) {
  const [entreprise, setEntreprise] = useState("");
  const [email, setEmail] = useState("");
  const [metier, setMetier] = useState("");
  const [ville, setVille] = useState("");
  const [offre, setOffre] = useState<string>("Pro");
  const [statut, setStatut] = useState<string>("Actif");
  const [montant, setMontant] = useState<string>(String(OFFRE_PRIX.Pro));
  const [canal, setCanal] = useState("SEPA");
  const [iban, setIban] = useState("");
  const [mandat, setMandat] = useState("");
  const [debut, setDebut] = useState(toISODate(new Date()));
  const [echeance, setEcheance] = useState(toISODate(addDays(new Date(), 30)));
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400 cursor-pointer";

  const changeOffre = (value: string) => {
    setOffre(value);
    setMontant(String(OFFRE_PRIX[value] ?? 0));
  };

  const handleSubmit = () => {
    if (!entreprise.trim()) {
      setError("Le nom de l'entreprise artisanale est obligatoire.");
      return;
    }
    setError(null);
    onSubmit({
      entreprise: entreprise.trim(),
      email: email.trim(),
      metier: metier.trim(),
      ville: ville.trim(),
      offre,
      statut,
      montant_mensuel: Number(montant) || 0,
      canal_paiement: canal,
      iban: iban.trim(),
      mandat_sepa: mandat.trim(),
      date_debut: debut || null,
      date_echeance: echeance || null,
    });
  };

  return (
    <Modal
      title="Nouvel abonnement"
      subtitle="Enregistrez un artisan abonné à ArtiFlow-pro."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-60"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
            Enregistrer
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Entreprise artisanale</span>
          <input value={entreprise} onChange={(e) => setEntreprise(e.target.value)} placeholder="Plomberie Martin & Fils" className={`${inputCls} cursor-text`} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@entreprise.fr" className={`${inputCls} cursor-text`} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Métier</span>
            <input value={metier} onChange={(e) => setMetier(e.target.value)} placeholder="Plombier" className={`${inputCls} cursor-text`} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground-700">Ville</span>
          <input value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Lyon" className={`${inputCls} cursor-text`} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Offre</span>
            <select value={offre} onChange={(e) => changeOffre(e.target.value)} className={inputCls}>
              {OFFRES.map((o) => (
                <option key={o} value={o}>
                  {o} — {OFFRE_PRIX[o]} €/mois
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Statut</span>
            <select value={statut} onChange={(e) => setStatut(e.target.value)} className={inputCls}>
              {STATUTS_ABO.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Montant mensuel (€)</span>
            <input value={montant} onChange={(e) => setMontant(e.target.value)} inputMode="numeric" placeholder="59" className={`${inputCls} cursor-text`} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Canal de paiement</span>
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className={inputCls}>
              <option value="SEPA">Prélèvement SEPA</option>
              <option value="Carte">Carte bancaire</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">IBAN (prélèvement SEPA)</span>
            <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="FR76 3000 4008 2800 0123 4567 890" className={`${inputCls} cursor-text`} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Mandat SEPA (RUM)</span>
            <input value={mandat} onChange={(e) => setMandat(e.target.value)} placeholder="RUM-ARTIFLOW-0001" className={`${inputCls} cursor-text`} />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Début</span>
            <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Prochaine échéance</span>
            <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className={inputCls} />
          </label>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}