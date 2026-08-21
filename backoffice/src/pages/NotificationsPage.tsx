import { useEffect, useState } from 'react';
import { api, NotificationItem } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printNotifications, printGenericReport } from '../documents/templates';

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
          <>
            <DocButton label="Journal" onClick={() => printNotifications(items)} />
            {can('notifications', 'read') && (
              <button type="button" className="erp-btn erp-btn--ghost" onClick={markAll}>Tout marquer comme lu</button>
            )}
          </>
        }
      />
      <ErpPanel title={`Messages (${items.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Catégorie</th><th>Titre</th><th>Message</th><th>Statut</th><th>Actions</th></tr>
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
                <td className="erp-row-actions">
                  <DocButton onClick={() => printGenericReport('Notification', {
                    reference: n.id.slice(0, 8),
                    fields: [
                      { label: 'Type', value: n.type },
                      { label: 'Catégorie', value: n.category },
                      { label: 'Titre', value: n.title },
                      { label: 'Message', value: n.message },
                      { label: 'Date', value: new Date(n.createdAt).toLocaleString('fr-FR') },
                    ],
                  })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}

