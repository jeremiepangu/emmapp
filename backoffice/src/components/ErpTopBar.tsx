import { Link } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import { useTheme } from '../ThemeContext';
import { Icon, IconName } from './ErpIcons';

interface Props {
  onMenuToggle: () => void;
  onLogout: () => void;
  userName: string;
  showNotifications?: boolean;
}

const QUICK_ACTIONS: Array<{ icon: IconName; label: string; to: string; tone: string }> = [
  { icon: 'payments', label: 'Paiements', to: '/payments', tone: 'blue' },
  { icon: 'orders', label: 'Commandes', to: '/orders', tone: 'purple' },
  { icon: 'stock', label: 'Stock', to: '/stock', tone: 'green' },
  { icon: 'truck', label: 'Livraisons', to: '/deliveries', tone: 'orange' },
];

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

export default function ErpTopBar({ onMenuToggle, onLogout, userName, showNotifications }: Props) {
  const { theme, setTheme } = useTheme();
  const initial = userName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <header className="erp-topbar">
      <div className="erp-topbar-left">
        <button type="button" className="erp-toolbar-btn erp-menu-btn" onClick={onMenuToggle} title="Menu">
          <Icon name="menu" size={22} />
          <span className="erp-toolbar-label">Menu</span>
        </button>
        <div className="erp-quick-actions">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className={`erp-toolbar-btn erp-quick-btn erp-quick-btn--${a.tone}`}
              title={a.label}
            >
              <Icon name={a.icon} size={22} />
              <span className="erp-toolbar-label">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
      <GlobalSearch />
      <div className="erp-topbar-right">
        <ToolbarBtn label="Utilisateurs" to="/users" className="erp-toolbar-btn--primary">
          <Icon name="userPlus" size={22} />
        </ToolbarBtn>
        <ToolbarBtn
          label={theme === 'sombre' ? 'Clair' : 'Sombre'}
          onClick={() => setTheme(theme === 'sombre' ? 'clair' : 'sombre')}
        >
          <Icon name={theme === 'sombre' ? 'sun' : 'moon'} size={22} />
        </ToolbarBtn>
        <ToolbarBtn label="Tableau de bord" to="/app">
          <Icon name="grid" size={22} />
        </ToolbarBtn>
        <ToolbarBtn label="Messages" to="/notifications">
          <Icon name="mail" size={22} />
        </ToolbarBtn>
        <ToolbarBtn label="Synchro">
          <Icon name="cloud" size={22} />
        </ToolbarBtn>
        {showNotifications && <NotificationBell />}
        <span className="erp-user-badge" title={userName}>{initial}</span>
        <ToolbarBtn label="Déconnexion" onClick={onLogout}>
          <Icon name="logout" size={22} />
        </ToolbarBtn>
      </div>
    </header>
  );
}
