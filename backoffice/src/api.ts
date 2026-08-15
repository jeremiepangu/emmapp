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

export interface Vehicle {
  id: string;
  plate: string;
  name: string;
  capacity: number;
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
    throw new Error(text || `Erreur API (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  login: (email: string, password: string, mfaCode?: string) =>
    request<{ accessToken: string; user: User; mfaRequired?: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...(mfaCode ? { mfaCode } : {}) }),
    }),

  getDashboard: () => request<DashboardOverview>('/dashboard/overview'),

  getClients: () => request<Client[]>('/clients'),
  createClient: (data: CreateClientInput) =>
    request<Client>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: string, data: Partial<CreateClientInput>) =>
    request<Client>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getProducts: () => request<Product[]>('/products'),

  getUsersByRole: (role: string) => request<User[]>(`/users/by-role?role=${role}`),

  getVehicles: () => request<Vehicle[]>('/vehicles'),

  getTours: (params?: { driverId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.driverId) q.set('driverId', params.driverId);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<Tour[]>(`/tours${qs ? `?${qs}` : ''}`);
  },
  createTour: (data: CreateTourInput) =>
    request<Tour>('/tours', { method: 'POST', body: JSON.stringify(data) }),
  startTour: (id: string) => request<Tour>(`/tours/${id}/start`, { method: 'PATCH' }),
  completeTour: (id: string) => request<Tour>(`/tours/${id}/complete`, { method: 'PATCH' }),

  getOrders: () => request<Order[]>('/orders'),
  createOrder: (data: CreateOrderInput) =>
    request<Order>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  validateOrder: (id: string) =>
    request<Order>(`/orders/${id}/validate`, { method: 'PATCH' }),

  getStock: () => request<StockItem[]>('/stock'),

  getDeliveries: () => request<Delivery[]>('/deliveries'),
  createDelivery: (data: CreateDeliveryInput) =>
    request<Delivery>('/deliveries', { method: 'POST', body: JSON.stringify(data) }),

  getPayments: () => request<Payment[]>('/payments'),
  createPayment: (data: CreatePaymentInput) =>
    request<Payment>('/payments', { method: 'POST', body: JSON.stringify(data) }),

  getProductionOrders: () => request<ProductionOrder[]>('/emmapure/production'),
  createProductionOrder: (data: { productFormat: string; lineCode: string; plannedQty: number }) =>
    request<ProductionOrder>('/emmapure/production', { method: 'POST', body: JSON.stringify(data) }),
  validateProductionOrder: (id: string) =>
    request<ProductionOrder>(`/emmapure/production/${id}/validate`, { method: 'PATCH' }),

  getQualityChecks: () => request<QualityCheck[]>('/emmapure/quality'),
  createQualityCheck: (data: CreateQualityCheckInput) =>
    request<QualityCheck>('/emmapure/quality', { method: 'POST', body: JSON.stringify(data) }),
  validateQualityCheck: (id: string, conform: boolean) =>
    request<QualityCheck>(`/emmapure/quality/${id}/validate`, {
      method: 'PATCH',
      body: JSON.stringify({ conform }),
    }),

  getLoyaltyClients: () => request<LoyaltyClient[]>('/emmapure/loyalty'),

  getShiftAssignments: (date?: string) => {
    const qs = date ? `?date=${date}` : '';
    return request<ShiftAssignment[]>(`/emmapure/shifts${qs}`);
  },
  createShiftAssignment: (data: CreateShiftInput) =>
    request<ShiftAssignment>('/emmapure/shifts', { method: 'POST', body: JSON.stringify(data) }),

  getPackagingUnits: () => request<PackagingUnit[]>('/emmapure/packaging'),
  getFountains: () => request<FountainAsset[]>('/emmapure/fountains'),
  getObservability: () => request<ObservabilityStatus>('/emmapure/observability'),

  getUsers: () => request<User[]>('/users'),
  createUser: (data: CreateUserInput) =>
    request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Partial<CreateUserInput & { isActive: boolean }>) =>
    request<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

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
    if (response.status === 401 && !path.includes('/auth/login')) {
      localStorage.removeItem(PORTAL_TOKEN_KEY);
      localStorage.removeItem('portalAccount');
      if (!window.location.pathname.startsWith('/portail/connexion')) {
        window.location.replace('/portail/connexion?expired=1');
      }
      throw new Error('Session expirée — veuillez vous reconnecter.');
    }
    throw new Error(text || `Erreur API (${response.status})`);
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
  zone?: string;
  phone?: string;
  email?: string;
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
  notes?: string;
  lines: Array<{ productId: string; quantity: number; discount?: number }>;
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
  zone?: string;
  phone?: string;
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
  driver?: { firstName: string; lastName: string };
  vehicle?: { plate: string; name: string };
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
  createdAt: string;
  client?: { name: string };
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
  tds?: number;
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
