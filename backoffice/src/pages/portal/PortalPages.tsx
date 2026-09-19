import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { portalApi, Delivery, DeliveryTracking, Order, PaymentMethod, PortalCatalogItem, PortalConsigne, PortalInvoice, PortalLoyalty } from '../../api';
import { usePortal } from '../../PortalContext';
import StatusPill, { EmptyState, ErpPageHeader, ErpPanel, TableLoading } from '../../components/ErpUi';
import DocButton from '../../components/DocButton';
import ProductSaleCard, { ProductSaleGrid } from '../../components/ProductSaleCard';
import { printClientSheet, printDeliveryTracking, printOrder, printOrdersList, printPortalConsignes, printPortalInvoice, printPortalLoyalty } from '../../documents/templates';
import { printDocument, formatMoney } from '../../documents/printDocument';
import { exportSheet, sheetOrders } from '../../excel/specs';

const PAY_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'AIRTEL_MONEY', label: 'Airtel Money' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

const CART_KEY = 'emmapp-portal-cart';

function readCart(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(CART_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistCart(qty: Record<string, number>) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(qty));
}

function invoicePaymentStatus(invoice: PortalInvoice) {
  if (invoice.balance <= 0) return 'SOLDEE';
  if (invoice.paidAmount > 0) return 'PARTIELLE';
  return 'IMPAYEE';
}

