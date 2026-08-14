import { useEffect, useState } from 'react';
import { api, NotificationItem } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';

const typeLabel: Record<string, string> = {
  INFO: 'Info',
  SUCCESS: 'Succès',
  WARNING: 'Alerte',
  ALERT: 'Urgent',
};

const typeStatus: Record<string, string> = {
  INFO: 'PLANIFIEE',
  SUCCESS: 'CONFORME',
  WARNING: 'EN_ATTENTE',
  ALERT: 'NON_CONFORME',
};

export default function NotificationsPage() {
  const { can } = usePermissions();
  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = () => api.getNotifications().then(setItems);

  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await api.markAllNotificationsRead();
    await load();
  };

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Notifications"
        subtitle={`Alertes et messages selon votre profil · ${unread} non lue${unread > 1 ? 's' : ''}`}
        actions={
          can('notifications', 'read') ? (
            <button type="button" className="erp-btn erp-btn--ghost" onClick={markAll}>Tout marquer comme lu</button>
          ) : undefined
        }
      />
      <ErpPanel title={`Messages (${items.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Catégorie</th><th>Titre</th><th>Message</th><th>Statut</th></tr>
          </thead>
          <tbody>
            {items.map((n) => (
              <tr key={n.id} className={n.read ? 'notif-read' : 'notif-unread'}>
                <td>{new Date(n.createdAt).toLocaleString('fr-FR')}</td>
                <td><StatusPill status={typeStatus[n.type] ?? 'PLANIFIEE'} label={typeLabel[n.type] ?? n.type} /></td>
                <td>{n.category}</td>
                <td><strong>{n.title}</strong></td>
                <td>{n.message}</td>
                <td><StatusPill status={n.read ? 'TERMINEE' : 'EN_COURS'} label={n.read ? 'Lu' : 'Non lu'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}
