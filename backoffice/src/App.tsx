import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { usePermissions } from './hooks/usePermissions';
import { FIELD_ROLES } from './permissions';
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
import { Resource } from './permissions';

function ProtectedLayout() {
  const { user, logout } = useAuth();
  const { menuItems, roleLabel } = usePermissions();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (FIELD_ROLES.includes(user.role)) return <Navigate to="/mobile" replace />;

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

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="loading-screen">Chargement...</div>;

  const home = user && FIELD_ROLES.includes(user.role) ? '/mobile' : '/';

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} /> : <LoginPage />} />
      <Route path="/mobile" element={<MobilePage />} />
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
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
