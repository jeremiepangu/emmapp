import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { portalApi, DeliveryTracking, Order, PaymentMethod, PortalCatalogItem, PortalConsigne, PortalInvoice, PortalLoyalty } from '../../api';
import { usePortal } from '../../PortalContext';
import StatusPill from '../../components/ErpUi';
import { ErpPageHeader, ErpPanel } from '../../components/ErpUi';
import DocButton from '../../components/DocButton';
import { printClientSheet, printDeliveryTracking, printOrder, printOrdersList, printPortalConsignes, printPortalInvoice, printPortalLoyalty } from '../../documents/templates';
import { printDocument, formatMoney } from '../../documents/printDocument';

const PAY_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'AIRTEL_MONEY', label: 'Airtel Money' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

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
  if (!tier) return { unit: item.basePrice, pct: 0, name: null as string | null };
  const unit = tier.type === 'PERCENT'
    ? Math.round(item.basePrice * (1 - tier.value / 100) * 100) / 100
    : Number(tier.value);
  const pct = item.basePrice > 0 ? Math.round(((item.basePrice - unit) / item.basePrice) * 10000) / 100 : 0;
  return { unit, pct, name: tier.name };
}

export function PortalLayout() {
  const { account, me, isLoading, logout } = usePortal();
  if (isLoading) return <div className="loading-screen">Chargement…</div>;
  if (!account) return <Navigate to="/portail/connexion" replace />;

  return (
    <div className="erp-layout portal-layout">
      <aside className="erp-sidebar">
        <div className="erp-sidebar-brand">
          <div className="erp-brand-mark" aria-hidden>E</div>
          <div>
            <div className="erp-brand-logo">EMMAS</div>
            <div className="erp-brand-sub">Portail client</div>
          </div>
        </div>
        <nav>
          <Link to="/portail">Accueil</Link>
          <Link to="/portail/commander">Commander</Link>
          <Link to="/portail/commandes">Mes commandes</Link>
          <Link to="/portail/livraisons">Suivi</Link>
          <Link to="/portail/factures">Factures</Link>
          <Link to="/portail/fidelite">Fidélité</Link>
          <Link to="/portail/consignes">Consignes</Link>
          <Link to="/portail/assistant">Assistant</Link>
        </nav>
        <button type="button" className="erp-btn erp-btn--ghost" onClick={logout}>Déconnexion</button>
      </aside>
      <div className="erp-main-wrap">
        <header className="erp-topbar">
          <strong>{account.fullName}</strong>
          <span className="erp-muted">{me?.client.name} · {me?.client.loyaltyTier}</span>
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
    </div>
  );
}

