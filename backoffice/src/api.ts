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
    throw new Error(text || `Erreur API (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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
