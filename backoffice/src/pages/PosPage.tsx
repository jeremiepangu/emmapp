import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  api,
  PaymentMethod,
  PosCatalog,
  PosCheckoutInput,
  PosQuote,
  PosSale,
} from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printPosSalesList, printPosTicket } from '../documents/templates';
import { exportSheet } from '../excel/specs';

const METHOD_LABEL: Record<PaymentMethod, string> = {
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement',
  MOBILE_MONEY: 'Mobile Money',
  MPESA: 'M-Pesa',
  ORANGE_MONEY: 'Orange Money',
  AIRTEL_MONEY: 'Airtel Money',
  WAVE: 'Wave',
  CREDIT: 'Crédit',
};

const THUMB_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6'];
const HOLD_KEY = 'emmapp-pos-hold';

function money(value: string | number | null | undefined): string {
  return `${Number(value ?? 0).toLocaleString('fr-FR')} CDF`;
}

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

type CartLine = { productId: string; quantity: number };

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'P';
}

export default function PosPage() {
  const { can } = usePermissions();
  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quote, setQuote] = useState<PosQuote | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('ESPECES');
  const [cashReceived, setCashReceived] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [sales, setSales] = useState<PosSale[]>([]);
  const [summary, setSummary] = useState({ tickets: 0, cancelled: 0, revenue: 0, averageTicket: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastSale, setLastSale] = useState<PosSale | null>(null);
  const [held, setHeld] = useState(false);

  const loadSales = () => {
    const { from, to } = todayBounds();
    return api.getPosSales(from, to).then((res) => {
      setSales(res.sales);
      setSummary(res.summary);
    });
  };

  useEffect(() => {
    api.getPosCatalog().then((c) => {
      setCatalog(c);
      setClientId(c.walkInClient.id);
    }).catch(() => setError('Impossible de charger le catalogue caisse'));
    loadSales().catch(() => setSales([]));
    setHeld(Boolean(sessionStorage.getItem(HOLD_KEY)));
  }, []);

  useEffect(() => {
    if (!cart.length) {
      setQuote(null);
      return;
    }
    const timer = window.setTimeout(() => {
      api.quotePos({ clientId: clientId || null, lines: cart })
        .then(setQuote)
        .catch(() => setQuote(null));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [cart, clientId]);

  const products = useMemo(() => {
    const list = catalog?.products ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => `${p.name} ${p.code} ${p.format}`.toLowerCase().includes(q));
  }, [catalog, search]);

  const qtyOf = (productId: string) => cart.find((l) => l.productId === productId)?.quantity ?? 0;

  const addProduct = (productId: string) => {
    setCart((prev) => {
      const found = prev.find((l) => l.productId === productId);
      if (found) return prev.map((l) => l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const setQty = (productId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity < 1) return prev.filter((l) => l.productId !== productId);
      return prev.map((l) => l.productId === productId ? { ...l, quantity } : l);
    });
  };

  const clearCart = () => {
    setCart([]);
    setQuote(null);
    setCashReceived('');
    setReference('');
    setNotes('');
    setError('');
  };

  const holdSale = () => {
    if (!cart.length) return;
    sessionStorage.setItem(HOLD_KEY, JSON.stringify({ cart, clientId, method, notes }));
    setHeld(true);
    clearCart();
  };

  const restoreHeld = () => {
    const raw = sessionStorage.getItem(HOLD_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { cart: CartLine[]; clientId?: string; method?: PaymentMethod; notes?: string };
      setCart(saved.cart ?? []);
      if (saved.clientId) setClientId(saved.clientId);
      if (saved.method) setMethod(saved.method);
      if (saved.notes) setNotes(saved.notes);
      sessionStorage.removeItem(HOLD_KEY);
      setHeld(false);
    } catch {
      sessionStorage.removeItem(HOLD_KEY);
      setHeld(false);
    }
  };

  const catalogTotal = cart.reduce((sum, line) => {
    const product = catalog?.products.find((p) => p.id === line.productId);
    return sum + Number(product?.unitPrice ?? 0) * line.quantity;
  }, 0);
  const total = quote?.total ?? catalogTotal;
  const received = Number(cashReceived || 0);
  const change = method === 'ESPECES' && received > 0 ? Math.max(0, received - total) : 0;

  const checkout = async (e: FormEvent) => {
    e.preventDefault();
    if (!cart.length) return;
    setSaving(true);
    setError('');
    const payload: PosCheckoutInput = {
      clientId: clientId || null,
      lines: cart,
      method,
      cashReceived: method === 'ESPECES' ? (received || total) : undefined,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      const sale = await api.checkoutPos(payload);
      setLastSale(sale);
      printPosTicket(sale);
      clearCart();
      await loadSales();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Encaissement impossible');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Point de vente"
        subtitle="Caisse tablette : catalogue, panier et encaissement"
        excel={{
          filename: 'caisse',
          sheets: [exportSheet('Tickets', [['saleNumber', 'Ticket'], ['client', 'Client'], ['method', 'Mode'], ['total', 'Montant'], ['status', 'Statut'], ['date', 'Date']], sales.map((row) => ({
            saleNumber: row.saleNumber,
            client: row.client?.name ?? '',
            method: row.method,
            total: Number(row.totalAmount),
            status: row.status,
            date: new Date(row.createdAt).toLocaleString('fr-FR'),
          })))],
        }}
        actions={
          <>
            <DocButton label="Journal du jour" onClick={() => printPosSalesList(sales)} />
            {lastSale && <DocButton label="Réimprimer le dernier ticket" onClick={() => printPosTicket(lastSale)} />}
          </>
        }
      />
      <div className="erp-kpi-row">
        <div className="erp-kpi erp-kpi--blue"><div className="erp-kpi-label">Tickets du jour</div><div className="erp-kpi-value">{summary.tickets}</div></div>
        <div className="erp-kpi erp-kpi--green"><div className="erp-kpi-label">Encaissements</div><div className="erp-kpi-value">{money(summary.revenue)}</div></div>
        <div className="erp-kpi erp-kpi--orange"><div className="erp-kpi-label">Ticket moyen</div><div className="erp-kpi-value">{money(summary.averageTicket)}</div></div>
      </div>

      <form className="pos-tablet" onSubmit={checkout}>
        <section className="pos-tablet-catalog">
          <input
            className="pos-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit, un code ou un format"
            aria-label="Recherche produit"
          />
          <div className="pos-product-list">
            {products.map((p, i) => {
              const qty = qtyOf(p.id);
              return (
                <div key={p.id} className="pos-product-row">
                  <div className="pos-product-thumb" style={{ background: THUMB_COLORS[i % THUMB_COLORS.length] }}>
                    {initials(p.name)}
                  </div>
                  <div className="pos-product-meta">
                    <strong>{p.name}</strong>
                    <p>{p.code} · {p.format}</p>
                  </div>
                  <div className="pos-product-side">
                    <div className="price">{money(p.unitPrice)}</div>
                    <div className="pos-qty-ctrl">
                      <button type="button" onClick={() => setQty(p.id, qty - 1)} disabled={!qty} aria-label="Diminuer">−</button>
                      <span>{qty}</span>
                      <button
                        type="button"
                        className="add"
                        onClick={() => addProduct(p.id)}
                        disabled={!can('pos', 'create')}
                        aria-label="Ajouter"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!products.length && <p className="erp-table-empty">Aucun produit.</p>}
          </div>
        </section>

        <aside className="pos-tablet-cart">
          <div className="pos-cart-title">Vente en cours</div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {catalog?.clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div className="pos-cart-lines">
            {cart.map((line) => {
              const priced = quote?.lines.find((l) => l.productId === line.productId);
              const product = catalog?.products.find((p) => p.id === line.productId);
              const name = priced?.name ?? product?.name ?? line.productId;
              const unit = priced?.unitPrice ?? Number(product?.unitPrice ?? 0);
              const lineTotal = priced?.lineTotal ?? unit * line.quantity;
              return (
                <div key={line.productId} className="pos-cart-line">
                  <div>
                    <strong>{name}</strong>
                    <p>{money(unit)} / u. × {line.quantity}{priced?.ruleName ? ` · ${priced.ruleName}` : ''}</p>
                  </div>
                  <strong>{money(lineTotal)}</strong>
                </div>
              );
            })}
            {!cart.length && (
              <p className="erp-table-empty">
                {held ? 'Une vente est en attente. Restaurez-la pour continuer.' : 'Ajoutez un produit au panier.'}
              </p>
            )}
          </div>
          <div className="pos-cart-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          {quote && quote.discount > 0 && (
            <p className="erp-muted" style={{ marginBottom: 8 }}>Remise {money(quote.discount)}</p>
          )}
          <div className="form-group">
            <label>Mode de paiement</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {(catalog?.methods ?? ['ESPECES']).map((m) => (
                <option key={m} value={m}>{METHOD_LABEL[m] ?? m}</option>
              ))}
            </select>
          </div>
          {method === 'ESPECES' && (
            <div className="form-group">
              <label>Montant reçu</label>
              <input type="number" min={0} step={100} value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder={total ? String(total) : ''} />
              {received > 0 && <p className="erp-muted">Monnaie : {money(change)}</p>}
            </div>
          )}
          {method !== 'ESPECES' && method !== 'CREDIT' && (
            <div className="form-group">
              <label>Référence</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° transaction" />
            </div>
          )}
          <div className="form-group">
            <label>Note</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="error-msg">{error}</p>}
          {held && !cart.length && (
            <button type="button" className="erp-btn" style={{ width: '100%', marginBottom: 8 }} onClick={restoreHeld}>
              Restaurer la vente en attente
            </button>
          )}
          <div className="pos-actions">
            <button type="button" className="pos-btn pos-btn--cancel" onClick={clearCart} disabled={!cart.length}>Annuler</button>
            <button type="button" className="pos-btn pos-btn--hold" onClick={holdSale} disabled={!cart.length}>Attente</button>
            {can('pos', 'create') && (
              <button type="submit" className="pos-btn pos-btn--pay" disabled={!cart.length || saving}>
                {saving ? 'Paiement...' : 'Paiement'}
              </button>
            )}
          </div>
        </aside>
      </form>

      <ErpPanel title={`Ventes du jour (${sales.length})`}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Heure</th>
              <th>Client</th>
              <th>Mode</th>
              <th>Montant</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.saleNumber}</strong></td>
                <td>{new Date(s.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>{s.client?.name ?? '—'}</td>
                <td>{METHOD_LABEL[s.method] ?? s.method}</td>
                <td>{money(s.totalAmount)}</td>
                <td><StatusPill status={s.status} /></td>
                <td className="erp-row-actions">
                  <DocButton label="Ticket" onClick={() => printPosTicket(s)} />
                  {can('pos', 'validate') && s.status === 'PAYEE' && (
                    <button
                      type="button"
                      className="erp-btn erp-btn--sm erp-btn--ghost"
                      onClick={() => api.cancelPosSale(s.id).then(loadSales)}
                    >
                      Annuler
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!sales.length && (
              <tr><td colSpan={7} className="erp-table-empty">Aucune vente aujourd’hui.</td></tr>
            )}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}
