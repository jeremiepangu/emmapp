import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import './website.css';

const LOGO = '/logo-emmanuel-services.png';

const NAV = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/eau', label: 'Notre eau' },
  { to: '/origine', label: 'Origine' },
  { to: '/produits', label: 'Produits' },
  { to: '/engagement', label: 'Engagement' },
  { to: '/contact', label: 'Contact' },
];

const TITLES: Record<string, string> = {
  '/': 'EMMANUEL SERVICES SARLU — Eau potable Kinshasa',
  '/eau': 'Caractéristiques de l\'eau — EMMANUEL SERVICES SARLU',
  '/origine': 'Origine et traitement — EMMANUEL SERVICES SARLU',
  '/produits': 'Nos formats — EMMANUEL SERVICES SARLU',
  '/engagement': 'Notre engagement — EMMANUEL SERVICES SARLU',
  '/contact': 'Contact — EMMANUEL SERVICES SARLU',
};

export default function WebsiteLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = TITLES[pathname] ?? 'EMMANUEL SERVICES SARLU';
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="ws">
      <header className="ws-header">
        <Link to="/" className="ws-brand">
          <img src={LOGO} alt="Emmanuel Services" />
          <span>
            <strong>EMMANUEL SERVICES SARLU</strong>
            <small>Eau potable · Kinshasa</small>
          </span>
        </Link>
        <nav className="ws-nav" aria-label="Site">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="ws-nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ws-header-actions">
          <Link to="/portail/connexion" className="ws-btn ws-btn--ghost">Commander</Link>
          <Link to="/login" className="ws-btn">Espace pro</Link>
        </div>
      </header>
      <Outlet />
      <footer className="ws-footer">
        <div className="ws-footer-grid">
          <div>
            <img src={LOGO} alt="" className="ws-footer-logo" />
            <p>Consommer de l&apos;eau de bonne qualité est essentiel pour maintenir une bonne santé.</p>
            <p className="ws-muted">Proverbe 16:3</p>
          </div>
          <div>
            <h4>Découvrir</h4>
            <Link to="/eau">Caractéristiques</Link>
            <Link to="/origine">Traitement</Link>
            <Link to="/produits">Formats</Link>
            <Link to="/engagement">Durabilité</Link>
          </div>
          <div>
            <h4>Services</h4>
            <Link to="/portail/connexion">Portail client</Link>
            <Link to="/login">ERP interne</Link>
            <Link to="/mobile">Application livreur</Link>
            <Link to="/contact">Nous écrire</Link>
          </div>
          <div>
            <h4>Kinshasa</h4>
            <p>Bandalungwa, RDC</p>
            <p><a href="tel:+243813170215">+243 813 170 215</a></p>
            <p><a href="mailto:contact@emmas.cd">contact@emmas.cd</a></p>
          </div>
        </div>
        <div className="ws-legal">
          RCCM KNG/RCCM/24-B-02180 · IMPOT A2425053J · ID NAT 01-F4300-N64238H
        </div>
      </footer>
    </div>
  );
}
