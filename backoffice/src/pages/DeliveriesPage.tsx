import { useEffect, useState } from 'react';
import { api, Delivery } from '../api';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  useEffect(() => {
    api.getDeliveries().then(setDeliveries);
  }, []);

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Livraisons"
        subtitle="Preuves de livraison et historique"
      />
      <ErpPanel title={`Historique (${deliveries.length})`}>
        {deliveries.length === 0 ? (
          <p className="erp-table-empty">Aucune livraison enregistrée pour le moment.</p>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>N° Livraison</th>
                <th>Client</th>
                <th>Statut</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.deliveryNumber}</strong></td>
                  <td>{d.client?.name ?? '—'}</td>
                  <td><StatusPill status={d.status} label={d.status} /></td>
                  <td>{d.deliveredAt ? new Date(d.deliveredAt).toLocaleString('fr-FR') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ErpPanel>
    </div>
  );
}
