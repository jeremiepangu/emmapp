import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { MenuItem } from '../permissions';
import { Icon, IconName } from './ErpIcons';

const ICONS: Record<string, IconName> = {
  '/app': 'grid',
  '/clients': 'users',
  '/orders': 'cart',
  '/pos': 'banknote',
  '/products': 'package',
  '/pricing': 'percent',
  '/tours': 'truck',
  '/vehicles': 'truck',
  '/stock': 'stock',
  '/packaging': 'package',
  '/deliveries': 'truck',
  '/payments': 'payments',
  '/finance': 'banknote',
  '/production': 'cog',
  '/quality': 'check',
  '/loyalty': 'star',
  '/consignes': 'refresh',
  '/hr': 'users',
  '/objectives': 'target',
  '/activity': 'clock',
  '/observability': 'radio',
  '/users': 'user',
  '/notifications': 'bell',
  '/ai': 'spark',
  '/assistant': 'chat',
  '/iot': 'radio',
  '/routing': 'pin',
  '/esg': 'leaf',
  '/security': 'shield',
  '/authorizations': 'key',
  '/marketplace': 'scale',
  '/integrations': 'link',
  '/portal-accounts': 'home',
  '/contracts': 'file',
  '/payroll': 'banknote',
  '/mobile': 'phone',
};

const SECTION_ICONS: Record<string, IconName> = {
  ANALYSE: 'grid',
  INTELLIGENCE: 'spark',
  ANNUAIRES: 'users',
  CONTRATS: 'file',
  COMMANDES: 'cart',
  ACHATS: 'package',
  FABRICATION: 'cog',
  LIVRAISON: 'truck',
  'OBJETS CONNECTÉS': 'radio',
  FACTURES: 'banknote',
  COMMERCE: 'star',
  DURABILITÉ: 'leaf',
  PERSONNEL: 'users',
  SÉCURITÉ: 'shield',
  PARAMÉTRAGE: 'sliders',
  TERRAIN: 'phone',
};

type MenuGroup = { section: string; items: MenuItem[] };

function groupMenu(items: MenuItem[]) {
  const groups: MenuGroup[] = [];
  for (const item of items) {
    const section = item.section ?? 'GÉNÉRAL';
    const g = groups.find((x) => x.section === section);
    if (g) g.items.push(item);
    else groups.push({ section, items: [item] });
  }
  return groups;
}

function sectionTitle(section: string) {
  const lower = section.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function sectionIcon(group: MenuGroup): IconName {
  return SECTION_ICONS[group.section] ?? ICONS[group.items[0]?.path] ?? 'grid';
}

interface Props {
  onNavigate?: () => void;
}

export default function ErpSidebar({ onNavigate }: Props) {
  const { menuItems } = usePermissions();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const navRef = useRef<HTMLElement>(null);

  const groups = useMemo(() => {
    const next = groupMenu(menuItems);
    if (!next.some((g) => g.section === 'TERRAIN')) {
      next.push({
        section: 'TERRAIN',
        items: [{ path: '/mobile', label: 'App livreur', resource: 'dashboard', section: 'TERRAIN' }],
      });
    }
    return next;
  }, [menuItems]);

  const searching = query.trim().length > 0;
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.section.toLowerCase().includes(q)
          ? g.items
          : g.items.filter(
              (item) =>
                item.label.toLowerCase().includes(q) ||
                item.path.toLowerCase().includes(q),
            ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const routeSection = useMemo(
    () => groups.find((g) => g.items.some((item) => item.path === location.pathname))?.section ?? '',
    [groups, location.pathname],
  );

  const [openSection, setOpenSection] = useState(routeSection);
  useEffect(() => {
    if (routeSection) setOpenSection(routeSection);
  }, [routeSection]);

  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('.erp-nav-group.is-current');
    el?.scrollIntoView({ block: 'nearest' });
  }, [location.pathname]);

  const toggleGroup = (group: MenuGroup) => {
    if (group.items.length === 1) return;
    setOpenSection((prev) => {
      if (prev === group.section) return routeSection === group.section ? group.section : '';
      return group.section;
    });
  };

  return (
    <div className="erp-sidebar-inner">
      <div className="erp-sidebar-brand">
        <img className="erp-brand-mark erp-brand-mark--img" src="/logo-emmanuel-services.png" alt="" />
        <div>
          <div className="erp-brand-logo">EMMAPP</div>
          <div className="erp-brand-sub">Emmanuel Services</div>
        </div>
      </div>

      <div className="erp-sidebar-search">
        <input
          type="search"
          placeholder="Filtrer le menu..."
          aria-label="Filtrer le menu"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <nav className="erp-nav" ref={navRef}>
        {searching && filteredGroups.length === 0 && (
          <p className="erp-nav-empty">Aucun écran ne correspond à « {query.trim()} ».</p>
        )}
        {filteredGroups.map((group) => {
          const single = !searching && group.items.length === 1;
          const open = searching || openSection === group.section;
          const current = group.section === routeSection;
          const icon = sectionIcon(group);
          const label = sectionTitle(group.section);
          const slug = group.section.toLowerCase().replace(/[^a-z0-9]+/g, '-');

          return (
            <div
              key={group.section}
              className={`erp-nav-group${open ? ' is-open' : ''}${current ? ' is-current' : ''}`}
            >
              {single ? (
                <NavLink
                  to={group.items[0].path}
                  end={group.items[0].path === '/app'}
                  className="erp-nav-link erp-nav-link--leaf"
                  onClick={onNavigate}
                >
                  <span className="erp-nav-icon" aria-hidden><Icon name={icon} size={18} /></span>
                  <span className="erp-nav-label">{label}</span>
                </NavLink>
              ) : (
                <button
                  type="button"
                  className={`erp-nav-link${open ? ' is-open' : ''}${current ? ' is-current' : ''}`}
                  aria-expanded={open}
                  aria-controls={`submenu-${slug}`}
                  onClick={() => toggleGroup(group)}
                >
                  <span className="erp-nav-icon" aria-hidden><Icon name={icon} size={18} /></span>
                  <span className="erp-nav-label">{label}</span>
                  <span className="erp-nav-chevron" aria-hidden><Icon name="chevron" size={14} /></span>
                </button>
              )}
              {!single && open && (
                <div className="erp-nav-submenu" id={`submenu-${slug}`}>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/app'}
                      className="erp-nav-sublink"
                      onClick={onNavigate}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="erp-sidebar-promo">
        <strong>Outils terrain</strong>
        <p>App livreur, tournées et déclarations d’activité, au plus près des livraisons.</p>
        <NavLink to="/mobile" className="erp-sidebar-promo-btn" onClick={onNavigate}>
          Ouvrir
        </NavLink>
      </div>
    </div>
  );
}
