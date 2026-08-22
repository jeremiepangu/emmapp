const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  isActive?: boolean;
}

export type AclAction = 'read' | 'create' | 'update' | 'delete' | 'validate';

export interface AuthorizationCatalog {
  actions: Array<{ id: AclAction; label: string; short: string }>;
  resources: Array<{ id: string; label: string; section: string; path?: string; description: string }>;
  roles: Array<{ id: string; label: string }>;
}

export interface UserAuthorizationDetail {
  user: { id: string; firstName: string; lastName: string; email: string; role: string };
  overrides: Array<{ id: string; resource: string; action: string; effect: string }>;
  effective: Record<string, AclAction[]>;
}

export interface Vehicle {
  id: string;
  plate: string;
  name: string;
  capacity: number;
  fuelType?: string;
  co2FactorKgPerKm?: number;
  isActive?: boolean;
}

export interface CreateVehicleInput {
  plate: string;
  name: string;
  capacity?: number;
  fuelType?: string;
  co2FactorKgPerKm?: number;
  isActive?: boolean;
}

export type ContractPartyKind = 'AGENT' | 'SUPPLIER' | 'KEY_CLIENT';
export type BusinessContractKind =
  | 'CDI'
  | 'CDD'
  | 'STAGE'
  | 'PRESTATION'
  | 'JOURNALIER'
  | 'FOURNITURE'
  | 'PRESTATION_SERVICE'
  | 'CADRE'
  | 'DISTRIBUTION'
  | 'EXCLUSIVITE'
  | 'CONSIGNATION';
export type ContractLifecycle = 'BROUILLON' | 'ACTIF' | 'SUSPENDU' | 'EXPIRE' | 'RESILIE' | 'RENOUVELE';

export interface Supplier {
  id: string;
  code: string;
  name: string;
  category?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  nif?: string | null;
  rccm?: string | null;
  notes?: string | null;
  isActive: boolean;
}

export interface CreateSupplierInput {
  code: string;
  name: string;
  category?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  nif?: string;
  rccm?: string;
  notes?: string;
}

export interface ContractAmendment {
  id: string;
  reference: string;
  reason: string;
  amount?: string | number | null;
  startDate: string;
  notes?: string | null;
  createdAt: string;
}

export interface BusinessContract {
  id: string;
  reference: string;
  partyKind: ContractPartyKind;
  title: string;
  kind: BusinessContractKind;
  status: ContractLifecycle;
  startDate: string;
  endDate?: string | null;
  noticeDays: number;
  autoRenew: boolean;
  currency: string;
  amount?: string | number | null;
  paymentTerms?: string | null;
  billingCycle?: string | null;
  volumeCommitment?: string | null;
  territory?: string | null;
  exclusivity: boolean;
  clauses?: string | null;
  notes?: string | null;
  employeeId?: string | null;
  supplierId?: string | null;
  clientId?: string | null;
  signedByParty?: string | null;
  signedByCompany?: string | null;
  validatedAt?: string | null;
  terminatedAt?: string | null;
  terminateReason?: string | null;
  renewalCount: number;
  employee?: EmployeeProfile | null;
  supplier?: Supplier | null;
  client?: { id: string; code: string; name: string; segment: string; phone?: string | null; email?: string | null; zone?: string | null } | null;
  validatedBy?: { id: string; firstName: string; lastName: string } | null;
  amendments: ContractAmendment[];
  documents?: ContractDocument[];
  template?: { id: string; code: string; name: string } | null;
}

export interface CreateContractInput {
  partyKind: ContractPartyKind;
  title: string;
  kind: BusinessContractKind;
  startDate: string;
  endDate?: string;
  noticeDays?: number;
  autoRenew?: boolean;
  currency?: string;
  amount?: number;
  paymentTerms?: string;
  billingCycle?: string;
  volumeCommitment?: string;
  territory?: string;
  exclusivity?: boolean;
  clauses?: string;
  notes?: string;
  employeeId?: string;
  supplierId?: string;
  clientId?: string;
  signedByParty?: string;
  signedByCompany?: string;
}

export interface ContractsSummary {
  total: number;
  status: Record<string, number>;
  parties: Record<string, number>;
  expiring30d: number;
  archived?: number;
}

export interface ContractTemplate {
  id: string;
  code: string;
  name: string;
  partyKind?: ContractPartyKind | null;
  kind?: BusinessContractKind | null;
  title: string;
  body: string;
  clauses?: string | null;
  footer?: string | null;
  isActive: boolean;
}

export interface CreateContractTemplateInput {
  code: string;
  name: string;
  partyKind?: ContractPartyKind | null;
  kind?: BusinessContractKind | null;
  title: string;
  body: string;
  clauses?: string;
  footer?: string;
}

export interface ContractDocument {
  id: string;
  contractId?: string;
  templateId?: string | null;
  kind: 'WORD_SIGNATURE' | 'SIGNED_ARCHIVE';
  filename: string;
  mimeType: string;
  byteSize: number;
  generatedAt: string;
  archivedAt?: string | null;
  notes?: string | null;
  template?: { id: string; code: string; name: string } | null;
  archivedBy?: { id: string; firstName: string; lastName: string } | null;
  contract?: { id: string; reference: string; title: string; partyKind: ContractPartyKind };
}

export interface ContractParties {
  employees: EmployeeProfile[];
  suppliers: Supplier[];
  clients: Array<{ id: string; code: string; name: string; segment: string; phone?: string | null; email?: string | null; zone?: string | null }>;
}

export type PaymentMethod =
  | 'ESPECES'
  | 'CHEQUE'
  | 'VIREMENT'
  | 'MOBILE_MONEY'
  | 'MPESA'
  | 'ORANGE_MONEY'
  | 'AIRTEL_MONEY'
  | 'WAVE'
  | 'CREDIT';

