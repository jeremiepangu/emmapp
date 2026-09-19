import { printDocument, setDocumentOutput, type BlankTableSpec } from './printDocument';

export interface PaperFormSpec {
  id: string;
  path: string;
  title: string;
  subtitle?: string;
  group?: string;
  copiesPerPage?: 1 | 2 | 4;
  lean?: boolean;
  instructions: string;
  handFields: Array<{ label: string; wide?: boolean }>;
  handNotes?: Array<{ label: string; lines?: number }>;
  blankKpis?: string[];
  checks?: string[];
  blankTable?: BlankTableSpec;
  blankTables?: BlankTableSpec[];
  notes?: string;
  signatures?: string[];
}

function f(path: string, id: string, title: string, extra: Omit<PaperFormSpec, 'id' | 'path' | 'title'>): PaperFormSpec {
  return { id, path, title, ...extra };
}

const ID = [
  { label: 'Nom et prénom / raison sociale' },
  { label: 'Matricule / code' },
  { label: 'Téléphone' },
  { label: 'Date' },
];

const ACTIVITY_LINE = [
  'Heure de début',
  'Heure de fin',
  'Tâche / tournée / article',
  'Qté',
  'Résultat / montant',
  'Commentaire / reste',
];

const ACTIVITY_KPIS = ['Livraisons', 'Tournées', 'Quantité', 'Encaissements', 'Shifts', 'Objectifs'];

function activityPaperForms(): PaperFormSpec[] {
  const identity = [
    { label: 'Agent' }, { label: 'Matricule' }, { label: 'Fonction' }, { label: 'Service' },
  ];
  return [
    f('/activity', 'activite-quotidien', 'Rapport d\'activité quotidien', {
      lean: true,
      copiesPerPage: 1,
      instructions: '',
      handFields: [
        ...identity,
        { label: 'Date' }, { label: 'Zone' }, { label: 'Site / dépôt' }, { label: 'Véhicule' },
        { label: 'Prise de poste' }, { label: 'Fin de poste' }, { label: 'N° rapport' }, { label: 'Superviseur' },
      ],
      blankKpis: ACTIVITY_KPIS,
      blankTables: [
        { title: 'Détail des activités', headers: ACTIVITY_LINE, rowCount: 7, showTotal: true },
        { title: 'Livraisons', headers: ['N°', 'Client', 'Article', 'Qté', 'Montant', 'Statut'], rowCount: 4, showTotal: true, half: true },
        { title: 'Tournées / shifts', headers: ['N° / poste', 'Zone', 'Début', 'Fin', 'Statut'], rowCount: 4, showTotal: true, half: true },
        { title: 'Encaissements', headers: ['N°', 'Mode', 'Client', 'Montant'], rowCount: 3, showTotal: true, half: true },
        { title: 'Objectifs du jour', headers: ['Activité', 'Cible', 'Réalisé', 'Écart'], rowCount: 3, showTotal: true, half: true },
      ],
      handNotes: [
        { label: 'Résumé de la journée', lines: 2 },
        { label: 'Incidents / reste à traiter', lines: 2 },
      ],
      signatures: ['Agent', 'Superviseur'],
    }),
    f('/activity', 'activite-mensuel', 'Rapport d\'activité mensuel', {
      lean: true,
      copiesPerPage: 1,
      instructions: '',
      handFields: [
        ...identity,
        { label: 'Mois' }, { label: 'Année' }, { label: 'Zone' }, { label: 'Jours travaillés' },
      ],
      blankKpis: ACTIVITY_KPIS,
      blankTables: [
        { title: 'Détail des activités / articles', headers: ACTIVITY_LINE, rowCount: 6, showTotal: true },
        { title: 'Synthèse hebdomadaire', headers: ['Semaine', 'Livraisons', 'Tournées', 'Qté', 'Encaissements', 'Incidents'], rowCount: 5, showTotal: true },
        { title: 'Objectifs du mois', headers: ['Activité / objectif', 'Cible', 'Réalisé', '%', 'Écart'], rowCount: 4, showTotal: true, half: true },
        { title: 'Absences / congés', headers: ['Type', 'Du', 'Au', 'Jours'], rowCount: 3, showTotal: true, half: true },
      ],
      handNotes: [
        { label: 'Faits marquants du mois', lines: 2 },
        { label: 'Incidents et reste à traiter', lines: 2 },
      ],
      signatures: ['Agent', 'Superviseur'],
    }),
    f('/activity', 'activite-semestriel', 'Rapport d\'activité semestriel', {
      lean: true,
      copiesPerPage: 1,
      instructions: '',
      handFields: [
        ...identity,
        { label: 'Semestre (1er / 2e)' }, { label: 'Année' }, { label: 'Zone' }, { label: 'Jours travaillés' },
      ],
      blankKpis: ACTIVITY_KPIS,
      blankTables: [
        { title: 'Bilan mensuel', headers: ['Mois', 'Livraisons', 'Tournées', 'Qté', 'Encaissements', 'Incidents'], rowCount: 6, showTotal: true },
        { title: 'Activités / articles consolidés', headers: ACTIVITY_LINE, rowCount: 5, showTotal: true },
        { title: 'Objectifs du semestre', headers: ['Objectif', 'Cible', 'Réalisé', '%', 'Écart'], rowCount: 4, showTotal: true },
      ],
      handNotes: [
        { label: 'Points forts', lines: 2 },
        { label: 'Axes d\'amélioration / reste', lines: 2 },
      ],
      signatures: ['Agent', 'Superviseur'],
    }),
    f('/activity', 'activite-annuel', 'Rapport d\'activité annuel', {
      lean: true,
      copiesPerPage: 1,
      instructions: '',
      handFields: [
        ...identity,
        { label: 'Année' }, { label: 'Zone' }, { label: 'Jours travaillés' }, { label: 'N° rapport' },
      ],
      blankKpis: ACTIVITY_KPIS,
      blankTables: [
        { title: 'Bilan mensuel', headers: ['Mois', 'Livraisons', 'Tournées', 'Qté', 'Encaissements', 'Incidents'], rowCount: 12, showTotal: true },
        { title: 'Activités / articles consolidés', headers: ACTIVITY_LINE, rowCount: 4, showTotal: true },
        { title: 'Objectifs annuels', headers: ['Objectif / activité', 'Cible', 'Réalisé', '%', 'Écart'], rowCount: 4, showTotal: true, half: true },
        { title: 'Formation / évaluation', headers: ['Intitulé', 'Date', 'Résultat', 'Commentaire'], rowCount: 3, showTotal: false, half: true },
      ],
      handNotes: [
        { label: 'Bilan et reste à traiter', lines: 2 },
      ],
      signatures: ['Agent', 'Superviseur', 'Direction'],
    }),
  ];
}

