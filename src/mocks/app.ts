// Modèles de devis rapides : chaque modèle porte un objet et des lignes prêtes à
// l'emploi, réinjectées dans la fenêtre « Nouveau devis » du tableau de bord.
export interface DevisTemplateLigne {
  designation: string;
  unite: string;
  quantite: number;
  prix_unitaire: number;
}

export interface DevisTemplate {
  icon: string;
  label: string;
  lines: number;
  montant: string;
  objet: string;
  lignes: DevisTemplateLigne[];
}

export const devisTemplates: DevisTemplate[] = [
  {
    icon: "ri-water-flash-line",
    label: "Dépannage plomberie",
    lines: 4,
    montant: "180 – 650 €",
    objet: "Dépannage plomberie",
    lignes: [
      { designation: "Déplacement et diagnostic", unite: "forfait", quantite: 1, prix_unitaire: 79 },
      { designation: "Remplacement flexible / siphon", unite: "u", quantite: 1, prix_unitaire: 45 },
      { designation: "Main d'œuvre plomberie", unite: "h", quantite: 2, prix_unitaire: 65 },
      { designation: "Petit matériel (joints, raccords)", unite: "forfait", quantite: 1, prix_unitaire: 25 },
    ],
  },
  {
    icon: "ri-fire-line",
    label: "Remplacement chaudière",
    lines: 7,
    montant: "4 200 – 7 500 €",
    objet: "Remplacement de chaudière gaz",
    lignes: [
      { designation: "Dépose et évacuation ancienne chaudière", unite: "u", quantite: 1, prix_unitaire: 180 },
      { designation: "Chaudière gaz à condensation", unite: "u", quantite: 1, prix_unitaire: 3200 },
      { designation: "Kit d'évacuation des fumées", unite: "u", quantite: 1, prix_unitaire: 380 },
      { designation: "Raccordement gaz et sécurité", unite: "forfait", quantite: 1, prix_unitaire: 420 },
      { designation: "Raccordement hydraulique", unite: "forfait", quantite: 1, prix_unitaire: 350 },
      { designation: "Mise en service et réglages", unite: "forfait", quantite: 1, prix_unitaire: 220 },
      { designation: "Main d'œuvre plomberie", unite: "h", quantite: 3, prix_unitaire: 65 },
    ],
  },
  {
    icon: "ri-flashlight-line",
    label: "Mise aux normes tableau",
    lines: 6,
    montant: "1 200 – 2 600 €",
    objet: "Mise aux normes du tableau électrique",
    lignes: [
      { designation: "Dépose de l'ancien tableau", unite: "u", quantite: 1, prix_unitaire: 120 },
      { designation: "Tableau électrique pré-équipé", unite: "u", quantite: 1, prix_unitaire: 680 },
      { designation: "Disjoncteurs différentiels", unite: "u", quantite: 1, prix_unitaire: 420 },
      { designation: "Remplacement des prises", unite: "u", quantite: 6, prix_unitaire: 28 },
      { designation: "Repérage et étiquetage des circuits", unite: "forfait", quantite: 1, prix_unitaire: 90 },
      { designation: "Main d'œuvre électricité", unite: "h", quantite: 2, prix_unitaire: 70 },
    ],
  },
  {
    icon: "ri-home-4-line",
    label: "Rénovation salle de bain",
    lines: 12,
    montant: "3 500 – 9 000 €",
    objet: "Rénovation complète de salle de bain",
    lignes: [
      { designation: "Dépose de l'ancienne salle de bain", unite: "forfait", quantite: 1, prix_unitaire: 450 },
      { designation: "Évacuation des gravats", unite: "forfait", quantite: 1, prix_unitaire: 220 },
      { designation: "Plomberie encastrée", unite: "forfait", quantite: 1, prix_unitaire: 850 },
      { designation: "Faïence murale", unite: "m²", quantite: 18, prix_unitaire: 55 },
      { designation: "Carrelage au sol", unite: "m²", quantite: 6, prix_unitaire: 65 },
      { designation: "Receveur de douche extra-plat", unite: "u", quantite: 1, prix_unitaire: 280 },
      { designation: "Paroi de douche", unite: "u", quantite: 1, prix_unitaire: 340 },
      { designation: "Meuble vasque et miroir", unite: "u", quantite: 1, prix_unitaire: 460 },
      { designation: "WC suspendu", unite: "u", quantite: 1, prix_unitaire: 380 },
      { designation: "Robinetterie et accessoires", unite: "forfait", quantite: 1, prix_unitaire: 260 },
      { designation: "Peinture et finitions", unite: "forfait", quantite: 1, prix_unitaire: 300 },
      { designation: "Main d'œuvre plomberie", unite: "h", quantite: 5, prix_unitaire: 65 },
    ],
  },
  {
    icon: "ri-add-line",
    label: "Modèle vierge",
    lines: 1,
    montant: "à définir",
    objet: "",
    lignes: [],
  },
];