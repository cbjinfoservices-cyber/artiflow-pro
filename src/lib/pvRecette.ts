import { supabase } from "@/lib/supabase";
import { formatDateLongue } from "@/lib/dates";

/** Un point de contrôle de conformité coché (ou non) sur le PV de recette. */
export interface PvConformiteItem {
  cle: string;
  label: string;
  ok: boolean;
}

/** Une photo du chantier terminé, stockée compressée dans le PV. */
export interface PvPhoto {
  id: string;
  /** Image JPEG encodée en data URL, prête à afficher. */
  dataUrl: string;
}

/** Statut d'un PV de recette : brouillon en cours de saisie, ou validé (signé). */
export type PvStatut = "brouillon" | "valide";

/** Le PV de recette d'une intervention : conformité, photos, réserves et signature client. */
export interface PvRecette {
  id: number;
  creneau_id: number | null;
  chantier_id: number | null;
  intervenant_id: number | null;
  client_nom: string | null;
  adresse: string | null;
  travaux: string | null;
  reserves: string | null;
  conformite: PvConformiteItem[];
  photos: PvPhoto[];
  signature_data: string | null;
  signataire_nom: string | null;
  statut: PvStatut;
  signe_le: string | null;
  updated_at: string;
}

/** Nombre maximal de photos par PV (chaque image est compressée avant enregistrement). */
export const MAX_PHOTOS_PV = 6;

/** Points de contrôle proposés par défaut sur un PV de recette. */
export const CONFORMITE_DEFAUT: PvConformiteItem[] = [
  { cle: "travaux", label: "Travaux réalisés conformément au devis", ok: false },
  { cle: "fonctionnement", label: "Équipements en état de fonctionnement", ok: false },
  { cle: "proprete", label: "Chantier nettoyé et rangé", ok: false },
  { cle: "dechets", label: "Déchets et gravats évacués", ok: false },
  { cle: "client", label: "Client présent à la réception", ok: false },
];

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function normaliseConformite(value: unknown): PvConformiteItem[] {
  if (!Array.isArray(value)) return CONFORMITE_DEFAUT.map((c) => ({ ...c }));
  const trouvees = new Map<string, PvConformiteItem>();
  value.forEach((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const cle = toStr(row.cle) ?? "";
    if (!cle) return;
    trouvees.set(cle, {
      cle,
      label: toStr(row.label) ?? cle,
      ok: Boolean(row.ok),
    });
  });
  // Les points de référence manquants sont réajoutés, pour qu'un PV plus ancien
  // affiche toujours la liste complète des contrôles.
  const liste = CONFORMITE_DEFAUT.map((defaut) => trouvees.get(defaut.cle) ?? { ...defaut });
  trouvees.forEach((item) => {
    if (!CONFORMITE_DEFAUT.some((d) => d.cle === item.cle)) liste.push(item);
  });
  return liste;
}

function normalisePhotos(value: unknown): PvPhoto[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const dataUrl = toStr(row.dataUrl) ?? "";
      if (!dataUrl) return null;
      return { id: toStr(row.id) ?? `photo-${index}`, dataUrl };
    })
    .filter((p): p is PvPhoto => p !== null);
}

function mapPv(row: Record<string, unknown>): PvRecette {
  const statut = String(row.statut ?? "brouillon") === "valide" ? "valide" : "brouillon";
  return {
    id: Number(row.id),
    creneau_id: row.creneau_id === null || row.creneau_id === undefined ? null : Number(row.creneau_id),
    chantier_id: row.chantier_id === null || row.chantier_id === undefined ? null : Number(row.chantier_id),
    intervenant_id:
      row.intervenant_id === null || row.intervenant_id === undefined ? null : Number(row.intervenant_id),
    client_nom: toStr(row.client_nom),
    adresse: toStr(row.adresse),
    travaux: toStr(row.travaux),
    reserves: toStr(row.reserves),
    conformite: normaliseConformite(row.conformite),
    photos: normalisePhotos(row.photos),
    signature_data: toStr(row.signature_data),
    signataire_nom: toStr(row.signataire_nom),
    statut,
    signe_le: toStr(row.signe_le),
    updated_at: toStr(row.updated_at) ?? "",
  };
}

/**
 * Récupère les PV de recette du compte connecté (ou ceux d'un intervenant précis).
 * Renvoie les PV complets, photos et signature comprises.
 */
