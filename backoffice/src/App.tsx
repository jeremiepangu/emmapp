import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ProductsPage from './pages/ProductsPage';
import ToursPage from './pages/ToursPage';
import StockPage from './pages/StockPage';
import DeliveriesPage from './pages/DeliveriesPage';
import MobilePage from './pages/MobilePage';

function ProtectedLayout() {
  const { user, logout } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>EMMAPP</h1>
          <p>Back-Office</p>
        </div>
        <nav>
          <NavLink to="/" end>Tableau de bord</NavLink>
          <NavLink to="/clients">Clients</NavLink>
          <NavLink to="/products">Produits</NavLink>
          <NavLink to="/tours">Tournées</NavLink>
          <NavLink to="/stock">Stocks</NavLink>
          <NavLink to="/deliveries">Livraisons</NavLink>
        </nav>
      </aside>
      <main className="main-content">
        <div className="header-bar">
          <div />
          <div className="user-info">
            <span>{user.firstName} {user.lastName} ({user.role})</span>
            <div className="user-avatar">{user.firstName[0]}</div>
            <button className="btn btn-primary" onClick={logout}>Déconnexion</button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div style={{ padding: 40 }}>Chargement...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/mobile" element={<MobilePage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/tours" element={<ToursPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/deliveries" element={<DeliveriesPage />} />
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
