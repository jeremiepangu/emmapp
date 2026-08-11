import { useEffect, useState } from 'react';
import { api, Tour } from '../api';

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    PLANIFIEE: 'badge-info',
    EN_COURS: 'badge-success',
    EN_CHARGEMENT: 'badge-warning',
    TERMINEE: 'badge-info',
    ANNULEE: 'badge-warning',
  };
  return map[status] ?? 'badge-info';
};

export default function ToursPage() {
  const [tours, setTours] = useState<Tour[]>([]);

  useEffect(() => {
    api.getTours().then(setTours);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Tournées</h2>
        <p>Planification et suivi des livraisons</p>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>N° Tournée</th>
              <th>Zone</th>
              <th>Date</th>
              <th>Livreur</th>
              <th>Véhicule</th>
              <th>Commandes</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {tours.map((t) => (
              <tr key={t.id}>
                <td>{t.tourNumber}</td>
                <td>{t.zone}</td>
                <td>{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                <td>{t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : '-'}</td>
                <td>{t.vehicle?.plate ?? '-'}</td>
                <td>{t.orders?.length ?? 0}</td>
                <td><span className={`badge ${statusBadge(t.status)}`}>{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
