import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { MenuItem } from '../permissions';

const ICONS: Record<string, string> = {
  '/': '▣',
  '/clients': '☰',
  '/orders': '☷',
  '/products': '▤',
  '/pricing': '％',
  '/tours': '➤',
  '/stock': '▦',
  '/deliveries': '➚',
  '/payments': '€',
  '/production': '⚙',
  '/quality': '✓',
  '/loyalty': '★',
  '/consignes': '↻',
  '/hr': '◉',
  '/activity': '◷',
  '/observability': '◎',
  '/users': '⚑',
  '/notifications': '✉',
  '/ai': '◇',
  '/assistant': '💬',
  '/iot': '📡',
  '/routing': '⌖',
  '/esg': '♻',
  '/security': '🛡',
  '/marketplace': '⚖',
  '/integrations': '🔗',
  '/portal-accounts': '⌂',
  '/mobile': '📱',
};

function groupMenu(items: MenuItem[]) {
  const groups: { section: string; items: MenuItem[] }[] = [];
  for (const item of items) {
    const section = item.section ?? 'GÉNÉRAL';
    const g = groups.find((x) => x.section === section);
    if (g) g.items.push(item);
    else groups.push({ section, items: [item] });
  }
  return groups;
}

interface Props {
  onNavigate?: () => void;
}

export default function ErpSidebar({ onNavigate }: Props) {
  const { user } = useAuth();
  const { menuItems, roleLabel } = usePermissions();
  const [query, setQuery] = useState('');
  const groups = groupMenu(menuItems);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  return (
    <div className="erp-sidebar-inner">
      <div className="erp-sidebar-brand">
        <img className="erp-brand-mark erp-brand-mark--img" src="/logo-emmanuel-services.png" alt="" />
        <div>
          <div className="erp-brand-logo">Emmanuel Services</div>
          <div className="erp-brand-sub">SARLU · Eau potable</div>
        </div>
      </div>

      <div className="erp-user-card">
        <div className="erp-user-avatar">{user?.firstName[0]}</div>
        <div>
          <div className="erp-user-name">{user?.firstName} {user?.lastName}</div>
          <div className="erp-user-role">
            <span className="erp-online-dot" aria-hidden /> {roleLabel}
          </div>
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

      <nav className="erp-nav" onClick={onNavigate}>
        {filteredGroups.map((group) => (
          <div key={group.section} className="erp-nav-group">
            <div className="erp-nav-section">{group.section}</div>
            {group.items.map((item) => (
              <NavLink key={item.path} to={item.path} end={item.path === '/'} className="erp-nav-link">
                <span className="erp-nav-icon" aria-hidden>{ICONS[item.path] ?? '•'}</span>
                <span className="erp-nav-label">{item.label}</span>
                <span className="erp-nav-chevron" aria-hidden>›</span>
              </NavLink>
            ))}
          </div>
        ))}
        {!query && (
          <div className="erp-nav-group">
            <div className="erp-nav-section">TERRAIN</div>
            <NavLink to="/mobile" className="erp-nav-link">
              <span className="erp-nav-icon" aria-hidden>{ICONS['/mobile']}</span>
              <span className="erp-nav-label">App livreur</span>
              <span className="erp-nav-chevron" aria-hidden>›</span>
            </NavLink>
          </div>
        )}
      </nav>
    </div>
  );
}

