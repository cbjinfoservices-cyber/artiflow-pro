import { jsPDF } from "jspdf";
import { formatDateLongue } from "@/lib/dates";
import { pdfToBase64 } from "@/lib/pdf";
import { supabase } from "@/lib/supabase";
import type { PvInfosImpression, PvPayload } from "@/lib/pvRecette";

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];
const ACCENT: [number, number, number] = [196, 120, 58];

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return /^data:image\/jpe?g/i.test(dataUrl) ? "JPEG" : "PNG";
}

function loadImageSize(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function slug(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/**
 * Allège une image (photo ou signature) avant de l'intégrer au PDF : le document part
 * ensuite par email, donc on garde un poids raisonnable sans perdre en lisibilité.
 * En cas d'échec (canvas indisponible), l'image d'origine est conservée.
 */
function allegeImage(dataUrl: string, maxSide = 700, quality = 0.55): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl.startsWith("data:image")) {
      resolve(dataUrl);
      return;
    }
    const image = new Image();
    image.onerror = () => resolve(dataUrl);
    image.onload = () => {
      try {
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
        if (ratio >= 1 && dataUrl.length < 90_000) {
          resolve(dataUrl);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * ratio));
        canvas.height = Math.max(1, Math.round(image.height * ratio));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    image.src = dataUrl;
  });
}

/**
 * Construit le PDF du PV de recette signé : en-tête entreprise, intervention, client,
 * contrôles de conformité, travaux, réserves, photos du chantier et signature.
 * Généré dans le navigateur (pas de rendu serveur) pour rester envoyable en pièce jointe.
 */
