import { UserRole } from '@prisma/client';

export type AclAction = 'read' | 'create' | 'update' | 'delete' | 'validate';
export type AclResource = string;
export type AclMatrix = Record<string, AclAction[]>;

export const ACL_ACTIONS: { id: AclAction; label: string; short: string }[] = [
  { id: 'read', label: 'Consulter / menu', short: 'Lire' },
  { id: 'create', label: 'Créer', short: 'Créer' },
  { id: 'update', label: 'Modifier', short: 'Modif.' },
  { id: 'delete', label: 'Supprimer', short: 'Suppr.' },
  { id: 'validate', label: 'Valider / workflow', short: 'Valid.' },
];

export const ACL_RESOURCES: {
  id: string;
  label: string;
  section: string;
  path?: string;
  description: string;
}[] = [
  { id: 'dashboard', label: 'Tableau de bord', section: 'ANALYSE', path: '/app', description: 'KPIs et vue consolidée' },
  { id: 'observability', label: 'Supervision', section: 'ANALYSE', path: '/observability', description: 'Santé des services et lots' },
  { id: 'ai', label: 'IA prédictive', section: 'INTELLIGENCE', path: '/ai', description: 'Prévisions, scores, anomalies' },
  { id: 'assistant', label: 'Assistant', section: 'INTELLIGENCE', path: '/assistant', description: 'Assistant métier interne' },
  { id: 'clients', label: 'Clients', section: 'ANNUAIRES', path: '/clients', description: 'Fiches clients et segments' },
  { id: 'contracts', label: 'Contrats', section: 'CONTRATS', path: '/contracts', description: 'Contrats agents, fournisseurs et grands clients' },
  { id: 'portal', label: 'Comptes portail', section: 'ANNUAIRES', path: '/portal-accounts', description: 'Accès self-service clients' },
  { id: 'orders', label: 'Commandes', section: 'COMMANDES', path: '/orders', description: 'Saisie et historique des commandes' },
  { id: 'products', label: 'Catalogue produits', section: 'COMMANDES', path: '/products', description: 'Bidons, bonbonnes, prix' },
  { id: 'pricing', label: 'Tarifs et bonus', section: 'COMMANDES', path: '/pricing', description: 'Règles tarifaires' },
  { id: 'pos', label: 'Point de vente', section: 'COMMANDES', path: '/pos', description: 'Caisse et ventes comptoir' },
  { id: 'stock', label: 'Stocks & achats', section: 'ACHATS', path: '/stock', description: 'Inventaire et emplacements' },
  { id: 'packaging', label: 'Emballages', section: 'ACHATS', path: '/packaging', description: 'Bidons vides, étiquettes, bouchons' },
  { id: 'production', label: 'Fabrication / OF', section: 'FABRICATION', path: '/production', description: 'Ordres de fabrication et lots' },
  { id: 'quality', label: 'Contrôle qualité', section: 'FABRICATION', path: '/quality', description: 'Analyses et libération de lots' },
  { id: 'tours', label: 'Tournées', section: 'LIVRAISON', path: '/tours', description: 'Planification des tournées' },
  { id: 'vehicles', label: 'Véhicules', section: 'LIVRAISON', path: '/vehicles', description: 'Parc de livraison' },
  { id: 'routing', label: 'Itinéraires', section: 'LIVRAISON', path: '/routing', description: 'Optimisation d’itinéraires' },
  { id: 'deliveries', label: 'Livraisons', section: 'LIVRAISON', path: '/deliveries', description: 'Preuves de livraison' },
  { id: 'iot', label: 'Capteurs & télémétrie', section: 'OBJETS CONNECTÉS', path: '/iot', description: 'Capteurs ligne, véhicules, fontaines' },
  { id: 'payments', label: 'Factures & paiements', section: 'FACTURES', path: '/payments', description: 'Encaissements' },
  { id: 'finance', label: 'Comptabilité', section: 'FACTURES', path: '/finance', description: 'Caisse, banque, dépenses, inventaire et budget' },
  { id: 'ecarts', label: 'Écarts et clôtures', section: 'FACTURES', path: '/ecarts', description: 'Écarts de caisse, de tournée et de vidange' },
  { id: 'recouvrement', label: 'Recouvrement', section: 'FACTURES', path: '/recouvrement', description: 'Dettes en argent et en vidange, avances et relances' },
  { id: 'loyalty', label: 'Fidélité', section: 'COMMERCE', path: '/loyalty', description: 'Points, paliers, wallet' },
  { id: 'consignes', label: 'Consignes circulaires', section: 'COMMERCE', path: '/consignes', description: 'Emballages consignés et fontaines' },
  { id: 'marketplace', label: 'Marketplace B2B', section: 'COMMERCE', path: '/marketplace', description: 'Demandes de cotation' },
  { id: 'esg', label: 'Durabilité / ESG', section: 'DURABILITÉ', path: '/esg', description: 'Indicateurs environnementaux' },
  { id: 'hr', label: 'Administration RH', section: 'PERSONNEL', path: '/hr', description: 'Dossiers, congés, formations' },
  { id: 'objectives', label: 'Objectifs agents', section: 'PERSONNEL', path: '/objectives', description: 'Objectifs de performance des activités des agents' },
  { id: 'activity', label: 'Rapports d’activité', section: 'PERSONNEL', path: '/activity', description: 'Déclarations et rapports, limités à la fonction et au département du profil' },
  { id: 'payroll', label: 'Paie des agents', section: 'PERSONNEL', path: '/payroll', description: 'Périodes et bulletins' },
  { id: 'users', label: 'Utilisateurs', section: 'PERSONNEL', path: '/users', description: 'Comptes et rôles' },
  { id: 'authorizations', label: 'Habilitations', section: 'SÉCURITÉ', path: '/authorizations', description: 'Paramétrage des droits par profil' },
  { id: 'security', label: 'Centre de sécurité', section: 'SÉCURITÉ', path: '/security', description: 'MFA, alertes, audit' },
  { id: 'integrations', label: 'API & webhooks', section: 'PARAMÉTRAGE', path: '/integrations', description: 'Clés API et webhooks' },
  { id: 'notifications', label: 'Notifications', section: 'PARAMÉTRAGE', path: '/notifications', description: 'Alertes métier' },
];

