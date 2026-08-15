import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ThemeProvider } from './ThemeContext';
import { PortalProvider, usePortal } from './PortalContext';
import { usePermissions } from './hooks/usePermissions';
import RoleGate from './components/RoleGate';
import ErpSidebar from './components/ErpSidebar';
import ErpTopBar from './components/ErpTopBar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import ToursPage from './pages/ToursPage';
import StockPage from './pages/StockPage';
import DeliveriesPage from './pages/DeliveriesPage';
import PaymentsPage from './pages/PaymentsPage';
import ProductionPage from './pages/ProductionPage';
import QualityPage from './pages/QualityPage';
import LoyaltyPage from './pages/LoyaltyPage';
import HrPage from './pages/HrPage';
import ConsignesPage from './pages/ConsignesPage';
import ObservabilityPage from './pages/ObservabilityPage';
import UsersPage from './pages/UsersPage';
import NotificationsPage from './pages/NotificationsPage';
import MobilePage from './pages/MobilePage';
import AiPage from './pages/AiPage';
import AssistantPage from './pages/AssistantPage';
import IotPage from './pages/IotPage';
import RoutingPage from './pages/RoutingPage';
import EsgPage from './pages/EsgPage';
import SecurityPage from './pages/SecurityPage';
import MarketplacePage from './pages/MarketplacePage';
import IntegrationsPage from './pages/IntegrationsPage';
import PortalAccountsPage from './pages/PortalAccountsPage';
import PortalLoginPage from './pages/portal/PortalLoginPage';
import {
  PortalLayout,
  PortalHomePage,
  PortalCatalogPage,
  PortalOrdersPage,
  PortalDeliveriesPage,
  PortalInvoicesPage,
  PortalLoyaltyPage,
  PortalConsignesPage,
  PortalAssistantPage,
} from './pages/portal/PortalPages';
import { PORTAL_ONLY_ROLES, Resource } from './permissions';

function ProtectedLayout() {
  const { user, logout } = useAuth();
  const { menuItems, roleLabel } = usePermissions();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (PORTAL_ONLY_ROLES.includes(user.role)) return <Navigate to="/portail" replace />;

  return (
    <div className="erp-layout">
      <aside className={`erp-sidebar ${menuOpen ? 'open' : ''}`}>
        <ErpSidebar onNavigate={() => setMenuOpen(false)} />
      </aside>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <div className="erp-main-wrap">
        <ErpTopBar
          onMenuToggle={() => setMenuOpen(!menuOpen)}
          onLogout={logout}
          userName={`${user.firstName} ${user.lastName} · ${roleLabel}`}
          showNotifications={menuItems.some((m) => m.resource === 'notifications')}
        />
        <main className="erp-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function GuardedRoute({ resource, element }: { resource: Resource; element: JSX.Element }) {
  return <RoleGate resource={resource}>{element}</RoleGate>;
}

function PortalGate({ children }: { children: JSX.Element }) {
  const { account, isLoading } = usePortal();
  if (isLoading) return <div className="loading-screen">Chargement…</div>;
  if (!account) return <Navigate to="/portail/connexion" replace />;
  return children;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="loading-screen">Chargement...</div>;

  const home = '/';

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} /> : <LoginPage />} />
      <Route path="/mobile" element={<MobilePage />} />
      <Route path="/portail/connexion" element={<PortalLoginPage />} />
      <Route
        path="/portail"
        element={(
          <PortalGate>
            <PortalLayout />
          </PortalGate>
        )}
      >
        <Route index element={<PortalHomePage />} />
        <Route path="commander" element={<PortalCatalogPage />} />
        <Route path="commandes" element={<PortalOrdersPage />} />
        <Route path="livraisons" element={<PortalDeliveriesPage />} />
        <Route path="factures" element={<PortalInvoicesPage />} />
        <Route path="fidelite" element={<PortalLoyaltyPage />} />
        <Route path="consignes" element={<PortalConsignesPage />} />
        <Route path="assistant" element={<PortalAssistantPage />} />
      </Route>
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<GuardedRoute resource="dashboard" element={<DashboardPage />} />} />
        <Route path="/clients" element={<GuardedRoute resource="clients" element={<ClientsPage />} />} />
        <Route path="/orders" element={<GuardedRoute resource="orders" element={<OrdersPage />} />} />
        <Route path="/products" element={<GuardedRoute resource="products" element={<ProductsPage />} />} />
        <Route path="/tours" element={<GuardedRoute resource="tours" element={<ToursPage />} />} />
        <Route path="/stock" element={<GuardedRoute resource="stock" element={<StockPage />} />} />
        <Route path="/deliveries" element={<GuardedRoute resource="deliveries" element={<DeliveriesPage />} />} />
        <Route path="/payments" element={<GuardedRoute resource="payments" element={<PaymentsPage />} />} />
        <Route path="/production" element={<GuardedRoute resource="production" element={<ProductionPage />} />} />
        <Route path="/quality" element={<GuardedRoute resource="quality" element={<QualityPage />} />} />
        <Route path="/loyalty" element={<GuardedRoute resource="loyalty" element={<LoyaltyPage />} />} />
        <Route path="/consignes" element={<GuardedRoute resource="consignes" element={<ConsignesPage />} />} />
        <Route path="/hr" element={<GuardedRoute resource="hr" element={<HrPage />} />} />
        <Route path="/observability" element={<GuardedRoute resource="observability" element={<ObservabilityPage />} />} />
        <Route path="/users" element={<GuardedRoute resource="users" element={<UsersPage />} />} />
        <Route path="/notifications" element={<GuardedRoute resource="notifications" element={<NotificationsPage />} />} />
        <Route path="/ai" element={<GuardedRoute resource="ai" element={<AiPage />} />} />
        <Route path="/assistant" element={<GuardedRoute resource="assistant" element={<AssistantPage />} />} />
        <Route path="/iot" element={<GuardedRoute resource="iot" element={<IotPage />} />} />
        <Route path="/routing" element={<GuardedRoute resource="routing" element={<RoutingPage />} />} />
        <Route path="/esg" element={<GuardedRoute resource="esg" element={<EsgPage />} />} />
        <Route path="/security" element={<GuardedRoute resource="security" element={<SecurityPage />} />} />
        <Route path="/marketplace" element={<GuardedRoute resource="marketplace" element={<MarketplacePage />} />} />
        <Route path="/integrations" element={<GuardedRoute resource="integrations" element={<IntegrationsPage />} />} />
        <Route path="/portal-accounts" element={<GuardedRoute resource="portal" element={<PortalAccountsPage />} />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PortalProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </PortalProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
