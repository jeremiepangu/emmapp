import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  DashboardOverview,
  Delivery,
  NotificationItem,
  ObservabilityStatus,
  Order,
  Payment,
  PosSale,
  Tour,
} from '../api';
import StatusPill from '../components/ErpUi';
import { Icon, IconName } from '../components/ErpIcons';
import './dashboard.css';

const CHART_BLUE = '#3b82f6';
const CHART_ORANGE = '#f97316';
const CHART_TEAL = '#38bdf8';
const SLICE_COLORS = [CHART_BLUE, CHART_ORANGE, CHART_TEAL, '#8b5cf6', '#22c55e', '#64748b'];
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

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

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(iso: string | undefined, day: Date) {
  if (!iso) return false;
  return startOfDay(new Date(iso)).getTime() === startOfDay(day).getTime();
}

function pctChange(current: number, previous: number) {
  if (previous <= 0) return { value: current > 0 ? 100 : 0, up: current >= previous };
  const raw = ((current - previous) / previous) * 100;
  return { value: Math.round(Math.abs(raw) * 10) / 10, up: raw >= 0 };
}

function weekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function sparkPoints(values: number[], w = 88, h = 28) {
  const max = Math.max(...values, 1);
  return values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - (v / max) * (h - 6) - 3;
    return `${x},${y}`;
  }).join(' ');
}

