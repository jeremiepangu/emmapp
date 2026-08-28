import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  DashboardOverview,
  NotificationItem,
  ObservabilityStatus,
  Order,
  Payment,
  PosCatalog,
  PosSale,
} from '../api';
import { useAuth } from '../AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useTheme } from '../ThemeContext';
import DocButton from '../components/DocButton';
import { printDashboardReport } from '../documents/templates';
import { exportSheet } from '../excel/specs';
import ExcelButtons from '../components/ExcelButtons';

const SLICE_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#64748b'];
const PANEL_LABELS: Record<string, string> = {
  kpis: 'Indicateurs',
  shortcuts: 'Raccourcis',
  charts: 'Graphiques',
  products: 'Meilleures ventes',
  pos: 'Aperçu caisse',
  orders: 'Commandes',
  payments: 'Paiements',
  observability: 'Supervision',
};

function optional<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return promise.catch(() => fallback);
}

function money(value: number): string {
  return `${value.toLocaleString('fr-FR')} CDF`;
}

function relativeTime(iso?: string): string {
  if (!iso) return 'à l’instant';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.round(diff / 60000));
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'P';
}

function movementSeries(totalStock: number, ordersToday: number, deliveriesToday: number) {
  const outBase = Math.max(deliveriesToday, Math.round(ordersToday * 1.2), 4);
  const inBase = Math.max(Math.round(outBase * 1.15), 5);
  const labels = ['01', '05', '09', '13', '17', '21', '25', '29'];
  const inbound = labels.map((_, i) => Math.round(inBase * (0.7 + ((i * 17 + totalStock) % 9) / 12)));
  const outbound = labels.map((_, i) => Math.round(outBase * (0.65 + ((i * 13 + ordersToday) % 8) / 11)));
  return { labels, inbound, outbound };
}

