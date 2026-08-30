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
  const [showTop, setShowTop] = useState(false);

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
      const y = document.documentElement.scrollTop;
      setScrolled(y > 40);
      setShowTop(y > 480);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
    <div className="hl">
      <div className="hl-topbar">
        <div className="hl-wrap hl-topbar-inner">
          <h5>
            <em>Besoin d’aide</em>, parlez à un expert :{' '}
            <a href="tel:+243813170215">+243 813 170 215</a>
          </h5>
          <p>Livraison : lundi à samedi, 7h – 18h · Kinshasa</p>
          <div className="hl-topbar-links">
            <a href="mailto:contact@emmas.cd">contact@emmas.cd</a>
            <Link to="/portail/connexion">Portail</Link>
            <Link to="/login">Espace pro</Link>
          </div>
        </div>
      </div>

      <header className={`hl-header${scrolled ? ' is-sticky' : ''}${menuOpen ? ' is-open' : ''}`}>
        <div className="hl-wrap hl-header-inner">
          <a href={sectionHref('accueil')} className="hl-brand" onClick={goToSection('accueil')}>
            <img src={LOGO} alt="Emmanuel Services" />
            <span>
              <strong>Emmanuel Services</strong>
              <small>Eau potable · Kinshasa</small>
            </span>
          </a>
          <nav className={`hl-nav${menuOpen ? ' is-open' : ''}`} aria-label="Site">
            {WEBSITE_NAV.map((item) => (
              <a
                key={item.id}
                href={sectionHref(item.id)}
                className={active === item.id ? 'is-active' : ''}
                onClick={goToSection(item.id)}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hl-header-actions">
            <Link to="/portail/inscription" className="hl-btn hl-btn--red">Commander</Link>
            <button
              type="button"
              className="hl-burger"
              aria-expanded={menuOpen}
              aria-label="Menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <Outlet />

      <section className="hl-cta">
        <div className="hl-wrap hl-cta-inner">
          <p>Une commande urgente ? Appelez-nous, on organise la tournée.</p>
          <div>
            <h2>Livraison d’eau potable, rapide et suivie, à Kinshasa</h2>
            <a href="tel:+243813170215">+243 813 170 215</a>
          </div>
          <Link to="/portail/inscription" className="hl-btn hl-btn--red hl-btn--lg">Passer commande</Link>
        </div>
      </section>

      <footer className="hl-footer">
        <div className="hl-footer-top">
          <div className="hl-wrap hl-footer-contacts">
            <article>
              <span aria-hidden>⌂</span>
              <div>
                <strong>Adresse</strong>
                <p>Bandalungwa, Kinshasa, RDC</p>
              </div>
            </article>
            <article>
              <span aria-hidden>✉</span>
              <div>
                <strong>Écrivez-nous</strong>
                <p><a href="mailto:contact@emmas.cd">contact@emmas.cd</a></p>
              </div>
            </article>
            <article>
              <span aria-hidden>☎</span>
              <div>
                <strong>Appelez-nous</strong>
                <p><a href="tel:+243813170215">+243 813 170 215</a></p>
              </div>
            </article>
          </div>
        </div>
        <div className="hl-wrap hl-footer-grid">
          <div>
            <a href={sectionHref('accueil')} className="hl-brand hl-brand--light" onClick={goToSection('accueil')}>
              <img src={LOGO} alt="" />
              <span>
                <strong>Emmanuel Services</strong>
                <small>SARLU · Eau potable</small>
              </span>
            </a>
            <p>Consommer de l’eau de bonne qualité est essentiel pour maintenir une bonne santé.</p>
          </div>
          <div>
            <h3>Liens utiles</h3>
            <a href={sectionHref('accueil')} onClick={goToSection('accueil')}>Accueil</a>
            <a href={sectionHref('apropos')} onClick={goToSection('apropos')}>À propos</a>
            <a href={sectionHref('contact')} onClick={goToSection('contact')}>Prendre rendez-vous</a>
            <Link to="/portail/inscription">Créer un compte</Link>
            <Link to="/portail/connexion">Portail client</Link>
          </div>
          <div>
            <h3>Services</h3>
            <a href={sectionHref('services')} onClick={goToSection('services')}>Livraison domicile</a>
            <a href={sectionHref('services')} onClick={goToSection('services')}>Entreprises</a>
            <a href={sectionHref('produits')} onClick={goToSection('produits')}>Bidons &amp; bonbonnes</a>
            <a href={sectionHref('qualite')} onClick={goToSection('qualite')}>Contrôle qualité</a>
            <Link to="/login">ERP interne</Link>
          </div>
        </div>
        <div className="hl-legal">
          <span>© {new Date().getFullYear()} Emmanuel Services SARLU. Tous droits réservés.</span>
          <span>RCCM KNG/RCCM/24-B-02180 · IMPOT A2425053J · ID NAT 01-F4300-N64238H</span>
        </div>
      </footer>

      {showTop && (
        <button
          type="button"
          className="hl-totop"
          aria-label="Haut de page"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ↑
        </button>
      )}
    </div>
  );
}
