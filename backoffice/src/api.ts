const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

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
    throw new Error(`Erreur API (${response.status})`);
  }
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

  getProducts: () => request<Product[]>('/products'),

  getTours: () => request<Tour[]>('/tours'),

  getOrders: () => request<Order[]>('/orders'),

  getStock: () => request<StockItem[]>('/stock'),

  getDeliveries: () => request<Delivery[]>('/deliveries'),
};

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
