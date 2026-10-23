import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  aAppelerArtisan,
  dateMarqueur,
  dejaAppele,
  dernierAppelSansReponse,
  historiqueAppels,
  joursDepuisDernierAppel,
  joursRestantsSuppression,
  libelleResultatAppel,
  motifRelance,
  nombreRelancesManuelles,
  nombreTentativesAppel,
  noteDernierAppel,
  SEUIL_SUIVI_APPEL_HEURES,
  suiviAppelDu,
  suiviClosApresDernierAppel,
  suiviClosCetteSemaine,
  suiviValideMotif,
  veutPartirArtisan,
  type SuppressionEnAttente,
} from "@/lib/suppressionsAdmin";
import { formaterDateFr } from "@/lib/compte";

const INK: [number, number, number] = [32, 30, 27];
const MUTED: [number, number, number] = [124, 117, 111];
const LINE: [number, number, number] = [232, 228, 222];
const SOFT_BG: [number, number, number] = [247, 245, 241];
const ACCENT: [number, number, number] = [196, 120, 58];

export interface PdfSuppressionsInput {
  /** Demandes exactement telles qu'affichées (donc déjà filtrées). */
  rows: SuppressionEnAttente[];
  /** Libellé lisible du filtre appliqué (« Toutes les demandes », « Échéance dans les 7 jours »…). */
  filtreLabel: string;
  /** Seuil de rappel de suivi appliqué (24 / 48 / 72 h), 48 h par défaut. */
  seuilSuiviHeures?: number;
}

/**
 * Construit le PDF d'archive de la liste « Suppressions en attente ».
 *
 * Pensé comme une **pièce d'audit** : il reprend l'état exact de la liste au moment de
 * l'export (filtre appliqué, date d'édition) et la traçabilité des rappels envoyés
 * (J-7, J-1, relances manuelles). Le document peut être classé avec les autres preuves.
 */
