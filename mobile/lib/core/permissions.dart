typedef Action = String;
typedef Resource = String;

const fieldRoles = ['LIVREUR', 'CHARGE_LIVRAISON'];

const roleLabels = <String, String>{
  'ADMIN': 'Administrateur',
  'DG': 'Direction générale',
  'CHEF_PRODUCTION': 'Chef production',
  'CHEF_EXPLOITATION': 'Chef exploitation',
  'CHARGE_EXPLOITATION': 'Chargé exploitation',
  'RESP_QUALITE': 'Responsable qualité',
  'MAGASINIER': 'Magasinier',
  'AGENT_CHARGEUR': 'Agent chargeur',
  'LIVREUR': 'Livreur',
  'CHARGE_LIVRAISON': 'Chargé livraison',
  'COMMERCIAL': 'Commercial',
  'DELEGUE_COMMERCIAL': 'Délégué commercial',
  'CAISSIER': 'Caissier',
  'COMPTABLE': 'Comptable',
  'RH': 'Ressources humaines',
  'SUPERVISEUR': 'Superviseur',
  'IT_GED': 'IT / GED',
  'DATA_ANALYST': 'Analyste de données',
  'RESP_SECURITE': 'Responsable sécurité',
  'RESP_DURABILITE': 'Responsable durabilité',
  'CLIENT_PORTAIL': 'Client self-service',
};

const _full = ['read', 'create', 'update', 'delete', 'validate'];
const _r = ['read'];
const _rc = ['read', 'create'];
const _ru = ['read', 'update'];
const _rcu = ['read', 'create', 'update'];
const _ruv = ['read', 'update', 'validate'];
const _rcuv = ['read', 'create', 'update', 'validate'];