const R: AclAction[] = ['read'];
const RC: AclAction[] = ['read', 'create'];
const RU: AclAction[] = ['read', 'update'];
const RCU: AclAction[] = ['read', 'create', 'update'];
const RUV: AclAction[] = ['read', 'update', 'validate'];
const RCUV: AclAction[] = ['read', 'create', 'update', 'validate'];
const FULL: AclAction[] = ['read', 'create', 'update', 'delete', 'validate'];

const ALL_RESOURCES = ACL_RESOURCES.map((r) => r.id);
const NONE: AclAction[] = [];

export type ActivityScope = '*' | string[];

export interface RoleActivityLimit {
  functions: ActivityScope;
  departments: ActivityScope;
  declare: boolean;
  team: boolean;
  summary: string;
}

export const ROLE_ACTIVITY_LIMITS: Record<string, RoleActivityLimit> = {
  ADMIN: {
    functions: '*',
    departments: '*',
    declare: true,
    team: true,
    summary: 'Toutes les fonctions et tous les départements. Déclaration et validation sans limite.',
  },
  RH: {
    functions: '*',
    departments: '*',
    declare: true,
    team: true,
    summary: 'Administration RH : toutes les activités, déclaration et validation de l’ensemble du personnel.',
  },
  DG: {
    functions: '*',
    departments: '*',
    declare: false,
    team: true,
    summary: 'Pilotage : lecture et validation de toutes les activités. Pas de déclaration terrain.',
  },
  SUPERVISEUR: {
    functions: '*',
    departments: '*',
    declare: true,
    team: true,
    summary: 'Supervision transversale : déclaration propre et validation de toutes les équipes.',
  },
  CHEF_PRODUCTION: {
    functions: ['Chef production', 'Opérateur production'],
    departments: ['Production'],
    declare: true,
    team: true,
    summary: 'Activités de production. Validation de l’équipe Production.',
  },
  CHEF_EXPLOITATION: {
    functions: ['Chef exploitation', 'Chargé exploitation', 'Livreur', 'Magasinier', 'Agent chargeur', 'Chargé livraison'],
    departments: ['Exploitation'],
    declare: true,
    team: true,
    summary: 'Activités d’exploitation (tournées, stock, chargement). Validation de l’équipe Exploitation.',
  },
  CHARGE_EXPLOITATION: {
    functions: ['Chargé exploitation'],
    departments: ['Exploitation'],
    declare: true,
    team: false,
    summary: 'Déclaration limitée à la fonction Chargé exploitation. Pas de validation d’équipe.',
  },
  RESP_QUALITE: {
    functions: ['Qualité'],
    departments: ['Qualité'],
    declare: true,
    team: true,
    summary: 'Activités de contrôle qualité. Validation de l’équipe Qualité.',
  },
  MAGASINIER: {
    functions: ['Magasinier'],
    departments: ['Exploitation'],
    declare: true,
    team: false,
    summary: 'Déclaration limitée au magasin : réception, inventaire, chargement.',
  },
  AGENT_CHARGEUR: {
    functions: ['Agent chargeur'],
    departments: ['Exploitation'],
    declare: true,
    team: false,
    summary: 'Déclaration limitée aux activités de chargement.',
  },
  LIVREUR: {
    functions: ['Livreur'],
    departments: ['Exploitation'],
    declare: true,
    team: false,
    summary: 'Déclaration limitée aux tournées, livraisons, encaissements et consignes.',
  },
  CHARGE_LIVRAISON: {
    functions: ['Chargé livraison', 'Livreur'],
    departments: ['Exploitation'],
    declare: true,
    team: true,
    summary: 'Activités livreur et chargé livraison. Validation des livreurs de l’équipe Exploitation.',
  },
  COMMERCIAL: {
    functions: ['Commercial'],
    departments: ['Commercial'],
    declare: true,
    team: false,
    summary: 'Déclaration limitée à la prospection, aux commandes et au suivi client.',
  },
  DELEGUE_COMMERCIAL: {
    functions: ['Délégué commercial'],
    departments: ['Commercial'],
    declare: true,
    team: false,
    summary: 'Déclaration limitée aux activités de délégué commercial.',
  },
  CAISSIER: {
    functions: ['Caissier'],
    departments: ['Finance'],
    declare: true,
    team: false,
    summary: 'Déclaration limitée aux encaissements caisse et à la clôture de journée.',
  },
  COMPTABLE: {
    functions: ['Comptable'],
    departments: ['Finance'],
    declare: true,
    team: true,
    summary: 'Activités comptables. Validation des déclarations du service Finance.',
  },
  IT_GED: {
    functions: [],
    departments: ['IT'],
    declare: false,
    team: false,
    summary: 'Aucune activité opérationnelle. Pas de déclaration ni de validation d’équipe.',
  },
  DATA_ANALYST: {
    functions: [],
    departments: ['Direction'],
    declare: false,
    team: false,
    summary: 'Aucune activité opérationnelle. Lecture des indicateurs hors module Rapports d’activité.',
  },
  RESP_SECURITE: {
    functions: ['Sécurité'],
    departments: ['IT'],
    declare: true,
    team: false,
    summary: 'Déclaration limitée aux rondes, contrôles d’accès et incidents de sécurité.',
  },
  RESP_DURABILITE: {
    functions: ['Durabilité'],
    departments: ['Production'],
    declare: true,
    team: false,
    summary: 'Déclaration limitée aux indicateurs ESG et au suivi environnemental.',
  },
};

