import { supabase } from "@/lib/supabase";
import { addDays, startOfWeek, toISODate } from "@/lib/dates";

function randomToken(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random()}`;
  return uuid.replace(/[^a-zA-Z0-9]/g, "");
}

export interface SeedResult {
  ok: boolean;
  error?: string;
}

/**
 * Remplit l'espace de l'artisan connecté avec un jeu de données d'exemple réaliste.
 * Tout est rattaché au user_id courant : RLS garantit que ces données restent privées.
 */
export async function seedDemoData(userId: string): Promise<SeedResult> {
  try {
    // 1. Clients
    const clientsSeed = [
      { nom: "Mme Dupont", telephone: "06 12 45 78 90", email: "claire.dupont@email.fr", adresse: "12 rue de la Charité, Lyon 6e", type: "particulier", notes: "Préfère être appelée le matin avant 9 h. Travaux à finir avant l'hiver.", note_priorite: "a_relancer" },
      { nom: "Résidence Les Tilleuls", telephone: "04 78 22 10 04", email: "contact@lestilleuls.fr", adresse: "8 avenue Barbusse, Villeurbanne", type: "professionnel", contact_nom: "Sophie Bernard", siret: "82345678900025", secteur: "Immobilier", notes: "Syndic très vigilant sur les délais. Facturation groupée à chaque fin de mois.", note_priorite: "sensible" },
      { nom: "Boulangerie Marcel", telephone: "06 84 33 21 09", email: "marcel.boulangerie@email.fr", adresse: "3 place de la Mairie, Caluire", type: "professionnel", contact_nom: "Marcel Dubois", siret: "83456789000036", secteur: "Commerce", notes: "Intervention possible uniquement avant 7 h (fermeture boutique).", note_priorite: "info" },
      { nom: "M. Ferreira", telephone: "07 61 55 40 12", email: "j.ferreira@email.fr", adresse: "25 rue Paul Bert, Lyon 3e", type: "particulier", notes: "Devis chaudière en attente depuis 3 semaines, à relancer en priorité.", note_priorite: "urgent" },
      { nom: "Mme Garnier", telephone: "06 33 78 90 45", email: "sophie.garnier@email.fr", adresse: "44 cours Gambetta, Lyon 7e", type: "particulier", notes: "A demandé un second devis pour comparaison.", note_priorite: "a_relancer" },
      { nom: "M. Blanc", telephone: "06 90 12 34 77", email: "hugo.blanc@email.fr", adresse: "9 rue des Écoles, Bron", type: "particulier" },
      { nom: "SCI Voltaire", telephone: "04 72 88 11 20", email: "gestion@sci-voltaire.fr", adresse: "17 cours Voltaire, Villeurbanne", type: "professionnel", contact_nom: "Julien Roche", siret: "84567890100047", secteur: "Immobilier", notes: "Dossier sensible : litige en cours sur une autre intervention, rester vigilant.", note_priorite: "sensible" },
      { nom: "M. Roche", telephone: "07 45 62 88 31", email: "p.roche@email.fr", adresse: "31 avenue Franklin, Bron", type: "particulier" },
    ];

    const clientsInsert = await supabase
      .from("clients")
      .insert(clientsSeed.map((c) => ({ ...c, user_id: userId })))
      .select("id, nom");
    if (clientsInsert.error) return { ok: false, error: clientsInsert.error.message };
    const insertedClients = (clientsInsert.data ?? []) as Array<{ id: number; nom: string }>;
    const clientId = (nom: string) => insertedClients.find((c) => c.nom === nom)?.id ?? null;

    // 2. Devis
    const devisSeed: Array<{ numero: string; client: string; objet: string; statut: string; ht: number; created_at: string; signe?: boolean; signataire?: string; signe_at?: string; taux?: number }> = [
      { numero: "DV-2409", client: "M. Roche", objet: "Pompe à chaleur air/eau", statut: "Signé", ht: 11250, created_at: "2026-05-15T10:00:00Z", signe: true, signataire: "M. Roche", signe_at: "2026-05-19T09:15:00Z", taux: 5.5 },
      { numero: "DV-2412", client: "SCI Voltaire", objet: "Réseau d'eau 3 logements", statut: "Brouillon", ht: 7240, created_at: "2026-06-10T09:00:00Z" },
      { numero: "DV-2413", client: "M. Blanc", objet: "Rénovation tableau + prises", statut: "Envoyé", ht: 1890, created_at: "2026-07-08T14:00:00Z" },
      { numero: "DV-2414", client: "Mme Garnier", objet: "Fuite cuisine + siphon", statut: "À relancer", ht: 340, created_at: "2026-08-20T11:00:00Z" },
      { numero: "DV-2415", client: "M. Ferreira", objet: "Remplacement chaudière gaz", statut: "À relancer", ht: 5640, created_at: "2026-09-12T08:30:00Z" },
      { numero: "DV-2416", client: "Boulangerie Marcel", objet: "Extension local + plomberie", statut: "Accepté", ht: 9780, created_at: "2026-09-20T15:00:00Z" },
      { numero: "DV-2417", client: "Résidence Les Tilleuls", objet: "Mise aux normes tableau électrique", statut: "Envoyé", ht: 2150, created_at: "2026-10-01T09:15:00Z" },
      { numero: "DV-2418", client: "Mme Dupont", objet: "Rénovation salle de bain", statut: "Signé", ht: 4380, created_at: "2026-10-02T16:40:00Z", signe: true, signataire: "Mme Dupont", signe_at: "2026-10-03T10:00:00Z" },
    ];

    const devisInsert = await supabase
      .from("devis")
      .insert(
        devisSeed.map((d) => ({
          user_id: userId,
          client_id: clientId(d.client),
          numero: d.numero,
          objet: d.objet,
          statut: d.statut,
          total_ht: d.ht,
          total_ttc: Math.round(d.ht * (1 + (d.taux ?? 20) / 100) * 100) / 100,
          created_at: d.created_at,
          sign_token: randomToken(),
          signed_at: d.signe ? d.signe_at ?? null : null,
          signataire_nom: d.signe ? d.signataire ?? null : null,
        })),
      )
      .select("id, numero");
    if (devisInsert.error) return { ok: false, error: devisInsert.error.message };
    const insertedDevis = (devisInsert.data ?? []) as Array<{ id: number; numero: string }>;
    const devisId = (numero: string) => insertedDevis.find((d) => d.numero === numero)?.id ?? null;

    // 3. Lignes de devis
    const lignesSeed = [
      { numero: "DV-2418", designation: "Dépose ancienne baignoire", unite: "forfait", quantite: 1, prix_unitaire: 380, taux_tva: 20 },
      { numero: "DV-2418", designation: "Pose receveur de douche + paroi", unite: "ens.", quantite: 1, prix_unitaire: 1450, taux_tva: 20 },
      { numero: "DV-2418", designation: "Carrelage mural et sol", unite: "m²", quantite: 18, prix_unitaire: 95, taux_tva: 20 },
      { numero: "DV-2418", designation: "Plomberie sanitaires", unite: "forfait", quantite: 1, prix_unitaire: 840, taux_tva: 20 },
      { numero: "DV-2415", designation: "Chaudière gaz à condensation", unite: "u", quantite: 1, prix_unitaire: 4200, taux_tva: 5.5 },
      { numero: "DV-2415", designation: "Main d'œuvre installation", unite: "h", quantite: 14, prix_unitaire: 75, taux_tva: 5.5 },
    ];
    const lignesRows = lignesSeed
      .map((l) => ({
        devis_id: devisId(l.numero),
        designation: l.designation,
        unite: l.unite,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        taux_tva: l.taux_tva,
      }))
      .filter(
        (l): l is {
          devis_id: number;
          designation: string;
          unite: string;
          quantite: number;
          prix_unitaire: number;
          taux_tva: number;
        } => l.devis_id !== null,
      );
    if (lignesRows.length) {
      const lignesInsert = await supabase.from("lignes_devis").insert(lignesRows);
      if (lignesInsert.error) return { ok: false, error: lignesInsert.error.message };
    }

    // 4. Chantiers
    const chantiersSeed = [
      { libelle: "Rénovation salle de bain", client: "Mme Dupont", adresse: "Lyon 6e", statut: "En cours", date_debut: "2026-10-02", montant: 4380 },
      { libelle: "Extension local + plomberie", client: "Boulangerie Marcel", adresse: "Caluire", statut: "En cours", date_debut: "2026-09-22", montant: 9780 },
      { libelle: "Réseau d'eau 3 logements", client: "SCI Voltaire", adresse: "Villeurbanne", statut: "Planifié", date_debut: "2026-10-14", montant: 7240 },
      { libelle: "Pompe à chaleur air/eau", client: "M. Roche", adresse: "Bron", statut: "Terminé", date_debut: "2026-09-08", montant: 11250 },
    ];
    const chantiersInsert = await supabase
      .from("chantiers")
      .insert(
        chantiersSeed.map((c) => ({
          user_id: userId,
          client_id: clientId(c.client),
          libelle: c.libelle,
          adresse: c.adresse,
          statut: c.statut,
          date_debut: c.date_debut,
          montant: c.montant,
        })),
      )
      .select("id, libelle");
    if (chantiersInsert.error) return { ok: false, error: chantiersInsert.error.message };
    const insertedChantiers = (chantiersInsert.data ?? []) as Array<{ id: number; libelle: string }>;
    const chantierId = (libelle: string) => insertedChantiers.find((c) => c.libelle === libelle)?.id ?? null;

    // 5. Étapes de chantier
    const etapesSeed = [
      { chantier: "Rénovation salle de bain", libelle: "Visite technique & métrés", fait: true },
      { chantier: "Rénovation salle de bain", libelle: "Dépose de l'ancien équipement", fait: true },
      { chantier: "Rénovation salle de bain", libelle: "Installation plomberie", fait: true },
      { chantier: "Rénovation salle de bain", libelle: "Pose des sanitaires", fait: false },
      { chantier: "Rénovation salle de bain", libelle: "Finitions & nettoyage", fait: false },
      { chantier: "Rénovation salle de bain", libelle: "PV de réception client", fait: false },
    ];
    const etapesRows = etapesSeed
      .map((e) => ({ chantier_id: chantierId(e.chantier), libelle: e.libelle, fait: e.fait }))
      .filter((e): e is { chantier_id: number; libelle: string; fait: boolean } => e.chantier_id !== null);
    if (etapesRows.length) {
      const etapesInsert = await supabase.from("etapes_chantier").insert(etapesRows);
      if (etapesInsert.error) return { ok: false, error: etapesInsert.error.message };
    }

    // 6. Relances
    const relancesSeed = [
      { numero: "DV-2415", canal: "WhatsApp", statut: "Envoyée", date_prevue: "2026-10-07", message: "Bonjour M. Ferreira, avez-vous pu regarder le devis pour la chaudière ?" },
      { numero: "DV-2417", canal: "Email", statut: "Programmée", date_prevue: "2026-10-08", message: "Relance n°1 — je reste disponible pour ajuster le devis si besoin." },
      { numero: "DV-2414", canal: "SMS", statut: "Programmée", date_prevue: "2026-10-09", message: "Votre devis arrive à échéance. Souhaitez-vous réserver une date ?" },
      { numero: "DV-2413", canal: "Email", statut: "Programmée", date_prevue: "2026-10-10", message: "Dernière relance avant clôture du dossier. Je me tiens à votre disposition." },
    ];
    const relancesRows = relancesSeed
      .map((r) => ({
        devis_id: devisId(r.numero),
        canal: r.canal,
        statut: r.statut,
        date_prevue: r.date_prevue,
        message: r.message,
      }))
      .filter((r): r is { devis_id: number; canal: string; statut: string; date_prevue: string; message: string } => r.devis_id !== null);
    if (relancesRows.length) {
      const relancesInsert = await supabase.from("relances").insert(relancesRows);
      if (relancesInsert.error) return { ok: false, error: relancesInsert.error.message };
    }

    // 7. Factures (générées depuis des devis signés)
    // Une facture référence un devis signé : on mémorise de quoi régénérer ses lignes.
    const devisInfo = new Map<
      string,
      { id: number; client_id: number | null; total_ht: number; total_ttc: number; objet: string; taux: number }
    >();
    devisSeed.forEach((d) => {
      const id = devisId(d.numero);
      const taux = d.taux ?? 20;
      if (id) {
        devisInfo.set(d.numero, {
          id,
          client_id: clientId(d.client),
          total_ht: d.ht,
          total_ttc: Math.round(d.ht * (1 + taux / 100) * 100) / 100,
          objet: d.objet,
          taux,
        });
      }
    });
    // Copies des lignes par devis (pour garnir la copie figée des factures).
    const lignesParDevis = new Map<string, Array<{ designation: string; unite: string; quantite: number; prix_unitaire: number; taux_tva: number }>>();
    lignesSeed.forEach((l) => {
      const arr = lignesParDevis.get(l.numero) ?? [];
      arr.push({
        designation: l.designation,
        unite: l.unite,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        taux_tva: l.taux_tva,
      });
      lignesParDevis.set(l.numero, arr);
    });
    const facturesSeed = [
      { numero: "FAC-2026-0001", devis: "DV-2409", statut: "Payée", date_emission: "2026-09-10", date_echeance: "2026-10-10", date_paiement: "2026-09-28" },
      { numero: "FAC-2026-0002", devis: "DV-2418", statut: "Émise", date_emission: "2026-10-03", date_echeance: "2026-11-02", date_paiement: null },
    ];
    const facturesRows = facturesSeed
      .map((f) => {
        const src = devisInfo.get(f.devis);
        if (!src) return null;
        // Copie figée des lignes : celles du devis, ou une ligne unique au taux du devis à défaut.
        const lignesDevis = lignesParDevis.get(f.devis);
        const lignes =
          lignesDevis && lignesDevis.length
            ? lignesDevis
            : [{ designation: src.objet, unite: "forfait", quantite: 1, prix_unitaire: src.total_ht, taux_tva: src.taux }];
        return {
          user_id: userId,
          devis_id: src.id,
          client_id: src.client_id,
          numero: f.numero,
          statut: f.statut,
          total_ht: src.total_ht,
          total_ttc: src.total_ttc,
          date_emission: f.date_emission,
          date_echeance: f.date_echeance,
          date_paiement: f.date_paiement,
          lignes,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);
    if (facturesRows.length) {
      const facturesInsert = await supabase
        .from("factures")
        .insert(facturesRows)
        .select("id, numero, devis_id, client_id");
      if (facturesInsert.error) return { ok: false, error: facturesInsert.error.message };

      const insertedFactures = (facturesInsert.data ?? []) as Array<{
        id: number;
        numero: string;
        devis_id: number | null;
        client_id: number | null;
      }>;
      const emailByClientNom = new Map(clientsSeed.map((c) => [c.nom, c.email]));
      const clientNomByDevis = new Map(devisSeed.map((d) => [d.numero, d.client]));
      const factureByNumero = new Map(insertedFactures.map((f) => [f.numero, f]));

      const envoisRows = facturesSeed
        .map((fs) => {
          const fact = factureByNumero.get(fs.numero);
          if (!fact) return null;
          const clientNom = clientNomByDevis.get(fs.devis);
          return {
            user_id: userId,
            facture_id: fact.id,
            devis_id: fact.devis_id,
            relance_id: null,
            type: "facture",
            mode: "exemple",
            canal: "email",
            destinataire: clientNom ? emailByClientNom.get(clientNom) ?? null : null,
            sujet: `Votre facture ${fs.numero}`,
            created_at: `${fs.date_emission}T09:12:00Z`,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null);

      const relanceFacture = factureByNumero.get("FAC-2026-0002");
      if (relanceFacture) {
        envoisRows.push({
          user_id: userId,
          facture_id: relanceFacture.id,
          devis_id: relanceFacture.devis_id,
          relance_id: null,
          type: "relance",
          mode: "exemple",
          canal: "email",
          destinataire: emailByClientNom.get("Mme Dupont") ?? null,
          sujet: "Relance · Facture FAC-2026-0002",
          created_at: "2026-10-06T08:05:00Z",
        });
      }

      // Relances externes (SMS + WhatsApp) pour alimenter l'historique d'envoi.
      const smsDevis = devisInfo.get("DV-2414");
      if (smsDevis) {
        envoisRows.push({
          user_id: userId,
          facture_id: null,
          devis_id: smsDevis.id,
          relance_id: null,
          type: "relance",
          mode: "exemple",
          canal: "sms",
          destinataire: "+33633789045",
          sujet: "Votre devis arrive à échéance. Souhaitez-vous réserver une date ?",
          created_at: "2026-10-07T10:20:00Z",
        });
      }
      const waDevis = devisInfo.get("DV-2415");
      if (waDevis) {
        envoisRows.push({
          user_id: userId,
          facture_id: null,
          devis_id: waDevis.id,
          relance_id: null,
          type: "relance",
          mode: "exemple",
          canal: "whatsapp",
          destinataire: "+33761554012",
          sujet: "Bonjour M. Ferreira, avez-vous pu regarder le devis pour la chaudière ?",
          created_at: "2026-10-07T09:35:00Z",
        });
      }

      if (envoisRows.length) {
        const envoisInsert = await supabase.from("envois_email").insert(envoisRows);
        if (envoisInsert.error) return { ok: false, error: envoisInsert.error.message };
      }
    }

    // 8. Planning : intervenants de l'équipe + créneaux de la semaine en cours
    const intervenantsSeed = [
      { nom: "Thomas Rivière", couleur: "ambre", metier: "Chef d'équipe", telephone: "06 21 44 90 12" },
      { nom: "Yanis Moreau", couleur: "terracotta", metier: "Électricien", telephone: "07 55 12 78 33" },
      { nom: "Sofia Da Silva", couleur: "emeraude", metier: "Apprentie", telephone: "06 78 90 21 45" },
    ];
    const intervenantsInsert = await supabase
      .from("intervenants")
      .insert(intervenantsSeed.map((i) => ({ user_id: userId, ...i })))
      .select("id, nom");
    if (intervenantsInsert.error) return { ok: false, error: intervenantsInsert.error.message };
    const insertedIntervenants = (intervenantsInsert.data ?? []) as Array<{ id: number; nom: string }>;
    const intervenantId = (nom: string | null) => (nom ? insertedIntervenants.find((i) => i.nom === nom)?.id ?? null : null);

    // Relier chaque chantier d'exemple à un pilote (parmi les intervenants créés) : on sait
    // ainsi qui pilote quoi, et l'onglet Chantiers comme le planning sont parlants dès la démo.
    const piloteParChantier: Array<{ libelle: string; pilote: string }> = [
      { libelle: "Rénovation salle de bain", pilote: "Thomas Rivière" },
      { libelle: "Extension local + plomberie", pilote: "Yanis Moreau" },
      { libelle: "Réseau d'eau 3 logements", pilote: "Sofia Da Silva" },
      { libelle: "Pompe à chaleur air/eau", pilote: "Thomas Rivière" },
    ];
    for (const p of piloteParChantier) {
      const cible = chantierId(p.libelle);
      const pilote = intervenantId(p.pilote);
      if (cible !== null && pilote !== null) {
        await supabase.from("chantiers").update({ intervenant_id: pilote }).eq("id", cible);
      }
    }

    const weekStart = startOfWeek(new Date());
    const day = (i: number) => toISODate(addDays(weekStart, i));
    const creneauxSeed: Array<{ date: string; heure: string; libelle: string; ville: string; intervenant: string | null }> = [
      { date: day(0), heure: "08:00", libelle: "Chaudière · M. Ferreira", ville: "Lyon 3e", intervenant: "Thomas Rivière" },
      { date: day(0), heure: "14:00", libelle: "Salle de bain · Mme Dupont", ville: "Lyon 6e", intervenant: "Yanis Moreau" },
      { date: day(1), heure: "09:00", libelle: "Tableau élec · Les Tilleuls", ville: "Villeurbanne", intervenant: "Yanis Moreau" },
      { date: day(1), heure: "15:30", libelle: "Dépannage express", ville: "Lyon 7e", intervenant: "Thomas Rivière" },
      { date: day(2), heure: "08:30", libelle: "Extension · Boulangerie Marcel", ville: "Caluire", intervenant: "Sofia Da Silva" },
      { date: day(3), heure: "08:00", libelle: "Salle de bain · Mme Dupont", ville: "Lyon 6e", intervenant: "Sofia Da Silva" },
      { date: day(3), heure: "13:00", libelle: "Devis sur place · M. Blanc", ville: "Bron", intervenant: null },
      { date: day(4), heure: "09:00", libelle: "Chaudière · M. Ferreira", ville: "Lyon 3e", intervenant: "Thomas Rivière" },
    ];
    const creneauxInsert = await supabase.from("planning_creneaux").insert(
      creneauxSeed.map((c) => ({
        user_id: userId,
        date: c.date,
        heure: c.heure,
        libelle: c.libelle,
        ville: c.ville,
        intervenant_id: intervenantId(c.intervenant),
      })),
    );
    if (creneauxInsert.error) return { ok: false, error: creneauxInsert.error.message };

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue lors du chargement des exemples." };
  }
}