export type Resource =
  | 'dashboard'
  | 'clients'
  | 'orders'
  | 'products'
  | 'tours'
  | 'stock'
  | 'deliveries'
  | 'payments'
  | 'production'
  | 'quality'
  | 'loyalty'
  | 'consignes'
  | 'hr'
  | 'payroll'
  | 'observability'
  | 'users'
  | 'notifications'
  | 'ai'
  | 'assistant'
  | 'iot'
  | 'routing'
  | 'esg'
  | 'security'
  | 'portal'
  | 'marketplace'
  | 'integrations'
  | 'pricing'
  | 'activity';

export type Action = 'read' | 'create' | 'update' | 'delete' | 'validate';

const R: Action[] = ['read'];
const RC: Action[] = ['read', 'create'];
const RU: Action[] = ['read', 'update'];
const RCU: Action[] = ['read', 'create', 'update'];
const RCV: Action[] = ['read', 'create', 'validate'];
const RUV: Action[] = ['read', 'update', 'validate'];
const RCUV: Action[] = ['read', 'create', 'update', 'validate'];
const FULL: Action[] = ['read', 'create', 'update', 'delete', 'validate'];

/** Matrice CRUDVN par profil — alignée cahier EMMAPURE v3.0 « Smart » */
export const PERMISSIONS: Record<string, Partial<Record<Resource, Action[]>>> = {
  ADMIN: {
    dashboard: FULL, clients: FULL, orders: FULL, products: FULL, tours: FULL,
    stock: FULL, deliveries: FULL, payments: FULL, production: FULL, quality: FULL,
    loyalty: FULL, consignes: FULL, hr: FULL, payroll: FULL, observability: FULL, users: FULL, notifications: FULL,
    ai: FULL, assistant: FULL, iot: FULL, routing: FULL, esg: FULL, security: FULL,
    portal: FULL, marketplace: FULL, integrations: FULL, pricing: FULL, activity: FULL,
  },
  DG: {
    dashboard: R, clients: R, orders: R, products: R, tours: R, stock: R, deliveries: R,
    payments: R, production: R, quality: R, loyalty: R, consignes: R, hr: R, payroll: R,
    observability: R, users: R, notifications: R,
    ai: R, assistant: RC, iot: R, routing: R, esg: R, security: R, portal: R, marketplace: R, pricing: R,
  },
  CHEF_PRODUCTION: {
    dashboard: R, production: FULL, quality: R, stock: FULL, products: RCU, observability: R, notifications: R,
    ai: R, assistant: RC, iot: RU, hr: RUV,
  },
  CHEF_EXPLOITATION: {
    dashboard: R, orders: FULL, tours: FULL, deliveries: RUV, stock: R, clients: R, notifications: R,
    ai: R, assistant: RC, routing: RCUV, iot: R, esg: R, hr: RUV,
  },
  CHARGE_EXPLOITATION: {
    dashboard: R, orders: R, tours: RU, deliveries: R, stock: R, notifications: R,
    assistant: RC, routing: R, iot: R, hr: R,
  },
  RESP_QUALITE: {
    dashboard: R, quality: RCV, production: R, consignes: R, observability: R, notifications: R,
    ai: R, assistant: RC, iot: RU,
  },
  MAGASINIER: {
    dashboard: R, stock: FULL, tours: RC, consignes: FULL, products: R, notifications: R,
    assistant: RC, hr: R,
  },
  AGENT_CHARGEUR: {
    dashboard: R, tours: RU, stock: R, deliveries: R, notifications: R,
    assistant: RC, hr: R,
  },
  LIVREUR: {
    dashboard: R, deliveries: RCUV, payments: RC, orders: R, clients: R, notifications: R,
    assistant: RC, routing: R, hr: R,
  },
  CHARGE_LIVRAISON: {
    dashboard: R, deliveries: RCUV, payments: RC, orders: R, clients: R, notifications: R,
    assistant: RC, routing: R, hr: R,
  },
  COMMERCIAL: {
    dashboard: R, clients: FULL, orders: FULL, loyalty: RCU, products: R, payments: RCU, notifications: R,
    ai: R, assistant: RC, portal: RCU, marketplace: RCUV, pricing: FULL, hr: R,
  },
  DELEGUE_COMMERCIAL: {
    dashboard: R, clients: RC, orders: RC, loyalty: R, products: R, notifications: R,
    assistant: RC, marketplace: RC, pricing: R, hr: R,
  },
  CAISSIER: {
    dashboard: R, payments: FULL, clients: R, orders: R, notifications: R,
    assistant: RC, hr: R,
  },
  COMPTABLE: {
    payments: RCU, clients: R, orders: R, dashboard: R, notifications: R,
    ai: R, assistant: RC, payroll: RCUV, hr: R,
  },
  RH: {
    dashboard: R, hr: FULL, payroll: FULL, users: FULL, notifications: R,
    assistant: RC,
  },
  SUPERVISEUR: {
    dashboard: R, tours: R, observability: R, users: R, deliveries: R, notifications: R,
    ai: R, assistant: RC, iot: R, routing: R, esg: R, security: R, hr: RUV,
  },
  IT_GED: {
    observability: R, users: R, notifications: R, dashboard: R,
    assistant: RC, iot: RCU, integrations: FULL, security: R,
  },
  /** Analyste de données — exploitation de l'entrepôt analytique et des modèles prédictifs. */
  DATA_ANALYST: {
    dashboard: R, notifications: R, observability: R, assistant: RC,
    ai: RCUV, esg: R, iot: R, routing: R, clients: R, orders: R, products: R,
    payments: R, production: R, quality: R, stock: R, deliveries: R, tours: R, loyalty: R,
  },
  /** Responsable sécurité — pilotage du centre de sécurité et de la conformité. */
  RESP_SECURITE: {
    dashboard: R, notifications: R, observability: R, assistant: RC,
    security: RCUV, users: R, integrations: R, ai: R,
  },
  /** Responsable durabilité — suivi des indicateurs ESG et rapports de durabilité. */
  RESP_DURABILITE: {
    dashboard: R, notifications: R, assistant: RC,
    esg: RCUV, routing: R, iot: R, tours: R, consignes: R, production: R, ai: R,
  },
  /** Client self-service — accès au portail uniquement, jamais au back-office. */
  CLIENT_PORTAIL: {
    portal: RCU, assistant: RC,
  },
};

