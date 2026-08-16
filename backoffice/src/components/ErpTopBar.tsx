import { Link } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';
import { useTheme } from '../ThemeContext';

interface Props {
  onMenuToggle: () => void;
  onLogout: () => void;
  userName: string;
  showNotifications?: boolean;
}

const QUICK_ACTIONS = [
  { icon: '🧮', label: 'Paiements', to: '/payments' },
  { icon: '📝', label: 'Commandes', to: '/orders' },
  { icon: '📦', label: 'Stock', to: '/stock' },
  { icon: '🚚', label: 'Livraisons', to: '/deliveries' },
];

function TooltipBtn({
  children,
  tooltip,
  onClick,
  to,
  className = '',
}: {
  children: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
  to?: string;
  className?: string;
}) {
  const cls = `erp-icon-btn erp-tooltip-wrap ${className}`.trim();
  const props = { className: cls, 'data-tooltip': tooltip, title: tooltip };

  if (to) {
    return <Link to={to} {...props}>{children}</Link>;
  }

  return (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  );
}

export default function ErpTopBar({ onMenuToggle, onLogout, userName, showNotifications }: Props) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="erp-topbar">
      <div className="erp-topbar-left">
        <TooltipBtn tooltip="Menu" onClick={onMenuToggle} className="erp-menu-btn">
          ☰
        </TooltipBtn>
        <div className="erp-quick-actions">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.label} to={a.to} className="erp-quick-btn erp-tooltip-wrap" data-tooltip={a.label} title={a.label}>
              <span>{a.icon}</span>
            </Link>
          ))}
        </div>
      </div>
      <GlobalSearch />
      <div className="erp-topbar-right">
        <TooltipBtn tooltip="Utilisateurs" to="/users" className="erp-icon-btn--primary">
          👤+
        </TooltipBtn>
        <TooltipBtn
          tooltip={theme === 'sombre' ? 'Mode clair' : 'Mode sombre'}
          onClick={() => setTheme(theme === 'sombre' ? 'clair' : 'sombre')}
        >
          {theme === 'sombre' ? '☀' : '☾'}
        </TooltipBtn>
        <TooltipBtn tooltip="Tableau de bord" to="/">▣</TooltipBtn>
        <TooltipBtn tooltip="Notifications" to="/notifications">✉</TooltipBtn>
        <TooltipBtn tooltip="Synchronisation">☁</TooltipBtn>
        {showNotifications && <NotificationBell />}
        <span className="erp-user-badge erp-tooltip-wrap" data-tooltip={userName} title={userName}>👤</span>
        <TooltipBtn tooltip="Déconnexion" onClick={onLogout}>⎋</TooltipBtn>
      </div>
    </header>
  );
}