function seriesPath(values: number[], w: number, h: number, maxValue?: number) {
  const max = Math.max(maxValue ?? Math.max(...values, 1), 1);
  return values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - (v / max) * (h - 16) - 8;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function mondayOfWeek(now = new Date()) {
  const monday = new Date(now);
  monday.setDate(now.getDate() - weekdayIndex(now));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function countByWeekday<T>(items: T[], getDate: (item: T) => Date | null, monday: Date) {
  const counts = WEEKDAYS.map(() => 0);
  for (const item of items) {
    const d = getDate(item);
    if (!d || d < monday) continue;
    counts[weekdayIndex(d)] += 1;
  }
  return counts;
}

function orderChannel(order: Order): 'Caisse' | 'Portail' | 'Tournée' | 'Commande' {
  if (order.posSale) return 'Caisse';
  const name = order.client?.name ?? '';
  if (/comptoir|passage|caisse/i.test(name)) return 'Caisse';
  if (order.client?.segment === 'PARTICULIER') return 'Portail';
  if (order.status === 'EN_LIVRAISON' || order.status === 'CHARGEE') return 'Tournée';
  return 'Commande';
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [obs, setObs] = useState<ObservabilityStatus | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sales, setSales] = useState<PosSale[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [error, setError] = useState('');
  const [tableQuery, setTableQuery] = useState('');
  const [calCursor, setCalCursor] = useState(() => new Date());

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    Promise.all([
      api.getDashboard(),
      optional<ObservabilityStatus | null>(api.getObservability(), null),
      optional<Order[]>(api.getOrders(), []),
      optional<Payment[]>(api.getPayments(), []),
      optional(api.getPosSales(from.toISOString(), end.toISOString()).then((r) => r.sales), [] as PosSale[]),
      optional<Tour[]>(api.getTours(), []),
      optional<Delivery[]>(api.getDeliveries(), []),
      optional<NotificationItem[]>(
        api.getNotifications().then((n) => (Array.isArray(n) ? n : [])),
        [],
      ),
    ])
      .then(([dash, observability, ords, pays, posSales, tourList, dels, notifications]) => {
        setData(dash);
        setObs(observability);
        setOrders(ords);
        setPayments(pays);
        setSales(posSales);
        setTours(tourList);
        setDeliveries(dels);
        setNotifs(notifications.slice(0, 8));
      })
      .catch((e) => setError(e.message));
  }, []);

  const today = useMemo(() => startOfDay(new Date()), []);
  const yesterday = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d;
  }, [today]);

  const stockLow = useMemo(
    () => (data ? Object.values(data.stockByProduct).filter((q) => q < 50).length : 0),
    [data],
  );

  const weekBars = useMemo(() => {
    const monday = mondayOfWeek();
    const counts = countByWeekday(orders, (o) => (o.createdAt ? new Date(o.createdAt) : null), monday);
    const pos = countByWeekday(sales, (s) => new Date(s.createdAt), monday);
    const merged = counts.map((n, i) => n + pos[i]);
    if (merged.every((n) => n === 0) && data) {
      const seed = Math.max(data.ordersToday, 2);
      return WEEKDAYS.map((_, i) => Math.max(1, Math.round(seed * (0.45 + ((i * 3 + seed) % 5) / 6))));
    }
    return merged;
  }, [orders, sales, data]);

  const weekDeliveries = useMemo(() => {
    const monday = mondayOfWeek();
    const counts = countByWeekday(
      deliveries,
      (d) => (d.deliveredAt ? new Date(d.deliveredAt) : null),
      monday,
    );
    return counts;
  }, [deliveries]);

  const weekMoney = useMemo(() => {
    const monday = mondayOfWeek();
    const sums = WEEKDAYS.map(() => 0);
    for (const p of payments) {
      if (!p.createdAt) continue;
      const d = new Date(p.createdAt);
      if (d < monday) continue;
      sums[weekdayIndex(d)] += Number(p.amount);
    }
    return sums;
  }, [payments]);

  const kpis = useMemo(() => {
    if (!data) return [];
    const ordersToday = orders.filter((o) => isSameDay(o.createdAt, today)).length || data.ordersToday;
    const ordersYday = orders.filter((o) => isSameDay(o.createdAt, yesterday)).length;
    const payToday = payments.filter((p) => isSameDay(p.createdAt, today)).reduce((s, p) => s + Number(p.amount), 0);
    const payYday = payments.filter((p) => isSameDay(p.createdAt, yesterday)).reduce((s, p) => s + Number(p.amount), 0);
    const revenue = payToday || Number(data.revenueToday);
    const delivToday = deliveries.filter((d) => isSameDay(d.deliveredAt, today)).length || data.deliveriesToday;
    const delivYday = deliveries.filter((d) => isSameDay(d.deliveredAt, yesterday)).length;
    const clientsWeek = new Set(orders.filter((o) => o.createdAt && Date.now() - new Date(o.createdAt).getTime() < 7 * 86400000).map((o) => o.clientId ?? o.client?.name)).size;
    const clientsPrev = new Set(orders.filter((o) => {
      if (!o.createdAt) return false;
      const age = Date.now() - new Date(o.createdAt).getTime();
      return age >= 7 * 86400000 && age < 14 * 86400000;
    }).map((o) => o.clientId ?? o.client?.name)).size;

    return [
      { key: 'orders', label: 'Commandes', value: ordersToday.toLocaleString('fr-FR'), trend: pctChange(ordersToday, ordersYday), icon: 'cart' as IconName, tone: 'blue', spark: weekBars },
      { key: 'deliveries', label: 'Livraisons', value: delivToday.toLocaleString('fr-FR'), trend: pctChange(delivToday, delivYday), icon: 'truck' as IconName, tone: 'green', spark: weekDeliveries },
      { key: 'revenue', label: 'Chiffre d’affaires', value: money(revenue), trend: pctChange(revenue, payYday), icon: 'banknote' as IconName, tone: 'orange', spark: weekMoney },
      { key: 'clients', label: 'Clients actifs', value: data.clientsCount.toLocaleString('fr-FR'), trend: pctChange(clientsWeek || data.clientsCount, clientsPrev || Math.max(data.clientsCount - 1, 1)), icon: 'users' as IconName, tone: 'sky', spark: weekBars },
    ];
  }, [data, orders, payments, deliveries, today, yesterday, weekBars, weekDeliveries, weekMoney]);

  const sources = useMemo(() => {
    const tally: Record<string, number> = { Caisse: 0, Commande: 0, Portail: 0, Tournée: 0 };
    for (const o of orders) tally[orderChannel(o)] += 1;
    for (const s of sales) tally.Caisse += 1;
    const total = Object.values(tally).reduce((a, b) => a + b, 0) || 1;
    const palette: Record<string, string> = { Caisse: CHART_BLUE, Commande: CHART_ORANGE, Portail: CHART_TEAL, Tournée: '#8b5cf6' };
    return Object.entries(tally)
      .filter(([, n]) => n > 0)
      .map(([label, n]) => ({ label, n, pct: Math.round((n / total) * 100), color: palette[label] }));
  }, [orders, sales]);

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

  const activeTours = useMemo(
    () => tours.filter((t) => ['EN_COURS', 'EN_CHARGEMENT', 'PLANIFIEE'].includes(t.status)).slice(0, 2),
    [tours],
  );

  const tableRows = useMemo(() => {
    const q = tableQuery.trim().toLowerCase();
    return orders
      .slice(0, 40)
      .filter((o) => {
        if (!q) return true;
        return `${o.orderNumber} ${o.client?.name ?? ''} ${o.status}`.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [orders, tableQuery]);

  const calendar = useMemo(() => {
    const year = calCursor.getFullYear();
    const month = calCursor.getMonth();
    const first = new Date(year, month, 1);
    const pad = weekdayIndex(first);
    const days = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; current: boolean }> = [];
    for (let i = 0; i < pad; i += 1) cells.push({ day: null, current: false });
    const now = new Date();
    for (let d = 1; d <= days; d += 1) {
      cells.push({
        day: d,
        current: d === now.getDate() && month === now.getMonth() && year === now.getFullYear(),
      });
    }
    return { year, month, cells };
  }, [calCursor]);

  const markedDays = useMemo(() => {
    const set = new Set<number>();
    if (calendar.month !== today.getMonth() || calendar.year !== today.getFullYear()) return set;
    for (const t of tours) {
      const d = new Date(t.date);
      if (d.getMonth() === calendar.month) set.add(d.getDate());
    }
    return set;
  }, [tours, calendar.month, calendar.year, today]);

  const schedule = useMemo(() => {
    const slots = ['07:00', '09:30', '11:00', '14:00', '16:30'];
    const todayTours = tours.filter((t) => isSameDay(t.date, today)).slice(0, 4);
    if (todayTours.length) {
      return todayTours.map((t, i) => ({
        time: slots[i % slots.length],
        title: `Tournée ${t.tourNumber}`,
        meta: `${t.zone} · ${t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : t.vehicle?.plate ?? 'Véhicule'}`,
        tone: i % 2 === 0 ? 'blue' : 'orange',
      }));
    }
    return [
      { time: '08:00', title: 'Préparation des tournées', meta: `${data?.activeTours ?? 0} tournée(s) active(s)`, tone: 'blue' },
      { time: '10:30', title: 'Contrôle qualité', meta: obs?.openQualityChecks ? `${obs.openQualityChecks} ouvert(s)` : 'Aucun contrôle ouvert', tone: 'orange' },
      { time: '15:00', title: 'Clôture des livraisons', meta: `${data?.deliveriesToday ?? 0} livrée(s) aujourd’hui`, tone: 'blue' },
    ];
  }, [tours, today, data, obs]);

  const taskProgress = useMemo(() => {
    const done = (data?.deliveriesToday ?? 0) + (stockLow === 0 ? 1 : 0) + ((obs?.openQualityChecks ?? 0) === 0 ? 1 : 0);
    const total = Math.max((data?.ordersToday ?? 0) + 2, done, 4);
    return Math.min(100, Math.round((done / total) * 1000) / 10);
  }, [data, stockLow, obs]);

  const activities = useMemo(() => {
    const items: Array<{ icon: IconName; tone: string; title: string; detail: string; at?: string }> = [];
    for (const o of orders.slice(0, 3)) {
      items.push({ icon: 'cart', tone: 'blue', title: 'Nouvelle commande', detail: `${o.orderNumber} · ${o.client?.name ?? 'Client'}`, at: o.createdAt });
    }
    for (const p of payments.slice(0, 2)) {
      items.push({ icon: 'banknote', tone: 'green', title: 'Paiement reçu', detail: `${p.client?.name ?? 'Client'} · ${money(Number(p.amount))}`, at: p.createdAt });
    }
    for (const n of notifs.slice(0, 3)) {
      items.push({ icon: 'bell', tone: 'orange', title: n.title, detail: n.message, at: n.createdAt });
    }
    return items.slice(0, 6);
  }, [orders, payments, notifs]);

  const highlightBar = weekdayIndex(new Date());
  const barMax = Math.max(...weekBars, 1);
  const perfMax = Math.max(...weekBars, ...weekDeliveries, 1);
  const gaugePct = Math.max(8, Math.min(100, taskProgress));

  if (error) return <p className="error-msg">{error}</p>;
  if (!data) return <p className="erp-loading">Chargement du tableau de bord...</p>;

  return (
    <div className="mc-dash">
      <div className="mc-dash-main">
        <div className="mc-kpis">
          {kpis.map((k) => (
            <article key={k.key} className={`mc-kpi mc-kpi--${k.tone}`}>
              <div className="mc-kpi-top">
                <span className="mc-kpi-label">{k.label}</span>
                <span className="mc-kpi-icon" aria-hidden><Icon name={k.icon} size={16} /></span>
              </div>
              <div className="mc-kpi-value">{k.value}</div>
              <div className="mc-kpi-foot">
                <div className={`mc-kpi-trend ${k.trend.up ? 'is-up' : 'is-down'}`}>
                  {k.trend.up ? '↑' : '↓'} {k.trend.value}% vs hier
                </div>
                <svg className="mc-kpi-spark" viewBox="0 0 88 28" aria-hidden>
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={sparkPoints(k.spark)}
                  />
                </svg>
              </div>
            </article>
          ))}
        </div>

        <div className="mc-row">
          <section className="mc-card">
            <header className="mc-card-head">
              <h3>Commandes de la semaine</h3>
              <span className="mc-chip">Cette semaine</span>
            </header>
            <div className="mc-bars" role="img" aria-label="Volume de commandes par jour">
              {weekBars.map((v, i) => (
                <div key={WEEKDAYS[i]} className="mc-bar-col">
                  {i === highlightBar && v > 0 && <span className="mc-bar-tip">{v} cmd.</span>}
                  <div
                    className={`mc-bar${i === highlightBar ? ' is-hot' : ''}`}
                    style={{ height: `${Math.max(10, (v / barMax) * 100)}%` }}
                  />
                  <span>{WEEKDAYS[i]}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mc-card">
            <header className="mc-card-head">
              <h3>Origine des commandes</h3>
            </header>
            <div className="mc-stack" aria-label="Répartition des origines">
              {sources.map((s) => (
                <div key={s.label} className="mc-stack-seg" style={{ flexGrow: Math.max(s.pct, 4), background: s.color }} title={`${s.label} ${s.pct}%`} />
              ))}
              {!sources.length && <div className="mc-stack-seg" style={{ flexGrow: 1, background: '#e2e8f0' }} />}
            </div>
            <ul className="mc-legend">
              {sources.map((s) => (
                <li key={s.label}><i style={{ background: s.color }} /> {s.label} <em>{s.pct}%</em></li>
              ))}
              {!sources.length && <li>Aucune commande récente</li>}
            </ul>
          </section>
        </div>

        <section className="mc-card mc-area-card">
          <header className="mc-card-head">
            <h3>Performance de la semaine</h3>
            <div className="mc-line-legend">
              <span className="is-blue">Commandes</span>
              <span className="is-orange">Livraisons</span>
            </div>
          </header>
          <svg className="mc-area" viewBox="0 0 640 180" preserveAspectRatio="none" role="img" aria-label="Commandes et livraisons sur 7 jours">
            <defs>
              <linearGradient id="mcAreaBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_BLUE} stopOpacity="0.28" />
                <stop offset="100%" stopColor={CHART_BLUE} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={`${seriesPath(weekBars, 640, 168, perfMax)} L640 168 L0 168 Z`} fill="url(#mcAreaBlue)" />
            <path d={seriesPath(weekBars, 640, 168, perfMax)} fill="none" stroke={CHART_BLUE} strokeWidth="3" />
            <path d={seriesPath(weekDeliveries, 640, 168, perfMax)} fill="none" stroke={CHART_ORANGE} strokeWidth="3" />
          </svg>
          <div className="mc-area-axis">
            {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
          </div>
        </section>

        <div className="mc-row mc-row--split">
          <section className="mc-card">
            <header className="mc-card-head">
              <h3>Stock par produit</h3>
            </header>
            <div className="mc-donut-wrap">
              <div className="mc-donut" style={{ background: donutBg }}>
                <div className="mc-donut-hole">
                  <strong>{data.totalStock.toLocaleString('fr-FR')}</strong>
                  <span>unités</span>
                </div>
              </div>
              <ul className="mc-legend mc-legend--col">
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

          <section className="mc-card">
            <header className="mc-card-head">
              <h3>Tournées en cours</h3>
              <Link to="/tours" className="mc-see-all">Voir tout</Link>
            </header>
            <div className="mc-vacancy-list">
              {activeTours.map((t) => (
                <article key={t.id} className="mc-vacancy">
                  <div>
                    <strong>{t.tourNumber}</strong>
                    <p>{t.zone} · {t.vehicle?.name ?? t.vehicle?.plate ?? 'Véhicule'} · {t.driver ? `${t.driver.firstName} ${t.driver.lastName}` : 'Sans chauffeur'}</p>
                    <span className="mc-vacancy-tag">{t.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="mc-vacancy-side">
                    <em>{t.orders?.length ?? 0} cmd.</em>
                    <Link to="/tours">Détails →</Link>
                  </div>
                </article>
              ))}
              {!activeTours.length && (
                <p className="erp-muted">Aucune tournée active. Les prochaines apparaitront ici.</p>
              )}
              <article className="mc-vacancy mc-vacancy--soft">
                <div>
                  <strong>Stock bas</strong>
                  <p>{stockLow} article(s) sous le seuil de 50 unités</p>
                </div>
                <div className="mc-vacancy-side">
                  <em className={stockLow ? 'is-warn' : ''}>{stockLow}</em>
                  <Link to="/stock">Détails →</Link>
                </div>
              </article>
            </div>
          </section>
        </div>

        <section className="mc-card mc-table-card">
          <header className="mc-card-head">
            <h3>Commandes récentes</h3>
            <div className="mc-table-tools">
              <label className="mc-table-search">
                <Icon name="search" size={16} />
                <input
                  type="search"
                  placeholder="Rechercher une commande"
                  value={tableQuery}
                  onChange={(e) => setTableQuery(e.target.value)}
                />
              </label>
              <Link to="/orders" className="mc-see-all">Voir tout</Link>
            </div>
          </header>
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Commande</th>
                  <th>Date</th>
                  <th>Canal</th>
                  <th>Statut</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="mc-person">
                        <span className="mc-avatar">{initials(o.client?.name ?? 'Client')}</span>
                        <div>
                          <strong>{o.client?.name ?? 'Client'}</strong>
                          <small>{o.client?.segment ?? 'Compte'}</small>
                        </div>
                      </div>
                    </td>
                    <td>{o.orderNumber}</td>
                    <td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>{orderChannel(o)}</td>
                    <td><StatusPill status={o.status} /></td>
                    <td className="mc-amount">{money(Number(o.totalAmount))}</td>
                  </tr>
                ))}
                {!tableRows.length && (
                  <tr><td colSpan={6} className="erp-table-empty">Aucune commande à afficher.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside className="mc-dash-aside">
        <section className="mc-card mc-cal-card">
          <header className="mc-card-head">
            <button type="button" className="mc-cal-nav" onClick={() => setCalCursor(new Date(calendar.year, calendar.month - 1, 1))} aria-label="Mois précédent">‹</button>
            <h3>{MONTHS[calendar.month]} {calendar.year}</h3>
            <button type="button" className="mc-cal-nav" onClick={() => setCalCursor(new Date(calendar.year, calendar.month + 1, 1))} aria-label="Mois suivant">›</button>
          </header>
          <div className="mc-cal-grid">
            {WEEKDAYS.map((d) => <span key={d} className="mc-cal-wd">{d[0]}</span>)}
            {calendar.cells.map((c, i) => (
              <span
                key={`${calendar.month}-${i}`}
                className={`mc-cal-day${c.current ? ' is-today' : ''}${c.day && markedDays.has(c.day) ? ' is-marked' : ''}${c.day ? '' : ' is-empty'}`}
              >
                {c.day ?? ''}
              </span>
            ))}
          </div>
        </section>

        <section className="mc-card">
          <header className="mc-card-head">
            <h3>Planning du jour</h3>
          </header>
          <ul className="mc-schedule">
            {schedule.map((s) => (
              <li key={s.title} className={`mc-schedule-item mc-schedule-item--${s.tone}`}>
                <time>{s.time}</time>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.meta}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mc-card">
          <header className="mc-card-head">
            <h3>Tâches</h3>
            <span className="mc-chip">{Math.round(gaugePct)}%</span>
          </header>
          <div className="mc-gauge" role="img" aria-label={`Progression ${gaugePct}%`}>
            <svg viewBox="0 0 180 100">
              <path d="M16 96 A74 74 0 0 1 164 96" fill="none" stroke="#e8eef4" strokeWidth="14" strokeLinecap="round" />
              <path
                d="M16 96 A74 74 0 0 1 164 96"
                fill="none"
                stroke={CHART_BLUE}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${(gaugePct / 100) * 232} 232`}
              />
              <text x="90" y="88" textAnchor="middle" fontSize="18" fontWeight="800" fill="#0f172a">{gaugePct}%</text>
            </svg>
          </div>
          <ul className="mc-tasks">
            <li className={stockLow === 0 ? 'is-done' : ''}>Contrôler les stocks bas</li>
            <li className={(obs?.openQualityChecks ?? 0) === 0 ? 'is-done' : ''}>Clôturer les contrôles qualité</li>
            <li className={data.deliveriesToday > 0 ? 'is-done' : ''}>Valider les livraisons du jour</li>
            <li>Préparer les tournées de demain</li>
          </ul>
        </section>

        <section className="mc-card">
          <header className="mc-card-head">
            <h3>Activité récente</h3>
          </header>
          <ul className="mc-feed">
            {activities.map((a, i) => (
              <li key={`${a.title}-${i}`}>
                <span className={`mc-feed-icon mc-feed-icon--${a.tone}`}><Icon name={a.icon} size={14} /></span>
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
      </aside>
    </div>
  );
}
