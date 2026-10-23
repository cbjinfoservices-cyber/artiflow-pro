import { useMemo, useRef, useState } from "react";
import Modal from "@/pages/app/components/Modal";
import SignaturePad from "@/components/base/SignaturePad";
import { formatDateLongue } from "@/lib/dates";
import { envoyerPvRecetteEmail } from "@/lib/pvRecettePdf";
import {
  CONFORMITE_DEFAUT,
  MAX_PHOTOS_PV,
  compresseImage,
  conformiteComplete,
  imprimerPv,
  type PvConformiteItem,
  type PvInfosImpression,
  type PvPayload,
  type PvPhoto,
  type PvRecette,
} from "@/lib/pvRecette";

/**
 * Fenêtre de saisie du PV de recette d'une intervention : travaux réalisés, points de
 * conformité, photos du chantier terminé, réserves du client et signature sur place.
 * Le PV peut être enregistré en brouillon puis validé une fois signé.
 */
export default function PvRecetteModal({
  creneau,
  pv,
  clientNom,
  busy,
  error,
  infosImpression,
  onSave,
  onClose,
}: {
  creneau: { id: number; date: string; heure: string; libelle: string; ville: string | null };
  pv: PvRecette | null;
  clientNom: string | null;
  busy: boolean;
  error: string | null;
  infosImpression: PvInfosImpression;
  onSave: (payload: PvPayload) => void;
  onClose: () => void;
}) {
  const [travaux, setTravaux] = useState(pv?.travaux ?? "");
  const [reserves, setReserves] = useState(pv?.reserves ?? "");
  const [client, setClient] = useState(pv?.client_nom ?? clientNom ?? "");
  const [adresse, setAdresse] = useState(pv?.adresse ?? creneau.ville ?? "");
  const [conformite, setConformite] = useState<PvConformiteItem[]>(
    pv ? pv.conformite.map((c) => ({ ...c })) : CONFORMITE_DEFAUT.map((c) => ({ ...c })),
  );
  const [photos, setPhotos] = useState<PvPhoto[]>(pv ? pv.photos.map((p) => ({ ...p })) : []);
  const [signature, setSignature] = useState<string | null>(pv?.signature_data ?? null);
  const [signataire, setSignataire] = useState(pv?.signataire_nom ?? "");
  const [compression, setCompression] = useState(false);
  const [erreurLocale, setErreurLocale] = useState<string | null>(null);
  const [emailClient, setEmailClient] = useState("");
  const [envoiBusy, setEnvoiBusy] = useState(false);
  const [envoiError, setEnvoiError] = useState<string | null>(null);
  const [envoiOk, setEnvoiOk] = useState<string | null>(null);
  const fichierRef = useRef<HTMLInputElement | null>(null);

  const completes = conformite.filter((c) => c.ok).length;
  const toutConforme = conformiteComplete(conformite);
  const peutValider = Boolean(signature) && signataire.trim().length > 1;
  const statutActuel = pv?.statut === "valide" ? "valide" : "brouillon";

  const payload = useMemo<PvPayload>(
    () => ({
      travaux,
      reserves,
      conformite,
      photos,
      signatureData: signature,
      signataireNom: signataire.trim() || null,
      clientNom: client,
      adresse,
      statut: peutValider ? "valide" : "brouillon",
    }),
    [travaux, reserves, conformite, photos, signature, signataire, client, adresse, peutValider],
  );

  const basculerConformite = (cle: string) => {
    setConformite((prev) => prev.map((c) => (c.cle === cle ? { ...c, ok: !c.ok } : c)));
  };

  const ajouterPhotos = async (fichiers: FileList | null) => {
    if (!fichiers || fichiers.length === 0) return;
    const place = MAX_PHOTOS_PV - photos.length;
    if (place <= 0) {
      setErreurLocale(`Vous pouvez joindre ${MAX_PHOTOS_PV} photos au maximum.`);
      return;
    }
    setCompression(true);
    setErreurLocale(null);
    try {
      const liste = Array.from(fichiers).slice(0, place);
      const nouvelles: PvPhoto[] = [];
      for (const fichier of liste) {
        const dataUrl = await compresseImage(fichier);
        nouvelles.push({
          id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          dataUrl,
        });
      }
      setPhotos((prev) => [...prev, ...nouvelles]);
      if (fichiers.length > place) {
        setErreurLocale(`Seules les ${place} premières photos ont été ajoutées (limite de ${MAX_PHOTOS_PV}).`);
      }
    } catch {
      setErreurLocale("Une photo n'a pas pu être préparée. Essayez une autre image.");
    } finally {
      setCompression(false);
      if (fichierRef.current) fichierRef.current.value = "";
    }
  };

  const enregistrer = (valider: boolean) => {
    if (valider && !peutValider) {
      setErreurLocale("Indiquez le nom du signataire et faites signer le client avant de valider.");
      return;
    }
    setErreurLocale(null);
    onSave({ ...payload, statut: valider ? "valide" : statutActuel });
  };

  // Le PV doit être enregistré et signé pour pouvoir partir chez le client : le Backend
  // revérifie la signature avant chaque envoi, de son côté.
  const envoyerAuClient = async () => {
    if (!pv || pv.statut !== "valide") return;
    const email = emailClient.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setEnvoiError("Saisissez une adresse email valide (ex. client@exemple.fr).");
      return;
    }
    setEnvoiBusy(true);
    setEnvoiError(null);
    setEnvoiOk(null);
    try {
      await envoyerPvRecetteEmail({
        pvId: pv.id,
        pv: { ...payload, statut: "valide" },
        infos: infosImpression,
        email,
      });
      setEnvoiOk(`PV envoyé à ${email}.`);
    } catch (e) {
      setEnvoiError(e instanceof Error ? e.message : "L'envoi du PV par email a échoué.");
    } finally {
      setEnvoiBusy(false);
    }
  };

  return (
    <Modal
      title={pv && pv.statut === "valide" ? "PV de recette signé" : "PV de recette"}
      subtitle={`${creneau.libelle} · ${formatDateLongue(creneau.date)}`}
      onClose={onClose}
      taille="lg"
      footer={
        <>
          <button
            type="button"
            onClick={() => imprimerPv(payload, infosImpression)}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-medium hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-printer-line"></i>
            Imprimer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-md text-sm font-medium text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => enregistrer(false)}
            disabled={busy || compression}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-background-100 border border-background-200 text-foreground-700 text-sm font-semibold hover:bg-background-200 cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            {busy ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => enregistrer(true)}
            disabled={busy || compression || !peutValider}
            title={peutValider ? "Valider le PV signé" : "Signature du client requise"}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-primary-500 text-background-50 text-sm font-semibold cursor-pointer hover:bg-primary-600 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="ri-shield-check-line"></i>
            Valider le PV
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold whitespace-nowrap ${
              statutActuel === "valide"
                ? "bg-secondary-100 text-secondary-900"
                : "bg-accent-100 text-accent-800"
            }`}
          >
            <i className={statutActuel === "valide" ? "ri-shield-check-line" : "ri-draft-line"}></i>
            {statutActuel === "valide" ? "PV signé" : "Brouillon"}
          </span>
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap">
            <i className="ri-checkbox-multiple-line"></i>
            {completes}/{conformite.length} contrôles
          </span>
          <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-background-100 border border-background-200 text-[11px] font-semibold text-foreground-600 whitespace-nowrap">
            <i className="ri-image-line"></i>
            {photos.length}/{MAX_PHOTOS_PV} photos
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Client</span>
            <input
              value={client}
              onChange={(e) => setClient(e.target.value.slice(0, 120))}
              placeholder="Nom du client"
              className="h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground-700">Adresse du chantier</span>
            <input
              value={adresse}
              onChange={(e) => setAdresse(e.target.value.slice(0, 160))}
              placeholder="Adresse de l'intervention"
              className="h-10 px-3 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400"
            />
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground-900">Points de conformité</span>
            <button
              type="button"
              onClick={() => {
                const tousCoches = conformite.every((c) => c.ok);
                setConformite((prev) => prev.map((c) => ({ ...c, ok: !tousCoches })));
              }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-background-100 border border-background-200 text-xs font-semibold text-foreground-600 hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              <i className={toutConforme ? "ri-close-line" : "ri-check-double-line"}></i>
              {toutConforme ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {conformite.map((c) => (
              <button
                key={c.cle}
                type="button"
                onClick={() => basculerConformite(c.cle)}
                aria-pressed={c.ok}
                className={`flex items-center gap-2.5 p-2.5 rounded-md border text-left cursor-pointer transition-colors ${
                  c.ok
                    ? "bg-secondary-100 border-secondary-200 text-secondary-900"
                    : "bg-background-50 border-background-200 text-foreground-700 hover:bg-background-100"
                }`}
              >
                <span
                  className={`w-5 h-5 shrink-0 flex items-center justify-center rounded border ${
                    c.ok ? "bg-secondary-600 border-secondary-600 text-background-50" : "border-background-300 bg-background-50"
                  }`}
                >
                  {c.ok && <i className="ri-check-line text-[11px]"></i>}
                </span>
                <span className="text-sm">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-foreground-900">Travaux réalisés</span>
          <textarea
            value={travaux}
            onChange={(e) => setTravaux(e.target.value.slice(0, 800))}
            rows={3}
            maxLength={800}
            placeholder="Ce qui a été réalisé pendant l'intervention…"
            className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400 resize-none"
          />
          <span className="text-[10px] text-foreground-400 text-right">{travaux.length}/800</span>
        </label>

        <div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground-900">Photos du chantier terminé</span>
            <button
              type="button"
              onClick={() => fichierRef.current?.click()}
              disabled={compression || photos.length >= MAX_PHOTOS_PV}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary-100 text-primary-800 text-xs font-semibold hover:bg-primary-200 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className={compression ? "ri-loader-4-line animate-spin" : "ri-camera-line"}></i>
              {compression ? "Préparation…" : "Ajouter des photos"}
            </button>
            <input
              ref={fichierRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void ajouterPhotos(e.target.files)}
            />
          </div>
          {photos.length === 0 ? (
            <p className="mt-2 text-[11px] text-foreground-500 rounded-md border border-dashed border-background-300 bg-background-50 px-3 py-4 text-center">
              Aucune photo. Prenez le chantier terminé en photo depuis votre téléphone : elles sont
              compressées automatiquement et restent attachées au PV.
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="relative rounded-md overflow-hidden border border-background-200">
                  <img
                    src={photo.dataUrl}
                    alt="Photo du chantier terminé"
                    className="w-full h-24 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((p) => p.id !== photo.id))}
                    aria-label="Retirer cette photo"
                    className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-foreground-950/60 text-background-50 hover:bg-foreground-950/80 cursor-pointer"
                  >
                    <i className="ri-close-line text-[11px]"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-foreground-900">Réserves du client</span>
          <textarea
            value={reserves}
            onChange={(e) => setReserves(e.target.value.slice(0, 800))}
            rows={3}
            maxLength={800}
            placeholder="Réserve, point à reprendre, remarque du client…"
            className="px-3 py-2 rounded-md bg-background-100 border border-background-200 text-sm outline-none focus:border-primary-400 resize-none"
          />
          <span className="text-[10px] text-foreground-400 text-right">{reserves.length}/800</span>
        </label>

        <div className="rounded-lg bg-background-100 border border-background-200 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-sm font-semibold text-foreground-900">Signature du client sur place</span>
            <input
              value={signataire}
              onChange={(e) => setSignataire(e.target.value.slice(0, 80))}
              placeholder="Nom du signataire"
              className="h-9 px-3 rounded-md bg-background-50 border border-background-200 text-sm outline-none focus:border-primary-400 sm:w-56"
            />
          </div>
          <div className="mt-2">
            <SignaturePad onChange={setSignature} height={160} />
          </div>
          {!peutValider && (
            <p className="mt-1 text-[11px] text-foreground-500 inline-flex items-center gap-1">
              <i className="ri-information-line"></i>
              Nom du signataire et signature requis pour valider le PV. Vous pouvez enregistrer un
              brouillon sans signature.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground-900 inline-flex items-center gap-1.5">
              <i className="ri-mail-send-line text-primary-600"></i>
              Envoyer le PV signé au client
            </span>
            <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-background-50 border border-background-200 text-[10px] font-semibold text-foreground-600 whitespace-nowrap">
              <i className="ri-file-pdf-2-line"></i>
              PDF avec photos et signature
            </span>
          </div>

          {pv?.statut === "valide" ? (
            <>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  inputMode="email"
                  value={emailClient}
                  onChange={(e) => {
                    setEmailClient(e.target.value.slice(0, 160));
                    setEnvoiError(null);
                    setEnvoiOk(null);
                  }}
                  placeholder="email du client (ex. client@exemple.fr)"
                  aria-label="Adresse email du client"
                  className="h-10 px-3 rounded-md bg-background-50 border border-background-200 text-sm text-foreground-900 outline-none focus:border-primary-400 flex-1 min-w-0 box-border"
                />
                <button
                  type="button"
                  onClick={() => void envoyerAuClient()}
                  disabled={envoiBusy}
                  className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-md bg-primary-500 text-background-50 text-sm font-semibold whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {envoiBusy ? (
                    <i className="ri-loader-4-line animate-spin"></i>
                  ) : (
                    <i className="ri-send-plane-line"></i>
                  )}
                  {envoiBusy ? "Envoi en cours…" : "Envoyer le PDF"}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-foreground-500">
                Le client reçoit un email avec le PV en pièce jointe (contrôles de conformité,
                réserves, photos et signature).
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-[11px] text-foreground-600 inline-flex items-start gap-1.5">
              <i className="ri-information-line mt-0.5"></i>
              <span>
                Faites signer le client et validez le PV. Une fois enregistré en « PV signé »,
                rouvrez cette fiche pour l'envoyer par email.
              </span>
            </p>
          )}

          {envoiError && (
            <p className="mt-2 text-xs text-red-600 inline-flex items-start gap-1.5">
              <i className="ri-error-warning-line mt-0.5"></i>
              <span>{envoiError}</span>
            </p>
          )}
          {envoiOk && (
            <p className="mt-2 text-[11px] text-secondary-900 bg-secondary-100 border border-secondary-200 rounded-md px-2.5 py-1.5 inline-flex items-center gap-1.5">
              <i className="ri-checkbox-circle-line"></i>
              {envoiOk}
            </p>
          )}
        </div>

        {(erreurLocale || error) && (
          <p className="text-xs text-red-600 inline-flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i> {erreurLocale || error}
          </p>
        )}
      </div>
    </Modal>
  );
}