const FALLBACK_ACTIVITY_LIMIT: RoleActivityLimit = {
  functions: [],
  departments: [],
  declare: false,
  team: false,
  summary: 'Aucune activité métier autorisée pour ce profil.',
};

export function activityLimitFor(role: string): RoleActivityLimit {
  return ROLE_ACTIVITY_LIMITS[role] ?? FALLBACK_ACTIVITY_LIMIT;
}

export function matchesActivityScope(scope: ActivityScope, value?: string | null): boolean {
  if (scope === '*') return true;
  if (!value || !scope.length) return false;
  const needle = value.trim().toLowerCase();
  return scope.some((item) => item.trim().toLowerCase() === needle);
}

export function isActivityAdmin(role: string): boolean {
  return role === 'ADMIN' || role === 'RH';
}

export function canDeclareActivity(role: string): boolean {
  return activityLimitFor(role).declare;
}

export function canSuperviseActivities(role: string): boolean {
  return isActivityAdmin(role) || activityLimitFor(role).team;
}

export function profileInActivityTeam(
  actorRole: string,
  actorId: string,
  target: {
    userId: string;
    department?: string | null;
    managerId?: string | null;
    jobFunctionName?: string | null;
  },
): boolean {
  if (target.userId === actorId) return true;
  if (isActivityAdmin(actorRole)) return true;
  const limit = activityLimitFor(actorRole);
  if (!limit.team) return false;
  if (target.managerId === actorId) return true;
  if (matchesActivityScope(limit.departments, target.department)) return true;
  if (limit.functions !== '*' && matchesActivityScope(limit.functions, target.jobFunctionName)) return true;
  return false;
}