export const PAPER_FORMS: PaperFormSpec[] = [
  f('/app', 'dash-saisie', 'Feuille de saisie quotidienne', {
    instructions: 'Relever les chiffres du jour hors ligne, puis saisir dans le tableau de bord.',
    handFields: [...ID, { label: 'Site / dépôt' }, { label: 'Agent responsable' }],
    blankTable: { title: 'Indicateurs du jour', headers: ['Indicateur', 'Valeur', 'Observation'], rowCount: 8 },
    signatures: ['Agent', 'Superviseur'],
  }),
  f('/clients', 'client-fiche', 'Fiche client (saisie manuelle)', {
    instructions: 'Enrôlement terrain. Joindre copie de la pièce d\'identité.',
    handFields: [
      { label: 'Nom / raison sociale' }, { label: 'Code (si connu)' },
      { label: 'Segment (particulier, boutique, détaillant, supermarché, entreprise, HoReCa)' , wide: true },
      { label: 'Téléphone' }, { label: 'Profession / secteur' },
      { label: 'Avenue et numéro' }, { label: 'Quartier' },
      { label: 'Commune' }, { label: 'District' },
      { label: 'Type de pièce' }, { label: 'N° de pièce' },
      { label: 'Plafond consigne' }, { label: 'GPS (lat, lng)' },
    ],
    checks: ['Nouveau client', 'Mise à jour', 'Inactif', 'Grand compte'],
    signatures: ['Enquêteur', 'Client'],
  }),
  f('/orders', 'commande', 'Bon de commande papier', {
    instructions: 'Prise de commande hors connexion. À saisir ensuite dans l\'historique commandes.',
    handFields: [...ID, { label: 'Client' }, { label: 'Zone / tournée' }, { label: 'Date de livraison souhaitée' }],
    blankTable: { title: 'Lignes', headers: ['Produit', 'Format', 'Qté', 'Prix', 'Bonus', 'Total'], rowCount: 10 },
    checks: ['Crédit', 'Comptant', 'Mobile money', 'Consigne à suivre'],
    signatures: ['Commercial', 'Client'],
  }),
  f('/pos', 'pos-ticket', 'Ticket caisse / brouillard', {
    instructions: 'En cas de panne POS. Reporter chaque ligne puis clôturer la caisse dans le module.',
    handFields: [{ label: 'Caissier' }, { label: 'N° caisse / site' }, { label: 'Date et heure' }, { label: 'N° ticket manuscrit' }],
    blankTable: { title: 'Ventes', headers: ['Heure', 'Produit', 'Qté', 'Prix', 'Mode', 'Montant'], rowCount: 12 },
    checks: ['Espèces', 'Mobile money', 'Crédit client', 'Avoir'],
    signatures: ['Caissier', 'Contrôle caisse'],
  }),
  f('/products', 'produit', 'Fiche produit / tarif', {
    instructions: 'Création ou mise à jour catalogue avant saisie ERP.',
    handFields: [
      { label: 'Nom' }, { label: 'Code' }, { label: 'Format' }, { label: 'Prix unitaire CDF' },
      { label: 'Seuil d\'alerte' }, { label: 'Unité' },
    ],
    checks: ['Réutilisable / consigné', 'Nouveau', 'Retrait catalogue'],
    signatures: ['Demandeur', 'Validation catalogue'],
  }),
  f('/pricing', 'tarif', 'Demande de tarif / bonus', {
    instructions: 'Validation manuelle d\'une exception tarifaire.',
    handFields: [
      { label: 'Client / zone / agent' }, { label: 'Produit (ou tous)' },
      { label: 'Qté min' }, { label: 'Qté max' },
      { label: 'Type (prix fixe / %)' }, { label: 'Valeur' },
      { label: 'Motif', wide: true },
    ],
    checks: ['Permanent', 'Promotion', 'Lot de 10', 'Exception DG'],
    signatures: ['Commercial', 'Validation'],
  }),
  f('/stock', 'stock-mvt', 'Bon de mouvement de stock', {
    instructions: 'Entrée, sortie, inventaire ou achat hors terminal.',
    handFields: [...ID, { label: 'Dépôt / magasin' }, { label: 'Fournisseur (si achat)' }, { label: 'N° bon' }],
    checks: ['Entrée', 'Sortie', 'Inventaire', 'Ajustement', 'Achat', 'Casse'],
    blankTable: { title: 'Lignes stock', headers: ['Produit', 'Lot', 'Qté +/-', 'Unité', 'Observation'], rowCount: 10 },
    signatures: ['Magasinier', 'Contrôle'],
  }),
  f('/packaging', 'emballage', 'Mouvement d\'emballages', {
    instructions: 'Suivi bonbonnes, bidons et consignes physiques.',
    handFields: [{ label: 'Agent / tournée' }, { label: 'Client' }, { label: 'Date' }, { label: 'Type d\'emballage' }],
    checks: ['Sortie', 'Retour', 'Manquant', 'Casse', 'Réforme'],
    blankTable: { title: 'Unités', headers: ['SKU', 'Qté', 'État', 'N° lot / marque'], rowCount: 8 },
    signatures: ['Magasinier', 'Livreur'],
  }),
  f('/production', 'of', 'Ordre de fabrication papier', {
    instructions: 'Lancer ou clôturer un OF si l\'atelier n\'a pas de poste.',
    handFields: [
      { label: 'Produit' }, { label: 'Quantité prévue' }, { label: 'Quantité réelle' },
      { label: 'Équipe' }, { label: 'Heure début' }, { label: 'Heure fin' },
      { label: 'Lots matières', wide: true },
    ],
    checks: ['Planifié', 'En cours', 'Terminé', 'Non conforme'],
    signatures: ['Chef production', 'Qualité'],
  }),
  f('/quality', 'qualite', 'Fiche de contrôle qualité', {
    instructions: 'Relevé laboratoire / terrain. Joindre le n° de lot.',
    handFields: [
      { label: 'Lot / OF' }, { label: 'Date et heure' }, { label: 'Technicien' },
      { label: 'pH' }, { label: 'Chlore / désinfectant' }, { label: 'Turbidité' },
      { label: 'Goût / odeur' }, { label: 'Décision (libéré / bloqué)' },
      { label: 'Observations', wide: true },
    ],
    checks: ['Conforme', 'Non conforme', 'Quarantaine', 'Retest'],
    signatures: ['Contrôleur', 'Responsable qualité'],
  }),
  f('/tours', 'tournee', 'Feuille de tournée', {
    instructions: 'Préparer ou clôturer une tournée sans terminal.',
    handFields: [{ label: 'Livreur' }, { label: 'Véhicule' }, { label: 'Date' }, { label: 'Zone' }, { label: 'Km départ' }, { label: 'Km retour' }],
    blankTable: { title: 'Stops', headers: ['Heure', 'Client', 'Produit', 'Livré', 'Retour consigne', 'Encaissé'], rowCount: 12 },
    signatures: ['Livreur', 'Exploitation'],
  }),
  f('/vehicles', 'vehicule', 'Fiche véhicule / incident', {
    instructions: 'État du parc, panne, carburant ou affectation.',
    handFields: [
      { label: 'Immatriculation' }, { label: 'Chauffeur' }, { label: 'Date' },
      { label: 'Km' }, { label: 'Carburant (L)' }, { label: 'Incident', wide: true },
    ],
    checks: ['OK', 'Maintenance', 'Immobilisé', 'Accident'],
    signatures: ['Chauffeur', 'Chef exploitation'],
  }),
  f('/routing', 'itineraire', 'Itinéraire manuscrit', {
    instructions: 'Ordre des stops si l\'optimiseur n\'est pas disponible.',
    handFields: [{ label: 'Date' }, { label: 'Livreur' }, { label: 'Véhicule' }, { label: 'Zone' }],
    blankTable: { title: 'Ordre de passage', headers: ['N°', 'Client', 'Adresse', 'Fenêtre horaire', 'Fait'], rowCount: 12 },
    signatures: ['Exploitation', 'Livreur'],
  }),
  f('/deliveries', 'livraison', 'Bon de livraison', {
    instructions: 'Preuve de livraison à faire signer par le client.',
    handFields: [
      { label: 'N° BL' }, { label: 'Date' }, { label: 'Client' }, { label: 'Adresse' },
      { label: 'Livreur' }, { label: 'Véhicule' },
    ],
    blankTable: { title: 'Quantités', headers: ['Produit', 'Commandé', 'Livré', 'Retour', 'Écart'], rowCount: 8 },
    checks: ['Livré complet', 'Livré partiel', 'Refus', 'Avoir à établir'],
    signatures: ['Livreur', 'Réceptionnaire client'],
  }),
  f('/payments', 'paiement', 'Reçu de paiement manuscrit', {
    instructions: 'Encaissement terrain. Un exemplaire client, un exemplaire caisse.',
    handFields: [
      { label: 'Client' }, { label: 'N° facture / commande' }, { label: 'Montant en lettres', wide: true },
      { label: 'Montant CDF' }, { label: 'Mode' }, { label: 'Référence mobile money' },
    ],
    checks: ['Espèces', 'Mobile money', 'Virement', 'Acompte', 'Solde'],
    signatures: ['Caissier / livreur', 'Client'],
  }),
  f('/finance', 'ecriture', 'Pièce comptable / écriture', {
    instructions: 'Saisie manuelle d\'une opération à retracer en comptabilité.',
    handFields: [
      { label: 'Journal' }, { label: 'Date' }, { label: 'Pièce n°' }, { label: 'Libellé', wide: true },
      { label: 'Compte débit' }, { label: 'Compte crédit' }, { label: 'Montant' }, { label: 'Tiers' },
    ],
    blankTable: { title: 'Lignes', headers: ['Compte', 'Libellé', 'Débit', 'Crédit'], rowCount: 8 },
    signatures: ['Saisie', 'Validation comptable'],
  }),
  f('/loyalty', 'fidelite', 'Mouvement fidélité', {
    instructions: 'Attribution ou consommation de points hors caisse.',
    handFields: [{ label: 'Client' }, { label: 'Points +/-' }, { label: 'Motif', wide: true }, { label: 'Date' }],
    checks: ['Gain', 'Récompense', 'Correction', 'Annulation'],
    signatures: ['Commercial', 'Client'],
  }),
  f('/consignes', 'consigne', 'Bon de consigne / retour emballage', {
    instructions: 'Mouvement physique d\'emballages consignés.',
    handFields: [{ label: 'Client' }, { label: 'Livreur' }, { label: 'Date' }, { label: 'Solde avant' }],
    blankTable: { title: 'Emballages', headers: ['Type', 'Sortis', 'Retournés', 'Manquants', 'Montant'], rowCount: 6 },
    signatures: ['Livreur', 'Client'],
  }),
  f('/marketplace', 'devis', 'Demande de devis B2B', {
    instructions: 'Recueillir un besoin grand compte avant saisie marketplace.',
    handFields: [
      { label: 'Société' }, { label: 'Contact' }, { label: 'Téléphone' }, { label: 'E-mail' },
      { label: 'Volume estimé / mois', wide: true },
    ],
    blankTable: { title: 'Besoins', headers: ['Produit', 'Qté', 'Cadence', 'Prix cible'], rowCount: 8 },
    signatures: ['Commercial', 'Client'],
  }),
  f('/contracts', 'contrat-vierge', 'Fiche contrat (saisie manuelle)', {
    instructions: 'Recueillir les éléments avant génération Word. Joindre pièce d\'identité et fiche de poste.',
    handFields: [
      { label: 'Partie (agent / fournisseur / grand client)' }, { label: 'Nom' },
      { label: 'Matricule / code' }, { label: 'Poste / catégorie' },
      { label: 'Type (CDI, CDD, stage, journalier, prestation, cadre…)' }, { label: 'Territoire' },
      { label: 'Début' }, { label: 'Fin' }, { label: 'Montant' }, { label: 'Préavis (jours)' },
      { label: 'Clauses particulières', wide: true },
    ],
    checks: ['CDI', 'CDD', 'Stage', 'Journalier', 'Prestation', 'Fournisseur', 'Grand client'],
    signatures: ['EMMANUEL SERVICES SARLU', 'Cocontractant'],
  }),
  f('/hr', 'rh-embauche', 'Fiche d\'embauche / dossier agent', {
    instructions: 'Constitution du dossier RH hors SIRH.',
    handFields: [
      { label: 'Nom' }, { label: 'Prénom' }, { label: 'Date de naissance' }, { label: 'Lieu' },
      { label: 'Téléphone' }, { label: 'N° pièce' }, { label: 'Poste' }, { label: 'Service' },
      { label: 'Type de contrat' }, { label: 'Salaire de base' }, { label: 'Date d\'entrée' }, { label: 'CNSS' },
    ],
    checks: ['Pièce jointe', 'Photo', 'RIB', 'Visite médicale', 'Casier'],
    signatures: ['Agent', 'RH'],
  }),
  f('/hr', 'rh-conge', 'Demande de congé / absence', {
    instructions: 'À déposer au service RH si l\'agent n\'a pas d\'accès.',
    handFields: [
      { label: 'Agent' }, { label: 'Matricule' }, { label: 'Type (congé, maladie, permission)' },
      { label: 'Du' }, { label: 'Au' }, { label: 'Nombre de jours' }, { label: 'Motif', wide: true },
    ],
    checks: ['Payé', 'Sans solde', 'Maladie (certificat joint)', 'Urgence familiale'],
    signatures: ['Agent', 'N+1', 'RH'],
  }),
  f('/hr', 'rh-eval', 'Fiche d\'évaluation', {
    instructions: 'Entretien annuel ou mi-parcours.',
    handFields: [{ label: 'Agent' }, { label: 'Évaluateur' }, { label: 'Période' }, { label: 'Note globale /20' }],
    blankTable: { title: 'Critères', headers: ['Critère', 'Note', 'Commentaire'], rowCount: 8 },
    signatures: ['Agent', 'Évaluateur'],
  }),
  f('/objectives', 'objectif', 'Fiche objectif agent', {
    instructions: 'Fixation d\'objectif mensuel hors écran.',
    handFields: [
      { label: 'Agent' }, { label: 'Activité / fonction' }, { label: 'Mois' }, { label: 'Année' },
      { label: 'Cible volume' }, { label: 'Cible CA' }, { label: 'Commentaire', wide: true },
    ],
    signatures: ['Agent', 'Manager'],
  }),
  ...activityPaperForms(),
  f('/payroll', 'paie', 'Élément de paie / avance', {
    instructions: 'Prime, retenue ou avance à intégrer au bulletin.',
    handFields: [
      { label: 'Agent' }, { label: 'Période' }, { label: 'Nature' }, { label: 'Montant' },
      { label: 'Motif', wide: true },
    ],
    checks: ['Prime', 'Heures supp.', 'Avance', 'Retenue', 'Transport'],
    signatures: ['RH', 'Comptable', 'Agent'],
  }),
  f('/users', 'utilisateur', 'Demande de compte / habilitation', {
    instructions: 'Création ou modification d\'accès ERP.',
    handFields: [
      { label: 'Nom' }, { label: 'Prénom' }, { label: 'E-mail' }, { label: 'Profil demandé' },
      { label: 'Modules supplémentaires', wide: true },
    ],
    checks: ['Création', 'Modification', 'Désactivation', 'Réinitialisation mot de passe'],
    signatures: ['Demandeur', 'N+1', 'IT / RH'],
  }),
  f('/authorizations', 'habilitation', 'Demande d\'habilitation', {
    instructions: 'Exception individuelle GRANT / DENY.',
    handFields: [
      { label: 'Utilisateur' }, { label: 'Ressource / module' }, { label: 'Action (lire, créer…)' },
      { label: 'Effet (accorder / refuser)' }, { label: 'Motif', wide: true },
    ],
    signatures: ['Demandeur', 'Responsable habilitations'],
  }),
  f('/portal-accounts', 'portail', 'Ouverture compte portail client', {
    instructions: 'Self-service : recueil des identifiants à créer.',
    handFields: [{ label: 'Client lié' }, { label: 'E-mail' }, { label: 'Téléphone' }, { label: 'Contact' }],
    checks: ['Actif', 'Suspendu', 'Mot de passe à envoyer'],
    signatures: ['Commercial', 'Client'],
  }),
  f('/iot', 'capteur', 'Relevé capteur / incident IoT', {
    instructions: 'Relevé manuel si le capteur est hors ligne.',
    handFields: [
      { label: 'Capteur / site' }, { label: 'Date et heure' }, { label: 'Mesure' }, { label: 'Unité' },
      { label: 'Observation', wide: true },
    ],
    checks: ['Normal', 'Alerte', 'Hors ligne', 'Maintenance'],
    signatures: ['Technicien', 'Exploitation'],
  }),
  f('/esg', 'esg', 'Relevé indicateur ESG', {
    instructions: 'Saisie terrain des consommations et incidents environnementaux.',
    handFields: [
      { label: 'Indicateur' }, { label: 'Période' }, { label: 'Valeur' }, { label: 'Unité' },
      { label: 'Commentaire', wide: true },
    ],
    signatures: ['Saisie', 'Responsable durabilité'],
  }),
  f('/security', 'securite', 'Fiche incident de sécurité', {
    instructions: 'Déclaration d\'incident à enregistrer au centre de sécurité.',
    handFields: [
      { label: 'Date et heure' }, { label: 'Lieu' }, { label: 'Déclarant' },
      { label: 'Description', wide: true }, { label: 'Mesure immédiate', wide: true },
    ],
    checks: ['Vol', 'Agression', 'Intrusion', 'Cyber', 'Accident', 'Autre'],
    signatures: ['Déclarant', 'Responsable sécurité'],
  }),
  f('/ai', 'ia', 'Signalement anomalie / prévision', {
    instructions: 'Consigner une alerte métier à croiser avec l\'IA.',
    handFields: [{ label: 'Module' }, { label: 'Date' }, { label: 'Description', wide: true }, { label: 'Action proposée', wide: true }],
    signatures: ['Analyste', 'Responsable métier'],
  }),
  f('/observability', 'supervision', 'Fiche incident supervision', {
    instructions: 'Indisponibilité d\'un service à tracer.',
    handFields: [{ label: 'Service' }, { label: 'Début' }, { label: 'Fin' }, { label: 'Impact', wide: true }],
    checks: ['API', 'Base', 'Caisse', 'Mobile', 'Réseau'],
    signatures: ['IT', 'Métier'],
  }),
  f('/integrations', 'integration', 'Demande d\'intégration / webhook', {
    instructions: 'Câblage d\'un partenaire ou d\'un canal.',
    handFields: [{ label: 'Partenaire' }, { label: 'URL / canal' }, { label: 'Événements', wide: true }, { label: 'Contact technique' }],
    signatures: ['Demandeur', 'IT'],
  }),
  f('/notifications', 'notif', 'Message / consigne interne', {
    instructions: 'Diffusion papier d\'une consigne d\'exploitation.',
    handFields: [{ label: 'Destinataires', wide: true }, { label: 'Objet' }, { label: 'Message', wide: true }, { label: 'Échéance' }],
    signatures: ['Émetteur', 'Accusé de réception'],
  }),
  f('/assistant', 'assistant', 'Demande à l\'assistant / consigne', {
    instructions: 'Question métier à traiter si l\'assistant est indisponible.',
    handFields: [{ label: 'Demandeur' }, { label: 'Module concerné' }, { label: 'Question', wide: true }, { label: 'Réponse / suite', wide: true }],
    signatures: ['Demandeur', 'Support'],
  }),
];