export async function buildPvRecettePdf(pv: PvPayload, infos: PvInfosImpression): Promise<jsPDF> {
  // Photos et signature sont ré-encodées en JPEG plus léger : le PDF reste envoyable
  // par email même avec six photos de chantier.
  const photos = await Promise.all(
    pv.photos.map(async (photo) => ({ ...photo, dataUrl: await allegeImage(photo.dataUrl, 700, 0.55) })),
  );
  const signature = pv.signatureData ? await allegeImage(pv.signatureData, 600, 0.8) : null;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = 0;

  const assurerEspace = (hauteur: number) => {
    if (y + hauteur > pageH - 74) {
      doc.addPage();
      y = margin;
    }
  };

  const titreSection = (titre: string, precision?: string) => {
    assurerEspace(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(titre.toUpperCase(), margin, y);
    if (precision) {
      doc.setFont("helvetica", "normal");
      doc.text(precision, pageW - margin, y, { align: "right" });
    }
    y += 14;
  };

  const paragraphe = (titre: string, texte: string, vide: string) => {
    titreSection(titre);
    const contenu = texte.trim() ? texte : vide;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(80, 74, 70);
    const lignes = doc.splitTextToSize(contenu, pageW - margin * 2) as string[];
    lignes.forEach((ligne) => {
      assurerEspace(14);
      doc.text(ligne, margin, y);
      y += 13;
    });
    y += 8;
  };

  // ---- En-tête ----
  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(infos.entreprise || "Mon entreprise", margin, 56);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Intervenant : ${infos.intervenant || "Non affecté"}`, margin, 72);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(38, 36, 33);
  doc.text("PV DE RECETTE", pageW - margin, 56, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, pageW - margin, 72, { align: "right" });

  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 88, pageW - margin, 88);

  y = 104;

  // ---- Bloc intervention ----
  const blocH = 54;
  doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
  doc.roundedRect(margin, y, pageW - margin * 2, blocH, 6, 6, "F");
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(margin, y, 4, blocH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("INTERVENTION", margin + 16, y + 16);
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(infos.creneauLibelle || "Intervention", margin + 16, y + 33);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 84, 80);
  doc.text(
    `${formatDateLongue(infos.creneauDate)}${infos.ville ? ` · ${infos.ville}` : ""}`,
    margin + 16,
    y + 47,
  );
  y += blocH + 12;

  // ---- Bloc client ----
  const clientH = 48;
  doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
  doc.roundedRect(margin, y, pageW - margin * 2, clientH, 6, 6, "F");
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(margin, y, 4, clientH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("CLIENT", margin + 16, y + 16);
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(infos.clientNom || "Non renseigné", margin + 16, y + 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 84, 80);
  doc.text(pv.adresse.trim() || infos.ville || "Adresse non renseignée", margin + 16, y + 44);
  y += clientH + 20;

  // ---- Conformité ----
  titreSection("Points de conformité", `${pv.conformite.filter((c) => c.ok).length}/${pv.conformite.length}`);
  pv.conformite.forEach((c) => {
    assurerEspace(20);
    const boxY = y - 8;
    if (c.ok) {
      doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      doc.roundedRect(margin + 2, boxY, 10, 10, 2, 2, "F");
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(1.3);
      doc.line(margin + 4.4, boxY + 5.2, margin + 6.4, boxY + 7.4);
      doc.line(margin + 6.4, boxY + 7.4, margin + 10, boxY + 3);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(160, 154, 146);
      doc.setLineWidth(0.8);
      doc.roundedRect(margin + 2, boxY, 10, 10, 2, 2, "FD");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(c.ok ? INK[0] : 110, c.ok ? INK[1] : 104, c.ok ? INK[2] : 98);
    doc.text(c.label, margin + 20, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(c.ok ? ACCENT[0] : MUTED[0], c.ok ? ACCENT[1] : MUTED[1], c.ok ? ACCENT[2] : MUTED[2]);
    doc.text(c.ok ? "CONFORME" : "À VÉRIFIER", pageW - margin, y, { align: "right" });
    y += 17;
  });
  y += 8;

  // ---- Travaux / réserves ----
  paragraphe("Travaux réalisés", pv.travaux, "Non renseigné.");
  paragraphe("Réserves du client", pv.reserves, "Aucune réserve formulée.");

  // ---- Photos ----
  if (photos.length > 0) {
    assurerEspace(40);
    titreSection("Photos du chantier terminé", `${photos.length} photo${photos.length > 1 ? "s" : ""}`);
    const largeurPhoto = 148;
    const hauteurPhoto = 106;
    const espace = 10;
    for (let i = 0; i < photos.length; i += 3) {
      assurerEspace(hauteurPhoto + espace);
      const tranche = photos.slice(i, i + 3);
      for (let j = 0; j < tranche.length; j += 1) {
        const photo = tranche[j];
        const x = margin + j * (largeurPhoto + espace);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
        doc.setLineWidth(0.6);
        doc.rect(x, y, largeurPhoto, hauteurPhoto, "FD");
        const size = await loadImageSize(photo.dataUrl);
        if (size) {
          const scale = Math.min(largeurPhoto / size.w, hauteurPhoto / size.h);
          const w = size.w * scale;
          const h = size.h * scale;
          try {
            doc.addImage(
              photo.dataUrl,
              imageFormat(photo.dataUrl),
              x + (largeurPhoto - w) / 2,
              y + (hauteurPhoto - h) / 2,
              w,
              h,
            );
          } catch {
            /* image illisible : le cadre reste vide */
          }
        }
      }
      y += hauteurPhoto + espace;
    }
    y += 10;
  }

  // ---- Réception / signature ----
  assurerEspace(140);
  titreSection("Réception du client");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(80, 74, 70);
  doc.text(
    pv.signataireNom
      ? `Reçu par ${pv.signataireNom}${pv.statut === "valide" ? "" : " (en attente de signature)"}`
      : "Signature du client en attente.",
    margin,
    y,
  );
  y += 12;

  if (signature) {
    const size = await loadImageSize(signature);
    const boxW = 230;
    const boxH = 86;
    assurerEspace(boxH + 10);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, y, boxW, boxH, 4, 4, "FD");
    if (size) {
      const scale = Math.min((boxW - 20) / size.w, (boxH - 16) / size.h);
      try {
        doc.addImage(
          signature,
          imageFormat(signature),
          margin + 10,
          y + 8 + (boxH - 16 - size.h * scale) / 2,
          size.w * scale,
          size.h * scale,
        );
      } catch {
        /* signature illisible */
      }
    }
    y += boxH + 10;
  }

  // ---- Pied de page ----
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(1);
    doc.line(margin, pageH - 46, pageW - margin, pageH - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("PV de recette généré avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

/**
 * Envoie le PV signé au client par email, avec le PDF en pièce jointe.
 * Le Backend vérifie que le PV appartient bien au compte (RLS) et qu'il est signé
 * avant d'expédier l'email via Resend.
 */
export async function envoyerPvRecetteEmail(params: {
  pvId: number;
  pv: PvPayload;
  infos: PvInfosImpression;
  email: string;
}): Promise<void> {
  const doc = await buildPvRecettePdf(params.pv, params.infos);
  const pdfBase64 = pdfToBase64(doc);
  if (pdfBase64.length > 4_500_000) {
    throw new Error(
      "Le PV est trop lourd pour être envoyé (photos trop nombreuses ou trop détaillées). Retirez une ou deux photos et réessayez.",
    );
  }
  const nomFichier = `PV-recette-${slug(params.infos.clientNom || params.infos.creneauLibelle) || "intervention"}-${params.infos.creneauDate}.pdf`;

  const { data, error } = await supabase.functions.invoke("envoyer-pv-recette", {
    body: {
      pvId: params.pvId,
      email: params.email,
      pdfBase64,
      filename: nomFichier,
      entreprise: params.infos.entreprise,
      intervenant: params.infos.intervenant,
      objet: params.infos.creneauLibelle,
      dateIntervention: params.infos.creneauDate,
      ville: params.infos.ville,
      clientNom: params.infos.clientNom,
    },
  });
  if (error) throw new Error(error.message);
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) throw new Error(payload?.error || "L'envoi du PV par email a échoué.");
}