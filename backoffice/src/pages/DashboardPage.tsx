import { useEffect, useState } from 'react';
import { api, DashboardOverview } from '../api';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error-msg">{error}</p>;
  if (!data) return <p>Chargement du tableau de bord...</p>;

  return (
    <div>
      <div className="page-header">
        <h2>Tableau de bord</h2>
        <p>Vue d'ensemble des opérations du jour</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Clients actifs</div>
          <div className="value">{data.clientsCount}</div>
        </div>
        <div className="stat-card">
          <div className="label">Commandes aujourd'hui</div>
          <div className="value">{data.ordersToday}</div>
        </div>
        <div className="stat-card">
          <div className="label">Livraisons aujourd'hui</div>
          <div className="value">{data.deliveriesToday}</div>
        </div>
        <div className="stat-card">
          <div className="label">Encaissements (CDF)</div>
          <div className="value">{Number(data.revenueToday).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">Tournées actives</div>
          <div className="value">{data.activeTours}</div>
        </div>
        <div className="stat-card">
          <div className="label">Stock total (unités)</div>
          <div className="value">{data.totalStock}</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Stock par produit</h3>
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Quantité</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.stockByProduct).map(([name, qty]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
