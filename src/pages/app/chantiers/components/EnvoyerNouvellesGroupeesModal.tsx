import { useMemo, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import ApercuEmailGroupeModal from "@/pages/app/chantiers/components/ApercuEmailGroupeModal";
import { lienSuiviChantier, notifierSuiviChantier } from "@/lib/suiviChantier";

/** Un chantier silencieux à relancer d'un seul geste. */
export interface ChantierNouvellesCible {
  id: number;
  libelle: string;
  clientNom: string | null;
  /** Adresse email du client, ou null s'il n'en a pas. */
  email: string | null;
  /** Jeton du lien de suivi (null si le partage est désactivé). */
  token: string | null;
}

/** Message proposé par défaut dans l'email groupé (modifiable avant l'envoi). */
const MESSAGE_DEFAUT =
  "Petit point sur l'avancement de votre chantier : les travaux progressent comme prévu. Le détail des étapes est à jour sur votre page de suivi.";

/**
 * Envoi groupé des nouvelles à tous les clients silencieux.
 * Un seul clic envoie un email personnalisé à chaque client (son chantier, son avancement),
 * avec le lien de suivi déjà rempli. Les chantiers sans adresse ou sans suivi partagé sont
 * écartés et signalés, pour ne pas promettre un envoi qui ne peut pas partir.
 */
export default function EnvoyerNouvellesGroupeesModal({
  chantiers,
  onClose,
  onTermine,
}: {
  chantiers: ChantierNouvellesCible[];
  onClose: () => void;
  onTermine: () => void;
}) {
  const [message, setMessage] = useState(MESSAGE_DEFAUT);
  const [busy, setBusy] = useState(false);
  const [progression, setProgression] = useState({ fait: 0, total: 0 });
  const [fin, setFin] = useState<{ envoyes: number; echecs: Array<{ libelle: string; raison: string }> } | null>(null);
  // Aperçu du rendu, sans aucun envoi.
  const [apercuOuvert, setApercuOuvert] = useState(false);

  const joinables = useMemo(() => chantiers.filter((c) => Boolean(c.email) && Boolean(c.token)), [chantiers]);
  const ignores = useMemo(() => chantiers.filter((c) => !c.email || !c.token), [chantiers]);

  const envoyer = async () => {
    if (busy || joinables.length === 0) return;
    setBusy(true);
    setFin(null);
    setProgression({ fait: 0, total: joinables.length });
    const echecs: Array<{ libelle: string; raison: string }> = [];
    let envoyes = 0;
    const texte = message.trim() || MESSAGE_DEFAUT;

    for (const cible of joinables) {
      try {
        const res = await notifierSuiviChantier(cible.id, lienSuiviChantier(cible.token ?? ""), texte, "groupe");
        if (res.ok) {
          envoyes += 1;
        } else {
          echecs.push({ libelle: cible.libelle, raison: res.error ?? "L'email n'a pas pu être envoyé." });
        }
      } catch {
        echecs.push({ libelle: cible.libelle, raison: "L'email n'a pas pu être envoyé." });
      }
      setProgression({ fait: envoyes + echecs.length, total: joinables.length });
    }

    setFin({ envoyes, echecs });
    setBusy(false);
    if (envoyes > 0) onTermine();
  };

  return (
    <Modal
      title={fin ? "Nouvelles envoyées" : "Envoyer des nouvelles à tous les clients silencieux"}
      subtitle={
        fin
          ? `${fin.envoyes} email${fin.envoyes > 1 ? "s" : ""} parti${fin.envoyes > 1 ? "s" : ""} sur ${joinables.length} client${joinables.length > 1 ? "s" : ""} concerné${joinables.length > 1 ? "s" : ""}.`
          : `${joinables.length} client${joinables.length > 1 ? "s" : ""} recevront un email personnalisé avec l'avancement de leur chantier et son lien de suivi.`
      }
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        fin ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
          >
            <i className="ri-check-line"></i>
            Terminer
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-background-50 border border-background-200 text-foreground-600 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-background-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={envoyer}
              disabled={busy || joinables.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className={busy ? "ri-loader-4-line animate-spin" : "ri-send-plane-line"}></i>
              {busy
                ? `Envoi en cours… (${progression.fait}/${progression.total})`
                : `Envoyer ${joinables.length} email${joinables.length > 1 ? "s" : ""}`}
            </button>
          </>
        )
      }
    >
      {fin ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5 rounded-lg bg-primary-50 border border-primary-200 p-3">
            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <i className="ri-mail-check-line"></i>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-950">
                {fin.envoyes} client{fin.envoyes > 1 ? "s" : ""} relancé{fin.envoyes > 1 ? "s" : ""}
              </p>
              <p className="mt-0.5 text-xs text-foreground-600">
                La date du dernier email est mise à jour sur chaque carte, et l'envoi apparaît dans le journal de suivi.
              </p>
            </div>
          </div>
          {fin.echecs.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3">
              <p className="text-xs font-semibold text-red-700 inline-flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i>
                {fin.echecs.length} envoi{fin.echecs.length > 1 ? "s" : ""} n&apos;ont pas abouti
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {fin.echecs.map((e) => (
                  <li key={`${e.libelle}-${e.raison}`} className="text-[11px] text-red-700">
                    <strong className="font-semibold">{e.libelle}</strong> · {e.raison}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">
              Message envoyé à chaque client
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={4}
              disabled={busy}
              className="w-full box-border px-3 py-2 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-800 outline-none focus:ring-2 focus:ring-primary-300 resize-none disabled:opacity-60"
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setApercuOuvert(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:border-primary-300 hover:text-primary-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-eye-line"></i>
                Aperçu de l&apos;email groupé
              </button>
              <span className="text-[10px] text-foreground-400 tabular-nums">{message.length}/500</span>
            </div>
          </label>

          <div className="rounded-lg border border-background-200 overflow-hidden">
            <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-400 bg-background-100">
              Destinataires · {joinables.length}
            </p>
            <ul className="max-h-52 overflow-y-auto divide-y divide-background-200">
              {joinables.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                  <i className="ri-mail-line text-primary-600 text-sm shrink-0"></i>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-foreground-900 truncate">{c.libelle}</span>
                    <span className="block text-[10px] text-foreground-500 truncate">
                      {c.clientNom ?? "Client"} · {c.email}
                    </span>
                  </span>
                </li>
              ))}
              {joinables.length === 0 && (
                <li className="px-3 py-3 text-xs text-foreground-500">
                  Aucun client joignable pour l&apos;instant : il faut une adresse email et un suivi partagé.
                </li>
              )}
            </ul>
          </div>

          {ignores.length > 0 && (
            <div className="rounded-lg bg-background-100 border border-background-200 p-3">
              <p className="text-[11px] font-semibold text-foreground-600 inline-flex items-center gap-1.5">
                <i className="ri-eye-off-line"></i>
                {ignores.length} chantier{ignores.length > 1 ? "s" : ""} écarté{ignores.length > 1 ? "s" : ""}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {ignores.slice(0, 5).map((c) => (
                  <li key={c.id} className="text-[10px] text-foreground-500 truncate">
                    {c.libelle} · {!c.email ? "pas d'adresse email dans la fiche client" : "suivi non partagé avec le client"}
                  </li>
                ))}
                {ignores.length > 5 && (
                  <li className="text-[10px] text-foreground-400">+ {ignores.length - 5} autre(s)</li>
                )}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-foreground-500">
            Chaque email reprend l&apos;avancement réel du chantier, vos couleurs et le lien de suivi du client.
          </p>

          {apercuOuvert && (
            <ApercuEmailGroupeModal message={message} onClose={() => setApercuOuvert(false)} />
          )}
        </div>
      )}
    </Modal>
  );
}