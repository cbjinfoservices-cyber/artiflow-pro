# Facturation électronique — mise en service

## Ce qui est déjà en place dans l'application

- **Fichier structuré Factur-X** (profil MINIMUM, norme EN 16931) généré depuis chaque facture,
  avec les lignes, les taux de TVA, les totaux et l'identité des deux parties.
- **Mentions obligatoires** ajoutées automatiquement au pied des factures :
  indemnité forfaitaire de recouvrement de 40 €, escompte de paiement anticipé (si renseigné),
  option TVA sur les débits, autoliquidation, franchise en base (art. 293 B du CGI).
- **Registre de suivi** : chaque facture porte une étape (`À préparer`, `Prête`, `Transmise`,
  `Reçue`, `Rejetée`), sa date de transmission et son motif de rejet éventuel.
- **Export CSV du registre** pour l'archivage ou la transmission à un tiers.

## Ce qui nécessite un compte chez un prestataire

L'envoi **automatique** des factures vers une plateforme de dématérialisation agréée (PDP) ou vers
Chorus Pro ne peut pas être assuré par le site seul : la loi impose de passer par une plateforme
immatriculée par l'État. Pour activer cette étape :

1. Choisir une plateforme (ou l'annuaire officiel des PDP) et ouvrir un compte professionnel.
2. Récupérer les identifiants d'API fournis par la plateforme (clé, secret, identifiant de compte).
3. Enregistrer ces identifiants comme secrets du Backend (jamais dans le code du navigateur).
4. Créer une fonction Backend `transmettre-facture-electronique` qui :
   - vérifie l'utilisateur appelant,
   - relit la facture et génère le XML avec la même logique que `src/lib/factureElectronique.ts`,
   - appelle l'API de la plateforme,
   - met à jour `factures.efacture_statut` et `factures.efacture_transmis_le` selon la réponse.
5. Ajouter une tâche planifiée qui interroge la plateforme pour récupérer les accusés de réception
   et les rejets, puis met à jour les statuts (`recue` / `rejetee` + `efacture_motif`).

## Calendrier

La réforme se déploie par vagues (réception pour toutes les entreprises, puis émission progressive
selon la taille et le régime de TVA). Les dates officielles évoluent : vérifier l'échéance exacte
applicable à l'entreprise sur impots.gouv.fr avant de communiquer une date aux clients.

## Champs en base

`factures` : `efacture_statut`, `efacture_format`, `efacture_transmis_le`, `efacture_motif`.

`profiles` : `efacture_option_debits`, `efacture_autoliquidation`, `efacture_dispense_tva`,
`efacture_escompte`, `efacture_mentions_libres`, `efacture_pdp`.