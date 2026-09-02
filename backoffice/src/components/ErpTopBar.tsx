import { Link, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import { useTheme } from '../ThemeContext';
import { MENU_ITEMS } from '../permissions';
import { Icon } from './ErpIcons';

interface Props {
  onMenuToggle: () => void;
  onLogout: () => void;
  userName: string;
  userRole?: string;
  showNotifications?: boolean;
}

function pageTitleFromPath(pathname: string) {
  const exact = MENU_ITEMS.find((m) => m.path === pathname);
  if (exact) return exact.label;
  const nested = MENU_ITEMS
    .filter((m) => m.path !== '/app' && pathname.startsWith(`${m.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (nested) return nested.label;
  if (pathname.startsWith('/mobile')) return 'App livreur';
  return 'Tableau de bord';
}

function ToolbarBtn({
  children,
  label,
  onClick,
  to,
  className = '',
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  to?: string;
  className?: string;
}) {
  const cls = `erp-toolbar-btn ${className}`.trim();
  const inner = (
    <>
      {children}
      <span className="erp-toolbar-label">{label}</span>
    </>
  );

  if (to) {
    return <Link to={to} className={cls} title={label}>{inner}</Link>;
  }

  return (
    <button type="button" onClick={onClick} className={cls} title={label}>
      {inner}
    </button>
  );
}

export default function ErpTopBar({ onMenuToggle, onLogout, userName, userRole, showNotifications }: Props) {
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const pageTitle = pageTitleFromPath(location.pathname);
  const initial = userName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <header className="erp-topbar">
      <div className="erp-topbar-left">
        <button type="button" className="erp-toolbar-btn erp-menu-btn" onClick={onMenuToggle} title="Menu">
          <Icon name="menu" size={20} />
          <span className="erp-toolbar-label">Menu</span>
        </button>
        <h1 className="erp-topbar-title">{pageTitle}</h1>
      </div>
      <GlobalSearch />
      <div className="erp-topbar-right">
        {showNotifications && <NotificationBell />}
        <ToolbarBtn
          label={theme === 'sombre' ? 'Thème clair' : 'Thème sombre'}
          onClick={() => setTheme(theme === 'sombre' ? 'clair' : 'sombre')}
        >
          <Icon name={theme === 'sombre' ? 'sun' : 'moon'} size={18} />
        </ToolbarBtn>
        <div className="erp-topbar-profile" title={userName}>
          <span className="erp-user-badge">{initial}</span>
          <div className="erp-topbar-profile-text">
            <span className="erp-topbar-profile-name">{userName}</span>
            {userRole && <span className="erp-topbar-profile-role">{userRole}</span>}
          </div>
        </div>
        <ToolbarBtn label="Déconnexion" onClick={onLogout}>
          <Icon name="logout" size={18} />
        </ToolbarBtn>
      </div>
    </header>
  );
}