export function paperFormsForPath(pathname: string): PaperFormSpec[] {
  const path = pathname.replace(/\/$/, '') || '/app';
  const exact = PAPER_FORMS.filter((f) => f.path === path);
  if (exact.length) return exact;
  return PAPER_FORMS.filter((f) => path.startsWith(`${f.path}/`));
}

export function printPaperForm(spec: PaperFormSpec, asPdf = false): void {
  if (asPdf) setDocumentOutput('pdf');
  printDocument({
    kind: spec.title,
    reference: `FORM-${spec.id.toUpperCase()}`,
    subtitle: spec.subtitle,
    paper: true,
    lean: spec.lean,
    copiesPerPage: spec.copiesPerPage ?? 1,
    instructions: spec.lean ? undefined : spec.instructions,
    handFields: spec.handFields,
    handNotes: spec.handNotes,
    checks: spec.checks,
    kpis: spec.blankKpis?.map((label) => ({ label, value: ' ' })),
    blankTable: spec.blankTable,
    blankTables: spec.blankTables,
    notes: spec.notes,
    signatures: spec.signatures ?? ['Pour EMMANUEL SERVICES SARLU', 'Pour le destinataire'],
  });
}

export function printContractTemplatePaper(tpl: {
  code: string;
  name: string;
  title: string;
  body?: string;
  kind?: string | null;
  partyKind?: string | null;
}): void {
  printDocument({
    kind: tpl.title || tpl.name,
    reference: tpl.code,
    subtitle: 'Modèle vierge à remplir et signer',
    paper: true,
    copiesPerPage: 1,
    instructions: 'Compléter les mentions manuscrites, parapher chaque article, signer en deux exemplaires, puis archiver le scan dans EMMAPP.',
    handFields: [
      { label: 'Nom de l\'agent / partie' }, { label: 'Matricule / code' },
      { label: 'Poste' }, { label: 'Service' },
      { label: 'Date de début' }, { label: 'Date de fin' },
      { label: 'Montant / salaire' }, { label: 'Préavis (jours)' },
      { label: 'Téléphone' }, { label: 'N° pièce d\'identité' },
    ],
    checks: [tpl.partyKind ?? 'Agent', tpl.kind ?? 'Type', 'Lu et approuvé', 'Pièces jointes'],
    notes: (tpl.body ?? '').slice(0, 1200) || undefined,
    signatures: ['Pour EMMANUEL SERVICES SARLU', 'Pour le cocontractant'],
  });
}