export type ClientSegment =
  | 'PARTICULIER'
  | 'BOUTIQUE'
  | 'DETAILLANT'
  | 'SUPERMARCHE'
  | 'ENTREPRISE'
  | 'HOTEL_RESTAURANT';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 0 || response.type === 'error') {
      throw new Error('API inaccessible — démarrez le backend (npm run start:local dans backend/)');
    }
    // Un jeton expiré ou révoqué ne doit pas laisser l'utilisateur sur un écran en erreur.
    if (response.status === 401 && path !== '/auth/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login?expired=1');
      }
      throw new Error('Session expirée — veuillez vous reconnecter.');
    }
    if (response.status === 403) {
      throw new Error("Votre profil n'a pas accès à cette ressource.");
    }
    let message = text || `Erreur API (${response.status})`;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (parsed?.message) {
        message = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
      }
    } catch {
      /* keep raw text */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  login: (email: string, password: string, mfaCode?: string) =>
    request<{ accessToken: string; user: User; mfaRequired?: boolean; permissions?: Partial<Record<string, string[]>> }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...(mfaCode ? { mfaCode } : {}) }),
    }),
  getMyAuthorizations: () =>
    request<{ role: string; matrix: Partial<Record<string, Array<'read' | 'create' | 'update' | 'delete' | 'validate'>>> }>('/authorizations/me'),
  getAuthorizationCatalog: () =>
    request<AuthorizationCatalog>('/authorizations/catalog'),
  getAuthorizationMatrix: () =>
    request<Record<string, Record<string, Array<'read' | 'create' | 'update' | 'delete' | 'validate'>>>>('/authorizations/matrix'),
  saveRoleAuthorizations: (role: string, matrix: Record<string, string[]>) =>
    request<{ role: string; matrix: Record<string, string[]> }>(`/authorizations/roles/${role}`, {
      method: 'PUT',
      body: JSON.stringify({ matrix }),
    }),
  resetRoleAuthorizations: (role: string) =>
    request<{ role: string; matrix: Record<string, string[]> }>(`/authorizations/roles/${role}/reset`, { method: 'POST' }),
  resetAllAuthorizations: () =>
    request<Record<string, Record<string, string[]>>>('/authorizations/reset', { method: 'POST' }),
  getUserAuthorizations: (userId: string) =>
    request<UserAuthorizationDetail>(`/authorizations/users/${userId}`),
  saveUserAuthorizations: (
    userId: string,
    overrides: Array<{ resource: string; action: string; effect: 'GRANT' | 'DENY' }>,
  ) =>
    request<UserAuthorizationDetail>(`/authorizations/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ overrides }),
    }),

  getDashboard: () => request<DashboardOverview>('/dashboard/overview'),

  getClients: () => request<Client[]>('/clients'),
  createClient: (data: CreateClientInput) =>
    request<Client>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: string, data: Partial<CreateClientInput>) =>
    request<Client>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getProducts: () => request<Product[]>('/products'),
  createProduct: (data: CreateProductInput) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: Partial<CreateProductInput>) =>
    request<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProduct: (id: string) => request<Product>(`/products/${id}`, { method: 'DELETE' }),

  getPricingRules: () => request<PricingRule[]>('/pricing-rules'),
  createPricingRule: (data: CreatePricingRuleInput) =>
    request<PricingRule>('/pricing-rules', { method: 'POST', body: JSON.stringify(data) }),
  updatePricingRule: (id: string, data: Partial<CreatePricingRuleInput>) =>
    request<PricingRule>(`/pricing-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePricingRule: (id: string) => request<PricingRule>(`/pricing-rules/${id}`, { method: 'DELETE' }),

  getActivityObjectives: (params?: { userId?: string; year?: number; month?: number }) => {
    const q = new URLSearchParams();
    if (params?.userId) q.set('userId', params.userId);
    if (params?.year) q.set('year', String(params.year));
    if (params?.month) q.set('month', String(params.month));
    const qs = q.toString();
    return request<ActivityObjective[]>(`/activity-objectives${qs ? `?${qs}` : ''}`);
  },
  getActivityObjectivesCatalog: () =>
    request<{ users: User[]; functions: JobFunction[] }>('/activity-objectives/catalog'),
  createActivityObjective: (data: CreateActivityObjectiveInput) =>
    request<ActivityObjective>('/activity-objectives', { method: 'POST', body: JSON.stringify(data) }),
  updateActivityObjective: (id: string, data: Partial<CreateActivityObjectiveInput>) =>
    request<ActivityObjective>(`/activity-objectives/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteActivityObjective: (id: string) =>
    request<ActivityObjective>(`/activity-objectives/${id}`, { method: 'DELETE' }),
  previewPrice: (clientId: string, productId: string, quantity: number, driverId?: string) => {
    const q = new URLSearchParams({ clientId, productId, quantity: String(quantity) });
    if (driverId) q.set('driverId', driverId);
    return request<PricePreview>(`/pricing-rules/preview?${q.toString()}`);
  },

  deleteClient: (id: string) => request<Client>(`/clients/${id}`, { method: 'DELETE' }),

  getUsersByRole: (role: string) => request<User[]>(`/users/by-role?role=${role}`),

  getVehicles: () => request<Vehicle[]>('/vehicles'),
  createVehicle: (data: CreateVehicleInput) =>
    request<Vehicle>('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
  updateVehicle: (id: string, data: Partial<CreateVehicleInput>) =>
    request<Vehicle>(`/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteVehicle: (id: string) => request<Vehicle>(`/vehicles/${id}`, { method: 'DELETE' }),

  getContracts: (params?: { partyKind?: string; status?: string; q?: string; expiringDays?: number }) => {
    const q = new URLSearchParams();
    if (params?.partyKind) q.set('partyKind', params.partyKind);
    if (params?.status) q.set('status', params.status);
    if (params?.q) q.set('q', params.q);
    if (params?.expiringDays) q.set('expiringDays', String(params.expiringDays));
    const qs = q.toString();
    return request<BusinessContract[]>(`/contracts${qs ? `?${qs}` : ''}`);
  },
  getContractsSummary: () => request<ContractsSummary>('/contracts/summary'),
  getContractParties: () => request<ContractParties>('/contracts/parties'),
  getContract: (id: string) => request<BusinessContract>(`/contracts/${id}`),
  createContract: (data: CreateContractInput) =>
    request<BusinessContract>('/contracts', { method: 'POST', body: JSON.stringify(data) }),
  updateContract: (id: string, data: Partial<CreateContractInput>) =>
    request<BusinessContract>(`/contracts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteContract: (id: string) => request<{ id: string }>(`/contracts/${id}`, { method: 'DELETE' }),
  validateContract: (id: string) => request<BusinessContract>(`/contracts/${id}/validate`, { method: 'POST' }),
  suspendContract: (id: string) => request<BusinessContract>(`/contracts/${id}/suspend`, { method: 'POST' }),
  resumeContract: (id: string) => request<BusinessContract>(`/contracts/${id}/resume`, { method: 'POST' }),
  renewContract: (id: string, endDate?: string) =>
    request<BusinessContract>(`/contracts/${id}/renew`, { method: 'POST', body: JSON.stringify(endDate ? { endDate } : {}) }),
  terminateContract: (id: string, reason: string) =>
    request<BusinessContract>(`/contracts/${id}/terminate`, { method: 'POST', body: JSON.stringify({ reason }) }),
  addContractAmendment: (id: string, data: { reason: string; amount?: number; startDate?: string; notes?: string }) =>
    request<BusinessContract>(`/contracts/${id}/amendments`, { method: 'POST', body: JSON.stringify(data) }),
  getContractTemplates: () => request<ContractTemplate[]>('/contracts/templates'),
  getContractPlaceholders: () => request<Array<{ key: string; label: string }>>('/contracts/placeholders'),
  createContractTemplate: (data: CreateContractTemplateInput) =>
    request<ContractTemplate>('/contracts/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateContractTemplate: (id: string, data: Partial<CreateContractTemplateInput & { isActive: boolean }>) =>
    request<ContractTemplate>(`/contracts/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteContractTemplate: (id: string) => request<ContractTemplate>(`/contracts/templates/${id}`, { method: 'DELETE' }),
  generateContractWord: (id: string, templateId?: string) =>
    request<ContractDocument>(`/contracts/${id}/generate-word`, { method: 'POST', body: JSON.stringify(templateId ? { templateId } : {}) }),
  archiveContractDocument: (contractId: string, docId: string, notes?: string) =>
    request<ContractDocument>(`/contracts/${contractId}/documents/${docId}/archive`, { method: 'POST', body: JSON.stringify({ notes }) }),
  uploadSignedContract: (contractId: string, data: { filename: string; mimeType?: string; contentBase64: string; notes?: string }) =>
    request<ContractDocument>(`/contracts/${contractId}/archive-signed`, { method: 'POST', body: JSON.stringify(data) }),
  getContractArchives: () => request<ContractDocument[]>('/contracts/archives'),
  downloadContractDocument: async (docId: string, filename: string) => {
    const token = getToken();
    const response = await fetch(`${API_BASE}/contracts/documents/${docId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Telechargement impossible');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  getSuppliers: () => request<Supplier[]>('/contracts/suppliers'),
  createSupplier: (data: CreateSupplierInput) =>
    request<Supplier>('/contracts/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: Partial<CreateSupplierInput & { isActive: boolean }>) =>
    request<Supplier>(`/contracts/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => request<Supplier>(`/contracts/suppliers/${id}`, { method: 'DELETE' }),

  getTours: (params?: { driverId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.driverId) q.set('driverId', params.driverId);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<Tour[]>(`/tours${qs ? `?${qs}` : ''}`);
  },
  createTour: (data: CreateTourInput) =>
    request<Tour>('/tours', { method: 'POST', body: JSON.stringify(data) }),
  updateTour: (id: string, data: Partial<CreateTourInput>) =>
    request<Tour>(`/tours/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTour: (id: string) => request<void>(`/tours/${id}`, { method: 'DELETE' }),
  startTour: (id: string) => request<Tour>(`/tours/${id}/start`, { method: 'PATCH' }),
  completeTour: (id: string) => request<Tour>(`/tours/${id}/complete`, { method: 'PATCH' }),
  cancelTour: (id: string) => request<Tour>(`/tours/${id}/cancel`, { method: 'PATCH' }),

  getOrders: () => request<Order[]>('/orders'),
  createOrder: (data: CreateOrderInput) =>
    request<Order>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  validateOrder: (id: string) =>
    request<Order>(`/orders/${id}/validate`, { method: 'PATCH' }),
  cancelOrder: (id: string) =>
    request<Order>(`/orders/${id}/cancel`, { method: 'PATCH' }),
  updateOrder: (id: string, data: { notes?: string }) =>
    request<Order>(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOrder: (id: string) => request<void>(`/orders/${id}`, { method: 'DELETE' }),

  getStock: () => request<StockItem[]>('/stock'),
  getStockLocations: () => request<StockLocation[]>('/stock/locations'),
  createStockLocation: (data: CreateStockLocationInput) =>
    request<StockLocation>('/stock/locations', { method: 'POST', body: JSON.stringify(data) }),
  updateStockLocation: (id: string, data: Partial<CreateStockLocationInput>) =>
    request<StockLocation>(`/stock/locations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteStockLocation: (id: string) => request<void>(`/stock/locations/${id}`, { method: 'DELETE' }),
  adjustStock: (data: { productId: string; locationId: string; quantity: number; lotNumber?: string }) =>
    request<StockItem>('/stock/adjust', { method: 'POST', body: JSON.stringify(data) }),
  updateStockQuantity: (id: string, quantity: number) =>
    request<StockItem>(`/stock/${id}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
  deleteStockItem: (id: string) => request<void>(`/stock/${id}`, { method: 'DELETE' }),

  getPackagingSkus: (kind?: string) => {
    const q = kind ? `?kind=${kind}` : '';
    return request<PackagingSku[]>(`/packaging${q}`);
  },
  getPackagingSummary: () => request<PackagingSummary>('/packaging/summary'),
  getPackagingMovements: (params?: { kind?: string; type?: string; skuId?: string }) => {
    const q = new URLSearchParams();
    if (params?.kind) q.set('kind', params.kind);
    if (params?.type) q.set('type', params.type);
    if (params?.skuId) q.set('skuId', params.skuId);
    const qs = q.toString();
    return request<PackagingMovement[]>(`/packaging/movements${qs ? `?${qs}` : ''}`);
  },
  createPackagingMovement: (data: CreatePackagingMovementInput) =>
    request<PackagingMovement>('/packaging/movements', { method: 'POST', body: JSON.stringify(data) }),
  updatePackagingMovement: (id: string, data: Partial<CreatePackagingMovementInput>) =>
    request<PackagingMovement>(`/packaging/movements/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePackagingMovement: (id: string) =>
    request<void>(`/packaging/movements/${id}`, { method: 'DELETE' }),
  createPackagingSku: (data: CreatePackagingSkuInput) =>
    request<PackagingSku>('/packaging/skus', { method: 'POST', body: JSON.stringify(data) }),
  updatePackagingSku: (id: string, data: Partial<CreatePackagingSkuInput> & { isActive?: boolean }) =>
    request<PackagingSku>(`/packaging/skus/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePackagingSku: (id: string) =>
    request<PackagingSku>(`/packaging/skus/${id}`, { method: 'DELETE' }),

  getDeliveries: () => request<Delivery[]>('/deliveries'),
  createDelivery: (data: CreateDeliveryInput) =>
    request<Delivery>('/deliveries', { method: 'POST', body: JSON.stringify(data) }),
  updateDelivery: (id: string, data: { status: string; notes?: string }) =>
    request<Delivery>(`/deliveries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDelivery: (id: string) => request<void>(`/deliveries/${id}`, { method: 'DELETE' }),

  getPayments: () => request<Payment[]>('/payments'),
  createPayment: (data: CreatePaymentInput) =>
    request<Payment>('/payments', { method: 'POST', body: JSON.stringify(data) }),

  getPosCatalog: () => request<PosCatalog>('/pos/catalog'),
  getPosSales: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return request<PosSalesResponse>(`/pos/sales${qs ? `?${qs}` : ''}`);
  },
  quotePos: (data: { clientId?: string | null; lines: Array<{ productId: string; quantity: number }> }) =>
    request<PosQuote>('/pos/quote', { method: 'POST', body: JSON.stringify(data) }),
  checkoutPos: (data: PosCheckoutInput) =>
    request<PosSale>('/pos/checkout', { method: 'POST', body: JSON.stringify(data) }),
  cancelPosSale: (id: string) =>
    request<PosSale>(`/pos/sales/${id}/cancel`, { method: 'POST' }),
  updatePayment: (id: string, data: Partial<CreatePaymentInput>) =>
    request<Payment>(`/payments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePayment: (id: string) => request<void>(`/payments/${id}`, { method: 'DELETE' }),

  getProductionOrders: () => request<ProductionOrder[]>('/emmapure/production'),
  createProductionOrder: (data: { productFormat: string; lineCode: string; plannedQty: number }) =>
    request<ProductionOrder>('/emmapure/production', { method: 'POST', body: JSON.stringify(data) }),
  validateProductionOrder: (id: string) =>
    request<ProductionOrder>(`/emmapure/production/${id}/validate`, { method: 'PATCH' }),
  updateProductionOrder: (id: string, data: { producedQty?: number; plannedQty?: number }) =>
    request<ProductionOrder>(`/emmapure/production/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProductionOrder: (id: string) =>
    request<void>(`/emmapure/production/${id}`, { method: 'DELETE' }),

  getQualityChecks: () => request<QualityCheck[]>('/emmapure/quality'),
  createQualityCheck: (data: CreateQualityCheckInput) =>
    request<QualityCheck>('/emmapure/quality', { method: 'POST', body: JSON.stringify(data) }),
  validateQualityCheck: (id: string, conform: boolean) =>
    request<QualityCheck>(`/emmapure/quality/${id}/validate`, {
      method: 'PATCH',
      body: JSON.stringify({ conform }),
    }),
  deleteQualityCheck: (id: string) => request<void>(`/emmapure/quality/${id}`, { method: 'DELETE' }),
  updateQualityCheck: (id: string, data: Partial<CreateQualityCheckInput>) =>
    request<QualityCheck>(`/emmapure/quality/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getLoyaltyClients: () => request<LoyaltyClient[]>('/emmapure/loyalty'),
  creditLoyalty: (clientId: string, points: number) =>
    request<LoyaltyClient>(`/emmapure/loyalty/${clientId}/points`, {
      method: 'POST',
      body: JSON.stringify({ points }),
    }),
  updateLoyalty: (clientId: string, data: { loyaltyPoints?: number; walletBalance?: number }) =>
    request<LoyaltyClient>(`/emmapure/loyalty/${clientId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetLoyalty: (clientId: string) =>
    request<LoyaltyClient>(`/emmapure/loyalty/${clientId}/reset`, { method: 'POST' }),

  getShiftAssignments: (date?: string) => {
    const qs = date ? `?date=${date}` : '';
    return request<ShiftAssignment[]>(`/emmapure/shifts${qs}`);
  },
  createShiftAssignment: (data: CreateShiftInput) =>
    request<ShiftAssignment>('/emmapure/shifts', { method: 'POST', body: JSON.stringify(data) }),
  updateShiftAssignment: (id: string, data: Partial<CreateShiftInput>) =>
    request<ShiftAssignment>(`/emmapure/shifts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  validateShiftAssignment: (id: string) =>
    request<ShiftAssignment>(`/emmapure/shifts/${id}/validate`, { method: 'PATCH' }),
  deleteShiftAssignment: (id: string) =>
    request<void>(`/emmapure/shifts/${id}`, { method: 'DELETE' }),

  getPackagingUnits: () => request<PackagingUnit[]>('/emmapure/packaging'),
  createPackagingUnit: (data: { barcode: string; productFormat: string; maxRotations: number }) =>
    request<PackagingUnit>('/emmapure/packaging', { method: 'POST', body: JSON.stringify(data) }),
  updatePackagingUnit: (id: string, data: { rotationCount?: number; status?: string; maxRotations?: number }) =>
    request<PackagingUnit>(`/emmapure/packaging/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePackagingUnit: (id: string) => request<void>(`/emmapure/packaging/${id}`, { method: 'DELETE' }),
  getFountains: () => request<FountainAsset[]>('/emmapure/fountains'),
  createFountain: (data: { serialNumber: string; model?: string; contractType?: string; nextService?: string }) =>
    request<FountainAsset>('/emmapure/fountains', { method: 'POST', body: JSON.stringify(data) }),
  updateFountain: (id: string, data: { model?: string; contractType?: string; nextService?: string; isActive?: boolean }) =>
    request<FountainAsset>(`/emmapure/fountains/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFountain: (id: string) => request<void>(`/emmapure/fountains/${id}`, { method: 'DELETE' }),
  getObservability: () => request<ObservabilityStatus>('/emmapure/observability'),

  getUsers: () => request<User[]>('/users'),
  createUser: (data: CreateUserInput) =>
    request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Partial<CreateUserInput & { isActive: boolean }>) =>
    request<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id: string) => request<User>(`/users/${id}`, { method: 'DELETE' }),

  getEmployees: () => request<EmployeeProfile[]>('/hr/employees'),
  createEmployee: (data: CreateEmployeeInput) =>
    request<EmployeeProfile>('/hr/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: Partial<CreateEmployeeInput & { status: string }>) =>
    request<EmployeeProfile>(`/hr/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEmployee: (id: string) => request<EmployeeProfile>(`/hr/employees/${id}`, { method: 'DELETE' }),
  getHrDashboard: (params?: { department?: string; year?: number }) => {
    const q = new URLSearchParams();
    if (params?.department) q.set('department', params.department);
    if (params?.year) q.set('year', String(params.year));
    const qs = q.toString();
    return request<HrDashboard>(`/hr/dashboard${qs ? `?${qs}` : ''}`);
  },
  getLeaveBalance: (userId?: string, year?: number) => {
    const q = new URLSearchParams();
    if (userId) q.set('userId', userId);
    if (year) q.set('year', String(year));
    const qs = q.toString();
    return request<LeaveBalance>(`/hr/leave-balance${qs ? `?${qs}` : ''}`);
  },
  getLeaveCalendar: (start: string, end: string, department?: string) => {
    const q = new URLSearchParams({ start, end });
    if (department) q.set('department', department);
    return request<LeaveRequest[]>(`/hr/leave-calendar?${q.toString()}`);
  },
  getJobFunctions: () => request<JobFunction[]>(`/hr/functions`),
  createJobFunction: (data: { name: string; department?: string; activities?: string[] }) =>
    request<JobFunction>('/hr/functions', { method: 'POST', body: JSON.stringify(data) }),
  addJobActivity: (functionId: string, name: string) =>
    request(`/hr/functions/${functionId}/activities`, { method: 'POST', body: JSON.stringify({ name }) }),
  getMyJobActivities: () => request<JobFunctionActivity[]>('/hr/functions/my-activities'),
  getActivityDeclarations: (userId?: string) =>
    request<ActivityDeclaration[]>(`/hr/declarations${userId ? `?userId=${userId}` : ''}`),
  declareActivity: (data: { activityId?: string; date: string; comment?: string; attachmentUrl?: string }) =>
    request<ActivityDeclaration>('/hr/declarations', { method: 'POST', body: JSON.stringify(data) }),
  validateDeclaration: (id: string) =>
    request(`/hr/declarations/${id}/validate`, { method: 'PATCH' }),
  rejectDeclaration: (id: string, reason: string) =>
    request(`/hr/declarations/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  getObjectives: (userId?: string, year?: number) => {
    const q = new URLSearchParams();
    if (userId) q.set('userId', userId);
    if (year) q.set('year', String(year));
    const qs = q.toString();
    return request<PerformanceObjective[]>(`/hr/objectives${qs ? `?${qs}` : ''}`);
  },
  createObjective: (data: { userId: string; title: string; year: number; weight: number; periodType?: string; quarter?: number; description?: string }) =>
    request<PerformanceObjective>('/hr/objectives', { method: 'POST', body: JSON.stringify(data) }),
  getReviews: (year?: number) => request<PerformanceReview[]>(`/hr/reviews${year ? `?year=${year}` : ''}`),
  getReviewRanking: (year: number, department?: string) => {
    const q = new URLSearchParams({ year: String(year) });
    if (department) q.set('department', department);
    return request<PerformanceReview[]>(`/hr/reviews/ranking?${q.toString()}`);
  },
  submitSelfReview: (data: { year: number; period: string; selfScores: Record<string, number>; selfComment?: string }) =>
    request<PerformanceReview>('/hr/reviews/self', { method: 'POST', body: JSON.stringify(data) }),
  validateReview: (id: string, data: { managerScores: Record<string, number>; managerComment?: string }) =>
    request(`/hr/reviews/${id}/validate`, { method: 'PATCH', body: JSON.stringify(data) }),
  getTrainings: () => request<TrainingCourse[]>('/hr/trainings'),
  createTraining: (data: { title: string; kind?: string; provider?: string; location?: string; startDate?: string; endDate?: string }) =>
    request<TrainingCourse>('/hr/trainings', { method: 'POST', body: JSON.stringify(data) }),
  getTrainingEnrollments: () => request<TrainingEnrollment[]>('/hr/trainings/enrollments'),
  enrollTraining: (courseId: string) =>
    request(`/hr/trainings/${courseId}/enroll`, { method: 'POST' }),
  validateEnrollment: (id: string) =>
    request(`/hr/trainings/enrollments/${id}/validate`, { method: 'PATCH' }),
  rejectEnrollment: (id: string, reason: string) =>
    request(`/hr/trainings/enrollments/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  followEnrollment: (id: string, certificateUrl?: string) =>
    request(`/hr/trainings/enrollments/${id}/follow`, { method: 'PATCH', body: JSON.stringify({ certificateUrl }) }),
  getHrDocuments: (params?: { employeeId?: string; type?: string; q?: string }) => {
    const q = new URLSearchParams();
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    if (params?.type) q.set('type', params.type);
    if (params?.q) q.set('q', params.q);
    const qs = q.toString();
    return request<HrDocument[]>(`/hr/documents${qs ? `?${qs}` : ''}`);
  },
  addHrDocument: (data: { employeeId: string; type: string; title: string; fileUrl?: string; issuedAt?: string }) =>
    request<HrDocument>('/hr/documents', { method: 'POST', body: JSON.stringify(data) }),
  getEmployeeHistory: (id: string) => request<EmployeeFieldHistory[]>(`/hr/employees/${id}/history`),
  getLeaves: () => request<LeaveRequest[]>('/hr/leaves'),
  getMyLeaves: () => request<LeaveRequest[]>('/hr/leaves/me'),
  createLeave: (data: CreateLeaveInput) =>
    request<LeaveRequest>('/hr/leaves', { method: 'POST', body: JSON.stringify(data) }),
  validateLeave: (id: string) => request<LeaveRequest>(`/hr/leaves/${id}/validate`, { method: 'PATCH' }),
  rejectLeave: (id: string, reason?: string) =>
    request<LeaveRequest>(`/hr/leaves/${id}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  cancelLeave: (id: string) => request<void>(`/hr/leaves/${id}`, { method: 'DELETE' }),
  getPayrollPeriods: () => request<PayrollPeriod[]>('/hr/payroll/periods'),
  createPayrollPeriod: (data: { year: number; month: number; expectedDays?: number }) =>
    request<PayrollPeriod>('/hr/payroll/periods', { method: 'POST', body: JSON.stringify(data) }),
  computePayroll: (id: string) =>
    request<PayrollPeriod>(`/hr/payroll/periods/${id}/compute`, { method: 'POST' }),
  validatePayrollPeriod: (id: string) =>
    request<PayrollPeriod>(`/hr/payroll/periods/${id}/validate`, { method: 'PATCH' }),
  closePayrollPeriod: (id: string) =>
    request<PayrollPeriod>(`/hr/payroll/periods/${id}/close`, { method: 'PATCH' }),
  deletePayrollPeriod: (id: string) =>
    request<void>(`/hr/payroll/periods/${id}`, { method: 'DELETE' }),
  getPayslips: (periodId: string) => request<Payslip[]>(`/hr/payroll/periods/${periodId}/payslips`),
  updatePayslip: (id: string, data: { overtimeHours?: number; bonuses?: number; deductions?: number }) =>
    request<Payslip>(`/hr/payroll/payslips/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  validatePayslip: (id: string) =>
    request<Payslip>(`/hr/payroll/payslips/${id}/validate`, { method: 'PATCH' }),
    payPayslip: (id: string, paymentReference?: string) =>
    request<Payslip>(`/hr/payroll/payslips/${id}/pay`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentReference }),
    }),

  getMyActivityReport: (date: string) =>
    request<ActivityReportDetail>(`/hr/activity-reports/me?date=${date}`),
  saveMyActivityReport: (data: { date: string; summary?: string; incidents?: string }) =>
    request<DailyActivityReport>('/hr/activity-reports/me', { method: 'POST', body: JSON.stringify(data) }),
  getActivityOverview: (date: string) =>
    request<ActivityOverview>(`/hr/activity-reports/overview?date=${date}`),
  getAgentActivityReport: (userId: string, date: string) =>
    request<ActivityReportDetail>(`/hr/activity-reports/${userId}?date=${date}`),
  validateActivityReport: (id: string) =>
    request<DailyActivityReport>(`/hr/activity-reports/${id}/validate`, { method: 'PATCH' }),

  getConsigneMovements: () => request<ConsigneMovement[]>('/consignes'),
  createConsigneMovement: (data: { clientId: string; productFormat: string; qtyIn: number; qtyOut: number; notes?: string }) =>
    request<ConsigneMovement>('/consignes', { method: 'POST', body: JSON.stringify(data) }),
  updateConsigneMovement: (id: string, data: { productFormat?: string; qtyIn?: number; qtyOut?: number; notes?: string }) =>
    request<ConsigneMovement>(`/consignes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteConsigneMovement: (id: string) => request<void>(`/consignes/${id}`, { method: 'DELETE' }),

  getNotifications: (unreadOnly?: boolean) =>
    request<NotificationItem[]>(`/notifications${unreadOnly ? '?unread=true' : ''}`),
  getUnreadNotificationCount: () => request<{ count: number }>('/notifications/unread-count'),
  markNotificationRead: (id: string) =>
    request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () =>
    request('/notifications/read-all', { method: 'PATCH' }),

  // ---------------------------------------------------------------- IA (v3.0)
  getDemandForecast: (params?: { zone?: string; productId?: string }) => {
    const q = new URLSearchParams();
    if (params?.zone) q.set('zone', params.zone);
    if (params?.productId) q.set('productId', params.productId);
    const qs = q.toString();
    return request<DemandForecast[]>(`/ai/demand-forecast${qs ? `?${qs}` : ''}`);
  },
  runDemandForecast: () =>
    request<ModelRunResult>('/ai/demand-forecast/run', { method: 'POST' }),
  getAnomalies: (status?: string) =>
    request<Anomaly[]>(`/ai/anomalies${status ? `?status=${status}` : ''}`),
  runAnomalyDetection: () =>
    request<ModelRunResult>('/ai/anomalies/run', { method: 'POST' }),
  updateAnomalyStatus: (id: string, status: AnomalyStatus) =>
    request<Anomaly>(`/ai/anomalies/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getMaintenanceRisks: () => request<MaintenanceRisk[]>('/ai/maintenance-risk'),
  runMaintenanceRisk: () =>
    request<ModelRunResult>('/ai/maintenance-risk/run', { method: 'POST' }),
  getModelRuns: () => request<ModelRun[]>('/ai/model-runs'),
  getCreditScore: (clientId: string) =>
    request<CreditScore>(`/ai/credit-score/${clientId}`),
  getRecommendations: (clientId: string) =>
    request<Recommendation[]>(`/ai/recommendations/${clientId}`),

  // --------------------------------------------------- Assistant conversationnel
  askAssistant: (data: { question: string; sessionId?: string; channel?: AssistantChannel }) =>
    request<AssistantAnswer>('/assistant/query', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAssistantSessions: () => request<AssistantSession[]>('/assistant/sessions'),
  getAssistantSession: (id: string) =>
    request<AssistantSession>(`/assistant/sessions/${id}`),
  escalateAssistantSession: (id: string) =>
    request<AssistantSession>(`/assistant/sessions/${id}/escalate`, { method: 'POST' }),

  // --------------------------------------------------------------- IoT (v3.0)
  getSensors: (kind?: SensorKind) =>
    request<IotSensor[]>(`/iot/sensors${kind ? `?kind=${kind}` : ''}`),
  createSensor: (data: CreateSensorInput) =>
    request<IotSensor>('/iot/sensors', { method: 'POST', body: JSON.stringify(data) }),
  updateSensor: (id: string, data: Partial<CreateSensorInput> & { status?: SensorStatus }) =>
    request<IotSensor>(`/iot/sensors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteSensor: (id: string) => request<void>(`/iot/sensors/${id}`, { method: 'DELETE' }),
  getSensorReadings: (sensorId: string, limit = 50) =>
    request<SensorReading[]>(`/iot/sensors/${sensorId}/readings?limit=${limit}`),
  createSensorReading: (sensorId: string, value: number) =>
    request<SensorReading>(`/iot/sensors/${sensorId}/readings`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    }),
  getVehicleTelemetry: () => request<VehicleTelemetry[]>('/iot/telemetry/vehicles'),
  getConnectedFountains: () => request<FountainTelemetry[]>('/iot/fountains'),

  // ------------------------------------------------ Optimisation d'itinéraires
  getOptimizedRoutes: () => request<OptimizedRoute[]>('/routing/routes'),
  getOptimizedRoute: (tourId: string) =>
    request<OptimizedRoute | null>(`/tours/${tourId}/optimized-route`),
  computeOptimizedRoute: (tourId: string) =>
    request<OptimizedRoute>(`/tours/${tourId}/optimized-route`, { method: 'POST' }),
  adjustOptimizedRoute: (tourId: string, stops: RouteStop[]) =>
    request<OptimizedRoute>(`/tours/${tourId}/optimized-route`, {
      method: 'PATCH',
      body: JSON.stringify({ stops }),
    }),
  applyOptimizedRoute: (tourId: string) =>
    request<OptimizedRoute>(`/tours/${tourId}/optimized-route/apply`, { method: 'POST' }),

  // --------------------------------------------------------------- ESG (v3.0)
  getEsgDashboard: () => request<EsgDashboard>('/esg/dashboard'),
  getEsgIndicators: (scope?: EsgScope) =>
    request<EsgIndicator[]>(`/esg/indicators${scope ? `?scope=${scope}` : ''}`),
  computeEsgIndicators: () =>
    request<{ generated: number }>('/esg/compute', { method: 'POST' }),
  getEsgReport: (periodStart: string, periodEnd: string) =>
    request<EsgReport>(`/esg/report?periodStart=${periodStart}&periodEnd=${periodEnd}`),

  // ---------------------------------------------------- Centre de sécurité
  getSecurityAlerts: (status?: string) =>
    request<SecurityAlert[]>(`/security/center/alerts${status ? `?status=${status}` : ''}`),
  updateSecurityAlert: (id: string, status: SecurityAlertStatus) =>
    request<SecurityAlert>(`/security/center/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getSecuritySummary: () => request<SecuritySummary>('/security/center/summary'),
  getSecurityAudit: (limit = 100) =>
    request<AuditEntry[]>(`/security/center/audit?limit=${limit}`),
  getMfaStatus: () => request<MfaStatus>('/security/mfa/status'),
  setupMfa: () => request<MfaSetup>('/security/mfa/setup', { method: 'POST' }),
  confirmMfa: (code: string) =>
    request<{ confirmed: boolean }>('/security/mfa/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  disableMfa: (code: string) =>
    request<{ disabled: boolean }>('/security/mfa', {
      method: 'DELETE',
      body: JSON.stringify({ code }),
    }),
  /** Reconfirmation avant une action sensible (ESE-09). */
  stepUp: (code: string) =>
    request<{ verified: boolean; expiresAt: string }>('/security/step-up', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  // ------------------------------------------ Comptes portail (back-office)
  getPortalAccounts: () => request<PortalAccount[]>('/portal/accounts'),
  createPortalAccount: (data: CreatePortalAccountInput) =>
    request<PortalAccount>('/portal/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updatePortalAccount: (id: string, data: { isActive?: boolean; fullName?: string; password?: string }) =>
    request<PortalAccount>(`/portal/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePortalAccount: (id: string) =>
    request<void>(`/portal/accounts/${id}`, { method: 'DELETE' }),

  // ------------------------------------------------------- Marketplace B2B
  getQuoteRequests: (status?: string) =>
    request<QuoteRequest[]>(`/marketplace/quote-requests${status ? `?status=${status}` : ''}`),
  createQuoteRequest: (data: CreateQuoteRequestInput) =>
    request<QuoteRequest>('/marketplace/quote-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateQuoteRequest: (id: string, data: { status?: QuoteRequestStatus; quotedAmount?: number }) =>
    request<QuoteRequest>(`/marketplace/quote-requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  convertQuoteRequest: (id: string) =>
    request<Order>(`/marketplace/quote-requests/${id}/convert`, { method: 'POST' }),
  deleteQuoteRequest: (id: string) =>
    request<void>(`/marketplace/quote-requests/${id}`, { method: 'DELETE' }),

  // ------------------------------------------------ API publique & webhooks
  getApiKeys: () => request<ApiKeyInfo[]>('/integrations/api-keys'),
  createApiKey: (data: { label: string; partner: string; scopes: string[] }) =>
    request<ApiKeyInfo & { key: string }>('/integrations/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  revokeApiKey: (id: string) =>
    request<void>(`/integrations/api-keys/${id}`, { method: 'DELETE' }),
  getWebhooks: () => request<WebhookSubscription[]>('/integrations/webhooks'),
  createWebhook: (data: { label: string; url: string; events: string[] }) =>
    request<WebhookSubscription>('/integrations/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteWebhook: (id: string) =>
    request<void>(`/integrations/webhooks/${id}`, { method: 'DELETE' }),
  testWebhook: (id: string) =>
    request<WebhookDelivery>(`/integrations/webhooks/${id}/test`, { method: 'POST' }),
  getWebhookDeliveries: (id: string) =>
    request<WebhookDelivery[]>(`/integrations/webhooks/${id}/deliveries`),

  // ------------------------------------ Préférences, vues, recherche globale
  getPreferences: () => request<UserPreference>('/preferences'),
  updatePreferences: (data: { theme?: string; dashboardLayout?: DashboardPanelPref[] }) =>
    request<UserPreference>('/preferences', { method: 'PATCH', body: JSON.stringify(data) }),
  getSavedViews: (resource?: string) =>
    request<SavedView[]>(`/saved-views${resource ? `?resource=${resource}` : ''}`),
  createSavedView: (data: { resource: string; name: string; filters: Record<string, unknown>; isDefault?: boolean }) =>
    request<SavedView>('/saved-views', { method: 'POST', body: JSON.stringify(data) }),
  deleteSavedView: (id: string) => request<void>(`/saved-views/${id}`, { method: 'DELETE' }),
  globalSearch: (q: string) =>
    request<GlobalSearchResults>(`/search?q=${encodeURIComponent(q)}`),
};

// ============================================================================
// Portail client self-service — jeton distinct du back-office (EF-PC-01)
// ============================================================================

const PORTAL_TOKEN_KEY = 'portalToken';

function parsePortalError(text: string, status: number): string {
  try {
    const json = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(json.message)) return json.message.join(' ');
    if (typeof json.message === 'string' && json.message.trim()) return json.message;
  } catch {
    /* texte brut */
  }
  return text || `Erreur API (${status})`;
}

async function portalRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(PORTAL_TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const publicAuth = path.includes('/auth/login') || path.includes('/auth/register');
    if (response.status === 401 && !publicAuth) {
      localStorage.removeItem(PORTAL_TOKEN_KEY);
      localStorage.removeItem('portalAccount');
      if (
        !window.location.pathname.startsWith('/portail/connexion')
        && !window.location.pathname.startsWith('/portail/inscription')
      ) {
        window.location.replace('/portail/connexion?expired=1');
      }
      throw new Error('Session expirée — veuillez vous reconnecter.');
    }
    throw new Error(parsePortalError(text, response.status));
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const portalApi = {
  login: (email: string, password: string) =>
    portalRequest<{ accessToken: string; account: PortalAccount }>('/portal/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (data: RegisterPortalInput) =>
    portalRequest<{ accessToken: string; account: PortalAccount }>('/portal/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  me: () => portalRequest<PortalMe>('/portal/me'),
  getCatalog: () => portalRequest<PortalCatalogItem[]>('/portal/catalog'),
  getOrders: () => portalRequest<Order[]>('/portal/orders'),
  createOrder: (data: { lines: Array<{ productId: string; quantity: number }>; notes?: string }) =>
    portalRequest<Order>('/portal/orders', { method: 'POST', body: JSON.stringify(data) }),
  getDeliveries: () => portalRequest<Delivery[]>('/portal/deliveries'),
  getDeliveryTracking: (id: string) =>
    portalRequest<DeliveryTracking>(`/portal/deliveries/${id}/tracking`),
  getInvoices: () => portalRequest<PortalInvoice[]>('/portal/invoices'),
  pay: (data: { orderId?: string; amount: number; method: PaymentMethod; reference?: string }) =>
    portalRequest<Payment>('/portal/payments', { method: 'POST', body: JSON.stringify(data) }),
  getLoyalty: () => portalRequest<PortalLoyalty>('/portal/loyalty'),
  redeemLoyalty: (points: number) =>
    portalRequest<PortalLoyalty>('/portal/loyalty/redeem', {
      method: 'POST',
      body: JSON.stringify({ points }),
    }),
  getConsignes: () => portalRequest<PortalConsigne[]>('/portal/consignes'),
  ask: (question: string, sessionId?: string) =>
    portalRequest<AssistantAnswer>('/portal/assistant/query', {
      method: 'POST',
      body: JSON.stringify({ question, sessionId }),
    }),
};

export interface CreateClientInput {
  code: string;
  name: string;
  segment: ClientSegment;
  avenue?: string;
  avenueNumber?: string;
  quartier?: string;
  commune?: string;
  district?: string;
  province?: string;
  city?: string;
  zone?: string;
  phone?: string;
  email?: string;
  idDocumentType?: string;
  idDocumentNumber?: string;
  logoUrl?: string;
  profession?: string;
  latitude?: number;
  longitude?: number;
  consigneLimit?: number;
}

export interface CreateTourInput {
  zone: string;
  date: string;
  driverId: string;
  vehicleId: string;
  orderIds?: string[];
}

export interface CreateOrderInput {
  clientId: string;
  tourId?: string;
  driverId?: string;
  notes?: string;
  lines: Array<{ productId: string; quantity: number; discount?: number }>;
}

export type PricingRuleType = 'PERCENT' | 'FIXED';

export interface PricingRule {
  id: string;
  name: string;
  segment?: ClientSegment | null;
  clientId?: string | null;
  zone?: string | null;
  driverId?: string | null;
  productId?: string | null;
  minQuantity: number;
  maxQuantity?: number | null;
  stepQuantity?: number;
  type: PricingRuleType;
  value: string | number;
  priority: number;
  isActive: boolean;
  product?: { id: string; code: string; name: string } | null;
  client?: { id: string; code: string; name: string } | null;
  driver?: { id: string; firstName: string; lastName: string } | null;
}

export interface CreatePricingRuleInput {
  name: string;
  segment?: ClientSegment | null;
  clientId?: string | null;
  zone?: string | null;
  driverId?: string | null;
  productId?: string | null;
  minQuantity: number;
  maxQuantity?: number | null;
  stepQuantity?: number;
  type: PricingRuleType;
  value: number;
  priority?: number;
  isActive?: boolean;
}

export interface PricePreview {
  segment: ClientSegment;
  zone?: string | null;
  quantity: number;
  catalogPrice: number;
  unitPrice: number;
  lineTotal: number;
  discount: number;
  discountPct: number;
  ruleId: string | null;
  ruleName: string | null;
  type: PricingRuleType | null;
  stepQuantity?: number;
  discountedQuantity?: number;
  fullPriceQuantity?: number;
}

export interface CreateDeliveryInput {
  orderId: string;
  tourId: string;
  latitude?: number;
  longitude?: number;
  lines: Array<{
    productId: string;
    qtyDelivered: number;
    qtyReturned?: number;
    qtyDamaged?: number;
    qtyRefused?: number;
    unitPrice: number;
  }>;
}

export interface CreatePaymentInput {
  clientId?: string;
  deliveryId?: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
}

export interface CreateQualityCheckInput {
  lotNumber: string;
  ph?: number;
  chlorineFree?: number;
  tds?: number;
  turbidity?: number;
  microbiologyOk?: boolean;
}

export interface CreateShiftInput {
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  postLabel: string;
  notes?: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
}

export interface CreateProductInput {
  code: string;
  name: string;
  format: string;
  unitPrice: number;
  consigneAmount?: number;
  isReusable?: boolean;
}

export interface CreateEmployeeInput {
  userId: string;
  matricule?: string;
  jobTitle: string;
  department: string;
  contractType?: string;
  hireDate: string;
  endDate?: string;
  baseSalary: number;
  bankName?: string;
  bankAccount?: string;
  cnssNumber?: string;
  nif?: string;
  notes?: string;
  gender?: string;
  birthDate?: string;
  address?: string;
  avenue?: string;
  avenueNumber?: string;
  quartier?: string;
  commune?: string;
  district?: string;
  maritalStatus?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  photoUrl?: string;
  managerId?: string;
  jobFunctionId?: string;
  annualLeaveDays?: number;
}

export interface EmployeeProfile {
  id: string;
  userId?: string;
  matricule: string;
  jobTitle: string;
  department: string;
  contractType: string;
  hireDate: string;
  endDate?: string;
  baseSalary: string | number;
  bankName?: string;
  bankAccount?: string;
  cnssNumber?: string;
  nif?: string;
  status: string;
  gender?: string | null;
  birthDate?: string | null;
  address?: string | null;
  avenue?: string | null;
  avenueNumber?: string | null;
  quartier?: string | null;
  commune?: string | null;
  district?: string | null;
  province?: string | null;
  maritalStatus?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  photoUrl?: string | null;
  managerId?: string | null;
  jobFunctionId?: string | null;
  annualLeaveDays?: number;
  user?: User;
  manager?: User | null;
  jobFunction?: JobFunction | null;
}

export interface JobFunctionActivity {
  id: string;
  name: string;
  description?: string;
  jobFunction?: { id: string; name: string; department?: string };
}

export interface ActivityObjective {
  id: string;
  userId: string;
  activityId: string;
  title: string;
  periodType: string;
  year: number;
  month?: number | null;
  quarter?: number | null;
  targetValue: number;
  unit: string;
  notes?: string | null;
  isActive: boolean;
  actualValue: number;
  remaining: number;
  progressPct: number;
  status: 'ATTEINT' | 'EN_COURS' | 'EN_RETARD';
  user?: User;
  activity?: JobFunctionActivity;
}

export interface CreateActivityObjectiveInput {
  userId: string;
  activityId: string;
  title: string;
  periodType?: string;
  year: number;
  month?: number | null;
  quarter?: number | null;
  targetValue: number;
  unit?: string;
  notes?: string;
}

export interface JobFunction {
  id: string;
  name: string;
  department?: string;
  activities: JobFunctionActivity[];
  _count?: { employees: number };
}

export interface ActivityDeclaration {
  id: string;
  date: string;
  comment?: string;
  status: string;
  rejectionReason?: string | null;
  user?: User;
  activity?: JobFunctionActivity | null;
}

export interface PerformanceObjective {
  id: string;
  userId: string;
  title: string;
  year: number;
  quarter?: number | null;
  periodType: string;
  weight: string | number;
  user?: User;
}

export interface PerformanceReview {
  id: string;
  userId: string;
  year: number;
  period: string;
  status: string;
  finalScore?: string | number | null;
  selfComment?: string | null;
  managerComment?: string | null;
  selfScores?: Record<string, number> | null;
  managerScores?: Record<string, number> | null;
  user?: User & { employeeProfile?: { department?: string; matricule?: string } };
}

export interface TrainingCourse {
  id: string;
  title: string;
  kind: string;
  provider?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface TrainingEnrollment {
  id: string;
  status: string;
  certificateUrl?: string | null;
  rejectionReason?: string | null;
  course?: TrainingCourse;
  user?: User;
}

export interface HrDocument {
  id: string;
  type: string;
  title: string;
  fileUrl?: string | null;
  issuedAt?: string | null;
  createdAt: string;
  employee?: EmployeeProfile;
}

export interface EmployeeFieldHistory {
  id: string;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
  actor?: { firstName: string; lastName: string };
}

export interface LeaveBalance {
  year: number;
  rights: number;
  consumed: number;
  remaining: number;
}

export interface HrDashboard {
  year: number;
  department?: string | null;
  effectifs: { total: number; archived: number; byDepartment: Record<string, number>; byGender: Record<string, number> };
  conges: { consumed: number; remaining: number; rights: number; absentToday: number };
  activites: { declared: number; validated: number; rejected: number; rate: number };
  performance: { average: number; reviews: number; objectives: number };
  formations: { inscribed: number; followed: number };
  alerts: {
    contractsEnding: Array<{ matricule: string; name: string; endDate?: string | null }>;
    birthdays: Array<{ matricule: string; name: string; birthDate?: string | null }>;
  };
}

export interface DailyActivityReport {
  id: string;
  userId: string;
  date: string;
  activities: Record<string, unknown>;
  incidents?: string | null;
  validated: boolean;
}

export interface ActivityMetrics {
  deliveries: number;
  delivered: number;
  refused: number;
  qtyDelivered: number;
  tours: number;
  paymentsCount: number;
  paymentsAmount: number;
  shifts: number;
}

export interface ActivityReportDetail {
  user: User;
  date: string;
  metrics: ActivityMetrics;
  deliveries: Array<{ id: string; deliveryNumber: string; status: string; clientName?: string; qtyDelivered: number }>;
  tours: Array<{ id: string; tourNumber: string; zone: string; status: string }>;
  payments: Array<{ id: string; paymentNumber: string; amount: number; method: string }>;
  shifts: ShiftAssignment[];
  report: DailyActivityReport | null;
  summary: string;
  incidents: string;
}

export interface ActivityOverviewRow {
  user: User;
  deliveries: number;
  delivered: number;
  refused: number;
  tours: number;
  shifts: number;
  paymentsCount: number;
  paymentsAmount: number;
  submitted: boolean;
  validated: boolean;
  incidents: string;
  reportId: string | null;
}

export interface ActivityOverview {
  date: string;
  totals: {
    agents: number;
    submitted: number;
    validated: number;
    deliveries: number;
    tours: number;
    paymentsAmount: number;
  };
  rows: ActivityOverviewRow[];
}

export interface CreateLeaveInput {
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface LeaveRequest {
  id: string;
  userId?: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: string;
  rejectionReason?: string | null;
  user?: User & { employeeProfile?: { department?: string; matricule?: string } };
}

export interface PayrollPeriod {
  id: string;
  year: number;
  month: number;
  status: string;
  expectedDays: number;
  _count?: { payslips: number };
}

export interface Payslip {
  id: string;
  workedDays: number;
  overtimeHours: string | number;
  bonuses: string | number;
  deductions: string | number;
  cnssEmployee: string | number;
  iprf: string | number;
  grossPay: string | number;
  netPay: string | number;
  baseSalary: string | number;
  status: string;
  user?: User;
  employee?: { matricule: string; jobTitle: string };
}

export interface ConsigneMovement {
  id: string;
  productFormat: string;
  qtyIn: number;
  qtyOut: number;
  balanceAfter: number;
  createdAt: string;
  client?: { name: string; code: string };
}

export interface DashboardOverview {
  clientsCount: number;
  ordersToday: number;
  deliveriesToday: number;
  revenueToday: number | string;
  activeTours: number;
  totalStock: number;
  stockByProduct: Record<string, number>;
}

export interface Client {
  id: string;
  code: string;
  name: string;
  segment: string;
  address?: string;
  avenue?: string;
  avenueNumber?: string;
  quartier?: string;
  commune?: string;
  district?: string;
  province?: string;
  city?: string;
  zone?: string;
  phone?: string;
  email?: string;
  idDocumentType?: string;
  idDocumentNumber?: string;
  logoUrl?: string;
  profession?: string;
  latitude?: number;
  longitude?: number;
  consigneBalance: number;
  consigneLimit: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  format: string;
  unitPrice: string | number;
  isReusable: boolean;
}

export interface Tour {
  id: string;
  tourNumber: string;
  zone: string;
  status: string;
  date: string;
  driverId?: string;
  driver?: { id: string; firstName: string; lastName: string };
  vehicle?: { id: string; plate: string; name: string };
  orders?: Order[];
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  clientId?: string;
  totalAmount: string | number;
  client?: { name: string };
  lines?: Array<{
    productId: string;
    quantity: number;
    unitPrice: string | number;
    discount?: string | number;
    product?: { name: string; isReusable: boolean };
  }>;
}

export interface StockItem {
  id: string;
  quantity: number;
  lotNumber?: string;
  product: Product;
  location: { name: string; code: string };
}

export type StockLocationType =
  | 'MATIERES_PREMIERES'
  | 'PRODUCTION'
  | 'BIDONS_A_TRIER'
  | 'BIDONS_LAVAGE'
  | 'BIDONS_LIBERES'
  | 'PRODUITS_FINIS'
  | 'VEHICULE'
  | 'QUARANTAINE'
  | 'RETRAITEMENT'
  | 'REPARATION'
  | 'REBUT';

export interface StockLocation {
  id: string;
  code: string;
  name: string;
  type: StockLocationType;
  vehicleId?: string | null;
  vehicle?: { id: string; plate: string; name: string } | null;
}

export interface CreateStockLocationInput {
  code: string;
  name: string;
  type: StockLocationType;
  vehicleId?: string;
}

export type PackagingKind = 'EMBALLAGE' | 'ETIQUETTE' | 'BOUCHON';
export type PackagingPackFormat = 'BIDON_5L' | 'BIDON_10L' | 'BIDON_25L' | 'BONBONNE_5G';
export type PackagingMovementType = 'ACHAT' | 'UTILISATION' | 'VENTE' | 'DECLASSEMENT';

export interface PackagingSku {
  id: string;
  code: string;
  name: string;
  kind: PackagingKind;
  format: PackagingPackFormat;
  minStock: number;
  isActive: boolean;
  stock?: { id: string; quantity: number } | null;
}

export interface PackagingSummary {
  EMBALLAGE: { kind: PackagingKind; quantity: number; skuCount: number; lowStock: number };
  ETIQUETTE: { kind: PackagingKind; quantity: number; skuCount: number; lowStock: number };
  BOUCHON: { kind: PackagingKind; quantity: number; skuCount: number; lowStock: number };
}

export interface PackagingMovement {
  id: string;
  skuId: string;
  type: PackagingMovementType;
  quantity: number;
  unitCost?: string | number | null;
  supplier?: string | null;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
  sku: PackagingSku;
  createdBy?: { firstName: string; lastName: string } | null;
}

export interface CreatePackagingSkuInput {
  code: string;
  name: string;
  kind: PackagingKind;
  format: PackagingPackFormat;
  minStock?: number;
}

export interface CreatePackagingMovementInput {
  skuId: string;
  type: PackagingMovementType;
  quantity: number;
  unitCost?: number;
  supplier?: string;
  reference?: string;
  notes?: string;
}

export interface Delivery {
  id: string;
  deliveryNumber: string;
  status: string;
  deliveredAt?: string;
  client?: { name: string };
}

export interface Payment {
  id: string;
  amount: string | number;
  method: string;
  reference?: string;
  createdAt: string;
  clientId?: string;
  client?: { name: string };
}

export interface PosCatalog {
  walkInClient: { id: string; code: string; name: string; segment: string };
  products: Array<{ id: string; code: string; name: string; format: string; unitPrice: number; isReusable: boolean }>;
  clients: Array<{ id: string; code: string; name: string; segment: string; zone?: string | null; phone?: string | null }>;
  methods: PaymentMethod[];
}

export interface PosQuoteLine {
  productId: string;
  code: string;
  name: string;
  format: string;
  quantity: number;
  catalogPrice: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  ruleName: string | null;
}

export interface PosQuote {
  client: { id: string; code: string; name: string; segment: string };
  lines: PosQuoteLine[];
  subtotal: number;
  discount: number;
  total: number;
}

export interface PosSale {
  id: string;
  saleNumber: string;
  method: PaymentMethod;
  status: 'PAYEE' | 'ANNULEE';
  subtotal: string | number;
  discount: string | number;
  totalAmount: string | number;
  cashReceived?: string | number | null;
  changeGiven?: string | number | null;
  notes?: string | null;
  createdAt: string;
  client?: { id: string; code: string; name: string; segment: string };
  cashier?: { id: string; firstName: string; lastName: string };
  order?: { id: string; orderNumber: string; status: string } | null;
  payment?: { id: string; paymentNumber: string; method: string; amount: string | number } | null;
  lines?: Array<{
    productId: string;
    quantity: number;
    catalogPrice: string | number;
    unitPrice: string | number;
    discount: string | number;
    product?: { id: string; code: string; name: string; format: string };
  }>;
}

export interface PosSalesResponse {
  sales: PosSale[];
  summary: { tickets: number; cancelled: number; revenue: number; averageTicket: number };
}

export interface PosCheckoutInput {
  clientId?: string | null;
  lines: Array<{ productId: string; quantity: number }>;
  method: PaymentMethod;
  cashReceived?: number;
  reference?: string;
  notes?: string;
}

export interface ProductionOrder {
  id: string;
  orderNumber: string;
  lotNumber: string;
  productFormat: string;
  lineCode: string;
  plannedQty: number;
  producedQty: number;
  lotStatus: string;
  status: string;
}

export interface QualityCheck {
  id: string;
  lotNumber: string;
  ph?: number;
  chlorineFree?: number;
  tds?: number;
  turbidity?: number;
  microbiologyOk?: boolean;
  status: string;
}

export interface LoyaltyClient {
  id: string;
  code: string;
  name: string;
  segment: string;
  loyaltyPoints: number;
  loyaltyTier: string;
  walletBalance: string | number;
}

export interface ShiftAssignment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  postLabel: string;
  validated: boolean;
  user?: { firstName: string; lastName: string; role: string };
}

export interface PackagingUnit {
  id: string;
  barcode: string;
  productFormat: string;
  rotationCount: number;
  maxRotations: number;
  status: string;
}

export interface FountainAsset {
  id: string;
  serialNumber: string;
  model?: string;
  contractType?: string;
  nextService?: string;
}

export interface ObservabilityStatus {
  pendingSync: number;
  blockedLots: number;
  openQualityChecks: number;
  pendingShiftValidations: number;
  services: Array<{ name: string; status: string }>;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

// ============================================================================
// Types v3.0 « Enterprise Smart & AI-Augmented »
// ============================================================================

/** Facteur explicatif d'une sortie de modèle (EF-IA-04). */
export interface ExplanationFactor {
  label: string;
  weight: number;
  detail?: string;
}

export interface DemandForecast {
  id: string;
  productId: string;
  zone: string;
  horizonDate: string;
  forecastQty: number;
  confidence: number;
  factors: ExplanationFactor[];
  modelVersion: string;
  generatedAt: string;
  product?: { code: string; name: string; format: string };
}

export interface ModelRunResult {
  generated: number;
  modelName: string;
  modelVersion: string;
  mapePct?: number;
  metrics: Record<string, number | string>;
}

export interface ModelRun {
  id: string;
  modelName: string;
  modelVersion: string;
  samples: number;
  mapePct?: number;
  metrics: Record<string, number | string>;
  ranAt: string;
}

export type AnomalyKind = 'STOCK' | 'CONSIGNE' | 'ENCAISSEMENT' | 'PRODUCTION' | 'CAPTEUR';
export type AnomalySeverity = 'FAIBLE' | 'MOYENNE' | 'ELEVEE' | 'CRITIQUE';
export type AnomalyStatus = 'OUVERTE' | 'EN_COURS' | 'RESOLUE' | 'IGNOREE';

export interface Anomaly {
  id: string;
  kind: AnomalyKind;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  entityType: string;
  entityId?: string;
  title: string;
  description: string;
  score: number;
  factors: ExplanationFactor[];
  detectedAt: string;
  resolvedAt?: string;
}

export interface MaintenanceRisk {
  id: string;
  equipmentCode: string;
  lineCode: string;
  riskScore: number;
  factors: ExplanationFactor[];
  predictedFailureAt?: string;
  computedAt: string;
}

export interface CreditScore {
  clientId: string;
  clientName: string;
  score: number;
  rating: 'A' | 'B' | 'C' | 'D';
  recommendedLimit: number;
  creditAllowed: boolean;
  factors: ExplanationFactor[];
}

export interface Recommendation {
  productId?: string;
  title: string;
  detail: string;
  suggestedQty?: number;
  factors: ExplanationFactor[];
}

export type AssistantChannel = 'BACKOFFICE' | 'PORTAIL' | 'WHATSAPP';

export interface AssistantAnswer {
  sessionId: string;
  answer: string;
  intent: string;
  confidence: number;
  escalated: boolean;
  suggestions?: string[];
}

export interface AssistantMessage {
  id: string;
  author: 'UTILISATEUR' | 'ASSISTANT';
  content: string;
  intent?: string;
  confidence?: number;
  createdAt: string;
}

export interface AssistantSession {
  id: string;
  channel: AssistantChannel;
  escalated: boolean;
  escalatedAt?: string;
  startedAt: string;
  lastMessageAt: string;
  messages?: AssistantMessage[];
  user?: { firstName: string; lastName: string; role: string };
  portalAccount?: { fullName: string; email: string };
}

export type SensorKind = 'QUALITE_LIGNE' | 'VEHICULE' | 'FONTAINE';
export type SensorStatus = 'ACTIF' | 'HORS_LIGNE' | 'MAINTENANCE';

export interface IotSensor {
  id: string;
  code: string;
  label: string;
  kind: SensorKind;
  metric: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  machineCode?: string;
  lineCode?: string;
  status: SensorStatus;
  lastSeenAt?: string;
  vehicle?: { plate: string; name: string };
  fountain?: { serialNumber: string };
  readings?: SensorReading[];
  lastValue?: number;
  outOfRange?: boolean;
}

export interface CreateSensorInput {
  code: string;
  label: string;
  kind: SensorKind;
  metric: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  machineCode?: string;
  lineCode?: string;
  vehicleId?: string;
  fountainId?: string;
}

export interface SensorReading {
  id: string;
  sensorId: string;
  value: number;
  outOfRange: boolean;
  recordedAt: string;
}

export interface VehicleTelemetry {
  vehicleId: string;
  plate: string;
  name: string;
  latitude?: number;
  longitude?: number;
  speedKmh?: number;
  fuelLevelPct?: number;
  lastSeenAt?: string;
  status: SensorStatus;
}

export interface FountainTelemetry {
  id: string;
  serialNumber: string;
  model?: string;
  clientName?: string;
  fillLevelPct?: number;
  needsRefill: boolean;
  nextService?: string;
  lastSeenAt?: string;
}

export interface RouteStop {
  order: number;
  clientId: string;
  clientName: string;
  latitude: number;
  longitude: number;
  priority: number;
}

export interface OptimizedRoute {
  id: string;
  tourId: string;
  stops: RouteStop[];
  totalDistanceKm: number;
  estimatedDurationMin: number;
  algorithm: string;
  manuallyAdjusted: boolean;
  appliedAt?: string;
  actualDistanceKm?: number;
  deviationPct?: number;
  generatedAt: string;
  tour?: { tourNumber: string; zone: string; date: string; status: string };
}

export type EsgScope = 'TOURNEE' | 'SITE';

export interface EsgIndicator {
  id: string;
  scope: EsgScope;
  periodStart: string;
  periodEnd: string;
  tourId?: string;
  distanceKm: number;
  co2Kg: number;
  waterM3: number;
  energyKwh: number;
  reusePct: number;
  computedAt: string;
  tour?: { tourNumber: string; zone: string };
}

export interface EsgDashboard {
  periodStart: string;
  periodEnd: string;
  totalCo2Kg: number;
  totalDistanceKm: number;
  co2PerDeliveryKg: number;
  waterM3: number;
  energyKwh: number;
  reusePct: number;
  monthlyTrend: Array<{ month: string; co2Kg: number; distanceKm: number }>;
  topTours: Array<{ tourNumber: string; zone: string; co2Kg: number; distanceKm: number }>;
}

export interface EsgReport {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  summary: EsgDashboard;
  rows: Array<Record<string, string | number>>;
}

export type SecurityAlertKind =
  | 'ECHEC_AUTHENTIFICATION'
  | 'ACCES_REFUSE'
  | 'ELEVATION_PRIVILEGE'
  | 'ACTIVITE_ANORMALE'
  | 'CONFORMITE';
export type SecurityAlertStatus = 'OUVERTE' | 'ANALYSEE' | 'CLOTUREE';

export interface SecurityAlert {
  id: string;
  kind: SecurityAlertKind;
  severity: AnomalySeverity;
  status: SecurityAlertStatus;
  source: string;
  message: string;
  email?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  user?: { firstName: string; lastName: string; role: string };
}

export interface SecuritySummary {
  openAlerts: number;
  criticalAlerts: number;
  failedLoginsLast24h: number;
  mfaEnabledCount: number;
  sensitiveAccountsCount: number;
  mfaCoveragePct: number;
  auditEventsLast24h: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress?: string;
  createdAt: string;
  user?: { firstName: string; lastName: string; role: string };
}

export interface MfaStatus {
  enabled: boolean;
  confirmed: boolean;
  sensitiveRole: boolean;
}

export interface MfaSetup {
  secret: string;
  otpauthUrl: string;
  /** Codes de test affichés en environnement de démonstration uniquement. */
  currentCode?: string;
}

export interface PortalAccount {
  id: string;
  email: string;
  fullName: string;
  clientId: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  client?: { code: string; name: string; segment: string };
}

export interface CreatePortalAccountInput {
  email: string;
  password: string;
  fullName: string;
  clientId: string;
}

export interface RegisterPortalInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  commune: string;
  avenue?: string;
  quartier?: string;
  district?: string;
  companyName?: string;
  segment?: ClientSegment;
}

export interface PortalMe {
  account: PortalAccount;
  client: Client & { loyaltyPoints: number; loyaltyTier: string; walletBalance: string | number };
  consigneBalance: number;
  consigneLimit: number;
  openOrders: number;
  outstandingAmount: number;
}

export interface PortalCatalogItem {
  id: string;
  code: string;
  name: string;
  format: string;
  isReusable: boolean;
  basePrice: number;
  segmentPrice: number;
  discountPct: number;
  tiers?: Array<{
    id: string;
    name: string;
    productId?: string | null;
    minQuantity: number;
    maxQuantity: number | null;
    type: PricingRuleType;
    value: number;
    priority: number;
    stepQuantity?: number;
  }>;
}

export interface DeliveryTracking {
  deliveryId: string;
  deliveryNumber: string;
  status: string;
  tourNumber?: string;
  driverName?: string;
  vehiclePlate?: string;
  latitude?: number;
  longitude?: number;
  etaMinutes?: number;
  stopsRemaining?: number;
  updatedAt: string;
  timeline: Array<{ label: string; at?: string; done: boolean }>;
}

export interface PortalInvoice {
  orderId: string;
  orderNumber: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
}

export interface PortalLoyalty {
  points: number;
  tier: string;
  walletBalance: number;
  nextTier?: string;
  pointsToNextTier?: number;
  benefits: string[];
  history: Array<{ label: string; points: number; at: string }>;
}

export interface PortalConsigne {
  id: string;
  type: string;
  quantity: number;
  productName?: string;
  createdAt: string;
}

export type QuoteRequestStatus = 'NOUVELLE' | 'EN_NEGOCIATION' | 'ACCEPTEE' | 'REFUSEE';

export interface QuoteRequest {
  id: string;
  reference: string;
  clientId?: string;
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  segment: ClientSegment;
  zone?: string;
  lines: Array<{ productId: string; productName: string; quantity: number }>;
  message?: string;
  status: QuoteRequestStatus;
  quotedAmount?: string | number;
  createdAt: string;
  client?: { code: string; name: string };
}

export interface CreateQuoteRequestInput {
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  segment: ClientSegment;
  zone?: string;
  clientId?: string;
  lines: Array<{ productId: string; quantity: number }>;
  message?: string;
}

export interface ApiKeyInfo {
  id: string;
  label: string;
  partner: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

export interface WebhookSubscription {
  id: string;
  label: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  deliveriesCount?: number;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  statusCode?: number;
  error?: string;
  attempts: number;
  deliveredAt?: string;
  createdAt: string;
}

export interface DashboardPanelPref {
  key: string;
  visible: boolean;
}

export interface UserPreference {
  theme: string;
  dashboardLayout?: DashboardPanelPref[];
}

export interface SavedView {
  id: string;
  resource: string;
  name: string;
  filters: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
}

export interface GlobalSearchResults {
  clients: Array<{ id: string; code: string; name: string; zone?: string }>;
  orders: Array<{ id: string; orderNumber: string; status: string; clientName?: string }>;
  lots: Array<{ id: string; lotNumber: string; status: string; productFormat: string }>;
  deliveries: Array<{ id: string; deliveryNumber: string; status: string; clientName?: string }>;
}
