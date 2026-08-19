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
  { id: 'portal', label: 'Comptes portail', section: 'ANNUAIRES', path: '/portal-accounts', description: 'Accès self-service clients' },
  { id: 'orders', label: 'Commandes', section: 'COMMANDES', path: '/orders', description: 'Saisie et historique des commandes' },
  { id: 'products', label: 'Catalogue produits', section: 'COMMANDES', path: '/products', description: 'Bidons, bonbonnes, prix' },
  { id: 'pricing', label: 'Tarifs et remises', section: 'COMMANDES', path: '/pricing', description: 'Règles tarifaires' },
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
  { id: 'loyalty', label: 'Fidélité', section: 'COMMERCE', path: '/loyalty', description: 'Points, paliers, wallet' },
  { id: 'consignes', label: 'Consignes circulaires', section: 'COMMERCE', path: '/consignes', description: 'Emballages consignés et fontaines' },
  { id: 'marketplace', label: 'Marketplace B2B', section: 'COMMERCE', path: '/marketplace', description: 'Demandes de cotation' },
  { id: 'esg', label: 'Durabilité / ESG', section: 'DURABILITÉ', path: '/esg', description: 'Indicateurs environnementaux' },
  { id: 'hr', label: 'Administration RH', section: 'PERSONNEL', path: '/hr', description: 'Dossiers, congés, formations' },
  { id: 'activity', label: 'Rapports d’activité', section: 'PERSONNEL', path: '/activity', description: 'Déclarations quotidiennes' },
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

function withActivity(matrix: AclMatrix, activity: AclAction[]): AclMatrix {
  return { ...matrix, activity };
}

export const DEFAULT_ROLE_PERMISSIONS: Record<string, AclMatrix> = {
  ADMIN: Object.fromEntries(ALL_RESOURCES.map((id) => [id, FULL])),
  DG: withActivity({
    dashboard: R, clients: R, orders: R, products: R, tours: R, stock: R, deliveries: R,
    payments: R, production: R, quality: R, loyalty: R, consignes: R, hr: R, payroll: R,
    observability: R, users: R, notifications: R, authorizations: R,
    ai: R, assistant: RC, iot: R, routing: R, esg: R, security: R, portal: R, marketplace: R, pricing: R, packaging: R, vehicles: R,
  }, RCUV),
  CHEF_PRODUCTION: withActivity({
    dashboard: R, production: FULL, quality: R, stock: FULL, packaging: FULL, products: RCU, observability: R, notifications: R,
    ai: R, assistant: RC, iot: RU, hr: RUV,
  }, RCUV),
  CHEF_EXPLOITATION: withActivity({
    dashboard: R, orders: FULL, tours: FULL, deliveries: RUV, stock: R, packaging: R, vehicles: FULL, clients: R, notifications: R,
    ai: R, assistant: RC, routing: RCUV, iot: R, esg: R, hr: RUV,
  }, RCUV),
  CHARGE_EXPLOITATION: withActivity({
    dashboard: R, orders: R, tours: RU, deliveries: R, stock: R, vehicles: R, notifications: R,
    assistant: RC, routing: R, iot: R, hr: R,
  }, RC),
  RESP_QUALITE: withActivity({
    dashboard: R, quality: RCUV, production: R, consignes: R, observability: R, notifications: R,
    ai: R, assistant: RC, iot: RU,
  }, RC),
  MAGASINIER: withActivity({
    dashboard: R, stock: FULL, packaging: FULL, vehicles: FULL, tours: RC, consignes: FULL, products: R, notifications: R,
    assistant: RC, hr: R,
  }, RC),
  AGENT_CHARGEUR: withActivity({
    dashboard: R, tours: RU, stock: R, deliveries: R, notifications: R,
    assistant: RC, hr: R,
  }, RC),
  LIVREUR: withActivity({
    dashboard: R, deliveries: RCUV, payments: RC, orders: R, clients: R, notifications: R,
    assistant: RC, routing: R, hr: R,
  }, RC),
  CHARGE_LIVRAISON: withActivity({
    dashboard: R, deliveries: RCUV, payments: RC, orders: R, clients: R, notifications: R,
    assistant: RC, routing: R, hr: R,
  }, RC),
  COMMERCIAL: withActivity({
    dashboard: R, clients: FULL, orders: FULL, loyalty: RCU, products: R, payments: RCU, notifications: R,
    ai: R, assistant: RC, portal: RCU, marketplace: RCUV, pricing: FULL, hr: R,
  }, RC),
  DELEGUE_COMMERCIAL: withActivity({
    dashboard: R, clients: RC, orders: RC, loyalty: R, products: R, notifications: R,
    assistant: RC, marketplace: RC, pricing: R, hr: R,
  }, RC),
  CAISSIER: withActivity({
    dashboard: R, payments: FULL, clients: R, orders: R, notifications: R,
    assistant: RC, hr: R,
  }, RC),
  COMPTABLE: withActivity({
    payments: RCU, clients: R, orders: R, dashboard: R, notifications: R,
    ai: R, assistant: RC, payroll: RCUV, hr: R,
  }, RCUV),
  RH: withActivity({
    dashboard: R, hr: FULL, payroll: FULL, users: FULL, notifications: R, authorizations: RCU,
    assistant: RC,
  }, FULL),
  SUPERVISEUR: withActivity({
    dashboard: R, tours: R, vehicles: R, observability: R, users: R, deliveries: R, notifications: R,
    ai: R, assistant: RC, iot: R, routing: R, esg: R, security: R, hr: RUV,
  }, RCUV),
  IT_GED: withActivity({
    observability: R, users: R, notifications: R, dashboard: R, authorizations: R,
    assistant: RC, iot: RCU, integrations: FULL, security: R,
  }, RC),
  DATA_ANALYST: withActivity({
    dashboard: R, notifications: R, observability: R, assistant: RC,
    ai: RCUV, esg: R, iot: R, routing: R, clients: R, orders: R, products: R,
    payments: R, production: R, quality: R, stock: R, packaging: R, vehicles: R, deliveries: R, tours: R, loyalty: R,
  }, RC),
  RESP_SECURITE: withActivity({
    dashboard: R, notifications: R, observability: R, assistant: RC, authorizations: RCU,
    security: RCUV, users: R, integrations: R, ai: R,
  }, RC),
  RESP_DURABILITE: withActivity({
    dashboard: R, notifications: R, assistant: RC,
    esg: RCUV, routing: R, iot: R, tours: R, vehicles: R, consignes: R, production: R, packaging: R, ai: R,
  }, RC),
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
  for (const resource of ALL_RESOURCES) {
    const raw = matrix[resource] ?? [];
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
  ['/pricing-rules', 'pricing'],
  ['/emmapure/production', 'production'],
  ['/emmapure/quality', 'quality'],
  ['/emmapure/loyalty', 'loyalty'],
  ['/emmapure/packaging', 'consignes'],
  ['/emmapure/fountains', 'consignes'],
  ['/emmapure/shifts', 'hr'],
  ['/emmapure/observability', 'observability'],
  ['/hr/payroll', 'payroll'],
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
  ['/consignes', 'consignes'],
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
  const workflow = /\/(validate|start|complete|cancel|reject|convert|pay|close|compute|enroll|follow)/.test(path);
  let action: AclAction = 'read';
  if (verb === 'GET') action = 'read';
  else if (verb === 'DELETE') action = 'delete';
  else if (workflow) action = 'validate';
  else if (verb === 'POST') action = 'create';
  else if (verb === 'PATCH' || verb === 'PUT') action = 'update';
  return { resource, action };
}