export async function fetchPvRecettes(intervenantId?: number | null): Promise<PvRecette[]> {
  let requete = supabase
    .from("pv_recettes")
    .select(
      "id, creneau_id, chantier_id, intervenant_id, client_nom, adresse, travaux, reserves, conformite, photos, signature_data, signataire_nom, statut, signe_le, updated_at",
    )
    .order("updated_at", { ascending: false });
  if (typeof intervenantId === "number") requete = requete.eq("intervenant_id", intervenantId);
  const { data, error } = await requete;
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapPv);
}

/**
 * Récupère uniquement le statut des PV, indexé par identifiant de créneau.
 * Sert à afficher une pastille « PV signé » sans télécharger les photos.
 */
export async function fetchPvResumes(intervenantId?: number | null): Promise<Record<number, PvStatut>> {
  let requete = supabase.from("pv_recettes").select("creneau_id, statut");
  if (typeof intervenantId === "number") requete = requete.eq("intervenant_id", intervenantId);
  const { data, error } = await requete;
  if (error) throw error;
  const map: Record<number, PvStatut> = {};
  ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const id = row.creneau_id === null || row.creneau_id === undefined ? null : Number(row.creneau_id);
    if (id === null || !Number.isFinite(id)) return;
    map[id] = String(row.statut ?? "brouillon") === "valide" ? "valide" : "brouillon";
  });
  return map;
}

