export const kpiCards = [
  { label: "Chiffre d'affaires (mois)", value: "42 850 €", trend: "+18 %", up: true, icon: "ri-line-chart-line" },
  { label: "Devis en attente", value: "7", trend: "3 à relancer", up: false, icon: "ri-file-text-line" },
  { label: "Taux de signature", value: "68 %", trend: "+9 pts", up: true, icon: "ri-quill-pen-line" },
  { label: "Factures à encaisser", value: "11 200 €", trend: "2 en retard", up: false, icon: "ri-receipt-line" },
];

export const devisList = [
  {
    id: "DV-2421",
    client: "M. Bertrand",
    objet: "Pose split 3,5 kW + mise en service",
    montant: "1 940 €",
    statut: "Envoyé",
    statusTone: "primary",
  },
  {
    id: "DV-2420",
    client: "Cabinet vétérinaire des Halles",
    objet: "Gainable 4 pièces + contrat d'entretien",
    montant: "7 890 €",
    statut: "À relancer",
    statusTone: "secondary",
  },
  {
    id: "DV-2418",
    client: "Mme Dupont",
    objet: "Rénovation salle de bain",
    montant: "4 380 €",
    statut: "Signé",
    statusTone: "accent",
  },
  {
    id: "DV-2417",
    client: "Résidence Les Tilleuls",
    objet: "Mise aux normes tableau électrique",
    montant: "2 150 €",
    statut: "Envoyé",
    statusTone: "primary",
  },
  {
    id: "DV-2415",
    client: "M. Ferreira",
    objet: "Remplacement chaudière gaz",
    montant: "5 640 €",
    statut: "À relancer",
    statusTone: "secondary",
  },
  {
    id: "DV-2411",
    client: "Boulangerie Marcel",
    objet: "Extension local + plomberie",
    montant: "9 780 €",
    statut: "Accepté",
    statusTone: "accent",
  },
];

export const planningWeek = [
  {
    day: "Lundi",
    date: "6",
    slots: [
      { time: "08:00", label: "Chaudière · M. Ferreira", ville: "Lyon 3e", tone: "primary" },
      { time: "14:00", label: "Salle de bain · Mme Dupont", ville: "Lyon 6e", tone: "accent" },
    ],
  },
  {
    day: "Mardi",
    date: "7",
    slots: [
      { time: "09:00", label: "Tableau élec · Les Tilleuls", ville: "Villeurbanne", tone: "secondary" },
      { time: "15:30", label: "Dépannage express", ville: "Lyon 7e", tone: "primary" },
    ],
  },
  {
    day: "Mercredi",
    date: "8",
    slots: [{ time: "08:30", label: "Extension · Boulangerie Marcel", ville: "Caluire", tone: "accent" }],
  },
  {
    day: "Jeudi",
    date: "9",
    slots: [
      { time: "08:00", label: "Salle de bain · Mme Dupont", ville: "Lyon 6e", tone: "accent" },
      { time: "13:00", label: "Devis sur place · M. Blanc", ville: "Bron", tone: "secondary" },
    ],
  },
  {
    day: "Vendredi",
    date: "10",
    slots: [{ time: "09:00", label: "Chaudière · M. Ferreira", ville: "Lyon 3e", tone: "primary" }],
  },
];

export const relancesList = [
  {
    client: "M. Ferreira",
    canal: "WhatsApp",
    icon: "ri-whatsapp-line",
    message: "Bonjour M. Ferreira, avez-vous pu regarder le devis pour la chaudière ?",
    when: "Aujourd'hui · 09:12",
    statut: "Envoyé",
    statusTone: "accent",
  },
  {
    client: "Résidence Les Tilleuls",
    canal: "Email",
    icon: "ri-mail-line",
    message: "Relance n°1 — je reste disponible pour ajuster le devis si besoin.",
    when: "Demain · 08:00",
    statut: "Programmé",
    statusTone: "primary",
  },
  {
    client: "Mme Garnier",
    canal: "SMS",
    icon: "ri-message-2-line",
    message: "Votre devis arrive à échéance bientôt. Souhaitez-vous réserver une date ?",
    when: "Jeudi · 10:00",
    statut: "Programmé",
    statusTone: "primary",
  },
  {
    client: "M. Blanc",
    canal: "Email",
    icon: "ri-mail-line",
    message: "Dernière relance avant clôture du dossier. Je me tiens à votre disposition.",
    when: "Vendredi · 17:30",
    statut: "Programmé",
    statusTone: "secondary",
  },
];

export const chantierSteps = [
  { label: "Visite technique & métrés", done: true },
  { label: "Dépose de l'ancien équipement", done: true },
  { label: "Installation plomberie", done: true },
  { label: "Pose des sanitaires", done: false },
  { label: "Finitions & nettoyage", done: false },
  { label: "PV de réception client", done: false },
];

export const activityFeed = [
  { icon: "ri-checkbox-circle-line", text: "Devis DV-2418 signé par Mme Dupont", when: "il y a 12 min", tone: "accent" },
  { icon: "ri-magic-line", text: "Devis généré par IA pour M. Blanc", when: "il y a 1 h", tone: "primary" },
  { icon: "ri-notification-3-line", text: "Relance WhatsApp envoyée à M. Ferreira", when: "il y a 2 h", tone: "secondary" },
  { icon: "ri-road-map-line", text: "Planning de la semaine optimisé", when: "il y a 3 h", tone: "accent" },
];

export const previewTabs = [
  { id: "dashboard", label: "Tableau de bord", icon: "ri-dashboard-line" },
  { id: "devis", label: "Devis", icon: "ri-file-text-line" },
  { id: "planning", label: "Planning", icon: "ri-calendar-2-line" },
  { id: "relances", label: "Relances", icon: "ri-notification-3-line" },
  { id: "chantiers", label: "Chantiers", icon: "ri-building-2-line" },
];