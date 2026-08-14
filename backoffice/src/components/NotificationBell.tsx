import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, NotificationItem } from '../api';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = () => {
    api.getNotifications(true).then(setItems).catch(() => setItems([]));
    api.getUnreadNotificationCount().then((r) => setCount(r.count)).catch(() => setCount(0));
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const markRead = async (id: string) => {
    await api.markNotificationRead(id);
    refresh();
  };

  const typeClass = (type: string) => {
    if (type === 'ALERT' || type === 'WARNING') return 'notif-warning';
    if (type === 'SUCCESS') return 'notif-success';
    return 'notif-info';
  };

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button type="button" className="notif-bell-btn erp-icon-btn" onClick={() => { setOpen(!open); if (!open) refresh(); }} aria-label="Notifications">
        🔔
        {count > 0 && <span className="notif-badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-head">
            <strong>Notifications</strong>
            <Link to="/notifications" onClick={() => setOpen(false)}>Tout voir</Link>
          </div>
          {items.length === 0 ? (
            <p className="notif-empty">Aucune notification non lue</p>
          ) : (
            <ul className="notif-list">
              {items.slice(0, 8).map((n) => (
                <li key={n.id} className={typeClass(n.type)}>
                  <button type="button" className="notif-item-btn" onClick={() => markRead(n.id)}>
                    <strong>{n.title}</strong>
                    <span>{n.message}</span>
                    <small>{new Date(n.createdAt).toLocaleString('fr-FR')}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
