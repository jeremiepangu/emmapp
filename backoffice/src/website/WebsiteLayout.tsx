import { Link, Outlet, useLocation } from 'react-router-dom';
import { MouseEvent, useEffect, useState } from 'react';
import { sectionHref, WEBSITE_NAV } from './nav';
import './website.css';

const LOGO = '/logo-emmanuel-services.png';

export default function WebsiteLayout() {
  const { hash, pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('accueil');

  useEffect(() => {
    document.title = 'EMMANUEL SERVICES SARLU — Eau potable Kinshasa';
    document.documentElement.classList.add('ws-onepage');
    return () => document.documentElement.classList.remove('ws-onepage');
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const id = hash.replace('#', '');
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActive(id);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [hash]);

  useEffect(() => {
    const onScroll = () => {
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      root.style.setProperty('--ws-scroll', max > 0 ? String(root.scrollTop / max) : '0');
      const hero = document.getElementById('accueil');
      const threshold = hero ? Math.max(hero.offsetHeight - 88, 64) : 64;
      setScrolled(root.scrollTop >= threshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  useEffect(() => {
    let io: IntersectionObserver | undefined;
    const timer = window.setTimeout(() => {
      const nodes = WEBSITE_NAV.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
      if (!nodes.length) return;
      io = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          const id = visible?.target.id;
          if (!id) return;
          setActive(id);
          const next = `/#${id}`;
          if (`${window.location.pathname}${window.location.hash}` !== next) {
            window.history.replaceState(null, '', next);
          }
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

  const goToSection = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', sectionHref(id));
    setActive(id);
  };

  return (
    <div className="ws">
      <div className="ws-progress" aria-hidden />
      <header className={`ws-header${scrolled ? ' is-scrolled' : ''}${menuOpen ? ' is-open' : ''}`}>
        <div className="ws-header-inner">
          <a href={sectionHref('accueil')} className="ws-brand" onClick={goToSection('accueil')}>
            <img src={LOGO} alt="Emmanuel Services" />
            <span>
              <strong>EMMANUEL SERVICES</strong>
              <small>SARLU · Kinshasa</small>
            </span>
          </a>
          <nav className={`ws-nav${menuOpen ? ' is-open' : ''}`} aria-label="Site">
            {WEBSITE_NAV.map((item) => (
              <a
                key={item.id}
                href={sectionHref(item.id)}
                className={`ws-nav-link${active === item.id ? ' active' : ''}`}
                onClick={goToSection(item.id)}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ws-header-actions">
            <Link to="/portail/inscription" className="ws-btn ws-btn--ghost">Commander</Link>
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
        </div>
      </header>
      <Outlet />
      <footer className="ws-footer" id="pied">
        <div className="ws-footer-grid">
          <div>
            <img src={LOGO} alt="" className="ws-footer-logo" />
            <p>Consommer de l&apos;eau de bonne qualité est essentiel pour maintenir une bonne santé.</p>
            <p className="ws-muted">Proverbe 16:3</p>
          </div>
          <div>
            <h4>Le site</h4>
            <a href={sectionHref('eau')} onClick={goToSection('eau')}>Notre eau</a>
            <a href={sectionHref('origine')} onClick={goToSection('origine')}>Traitement</a>
            <a href={sectionHref('produits')} onClick={goToSection('produits')}>Formats</a>
            <a href={sectionHref('engagement')} onClick={goToSection('engagement')}>Durabilité</a>
          </div>
          <div>
            <h4>Services</h4>
            <Link to="/portail/inscription">Créer un compte</Link>
            <Link to="/portail/connexion">Portail client</Link>
            <Link to="/login">ERP interne</Link>
            <Link to="/mobile">Application livreur</Link>
            <a href={sectionHref('contact')} onClick={goToSection('contact')}>Nous écrire</a>
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