const Map<String, Map<String, List<String>>> defaultPermissions = {
  'ADMIN': {
    'dashboard': _full, 'clients': _full, 'orders': _full, 'products': _full,
    'tours': _full, 'stock': _full, 'deliveries': _full, 'payments': _full,
    'production': _full, 'quality': _full, 'loyalty': _full, 'consignes': _full,
    'hr': _full, 'payroll': _full, 'observability': _full, 'users': _full,
    'notifications': _full, 'ai': _full, 'assistant': _full, 'iot': _full,
    'routing': _full, 'esg': _full, 'security': _full, 'portal': _full,
    'marketplace': _full, 'integrations': _full, 'pricing': _full,
    'activity': _full, 'packaging': _full, 'vehicles': _full,
    'authorizations': _full, 'contracts': _full, 'objectives': _full,
    'pos': _full, 'finance': _full,
  },
  'LIVREUR': {
    'dashboard': _r, 'deliveries': _rcuv, 'payments': _rc, 'orders': _r,
    'clients': _r, 'notifications': _r, 'assistant': _rc, 'routing': _r,
    'hr': _r, 'objectives': _r, 'tours': _r,
  },
  'CHARGE_LIVRAISON': {
    'dashboard': _r, 'deliveries': _rcuv, 'payments': _rc, 'orders': _r,
    'clients': _r, 'notifications': _r, 'assistant': _rc, 'routing': _r,
    'hr': _r, 'objectives': _r, 'tours': _r,
  },
  'CAISSIER': {
    'dashboard': _r, 'payments': _full, 'clients': _r, 'orders': _r,
    'notifications': _r, 'assistant': _rc, 'hr': _r, 'pos': _full, 'finance': _rcu,
  },
  'COMMERCIAL': {
    'dashboard': _r, 'clients': _full, 'orders': _full, 'loyalty': _rcu,
    'products': _r, 'payments': _rcu, 'notifications': _r, 'ai': _r,
    'assistant': _rc, 'portal': _rcu, 'marketplace': _rcuv, 'pricing': _full,
    'hr': _r, 'contracts': _rcuv, 'objectives': _rcu, 'pos': _full, 'finance': _r,
  },
  'MAGASINIER': {
    'dashboard': _r, 'stock': _full, 'packaging': _full, 'vehicles': _full,
    'tours': _rc, 'consignes': _full, 'products': _r, 'notifications': _r,
    'assistant': _rc, 'hr': _r, 'contracts': _rcu, 'finance': _rcu,
  },
  'DG': {
    'dashboard': _r, 'clients': _r, 'orders': _r, 'products': _r, 'tours': _r,
    'stock': _r, 'deliveries': _r, 'payments': _r, 'production': _r, 'quality': _r,
    'loyalty': _r, 'consignes': _r, 'hr': _r, 'payroll': _r, 'observability': _r,
    'users': _r, 'notifications': _r, 'ai': _r, 'assistant': _rc, 'iot': _r,
    'routing': _r, 'esg': _r, 'security': _r, 'portal': _r, 'marketplace': _r,
    'pricing': _r, 'packaging': _r, 'vehicles': _r, 'authorizations': _r,
    'contracts': _ruv, 'objectives': _r, 'pos': _r, 'finance': _ruv,
  },
  'CHEF_PRODUCTION': {
    'dashboard': _r, 'production': _full, 'quality': _r, 'stock': _full,
    'packaging': _full, 'products': _rcu, 'observability': _r, 'notifications': _r,
    'ai': _r, 'assistant': _rc, 'iot': _ru, 'hr': _ruv, 'contracts': _r, 'objectives': _ruv,
  },
  'CHEF_EXPLOITATION': {
    'dashboard': _r, 'orders': _full, 'tours': _full, 'deliveries': _ruv, 'stock': _r,
    'packaging': _r, 'vehicles': _full, 'clients': _r, 'notifications': _r,
    'ai': _r, 'assistant': _rc, 'routing': _rcuv, 'iot': _r, 'esg': _r, 'hr': _ruv,
    'contracts': _r, 'objectives': _rcuv, 'pos': _r, 'finance': _r,
  },
  'RESP_QUALITE': {
    'dashboard': _r, 'quality': _rcuv, 'production': _r, 'consignes': _r,
    'observability': _r, 'notifications': _r, 'ai': _r, 'assistant': _rc, 'iot': _ru,
  },
  'RH': {
    'dashboard': _r, 'hr': _full, 'payroll': _full, 'users': _full, 'notifications': _r,
    'authorizations': _rcu, 'assistant': _rc, 'contracts': _full, 'objectives': _full,
  },
  'COMPTABLE': {
    'payments': _rcu, 'finance': _full, 'clients': _r, 'orders': _r, 'dashboard': _r,
    'notifications': _r, 'ai': _r, 'assistant': _rc, 'payroll': _rcuv, 'hr': _r,
    'contracts': _rcuv, 'pos': _r,
  },
  'SUPERVISEUR': {
    'dashboard': _r, 'tours': _r, 'vehicles': _r, 'observability': _r, 'users': _r,
    'deliveries': _r, 'notifications': _r, 'ai': _r, 'assistant': _rc, 'iot': _r,
    'routing': _r, 'esg': _r, 'security': _r, 'hr': _ruv, 'contracts': _r, 'objectives': _rcuv,
  },
  'DATA_ANALYST': {
    'dashboard': _r, 'notifications': _r, 'observability': _r, 'assistant': _rc,
    'ai': _rcuv, 'esg': _r, 'iot': _r, 'routing': _r, 'clients': _r, 'orders': _r,
    'products': _r, 'payments': _r, 'finance': _r, 'production': _r, 'quality': _r,
    'stock': _r, 'packaging': _r, 'vehicles': _r, 'deliveries': _r, 'tours': _r,
    'loyalty': _r, 'contracts': _r,
  },
  'RESP_SECURITE': {
    'dashboard': _r, 'notifications': _r, 'observability': _r, 'assistant': _rc,
    'authorizations': _rcu, 'security': _rcuv, 'users': _r, 'integrations': _r, 'ai': _r,
  },
  'RESP_DURABILITE': {
    'dashboard': _r, 'notifications': _r, 'assistant': _rc, 'esg': _rcuv, 'routing': _r,
    'iot': _r, 'tours': _r, 'vehicles': _r, 'consignes': _r, 'production': _r,
    'packaging': _r, 'ai': _r,
  },
};

bool can(String? role, String resource, String action, [Map<String, List<String>>? matrix]) {
  if (role == null) return false;
  if (role == 'ADMIN') return true;
  if (matrix != null && matrix.containsKey(resource)) {
    return matrix[resource]!.contains(action);
  }
  final allowed = defaultPermissions[role]?[resource] ?? const <String>[];
  if (allowed.isNotEmpty) return allowed.contains(action);
  if (resource == 'activity') {
    return action == 'read' || action == 'create';
  }
  return false;
}

bool canRead(String? role, String resource, [Map<String, List<String>>? matrix]) =>
    can(role, resource, 'read', matrix);

String roleLabel(String role) => roleLabels[role] ?? role;