function osmEmbed(lat: number, lng: number) {
  const d = 0.02;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function priceForQty(item: PortalCatalogItem, quantity: number) {
  const qty = Math.max(1, quantity);
  const matches = [...(item.tiers ?? [])].filter((t) =>
    qty >= t.minQuantity && (t.maxQuantity == null || qty <= t.maxQuantity),
  );
  matches.sort((a, b) => {
    const specific = Number(!!b.productId) - Number(!!a.productId);
    if (specific) return specific;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return ((a.maxQuantity ?? 1_000_000) - a.minQuantity) - ((b.maxQuantity ?? 1_000_000) - b.minQuantity);
  });
  const tier = matches[0];
  if (!tier) return { unit: item.basePrice, offered: 0, name: null as string | null };
  if (tier.type === 'ARTICLE_OFFERT') {
    const step = Math.max(1, tier.stepQuantity ?? 10);
    const offered = Math.floor(qty / step) * Math.max(0, Math.floor(tier.value));
    return { unit: item.basePrice, offered, name: tier.name };
  }
  return { unit: Number(tier.value), offered: 0, name: tier.name };
}

export function PortalLayout() {
  const { account, me, isLoading, logout } = usePortal();
  if (isLoading) return <div className="loading-screen">Chargement…</div>;
  if (!account) return <Navigate to="/portail/connexion" replace />;

  return (
    <div className="erp-layout portal-layout">
      <aside className="erp-sidebar">
        <div className="erp-sidebar-brand">
          <img className="erp-brand-mark erp-brand-mark--img" src="/logo-emmanuel-services.png" alt="" />
          <div>
            <div className="erp-brand-logo">EMMAPP</div>
            <div className="erp-brand-sub">Portail client</div>
          </div>
        </div>
        <nav>
          <NavLink to="/portail" end>Accueil</NavLink>
          <NavLink to="/portail/commander">Commander</NavLink>
          <NavLink to="/portail/commandes">Mes commandes</NavLink>
          <NavLink to="/portail/livraisons">Suivi</NavLink>
          <NavLink to="/portail/factures">Factures</NavLink>
          <NavLink to="/portail/fidelite">Fidélité</NavLink>
          <NavLink to="/portail/consignes">Consignes</NavLink>
          <NavLink to="/portail/assistant">Assistant</NavLink>
        </nav>
        <button type="button" className="erp-btn erp-btn--ghost" onClick={logout}>Déconnexion</button>
      </aside>
      <div className="erp-main-wrap">
        <header className="erp-topbar">
          <div className="erp-topbar-left">
            <h1 className="erp-topbar-title">Portail</h1>
          </div>
          <div className="erp-topbar-right">
            <div className="erp-topbar-profile">
              <span className="erp-user-badge">{account.fullName.trim().charAt(0).toUpperCase()}</span>
              <div className="erp-topbar-profile-text">
                <span className="erp-topbar-profile-name">{account.fullName}</span>
                <span className="erp-topbar-profile-role">{me?.client.name} · {me?.client.loyaltyTier}</span>
              </div>
            </div>
          </div>
        </header>
        <main className="erp-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PortalHomePage() {
  const { me } = usePortal();
  if (!me) return <p className="erp-loading">Chargement…</p>;
  return (
    <div className="erp-page">
      <ErpPageHeader
        title={`Bonjour ${me.account.fullName}`}
        subtitle={me.client.name}
        excel={{
          filename: 'portail-accueil',
          sheets: [
            exportSheet('Synthese', [['indicateur', 'Indicateur'], ['valeur', 'Valeur']], [
              { indicateur: 'Client', valeur: me.client.name },
              { indicateur: 'Code', valeur: me.client.code },
              { indicateur: 'Encours', valeur: me.outstandingAmount },
              { indicateur: 'Commandes en cours', valeur: me.openOrders },
              { indicateur: 'Consigne', valeur: `${me.consigneBalance} / ${me.consigneLimit}` },
              { indicateur: 'Points fidelite', valeur: me.client.loyaltyPoints },
              { indicateur: 'Niveau', valeur: me.client.loyaltyTier },
            ]),
          ],
        }}
        actions={
          <DocButton
            label="Fiche client"
            onClick={() => printClientSheet({
              id: me.client.id,
              code: me.client.code,
              name: me.client.name,
              segment: me.client.segment,
              zone: me.client.zone,
              phone: me.client.phone,
              consigneBalance: me.consigneBalance,
              consigneLimit: me.consigneLimit,
            })}
          />
        }
      />
      <div className="erp-kpi-row">
        <div className="erp-kpi erp-kpi--green">
          <div className="erp-kpi-label">Encours</div>
          <div className="erp-kpi-value">{me.outstandingAmount.toLocaleString('fr-FR')} CDF</div>
        </div>
        <div className="erp-kpi erp-kpi--blue">
          <div className="erp-kpi-label">Commandes en cours</div>
          <div className="erp-kpi-value">{me.openOrders}</div>
        </div>
        <div className="erp-kpi erp-kpi--orange">
          <div className="erp-kpi-label">Consigne</div>
          <div className="erp-kpi-value">{me.consigneBalance} / {me.consigneLimit}</div>
        </div>
          <div className="erp-kpi erp-kpi--red">
            <div className="erp-kpi-label">Points fidélité</div>
            <div className="erp-kpi-value">{me.client.loyaltyPoints}</div>
          </div>
        </div>
        <p style={{ marginTop: 20 }}>
          <Link to="/portail/commander" className="erp-btn">Passer une commande</Link>
        </p>
    </div>
  );
}

export function PortalCatalogPage() {
  const { refresh } = usePortal();
  const [items, setItems] = useState<PortalCatalogItem[]>([]);
  const [qty, setQty] = useState<Record<string, number>>(readCart);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const updateQty = (next: Record<string, number>) => {
    setQty(next);
    persistCart(next);
  };

  useEffect(() => {
    portalApi.getCatalog()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Catalogue indisponible'))
      .finally(() => setLoading(false));
  }, []);

  const cartLines = useMemo(() => (
    items
      .map((item) => {
        const quantity = qty[item.id] ?? 0;
        if (quantity <= 0) return null;
        const priced = priceForQty(item, quantity);
        return { item, quantity, priced, lineTotal: priced.unit * quantity };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
  ), [items, qty]);
  const cartTotal = cartLines.reduce((sum, line) => sum + line.lineTotal, 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const lines = cartLines.map(({ item, quantity }) => ({ productId: item.id, quantity }));
    if (!lines.length) {
      setError('Ajoutez au moins un produit au panier.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await portalApi.createOrder({ lines });
      persistCart({});
      setQty({});
      setMessage('Commande enregistrée.');
      await refresh();
      navigate('/portail/commandes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commande impossible');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Commander"
        subtitle="Tarif de votre segment, même cycle que les commandes internes"
        excel={{
          filename: 'portail-catalogue',
          sheets: [
            exportSheet('Catalogue', [
              ['code', 'Code'], ['produit', 'Produit'], ['format', 'Format'],
              ['prix', 'Prix catalogue'], ['prixSegment', 'Prix segment'], ['bonus', 'Articles offerts pour 10'],
            ], items.map((row) => ({
              code: row.code,
              produit: row.name,
              format: row.format,
              prix: row.basePrice,
              prixSegment: row.segmentPrice,
              bonus: priceForQty(row, 10).offered,
            }))),
          ],
        }}
        actions={
          <DocButton
            label="Tarif"
            onClick={() => printDocument({
              kind: 'Grille tarifaire',
              tables: [{
                headers: ['Produit', 'Format', 'Prix catalogue', 'Prix applique', 'Bonus'],
                rows: items.map((p) => {
                  const priced = priceForQty(p, qty[p.id] || 1);
                  return [p.name, p.format, formatMoney(p.basePrice), formatMoney(priced.unit), `${priced.offered} offert(s)`];
                }),
              }],
              signatures: ['Pour EMMANUEL SERVICES SARLU'],
            })}
          />
        }
      />
      {message && <p className="erp-success">{message}</p>}
      {error && <p className="error-msg">{error}</p>}
      <form onSubmit={submit}>
        <ErpPanel title="Catalogue">
          {loading && <TableLoading label="Chargement du catalogue…" />}
          {!loading && items.length === 0 && <EmptyState>Aucun produit disponible.</EmptyState>}
          {!loading && items.length > 0 && (
            <ProductSaleGrid>
              {items.map((p) => {
                const q = qty[p.id] ?? 0;
                const priced = priceForQty(p, q || 1);
                const outOfStock = p.availableQty != null && p.availableQty <= 0;
                const max = p.availableQty != null ? p.availableQty : 999;
                return (
                  <ProductSaleCard
                    key={p.id}
                    name={p.name}
                    code={p.code}
                    format={p.format}
                    imageUrl={p.imageUrl}
                    price={priced.unit}
                    quantity={q}
                    max={max}
                    disabled={outOfStock}
                    onQuantityChange={(next) => updateQty({ ...qty, [p.id]: next })}
                    onAdd={() => updateQty({ ...qty, [p.id]: Math.max(1, q) })}
                    addLabel={outOfStock ? 'Rupture de stock' : q > 0 ? 'Dans la commande' : 'Ajouter au panier'}
                    selected={q > 0}
                    badge={outOfStock ? 'Rupture' : q > 0 ? `${q}` : undefined}
                    metaLabel="Livraison"
                    metaValue={outOfStock ? 'Indisponible' : p.availableQty != null ? `${p.availableQty} en stock · sous 24 h` : 'Sous 24 h après validation'}
                    note={
                      <>
                        {priced.offered > 0 && (
                          <div>
                            {priced.offered} article{priced.offered > 1 ? 's' : ''} offert{priced.offered > 1 ? 's' : ''} · {q + priced.offered} livrés
                          </div>
                        )}
                        {p.tiers?.map((t) => (
                          <div key={t.id}>
                            {t.minQuantity}{t.maxQuantity != null ? `-${t.maxQuantity}` : '+'} : {t.type === 'ARTICLE_OFFERT' ? `${t.value} offert(s) pour ${t.stepQuantity ?? 10} achetés` : `${t.value.toLocaleString('fr-FR')} CDF`}
                          </div>
                        ))}
                      </>
                    }
                  />
                );
              })}
            </ProductSaleGrid>
          )}
        </ErpPanel>
        <ErpPanel title="Récapitulatif" padded>
          <div className="portal-cart-recap">
            {cartLines.length === 0 ? (
              <EmptyState>Votre panier est vide. Ajoutez un produit ci-dessus.</EmptyState>
            ) : (
              <div>
                <ul>
                  {cartLines.map(({ item, quantity, lineTotal, priced }) => (
                    <li key={item.id}>
                      {item.name} × {quantity}
                      {priced.offered > 0 ? ` (+${priced.offered} offert${priced.offered > 1 ? 's' : ''})` : ''}
                      {' · '}
                      {lineTotal.toLocaleString('fr-FR')} CDF
                    </li>
                  ))}
                </ul>
                <p className="portal-cart-total">Total {cartTotal.toLocaleString('fr-FR')} CDF</p>
              </div>
            )}
            <button type="submit" className="erp-btn" disabled={submitting || cartLines.length === 0}>
              {submitting ? 'Envoi…' : 'Passer la commande'}
            </button>
          </div>
        </ErpPanel>
      </form>
    </div>
  );
}

export function PortalOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    portalApi.getOrders()
      .then(setOrders)
      .catch((err) => setError(err instanceof Error ? err.message : 'Impossible de charger les commandes'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Mes commandes"
        excel={{ filename: 'portail-commandes', sheets: [sheetOrders(orders)] }}
        actions={<DocButton label="Imprimer" onClick={() => printOrdersList(orders)} />}
      />
      {error && <p className="error-msg">{error}</p>}
      <ErpPanel title={`${orders.length} commandes`}>
        {loading && <TableLoading label="Chargement des commandes…" />}
        {!loading && orders.length === 0 && <EmptyState>Aucune commande pour le moment.</EmptyState>}
        {!loading && orders.length > 0 && (
          <table className="erp-table">
            <thead><tr><th>N°</th><th>Statut</th><th>Paiement</th><th>Montant</th><th></th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><code>{o.orderNumber}</code></td>
                  <td><StatusPill status={o.status} /></td>
                  <td><StatusPill status={o.paymentStatus ?? 'IMPAYEE'} /></td>
                  <td>{Number(o.totalAmount).toLocaleString('fr-FR')} CDF</td>
                  <td><DocButton onClick={() => printOrder(o)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ErpPanel>
    </div>
  );
}

export function PortalDeliveriesPage() {
  const [tracking, setTracking] = useState<DeliveryTracking | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTracking = (id: string) => {
    portalApi.getDeliveryTracking(id)
      .then(setTracking)
      .catch((err) => setError(err instanceof Error ? err.message : 'Suivi indisponible'));
  };

  useEffect(() => {
    portalApi.getDeliveries()
      .then((list) => {
        setDeliveries(list);
        if (list[0]) loadTracking(list[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Livraisons indisponibles'))
      .finally(() => setLoading(false));
  }, []);

  const lat = tracking?.latitude;
  const lng = tracking?.longitude;

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Suivi de livraison"
        excel={{
          filename: 'portail-livraisons',
          sheets: [
            exportSheet('Livraison', [['champ', 'Champ'], ['valeur', 'Valeur']], tracking ? [
              { champ: 'Numero', valeur: tracking.deliveryNumber },
              { champ: 'Statut', valeur: tracking.status },
              { champ: 'Tournee', valeur: tracking.tourNumber ?? '' },
              { champ: 'Chauffeur', valeur: tracking.driverName ?? '' },
              { champ: 'Vehicule', valeur: tracking.vehiclePlate ?? '' },
              { champ: 'ETA min', valeur: tracking.etaMinutes ?? '' },
              { champ: 'Arrets restants', valeur: tracking.stopsRemaining ?? '' },
            ] : []),
            exportSheet('Chronologie', [['etape', 'Etape'], ['fait', 'Fait'], ['date', 'Date']], (tracking?.timeline ?? []).map((row) => ({
              etape: row.label,
              fait: row.done ? 'Oui' : 'Non',
              date: row.at ? new Date(row.at).toLocaleString('fr-FR') : '',
            }))),
          ],
        }}
        actions={tracking ? <DocButton label="Bon de suivi" onClick={() => printDeliveryTracking(tracking)} /> : undefined}
      />
      {error && <p className="error-msg">{error}</p>}
      <ErpPanel title="Livraisons" padded>
        {loading && <TableLoading label="Chargement des livraisons…" />}
        {!loading && deliveries.length === 0 && <EmptyState>Aucune livraison en cours.</EmptyState>}
        {!loading && deliveries.length > 0 && (
          <div className="erp-delivery-picks">
            {deliveries.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`erp-btn erp-btn--sm${tracking?.deliveryId === d.id ? '' : ' erp-btn--ghost'}`}
                onClick={() => loadTracking(d.id)}
              >
                {d.deliveryNumber} · <StatusPill status={d.status} />
              </button>
            ))}
          </div>
        )}
        {tracking && (
          <div style={{ marginTop: 16 }}>
            <p>
              {tracking.deliveryNumber} · <StatusPill status={tracking.status} />
              {tracking.tourNumber ? ` · ${tracking.tourNumber}` : ''}
              {tracking.driverName ? ` · ${tracking.driverName}` : ''}
              {tracking.vehiclePlate ? ` · ${tracking.vehiclePlate}` : ''}
            </p>
            <p>ETA {tracking.etaMinutes ?? '—'} min · arrêts restants {tracking.stopsRemaining ?? '—'}</p>
            <ul className="erp-timeline">
              {tracking.timeline.map((t) => (
                <li key={t.label} className={t.done ? 'is-done' : undefined}>
                  {t.label}
                  {t.at && <time dateTime={t.at}>{new Date(t.at).toLocaleString('fr-FR')}</time>}
                </li>
              ))}
            </ul>
            {lat != null && lng != null && (
              <iframe
                className="erp-track-map"
                title="Position de la tournée"
                src={osmEmbed(lat, lng)}
              />
            )}
          </div>
        )}
      </ErpPanel>
    </div>
  );
}

export function PortalInvoicesPage() {
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pay, setPay] = useState({ orderId: '', amount: 0, method: 'MPESA' as PaymentMethod, reference: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  const load = () => portalApi.getInvoices()
    .then(setInvoices)
    .catch((err) => setError(err instanceof Error ? err.message : 'Factures indisponibles'))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPaying(true);
    setError('');
    setMessage('');
    try {
      await portalApi.pay({
        orderId: pay.orderId || undefined,
        amount: pay.amount,
        method: pay.method,
        reference: pay.reference || undefined,
      });
      setMessage('Paiement enregistré.');
      setPay({ ...pay, amount: 0, reference: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Paiement impossible');
    } finally {
      setPaying(false);
    }
  };

  const selectInvoice = (orderId: string) => {
    const invoice = invoices.find((row) => row.orderId === orderId);
    setPay({
      ...pay,
      orderId,
      amount: invoice ? invoice.balance : pay.amount,
    });
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Factures & paiement mobile"
        excel={{
          filename: 'portail-factures',
          sheets: [
            exportSheet('Factures', [
              ['commande', 'Commande'], ['total', 'Total'], ['paye', 'Paye'],
              ['solde', 'Solde'], ['statut', 'Statut'],
            ], invoices.map((row) => ({
              commande: row.orderNumber,
              total: row.totalAmount,
              paye: row.paidAmount,
              solde: row.balance,
              statut: row.status,
            }))),
          ],
        }}
        actions={<DocButton label="Imprimer les factures" onClick={() => printDocument({
          kind: 'Relevé de factures',
          tables: [{
            headers: ['Commande', 'Total', 'Payé', 'Solde', 'Statut'],
            rows: invoices.map((i) => [i.orderNumber, formatMoney(i.totalAmount), formatMoney(i.paidAmount), formatMoney(i.balance), i.status]),
          }],
          signatures: ['Pour EMMANUEL SERVICES SARLU', 'Pour le client'],
        })} />}
      />
      {message && <p className="erp-success">{message}</p>}
      {error && <p className="error-msg">{error}</p>}
      <ErpPanel title="Factures">
        {loading && <TableLoading label="Chargement des factures…" />}
        {!loading && invoices.length === 0 && <EmptyState>Aucune facture pour le moment.</EmptyState>}
        {!loading && invoices.length > 0 && (
          <table className="erp-table">
            <thead><tr><th>Commande</th><th>Total</th><th>Payé</th><th>Solde</th><th>Livraison</th><th>Paiement</th><th></th></tr></thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.orderId}>
                  <td><code>{i.orderNumber}</code></td>
                  <td>{i.totalAmount.toLocaleString('fr-FR')}</td>
                  <td>{i.paidAmount.toLocaleString('fr-FR')}</td>
                  <td>{i.balance.toLocaleString('fr-FR')}</td>
                  <td><StatusPill status={i.status} /></td>
                  <td><StatusPill status={invoicePaymentStatus(i)} /></td>
                  <td><DocButton label="Facture" onClick={() => printPortalInvoice(i)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ErpPanel>
      <ErpPanel title="Régler par monnaie électronique" padded>
        <p className="erp-muted">M-Pesa, Orange Money, Airtel Money ou Wave uniquement. Indiquez la référence de transaction.</p>
        <form onSubmit={submit} className="form-row">
          <div className="form-group">
            <label htmlFor="portal-pay-order">Commande</label>
            <select id="portal-pay-order" value={pay.orderId} onChange={(e) => selectInvoice(e.target.value)}>
              <option value="">Libre</option>
              {invoices.filter((i) => i.balance > 0).map((i) => <option key={i.orderId} value={i.orderId}>{i.orderNumber}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="portal-pay-amount">Montant</label>
            <input id="portal-pay-amount" type="number" min={1} value={pay.amount || ''} onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })} required />
          </div>
          <div className="form-group">
            <label htmlFor="portal-pay-method">Opérateur</label>
            <select id="portal-pay-method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as PaymentMethod })}>
              {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="portal-pay-ref">Référence</label>
            <input id="portal-pay-ref" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
          </div>
          <div className="form-group" style={{ alignSelf: 'end' }}>
            <button type="submit" className="erp-btn" disabled={paying}>{paying ? 'Envoi…' : 'Payer'}</button>
          </div>
        </form>
      </ErpPanel>
    </div>
  );
}

export function PortalLoyaltyPage() {
  const [loyalty, setLoyalty] = useState<PortalLoyalty | null>(null);
  const [points, setPoints] = useState(100);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = () => portalApi.getLoyalty().then(setLoyalty);
  useEffect(() => { load(); }, []);

  const redeem = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      setLoyalty(await portalApi.redeemLoyalty(points));
      setMessage(`${points} points échangés.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échange impossible');
    }
  };

  if (!loyalty) return <TableLoading label="Chargement de la fidélité…" />;
  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Fidélité"
        subtitle={`Niveau ${loyalty.tier} · ${loyalty.points} points`}
        excel={{
          filename: 'portail-fidelite',
          sheets: [
            exportSheet('Synthese', [['indicateur', 'Indicateur'], ['valeur', 'Valeur']], [
              { indicateur: 'Niveau', valeur: loyalty.tier },
              { indicateur: 'Points', valeur: loyalty.points },
              { indicateur: 'Portefeuille', valeur: loyalty.walletBalance },
              { indicateur: 'Niveau suivant', valeur: loyalty.nextTier ?? '' },
              { indicateur: 'Points restants', valeur: loyalty.pointsToNextTier ?? '' },
            ]),
            exportSheet('Avantages', [['avantage', 'Avantage']], loyalty.benefits.map((avantage) => ({ avantage }))),
            exportSheet('Historique', [['date', 'Date'], ['libelle', 'Libelle'], ['points', 'Points']], loyalty.history.map((row) => ({
              date: new Date(row.at).toLocaleString('fr-FR'),
              libelle: row.label,
              points: row.points,
            }))),
          ],
        }}
        actions={<DocButton label="Relevé" onClick={() => printPortalLoyalty(loyalty)} />}
      />
      {message && <p className="erp-success">{message}</p>}
      {error && <p className="error-msg">{error}</p>}
      <ErpPanel title="Avantages" padded>
        <ul>{loyalty.benefits.map((b) => <li key={b}>{b}</li>)}</ul>
        {loyalty.nextTier && <p>Encore {loyalty.pointsToNextTier} points pour {loyalty.nextTier}.</p>}
        <form onSubmit={redeem} className="form-row">
          <div className="form-group"><label htmlFor="portal-loyalty-points">Échanger des points</label><input id="portal-loyalty-points" type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} /></div>
          <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Échanger</button></div>
        </form>
      </ErpPanel>
    </div>
  );
}

export function PortalConsignesPage() {
  const [rows, setRows] = useState<PortalConsigne[]>([]);
  useEffect(() => { portalApi.getConsignes().then(setRows); }, []);
  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Solde de consignes"
        excel={{
          filename: 'portail-consignes',
          sheets: [
            exportSheet('Mouvements', [
              ['type', 'Type'], ['quantite', 'Quantite'], ['produit', 'Produit'], ['date', 'Date'],
            ], rows.map((row) => ({
              type: row.type,
              quantite: row.quantity,
              produit: row.productName ?? '',
              date: new Date(row.createdAt).toLocaleString('fr-FR'),
            }))),
          ],
        }}
        actions={<DocButton label="Relevé" onClick={() => printPortalConsignes(rows)} />}
      />
      <ErpPanel title="Mouvements">
        {rows.length === 0 ? (
          <EmptyState>Aucun mouvement de consigne.</EmptyState>
        ) : (
          <table className="erp-table">
            <thead><tr><th>Type</th><th>Quantité</th><th>Produit</th><th>Date</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.type}</td>
                  <td>{r.quantity}</td>
                  <td>{r.productName ?? '—'}</td>
                  <td>{new Date(r.createdAt).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ErpPanel>
    </div>
  );
}

export function PortalAssistantPage() {
  const [sessionId, setSessionId] = useState<string>();
  const [question, setQuestion] = useState('');
  const [log, setLog] = useState<Array<{ q: string; a: string }>>([]);
  const [error, setError] = useState('');
  const ask = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const r = await portalApi.ask(question, sessionId);
      setSessionId(r.sessionId);
      setLog((prev) => [...prev, { q: question, a: r.answer }]);
      setQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant indisponible');
    }
  };
  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Assistant client"
        subtitle="Commandes, livraisons et consignes"
        excel={{
          filename: 'portail-assistant',
          sheets: [
            exportSheet('Conversation', [['auteur', 'Auteur'], ['message', 'Message']], log.flatMap((row) => [
              { auteur: 'Client', message: row.q },
              { auteur: 'Assistant', message: row.a },
            ])),
          ],
        }}
        actions={
          <DocButton
            label="Conversation"
            onClick={() => printDocument({
              kind: 'Conversation portail',
              fields: [{ label: 'Messages', value: String(log.length) }],
              tables: [{
                headers: ['Auteur', 'Message'],
                rows: log.flatMap((m) => [['Client', m.q], ['Assistant', m.a]]),
              }],
              signatures: ['Pour EMMANUEL SERVICES SARLU'],
            })}
          />
        }
      />
      {error && <p className="error-msg">{error}</p>}
      <ErpPanel title="Conversation" padded>
        {log.map((m, i) => (
          <div key={i}>
            <p><strong>Vous :</strong> {m.q}</p>
            <p><strong>Assistant :</strong> {m.a}</p>
          </div>
        ))}
        <form onSubmit={ask} className="form-row">
          <div className="form-group" style={{ flex: 1 }}><label htmlFor="portal-assistant-q">Question</label><input id="portal-assistant-q" value={question} onChange={(e) => setQuestion(e.target.value)} required /></div>
          <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Envoyer</button></div>
        </form>
      </ErpPanel>
    </div>
  );
}
