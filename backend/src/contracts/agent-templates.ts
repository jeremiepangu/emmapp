import { BusinessContractKind, ContractPartyKind } from '@prisma/client';
import { defaultContractTemplateBody } from './word-generator';

export interface AgentJobSpec {
  role: string;
  label: string;
  department: string;
  missions: string[];
  kinds: BusinessContractKind[];
}

export const AGENT_JOBS: AgentJobSpec[] = [
  {
    role: 'LIVREUR',
    label: 'Livreur',
    department: 'Exploitation',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.JOURNALIER],
    missions: [
      'Effectuer les tournées de livraison d\'eau potable selon le planning, remettre les produits au client, faire signer le bon de livraison et encaisser selon les consignes de caisse.',
      'Suivre les emballages consignés (sorties, retours, manquants), signaler toute avarie, réclamation ou incident de parcours, et restituer le véhicule, le terminal et les fonds en fin de tournée.',
    ],
  },
  {
    role: 'CHARGE_LIVRAISON',
    label: 'Chargé de livraison',
    department: 'Exploitation',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.JOURNALIER],
    missions: [
      'Coordonner les livreurs, valider les bons de livraison, traiter les écarts de caisse et de consignes, et assurer le reporting quotidien au chef d\'exploitation.',
      'Superviser le respect des créneaux, la qualité de service client et la restitution des fonds, véhicules et terminaux.',
    ],
  },
  {
    role: 'AGENT_CHARGEUR',
    label: 'Agent chargeur',
    department: 'Exploitation',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.JOURNALIER],
    missions: [
      'Charger et décharger les véhicules selon les bons de tournée, respecter les règles de gerbage, d\'hygiène et de sécurité, et pointer les quantités sorties du dépôt.',
      'Isoler tout lot non conforme, signaler les casses et participer à l\'inventaire des emballages.',
    ],
  },
  {
    role: 'MAGASINIER',
    label: 'Magasinier',
    department: 'Logistique',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.JOURNALIER],
    missions: [
      'Tenir les stocks produits, emballages et consommables, enregistrer les mouvements, préparer les commandes et les tournées, et alerter en cas de seuil critique.',
      'Réceptionner les fournisseurs, contrôler les lots, appliquer la FIFO et garantir la traçabilité des bonbonnes consignées.',
    ],
  },
  {
    role: 'COMMERCIAL',
    label: 'Commercial',
    department: 'Commercial',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.STAGE, BusinessContractKind.PRESTATION],
    missions: [
      'Prospection, ouverture et suivi du portefeuille clients, prise de commandes, négociation des tarifs dans le cadre des barèmes, et relance des impayés.',
      'Respecter les objectifs de volume et de couverture de zone, reporter l\'activité et proposer les contrats de distribution ou de consignation.',
    ],
  },
  {
    role: 'DELEGUE_COMMERCIAL',
    label: 'Délégué commercial',
    department: 'Commercial',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.STAGE],
    missions: [
      'Visiter les détaillants et boutiques de la zone assignée, prendre les commandes, animer le point de vente et collecter les informations marché.',
      'Transmettre quotidiennement le reporting au commercial responsable et respecter les prix et bonus autorisés.',
    ],
  },
  {
    role: 'CAISSIER',
    label: 'Caissier / caissière',
    department: 'Finance',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.JOURNALIER],
    missions: [
      'Encaisser les ventes POS et les tournées, émettre les reçus, clôturer la caisse, et verser les fonds selon la procédure de trésorerie.',
      'Pointer les écarts, refuser tout paiement non autorisé et conserver la confidentialité des encaissements.',
    ],
  },
  {
    role: 'COMPTABLE',
    label: 'Comptable',
    department: 'Finance',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.STAGE],
    missions: [
      'Tenir la comptabilité générale et auxiliaire, lettrer les paiements, préparer les déclarations et les états financiers, et contrôler les justificatifs.',
      'Assurer la piste d\'audit des factures, paie et stocks, et alerter la direction en cas d\'anomalie.',
    ],
  },
  {
    role: 'CHEF_EXPLOITATION',
    label: 'Chef d\'exploitation',
    department: 'Exploitation',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD],
    missions: [
      'Piloter les tournées, le parc véhicules, les livraisons et les équipes terrain. Arbitrer les priorités de distribution et les incidents clients.',
      'Fixer et suivre les objectifs d\'activité, garantir la sécurité des tournées et reporter à la direction générale.',
    ],
  },
  {
    role: 'CHARGE_EXPLOITATION',
    label: 'Chargé d\'exploitation',
    department: 'Exploitation',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD],
    missions: [
      'Préparer les tournées, affecter les véhicules et les livreurs, suivre l\'exécution en temps réel et traiter les imprévus de parcours.',
      'Mettre à jour les plannings et transmettre les écarts au chef d\'exploitation.',
    ],
  },
  {
    role: 'CHEF_PRODUCTION',
    label: 'Chef de production',
    department: 'Production',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD],
    missions: [
      'Planifier et piloter les ordres de fabrication, les rendements, les arrêts machine et les stocks d\'eau traitée et d\'emballages.',
      'Garantir le respect des protocoles qualité et la sécurité du personnel d\'usine.',
    ],
  },
  {
    role: 'RESP_QUALITE',
    label: 'Responsable qualité',
    department: 'Qualité',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.STAGE],
    missions: [
      'Organiser les contrôles physico-chimiques et microbiologiques, libérer ou bloquer les lots, et tenir les enregistrements HACCP.',
      'Former le personnel aux consignes d\'hygiène et traiter les non-conformités jusqu\'à clôture.',
    ],
  },
  {
    role: 'RH',
    label: 'Chargé(e) des ressources humaines',
    department: 'Ressources humaines',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.STAGE],
    missions: [
      'Gérer le personnel, les contrats, la paie, les congés, les formations et le dossier social de chaque agent.',
      'Veiller à la conformité au Code du travail, aux affiliations CNSS et à la confidentialité des données RH.',
    ],
  },
  {
    role: 'SUPERVISEUR',
    label: 'Superviseur',
    department: 'Direction',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD],
    missions: [
      'Contrôler l\'exécution des procédures sur le terrain, auditer les tournées et les dépôts, et remonter les écarts à la direction.',
      'Accompagner les chefs d\'équipe et veiller au respect des objectifs et des règles de sécurité.',
    ],
  },
  {
    role: 'IT_GED',
    label: 'IT / GED',
    department: 'Systèmes',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.STAGE, BusinessContractKind.PRESTATION],
    missions: [
      'Administrer le système d\'information, les comptes, les sauvegardes, la GED et les intégrations API.',
      'Assurer le support interne, la sécurité des accès et la continuité de service des applications EMMAPP.',
    ],
  },
  {
    role: 'DATA_ANALYST',
    label: 'Analyste de données',
    department: 'Systèmes',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.STAGE, BusinessContractKind.PRESTATION],
    missions: [
      'Exploiter l\'entrepôt de données, produire les tableaux de bord, les prévisions et les analyses d\'anomalies.',
      'Documenter les modèles et garantir la qualité des indicateurs transmis à la direction.',
    ],
  },
  {
    role: 'RESP_SECURITE',
    label: 'Responsable sécurité',
    department: 'Sécurité',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.PRESTATION],
    missions: [
      'Piloter la sûreté des sites, des tournées et des accès informatiques, traiter les alertes et les incidents.',
      'Faire appliquer les consignes, les habilitations et les plans de continuité.',
    ],
  },
  {
    role: 'RESP_DURABILITE',
    label: 'Responsable durabilité',
    department: 'RSE',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.STAGE],
    missions: [
      'Suivre les indicateurs ESG (eau, énergie, emballages, social), produire les rapports de durabilité et animer les plans d\'action.',
      'Coordonner les actions de consigne circulaire et de réduction des pertes.',
    ],
  },
  {
    role: 'DG',
    label: 'Directeur / Directrice générale',
    department: 'Direction',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD],
    missions: [
      'Représenter la société, arrêter la stratégie, valider les engagements contractuels majeurs et piloter les responsables de service.',
      'Garantir la conformité légale, la pérennité financière et la qualité du service d\'eau potable.',
    ],
  },
  {
    role: 'ADMIN',
    label: 'Administrateur système ERP',
    department: 'Systèmes',
    kinds: [BusinessContractKind.CDI, BusinessContractKind.CDD, BusinessContractKind.PRESTATION],
    missions: [
      'Paramétrer l\'ERP, les habilitations, les sauvegardes et le support de dernier niveau.',
      'Assurer l\'intégrité des données et accompagner les métiers dans l\'usage du système.',
    ],
  },
];

