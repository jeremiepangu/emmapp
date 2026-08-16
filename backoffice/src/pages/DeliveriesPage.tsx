import { useEffect, useState } from 'react';
import { api, Delivery } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';

export default function DeliveriesPage() {
  const { can } = usePermissions();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const load = () => api.getDeliveries().then(setDeliveries);
  useEffect(() => { load(); }, []);

  return (
    <div className="erp-page">
      <ErpPageHeader title="Livraisons" subtitle="Preuves de livraison, validation et historique" />
      <ErpPanel title={`Historique (${deliveries.length})`}>
        {deliveries.length === 0 ? (
          <p className="erp-table-empty">Aucune livraison enregistrée pour le moment.</p>
        ) : (
          <table className="erp-table">
            <thead>
              <tr><th>N° Livraison</th><th>Client</th><th>Statut</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.deliveryNumber}</strong></td>
                  <td>{d.client?.name ?? '—'}</td>
                  <td><StatusPill status={d.status} label={d.status} /></td>
                  <td>{d.deliveredAt ? new Date(d.deliveredAt).toLocaleString('fr-FR') : '—'}</td>
                  <td className="erp-row-actions">
                    {can('deliveries', 'validate') && d.status === 'EN_ATTENTE' && (
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.updateDelivery(d.id, { status: 'LIVREE' }).then(load)}>Valider</button>
                    )}
                    {can('deliveries', 'update') && d.status === 'EN_ATTENTE' && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.updateDelivery(d.id, { status: 'REFUSEE' }).then(load)}>Refuser</button>
                    )}
                    {can('deliveries', 'delete') && d.status !== 'LIVREE' && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteDelivery(d.id).then(load)}>Supprimer</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ErpPanel>
    </div>
  );
}