export function PortalCatalogPage() {
  const { refresh } = usePortal();
  const [items, setItems] = useState<PortalCatalogItem[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => { portalApi.getCatalog().then(setItems); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const lines = Object.entries(qty).filter(([, q]) => q > 0).map(([productId, quantity]) => ({ productId, quantity }));
    if (!lines.length) return;
    await portalApi.createOrder({ lines });
    setMessage('Commande enregistrée.');
    await refresh();
    navigate('/portail/commandes');
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Commander"
        subtitle="Tarif de votre segment, même cycle que les commandes internes"
        actions={
          <DocButton
            label="Tarif"
            onClick={() => printDocument({
              kind: 'Grille tarifaire',
              tables: [{
                headers: ['Produit', 'Format', 'Prix catalogue', 'Prix applique', 'Remise'],
                rows: items.map((p) => {
                  const priced = priceForQty(p, qty[p.id] || 1);
                  return [p.name, p.format, formatMoney(p.basePrice), formatMoney(priced.unit), `${priced.pct} %`];
                }),
              }],
              signatures: ['Pour EMMAPURE'],
            })}
          />
        }
      />
      {message && <p className="erp-success">{message}</p>}
      <form onSubmit={submit}>
        <ErpPanel title="Catalogue">
          <table className="erp-table">
            <thead><tr><th>Produit</th><th>Format</th><th>Prix catalogue</th><th>Prix pour la qte</th><th>Remise</th><th>Qté</th></tr></thead>
            <tbody>
              {items.map((p) => {
                const q = qty[p.id] ?? 0;
                const priced = priceForQty(p, q || 1);
                return (
                  <tr key={p.id}>
                    <td>
                      {p.name}
                      {p.tiers && p.tiers.length > 0 && (
                        <div className="erp-muted">
                          {p.tiers.map((t) => (
                            <div key={t.id}>
                              {t.minQuantity}{t.maxQuantity != null ? `-${t.maxQuantity}` : '+'} : {t.type === 'PERCENT' ? `${t.value} %` : `${t.value.toLocaleString('fr-FR')} CDF`}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>{p.format}</td>
                    <td>{p.basePrice.toLocaleString('fr-FR')} CDF</td>
                    <td>{priced.unit.toLocaleString('fr-FR')} CDF</td>
                    <td>{priced.pct} %</td>
                    <td>
                      <input type="number" min={0} value={q} onChange={(e) => setQty({ ...qty, [p.id]: Number(e.target.value) })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ErpPanel>
        <button type="submit" className="erp-btn">Passer la commande</button>
      </form>
    </div>
  );
}

export function PortalOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => { portalApi.getOrders().then(setOrders); }, []);
  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Mes commandes"
        actions={<DocButton label="Imprimer" onClick={() => printOrdersList(orders)} />}
      />
      <ErpPanel title={`${orders.length} commandes`}>
        <table className="erp-table">
          <thead><tr><th>N°</th><th>Statut</th><th>Montant</th><th></th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><code>{o.orderNumber}</code></td>
                <td><StatusPill status={o.status} /></td>
                <td>{Number(o.totalAmount).toLocaleString('fr-FR')} CDF</td>
                <td><DocButton onClick={() => printOrder(o)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}

export function PortalDeliveriesPage() {
  const [tracking, setTracking] = useState<DeliveryTracking | null>(null);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    portalApi.getDeliveries().then((list) => {
      setIds(list.map((d) => d.id));
      if (list[0]) portalApi.getDeliveryTracking(list[0].id).then(setTracking);
    });
  }, []);

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Suivi de livraison"
        actions={tracking ? <DocButton label="Bon de suivi" onClick={() => printDeliveryTracking(tracking)} /> : undefined}
      />
      <ErpPanel title="Livraisons" padded>
        {ids.map((id) => (
          <button key={id} type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => portalApi.getDeliveryTracking(id).then(setTracking)}>
            {id.slice(0, 8)}
          </button>
        ))}
        {tracking && (
          <div style={{ marginTop: 16 }}>
            <p>
              {tracking.deliveryNumber} · <StatusPill status={tracking.status} />
              {tracking.driverName ? ` · ${tracking.driverName}` : ''}
              {tracking.vehiclePlate ? ` · ${tracking.vehiclePlate}` : ''}
            </p>
            <p>ETA {tracking.etaMinutes ?? '—'} min · arrêts restants {tracking.stopsRemaining ?? '—'}</p>
            <ul>
              {tracking.timeline.map((t) => (
                <li key={t.label}>{t.done ? '✓' : '○'} {t.label} {t.at ? `· ${new Date(t.at).toLocaleString('fr-FR')}` : ''}</li>
              ))}
            </ul>
          </div>
        )}
        {!ids.length && <p className="erp-muted">Aucune livraison en cours.</p>}
      </ErpPanel>
    </div>
  );
}

export function PortalInvoicesPage() {
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [pay, setPay] = useState({ orderId: '', amount: 0, method: 'MPESA' as PaymentMethod, reference: '' });

  const load = () => portalApi.getInvoices().then(setInvoices);
  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await portalApi.pay({ orderId: pay.orderId || undefined, amount: pay.amount, method: pay.method, reference: pay.reference || undefined });
    load();
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Factures & paiement mobile"
        actions={<DocButton label="Imprimer les factures" onClick={() => printDocument({
          kind: 'Relevé de factures',
          tables: [{
            headers: ['Commande', 'Total', 'Payé', 'Solde', 'Statut'],
            rows: invoices.map((i) => [i.orderNumber, formatMoney(i.totalAmount), formatMoney(i.paidAmount), formatMoney(i.balance), i.status]),
          }],
          signatures: ['Pour EMMAPURE', 'Pour le client'],
        })} />}
      />
      <ErpPanel title="Factures">
        <table className="erp-table">
          <thead><tr><th>Commande</th><th>Total</th><th>Payé</th><th>Solde</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.orderId}>
                <td><code>{i.orderNumber}</code></td>
                <td>{i.totalAmount.toLocaleString('fr-FR')}</td>
                <td>{i.paidAmount.toLocaleString('fr-FR')}</td>
                <td>{i.balance.toLocaleString('fr-FR')}</td>
                <td><StatusPill status={i.status} /></td>
                <td><DocButton label="Facture" onClick={() => printPortalInvoice(i)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
      <ErpPanel title="Régler par monnaie électronique" padded>
        <form onSubmit={submit} className="form-row">
          <div className="form-group">
            <label>Commande</label>
            <select value={pay.orderId} onChange={(e) => setPay({ ...pay, orderId: e.target.value })}>
              <option value="">Libre</option>
              {invoices.filter((i) => i.balance > 0).map((i) => <option key={i.orderId} value={i.orderId}>{i.orderNumber}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Montant</label><input type="number" min={1} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: Number(e.target.value) })} required /></div>
          <div className="form-group">
            <label>Opérateur</label>
            <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value as PaymentMethod })}>
              {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Référence</label><input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></div>
          <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Payer</button></div>
        </form>
      </ErpPanel>
    </div>
  );
}

export function PortalLoyaltyPage() {
  const [loyalty, setLoyalty] = useState<PortalLoyalty | null>(null);
  const [points, setPoints] = useState(100);
  const load = () => portalApi.getLoyalty().then(setLoyalty);
  useEffect(() => { load(); }, []);
  if (!loyalty) return <p className="erp-loading">Chargement…</p>;
  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Fidélité"
        subtitle={`Niveau ${loyalty.tier} · ${loyalty.points} points`}
        actions={<DocButton label="Relevé" onClick={() => printPortalLoyalty(loyalty)} />}
      />
      <ErpPanel title="Avantages" padded>
        <ul>{loyalty.benefits.map((b) => <li key={b}>{b}</li>)}</ul>
        {loyalty.nextTier && <p>Encore {loyalty.pointsToNextTier} points pour {loyalty.nextTier}.</p>}
        <form onSubmit={(e) => { e.preventDefault(); portalApi.redeemLoyalty(points).then(setLoyalty); }} className="form-row">
          <div className="form-group"><label>Échanger des points</label><input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} /></div>
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
        actions={<DocButton label="Relevé" onClick={() => printPortalConsignes(rows)} />}
      />
      <ErpPanel title="Mouvements">
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
      </ErpPanel>
    </div>
  );
}

export function PortalAssistantPage() {
  const [sessionId, setSessionId] = useState<string>();
  const [question, setQuestion] = useState('');
  const [log, setLog] = useState<Array<{ q: string; a: string }>>([]);
  const ask = async (e: FormEvent) => {
    e.preventDefault();
    const r = await portalApi.ask(question, sessionId);
    setSessionId(r.sessionId);
    setLog((prev) => [...prev, { q: question, a: r.answer }]);
    setQuestion('');
  };
  return (
    <div className="erp-page">
      <ErpPageHeader title="Assistant client" subtitle="Commandes, livraisons et consignes" />
      <ErpPanel title="Conversation" padded>
        {log.map((m, i) => (
          <div key={i}>
            <p><strong>Vous :</strong> {m.q}</p>
            <p><strong>Assistant :</strong> {m.a}</p>
          </div>
        ))}
        <form onSubmit={ask} className="form-row">
          <div className="form-group" style={{ flex: 1 }}><label>Question</label><input value={question} onChange={(e) => setQuestion(e.target.value)} required /></div>
          <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Envoyer</button></div>
        </form>
      </ErpPanel>
    </div>
  );
}