export interface ContractTemplateSeed {
  code: string;
  name: string;
  partyKind: ContractPartyKind;
  kind: BusinessContractKind;
  title: string;
  body: string;
  clauses: string;
  footer: string;
}

function agentTitle(kind: BusinessContractKind, job: AgentJobSpec): string {
  const map: Record<string, string> = {
    CDI: `Contrat de travail à durée indéterminée — ${job.label}`,
    CDD: `Contrat de travail à durée déterminée — ${job.label}`,
    STAGE: `Convention de stage — ${job.label}`,
    JOURNALIER: `Contrat de travail journalier — ${job.label}`,
    PRESTATION: `Contrat de prestation de services — ${job.label}`,
  };
  return map[kind] ?? `Contrat — ${job.label}`;
}

function agentName(kind: BusinessContractKind, job: AgentJobSpec): string {
  const map: Record<string, string> = {
    CDI: `CDI ${job.label}`,
    CDD: `CDD ${job.label}`,
    STAGE: `Stage ${job.label}`,
    JOURNALIER: `Journalier ${job.label}`,
    PRESTATION: `Prestation ${job.label}`,
  };
  return map[kind] ?? job.label;
}

export function agentTemplateCode(role: string, kind: BusinessContractKind): string {
  return `MDL-AGENT-${role}-${kind}`;
}