export const FIELD_ROLES = ['LIVREUR', 'CHARGE_LIVRAISON'];

/** Profils dont l'accès est limité au portail client (aucun écran back-office). */
export const PORTAL_ONLY_ROLES = ['CLIENT_PORTAIL'];

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
  CLIENT_PORTAIL: 'Client self-service',
};

export interface MenuItem {
  path: string;
  label: string;
  resource: Resource;
  section?: string;
}

export const MENU_ITEMS: MenuItem[] = [
  { path: '/', label: 'Tableau de bord', resource: 'dashboard', section: 'ANALYSE' },
  { path: '/observability', label: 'Supervision', resource: 'observability', section: 'ANALYSE' },
  { path: '/ai', label: 'IA prédictive', resource: 'ai', section: 'INTELLIGENCE' },
  { path: '/assistant', label: 'Assistant', resource: 'assistant', section: 'INTELLIGENCE' },
  { path: '/clients', label: 'Clients', resource: 'clients', section: 'ANNUAIRES' },
  { path: '/portal-accounts', label: 'Comptes portail', resource: 'portal', section: 'ANNUAIRES' },
  { path: '/orders', label: 'Historique commandes', resource: 'orders', section: 'COMMANDES' },
  { path: '/products', label: 'Catalogue produits', resource: 'products', section: 'COMMANDES' },
  { path: '/pricing', label: 'Tarifs et remises', resource: 'pricing', section: 'COMMANDES' },
  { path: '/stock', label: 'Stocks & achats', resource: 'stock', section: 'ACHATS' },
  { path: '/production', label: 'Fabrication / OF', resource: 'production', section: 'FABRICATION' },
  { path: '/quality', label: 'Contrôle qualité', resource: 'quality', section: 'FABRICATION' },
  { path: '/tours', label: 'Tournées', resource: 'tours', section: 'LIVRAISON' },
  { path: '/routing', label: 'Itinéraires optimisés', resource: 'routing', section: 'LIVRAISON' },
  { path: '/deliveries', label: 'Livraisons', resource: 'deliveries', section: 'LIVRAISON' },
  { path: '/iot', label: 'Capteurs & télémétrie', resource: 'iot', section: 'OBJETS CONNECTÉS' },
  { path: '/payments', label: 'Factures & paiements', resource: 'payments', section: 'FACTURES' },
  { path: '/loyalty', label: 'Fidélité', resource: 'loyalty', section: 'COMMERCE' },
  { path: '/consignes', label: 'Consignes circulaires', resource: 'consignes', section: 'COMMERCE' },
  { path: '/marketplace', label: 'Marketplace B2B', resource: 'marketplace', section: 'COMMERCE' },
  { path: '/esg', label: 'Durabilité / ESG', resource: 'esg', section: 'DURABILITÉ' },
  { path: '/hr', label: 'Administration RH', resource: 'hr', section: 'PERSONNEL' },
  { path: '/activity', label: 'Rapports d’activité', resource: 'activity', section: 'PERSONNEL' },
  { path: '/payroll', label: 'Paie des agents', resource: 'payroll', section: 'PERSONNEL' },
  { path: '/users', label: 'Utilisateurs', resource: 'users', section: 'PERSONNEL' },
  { path: '/security', label: 'Centre de sécurité', resource: 'security', section: 'SÉCURITÉ' },
  { path: '/integrations', label: 'API & webhooks', resource: 'integrations', section: 'PARAMÉTRAGE' },
  { path: '/notifications', label: 'Notifications', resource: 'notifications', section: 'PARAMÉTRAGE' },
];