export function buildSuppressionsEnAttentePdf(input: PdfSuppressionsInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  // Seuil appliqué à l'encart : doit être connu avant le premier texte imprimé.
  const seuilSuivi = input.seuilSuiviHeures ?? SEUIL_SUIVI_APPEL_HEURES;

  doc.setFillColor(38, 36, 33);
  doc.rect(0, 0, pageW, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("SUPPRESSIONS DE COMPTE EN ATTENTE", margin, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    `Archive d'audit · éditée le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    margin,
    70,
  );
  doc.text(`Sélection : ${input.filtreLabel}`, margin, 84);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Suivi : ${seuilSuivi} h sans réponse`, pageW - margin, 84, {
    align: "right",
  });
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(1);
  doc.line(margin, 96, pageW - margin, 96);

  const rows = input.rows;
  const imminentes = rows.filter((r) => joursRestantsSuppression(r.prevue_le) <= 1).length;
  const dansSept = rows.filter((r) => joursRestantsSuppression(r.prevue_le) <= 7).length;
  const relancesManuelles = rows.filter((r) => typeof r.details?.relance_manuelle_le === "string").length;

  // Indicateurs (4 encadrés)
  const kpis = [
    { label: "DEMANDES LISTÉES", value: String(rows.length) },
    { label: "ÉCHÉANCE ≤ 7 JOURS", value: String(dansSept) },
    { label: "ÉCHÉANCE ≤ 1 JOUR", value: String(imminentes) },
    { label: "RELANCES MANUELLES", value: String(relancesManuelles) },
  ];
  const gap = 12;
  const boxW = (pageW - margin * 2 - gap * 3) / 4;
  const boxH = 46;
  const boxTop = 114;
  kpis.forEach((b, i) => {
    const bx = margin + i * (boxW + gap);
    doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
    doc.roundedRect(bx, boxTop, boxW, boxH, 6, 6, "F");
    doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.rect(bx, boxTop, 4, boxH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(b.label, bx + 12, boxTop + 17);
    doc.setFontSize(14);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(b.value, bx + 12, boxTop + 36);
  });

  let y = boxTop + boxH + 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(`Demandes en période de grâce (${rows.length})`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Le compte reste annulable jusqu'à l'échéance", pageW - margin, y, { align: "right" });

  autoTable(doc, {
    startY: y + 6,
    margin: { left: margin, right: margin },
    head: [
      [
        "Entreprise",
        "Email",
        "Demande le",
        "Échéance",
        "Reste",
        "Rappel J-7",
        "Rappel J-1",
        "Relance manuelle",
        "Suivi dû",
      ],
    ] as string[][],
    body: rows.length
      ? rows.map((r) => {
          const jours = joursRestantsSuppression(r.prevue_le);
          const nbRelances = nombreRelancesManuelles(r.details);
          const sansReponse = dernierAppelSansReponse(r.details);
          const tentatives = nombreTentativesAppel(r.details);
          const suiviDu = suiviAppelDu(r.details, seuilSuivi);
          return [
            r.entreprise || "Non renseignée",
            r.email || "—",
            formaterDateFr(r.demandee_le),
            formaterDateFr(r.prevue_le),
            jours > 0 ? `J-${jours}` : "Jour J",
            dateMarqueur(r.details, "rappel_j7_envoye_le") || "À venir",
            dateMarqueur(r.details, "rappel_j1_envoye_le") || "À venir",
            nbRelances >= 2
              ? sansReponse
                ? `${nbRelances} rel. · ${tentatives} sans rép.`
                : dejaAppele(r.details)
                  ? `${nbRelances} relances · appelé`
                  : `${nbRelances} relances · appeler`
              : dateMarqueur(r.details, "relance_manuelle_le") || "—",
            suiviDu ? `Oui · ${joursDepuisDernierAppel(r.details)} j` : suiviClosApresDernierAppel(r.details) ? "Clos" : "—",
          ];
        })
      : [["Aucune demande pour ce filtre", "", "", "", "", "", "", "", ""]],
    styles: {
      font: "helvetica",
      fontSize: 7.6,
      cellPadding: 5,
      textColor: [50, 46, 43],
      lineColor: [236, 232, 227],
      lineWidth: 0.5,
    },
    headStyles: { fillColor: [38, 36, 33], textColor: [249, 247, 244], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: {
      2: { cellWidth: 66 },
      3: { cellWidth: 66 },
      4: { cellWidth: 40, halign: "right" },
      5: { cellWidth: 68 },
      6: { cellWidth: 68 },
      7: { cellWidth: 86 },
      8: { cellWidth: 48, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const ligne = rows[data.row.index];
      if (!ligne) return;
      const nbRelances = nombreRelancesManuelles(ligne.details);

      // Les demandes déjà relancées au moins deux fois sont surlignées sur toute la ligne :
      // le signal qu'il faut décrocher le téléphone au lieu d'envoyer un troisième email.
      if (nbRelances >= 2) {
        data.cell.styles.fillColor = [250, 240, 226];
      }

      // La colonne « Reste » passe en alerte pour les échéances du jour ou de la veille.
      if (data.column.index === 4) {
        const valeur = String(data.cell.raw ?? "");
        if (valeur === "Jour J" || valeur === "J-1") {
          data.cell.styles.textColor = [176, 58, 58];
          data.cell.styles.fontStyle = "bold";
        }
      }

      // La colonne « Relance manuelle » met en avant les artisans encore à appeler.
      if (data.column.index === 7 && nbRelances >= 2) {
        data.cell.styles.textColor = [150, 78, 30];
        data.cell.styles.fontStyle = "bold";
      }

      // La colonne « Suivi dû » ressort les artisans à rappeler hors écran.
      if (data.column.index === 8 && suiviAppelDu(ligne.details, seuilSuivi)) {
        data.cell.styles.textColor = [150, 78, 30];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;

  const aAppeler = rows.filter((r) => aAppelerArtisan(r.details));
  const sansReponse = rows.filter((r) => aAppelerArtisan(r.details) && dernierAppelSansReponse(r.details));
  const joints = rows.filter(
    (r) => nombreRelancesManuelles(r.details) >= 2 && dejaAppele(r.details) && !dernierAppelSansReponse(r.details),
  );
  const veulentPartir = rows.filter((r) => veutPartirArtisan(r.details));
  const avecMotif = rows.filter((r) => motifRelance(r.details).length > 0);
  let blocY = lastY + 22;

  /** Dessine un encart coloré avec un titre et un texte en petites lignes. */
  const encart = (
    haut: number,
    titre: string,
    texte: string,
    fond: [number, number, number],
    barre: [number, number, number],
  ): number => {
    const lignes = doc.splitTextToSize(texte, pageW - margin * 2 - 28) as string[];
    const hauteur = 30 + lignes.length * 11;
    doc.setFillColor(fond[0], fond[1], fond[2]);
    doc.roundedRect(margin, haut, pageW - margin * 2, hauteur, 6, 6, "F");
    doc.setFillColor(barre[0], barre[1], barre[2]);
    doc.rect(margin, haut, 4, hauteur, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(titre, margin + 14, haut + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 74, 70);
    lignes.forEach((ligne, i) => {
      doc.text(ligne, margin + 14, haut + 30 + i * 11);
    });
    return haut + hauteur;
  };

  // Mise en avant des artisans déjà relancés deux fois : à appeler, pas à relancer par email.
  if (aAppeler.length > 0) {
    if (blocY > pageH - 160) {
      doc.addPage();
      blocY = margin + 12;
    }
    const noms = aAppeler.map((r) => r.entreprise || r.email || "Demande sans nom");
    blocY =
      encart(
        blocY,
        "À APPELER PLUTÔT QU'À RELANCER PAR EMAIL",
        `${aAppeler.length} demande${aAppeler.length > 1 ? "s" : ""} déjà relancée${
          aAppeler.length > 1 ? "s" : ""
        } au moins deux fois et pas encore jointe${
          aAppeler.length > 1 ? "s" : ""
        } au téléphone : ${noms.join(", ")}. Un troisième email a peu de chances d'aboutir — un appel téléphonique permet de savoir si l'artisan veut vraiment partir.${
          sansReponse.length > 0
            ? ` Dont ${sansReponse.length} déjà appelée${
                sansReponse.length > 1 ? "s" : ""
              } sans réponse : une nouvelle tentative reste nécessaire.`
            : ""
        }`,
        [250, 240, 226],
        ACCENT,
      ) + 18;
  }

  // Départs confirmés au téléphone : la priorité absolue du back-office.
  if (veulentPartir.length > 0) {
    if (blocY > pageH - 160) {
      doc.addPage();
      blocY = margin + 12;
    }
    const noms = veulentPartir.map((r) => r.entreprise || r.email || "Demande sans nom").join(", ");
    blocY =
      encart(
        blocY,
        "DÉPARTS CONFIRMÉS AU TÉLÉPHONE — À TRAITER EN PRIORITÉ",
        `${veulentPartir.length} artisan${
          veulentPartir.length > 1 ? "s ont" : " a"
        } confirmé vouloir partir lors d'un appel : ${noms}. Le départ peut suivre son cours sans nouvelle relance.`,
        [238, 226, 216],
        [150, 78, 30],
      ) + 18;
  }

  // Rappel des artisans déjà joints au téléphone : ils ne sont plus dans la liste à appeler.
  if (joints.length > 0) {
    if (blocY > pageH - 160) {
      doc.addPage();
      blocY = margin + 12;
    }
    const noms = joints.map((r) => r.entreprise || r.email || "Demande sans nom").join(", ");
    blocY =
      encart(
        blocY,
        "DÉJÀ JOINTS AU TÉLÉPHONE",
        `${joints.length} demande${joints.length > 1 ? "s" : ""} relancée${
          joints.length > 1 ? "s" : ""
        } plusieurs fois puis jointe${
          joints.length > 1 ? "s" : ""
        } par téléphone : ${noms}. Ces artisans sortent de la liste à appeler.`,
        SOFT_BG,
        [138, 130, 120],
      ) + 18;
  }

  // Historique des appels : résultat et note consignés à chaque appel téléphonique.
  const demandesAvecAppels = rows.filter((r) => historiqueAppels(r.details).length > 0);
  if (demandesAvecAppels.length > 0) {
    if (blocY > pageH - 160) {
      doc.addPage();
      blocY = margin + 12;
    }
    const lignesAppels = demandesAvecAppels
      .slice(0, 10)
      .map((r) => {
        const appels = historiqueAppels(r.details)
          .slice(-2)
          .map((a) => {
            const resultat = libelleResultatAppel({ appel_resultat: a.resultat });
            const complement = a.note ? ` — « ${a.note} »` : "";
            return `${resultat || "résultat non consigné"} le ${formaterDateFr(a.le)}${complement}`;
          })
          .join(", ");
        return `${r.entreprise || r.email || "Demande"} : ${appels}`;
      })
      .join(" · ");
    const suite =
      demandesAvecAppels.length > 10
        ? ` (+${demandesAvecAppels.length - 10} autre${
            demandesAvecAppels.length - 10 > 1 ? "s" : ""
          } dans l'export CSV)`
        : "";
    blocY =
      encart(
        blocY,
        "MOTIFS D'APPEL CONSIGNÉS",
        `${lignesAppels}${suite}`,
        SOFT_BG,
        [138, 130, 120],
      ) + 18;
  }

  // Motifs consignés par les gestionnaires : la trace écrite de pourquoi on a relancé.
  if (avecMotif.length > 0) {
    if (blocY > pageH - 160) {
      doc.addPage();
      blocY = margin + 12;
    }
    const lignesMotifs = avecMotif
      .slice(0, 12)
      .map((r) => `${r.entreprise || r.email || "Demande"} : « ${motifRelance(r.details)} »`)
      .join(" · ");
    const suite =
      avecMotif.length > 12 ? ` (+${avecMotif.length - 12} autre${avecMotif.length - 12 > 1 ? "s" : ""} motif${avecMotif.length - 12 > 1 ? "s" : ""} dans l'export CSV)` : "";
    blocY = encart(
      blocY,
      "MOTIFS DE RELANCE CONSIGNÉS",
      `${lignesMotifs}${suite}`,
      SOFT_BG,
      [138, 130, 120],
    ) + 18;
  }

  // Rappels de suivi dus : liste nominative, avec la note du dernier appel.
  const suivisDus = rows.filter((r) => suiviAppelDu(r.details, seuilSuivi));
  if (suivisDus.length > 0) {
    if (blocY > pageH - 160) {
      doc.addPage();
      blocY = margin + 12;
    }
    const lignesSuivis = suivisDus
      .slice(0, 10)
      .map((r) => {
        const note = noteDernierAppel(r.details);
        const anciennete = joursDepuisDernierAppel(r.details);
        const complement = note ? ` — dernier appel : « ${note} »` : " — aucune note d'appel";
        return `${r.entreprise || r.email || "Demande"} (sans réponse depuis ${anciennete} j)${complement}`;
      })
      .join(" · ");
    const suiteSuivis =
      suivisDus.length > 10
        ? ` (+${suivisDus.length - 10} autre${suivisDus.length - 10 > 1 ? "s" : ""} dans l'export CSV)`
        : "";
    blocY =
      encart(
        blocY,
        "RAPPELS DE SUIVI DUS",
        `${suivisDus.length} artisan${suivisDus.length > 1 ? "s" : ""} sans réponse depuis plus de ${seuilSuivi} h : ${lignesSuivis}${suiteSuivis}`,
        [250, 240, 226],
        ACCENT,
      ) + 18;
  }

  // Suivis clos depuis lundi : qui a clôturé, quand, et surtout pourquoi (motif d'audit).
  const suivisClosSemaine = rows.filter((r) => suiviClosCetteSemaine(r.details));
  if (suivisClosSemaine.length > 0) {
    if (blocY > pageH - 160) {
      doc.addPage();
      blocY = margin + 12;
    }
    const lignesClos = suivisClosSemaine
      .slice(0, 10)
      .map((r) => {
        const motif = suiviValideMotif(r.details);
        return `${r.entreprise || r.email || "Demande"} (clos le ${dateMarqueur(
          r.details,
          "suivi_valide_le",
        )})${motif ? ` — motif : « ${motif} »` : " — aucun motif saisi"}`;
      })
      .join(" · ");
    const suiteClos =
      suivisClosSemaine.length > 10
        ? ` (+${suivisClosSemaine.length - 10} autre${
            suivisClosSemaine.length - 10 > 1 ? "s" : ""
          } dans l'export CSV)`
        : "";
    blocY =
      encart(
        blocY,
        "SUIVIS CLOS CETTE SEMAINE — MOTIF CONSIGNÉ",
        `${suivisClosSemaine.length} rappel${suivisClosSemaine.length > 1 ? "s" : ""} de suivi ${
          suivisClosSemaine.length > 1 ? "ont" : "a"
        } été clos sans nouvel email : ${lignesClos}${suiteClos}`,
        SOFT_BG,
        [138, 130, 120],
      ) + 18;
  }

  // Encart de lecture : ce que ce document prouve et ce qu'il ne prouve pas.
  let noteY = blocY + 6;
  if (noteY > pageH - 150) {
    doc.addPage();
    noteY = margin + 20;
  }
  const note = doc.splitTextToSize(
    "Ce document fige l'état des demandes de suppression encore annulables au moment de l'export. Il conserve la trace des rappels automatiques (J-7, J-1), des relances manuelles et de l'arrêt de l'abonnement. Il ne contient aucune donnée métier : à classer avec les preuves d'audit RGPD.",
    pageW - margin * 2 - 28,
  ) as string[];
  const noteH = 30 + note.length * 11;
  doc.setFillColor(SOFT_BG[0], SOFT_BG[1], SOFT_BG[2]);
  doc.roundedRect(margin, noteY, pageW - margin * 2, noteH, 6, 6, "F");
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(margin, noteY, 4, noteH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("PORTÉE DU DOCUMENT", margin + 14, noteY + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 74, 70);
  note.forEach((ligne, i) => {
    doc.text(ligne, margin + 14, noteY + 30 + i * 11);
  });

  // Pied de page sur toutes les pages
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(1);
    doc.line(margin, pageH - 46, pageW - margin, pageH - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text("Archive générée avec ArtiFlow-pro", margin, pageH - 28);
    doc.text(`Page ${p} / ${pages}`, pageW - margin, pageH - 28, { align: "right" });
  }

  return doc;
}

/** Transforme un PDF reçu en base64 en URL locale (blob) affichable dans une iframe. */
export function urlBlobPdfBase64(base64: string): string {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) {
    octets[i] = binaire.charCodeAt(i);
  }
  const blob = new Blob([octets.buffer as ArrayBuffer], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

/** Télécharge dans le navigateur un PDF reçu en base64 depuis le Backend. */
export function telechargerPdfBase64(base64: string, filename: string): void {
  const url = urlBlobPdfBase64(base64);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = filename;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}