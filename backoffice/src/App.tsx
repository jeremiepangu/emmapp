import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import ToursPage from './pages/ToursPage';
import StockPage from './pages/StockPage';
import DeliveriesPage from './pages/DeliveriesPage';
import PaymentsPage from './pages/PaymentsPage';
import MobilePage from './pages/MobilePage';

function ProtectedLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'LIVREUR') return <Navigate to="/mobile" replace />;

  return (
    <div className="app-layout">
      <button type="button" className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
        ☰
      </button>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h1>EMMAPP</h1>
          <p>Application Web</p>
        </div>
        <nav onClick={() => setMenuOpen(false)}>
          <NavLink to="/" end>Tableau de bord</NavLink>
          <NavLink to="/clients">Clients</NavLink>
          <NavLink to="/orders">Commandes</NavLink>
          <NavLink to="/products">Produits</NavLink>
          <NavLink to="/tours">Tournées</NavLink>
          <NavLink to="/stock">Stocks</NavLink>
          <NavLink to="/deliveries">Livraisons</NavLink>
          <NavLink to="/payments">Paiements</NavLink>
          <NavLink to="/mobile" className="nav-mobile">App livreur</NavLink>
        </nav>
      </aside>
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <main className="main-content">
        <div className="header-bar">
          <div className="header-title">ERP / CRM — Distribution eau potable</div>
          <div className="user-info">
            <span className="user-name">{user.firstName} {user.lastName} ({user.role})</span>
            <div className="user-avatar">{user.firstName[0]}</div>
            <button type="button" className="btn btn-primary" onClick={logout}>Déconnexion</button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="loading-screen">Chargement...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'LIVREUR' ? '/mobile' : '/'} /> : <LoginPage />} />
      <Route path="/mobile" element={<MobilePage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/tours" element={<ToursPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/deliveries" element={<DeliveriesPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
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
