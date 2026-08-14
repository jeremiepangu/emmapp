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
  | 'observability'
  | 'users'
  | 'notifications';

export type Action = 'read' | 'create' | 'update' | 'delete' | 'validate';

const R: Action[] = ['read'];
const RC: Action[] = ['read', 'create'];
const RU: Action[] = ['read', 'update'];
const RCU: Action[] = ['read', 'create', 'update'];
const RCV: Action[] = ['read', 'create', 'validate'];
const RUV: Action[] = ['read', 'update', 'validate'];
const FULL: Action[] = ['read', 'create', 'update', 'delete', 'validate'];

/** Matrice CRUDVN par profil — alignée cahier EMMAPURE v2.1 */
export const PERMISSIONS: Record<string, Partial<Record<Resource, Action[]>>> = {
  ADMIN: {
    dashboard: FULL, clients: FULL, orders: FULL, products: FULL, tours: FULL,
    stock: FULL, deliveries: FULL, payments: FULL, production: FULL, quality: FULL,
    loyalty: FULL, consignes: FULL, hr: FULL, observability: FULL, users: FULL, notifications: FULL,
  },
  DG: {
    dashboard: R, clients: R, orders: R, products: R, tours: R, stock: R, deliveries: R,
    payments: R, production: R, quality: R, loyalty: R, consignes: R, hr: R,
    observability: R, users: R, notifications: R,
  },
  CHEF_PRODUCTION: {
    dashboard: R, production: RCU, quality: R, stock: RU, products: R, observability: R, notifications: R,
  },
  CHEF_EXPLOITATION: {
    dashboard: R, orders: RUV, tours: RCU, deliveries: R, stock: R, clients: R, notifications: R,
  },
  CHARGE_EXPLOITATION: {
    dashboard: R, orders: R, tours: RU, deliveries: R, stock: R, notifications: R,
  },
  RESP_QUALITE: {
    quality: RCV, production: R, consignes: R, observability: R, notifications: R,
  },
  MAGASINIER: {
    stock: RCU, tours: RC, consignes: RU, products: R, notifications: R,
  },
  AGENT_CHARGEUR: {
    tours: RU, stock: R, deliveries: R, notifications: R,
  },
  LIVREUR: {
    deliveries: RC, payments: RC, orders: R, clients: R, notifications: R,
  },
  CHARGE_LIVRAISON: {
    deliveries: RC, payments: RC, orders: R, clients: R, notifications: R,
  },
  COMMERCIAL: {
    clients: RCU, orders: RCU, loyalty: R, products: R, payments: R, notifications: R,
  },
  DELEGUE_COMMERCIAL: {
    clients: RC, orders: RC, loyalty: R, products: R, notifications: R,
  },
  CAISSIER: {
    payments: RCU, clients: R, orders: R, notifications: R,
  },
  COMPTABLE: {
    payments: R, clients: R, orders: R, dashboard: R, notifications: R,
  },
  RH: {
    hr: RCU, users: RCU, notifications: R,
  },
  SUPERVISEUR: {
    dashboard: R, tours: R, observability: R, users: R, deliveries: R, notifications: R,
  },
  IT_GED: {
    observability: R, users: R, notifications: R, dashboard: R,
  },
};

export const FIELD_ROLES = ['LIVREUR', 'CHARGE_LIVRAISON'];

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
  { path: '/clients', label: 'Clients', resource: 'clients', section: 'ANNUAIRES' },
  { path: '/orders', label: 'Historique commandes', resource: 'orders', section: 'COMMANDES' },
  { path: '/products', label: 'Catalogue produits', resource: 'products', section: 'COMMANDES' },
  { path: '/stock', label: 'Stocks & achats', resource: 'stock', section: 'ACHATS' },
  { path: '/production', label: 'Fabrication / OF', resource: 'production', section: 'FABRICATION' },
  { path: '/quality', label: 'Contrôle qualité', resource: 'quality', section: 'FABRICATION' },
  { path: '/tours', label: 'Tournées', resource: 'tours', section: 'LIVRAISON' },
  { path: '/deliveries', label: 'Livraisons', resource: 'deliveries', section: 'LIVRAISON' },
  { path: '/payments', label: 'Factures & paiements', resource: 'payments', section: 'FACTURES' },
  { path: '/loyalty', label: 'Fidélité', resource: 'loyalty', section: 'COMMERCE' },
  { path: '/consignes', label: 'Consignes circulaires', resource: 'consignes', section: 'COMMERCE' },
  { path: '/hr', label: 'Personnel / shifts', resource: 'hr', section: 'PERSONNEL' },
  { path: '/users', label: 'Utilisateurs', resource: 'users', section: 'PERSONNEL' },
  { path: '/notifications', label: 'Notifications', resource: 'notifications', section: 'PARAMÉTRAGE' },
];

export function can(role: string | undefined, resource: Resource, action: Action): boolean {
  if (!role) return false;
  if (role === 'ADMIN') return true;
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
  ADMIN: ['COMMANDE', 'TOURNEE', 'LIVRAISON', 'PAIEMENT', 'PRODUCTION', 'QUALITE', 'STOCK', 'CONSIGNE', 'FIDELITE', 'RH', 'SYSTEME', 'SUPERVISION'],
  DG: ['COMMANDE', 'PAIEMENT', 'PRODUCTION', 'QUALITE', 'SUPERVISION', 'SYSTEME'],
  CHEF_PRODUCTION: ['PRODUCTION', 'QUALITE', 'STOCK', 'SYSTEME'],
  CHEF_EXPLOITATION: ['COMMANDE', 'TOURNEE', 'LIVRAISON', 'STOCK'],
  CHARGE_EXPLOITATION: ['TOURNEE', 'LIVRAISON', 'COMMANDE'],
  RESP_QUALITE: ['QUALITE', 'PRODUCTION', 'CONSIGNE', 'SUPERVISION'],
  MAGASINIER: ['STOCK', 'TOURNEE', 'CONSIGNE'],
  AGENT_CHARGEUR: ['TOURNEE', 'STOCK'],
  LIVREUR: ['TOURNEE', 'LIVRAISON', 'COMMANDE'],
  CHARGE_LIVRAISON: ['TOURNEE', 'LIVRAISON', 'COMMANDE', 'PAIEMENT'],
  COMMERCIAL: ['COMMANDE', 'FIDELITE'],
  DELEGUE_COMMERCIAL: ['COMMANDE', 'FIDELITE'],
  CAISSIER: ['PAIEMENT', 'LIVRAISON'],
  COMPTABLE: ['PAIEMENT', 'SYSTEME'],
  RH: ['RH', 'SYSTEME'],
  SUPERVISEUR: ['SUPERVISION', 'TOURNEE', 'QUALITE', 'SYSTEME'],
  IT_GED: ['SUPERVISION', 'SYSTEME'],
};