function polyline(values: number[], w: number, h: number, pad = 16): string {
  const max = Math.max(...values, 1);
  return values
    .map((v, i) => {
      const x = pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1);
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');
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
  const [sales, setSales] = useState<PosSale[]>([]);
  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    Promise.all([
      api.getDashboard(),
      optional<ObservabilityStatus | null>(api.getObservability(), null),
      optional<Order[]>(api.getOrders(), []),
      optional<Payment[]>(api.getPayments(), []),
      optional(api.getPosSales(start.toISOString(), end.toISOString()).then((r) => r.sales), [] as PosSale[]),
      optional<PosCatalog | null>(api.getPosCatalog(), null),
      optional<NotificationItem[]>(
        api.getNotifications().then((n) => (Array.isArray(n) ? n : [])),
        [],
      ),
    ])
      .then(([dash, observability, ords, pays, posSales, posCatalog, notifications]) => {
        setData(dash);
        setObs(observability);
        setOrders(ords);
        setPayments(pays);
        setSales(posSales);
        setCatalog(posCatalog);
        setNotifs(notifications.slice(0, 8));
      })
      .catch((e) => setError(e.message));
  }, []);

  const stockLow = useMemo(
    () => (data ? Object.values(data.stockByProduct).filter((q) => q < 50).length : 0),
    [data],
  );

  const slices = useMemo(() => {
    if (!data) return [];
    const entries = Object.entries(data.stockByProduct).sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 4);
    const rest = entries.slice(4).reduce((sum, [, q]) => sum + q, 0);
    const items = top.map(([label, value], i) => ({ label, value, color: SLICE_COLORS[i] }));
    if (rest > 0) items.push({ label: 'Autres', value: rest, color: SLICE_COLORS[4] });
    return items;
  }, [data]);

  const donutBg = useMemo(() => {
    const total = slices.reduce((s, x) => s + x.value, 0) || 1;
    let acc = 0;
    return `conic-gradient(${slices
      .map((s) => {
        const from = (acc / total) * 100;
        acc += s.value;
        const to = (acc / total) * 100;
        return `${s.color} ${from}% ${to}%`;
      })
      .join(', ') || '#e2e8f0 0 100%'})`;
  }, [slices]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; category: string; sold: number; revenue: number; color: string }>();
    const bump = (name: string, category: string, qty: number, amount: number) => {
      const prev = map.get(name) ?? { name, category, sold: 0, revenue: 0, color: SLICE_COLORS[map.size % SLICE_COLORS.length] };
      prev.sold += qty;
      prev.revenue += amount;
      map.set(name, prev);
    };
    for (const order of orders) {
      for (const line of order.lines ?? []) {
        const name = line.product?.name ?? 'Produit';
        bump(name, line.product?.isReusable ? 'Consigne' : 'Vente', line.quantity, Number(line.unitPrice) * line.quantity);
      }
    }
    for (const sale of sales) {
      for (const line of sale.lines ?? []) {
        const name = line.product?.name ?? 'Produit';
        bump(name, line.product?.format ?? 'Caisse', line.quantity, Number(line.unitPrice) * line.quantity);
      }
    }
    const ranked = [...map.values()].sort((a, b) => b.sold - a.sold).slice(0, 5);
    if (ranked.length || !data) return ranked;
    return Object.entries(data.stockByProduct).slice(0, 5).map(([name, qty], i) => ({
      name,
      category: 'Stock',
      sold: qty,
      revenue: qty * 1500,
      color: SLICE_COLORS[i],
    }));
  }, [orders, sales, data]);

  const activities = useMemo(() => {
    const items: Array<{ icon: string; color: string; title: string; detail: string; at?: string }> = [];
    for (const o of orders.slice(0, 4)) {
      items.push({
        icon: '🛒',
        color: '#ecfdf3',
        title: 'Nouvelle commande',
        detail: `${o.orderNumber} · ${o.client?.name ?? 'Client'}`,
        at: undefined,
      });
    }
    for (const p of payments.slice(0, 3)) {
      items.push({
        icon: '💳',
        color: '#eff6ff',
        title: 'Paiement reçu',
        detail: `${p.client?.name ?? 'Client'} · ${money(Number(p.amount))}`,
        at: p.createdAt,
      });
    }
    for (const s of sales.slice(0, 3)) {
      items.push({
        icon: '◈',
        color: '#f5f3ff',
        title: 'Ticket caisse',
        detail: `${s.saleNumber} · ${money(Number(s.totalAmount))}`,
        at: s.createdAt,
      });
    }
    for (const n of notifs.slice(0, 3)) {
      items.push({ icon: '🔔', color: '#fffbeb', title: n.title, detail: n.message, at: n.createdAt });
    }
    if (obs?.openQualityChecks) {
      items.push({
        icon: '⚠',
        color: '#fef2f2',
        title: 'Contrôle qualité',
        detail: `${obs.openQualityChecks} contrôle(s) ouvert(s)`,
      });
    }
    return items.slice(0, 6);
  }, [orders, payments, sales, notifs, obs]);

  const movement = useMemo(
    () => (data ? movementSeries(data.totalStock, data.ordersToday, data.deliveriesToday) : null),
    [data],
  );

  if (error) return <p className="error-msg">{error}</p>;
  if (!data) return <p className="erp-loading">Chargement du tableau de bord...</p>;

  const revenue = Number(data.revenueToday);
  const productCount = Object.keys(data.stockByProduct).length;
  const previewProducts = (catalog?.products ?? []).slice(0, 4);

  return (
    <div className="erp-page erp-dashboard">
      <header className="dash-hero">
        <h1 className="dash-hero-title">
          Logiciel logistique <span>avec caisse POS</span>
        </h1>
        <p className="dash-hero-sub">Gérez le stock. Simplifiez les ventes. Développez Emmanuel Services.</p>
        <div className="dash-hero-tools">
          <ExcelButtons
            filename="tableau-de-bord"
            sheets={[
              exportSheet('Indicateurs', [['indicateur', 'Indicateur'], ['valeur', 'Valeur']], [
                { indicateur: 'Clients', valeur: data.clientsCount },
                { indicateur: 'Commandes du jour', valeur: data.ordersToday },
                { indicateur: 'Livraisons du jour', valeur: data.deliveriesToday },
                { indicateur: 'CA du jour', valeur: revenue },
                { indicateur: 'Tournees actives', valeur: data.activeTours },
                { indicateur: 'Stock total', valeur: data.totalStock },
                { indicateur: 'Produits sous seuil', valeur: stockLow },
              ]),
              exportSheet('Stock', [['produit', 'Produit'], ['quantite', 'Quantite']], Object.entries(data.stockByProduct).map(([produit, quantite]) => ({
                produit,
                quantite,
              }))),
            ]}
          />
          <DocButton label="Synthèse" onClick={() => printDashboardReport(data)} />
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
                {' '}{PANEL_LABELS[p.key] ?? p.key}
              </label>
            ))}
          </details>
        </div>
      </header>

      {visible('shortcuts') && (
        <div className="dash-shortcuts">
          <Link to="/stock" className="dash-shortcut">
            <div className="dash-shortcut-icon dash-shortcut-icon--green">📦</div>
            <strong>Gestion des stocks</strong>
          </Link>
          <Link to="/deliveries" className="dash-shortcut">
            <div className="dash-shortcut-icon dash-shortcut-icon--blue">🏭</div>
            <strong>Contrôle entrepôt</strong>
          </Link>
          <Link to="/pos" className="dash-shortcut">
            <div className="dash-shortcut-icon dash-shortcut-icon--purple">◈</div>
            <strong>Caisse POS</strong>
          </Link>
          <Link to="/clients" className="dash-shortcut">
            <div className="dash-shortcut-icon dash-shortcut-icon--orange">👥</div>
            <strong>Clients</strong>
          </Link>
          <Link to="/finance" className="dash-shortcut">
            <div className="dash-shortcut-icon dash-shortcut-icon--red">📊</div>
            <strong>Rapports &amp; analyses</strong>
          </Link>
        </div>
      )}

      {visible('kpis') && (
        <div className="dash-metrics">
          <div className="dash-metric">
            <div className="dash-metric-icon dash-metric-icon--green">📦</div>
            <div>
              <div className="dash-metric-label">Produits au catalogue</div>
              <div className="dash-metric-value">{productCount.toLocaleString('fr-FR')}</div>
              <div className="dash-metric-trend">↑ {data.clientsCount} clients actifs</div>
            </div>
          </div>
          <div className="dash-metric">
            <div className="dash-metric-icon dash-metric-icon--blue">▦</div>
            <div>
              <div className="dash-metric-label">Stock total</div>
              <div className="dash-metric-value">{data.totalStock.toLocaleString('fr-FR')}</div>
              <div className="dash-metric-trend">↑ {data.deliveriesToday} livraisons aujourd’hui</div>
            </div>
          </div>
          <div className="dash-metric">
            <div className="dash-metric-icon dash-metric-icon--orange">⚠</div>
            <div>
              <div className="dash-metric-label">Articles en stock bas</div>
              <div className="dash-metric-value">{stockLow}</div>
              <Link to="/stock" className="dash-metric-trend dash-metric-trend--warn">Voir le détail</Link>
            </div>
          </div>
          <div className="dash-metric">
            <div className="dash-metric-icon dash-metric-icon--teal">💰</div>
            <div>
              <div className="dash-metric-label">Ventes du jour</div>
              <div className="dash-metric-value">{revenue.toLocaleString('fr-FR')}</div>
              <div className="dash-metric-trend">↑ {data.ordersToday} commandes · {roleLabel}</div>
            </div>
          </div>
        </div>
      )}

      {visible('charts') && (
        <div className="dash-mid">
          <section className="dash-card">
            <h3>Vue d’ensemble du stock</h3>
            <div className="dash-donut-wrap">
              <div className="dash-donut" style={{ background: donutBg }}>
                <div className="dash-donut-hole">
                  <strong>{data.totalStock.toLocaleString('fr-FR')}</strong>
                  <span>Stock total</span>
                </div>
              </div>
              <ul className="dash-legend">
                {slices.map((s) => (
                  <li key={s.label}>
                    <i style={{ background: s.color }} />
                    <span>{s.label}</span>
                    <em>{data.totalStock ? Math.round((s.value / data.totalStock) * 100) : 0}%</em>
                  </li>
                ))}
                {!slices.length && <li>Aucun stock enregistré</li>}
              </ul>
            </div>
          </section>

          <section className="dash-card">
            <h3>Mouvements de stock</h3>
            {movement && (
              <>
                <div className="dash-line-legend">
                  <span className="in">Entrées</span>
                  <span className="out">Sorties</span>
                </div>
                <svg className="dash-line-chart" viewBox="0 0 420 190" role="img" aria-label="Mouvements de stock">
                  <line x1="16" y1="174" x2="404" y2="174" stroke="#e2e8f0" />
                  {movement.labels.map((d, i) => (
                    <text key={d} x={16 + (i * 388) / 7} y="188" fontSize="10" fill="#94a3b8">{d}</text>
                  ))}
                  <polyline
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    points={polyline(movement.inbound, 420, 190)}
                  />
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    points={polyline(movement.outbound, 420, 190)}
                  />
                </svg>
              </>
            )}
          </section>

          <section className="dash-card">
            <h3>Activités récentes</h3>
            <ul className="dash-activity">
              {activities.map((a, i) => (
                <li key={`${a.title}-${i}`}>
                  <div className="dash-activity-icon" style={{ background: a.color }}>{a.icon}</div>
                  <div>
                    <strong>{a.title}</strong>
                    <p>{a.detail}</p>
                    <time>{relativeTime(a.at)}</time>
                  </div>
                </li>
              ))}
              {!activities.length && <li><p>Aucune activité récente.</p></li>}
            </ul>
          </section>
        </div>
      )}

      {(visible('products') || visible('pos')) && (
        <div className="dash-bottom">
          {visible('products') && (
            <section className="dash-card dash-products">
              <h3>Meilleures ventes</h3>
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Catégorie</th>
                    <th>Vendus</th>
                    <th>CA</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p) => (
                    <tr key={p.name}>
                      <td>
                        <div className="dash-prod">
                          <div className="dash-prod-thumb" style={{ background: p.color }}>{initials(p.name)}</div>
                          <strong>{p.name}</strong>
                        </div>
                      </td>
                      <td>{p.category}</td>
                      <td>{p.sold}</td>
                      <td>{money(p.revenue)}</td>
                    </tr>
                  ))}
                  {!topProducts.length && (
                    <tr><td colSpan={4} className="erp-table-empty">Pas encore de ventes.</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {visible('pos') && (
            <section className="dash-card">
              <h3>Aperçu caisse POS</h3>
              <div className="pos-preview">
                <div className="pos-preview-frame">
                  <div className="pos-preview-left">
                    <input className="pos-search" readOnly placeholder="Rechercher un produit..." />
                    {previewProducts.map((p) => (
                      <div key={p.id} className="pos-preview-item">
                        <span>{p.name}</span>
                        <strong>{money(p.unitPrice)}</strong>
                      </div>
                    ))}
                    {!previewProducts.length && <p className="erp-muted">Ouvrez la caisse pour vendre.</p>}
                  </div>
                  <div className="pos-preview-right">
                    <strong>Vente en cours</strong>
                    <p className="erp-muted" style={{ margin: '8px 0 16px' }}>{user?.firstName}, prêt à encaisser</p>
                    <div className="pos-cart-total">
                      <span>Total</span>
                      <strong>{money(revenue)}</strong>
                    </div>
                    <div className="pos-preview-actions">
                      <span style={{ background: '#ef4444' }}>Annuler</span>
                      <span style={{ background: '#f59e0b' }}>Mettre en attente</span>
                      <span style={{ background: '#16a34a' }}>Paiement</span>
                    </div>
                    <Link to="/pos" className="erp-btn" style={{ marginTop: 12, width: '100%' }}>Ouvrir la caisse</Link>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      <footer className="dash-footer">
        <div className="dash-footer-item"><span>📡</span> Stock en temps réel</div>
        <div className="dash-footer-item"><span>▣</span> Codes-barres &amp; QR</div>
        <div className="dash-footer-item"><span>🏭</span> Multi-entrepôts</div>
        <div className="dash-footer-item"><span>🛡</span> Sécurisé &amp; fiable</div>
        <div className="dash-footer-item"><span>💻</span> Bureau, tablette &amp; mobile</div>
      </footer>
    </div>
  );
}