export function can(role: string | undefined, resource: Resource, action: Action): boolean {
  if (!role) return false;
  if (role === 'ADMIN') return true;
  if (resource === 'activity') {
    if (PORTAL_ONLY_ROLES.includes(role)) return false;
    if (action === 'read' || action === 'create') return true;
    return ['DG', 'RH', 'SUPERVISEUR', 'CHEF_EXPLOITATION', 'CHEF_PRODUCTION', 'COMPTABLE'].includes(role);
  }
  const allowed = PERMISSIONS[role]?.[resource] ?? [];
  return allowed.includes(action);
}

export function canRead(role: string | undefined, resource: Resource): boolean {
  return can(role, resource, 'read');
}

export function getMenuForRole(role: string): MenuItem[] {
  return MENU_ITEMS.filter((item) => canRead(role, item.resource));
}

/** Catégories de notifications pertinentes par profil */
export const NOTIFICATION_CATEGORIES_BY_ROLE: Record<string, string[]> = {
  ADMIN: ['COMMANDE', 'TOURNEE', 'LIVRAISON', 'PAIEMENT', 'PRODUCTION', 'QUALITE', 'STOCK', 'CONSIGNE', 'FIDELITE', 'RH', 'SYSTEME', 'SUPERVISION', 'IA', 'IOT', 'ESG', 'SECURITE', 'PORTAIL'],
  DG: ['COMMANDE', 'PAIEMENT', 'PRODUCTION', 'QUALITE', 'SUPERVISION', 'SYSTEME', 'IA', 'ESG', 'SECURITE'],
  CHEF_PRODUCTION: ['PRODUCTION', 'QUALITE', 'STOCK', 'SYSTEME', 'IA', 'IOT'],
  CHEF_EXPLOITATION: ['COMMANDE', 'TOURNEE', 'LIVRAISON', 'STOCK', 'IA', 'IOT'],
  CHARGE_EXPLOITATION: ['TOURNEE', 'LIVRAISON', 'COMMANDE', 'IOT'],
  RESP_QUALITE: ['QUALITE', 'PRODUCTION', 'CONSIGNE', 'SUPERVISION', 'IOT'],
  MAGASINIER: ['STOCK', 'TOURNEE', 'CONSIGNE', 'IA'],
  AGENT_CHARGEUR: ['TOURNEE', 'STOCK'],
  LIVREUR: ['TOURNEE', 'LIVRAISON', 'COMMANDE'],
  CHARGE_LIVRAISON: ['TOURNEE', 'LIVRAISON', 'COMMANDE', 'PAIEMENT'],
  COMMERCIAL: ['COMMANDE', 'FIDELITE', 'IA', 'PORTAIL'],
  DELEGUE_COMMERCIAL: ['COMMANDE', 'FIDELITE', 'PORTAIL'],
  CAISSIER: ['PAIEMENT', 'LIVRAISON', 'PORTAIL'],
  RH: ['RH', 'SYSTEME'],
  COMPTABLE: ['PAIEMENT', 'SYSTEME', 'IA', 'RH'],
  SUPERVISEUR: ['SUPERVISION', 'TOURNEE', 'QUALITE', 'SYSTEME', 'IA', 'IOT', 'SECURITE'],
  IT_GED: ['SUPERVISION', 'SYSTEME', 'IOT', 'SECURITE'],
  DATA_ANALYST: ['IA', 'SUPERVISION', 'SYSTEME'],
  RESP_SECURITE: ['SECURITE', 'SUPERVISION', 'SYSTEME'],
  RESP_DURABILITE: ['ESG', 'TOURNEE', 'PRODUCTION', 'CONSIGNE'],
  CLIENT_PORTAIL: ['PORTAIL', 'COMMANDE', 'LIVRAISON', 'PAIEMENT', 'FIDELITE'],
};
