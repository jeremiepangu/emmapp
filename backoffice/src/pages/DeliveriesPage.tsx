import { useEffect, useState } from 'react';
import { api, Delivery } from '../api';

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  useEffect(() => {
    api.getDeliveries().then(setDeliveries);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Livraisons</h2>
        <p>Preuves de livraison et historique</p>
      </div>
      <div className="card">
        {deliveries.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Aucune livraison enregistrée pour le moment.</p>
        ) : (
          <table>
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
                  <td>{d.deliveryNumber}</td>
                  <td>{d.client?.name ?? '-'}</td>
                  <td><span className="badge badge-success">{d.status}</span></td>
                  <td>{d.deliveredAt ? new Date(d.deliveredAt).toLocaleString('fr-FR') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
