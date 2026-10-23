import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChantierItem } from "@/hooks/useArtisanData";
import { marquerSuiviModifie, updateChantierSuivi, updateEtapeSuivi } from "@/lib/artisanApi";
import { supabase } from "@/lib/supabase";
import {
  fetchNotificationsSuivi,
  lienSuiviChantier,
  notifierSuiviChantier,
  televerserPhotoEtape,
  urlPhotoEtape,
  type NotificationSuivi,
} from "@/lib/suiviChantier";

type Feedback = { ton: "ok" | "ko"; texte: string } | null;

/**
 * Panneau « Suivi client » d'un chantier : partage du lien, message visible par le client,
 * photos et commentaires des étapes, et envoi d'un email de mise à jour au cas par cas.
 */
export default function SuiviClientPanel({
  chantier,
  onReload,
}: {
  chantier: ChantierItem;
  onReload: () => Promise<void>;
}) {
  const [partage, setPartage] = useState(chantier.suivi_actif);
  const [notifier, setNotifier] = useState(true);
  const [message, setMessage] = useState(chantier.message_client ?? "");
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<number, string | null>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [etapeOuverte, setEtapeOuverte] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [copie, setCopie] = useState(false);
  const fichierRef = useRef<HTMLInputElement | null>(null);
  const etapeEnCours = useRef<number | null>(null);

  // Journal des notifications réellement envoyées (ou tentées) au client.
  const [journal, setJournal] = useState<NotificationSuivi[]>([]);
  const [journalOuvert, setJournalOuvert] = useState(false);
  const [journalErreur, setJournalErreur] = useState<string | null>(null);

  const lien = useMemo(() => lienSuiviChantier(chantier.suivi_token ?? ""), [chantier.suivi_token]);

  useEffect(() => {
    setPartage(chantier.suivi_actif);
    setMessage(chantier.message_client ?? "");
  }, [chantier.id, chantier.suivi_actif, chantier.message_client]);

  // Adresse email du client : indispensable pour prévenir par email.
  useEffect(() => {
    let actif = true;
    if (!chantier.client_id) {
      setClientEmail(null);
      return;
    }
    supabase
      .from("clients")
      .select("email")
      .eq("id", chantier.client_id)
      .maybeSingle()
      .then(({ data }) => {
        if (actif) setClientEmail(((data as { email?: string | null } | null)?.email ?? null) || null);
      })
      .catch(() => {
        if (actif) setClientEmail(null);
      });
    return () => {
      actif = false;
    };
  }, [chantier.client_id]);

  // Résolution des photos (liens signés temporaires) + notes client en cours d'édition.
  useEffect(() => {
    let actif = true;
    const charger = async () => {
      const resultat: Record<number, string | null> = {};
      for (const e of chantier.etapes) {
        resultat[e.id] = await urlPhotoEtape(e.photo_url);
      }
      if (actif) setPhotos(resultat);
    };
    void charger();
    setNotes((prev) => {
      const suivant = { ...prev };
      chantier.etapes.forEach((e) => {
        if (!(e.id in suivant)) suivant[e.id] = e.note_client ?? "";
      });
      return suivant;
    });
    return () => {
      actif = false;
    };
  }, [chantier.etapes]);

  const signaler = (ton: "ok" | "ko", texte: string) => {
    setFeedback({ ton, texte });
    window.setTimeout(() => setFeedback(null), 6000);
  };

  const rechargerJournal = useCallback(async () => {
    try {
      const lignes = await fetchNotificationsSuivi(chantier.id);
      setJournal(lignes);
      setJournalErreur(null);
    } catch {
      setJournalErreur("L'historique des notifications n'a pas pu être chargé.");
    }
  }, [chantier.id]);

  useEffect(() => {
    void rechargerJournal();
  }, [rechargerJournal]);

  /** Après une modification : horodate le suivi, recharge, et prévient le client si demandé. */
  const apresModification = useCallback(
    async (motif: string) => {
      try {
        await marquerSuiviModifie(chantier.id);
        await onReload();
        if (notifier && partage && clientEmail) {
          const envoi = await notifierSuiviChantier(chantier.id, lien, motif);
          if (envoi.ok) signaler("ok", `Client prévenu par email (${envoi.destinataire ?? clientEmail}).`);
          else signaler("ko", envoi.error ?? "L'email n'a pas pu être envoyé.");
          void rechargerJournal();
        }
      } catch {
        signaler("ko", "La modification n'a pas pu être enregistrée.");
      }
    },
    [chantier.id, clientEmail, lien, notifier, onReload, partage, rechargerJournal],
  );

  const basculerPartage = async () => {
    const cible = !partage;
    setBusy("partage");
    try {
      await updateChantierSuivi(chantier.id, { suivi_actif: cible, suivi_maj_at: new Date().toISOString() });
      setPartage(cible);
      await onReload();
      signaler("ok", cible ? "Le suivi est partagé : le lien fonctionne." : "Le partage est désactivé : le lien ne s'ouvre plus.");
    } catch {
      signaler("ko", "Le réglage n'a pas pu être enregistré.");
    } finally {
      setBusy(null);
    }
  };

  const copierLien = async () => {
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2500);
    } catch {
      signaler("ko", "La copie a échoué. Sélectionnez le lien pour le copier.");
    }
  };

  const enregistrerMessage = async () => {
    setBusy("message");
    try {
      await updateChantierSuivi(chantier.id, {
        message_client: message.trim() ? message.trim() : null,
        suivi_maj_at: new Date().toISOString(),
      });
      await apresModification("Un nouveau message vous a été laissé sur votre chantier.");
      signaler("ok", "Message enregistré : il apparaît sur la page du client.");
    } catch {
      signaler("ko", "Le message n'a pas pu être enregistré.");
    } finally {
      setBusy(null);
    }
  };

  const basculerVisibilite = async (etapeId: number, visible: boolean) => {
    setBusy(`vis-${etapeId}`);
    try {
      await updateEtapeSuivi(etapeId, { visible_client: visible });
      await apresModification("La liste des étapes de votre chantier a été mise à jour.");
    } catch {
      signaler("ko", "Le réglage n'a pas pu être enregistré.");
    } finally {
      setBusy(null);
    }
  };

  const enregistrerNoteEtape = async (etapeId: number, libelle: string) => {
    const valeur = (notes[etapeId] ?? "").trim();
    setBusy(`note-${etapeId}`);
    try {
      await updateEtapeSuivi(etapeId, { note_client: valeur ? valeur : null });
      await apresModification(`Étape mise à jour : ${libelle}.`);
      signaler("ok", "Commentaire enregistré.");
    } catch {
      signaler("ko", "Le commentaire n'a pas pu être enregistré.");
    } finally {
      setBusy(null);
    }
  };

  const choisirPhoto = (etapeId: number) => {
    etapeEnCours.current = etapeId;
    fichierRef.current?.click();
  };

  const televerser = async (file: File) => {
    const etapeId = etapeEnCours.current;
    if (!etapeId) return;
    const etape = chantier.etapes.find((e) => e.id === etapeId);
    setBusy(`photo-${etapeId}`);
    try {
      const { data: session } = await supabase.auth.getUser();
      const userId = session?.user?.id;
      if (!userId) {
        signaler("ko", "Vous devez être connecté pour ajouter une photo.");
        return;
      }
      const chemin = await televerserPhotoEtape(userId, file);
      await updateEtapeSuivi(etapeId, { photo_url: chemin });
      const url = await urlPhotoEtape(chemin);
      setPhotos((prev) => ({ ...prev, [etapeId]: url }));
      await apresModification(`Nouvelle photo ajoutée${etape ? ` sur l'étape « ${etape.libelle} »` : ""}.`);
      signaler("ok", "Photo ajoutée au suivi du client.");
    } catch (e) {
      signaler("ko", e instanceof Error ? e.message : "L'envoi de la photo a échoué.");
    } finally {
      setBusy(null);
      etapeEnCours.current = null;
      if (fichierRef.current) fichierRef.current.value = "";
    }
  };

  const retirerPhoto = async (etapeId: number) => {
    setBusy(`photo-${etapeId}`);
    try {
      await updateEtapeSuivi(etapeId, { photo_url: null });
      setPhotos((prev) => ({ ...prev, [etapeId]: null }));
      await apresModification("Une photo a été retirée du suivi.");
      signaler("ok", "Photo retirée.");
    } catch {
      signaler("ko", "La photo n'a pas pu être retirée.");
    } finally {
      setBusy(null);
    }
  };

  const envoyerEmailMaintenant = async () => {
    if (!partage) {
      signaler("ko", "Activez d'abord le partage du suivi.");
      return;
    }
    setBusy("email");
    try {
      const envoi = await notifierSuiviChantier(chantier.id, lien, "Voici les dernières nouvelles de votre chantier.");
      if (envoi.ok) signaler("ok", `Email envoyé à ${envoi.destinataire ?? clientEmail ?? "votre client"}.`);
      else signaler("ko", envoi.error ?? "L'email n'a pas pu être envoyé.");
      void rechargerJournal();
    } catch {
      signaler("ko", "L'email n'a pas pu être envoyé.");
    } finally {
      setBusy(null);
    }
  };

  /** Renvoie exactement la même notification (même motif) au client, en un clic. */
  const renvoyer = async (ligne: NotificationSuivi) => {
    if (!partage) {
      signaler("ko", "Activez d'abord le partage du suivi.");
      return;
    }
    setBusy(`renvoi-${ligne.id}`);
    try {
      const envoi = await notifierSuiviChantier(
        chantier.id,
        lien,
        ligne.motif ?? "Mise à jour du suivi de votre chantier.",
      );
      if (envoi.ok) signaler("ok", `Notification renvoyée à ${envoi.destinataire ?? ligne.destinataire ?? "votre client"}.`);
      else signaler("ko", envoi.error ?? "La notification n'a pas pu être renvoyée.");
      await rechargerJournal();
    } catch {
      signaler("ko", "La notification n'a pas pu être renvoyée.");
    } finally {
      setBusy(null);
    }
  };

  const formatDateHeure = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const etapesVisibles = chantier.etapes.filter((e) => e.visible_client).length;

  return (
    <div className="mt-5 p-4 rounded-lg bg-background-50 border border-background-200">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md bg-primary-100 text-primary-700">
            <i className="ri-share-circle-line text-base"></i>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-900">Suivi partagé avec le client</p>
            <p className="text-[11px] text-foreground-500">
              Une page dédiée, mise à jour à chaque étape. {etapesVisibles}/{chantier.etapes.length} étape
              {chantier.etapes.length > 1 ? "s" : ""} visible{etapesVisibles > 1 ? "s" : ""}.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={basculerPartage}
          disabled={busy === "partage"}
          aria-pressed={partage}
          className={`inline-flex items-center gap-2 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
            partage
              ? "bg-accent-500 text-background-50 hover:bg-accent-600"
              : "bg-background-200 text-foreground-600 hover:bg-background-300"
          }`}
        >
          <i className={partage ? "ri-eye-line" : "ri-eye-off-line"}></i>
          {partage ? "Partagé" : "Désactivé"}
        </button>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <div className="flex-1 min-w-0 h-10 px-3 rounded-md bg-background-100 border border-background-200 flex items-center">
          <i className="ri-link text-foreground-400 text-sm"></i>
          <input
            readOnly
            value={partage ? lien : "Partage désactivé"}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 h-full bg-transparent border-0 outline-none text-xs text-foreground-700 px-2 truncate"
            aria-label="Lien de suivi à envoyer au client"
          />
        </div>
        <button
          type="button"
          onClick={copierLien}
          disabled={!partage || !lien}
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className={copie ? "ri-check-line" : "ri-file-copy-line"}></i>
          {copie ? "Lien copié" : "Copier le lien"}
        </button>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-md bg-background-100 border border-background-200">
        <label className="inline-flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={notifier}
            onChange={(e) => setNotifier(e.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 rounded border-background-300 text-primary-600 focus:ring-primary-300 cursor-pointer"
          />
          <span className="text-xs text-foreground-700">
            <span className="font-semibold">Prévenir le client par email à chaque modification</span>
            <span className="block text-[11px] text-foreground-500">
              Décochez pour modifier sans envoyer d'email.
            </span>
          </span>
        </label>
        <button
          type="button"
          onClick={envoyerEmailMaintenant}
          disabled={busy === "email" || !partage || !clientEmail}
          title={clientEmail ? "Envoyer maintenant un email de mise à jour" : "Ajoutez d'abord l'email du client"}
          className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-md bg-primary-500 text-background-50 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className={busy === "email" ? "ri-loader-4-line animate-spin" : "ri-mail-send-line"}></i>
          Envoyer un email
        </button>
      </div>

      {!clientEmail && (
        <p className="mt-2 text-[11px] text-secondary-800 flex items-start gap-1.5">
          <i className="ri-information-line mt-0.5"></i>
          <span>
            Ce client n'a pas d'adresse email dans sa fiche : le lien fonctionne, mais aucun email ne peut être envoyé.
          </span>
        </p>
      )}

      <div className="mt-4">
        <label htmlFor="suivi-message-client" className="text-xs font-semibold text-foreground-700">
          Message affiché au client
        </label>
        <textarea
          id="suivi-message-client"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={800}
          placeholder="Ex. : Les travaux avancent bien, la livraison du carrelage est prévue mardi. Je vous tiens au courant."
          className="mt-1.5 w-full px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm text-foreground-800 outline-none focus:border-primary-400 resize-none"
        />
        <div className="flex items-center justify-between gap-3 mt-2">
          <span className="text-[11px] text-foreground-400">{message.length}/800</span>
          <button
            type="button"
            onClick={enregistrerMessage}
            disabled={busy === "message"}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-secondary-100 text-secondary-800 text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60"
          >
            <i className="ri-save-line"></i>
            Enregistrer le message
          </button>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold text-foreground-700 mb-2">Ce que le client voit, étape par étape</p>
        {chantier.etapes.length === 0 ? (
          <p className="text-xs text-foreground-500 py-3">
            Ajoutez d'abord des étapes au chantier pour pouvoir les détailler au client.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {chantier.etapes.map((e) => {
              const ouverte = etapeOuverte === e.id;
              return (
                <li key={e.id} className="rounded-md bg-background-100 border border-background-200 overflow-hidden">
                  <div className="flex items-center gap-2 p-2.5">
                    <button
                      type="button"
                      onClick={() => basculerVisibilite(e.id, !e.visible_client)}
                      disabled={busy === `vis-${e.id}`}
                      aria-pressed={e.visible_client}
                      title={e.visible_client ? "Masquer cette étape au client" : "Afficher cette étape au client"}
                      className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-sm cursor-pointer transition-colors disabled:opacity-50 ${
                        e.visible_client
                          ? "bg-accent-100 text-accent-700 hover:bg-accent-200"
                          : "bg-background-200 text-foreground-400 hover:bg-background-300"
                      }`}
                    >
                      <i className={e.visible_client ? "ri-eye-line" : "ri-eye-off-line"}></i>
                    </button>
                    <span className="flex-1 min-w-0 text-sm text-foreground-800 truncate">{e.libelle}</span>
                    {photos[e.id] ? (
                      <span className="w-9 h-7 shrink-0 rounded overflow-hidden border border-background-200">
                        <img src={photos[e.id] ?? ""} alt={e.libelle} className="w-full h-full object-cover object-top" />
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setEtapeOuverte(ouverte ? null : e.id)}
                      className="h-7 px-2.5 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors"
                    >
                      {ouverte ? "Fermer" : "Photo / note"}
                    </button>
                  </div>
                  {ouverte && (
                    <div className="px-2.5 pb-2.5 flex flex-col gap-2 animate-fade-in">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => choisirPhoto(e.id)}
                          disabled={busy === `photo-${e.id}`}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-secondary-100 text-secondary-800 text-[11px] font-semibold whitespace-nowrap cursor-pointer hover:bg-secondary-200 transition-colors disabled:opacity-60"
                        >
                          <i className={busy === `photo-${e.id}` ? "ri-loader-4-line animate-spin" : "ri-image-add-line"}></i>
                          {photos[e.id] ? "Remplacer la photo" : "Ajouter une photo"}
                        </button>
                        {photos[e.id] && (
                          <button
                            type="button"
                            onClick={() => retirerPhoto(e.id)}
                            disabled={busy === `photo-${e.id}`}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[11px] font-semibold text-red-600 whitespace-nowrap cursor-pointer hover:bg-red-50 transition-colors disabled:opacity-60"
                          >
                            <i className="ri-delete-bin-line"></i>
                            Retirer
                          </button>
                        )}
                      </div>
                      <textarea
                        value={notes[e.id] ?? ""}
                        onChange={(ev) => setNotes((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                        rows={2}
                        maxLength={400}
                        placeholder="Commentaire visible par le client sur cette étape (optionnel)."
                        className="w-full px-3 py-2 rounded-md bg-background-50 border border-background-200 text-xs text-foreground-800 outline-none focus:border-primary-400 resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => enregistrerNoteEtape(e.id, e.libelle)}
                          disabled={busy === `note-${e.id}`}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-60"
                        >
                          <i className="ri-save-line"></i>
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 rounded-md bg-background-100 border border-background-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setJournalOuvert((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left cursor-pointer hover:bg-background-200/60 transition-colors"
          aria-expanded={journalOuvert}
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <i className="ri-history-line text-foreground-500"></i>
            <span className="text-xs font-semibold text-foreground-800 whitespace-nowrap">Journal des notifications</span>
            <span className="text-[11px] text-foreground-500 truncate">
              {journal.length > 0 ? `${journal.length} envoi${journal.length > 1 ? "s" : ""} tracé${journal.length > 1 ? "s" : ""}` : "Aucun envoi pour l'instant"}
            </span>
          </span>
          <i className={journalOuvert ? "ri-arrow-up-s-line text-foreground-400" : "ri-arrow-down-s-line text-foreground-400"}></i>
        </button>

        {journalOuvert && (
          <div className="px-3 pb-3 pt-1 border-t border-background-200 animate-fade-in">
            {journalErreur ? (
              <p className="text-[11px] text-red-600 flex items-start gap-1.5 py-2">
                <i className="ri-error-warning-line mt-0.5"></i>
                {journalErreur}
              </p>
            ) : journal.length === 0 ? (
              <p className="text-[11px] text-foreground-500 py-2">
                Aucune notification envoyée pour ce chantier. Chaque email au client sera tracé ici.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-background-200">
                {journal.map((n) => {
                  const ok = n.statut === "envoye";
                  return (
                    <li key={n.id} className="py-2.5 flex items-start gap-2">
                      <span
                        className={`w-6 h-6 shrink-0 mt-0.5 flex items-center justify-center rounded-full text-[11px] ${
                          ok ? "bg-accent-100 text-accent-700" : "bg-red-50 text-red-600"
                        }`}
                      >
                        <i className={ok ? "ri-mail-check-line" : "ri-mail-close-line"}></i>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-foreground-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-semibold text-foreground-700">{n.destinataire || "Adresse inconnue"}</span>
                          <span>{formatDateHeure(n.created_at)}</span>
                          <span
                            className={`px-1.5 rounded-full font-semibold ${
                              ok ? "bg-accent-100 text-accent-800" : "bg-red-50 text-red-700"
                            }`}
                          >
                            {ok ? "Envoyé" : "Échec"}
                          </span>
                        </p>
                        <p className="text-xs text-foreground-800 mt-0.5 break-words">{n.motif || "Mise à jour du suivi"}</p>
                        {!ok && n.erreur ? (
                          <p className="text-[11px] text-red-600 mt-0.5 break-words">{n.erreur}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => renvoyer(n)}
                        disabled={busy === `renvoi-${n.id}` || !partage}
                        title={partage ? "Renvoyer cette notification" : "Le partage du suivi est désactivé"}
                        className="h-7 px-2.5 shrink-0 rounded-md bg-background-50 border border-background-200 text-[11px] font-semibold text-foreground-700 whitespace-nowrap cursor-pointer hover:bg-background-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <i className={busy === `renvoi-${n.id}` ? "ri-loader-4-line animate-spin" : "ri-refresh-line"}></i>
                        <span className="ml-1">Renvoyer</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {feedback && (
        <p
          className={`mt-3 text-xs flex items-start gap-1.5 ${
            feedback.ton === "ok" ? "text-accent-700" : "text-red-600"
          }`}
        >
          <i className={feedback.ton === "ok" ? "ri-checkbox-circle-line mt-0.5" : "ri-error-warning-line mt-0.5"}></i>
          <span>{feedback.texte}</span>
        </p>
      )}

      <input
        ref={fichierRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(ev) => {
          const file = ev.target.files?.[0];
          if (file) void televerser(file);
        }}
      />
    </div>
  );
}