import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, DashboardOverview, ObservabilityStatus, Order, Payment } from '../api';
import { useAuth } from '../AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useTheme } from '../ThemeContext';
import { ErpPanel, ErpPageHeader, RingGauge } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';

/** Un panneau refusé au profil connecté ne doit pas faire échouer la page entière. */
function optional<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return promise.catch(() => fallback);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { roleLabel } = usePermissions();
  const { dashboardLayout, setDashboardLayout } = useTheme();
  const visible = (key: string) => dashboardLayout?.find((p) => p.key === key)?.visible !== false;
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [obs, setObs] = useState<ObservabilityStatus | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.getDashboard(),
      optional<ObservabilityStatus | null>(api.getObservability(), null),
      optional<Order[]>(api.getOrders(), []),
      optional<Payment[]>(api.getPayments(), []),
    ])
      .then(([dash, observability, ords, pays]) => {
        setData(dash);
        setObs(observability);
        setOrders(ords.slice(0, 6));
        setPayments(pays.slice(0, 6));
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error-msg">{error}</p>;
  if (!data) return <p className="erp-loading">Chargement du tableau de bord...</p>;

  const revenue = Number(data.revenueToday);
  const orderGoal = Math.min(100, Math.round((data.ordersToday / 20) * 100)) || 5;
  const revenueGoal = Math.min(100, Math.round((revenue / 500000) * 100)) || 8;
  const stockLow = Object.values(data.stockByProduct).filter((q) => q < 50).length;

  return (
    <div className="erp-page erp-dashboard">
      <ErpPageHeader
        title="Tableau de bord"
        subtitle={`Vue d'ensemble · ${user?.firstName} ${user?.lastName}`}
        actions={
          <>
            <select className="erp-select" defaultValue={user?.id} aria-label="Profil utilisateur">
              <option>{user?.firstName} {user?.lastName} — {roleLabel}</option>
            </select>
            {obs && obs.openQualityChecks > 0 && (
              <Link to="/quality" className="erp-sticky-note" title="Contrôles qualité ouverts">
                {obs.openQualityChecks}
              </Link>
            )}
            <details className="erp-dash-customize">
              <summary>Personnaliser</summary>
              {(dashboardLayout ?? []).map((p) => (
                <label key={p.key}>
                  <input
                    type="checkbox"
                    checked={p.visible}
                    onChange={() => setDashboardLayout(
                      (dashboardLayout ?? []).map((x) => x.key === p.key ? { ...x, visible: !x.visible } : x),
                    )}
                  />
                  {' '}{p.key}
                </label>
              ))}
            </details>
          </>
        }
      />

      {visible('kpis') && (
      <div className="erp-kpi-row">
        <div className="erp-kpi erp-kpi--green">
          <div className="erp-kpi-label">Factures / Encaissements (CDF)</div>
          <div className="erp-kpi-value">{revenue.toLocaleString('fr-FR')}</div>
          <div className="erp-kpi-meta">{data.deliveriesToday} livraisons aujourd&apos;hui</div>
          <Link to="/payments" className="erp-kpi-link">Plus d&apos;info ›</Link>
        </div>
        <div className="erp-kpi erp-kpi--blue">
          <div className="erp-kpi-label">Commandes du jour</div>
          <div className="erp-kpi-value">{data.ordersToday}</div>
          <div className="erp-kpi-meta">{data.clientsCount} clients actifs</div>
          <Link to="/orders" className="erp-kpi-link">Plus d&apos;info ›</Link>
        </div>
        <div className="erp-kpi erp-kpi--red">
          <div className="erp-kpi-label">Tournées &amp; alertes</div>
          <div className="erp-kpi-value">{data.activeTours}</div>
          <div className="erp-kpi-meta">{obs?.blockedLots ?? 0} lots bloqués · {obs?.pendingSync ?? 0} sync</div>
          <Link to="/tours" className="erp-kpi-link">Plus d&apos;info ›</Link>
        </div>
      </div>
      )}

      {visible('observability') && obs && (
        <div className="erp-kpi-mini-row">
          <div className="erp-kpi-mini">
            <div className="erp-kpi-mini-icon erp-kpi-mini-icon--blue">📦</div>
            <div>
              <div className="erp-kpi-mini-label">Stock total</div>
              <div className="erp-kpi-mini-value">{data.totalStock} u.</div>
            </div>
          </div>
          <div className="erp-kpi-mini">
            <div className="erp-kpi-mini-icon erp-kpi-mini-icon--orange">⚠</div>
            <div>
              <div className="erp-kpi-mini-label">Produits stock bas</div>
              <div className="erp-kpi-mini-value">{stockLow}</div>
            </div>
          </div>
          <div className="erp-kpi-mini">
            <div className="erp-kpi-mini-icon erp-kpi-mini-icon--green">✓</div>
            <div>
              <div className="erp-kpi-mini-label">Shifts à valider</div>
              <div className="erp-kpi-mini-value">{obs.pendingShiftValidations}</div>
            </div>
          </div>
          <div className="erp-kpi-mini">
            <div className="erp-kpi-mini-icon erp-kpi-mini-icon--red">◎</div>
            <div>
              <div className="erp-kpi-mini-label">Sync en attente</div>
              <div className="erp-kpi-mini-value">{obs.pendingSync}</div>
            </div>
          </div>
        </div>
      )}

      <div className="erp-dashboard-grid">
        <div className="erp-dashboard-col">
          {visible('orders') && (
          <ErpPanel
            title="Dernières commandes en cours"
            actions={
              <>
                <Link to="/orders" className="erp-btn erp-btn--sm">AJOUTER</Link>
                <Link to="/orders" className="erp-btn erp-btn--sm erp-btn--ghost">TOUT AFFICHER</Link>
              </>
            }
          >
            {orders.length === 0 ? (
              <p className="erp-table-empty">Aucune commande récente</p>
            ) : (
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Réf.</th>
                    <th>Client</th>
                    <th>Montant</th>
                    <th>État</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td><strong>{o.orderNumber}</strong></td>
                      <td>{o.client?.name ?? '—'}</td>
                      <td>{Number(o.totalAmount).toLocaleString('fr-FR')} CDF</td>
                      <td><StatusPill status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ErpPanel>
          )}

          {visible('payments') && (
          <ErpPanel title="Derniers paiements">
            {payments.length === 0 ? (
              <p className="erp-table-empty">Aucun paiement récent</p>
            ) : (
              <table className="erp-table">
                <thead>
                  <tr><th>Date</th><th>Client</th><th>Montant</th><th>Mode</th></tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td>{p.client?.name ?? '—'}</td>
                      <td>{Number(p.amount).toLocaleString('fr-FR')}</td>
                      <td>{p.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ErpPanel>
          )}
        </div>

        <div className="erp-dashboard-col erp-dashboard-col--charts">
          <ErpPanel title="Vos objectifs">
            <div className="erp-rings-row">
              <RingGauge value={orderGoal} label="Objectif commandes / mois" color="#5cb85c" />
              <RingGauge value={revenueGoal} label="Objectif CA / mois" color="#5bc0de" />
            </div>
          </ErpPanel>

          <ErpPanel title="Stock par produit">
            <div className="erp-bar-chart">
              {Object.entries(data.stockByProduct).slice(0, 6).map(([name, qty]) => {
                const max = Math.max(...Object.values(data.stockByProduct), 1);
                return (
                  <div key={name} className="erp-bar-row">
                    <span className="erp-bar-label">{name.length > 14 ? `${name.slice(0, 14)}…` : name}</span>
                    <div className="erp-bar-track">
                      <div className="erp-bar-fill" style={{ width: `${(qty / max) * 100}%` }} />
                    </div>
                    <span className="erp-bar-val">{qty}</span>
                  </div>
                );
              })}
            </div>
          </ErpPanel>

          {obs && (
            <ErpPanel title="Supervision">
              <ul className="erp-supervision-list">
                <li><span>Contrôles qualité ouverts</span><strong>{obs.openQualityChecks}</strong></li>
                <li><span>Shifts à valider</span><strong>{obs.pendingShiftValidations}</strong></li>
                <li><span>Lots bloqués</span><strong>{obs.blockedLots}</strong></li>
                <li><span>Stock total</span><strong>{data.totalStock} u.</strong></li>
              </ul>
            </ErpPanel>
          )}
        </div>
      </div>
    </div>
  );
}

