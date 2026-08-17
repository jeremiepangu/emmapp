import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './website.css';

const LOGO = '/logo-emmanuel-services.png';

const NAV = [
  { id: 'accueil', label: 'Accueil' },
  { id: 'eau', label: 'Notre eau' },
  { id: 'origine', label: 'Origine' },
  { id: 'produits', label: 'Produits' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'contact', label: 'Contact' },
];

export default function WebsiteLayout() {
  const { hash, pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('accueil');

  useEffect(() => {
    document.title = 'EMMANUEL SERVICES SARLU — Eau potable Kinshasa';
    setMenuOpen(false);
  }, [pathname, hash]);

  useEffect(() => {
    const id = hash.replace('#', '');
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  useEffect(() => {
    const onScroll = () => {
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      root.style.setProperty('--ws-scroll', max > 0 ? String(root.scrollTop / max) : '0');
      setScrolled(root.scrollTop > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let io: IntersectionObserver | undefined;
    const timer = window.setTimeout(() => {
      const nodes = NAV.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
      if (!nodes.length) return;
      io = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (visible?.target.id) setActive(visible.target.id);
        },
        { rootMargin: '-28% 0px -55% 0px', threshold: [0.1, 0.25, 0.5] },
      );
      nodes.forEach((n) => io?.observe(n));
    }, 50);
    return () => {
      window.clearTimeout(timer);
      io?.disconnect();
    };
  }, []);

  return (
    <div className="ws">
      <div className="ws-progress" aria-hidden />
      <header className={`ws-header${scrolled ? ' is-scrolled' : ''}`}>
        <a href="#accueil" className="ws-brand" onClick={() => setMenuOpen(false)}>
          <img src={LOGO} alt="Emmanuel Services" />
          <span>
            <strong>EMMANUEL SERVICES</strong>
            <small>SARLU · Kinshasa</small>
          </span>
        </a>
        <nav className={`ws-nav${menuOpen ? ' is-open' : ''}`} aria-label="Site">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`ws-nav-link${active === item.id ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ws-header-actions">
          <Link to="/portail/connexion" className="ws-btn ws-btn--ghost">Commander</Link>
          <Link to="/login" className="ws-btn">Espace pro</Link>
          <button
            type="button"
            className="ws-menu-btn"
            aria-expanded={menuOpen}
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
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
            <h4>Page</h4>
            <a href="#eau">Notre eau</a>
            <a href="#origine">Traitement</a>
            <a href="#produits">Formats</a>
            <a href="#engagement">Durabilité</a>
          </div>
          <div>
            <h4>Services</h4>
            <Link to="/portail/connexion">Portail client</Link>
            <Link to="/login">ERP interne</Link>
            <Link to="/mobile">Application livreur</Link>
            <a href="#contact">Nous écrire</a>
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