export function activityManagerRoles(): UserRole[] {
  return allRoles().filter((role) => canSuperviseActivities(role));
}

function sameActions(a: AclAction[], b: AclAction[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((item, i) => item === right[i]);
}

/** Anciens défauts withActivity() — utilisés pour migrer sans écraser une matrice personnalisée. */
export function isLegacyActivityDefault(role: string, stored: AclAction[]): boolean {
  const legacy: AclAction[] =
    role === 'ADMIN' || role === 'RH'
      ? FULL
      : ['DG', 'CHEF_PRODUCTION', 'CHEF_EXPLOITATION', 'COMPTABLE', 'SUPERVISEUR'].includes(role)
        ? RCUV
        : RC;
  return sameActions(stored, legacy);
}

export const DEFAULT_ROLE_PERMISSIONS: Record<string, AclMatrix> = {
  ADMIN: Object.fromEntries(ALL_RESOURCES.map((id) => [id, FULL])),
  DG: {
    dashboard: R, clients: R, orders: R, products: R, tours: R, stock: R, deliveries: R,
    payments: R, finance: RUV, ecarts: R, recouvrement: R, production: R, quality: R, loyalty: R, consignes: R, hr: R, payroll: R,
    observability: R, users: R, notifications: R, authorizations: R, contracts: RUV,
    ai: R, assistant: RC, iot: R, routing: R, esg: R, security: R, portal: R, marketplace: R, pricing: R, packaging: R, vehicles: R, objectives: R, pos: R,
    activity: RUV,
  },
  CHEF_PRODUCTION: {
    dashboard: R, production: FULL, quality: R, stock: FULL, packaging: FULL, products: RCU, observability: R, notifications: R,
    ai: R, assistant: RC, iot: RU, hr: RUV, contracts: R, objectives: RUV,
    activity: RCUV,
  },
  CHEF_EXPLOITATION: {
    dashboard: R, orders: FULL, tours: FULL, deliveries: RUV, stock: R, packaging: R, vehicles: FULL, clients: R, notifications: R,
    ai: R, assistant: RC, routing: RCUV, iot: R, esg: R, hr: RUV, contracts: R, objectives: RCUV, pos: R, finance: R, ecarts: RCUV,
    activity: RCUV,
  },
  CHARGE_EXPLOITATION: {
    dashboard: R, orders: R, tours: RU, deliveries: R, stock: R, vehicles: R, notifications: R,
    assistant: RC, routing: R, iot: R, hr: R, objectives: R,
    activity: RC,
  },
  RESP_QUALITE: {
    dashboard: R, quality: RCUV, production: R, consignes: R, observability: R, notifications: R,
    ai: R, assistant: RC, iot: RU,
    activity: RCUV,
  },
  MAGASINIER: {
    dashboard: R, stock: FULL, packaging: FULL, vehicles: FULL, tours: RC, consignes: FULL, products: R, notifications: R,
    assistant: RC, hr: R, contracts: RCU, finance: RCU,
    activity: RC,
  },
  AGENT_CHARGEUR: {
    dashboard: R, tours: RU, stock: R, deliveries: R, notifications: R,
    assistant: RC, hr: R,
    activity: RC,
  },
  LIVREUR: {
    dashboard: R, deliveries: RCUV, payments: RC, orders: R, clients: R, notifications: R,
    assistant: RC, routing: R, hr: R, objectives: R,
    activity: RC,
  },
  CHARGE_LIVRAISON: {
    dashboard: R, deliveries: RCUV, payments: RC, orders: R, clients: R, notifications: R,
    assistant: RC, routing: R, hr: R, objectives: R,
    activity: RCUV,
  },
  COMMERCIAL: {
    dashboard: R, clients: FULL, orders: FULL, loyalty: RCU, products: R, payments: RCU, notifications: R,
    ai: R, assistant: RC, portal: RCU, marketplace: RCUV, pricing: FULL, hr: R, contracts: RCUV, objectives: RCU, pos: FULL, finance: R,
    consignes: RCU, recouvrement: RCU,
    activity: RC,
  },
  DELEGUE_COMMERCIAL: {
    dashboard: R, clients: RC, orders: RC, loyalty: R, products: R, notifications: R,
    assistant: RC, marketplace: RC, pricing: R, hr: R, contracts: R, objectives: R, pos: R,
    activity: RC,
  },
  CAISSIER: {
    dashboard: R, payments: FULL, clients: R, orders: R, notifications: R,
    assistant: RC, hr: R, pos: FULL, finance: RCU, ecarts: RC, recouvrement: RC,
    activity: RC,
  },
  COMPTABLE: {
    payments: RCU, finance: FULL, ecarts: FULL, recouvrement: RCUV, clients: R, orders: R, dashboard: R, notifications: R,
    ai: R, assistant: RC, payroll: RCUV, hr: R, contracts: RCUV, pos: R,
    activity: RCUV,
  },
  RH: {
    dashboard: R, hr: FULL, payroll: FULL, users: FULL, notifications: R, authorizations: RCU,
    assistant: RC, contracts: FULL, objectives: FULL,
    activity: FULL,
  },
  SUPERVISEUR: {
    dashboard: R, tours: R, vehicles: R, observability: R, users: R, deliveries: R, notifications: R,
    ai: R, assistant: RC, iot: R, routing: R, esg: R, security: R, hr: RUV, contracts: R, objectives: RCUV,
    activity: RCUV,
  },
  IT_GED: {
    observability: R, users: R, notifications: R, dashboard: R, authorizations: R,
    assistant: RC, iot: RCU, integrations: FULL, security: R, contracts: R,
    activity: NONE,
  },
  DATA_ANALYST: {
    dashboard: R, notifications: R, observability: R, assistant: RC,
    ai: RCUV, esg: R, iot: R, routing: R, clients: R, orders: R, products: R,
    payments: R, finance: R, production: R, quality: R, stock: R, packaging: R, vehicles: R, deliveries: R, tours: R, loyalty: R, contracts: R,
    activity: NONE,
  },
  RESP_SECURITE: {
    dashboard: R, notifications: R, observability: R, assistant: RC, authorizations: RCU,
    security: RCUV, users: R, integrations: R, ai: R,
    activity: RC,
  },
  RESP_DURABILITE: {
    dashboard: R, notifications: R, assistant: RC,
    esg: RCUV, routing: R, iot: R, tours: R, vehicles: R, consignes: R, production: R, packaging: R, ai: R,
    activity: RC,
  },
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  DG: 'Direction générale',
  CHEF_PRODUCTION: 'Chef production',
  CHEF_EXPLOITATION: 'Chef exploitation',
  CHARGE_EXPLOITATION: 'Chargé exploitation',
  RESP_QUALITE: 'Responsable qualité',
  MAGASINIER: 'Magasinier',
  AGENT_CHARGEUR: 'Agent chargeur',
  LIVREUR: 'Livreur',
  CHARGE_LIVRAISON: 'Chargé livraison',
  COMMERCIAL: 'Commercial',
  DELEGUE_COMMERCIAL: 'Délégué commercial',
  CAISSIER: 'Caissier',
  COMPTABLE: 'Comptable',
  RH: 'Ressources humaines',
  SUPERVISEUR: 'Superviseur',
  IT_GED: 'IT / GED',
  DATA_ANALYST: 'Analyste de données',
  RESP_SECURITE: 'Responsable sécurité',
  RESP_DURABILITE: 'Responsable durabilité',
};

export const LOCKED_ADMIN_RESOURCES = ['authorizations'] as const;

export function defaultMatrixFor(role: string): AclMatrix {
  if (role === 'ADMIN') return DEFAULT_ROLE_PERMISSIONS.ADMIN;
  return DEFAULT_ROLE_PERMISSIONS[role] ?? {};
}

export function allRoles(): UserRole[] {
  return Object.values(UserRole);
}

export function sanitizeRoleMatrix(role: string, matrix: AclMatrix): AclMatrix {
  const next: AclMatrix = {};
  const defaults = defaultMatrixFor(role);
  for (const resource of ALL_RESOURCES) {
    const raw = matrix[resource] ?? defaults[resource] ?? [];
    const actions = ACL_ACTIONS.map((a) => a.id).filter((a) => raw.includes(a));
    if (actions.includes('create') || actions.includes('update') || actions.includes('delete') || actions.includes('validate')) {
      if (!actions.includes('read')) actions.unshift('read');
    }
    next[resource] = actions;
  }
  if (role === 'ADMIN') {
    for (const locked of LOCKED_ADMIN_RESOURCES) {
      next[locked] = [...FULL];
    }
  }
  return next;
}

const PATH_MAP: Array<[string, string]> = [
  ['/authorizations', 'authorizations'],
  ['/contracts', 'contracts'],
  ['/pos', 'pos'],
  ['/pricing-rules', 'pricing'],
  ['/emmapure/production', 'production'],
  ['/emmapure/quality', 'quality'],
  ['/emmapure/loyalty', 'loyalty'],
  ['/emmapure/packaging', 'consignes'],
  ['/emmapure/fountains', 'consignes'],
  ['/emmapure/shifts', 'hr'],
  ['/emmapure/observability', 'observability'],
  ['/hr/payroll', 'payroll'],
  ['/objectives', 'objectives'],
  ['/activity-objectives', 'objectives'],
  ['/hr/declarations', 'activity'],
  ['/hr/functions/my-activities', 'activity'],
  ['/hr/activity-reports', 'activity'],
  ['/hr', 'hr'],
  ['/portal', 'portal'],
  ['/marketplace', 'marketplace'],
  ['/integrations', 'integrations'],
  ['/notifications', 'notifications'],
  ['/dashboard', 'dashboard'],
  ['/clients', 'clients'],
  ['/orders', 'orders'],
  ['/products', 'products'],
  ['/tours', 'tours'],
  ['/vehicles', 'vehicles'],
  ['/stock', 'stock'],
  ['/packaging', 'packaging'],
  ['/deliveries', 'deliveries'],
  ['/payments', 'payments'],
  ['/finance', 'finance'],
  ['/consignes', 'consignes'],
  ['/ecarts', 'ecarts'],
  ['/recouvrement', 'recouvrement'],
  ['/users', 'users'],
  ['/ai', 'ai'],
  ['/assistant', 'assistant'],
  ['/iot', 'iot'],
  ['/routing', 'routing'],
  ['/esg', 'esg'],
  ['/security', 'security'],
];

export function mapRequestToAcl(method: string, url: string): { resource: string; action: AclAction } | null {
  const path = (url.split('?')[0] || '').replace(/^\/api\/v1/, '');
  const resource = PATH_MAP.find(([prefix]) => path.startsWith(prefix))?.[1];
  if (!resource) return null;
  const verb = method.toUpperCase();
  // Le mot-cle doit occuper un segment entier : sans cette borne, « /payments »
  // et « /payroll » contiennent « /pay » et basculaient en action « valider »,
  // si bien qu'un droit de creation accorde dans les habilitations etait refuse.
  const workflow = /\/(validate|start|complete|cancel|reject|convert|pay|close|compute|enroll|follow)(\/|$)/
    .test(path);
  let action: AclAction = 'read';
  if (verb === 'GET') action = 'read';
  else if (verb === 'DELETE') action = 'delete';
  else if (workflow) action = 'validate';
  else if (verb === 'POST') action = 'create';
  else if (verb === 'PATCH' || verb === 'PUT') action = 'update';
  return { resource, action };
}