/** Récupère le PV complet rattaché à une intervention, ou null s'il n'existe pas encore. */
export async function fetchPvRecetteParCreneau(creneauId: number): Promise<PvRecette | null> {
  const { data, error } = await supabase
    .from("pv_recettes")
    .select(
      "id, creneau_id, chantier_id, intervenant_id, client_nom, adresse, travaux, reserves, conformite, photos, signature_data, signataire_nom, statut, signe_le, updated_at",
    )
    .eq("creneau_id", creneauId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapPv(data as Record<string, unknown>);
}

/** Contenu d'un PV en cours de saisie, envoyé à l'enregistrement. */
export interface PvPayload {
  travaux: string;
  reserves: string;
  conformite: PvConformiteItem[];
  photos: PvPhoto[];
  signatureData: string | null;
  signataireNom: string | null;
  /** Nom du client destinataire du PV (pré-rempli depuis le chantier, modifiable). */
  clientNom: string;
  /** Adresse du chantier (pré-remplie, modifiable). */
  adresse: string;
  statut: PvStatut;
}

/** Intervention minimale nécessaire pour rattacher un PV. */
export interface PvCreneauRef {
  id: number;
  date: string;
  libelle: string;
  ville: string | null;
  chantier_id: number | null;
  intervenant_id: number | null;
}

/**
 * Enregistre (ou met à jour) le PV de recette d'une intervention.
 * Un seul PV par intervention : la ligne existante est mise à jour si elle existe déjà.
 */
export async function enregistrerPvRecette(params: {
  proprietaireId: string;
  creneau: PvCreneauRef;
  payload: PvPayload;
}): Promise<void> {
  const maintenant = new Date().toISOString();
  const valide = params.payload.statut === "valide";
  const { error } = await supabase.from("pv_recettes").upsert(
    {
      user_id: params.proprietaireId,
      creneau_id: params.creneau.id,
      chantier_id: params.creneau.chantier_id,
      intervenant_id: params.creneau.intervenant_id,
      client_nom: params.payload.clientNom.trim() || null,
      adresse: params.payload.adresse.trim() || params.creneau.ville || null,
      travaux: params.payload.travaux.trim() || null,
      reserves: params.payload.reserves.trim() || null,
      conformite: params.payload.conformite,
      photos: params.payload.photos,
      signature_data: params.payload.signatureData,
      signataire_nom: params.payload.signataireNom?.trim() || null,
      statut: params.payload.statut,
      signe_le: valide ? maintenant : null,
      updated_at: maintenant,
    },
    { onConflict: "creneau_id" },
  );
  if (error) throw error;
}

/** Vrai si tous les points de conformité sont cochés. */
export function conformiteComplete(conformite: PvConformiteItem[]): boolean {
  return conformite.length > 0 && conformite.every((c) => c.ok);
}

/** Libellé, icône et teinte associés au statut d'un PV. */
export function statutPvMeta(statut: PvStatut): { label: string; icon: string; tone: string } {
  return statut === "valide"
    ? { label: "PV signé", icon: "ri-shield-check-line", tone: "bg-secondary-100 text-secondary-900" }
    : { label: "PV brouillon", icon: "ri-draft-line", tone: "bg-accent-100 text-accent-800" };
}

/**
 * Compresse une image choisie sur le téléphone avant de l'intégrer au PV :
 * redimensionnement (côté le plus long limité) et encodage JPEG, pour rester léger.
 */
export function compresseImage(file: File, maxSide = 1100, quality = 0.62): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Ce fichier n'est pas une image."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Image illisible."));
      image.onload = () => {
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Informations d'en-tête utilisées pour l'impression du PV. */
export interface PvInfosImpression {
  entreprise: string;
  intervenant: string;
  creneauLibelle: string;
  creneauDate: string;
  ville: string | null;
  clientNom: string | null;
}

function echappe(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Ouvre la boîte d'impression du navigateur avec un PV de recette propre
 * (en-tête, conformité, photos, réserves, signature), sans passer par un PDF serveur.
 */
export function imprimerPv(pv: PvPayload, infos: PvInfosImpression): void {
  const conformite = pv.conformite
    .map((c) => `<li>${c.ok ? "&#9745;" : "&#9744;"} ${echappe(c.label)}</li>`)
    .join("");
  const photos = pv.photos
    .map((p) => `<img src="${p.dataUrl}" alt="Photo du chantier terminé" />`)
    .join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<title>PV de recette — ${echappe(infos.creneauLibelle)}</title>
<style>
  body { font-family: Helvetica, Arial, sans-serif; color:#201e1b; margin:32px; font-size:12px; }
  h1 { font-size:18px; margin:0 0 4px; }
  h2 { font-size:13px; margin:22px 0 6px; text-transform:uppercase; letter-spacing:.06em; color:#6b6560; }
  .entete { border-bottom:2px solid #c2410c; padding-bottom:12px; }
  .meta { color:#6b6560; font-size:11px; }
  .grille { display:flex; gap:24px; margin-top:12px; }
  .grille > div { flex:1; }
  ul { margin:0; padding-left:18px; line-height:1.7; }
  .photos { display:flex; flex-wrap:wrap; gap:8px; }
  .photos img { width:170px; height:128px; object-fit:cover; border:1px solid #ddd; border-radius:4px; }
  .signature { margin-top:10px; border:1px solid #ddd; border-radius:4px; padding:6px; display:inline-block; }
  .signature img { height:90px; }
  p { line-height:1.6; }
</style></head><body>
<div class="entete">
  <h1>PV de recette d'intervention</h1>
  <div class="meta">${echappe(infos.entreprise)} · Intervenant : ${echappe(infos.intervenant)}</div>
</div>
<div class="grille">
  <div>
    <h2>Intervention</h2>
    <p>${echappe(infos.creneauLibelle)}<br />${formatDateLongue(infos.creneauDate)}${
      infos.ville ? ` · ${echappe(infos.ville)}` : ""
    }</p>
  </div>
  <div>
    <h2>Client</h2>
    <p>${infos.clientNom ? echappe(infos.clientNom) : "Non renseigné"}</p>
  </div>
</div>
<h2>Points de conformité</h2>
<ul>${conformite || "<li>Aucun point de contrôle.</li>"}</ul>
<h2>Travaux réalisés</h2>
<p>${pv.travaux.trim() ? echappe(pv.travaux).replace(/\n/g, "<br />") : "—"}</p>
<h2>Réserves du client</h2>
<p>${pv.reserves.trim() ? echappe(pv.reserves).replace(/\n/g, "<br />") : "Aucune réserve formulée."}</p>
${
  pv.photos.length
    ? `<h2>Photos du chantier terminé (${pv.photos.length})</h2><div class="photos">${photos}</div>`
    : ""
}
<h2>Réception</h2>
<p>${
    pv.signataireNom
      ? `Reçu par ${echappe(pv.signataireNom)}${pv.statut === "valide" ? "" : " (en attente de signature)"}`
      : "Signature du client en attente."
  }</p>
${pv.signatureData ? `<div class="signature"><img src="${pv.signatureData}" alt="Signature du client" /></div>` : ""}
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const nettoyer = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };
  let lance = false;
  const lancer = () => {
    if (lance) return;
    lance = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      nettoyer();
    }
  };
  iframe.onload = lancer;
  // Filet de sécurité : certains navigateurs ne déclenchent pas `onload` sur un
  // document écrit à la main. L'impression part alors après un court délai.
  window.setTimeout(lancer, 500);
}