export function buildAgentTemplateSeeds(): ContractTemplateSeed[] {
  const rows: ContractTemplateSeed[] = [];
  for (const job of AGENT_JOBS) {
    for (const kind of job.kinds) {
      rows.push({
        code: agentTemplateCode(job.role, kind),
        name: agentName(kind, job),
        partyKind: ContractPartyKind.AGENT,
        kind,
        title: agentTitle(kind, job),
        body: defaultContractTemplateBody('AGENT', {
          agentKind: kind,
          role: job.role,
          jobLabel: job.label,
          department: job.department,
          missions: job.missions,
        }),
        clauses: '{{clauses}}',
        footer: `Exemplaire à parapher et signer — dossier RH ${job.label} — {{reference}}`,
      });
    }
  }
  rows.push(
    {
      code: 'MDL-FRN-CADRE',
      name: 'Contrat cadre fournisseur',
      partyKind: ContractPartyKind.SUPPLIER,
      kind: BusinessContractKind.CADRE,
      title: 'Contrat cadre de fourniture',
      body: defaultContractTemplateBody('SUPPLIER'),
      clauses: '{{clauses}}',
      footer: 'Document destiné à la signature des parties — {{reference}}',
    },
    {
      code: 'MDL-FRN-FOURNITURE',
      name: 'Contrat de fourniture',
      partyKind: ContractPartyKind.SUPPLIER,
      kind: BusinessContractKind.FOURNITURE,
      title: 'Contrat de fourniture de biens',
      body: defaultContractTemplateBody('SUPPLIER'),
      clauses: '{{clauses}}',
      footer: 'Document destiné à la signature des parties — {{reference}}',
    },
    {
      code: 'MDL-FRN-PRESTATION',
      name: 'Prestation de service fournisseur',
      partyKind: ContractPartyKind.SUPPLIER,
      kind: BusinessContractKind.PRESTATION_SERVICE,
      title: 'Contrat de prestation de service',
      body: defaultContractTemplateBody('SUPPLIER'),
      clauses: '{{clauses}}',
      footer: 'Document destiné à la signature des parties — {{reference}}',
    },
    {
      code: 'MDL-CLIENT-DIST',
      name: 'Contrat de distribution grand client',
      partyKind: ContractPartyKind.KEY_CLIENT,
      kind: BusinessContractKind.DISTRIBUTION,
      title: 'Contrat de distribution d\'eau potable',
      body: defaultContractTemplateBody('KEY_CLIENT'),
      clauses: '{{clauses}}',
      footer: 'À parapher et signer en deux exemplaires — {{reference}}',
    },
    {
      code: 'MDL-CLIENT-CADRE',
      name: 'Contrat cadre grand client',
      partyKind: ContractPartyKind.KEY_CLIENT,
      kind: BusinessContractKind.CADRE,
      title: 'Contrat cadre de fourniture d\'eau potable',
      body: defaultContractTemplateBody('KEY_CLIENT'),
      clauses: '{{clauses}}',
      footer: 'À parapher et signer en deux exemplaires — {{reference}}',
    },
    {
      code: 'MDL-CLIENT-EXCL',
      name: 'Contrat d\'exclusivité grand client',
      partyKind: ContractPartyKind.KEY_CLIENT,
      kind: BusinessContractKind.EXCLUSIVITE,
      title: 'Contrat de distribution exclusive',
      body: defaultContractTemplateBody('KEY_CLIENT'),
      clauses: '{{clauses}}',
      footer: 'À parapher et signer en deux exemplaires — {{reference}}',
    },
    {
      code: 'MDL-CLIENT-CONS',
      name: 'Contrat de consignation grand client',
      partyKind: ContractPartyKind.KEY_CLIENT,
      kind: BusinessContractKind.CONSIGNATION,
      title: 'Contrat de consignation d\'emballages',
      body: defaultContractTemplateBody('KEY_CLIENT'),
      clauses: '{{clauses}}',
      footer: 'À parapher et signer en deux exemplaires — {{reference}}',
    },
  );
  return rows;
}

export function findAgentJob(role?: string | null): AgentJobSpec | undefined {
  if (!role) return undefined;
  return AGENT_JOBS.find((j) => j.role === role);
}
